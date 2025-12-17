import React, { useEffect, useState } from 'react';
import { PlayerProfile } from '../types';
import { Copy, CheckCircle2, Loader2, Play, Users } from 'lucide-react';

interface LobbyScreenProps {
  lobbyId: string;
  currentUser: PlayerProfile;
  onStart: () => void;
  onBack: () => void;
}

export const LobbyScreen: React.FC<LobbyScreenProps> = ({ lobbyId, currentUser, onStart, onBack }) => {
  const [friendJoined, setFriendJoined] = useState(false);
  const [copied, setCopied] = useState(false);

  // Simulate a friend joining after a random time for demonstration
  useEffect(() => {
    if (!currentUser.isHost) {
      setFriendJoined(true); // If we joined, the host is "there"
      return;
    }

    const timer = setTimeout(() => {
      setFriendJoined(true);
    }, 3000 + Math.random() * 2000);

    return () => clearTimeout(timer);
  }, [currentUser.isHost]);

  const copyId = () => {
    navigator.clipboard.writeText(lobbyId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative z-10 flex flex-col items-center justify-center h-full p-6 bg-black/90">
      <div className="max-w-2xl w-full bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="bg-neutral-950 p-6 border-b border-neutral-800 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Users className="text-green-500" />
              LOBBY
            </h2>
            <p className="text-neutral-500 text-sm">Waiting for connection...</p>
          </div>
          <button onClick={onBack} className="text-red-500 hover:text-red-400 text-sm font-bold uppercase tracking-wider">
            Leave
          </button>
        </div>

        {/* Content */}
        <div className="p-8">
          {/* ID Display */}
          <div className="flex flex-col items-center mb-12">
            <span className="text-neutral-500 text-xs uppercase mb-2">Share this ID with your friend</span>
            <button 
              onClick={copyId}
              className="group relative bg-neutral-800 hover:bg-neutral-700 border-2 border-dashed border-neutral-600 hover:border-green-500 transition-all rounded-lg px-12 py-6 flex flex-col items-center gap-2"
            >
              <span className="text-4xl font-mono font-black tracking-[0.2em] text-white">
                {lobbyId}
              </span>
              <div className="flex items-center gap-1 text-xs text-green-500 font-bold opacity-0 group-hover:opacity-100 transition-opacity absolute -bottom-8">
                {copied ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copied ? "COPIED TO CLIPBOARD" : "CLICK TO COPY"}
              </div>
            </button>
          </div>

          {/* Players Grid */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            {/* Player 1 (You) */}
            <div className="bg-neutral-800/50 border border-green-500/50 p-4 rounded flex items-center gap-4">
              <div className="w-12 h-12 bg-neutral-700 rounded-full flex items-center justify-center relative">
                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser.id}`} alt="avatar" className="w-10 h-10 rounded-full" />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-neutral-900 rounded-full"></div>
              </div>
              <div>
                <p className="font-bold text-white">{currentUser.name} (You)</p>
                <p className="text-xs text-green-400 font-mono">READY</p>
              </div>
            </div>

            {/* Player 2 (Friend) */}
            <div className={`border p-4 rounded flex items-center gap-4 transition-all duration-500 ${friendJoined ? 'bg-neutral-800/50 border-orange-500/50' : 'bg-neutral-900 border-neutral-800 border-dashed'}`}>
              {friendJoined ? (
                <>
                  <div className="w-12 h-12 bg-neutral-700 rounded-full flex items-center justify-center relative">
                     <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${lobbyId}`} alt="avatar" className="w-10 h-10 rounded-full" />
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-neutral-900 rounded-full"></div>
                  </div>
                  <div className="animate-in fade-in slide-in-from-right-4">
                    <p className="font-bold text-white">Friend-Fox</p>
                    <p className="text-xs text-orange-400 font-mono">CONNECTED</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-full border-2 border-neutral-700 border-t-neutral-500 animate-spin"></div>
                  <div>
                    <p className="font-bold text-neutral-500">Waiting...</p>
                    <p className="text-xs text-neutral-600 font-mono">SCANNING NETWORK</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Action */}
          <button
            onClick={onStart}
            disabled={!friendJoined}
            className="w-full bg-gradient-to-r from-green-600 to-emerald-700 disabled:from-neutral-800 disabled:to-neutral-800 disabled:text-neutral-500 hover:from-green-500 hover:to-emerald-600 text-white font-black text-xl py-6 rounded-lg shadow-lg shadow-green-900/30 transition-all active:scale-[0.99] flex items-center justify-center gap-3 uppercase tracking-wider"
          >
            {friendJoined ? (
              <>
                <Play className="fill-current" /> Enter The Forest
              </>
            ) : (
              <>
                <Loader2 className="animate-spin" /> Waiting for Player 2
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};