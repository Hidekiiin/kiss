'use client';

import { useState, useEffect, useRef } from 'react';
import useAblyRTC from './hooks/useAblyRTC';

export default function Home() {
  const [username, setUsername] = useState('');
  const [showUsernameModal, setShowUsernameModal] = useState(true);
  const [inputMessage, setInputMessage] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  
  const handleConnectionStatusChange = (status: boolean) => {
    console.log('Connection status changed:', status);
  };
  
  const handleRemoteAudioStream = (stream: MediaStream) => {
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = stream;
    }
  };
  
  const {
    isConnected,
    isMuted,
    messages,
    connect,
    toggleMute,
    sendMessage
  } = useAblyRTC({
    username,
    onConnectionStatusChange: handleConnectionStatusChange,
    onRemoteAudioStream: handleRemoteAudioStream
  });

  const handleUsernameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim()) {
      setIsConnecting(true);
      const success = await connect();
      if (success) {
        setShowUsernameModal(false);
      }
      setIsConnecting(false);
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputMessage.trim() && sendMessage(inputMessage.trim())) {
      setInputMessage('');
    }
  };

  return (
    <main className="min-h-screen">
      <div className="chat-container glass-card">
        <div className="chat-header">
          <h1 className="text-3xl font-bold mb-2">KISS</h1>
          <p className="text-sm text-gray-600">虹色パステルカラーの音声チャットアプリ</p>
        </div>

        {showUsernameModal ? (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
            <div className="glass-card p-6 w-80">
              <h2 className="text-xl font-bold mb-4">ユーザー名を入力</h2>
              <form onSubmit={handleUsernameSubmit}>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full p-2 mb-4 rounded border"
                  placeholder="ユーザー名"
                  required
                />
                <button 
                  type="submit" 
                  className="btn-primary w-full"
                  disabled={isConnecting}
                >
                  {isConnecting ? 'マイクに接続中...' : 'チャットに参加'}
                </button>
              </form>
            </div>
          </div>
        ) : null}

        <div className="chat-messages glass-card">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`mb-2 p-2 rounded ${
                msg.sender === 'me'
                  ? 'ml-auto bg-gradient-to-r from-[var(--pastel-blue)] to-[var(--pastel-purple)] text-right max-w-xs'
                  : msg.sender === 'system'
                  ? 'mx-auto bg-[var(--pastel-yellow)] text-center max-w-sm'
                  : 'mr-auto bg-gradient-to-r from-[var(--pastel-pink)] to-[var(--pastel-red)] max-w-xs'
              }`}
            >
              {msg.sender !== 'me' && msg.sender !== 'system' && (
                <div className="font-bold text-xs">{msg.sender}</div>
              )}
              <div>{msg.text}</div>
            </div>
          ))}
        </div>

        <form onSubmit={handleSendMessage} className="chat-input">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="メッセージを入力..."
            className="flex-1 p-2 rounded-full border"
            disabled={!isConnected}
          />
          <button 
            type="submit" 
            className="btn-primary"
            disabled={!isConnected}
          >
            送信
          </button>
        </form>

        <div className="voice-controls mt-4">
          <button
            onClick={toggleMute}
            className={`voice-indicator ${!isMuted ? 'active' : ''} p-3 glass-card`}
            aria-label={isMuted ? 'マイクをオン' : 'マイクをオフ'}
            disabled={!isConnected}
          >
            {isMuted ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="1" y1="1" x2="23" y2="23"></line>
                <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path>
                <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path>
                <line x1="12" y1="19" x2="12" y2="23"></line>
                <line x1="8" y1="23" x2="16" y2="23"></line>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                <line x1="12" y1="19" x2="12" y2="23"></line>
                <line x1="8" y1="23" x2="16" y2="23"></line>
              </svg>
            )}
          </button>
          <div className="connection-status text-sm mt-2">
            {isConnected ? (
              <span className="text-green-600">接続中</span>
            ) : (
              <span className="text-red-600">未接続</span>
            )}
          </div>
        </div>
        
        {/* リモートオーディオ要素 */}
        <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
      </div>
    </main>
  );
}
