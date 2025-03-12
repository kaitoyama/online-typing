export type Player = {
  id: number;
  name: string;
};

export type Match = {
  id: number;
  round: number;
  player1?: Player;
  player2?: Player;
  winner?: number; // ID of the winning player
  nextMatchId?: number; // ID of the match that the winner will proceed to
  isThirdPlace?: boolean; // Flag to indicate if this is the third-place match
  points?: {  // 各選手のポイント（2本先取）
    [playerId: number]: number;
  };
  isByeMatch?: boolean; // Flag to indicate if this is a bye match
  byeWinnerId?: number; // ID of the player who gets a bye win
};

export type TournamentState = {
  players: Player[];
  matches: Match[];
  registrationOpen: boolean;
  currentMatchId?: number;
};