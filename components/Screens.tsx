import React, { useState } from 'react';
import { PlayerProfile } from '../types.ts';
import { PawPrint, Shield, WifiOff, Play } from 'lucide-react';

interface AuthScreenProps {
  profile: PlayerProfile;
  onCreate: () => void;
  onJoin: (id: string) => void;
  onOffline: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ profile, onCreate, onJoin, onOffline }) => {
  const [joinId, setJoinId] = useState('');

  return (
    <div className="relative z-10 flex flex-col items-center justify-center h-full p-6">
      <div className="max-w-md w-full bg-black/80 backdrop-blur-md border border-green-900/50 p-8 rounded-xl shadow-2xl shadow-green-900/20">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-green-400 to-emerald-800 uppercase italic transform -skew-x-12">
            Hotline Forest
          </h1>
          <p className="text-neutral-400 mt-2 text-sm tracking-widest">PRIMAL INSTINCT // V1.0</p>
        </div>

        <div className="mb-6 bg-neutral-900/50 p-4 rounded border border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-neutral-800 rounded-full flex items-center justify-center">
              <PawPrint className="text-green-500 w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-neutral-500 uppercase">Your Universal ID</p>
              <p className="text-xl font-mono font-bold text-white tracking-wider">{profile.id}</p>
            </div>
          </div>
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.8)]" />
        </div>

        <div className="space-y-4">
          <button 
            onClick={onOffline}
            className="w-full group relative overflow-hidden rounded bg-neutral-800 p-4 transition hover:bg-neutral-700 active:scale-95 border border-neutral-700"
          >
            <div className="flex items-center justify-between relative z-10">
              <span className="font-bold text-lg flex items-center gap-2">
                <WifiOff className="w-5 h-5 text-neutral-500 group-hover:text-white" />
                PLAY OFFLINE
              </span>
              <Play className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
            </div>
          </button>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-neutral-800"></div>
            <span className="flex-shrink-0 mx-4 text-neutral-600 text-xs uppercase">Multiplayer</span>
            <div className="flex-grow border-t border-neutral-800"></div>
          </div>

          <button 
            onClick={onCreate}
            className="w-full bg-emerald-900/30 border border-emerald-500/30 hover:bg-emerald-800/50 p-4 rounded text-emerald-400 font-bold flex items-center justify-center gap-2 transition active:scale-95"
          >
            <Shield className="w-5 h-5" />
            CREATE LOBBY
          </button>

          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="ENTER FRIEND ID"
              value={joinId}
              onChange={(e) => setJoinId(e.target.value.toUpperCase())}
              className="flex-1 bg-neutral-900 border border-neutral-700 rounded p-4 text-center font-mono placeholder:text-neutral-600 focus:outline-none focus:border-green-500 transition"
            />
            <button 
              onClick={() => joinId && onJoin(joinId)}
              disabled={!joinId}
              className="bg-neutral-800 border border-neutral-700 hover:border-white hover:bg-neutral-700 text-white p-4 rounded disabled:opacity-50 disabled:cursor-not-allowed font-bold"
            >
              JOIN
            </button>
          </div>
        </div>
      </div>
      
      <p className="absolute bottom-6 text-neutral-600 text-xs text-center max-w-xs">
        Connect via Universal ID. Both players must be online.
      </p>
    </div>
  );
};