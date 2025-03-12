package main

import (
	"fmt"
	"log"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

// Application state
type AppState struct {
	sync.RWMutex
	Text       string
	Tournament TournamentState
}

// Player represents a tournament player
type Player struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

// Points stores the points for each player in a match
type Points map[int]int

// Match represents a tournament match
type Match struct {
	ID           int     `json:"id"`
	Round        int     `json:"round"`
	Player1      *Player `json:"player1,omitempty"`
	Player2      *Player `json:"player2,omitempty"`
	Winner       *int    `json:"winner,omitempty"`
	NextMatchID  *int    `json:"nextMatchId,omitempty"`
	IsThirdPlace bool    `json:"isThirdPlace,omitempty"`
	Points       Points  `json:"points,omitempty"`      // 各選手のポイント（2本先取）
	IsByeMatch   bool    `json:"isByeMatch,omitempty"`  // Flag to indicate if this is a bye match
	ByeWinnerId  *int    `json:"byeWinnerId,omitempty"` // ID of the player who gets a bye win
}

// TournamentState represents the tournament state
type TournamentState struct {
	Players          []Player `json:"players"`
	Matches          []Match  `json:"matches"`
	RegistrationOpen bool     `json:"registrationOpen"`
	CurrentMatchID   *int     `json:"currentMatchId,omitempty"`
}

var (
	state = &AppState{
		Text: "",
		Tournament: TournamentState{
			Players:          []Player{},
			Matches:          []Match{},
			RegistrationOpen: true,
		},
	}
	clients   = make(map[*websocket.Conn]bool)
	clientsMu sync.Mutex
)

// WebSocket upgrader
var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	// Allow all origins
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

// WebSocket message
type Message struct {
	Type       string           `json:"type"`
	Text       string           `json:"text,omitempty"`
	Tournament *TournamentState `json:"tournament,omitempty"`
}

func main() {
	e := echo.New()

	// Middleware
	e.Use(middleware.Logger())
	e.Use(middleware.Recover())
	e.Use(middleware.CORS())

	// Routes
	e.GET("/", hello)
	e.GET("/ws", handleWebSocket)

	// Start server
	e.Logger.Fatal(e.Start(":8080"))
}

// Simple handler to check if server is running
func hello(c echo.Context) error {
	return c.String(http.StatusOK, "Hello, WebSocket Server is running!")
}

// WebSocket handler
func handleWebSocket(c echo.Context) error {
	ws, err := upgrader.Upgrade(c.Response(), c.Request(), nil)
	if err != nil {
		return err
	}
	defer ws.Close()

	// Register new client
	clientsMu.Lock()
	clients[ws] = true
	clientsMu.Unlock()

	// Clean up when connection closes
	defer func() {
		clientsMu.Lock()
		delete(clients, ws)
		clientsMu.Unlock()
	}()

	// Send current state to the new client
	state.RLock()
	initialTextMsg := Message{
		Type: "update",
		Text: state.Text,
	}
	initialTournamentMsg := Message{
		Type:       "tournament",
		Tournament: &state.Tournament,
	}
	state.RUnlock()

	err = ws.WriteJSON(initialTextMsg)
	if err != nil {
		log.Printf("error sending text message: %v", err)
	}

	err = ws.WriteJSON(initialTournamentMsg)
	if err != nil {
		log.Printf("error sending tournament message: %v", err)
	}

	// Listen for messages from client
	for {
		var msg Message
		err := ws.ReadJSON(&msg)
		if err != nil {
			log.Printf("error: %v", err)
			break
		}

		// Process message based on type
		switch msg.Type {
		case "update":
			// Update text state
			state.Lock()
			state.Text = msg.Text
			state.Unlock()

			// Broadcast to all clients
			broadcastMessage(Message{
				Type: "update",
				Text: msg.Text,
			})

			fmt.Printf("Updated text: %s\n", msg.Text)

		case "tournament":
			if msg.Tournament != nil {
				// トーナメントのリセット検出（選手登録を開始状態に戻す）
				if msg.Tournament.RegistrationOpen && len(msg.Tournament.Players) == 0 && len(msg.Tournament.Matches) == 0 {
					fmt.Println("Tournament reset detected")
				}

				// 三位決定戦の状態の変更を検出
				for _, match := range msg.Tournament.Matches {
					if match.Points != nil && len(match.Points) > 0 {
						fmt.Printf("Match #%d points: %v\n", match.ID, match.Points)
					}

					if match.IsThirdPlace {
						fmt.Printf("Third place match: ID=%d, Players: %v vs %v, Winner: %v\n",
							match.ID,
							match.Player1,
							match.Player2,
							match.Winner)
					}

					// Detect bye matches
					if match.IsByeMatch {
						fmt.Printf("Bye match detected: ID=%d, ByeWinnerId: %v\n",
							match.ID,
							match.ByeWinnerId)
					}
				}

				// Update tournament state
				state.Lock()
				state.Tournament = *msg.Tournament
				state.Unlock()

				// Broadcast to all clients
				broadcastMessage(Message{
					Type:       "tournament",
					Tournament: msg.Tournament,
				})

				fmt.Printf("Updated tournament: %d players, %d matches\n",
					len(msg.Tournament.Players), len(msg.Tournament.Matches))
			}
		}
	}

	return nil
}

// Broadcast message to all connected clients
func broadcastMessage(msg Message) {
	clientsMu.Lock()
	defer clientsMu.Unlock()

	for client := range clients {
		err := client.WriteJSON(msg)
		if err != nil {
			log.Printf("error: %v", err)
			client.Close()
			delete(clients, client)
		}
	}
}
