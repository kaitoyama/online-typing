import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useWebSocket } from '../hooks/useWebSocket';
import Navigation from '../components/Navigation';
import { Player, Match, TournamentState } from '../types/tournament';

export default function Home() {
  const [isClient, setIsClient] = useState<boolean>(false);
  const [localText, setLocalText] = useState<string>('');
  const [playerName, setPlayerName] = useState<string>('');
  const [matchWinner, setMatchWinner] = useState<{ matchId: number, winnerId: number } | null>(null);
  const { text, isConnected, tournament, sendMessage, updateTournament } = useWebSocket(isClient ? 'ws://localhost:8080/ws' : '');
  
  // Set client-side flag after component mounts to avoid SSR issues
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Check for bye match on current match change and set winner automatically
  useEffect(() => {
    if (!tournament || !tournament.currentMatchId || !tournament.matches) return;
    
    const currentMatch = tournament.matches.find(m => m.id === tournament.currentMatchId);
    if (!currentMatch || !currentMatch.isByeMatch || currentMatch.winner || !currentMatch.byeWinnerId) return;
    
    // If this is a bye match and no winner is set yet, set up the match winner
    setMatchWinner({ matchId: currentMatch.id, winnerId: currentMatch.byeWinnerId });
  }, [tournament.currentMatchId, tournament.matches]);

  // Handle player registration with comma-separated support
  const handleRegisterPlayer = () => {
    if (!playerName.trim() || tournament.players.length >= 16) return;
    
    // Split input by commas and process each name
    const playerNames = playerName
      .split(',')
      .map(name => name.trim());
    
    if (playerNames.length === 0) return;
    
    // Limit the number of players to register to available slots
    const availableSlots = 16 - tournament.players.length;
    const namesToRegister = playerNames.slice(0, availableSlots);
    
    // Create a new array of players to add
    const newPlayers: Player[] = [];
    let nextId = tournament.players.length > 0 
      ? Math.max(...tournament.players.map(p => p.id)) + 1 
      : 1;
    
    namesToRegister.forEach(name => {
      // Use hyphen as indicator for bye (empty slot)
      const playerName = name === "-" ? "" : name;
      
      // Only register if name is not empty (except for hyphens which become empty)
      if (name !== "") {
        newPlayers.push({
          id: nextId++,
          name: playerName
        });
      }
    });
    
    // Create a new tournament object with all new players added
    const updatedTournament: TournamentState = {
      ...tournament,
      players: [...tournament.players, ...newPlayers]
    };
    
    // Update the tournament state through WebSocket
    console.log("Registering players:", newPlayers);
    updateTournament(updatedTournament);
    setPlayerName('');
  };

  // Reset tournament to registration phase
  const handleResetTournament = () => {
    const resetConfirmed = window.confirm("トーナメントをリセットしますか？全ての対戦結果が失われます。");
    
    if (!resetConfirmed) return;
    
    const resetTournament: TournamentState = {
      players: [],
      matches: [],
      registrationOpen: true
    };
    
    console.log("Resetting tournament");
    updateTournament(resetTournament);
  };

  // Start tournament by generating brackets
  const handleStartTournament = () => {
    // Fill remaining slots with empty players (byes) if needed
    const playerCount = tournament.players.length;
    let allPlayers = [...tournament.players];
    
    // Create bye players if we have fewer than 16
    if (playerCount < 16) {
      // Create necessary number of bye entries
      const byeCount = 16 - playerCount;
      let nextId = allPlayers.length > 0 
        ? Math.max(...allPlayers.map(p => p.id)) + 1 
        : 1;
      
      for (let i = 0; i < byeCount; i++) {
        allPlayers.push({
          id: nextId++,
          name: "" // Empty name represents a bye
        });
      }
    }
    
    // Generate tournament brackets (15 matches for 16 players)
    const matches: Match[] = [];
    
    // First round (8 matches)
    for (let i = 0; i < 8; i++) {
      matches.push({
        id: i + 1,
        round: 1,
        player1: allPlayers[i * 2],
        player2: allPlayers[i * 2 + 1],
        nextMatchId: Math.floor(i / 2) + 9,
        points: {} // 空のポイントオブジェクトを初期化
      });
    }

    // Second round (4 matches)
    for (let i = 0; i < 4; i++) {
      matches.push({
        id: i + 9,
        round: 2,
        nextMatchId: Math.floor(i / 2) + 13,
        points: {}
      });
    }

    // Semi-finals (2 matches)
    matches.push({ id: 13, round: 3, nextMatchId: 15, points: {} });
    matches.push({ id: 14, round: 3, nextMatchId: 15, points: {} });

    // Third place match (losers of semifinals compete for 3rd place)
    matches.push({ 
      id: 16, 
      round: 4, 
      isThirdPlace: true,
      points: {}
    });
    
    // Final (1 match) - winner gets 1st place
    matches.push({ id: 15, round: 4, points: {} });

    // Process automatic advances for bye matches
    processInitialByes(matches);
    
    // Set the first playable match as current
    const firstPlayableMatch = findFirstPlayableMatch(matches);
    const currentMatchId = firstPlayableMatch?.id || 1;
    
    const updatedTournament: TournamentState = {
      ...tournament,
      matches,
      registrationOpen: false,
      currentMatchId
    };
    
    console.log("Starting tournament with matches:", matches.length);
    updateTournament(updatedTournament);
  };
  
  // Helper function to process initial byes
  const processInitialByes = (matches: Match[]) => {
    // Process first round byes
    const firstRoundMatches = matches.filter(m => m.round === 1);
    
    for (const match of firstRoundMatches) {
      // Mark matches with bye players but don't automatically advance
      if (match.player1 && match.player2) {
        if (match.player1.name === "") {
          // Mark match as a bye match but don't automatically advance
          matches[matches.findIndex(m => m.id === match.id)] = {
            ...match,
            isByeMatch: true,
            byeWinnerId: match.player2.id // Pre-determine the winner but don't set it yet
          };
        } else if (match.player2.name === "") {
          // Mark match as a bye match but don't automatically advance
          matches[matches.findIndex(m => m.id === match.id)] = {
            ...match,
            isByeMatch: true,
            byeWinnerId: match.player1.id // Pre-determine the winner but don't set it yet
          };
        }
      }
    }
    
    // Don't automatically process subsequent rounds
    // They will be processed manually when the user clicks "next match"
  };
  
  // Helper function to process match wins
  const processMatchWin = (matches: Match[], matchId: number, winnerId: number) => {
    const matchIndex = matches.findIndex(m => m.id === matchId);
    if (matchIndex === -1) return;
    
    const match = matches[matchIndex];
    
    // Set winner for this match
    matches[matchIndex] = {
      ...match,
      winner: winnerId,
      points: { [winnerId]: 2 } // Auto-win with 2 points
    };
    
    // Find winning player object
    const winningPlayer = tournament.players.find(p => p.id === winnerId);
    if (!winningPlayer) return;
    
    // Advance winner to next match
    if (match.nextMatchId) {
      const nextMatchIndex = matches.findIndex(m => m.id === match.nextMatchId);
      if (nextMatchIndex === -1) return;
      
      const nextMatch = matches[nextMatchIndex];
      
      // Add winner to next match in proper position
      if (!nextMatch.player1) {
        matches[nextMatchIndex] = {
          ...nextMatch,
          player1: winningPlayer
        };
      } else {
        matches[nextMatchIndex] = {
          ...nextMatch,
          player2: winningPlayer
        };
      }
      
      // Check if the next match is now a bye match (one player is empty)
      if (
        (nextMatch.player1 && nextMatch.player2 === undefined && winningPlayer.name !== "") || 
        (nextMatch.player2 && nextMatch.player1 === undefined && winningPlayer.name !== "")
      ) {
        // Don't mark as bye yet, wait until both players are determined
      } else if (
        nextMatch.player1 && nextMatch.player2 && 
        (nextMatch.player1.name === "" || nextMatch.player2.name === "")
      ) {
        // This is now a bye match, mark it accordingly
        const byeWinnerId = nextMatch.player1.name === "" ? nextMatch.player2.id : nextMatch.player1.id;
        matches[nextMatchIndex] = {
          ...matches[nextMatchIndex],
          isByeMatch: true,
          byeWinnerId
        };
      }
    }
  };
  
  // Helper function to process byes in subsequent rounds
  const processSubsequentByes = (matches: Match[], round: number) => {
    const roundMatches = matches.filter(m => m.round === round);
    
    for (const match of roundMatches) {
      // Only process matches where both players are determined
      if (!match.player1 || !match.player2) continue;
      
      // Mark bye matches but don't automatically advance
      if (match.player1.name === "" && match.player2.name !== "") {
        matches[matches.findIndex(m => m.id === match.id)] = {
          ...match,
          isByeMatch: true,
          byeWinnerId: match.player2.id
        };
      } else if (match.player2.name === "" && match.player1.name !== "") {
        matches[matches.findIndex(m => m.id === match.id)] = {
          ...match,
          isByeMatch: true,
          byeWinnerId: match.player1.id
        };
      }
    }
  };
  
  // Helper function to find the first playable match
  const findFirstPlayableMatch = (matches: Match[]): Match | undefined => {
    // A match is playable if it has two determined players and no winner yet
    // Include bye matches as they now need manual advancement
    return matches
      .filter(m => m.player1 && m.player2 && !m.winner)
      .sort((a, b) => a.id - b.id)[0];
  };

  // Handle point won by a player
  const handlePointWon = (matchId: number, playerId: number) => {
    if (!tournament.matches) return;
    
    const updatedMatches = [...tournament.matches];
    const currentMatchIndex = updatedMatches.findIndex(m => m.id === matchId);
    
    if (currentMatchIndex === -1) return;
    
    const currentMatch = updatedMatches[currentMatchIndex];
    
    // Ensure points object exists
    if (!currentMatch.points) {
      currentMatch.points = {};
    }
    
    // Add point to the player
    const currentPoints = currentMatch.points[playerId] || 0;
    const updatedPoints = { 
      ...currentMatch.points,
      [playerId]: currentPoints + 1 
    };
    
    // Update the match with new points
    updatedMatches[currentMatchIndex] = {
      ...currentMatch,
      points: updatedPoints
    };
    
    // Check if player has reached 2 points (won the match)
    if (updatedPoints[playerId] >= 2) {
      // Store the winner info but don't advance yet
      setMatchWinner({ matchId, winnerId: playerId });
    }

    // Update tournament state with new points
    const updatedTournament: TournamentState = {
      ...tournament,
      matches: updatedMatches
    };
    
    updateTournament(updatedTournament);
  };

  // Proceed to next match after confirming the winner
  const handleProceedToNextMatch = () => {
    // Get current match details
    const currentMatch = tournament.matches.find(m => m.id === tournament.currentMatchId);
    if (!currentMatch) return;
    
    let winnerId: number | undefined;
    
    // Determine winner ID from either matchWinner state or bye match
    if (matchWinner) {
      winnerId = matchWinner.winnerId;
    } else if (currentMatch.isByeMatch && currentMatch.byeWinnerId) {
      winnerId = currentMatch.byeWinnerId;
    }
    
    if (!winnerId) return;
    
    const updatedMatches = [...tournament.matches];
    const currentMatchIndex = updatedMatches.findIndex(m => m.id === currentMatch.id);
    
    // Handle match winner processing
    handleMatchWinner(updatedMatches, currentMatchIndex, winnerId);
    
    // Clear the stored winner
    setMatchWinner(null);
  };

  // Handle match winner (when a player gets 2 points)
  const handleMatchWinner = (updatedMatches: Match[], currentMatchIndex: number, winnerId: number) => {
    const currentMatch = updatedMatches[currentMatchIndex];
    
    // Set winner for this match
    updatedMatches[currentMatchIndex] = {
      ...currentMatch,
      winner: winnerId
    };

    // Get the loser of the match
    const loserId = currentMatch.player1?.id === winnerId 
      ? currentMatch.player2?.id 
      : currentMatch.player1?.id;
    
    const losingPlayer = tournament.players.find(p => p.id === loserId);
    const winningPlayer = tournament.players.find(p => p.id === winnerId);
    
    if (!winningPlayer) return;

    // Find and update the next match if there is one
    if (currentMatch.nextMatchId) {
      const nextMatchIndex = updatedMatches.findIndex(m => m.id === currentMatch.nextMatchId);
      
      if (nextMatchIndex !== -1) {
        const nextMatch = updatedMatches[nextMatchIndex];
        
        // Add winner to next match (either as player1 or player2)
        if (!nextMatch.player1) {
          updatedMatches[nextMatchIndex] = {
            ...nextMatch,
            player1: winningPlayer
          };
        } else {
          updatedMatches[nextMatchIndex] = {
            ...nextMatch,
            player2: winningPlayer
          };
        }
      }
    }

    // For semifinal matches, add losers to the third-place match
    if (currentMatch.round === 3 && losingPlayer) {
      const thirdPlaceMatch = updatedMatches.find(m => m.isThirdPlace === true);
      if (thirdPlaceMatch) {
        const thirdPlaceMatchIndex = updatedMatches.findIndex(m => m.isThirdPlace === true);
        
        if (!thirdPlaceMatch.player1) {
          updatedMatches[thirdPlaceMatchIndex] = {
            ...thirdPlaceMatch,
            player1: losingPlayer
          };
        } else {
          updatedMatches[thirdPlaceMatchIndex] = {
            ...thirdPlaceMatch,
            player2: losingPlayer
          };
        }
      }
    }

    // Find the next match to play (prioritize third-place match before the final)
    let nextUnplayedMatch: Match | undefined;
    
    // 準決勝後、両方の3位決定戦の選手が揃っていれば、3位決定戦を先に実施
    const thirdPlaceMatch = updatedMatches.find(m => m.isThirdPlace);
    const bothSemifinalsCompleted = updatedMatches.filter(m => m.round === 3).every(m => m.winner);
    
    if (bothSemifinalsCompleted && thirdPlaceMatch?.player1 && thirdPlaceMatch?.player2 && !thirdPlaceMatch.winner) {
      nextUnplayedMatch = thirdPlaceMatch;
    } 
    // 3位決定戦が終了したら決勝戦
    else if (thirdPlaceMatch?.winner) {
      nextUnplayedMatch = updatedMatches.find(
        m => m.id === 15 && !m.winner && m.player1 && m.player2
      );
    } 
    // それ以外は次のラウンドの試合
    else {
      nextUnplayedMatch = updatedMatches
        .filter(m => !m.winner && m.player1 && m.player2)
        .sort((a, b) => a.id - b.id)[0];
    }

    // Create a new tournament state to ensure proper broadcasting
    const updatedTournament: TournamentState = {
      ...tournament,
      matches: updatedMatches,
      currentMatchId: nextUnplayedMatch?.id
    };
    
    console.log("Match winner set, next match:", nextUnplayedMatch?.id);
    updateTournament(updatedTournament);
  };

  // Determine rounds
  const roundMatches = (round: number) => {
    return tournament.matches.filter(match => match.round === round);
  };

  // Check if tournament is completed (all matches have winners)
  const isTournamentCompleted = tournament.matches.length > 0 && 
    tournament.matches.every(match => match.winner);

  // Get points for a player in a match
  const getPoints = (match: Match, playerId?: number) => {
    if (!playerId || !match.points) return 0;
    return match.points[playerId] || 0;
  };

  // Check if current match is a bye match
  const isCurrentMatchBye = () => {
    if (!tournament.currentMatchId || !tournament.matches) return false;
    
    const currentMatch = tournament.matches.find(m => m.id === tournament.currentMatchId);
    return currentMatch?.isByeMatch === true;
  };

  return (
    <div className="min-h-screen p-2 flex flex-col items-center">
      <Head>
        <title>Online Typing - Tournament</title>
        <meta name="description" content="Real-time tournament with WebSockets" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="py-8 flex-1 flex flex-col items-center w-full max-w-4xl">
        <Navigation />
        <h1 className="m-0 mb-8 leading-tight text-4xl text-blue-600">Tournament Manager</h1>
        
        <div className={`mb-4 text-lg py-2 px-4 rounded transition-colors ${isConnected ? 'bg-green-100' : 'bg-red-100'}`}>
          Connection Status: {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
          {!isClient && <span className="block text-sm mt-1 text-gray-500">(Waiting for client-side rendering...)</span>}
        </div>
        
        <div className="w-full flex justify-end mb-4">
          <button 
            className="py-2 px-4 bg-rose-500 text-white border-none rounded cursor-pointer transition-colors hover:bg-rose-600" 
            onClick={handleResetTournament}
          >
            トーナメントをリセット
          </button>
        </div>

        {tournament.registrationOpen ? (
          <div className="w-full">
            <h2 className="mt-6 mb-4 text-2xl">選手登録 ({tournament.players.length}/16)</h2>
            <div className="flex mb-4">
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="選手名を入力（カンマ区切りで複数登録可能）"
                maxLength={200}
                className="flex-1 p-2 border border-gray-300 rounded-l-md text-base"
              />
              <button 
                onClick={handleRegisterPlayer}
                disabled={!playerName.trim() || tournament.players.length >= 16}
                className="py-2 px-4 bg-blue-600 text-white border-none rounded-r-md text-base cursor-pointer disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                登録
              </button>
            </div>
            
            <div className="text-sm text-gray-600 mb-4">
              カンマ（,）で区切って複数の選手を一度に登録できます。例：「田中, 鈴木, 佐藤」
            </div>
            
            <div className="my-4 p-4 border border-gray-200 rounded-md bg-gray-50">
              <h3 className="mb-4 text-xl">登録済み選手</h3>
              <ul className="grid grid-cols-4 gap-2 pl-5">
                {tournament.players.map((player) => (
                  <li key={player.id}>{player.name}</li>
                ))}
              </ul>
            </div>
            
            {tournament.players.length === 16 && (
              <button 
                className="mt-4 py-3 px-8 bg-green-500 text-white border-none rounded-md text-xl cursor-pointer transition-colors hover:bg-green-600 w-full"
                onClick={handleStartTournament}
              >
                トーナメント開始
              </button>
            )}
          </div>
        ) : (
          <div className="w-full">
            <h2 className="mt-6 mb-4 text-2xl">トーナメント</h2>
            
            <div className="flex flex-wrap gap-4 w-full">
              {/* Rounds 1-3 */}
              {[1, 2, 3].map((round) => (
                <div key={round} className="flex-1 min-w-48">
                  <h3 className="my-4 text-lg">第{round}ラウンド</h3>
                  <div className="flex flex-col gap-4">
                    {roundMatches(round).map((match) => (
                      <div 
                        key={match.id} 
                        className={`p-3 border rounded-md ${tournament.currentMatchId === match.id ? 'bg-blue-50 border-blue-600 shadow-md' : 'bg-gray-50 border-gray-300'} ${match.winner ? 'bg-green-50' : ''} ${match.isByeMatch && tournament.currentMatchId === match.id ? 'bg-yellow-50' : ''}`}
                      >
                        {match.player1 && match.player2 ? (
                          <>
                            <div className="flex flex-col gap-2">
                              <div className={`flex justify-between items-center p-2 rounded-md ${match.winner === match.player1.id ? 'font-bold bg-green-100' : ''}`}>
                                <div className="flex flex-col">
                                  <span className="font-bold">{match.player1.name || "不戦勝"}</span>
                                  {/* Point icons */}
                                  <div className="flex gap-1.5 mt-2 justify-center">
                                    {Array.from({ length: 2 }).map((_, index) => (
                                      <div 
                                        key={index}
                                        className={`w-4 h-4 rounded-full border-2 border-green-600 ${index < (match.points?.[match.player1!.id] || 0) ? 'bg-green-500 border-green-700 shadow-sm' : 'bg-transparent'}`}
                                      ></div>
                                    ))}
                                  </div>
                                </div>
                                {!match.winner && tournament.currentMatchId === match.id && !matchWinner && match.player1.name && match.player2.name && (
                                  <button 
                                    onClick={() => handlePointWon(match.id, match.player1!.id)}
                                    className="py-1 px-2 bg-blue-600 text-white border-none rounded text-sm cursor-pointer"
                                  >
                                    ポイント獲得
                                  </button>
                                )}
                              </div>
                              
                              <div className="text-center font-bold text-gray-500 my-1">VS</div>
                              
                              <div className={`flex justify-between items-center p-2 rounded-md ${match.winner === match.player2!.id ? 'font-bold bg-green-100' : ''}`}>
                                <div className="flex flex-col">
                                  <span className="font-bold">{match.player2.name || "不戦勝"}</span>
                                  {/* Point icons */}
                                  <div className="flex gap-1.5 mt-2 justify-center">
                                    {Array.from({ length: 2 }).map((_, index) => (
                                      <div 
                                        key={index}
                                        className={`w-4 h-4 rounded-full border-2 border-green-600 ${index < (match.points?.[match.player2!.id] || 0) ? 'bg-green-500 border-green-700 shadow-sm' : 'bg-transparent'}`}
                                      ></div>
                                    ))}
                                  </div>
                                </div>
                                {!match.winner && tournament.currentMatchId === match.id && !matchWinner && match.player1.name && match.player2.name && (
                                  <button 
                                    onClick={() => handlePointWon(match.id, match.player2!.id)}
                                    className="py-1 px-2 bg-blue-600 text-white border-none rounded text-sm cursor-pointer"
                                  >
                                    ポイント獲得
                                  </button>
                                )}
                              </div>
                            </div>
                            <div className="text-sm text-gray-500 mt-2">Match #{match.id}</div>
                          </>
                        ) : (
                          <div className="text-gray-500 italic p-2 text-center">
                            {match.player1 ? `${match.player1.name || "不戦勝"} vs TBD` : 'TBD vs TBD'}
                          </div>
                        )}
                        
                        {match.isByeMatch && tournament.currentMatchId === match.id && (
                          <div className="mt-2 text-gray-600 text-center text-sm bg-yellow-100 p-1 rounded">
                            <span className="font-bold">不戦勝の試合です</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              
              {/* Finals and Third Place */}
              <div className="flex-1 min-w-48">
                <h3 className="my-4 text-lg">決勝ラウンド</h3>
                <div className="flex flex-col gap-4">
                  {/* Third Place Match - Display first */}
                  {tournament.matches.filter(m => m.isThirdPlace).map((match) => (
                    <div 
                      key={match.id} 
                      className={`p-3 border rounded-md bg-blue-50 border-blue-300 ${tournament.currentMatchId === match.id ? 'border-blue-600 shadow-md' : ''} ${match.winner ? 'bg-green-50' : ''} ${match.isByeMatch && tournament.currentMatchId === match.id ? 'bg-yellow-50' : ''}`}
                    >
                      <div className="font-bold text-center mb-2">三位決定戦</div>
                      {match.player1 && match.player2 ? (
                        <>
                          <div className="flex flex-col gap-2">
                              <div className={`flex justify-between items-center p-2 rounded-md ${match.winner === match.player1.id ? 'font-bold bg-green-100' : ''}`}>
                                <div className="flex flex-col">
                                  <span className="font-bold">{match.player1.name || "不戦勝"}</span>
                                  {/* Point icons */}
                                  <div className="flex gap-1.5 mt-2 justify-center">
                                    {Array.from({ length: 2 }).map((_, index) => (
                                      <div 
                                        key={index}
                                        className={`w-4 h-4 rounded-full border-2 border-green-600 ${index < (match.points?.[match.player1!.id] || 0) ? 'bg-green-500 border-green-700 shadow-sm' : 'bg-transparent'}`}
                                      ></div>
                                    ))}
                                  </div>
                                </div>
                                {!match.winner && tournament.currentMatchId === match.id && !matchWinner && match.player1.name && match.player2.name && (
                                  <button 
                                    onClick={() => handlePointWon(match.id, match.player1!.id)}
                                    className="py-1 px-2 bg-blue-600 text-white border-none rounded text-sm cursor-pointer"
                                  >
                                    ポイント獲得
                                  </button>
                                )}
                              </div>
                              
                              <div className="text-center font-bold text-gray-500 my-1">VS</div>
                              
                              <div className={`flex justify-between items-center p-2 rounded-md ${match.winner === match.player2.id ? 'font-bold bg-green-100' : ''}`}>
                                <div className="flex flex-col">
                                  <span className="font-bold">{match.player2.name || "不戦勝"}</span>
                                  {/* Point icons */}
                                  <div className="flex gap-1.5 mt-2 justify-center">
                                    {Array.from({ length: 2 }).map((_, index) => (
                                      <div 
                                        key={index}
                                        className={`w-4 h-4 rounded-full border-2 border-green-600 ${index < (match.points?.[match.player2!.id] || 0) ? 'bg-green-500 border-green-700 shadow-sm' : 'bg-transparent'}`}
                                      ></div>
                                    ))}
                                  </div>
                                </div>
                                {!match.winner && tournament.currentMatchId === match.id && !matchWinner && match.player1.name && match.player2.name && (
                                  <button 
                                    onClick={() => handlePointWon(match.id, match.player2!.id)}
                                    className="py-1 px-2 bg-blue-600 text-white border-none rounded text-sm cursor-pointer"
                                  >
                                    ポイント獲得
                                  </button>
                                )}
                              </div>
                            </div>
                          <div className="text-sm text-gray-500 mt-2">Match #{match.id}</div>
                        </>
                      ) : (
                        <div className="text-gray-500 italic p-2 text-center">
                          {match.player1 ? `${match.player1.name || "不戦勝"} vs TBD` : 'TBD vs TBD'}
                        </div>
                      )}
                      
                      {match.isByeMatch && tournament.currentMatchId === match.id && (
                        <div className="mt-2 text-gray-600 text-center text-sm bg-yellow-100 p-1 rounded">
                          <span className="font-bold">不戦勝の試合です</span>
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {/* Final Match - Display after third place match */}
                  {tournament.matches.filter(m => m.round === 4 && !m.isThirdPlace).map((match) => (
                    <div 
                      key={match.id} 
                      className={`p-3 border rounded-md bg-amber-50 border-amber-300 ${tournament.currentMatchId === match.id ? 'border-amber-600 shadow-md' : ''} ${match.winner ? 'bg-green-50' : ''} ${match.isByeMatch && tournament.currentMatchId === match.id ? 'bg-yellow-50' : ''}`}
                    >
                      <div className="font-bold text-center mb-2">決勝戦</div>
                      {match.player1 && match.player2 ? (
                        <>
                          <div className="flex flex-col gap-2">
                              <div className={`flex justify-between items-center p-2 rounded-md ${match.winner === match.player1.id ? 'font-bold bg-green-100' : ''}`}>
                                <div className="flex flex-col">
                                  <span className="font-bold">{match.player1.name || "不戦勝"}</span>
                                  {/* Point icons */}
                                  <div className="flex gap-1.5 mt-2 justify-center">
                                    {Array.from({ length: 2 }).map((_, index) => (
                                      <div 
                                        key={index}
                                        className={`w-4 h-4 rounded-full border-2 border-green-600 ${index < (match.points?.[match.player1!.id] || 0) ? 'bg-green-500 border-green-700 shadow-sm' : 'bg-transparent'}`}
                                      ></div>
                                    ))}
                                  </div>
                                </div>
                                {!match.winner && tournament.currentMatchId === match.id && !matchWinner && match.player1.name && match.player2.name && (
                                  <button 
                                    onClick={() => handlePointWon(match.id, match.player1!.id)}
                                    className="py-1 px-2 bg-blue-600 text-white border-none rounded text-sm cursor-pointer"
                                  >
                                    ポイント獲得
                                  </button>
                                )}
                              </div>
                              
                              <div className="text-center font-bold text-gray-500 my-1">VS</div>
                              
                              <div className={`flex justify-between items-center p-2 rounded-md ${match.winner === match.player2.id ? 'font-bold bg-green-100' : ''}`}>
                                <div className="flex flex-col">
                                  <span className="font-bold">{match.player2.name || "不戦勝"}</span>
                                  {/* Point icons */}
                                  <div className="flex gap-1.5 mt-2 justify-center">
                                    {Array.from({ length: 2 }).map((_, index) => (
                                      <div 
                                        key={index}
                                        className={`w-4 h-4 rounded-full border-2 border-green-600 ${index < (match.points?.[match.player2!.id] || 0) ? 'bg-green-500 border-green-700 shadow-sm' : 'bg-transparent'}`}
                                      ></div>
                                    ))}
                                  </div>
                                </div>
                                {!match.winner && tournament.currentMatchId === match.id && !matchWinner && match.player1.name && match.player2.name && (
                                  <button 
                                    onClick={() => handlePointWon(match.id, match.player2!.id)}
                                    className="py-1 px-2 bg-blue-600 text-white border-none rounded text-sm cursor-pointer"
                                  >
                                    ポイント獲得
                                  </button>
                                )}
                              </div>
                            </div>
                          <div className="text-sm text-gray-500 mt-2">Match #{match.id}</div>
                        </>
                      ) : (
                        <div className="text-gray-500 italic p-2 text-center">
                          {match.player1 ? `${match.player1.name || "不戦勝"} vs TBD` : 'TBD vs TBD'}
                        </div>
                      )}
                      
                      {match.isByeMatch && tournament.currentMatchId === match.id && (
                        <div className="mt-2 text-gray-600 text-center text-sm bg-yellow-100 p-1 rounded">
                          <span className="font-bold">不戦勝の試合です</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            {isTournamentCompleted && (
              <div className="mt-8 text-center p-4 bg-amber-100 rounded-lg border-2 border-amber-400 w-full">
                <h2 className="text-2xl font-bold">🏆 トーナメント結果 🏆</h2>
                
                <div className="flex justify-center items-end mt-8 p-4">
                  <div className="p-4 text-center mx-4 rounded-lg bg-gray-300 h-30 w-24 flex flex-col justify-end">
                    <div className="w-10 h-10 bg-white rounded-full flex justify-center items-center font-bold mb-2 mx-auto">2</div>
                    <div className="font-bold break-words">
                      {(() => {
                        const finalMatch = tournament.matches.find(m => m.id === 15);
                        if (!finalMatch || !finalMatch.winner) return "TBD";
                        const secondPlaceId = finalMatch.player1?.id === finalMatch.winner 
                          ? finalMatch.player2?.id 
                          : finalMatch.player1?.id;
                        return tournament.players.find(p => p.id === secondPlaceId)?.name || "TBD";
                      })()}
                    </div>
                  </div>
                  
                  <div className="p-4 text-center mx-4 rounded-lg bg-amber-300 h-36 w-28 flex flex-col justify-end">
                    <div className="w-10 h-10 bg-white rounded-full flex justify-center items-center font-bold mb-2 mx-auto">1</div>
                    <div className="font-bold break-words">
                      {(() => {
                        const finalMatch = tournament.matches.find(m => m.id === 15);
                        return tournament.players.find(p => p.id === finalMatch?.winner)?.name || "TBD";
                      })()}
                    </div>
                  </div>
                  
                  <div className="p-4 text-center mx-4 rounded-lg bg-amber-600 h-24 w-24 flex flex-col justify-end">
                    <div className="w-10 h-10 bg-white rounded-full flex justify-center items-center font-bold mb-2 mx-auto">3</div>
                    <div className="font-bold break-words">
                      {(() => {
                        const thirdPlaceMatch = tournament.matches.find(m => m.isThirdPlace);
                        return tournament.players.find(p => p.id === thirdPlaceMatch?.winner)?.name || "TBD";
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Next match button moved to the bottom of the page when a match is won or for bye matches */}
            {(matchWinner || isCurrentMatchBye()) && (
              <div className="w-full flex justify-center my-6 sticky bottom-4">
                <button 
                  className="py-3 px-8 bg-blue-600 text-white border-none rounded-md text-xl font-bold cursor-pointer transition-colors hover:bg-blue-700 animate-pulse shadow-lg"
                  onClick={handleProceedToNextMatch}
                >
                  次の試合へ進む
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}