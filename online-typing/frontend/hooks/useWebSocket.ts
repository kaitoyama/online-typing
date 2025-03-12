import { useState, useEffect, useCallback, useRef } from 'react';
import { TournamentState } from '../types/tournament';

type MessageType = {
  type: string;
  text?: string;
  tournament?: TournamentState;
};

export const useWebSocket = (url: string) => {
  const [text, setText] = useState<string>('');
  const [tournament, setTournament] = useState<TournamentState>({
    players: [],
    matches: [],
    registrationOpen: true,
  });
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Connect to WebSocket
  useEffect(() => {
    if (!url) {
      setIsConnected(false);
      return;
    }
    
    console.log('Attempting to connect to:', url);
    // Create WebSocket connection
    const socket = new WebSocket(url);
    socketRef.current = socket;

    // Connection opened
    socket.addEventListener('open', () => {
      console.log('Connected to WebSocket');
      setIsConnected(true);
    });

    // Listen for messages
    socket.addEventListener('message', (event) => {
      try {
        const message: MessageType = JSON.parse(event.data);
        if (message.type === 'update' && message.text !== undefined) {
          setText(message.text);
        }
        if (message.type === 'tournament' && message.tournament) {
          setTournament(message.tournament);
        }
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    });

    // Connection closed
    socket.addEventListener('close', () => {
      console.log('Disconnected from WebSocket');
      setIsConnected(false);
      
      // Attempt to reconnect after a delay
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      reconnectTimeoutRef.current = setTimeout(() => {
        console.log('Attempting to reconnect...');
        // The effect will run again when we update the component
        if (socketRef.current) {
          socketRef.current = null;
        }
      }, 3000); // Try to reconnect after 3 seconds
    });

    // Connection error
    socket.addEventListener('error', (error) => {
      console.error('WebSocket error:', error);
      setIsConnected(false);
    });

    // Clean up on unmount
    return () => {
      // Clear any reconnection attempts
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      // Close socket connection if open
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };
  }, [url]);

  // Send message to WebSocket server
  const sendMessage = useCallback((newText: string) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      const message: MessageType = {
        type: 'update',
        text: newText,
      };
      socketRef.current.send(JSON.stringify(message));
    }
  }, []);

  // Send tournament update to WebSocket server
  const updateTournament = useCallback((tournamentData: TournamentState) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      const message: MessageType = {
        type: 'tournament',
        tournament: tournamentData
      };
      socketRef.current.send(JSON.stringify(message));
    }
  }, []);

  return { text, isConnected, tournament, sendMessage, updateTournament };
};