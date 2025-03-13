import { useState, useEffect } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';

export default function Viewer() {
  const [isClient, setIsClient] = useState<boolean>(false);
  
  // Connect to WebSocket with no send functionality needed for viewer
  const { text, isConnected, tournament } = useWebSocket(isClient ? 'wss://online-typing.trap.show/api/ws' : '');
  
  // Set client-side flag after component mounts to avoid SSR issues
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  // Find the current match
  const currentMatch = tournament?.matches?.find(match => match.id === tournament.currentMatchId);
  
  // Check if tournament is completed (all matches have winners)
  const isTournamentCompleted = tournament?.matches?.length > 0 && 
    tournament?.matches?.every(match => match.winner);
    
  // Get points for a player in a match
  const getPoints = (match: any, playerId?: number) => {
    if (!playerId || !match?.points) return 0;
    return match.points[playerId] || 0;
  };
  
  // ポイント表示用の関数（Tailwind対応版）- Modified to show even larger circles (1.25x)
  const renderPointIcons = (match: any, playerId?: number) => {
    const points = playerId && match?.points ? (match.points[playerId] || 0) : 0;
    const totalPoints = 2; // 2本先取

    return (
      <div className="flex gap-5 justify-center">
        {Array.from({ length: totalPoints }).map((_, index) => (
          <div 
            key={index}
            className={`w-10 h-10 rounded-full ${
              index < points ? 'bg-green-500 border-green-700 shadow-md border-3' : 'bg-transparent border-2 border-green-600'
            }`}
          ></div>
        ))}
      </div>
    );
  };
  
  // Check if a player is a bye (empty name)
  const isBye = (playerId?: number) => {
    if (!playerId) return false;
    const player = tournament?.players?.find(p => p.id === playerId);
    return player?.name === "";
  };
  
  // Get display name for a player (showing "不戦勝" for byes)
  const getPlayerDisplayName = (playerId?: number) => {
    if (!playerId) return "TBD";
    const player = tournament?.players?.find(p => p.id === playerId);
    if (!player) return "不明";
    return player.name || "不戦勝";
  };

  // Check if current match is a bye match (one of the players has an empty name)
  const isCurrentMatchBye = currentMatch && 
    ((currentMatch.player1 && currentMatch.player1.name === "") || 
     (currentMatch.player2 && currentMatch.player2.name === ""));
  
  return (
    <div className="flex flex-col items-center overflow-hidden" style={{ width: '1920px', height: '1080px' }}>
      <main className="flex flex-col items-center justify-center w-full h-full">
        
        {!isConnected && (
          <div className="mb-8 text-lg py-2 px-4 rounded bg-red-100 transition-colors">
            Connection Status: 🔴 Disconnected
            {!isClient && <span className="block text-sm mt-1 text-gray-500">(Waiting for client-side rendering...)</span>}
          </div>
        )}
        
        {tournament?.registrationOpen ? (
          <div className="w-full p-8 rounded-lg bg-gray-50 border border-gray-200 mb-8 text-center">
            <h2 className="mb-6 text-3xl">トーナメント準備中</h2>
            <p className="text-lg mb-4">現在、選手登録中です。トーナメントが始まるとこちらに表示されます。</p>
            <div className="text-2xl font-bold mt-4 text-gray-600">
              登録済み選手数: {tournament.players.filter(p => p.name !== "").length} / 16
            </div>
          </div>
        ) : currentMatch ? (
          <div className="w-full p-8 rounded-lg mb-8 text-center">
            <div className="mt-6">
              {currentMatch.isThirdPlace ? (
                <div className="text-3xl text-gray-600 mb-4">三位決定戦 - マッチ #{currentMatch.id}</div>
              ) : (
                <div className="text-3xl text-gray-600 mb-4">第{currentMatch.round}ラウンド {currentMatch.round === 4 ? "- 決勝戦" : ""} - マッチ #{currentMatch.id}</div>
              )}
              
              {currentMatch.player1 && currentMatch.player2 ? (
                <>
                  {/* Display the match with increased spacing between players */}
                  <div className="flex flex-row justify-center items-center gap-30">
                    <div className={`flex-1 p-8 bg-white rounded-lg max-w-96 relative ${isBye(currentMatch.player1.id) ? 'opacity-50' : ''}`}>
                      <div className="mb-4">
                        <span className="text-4xl font-bold break-words">{getPlayerDisplayName(currentMatch.player1.id)}</span>
                      </div>
                      <div className="mb-4">
                        {renderPointIcons(currentMatch, currentMatch.player1.id)}
                      </div>
                      <div className="flex flex-col items-center">
                        <div className="w-72 h-72 rounded-full overflow-hidden">
                          <img 
                            src={"https://q.trap.jp/api/v3/public/icon/"+currentMatch.player1!.name || "https://q.trap.jp/api/v3/public/icon/kaitoyama"} 
                            alt={`${getPlayerDisplayName(currentMatch.player1.id)}のアバター`}
                            className="w-full h-full object-cover"
                            onError={(e) => {e.currentTarget.src = "https://q.trap.jp/api/v3/public/icon/kaitoyama"}}
                          />
                        </div>
                      </div>
                      {isBye(currentMatch.player1.id) && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-70 rounded-lg">
                          <span className="text-2xl text-gray-500 font-bold">不戦勝</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="w-36 h-36 rounded-full bg-gray-600 flex flex-col justify-center items-center shadow-lg">
                      <div className="text-white text-5xl font-bold">VS</div>
                    </div>
                    
                    <div className={`flex-1 p-8 bg-white rounded-lg max-w-96 relative ${isBye(currentMatch.player2.id) ? 'opacity-50' : ''}`}>
                      <div className="mb-4">
                        <span className="text-4xl font-bold break-words">{getPlayerDisplayName(currentMatch.player2.id)}</span>
                      </div>
                      <div className="mb-4">
                        {renderPointIcons(currentMatch, currentMatch.player2.id)}
                      </div>
                      <div className="flex flex-col items-center">
                        <div className="w-72 h-72 rounded-full overflow-hidden">
                          <img 
                            src={"https://q.trap.jp/api/v3/public/icon/"+currentMatch.player2!.name || "https://q.trap.jp/api/v3/public/icon/kaitoyama"} 
                            alt={`${getPlayerDisplayName(currentMatch.player2.id)}のアバター`}
                            className="w-full h-full object-cover"
                            onError={(e) => {e.currentTarget.src = "https://q.trap.jp/api/v3/public/icon/kaitoyama"}}
                          />
                        </div>
                      </div>
                      {isBye(currentMatch.player2.id) && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-70 rounded-lg">
                          <span className="text-2xl text-gray-500 font-bold">不戦勝</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Show bye match notification below the match */}
                  {isCurrentMatchBye && (
                    <div className="mt-6 text-2xl text-gray-600 p-4 bg-gray-100 rounded-lg">
                      {isBye(currentMatch.player1.id) ? 
                        `${getPlayerDisplayName(currentMatch.player2.id)}の不戦勝です` : 
                        `${getPlayerDisplayName(currentMatch.player1.id)}の不戦勝です`}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-2xl text-gray-500 p-8 italic">
                  次の対戦の準備中...
                </div>
              )}
            </div>
          </div>
        ) : isTournamentCompleted ? (
          <div className="w-full p-8 rounded-lg bg-amber-100 border-2 border-amber-400 mb-8 text-center">
            <h2 className="mb-6 text-3xl font-bold">🏆 トーナメント終了 🏆</h2>
            
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
                    return getPlayerDisplayName(secondPlaceId);
                  })()}
                </div>
              </div>
              
              <div className="p-4 text-center mx-4 rounded-lg bg-amber-300 h-36 w-28 flex flex-col justify-end">
                <div className="w-10 h-10 bg-white rounded-full flex justify-center items-center font-bold mb-2 mx-auto">1</div>
                <div className="font-bold break-words">
                  {(() => {
                    const finalMatch = tournament.matches.find(m => m.id === 15);
                    return getPlayerDisplayName(finalMatch?.winner);
                  })()}
                </div>
              </div>
              
              <div className="p-4 text-center mx-4 rounded-lg bg-amber-600 h-24 w-24 flex flex-col justify-end">
                <div className="w-10 h-10 bg-white rounded-full flex justify-center items-center font-bold mb-2 mx-auto">3</div>
                <div className="font-bold break-words">
                  {(() => {
                    const thirdPlaceMatch = tournament.matches.find(m => m.isThirdPlace);
                    return getPlayerDisplayName(thirdPlaceMatch?.winner);
                  })()}
                </div>
              </div>
            </div>
            
            <div className="text-3xl mt-4 text-amber-800">おめでとうございます！</div>
          </div>
        ) : (
          <div className="w-full p-8 rounded-lg bg-gray-100 border border-gray-300 mb-8 text-center">
            <h2 className="mb-6 text-3xl">トーナメントが設定されていません</h2>
            <p className="text-lg">トーナメントが開始されると、ここに表示されます。</p>
          </div>
        )}
      </main>
    </div>
  );
}