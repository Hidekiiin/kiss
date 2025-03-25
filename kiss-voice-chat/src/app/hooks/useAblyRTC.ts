'use client';

import { useEffect, useState, useRef } from 'react';
import * as Ably from 'ably';
import 'webrtc-adapter';

interface AblyRTCManagerProps {
  username: string;
  onConnectionStatusChange: (status: boolean) => void;
  onRemoteAudioStream: (stream: MediaStream) => void;
}

export default function useAblyRTC({ username, onConnectionStatusChange, onRemoteAudioStream }: AblyRTCManagerProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [messages, setMessages] = useState<{ text: string; sender: string }[]>([]);
  
  const ablyRef = useRef<Ably.Realtime | null>(null);
  const channelRef = useRef<Ably.RealtimeChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<{ [clientId: string]: RTCPeerConnection }>({});
  const clientIdRef = useRef<string>('');

  // Ably接続の初期化
  useEffect(() => {
    if (!username) return;

    const initAbly = async () => {
      try {
        // Ablyトークンを取得
        const response = await fetch('/api/ably-token');
        const tokenRequest = await response.json();
        
        // Ablyクライアントを初期化
        const ably = new Ably.Realtime({ authCallback: (_, callback) => callback(null, tokenRequest) });
        ablyRef.current = ably;
        
        ably.connection.on('connected', () => {
          console.log('Connected to Ably!');
          clientIdRef.current = tokenRequest.clientId;
          setIsConnected(true);
          onConnectionStatusChange(true);
          
          // チャンネルに参加
          const channel = ably.channels.get('kiss-voice-chat');
          channelRef.current = channel;
          
          // チャンネルメッセージの処理
          channel.subscribe('chat-message', (message) => {
            setMessages(prev => [...prev, { text: message.data.text, sender: message.data.username }]);
          });
          
          // 参加メッセージを送信
          channel.publish('chat-message', { 
            text: `${username}さんが参加しました`, 
            username: 'system' 
          });
          
          // WebRTC関連のメッセージを処理
          setupWebRTCListeners(channel);
        });
        
        ably.connection.on('disconnected', () => {
          console.log('Disconnected from Ably!');
          setIsConnected(false);
          onConnectionStatusChange(false);
        });
        
      } catch (error) {
        console.error('Error initializing Ably:', error);
      }
    };
    
    initAbly();
    
    return () => {
      // クリーンアップ
      if (channelRef.current) {
        channelRef.current.unsubscribe();
      }
      if (ablyRef.current) {
        ablyRef.current.close();
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      Object.values(peerConnectionsRef.current).forEach(pc => pc.close());
    };
  }, [username, onConnectionStatusChange]);

  // WebRTCリスナーの設定
  const setupWebRTCListeners = (channel: Ably.RealtimeChannel) => {
    channel.subscribe('webrtc-signal', async (message) => {
      if (message.clientId === clientIdRef.current) return;
      
      const { type, sdp, candidate, senderClientId } = message.data;
      
      if (!peerConnectionsRef.current[senderClientId]) {
        await createPeerConnection(senderClientId);
      }
      
      const pc = peerConnectionsRef.current[senderClientId];
      
      if (type === 'offer') {
        await pc.setRemoteDescription(new RTCSessionDescription({ type, sdp }));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        
        channel.publish('webrtc-signal', {
          type: 'answer',
          sdp: answer.sdp,
          senderClientId: clientIdRef.current,
          targetClientId: senderClientId
        });
      } else if (type === 'answer') {
        await pc.setRemoteDescription(new RTCSessionDescription({ type, sdp }));
      } else if (type === 'candidate') {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    });
  };

  // PeerConnectionの作成
  const createPeerConnection = async (targetClientId: string) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });
    
    peerConnectionsRef.current[targetClientId] = pc;
    
    // ICE候補の処理
    pc.onicecandidate = (event) => {
      if (event.candidate && channelRef.current) {
        channelRef.current.publish('webrtc-signal', {
          type: 'candidate',
          candidate: event.candidate,
          senderClientId: clientIdRef.current,
          targetClientId
        });
      }
    };
    
    // リモートストリームの処理
    pc.ontrack = (event) => {
      console.log('Received remote track');
      onRemoteAudioStream(event.streams[0]);
    };
    
    // ローカルストリームの追加
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        if (localStreamRef.current) {
          pc.addTrack(track, localStreamRef.current);
        }
      });
    }
    
    return pc;
  };

  // 音声ストリームの開始
  const startVoiceStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
      
      // ミュート状態を設定
      stream.getAudioTracks().forEach(track => {
        track.enabled = !isMuted;
      });
      
      // 既存のピア接続に追加
      Object.entries(peerConnectionsRef.current).forEach(([targetClientId, pc]) => {
        stream.getTracks().forEach(track => {
          pc.addTrack(track, stream);
        });
        
        // オファーを作成して送信
        createAndSendOffer(targetClientId, pc);
      });
      
      return true;
    } catch (error) {
      console.error('Error accessing microphone:', error);
      return false;
    }
  };
  
  // オファーの作成と送信
  const createAndSendOffer = async (targetClientId: string, pc: RTCPeerConnection) => {
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      if (channelRef.current) {
        channelRef.current.publish('webrtc-signal', {
          type: 'offer',
          sdp: offer.sdp,
          senderClientId: clientIdRef.current,
          targetClientId
        });
      }
    } catch (error) {
      console.error('Error creating offer:', error);
    }
  };

  // マイクのミュート/アンミュート
  const toggleMute = () => {
    if (localStreamRef.current) {
      const newMuteState = !isMuted;
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !newMuteState;
      });
      setIsMuted(newMuteState);
    }
  };

  // メッセージの送信
  const sendMessage = (text: string) => {
    if (channelRef.current && text.trim()) {
      channelRef.current.publish('chat-message', { 
        text, 
        username 
      });
      setMessages(prev => [...prev, { text, sender: 'me' }]);
      return true;
    }
    return false;
  };

  // 接続の開始
  const connect = async () => {
    const success = await startVoiceStream();
    return success;
  };

  return {
    isConnected,
    isMuted,
    messages,
    connect,
    toggleMute,
    sendMessage
  };
}
