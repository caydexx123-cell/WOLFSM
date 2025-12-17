import React, { useEffect, useState } from 'react';
import { PlayerProfile } from '../types.ts';
import { Copy, CheckCircle2, Loader2, Play, Users } from 'lucide-react';

interface LobbyScreenProps {
  currentUser: PlayerProfile;
  peerId: string;
  conn: any; // PeerJS connection object
  isHost: boolean;
  onStart: () => void;
  onBack: () => void;
}

export const LobbyScreen: React.FC<LobbyScreenProps> = ({ currentUser, peerId, conn, isHost, onStart, onBack }) => {
  const [copied, setCopied] = useState(false);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Check connection status
    if (conn) {
       if (conn.open) {
         setConnected(true);
       }
       
       conn.on('open', () => {
         setConnected(true);
       });

       conn.on('close', () => {
         setConnected(false);
       });
       
       // If we are client (not host), listen for Game Start command
       if (!isHost) {
         conn.on('data', (data: any) => {
           if (data.type === 'GAME_START') {
             // Host started game, let's go
             (window as any).GAME_SEED = data.seed;
             onStart();
           }
         });
       }
    } else {
      setConnected(false);
    }
  }, [conn, isHost, onStart]);

  const copyId = () => {
    navigator.clipboard.writeText(peerId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleHostStart = () => {
    if (conn && conn.open) {
      const seed = Math.floor(Math.random() * 100000);
      conn.send({ type: 'GAME_START', seed });
      (window as any).GAME_SEED = seed;
      onStart();
    }
  };

  return (
    <div className="relative z-10 flex flex-col items-center justify-center h-full p-6 bg-black/90">
      <div className="max-w-2xl w-full bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-2xl">
        <div className="bg-neutral-950 p-6 border-b border-neutral-800 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Users className="text-green-500" />
              {isHost ? "LOBBY (HOST)" : "LOBBY (JOINING)"}
            </h2>
            <p className="text-neutral-500 text-sm">
              {connected ? "Friend Connected!" : "Waiting for real player..."}
            </p>
          </div>
          <button onClick={onBack} className="text-red-500 hover:text-red-400 text-sm font-bold uppercase tracking-wider">
            Disconnect
          </button>
        </div>

        <div className="p-8">
          {isHost && (
            <div className="flex flex-col items-center mb-12">
              <span className="text-neutral-500 text-xs uppercase mb-2">GIVE THIS ID TO YOUR FRIEND</span>
              <button 
                onClick={copyId}
                className="group relative bg-neutral-800 hover:bg-neutral-700 border-2 border-dashed border-neutral-600 hover:border-green-500 transition-all rounded-lg px-12 py-6 flex flex-col items-center gap-2"
              >
                <span className="text-4xl font-mono font-black tracking-[0.2em] text-white">
                  {peerId}
                </span>
                <div className="flex items-center gap-1 text-xs text-green-500 font-bold opacity-0 group-hover:opacity-100 transition-opacity absolute -bottom-8">
                  {copied ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied ? "COPIED" : "CLICK TO COPY"}
                </div>
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-neutral-800/50 border border-green-500/50 p-4 rounded flex items-center gap-4">
              <div className="w-12 h-12 bg-neutral-700 rounded-full flex items-center justify-center relative">
                <div className="text-2xl">🐺</div>
              </div>
              <div>
                <p className="font-bold text-white">{currentUser.name} (You)</p>
                <p className="text-xs text-green-400 font-mono">READY</p>
              </div>
            </div>

            <div className={`border p-4 rounded flex items-center gap-4 transition-all duration-500 ${connected ? 'bg-neutral-800/50 border-orange-500/50' : 'bg-neutral-900 border-neutral-800 border-dashed'}`}>
              {connected ? (
                <>
                  <div className="w-12 h-12 bg-neutral-700 rounded-full flex items-center justify-center relative">
                     <div className="text-2xl">🦊</div>
                  </div>
                  <div>
                    <p className="font-bold text-white">Friend</p>
                    <p className="text-xs text-orange-400 font-mono">CONNECTED</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-full border-2 border-neutral-700 border-t-neutral-500 animate-spin"></div>
                  <div>
                    <p className="font-bold text-neutral-500">Waiting...</p>
                    <p className="text-xs text-neutral-600 font-mono">SEARCHING</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {isHost ? (
            <button
              onClick={handleHostStart}
              disabled={!connected}
              className="w-full bg-gradient-to-r from-green-600 to-emerald-700 disabled:from-neutral-800 disabled:to-neutral-800 disabled:text-neutral-500 hover:from-green-500 hover:to-emerald-600 text-white font-black text-xl py-6 rounded-lg shadow-lg shadow-green-900/30 transition-all active:scale-[0.99] flex items-center justify-center gap-3 uppercase tracking-wider"
            >
              {connected ? (
                <>
                  <Play className="fill-current" /> START GAME
                </>
              ) : (
                <>
                  <Loader2 className="animate-spin" /> WAITING FOR FRIEND...
                </>
              )}
            </button>
          ) : (
             <div className="text-center p-4 bg-neutral-800 rounded">
                <p className="text-green-500 font-bold uppercase animate-pulse">
                   {connected ? "WAITING FOR HOST TO START" : "CONNECTING TO HOST..."}
                </p>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};