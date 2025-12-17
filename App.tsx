import React, { useState, useEffect, useRef } from 'react';
import { ScreenState, PlayerProfile } from './types.ts';
import { AuthScreen } from './components/Screens.tsx';
import { LobbyScreen } from './components/Lobby.tsx';
import { GameEngine } from './components/GameEngine.tsx';

export default function App() {
  const [screen, setScreen] = useState<ScreenState>('AUTH');
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [peerId, setPeerId] = useState<string | null>(null);
  const [isMultiplayer, setIsMultiplayer] = useState<boolean>(false);
  const [conn, setConn] = useState<any>(null); // PeerJS connection

  // PeerJS Instance
  const peerRef = useRef<any>(null);

  useEffect(() => {
    // 1. Create Profile
    let id = localStorage.getItem('fh_player_id');
    if (!id) {
       id = Math.random().toString(36).substring(2, 6).toUpperCase();
       localStorage.setItem('fh_player_id', id);
    }
    setProfile({ id: id!, name: `Wolf-${id}`, isHost: false });

    // 2. Initialize PeerJS
    const initPeer = async () => {
        // @ts-ignore
        if (!window.Peer) return; // Wait for script load
        // @ts-ignore
        const peer = new window.Peer(id, { debug: 1 }); // Use our ID as Peer ID
        peer.on('open', (id: string) => {
            console.log('My peer ID is: ' + id);
            setPeerId(id);
        });
        peer.on('connection', (c: any) => {
            console.log('Incoming connection from friend');
            setConn(c);
            setIsMultiplayer(true);
            setProfile(p => p ? ({ ...p, isHost: true }) : null); // Sending/Host side
            // Auto switch to Lobby to show connection status, host must wait there
            // Note: If already in game, handle appropriately, but usually we start in Auth/Lobby
        });
        peerRef.current = peer;
    };

    const interval = setInterval(() => {
       // @ts-ignore
       if(window.Peer && !peerRef.current) {
          initPeer();
          clearInterval(interval);
       }
    }, 500);

    return () => {
       if(peerRef.current) peerRef.current.destroy();
    };
  }, []);

  const handleCreateLobby = () => {
    if (!profile) return;
    setProfile({ ...profile, isHost: true });
    setIsMultiplayer(true);
    setScreen('LOBBY');
  };

  const handleJoinLobby = (hostId: string) => {
    if (!profile || !peerRef.current) return;
    const connection = peerRef.current.connect(hostId);
    
    connection.on('open', () => {
      console.log("Connected to host!");
      setConn(connection);
    });
    
    setConn(connection);
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
    if (conn) {
       conn.close();
       setConn(null);
    }
  };

  return (
    <div className="w-full h-screen bg-neutral-900 text-white font-sans relative overflow-hidden">
      <div className="absolute inset-0 opacity-10 pointer-events-none bg-[url('https://picsum.photos/1920/1080?grayscale&blur=2')] bg-cover bg-center" />
      <div className="scanlines absolute inset-0 z-50 pointer-events-none" />

      {screen === 'AUTH' && profile && (
        <AuthScreen 
          profile={profile}
          peerId={peerId}
          onCreate={handleCreateLobby} 
          onJoin={handleJoinLobby} 
          onOffline={handlePlayOffline} 
        />
      )}

      {screen === 'LOBBY' && profile && peerId && (
        <LobbyScreen 
          currentUser={profile}
          peerId={peerId}
          conn={conn}
          isHost={profile.isHost}
          onStart={handleStartGame} 
          onBack={handleBack}
        />
      )}

      {screen === 'GAME' && profile && (
        <GameEngine 
          isMultiplayer={isMultiplayer}
          isHost={profile.isHost}
          conn={conn}
          onExit={handleBack} 
        />
      )}
    </div>
  );
}