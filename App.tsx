import React, { useState, useEffect } from 'react';
import { ScreenState, PlayerProfile } from './types';
import { AuthScreen } from './components/Screens';
import { LobbyScreen } from './components/Lobby';
import { GameEngine } from './components/GameEngine';

export default function App() {
  const [screen, setScreen] = useState<ScreenState>('AUTH');
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [lobbyId, setLobbyId] = useState<string | null>(null);
  const [isMultiplayer, setIsMultiplayer] = useState<boolean>(false);

  // Generate a random ID on mount if not exists
  useEffect(() => {
    const savedId = localStorage.getItem('fh_player_id');
    if (savedId) {
      setProfile({ id: savedId, name: `Wolf-${savedId.substring(0, 4)}`, isHost: false });
    } else {
      const newId = Math.random().toString(36).substring(2, 8).toUpperCase();
      localStorage.setItem('fh_player_id', newId);
      setProfile({ id: newId, name: `Wolf-${newId.substring(0, 4)}`, isHost: false });
    }
  }, []);

  const handleCreateLobby = () => {
    if (!profile) return;
    const newLobbyId = Math.random().toString(36).substring(2, 6).toUpperCase();
    setLobbyId(newLobbyId);
    setProfile({ ...profile, isHost: true });
    setIsMultiplayer(true);
    setScreen('LOBBY');
  };

  const handleJoinLobby = (id: string) => {
    if (!profile) return;
    setLobbyId(id);
    setProfile({ ...profile, isHost: false });
    setIsMultiplayer(true);
    setScreen('LOBBY');
  };

  const handlePlayOffline = () => {
    setIsMultiplayer(false);
    setScreen('GAME');
  };

  const handleStartGame = () => {
    setScreen('GAME');
  };

  const handleBack = () => {
    setScreen('AUTH');
    setLobbyId(null);
  };

  return (
    <div className="w-full h-screen bg-neutral-900 text-white font-sans relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute inset-0 opacity-10 pointer-events-none bg-[url('https://picsum.photos/1920/1080?grayscale&blur=2')] bg-cover bg-center" />
      <div className="scanlines absolute inset-0 z-50 pointer-events-none" />

      {screen === 'AUTH' && profile && (
        <AuthScreen 
          profile={profile} 
          onCreate={handleCreateLobby} 
          onJoin={handleJoinLobby} 
          onOffline={handlePlayOffline} 
        />
      )}

      {screen === 'LOBBY' && profile && lobbyId && (
        <LobbyScreen 
          lobbyId={lobbyId} 
          currentUser={profile} 
          onStart={handleStartGame} 
          onBack={handleBack}
        />
      )}

      {screen === 'GAME' && profile && (
        <GameEngine 
          isMultiplayer={isMultiplayer} 
          onExit={() => setScreen('AUTH')} 
        />
      )}
    </div>
  );
}