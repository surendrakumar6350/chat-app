import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Video, User, Phone, PhoneOff, Mic, MicOff, Video as VideoIcon, VideoOff } from 'lucide-react';
import { WEB_SOCKET_ADDRESS } from "../constants"

interface ChatMessage {
  id: string;
  type: 'system' | 'self' | 'other';
  text: string;
  timestamp: Date;
  username?: string;
}

interface UserData {
  id: string;
  username: string;
}

const SocketChatApp: React.FC = () => {
  const [username, setUsername] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeUsers, setActiveUsers] = useState<UserData[]>([]);
  const [isJoined, setIsJoined] = useState<boolean>(false);
  const [isMobileModalOpen, setIsMobileModalOpen] = useState<boolean>(false);
  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);

    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);

  const selectedUserRef = useRef<UserData | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);

  const inCallRef = useRef<boolean>(false);
  const [inCall, setInCall] = useState<boolean>(false);

  const clientIdRef = useRef<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const isVideoEnabledRef = useRef<boolean>(true);
  const isAudioEnabledRef = useRef<boolean>(true);
  const callStatusRef = useRef<"idle" | "calling" | "incoming" | "connected">("idle");

  const messageContainerRef = useRef<HTMLDivElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  const peerConnectionConfig = {
    'iceServers': [
      { 'urls': 'stun:stun.stunprotocol.org:3478' },
      { 'urls': 'stun:stun.l.google.com:19302' },
    ]
  };

  useEffect(() => {
    const ws = new WebSocket(WEB_SOCKET_ADDRESS);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connection opened');
      addSystemMessage("Connected to server successfully!");
      addSystemMessage("Click on a username in the navigation bar to start a video call.");
    };

    ws.onmessage = (event) => {
      let data = JSON.parse(event.data);
      console.log('WebSocket message received:', data);

      if (data.type === "yourId") {
        clientIdRef.current = data.message;
      }

      if (data.type === "activeClients") {
        if (data.message) {
          const filteredUsers = data.message.filter((e: any) => e != null && e.username);
          setActiveUsers(filteredUsers);
        }
      }

      if (data.type === "newMessage") {
        const incomingMessage: ChatMessage = {
          id: `msg-${Date.now()}-${Math.random()}`,
          type: 'other',
          username: data.username,
          text: data.message,
          timestamp: new Date()
        };
        setMessages(prevMessages => [...prevMessages, incomingMessage]);
      }

      // Video call signaling messages
      if (data.type === "call-request" && data.target === clientIdRef.current) {
        selectedUserRef.current = data.user;
        setSelectedUser(data.user);
        callStatusRef.current = 'incoming';
        addSystemMessage(`Incoming call from ${data.user.username}`);
      }

      if (data.type === "call-accepted" && data.target === clientIdRef.current) {
        if (callStatusRef.current === 'calling') {
          addSystemMessage(`Call accepted!`);
          callStatusRef.current = 'connected';
          startPeerConnection(true);
        }
      }

      if (data.type === "call-rejected" && data.target === clientIdRef.current) {
        if (callStatusRef.current === 'calling') {
          addSystemMessage(`Call rejected.`);
          endCall();
        }
      }

      if (data.type === "call-ended" && data.target === clientIdRef.current) {
        if (callStatusRef.current === 'connected' || callStatusRef.current === 'incoming') {
          addSystemMessage(`Call ended.`);
          endCall();
        }
      }

      // WebRTC signaling
      if (data.type === "webrtc-signal" && data.target === clientIdRef.current) {
        handleWebRTCSignal(data);
      }
    };

    ws.onerror = (err) => {
      console.error('WebSocket error:', err);
      addSystemMessage("Failed to connect to server.");
    };

    ws.onclose = () => {
      console.log('WebSocket closed');
      addSystemMessage("Disconnected from server.");
    };

    // Cleanup on component unmount
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
      ws.close();
    };
  }, []);

  // Setup media devices
  const setupMediaDevices = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        addSystemMessage("Your browser does not support media devices.");
        return null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      localStreamRef.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.onloadedmetadata = () => {
          localVideoRef.current?.play();
        };
      }

      return stream;
    } catch (error) {
      console.error("Error accessing media devices:", error);
      addSystemMessage("Failed to access camera or microphone. " +
        (error as Error).message);
      return null;
    }
  };

  // Handle WebRTC signaling
  const handleWebRTCSignal = async (data: any) => {
    console.log("Received WebRTC signal:", data.sdp ? data.sdp.type : "ICE candidate");

    let pc = peerConnectionRef.current;
    if (!pc) {
      console.log("Creating new peer connection for incoming signal");
      pc = startPeerConnection(false);
    }

    if (data.sdp) {
      console.log("Processing SDP:", data.sdp.type);
      try {
        await pc?.setRemoteDescription(new RTCSessionDescription(data.sdp));
        console.log("Remote description set successfully");

        if (data.sdp.type === 'offer') {
          console.log("Creating answer to offer");
          const answer = await pc?.createAnswer();
          await pc?.setLocalDescription(answer);
          console.log("Local description (answer) set, sending to peer");

          sendWebRTCSignal({
            type: "webrtc-signal",
            target: selectedUserRef.current?.id,
            id: clientIdRef.current,
            sdp: pc?.localDescription
          });
        }
      } catch (error) {
        console.error("Error handling SDP:", error);
        addSystemMessage("Failed to establish connection. Try again.");
      }
    } else if (data.ice) {
      console.log("Adding ICE candidate");
      try {
        await pc?.addIceCandidate(new RTCIceCandidate(data.ice));
      } catch (error) {
        console.error("Error adding ICE candidate:", error);
      }
    }
  };

  // Send WebRTC signal
  const sendWebRTCSignal = (signal: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(signal));
    }
  };

  // Start WebRTC peer connection
  const startPeerConnection = (isInitiator: boolean) => {
    if (!localStreamRef.current) {
      addSystemMessage("Local stream not available.");
      return null;
    }

    // Close any existing connection first
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }

    console.log("Creating new peer connection as", isInitiator ? "initiator" : "receiver");

    const pc = new RTCPeerConnection(peerConnectionConfig);
    peerConnectionRef.current = pc;

    // Add local stream tracks to peer connection
    localStreamRef.current.getTracks().forEach(track => {
      console.log("Adding local track to peer connection:", track.kind);
      if (localStreamRef.current) {
        pc.addTrack(track, localStreamRef.current);
      }
    });

    // Set up ICE candidate handler
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log("ICE candidate generated:", event.candidate.candidate.substr(0, 50) + "...");
        sendWebRTCSignal({
          type: "webrtc-signal",
          target: selectedUserRef.current?.id,
          id: clientIdRef.current,
          ice: event.candidate
        });
      }
    };

    // Connection state changes
    pc.oniceconnectionstatechange = () => {
      console.log("ICE connection state:", pc.iceConnectionState);
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        addSystemMessage("Video connection established!");
      } else if (pc.iceConnectionState === 'failed') {
        addSystemMessage("Video connection failed. Try reconnecting.");
      }
    };

    // Set up remote track handler
    pc.ontrack = (event) => {
      console.log("Received remote track:", event.track.kind);
      if (remoteVideoRef.current && event.streams && event.streams[0]) {
        console.log("Setting remote stream to video element");
        remoteVideoRef.current.srcObject = event.streams[0];
        remoteStreamRef.current = event.streams[0];
        setupMediaDevices();
      }
    };

    // If we're the initiator, create an offer
    if (isInitiator) {
      console.log("Creating offer as initiator");
      pc.createOffer()
        .then(description => {
          console.log("Offer created:", description.type);
          return pc.setLocalDescription(description);
        })
        .then(() => {
          console.log("Local description set, sending to peer");
          sendWebRTCSignal({
            type: "webrtc-signal",
            target: selectedUserRef.current?.id,
            id: clientIdRef.current,
            sdp: pc.localDescription
          });
        })
        .catch(error => console.error("Error in offer creation process:", error));
    }

    return pc;
  };

  // Handle message operations
  const addMessage = (msg: ChatMessage): void => {
    setMessages(prev => [...prev, msg]);
  };

  const addSystemMessage = (text: string): void => {
    addMessage({
      id: `sys-${Date.now()}`,
      type: 'system',
      text,
      timestamp: new Date()
    });
  };

  const handleSendMessage = (): void => {
    if (!message.trim() || !wsRef.current) return;

    wsRef.current.send(JSON.stringify({
      type: "newMessage",
      message: message,
      id: clientIdRef.current,
      username: username
    }));

    addMessage({
      id: `msg-${Date.now()}`,
      type: 'self',
      username: username,
      text: message,
      timestamp: new Date()
    });

    setMessage('');
  };

  const handleJoinChat = (): void => {
    if (!username.trim()) return;
    if (!wsRef.current) {
      alert("Please refresh the page");
      return;
    }
    wsRef.current.send(JSON.stringify({
      type: "addUsername",
      message: username,
      clientId: clientIdRef.current
    }));
    setIsJoined(true);
  };

  const handleUserClick = (user: UserData): void => {
    selectedUserRef.current = user;
    setSelectedUser(user);

    // Open mobile modal when a user is selected on mobile
    if (isMobile) {
      setIsMobileModalOpen(true);
    }
  };

  const startCall = async (): Promise<void> => {
    if (!selectedUserRef.current) return;

    // Ensure we have media access before starting the call
    if (!localStreamRef.current) {
      const stream = await setupMediaDevices();
      if (!stream) {
        addSystemMessage("Failed to access camera/microphone. Please check permissions.");
        return;
      }
    }

    wsRef.current?.send(JSON.stringify({
      type: "call-request",
      id: clientIdRef.current,
      target: selectedUserRef.current.id,
      user: { username: username, id: clientIdRef.current }
    }));

    addSystemMessage(`Calling ${selectedUserRef.current.username}...`);
    callStatusRef.current = 'calling';
  };

  const acceptCall = async (): Promise<void> => {
    if (!selectedUserRef.current) return;

    // Ensure we have media access before accepting the call
    if (!localStreamRef.current) {
      const stream = await setupMediaDevices();
      if (!stream) {
        addSystemMessage("Failed to access camera/microphone. Please check permissions.");
        return;
      }
    }

    wsRef.current?.send(JSON.stringify({
      type: "call-accepted",
      id: clientIdRef.current,
      target: selectedUserRef.current.id,
      username: username
    }));

    callStatusRef.current = 'connected';
    inCallRef.current = true;
    setInCall(true);
    startPeerConnection(false);
  };

  const rejectCall = (): void => {
    if (!selectedUserRef.current) return;

    wsRef.current?.send(JSON.stringify({
      type: "call-rejected",
      id: clientIdRef.current,
      target: selectedUserRef.current.id,
      username: username
    }));

    callStatusRef.current = 'idle';

    // Close mobile modal
    if (isMobile) {
      setIsMobileModalOpen(false);
    }
  };

  const endCall = (): void => {
    if (selectedUserRef.current) {
      wsRef.current?.send(JSON.stringify({
        type: "call-ended",
        id: clientIdRef.current,
        target: selectedUserRef.current.id,
        username: username
      }));
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.ontrack = null;
      peerConnectionRef.current.onicecandidate = null;
      peerConnectionRef.current.oniceconnectionstatechange = null;
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    remoteStreamRef.current = null;
    callStatusRef.current = 'idle';
    inCallRef.current = false;
    setInCall(false);

    addSystemMessage("Call ended.");

    // Close mobile modal
    if (isMobile) {
      setIsMobileModalOpen(false);
    }
  };

  const closeModal = (): void => {
    if (callStatusRef.current !== 'idle') {
      endCall();
    }
    setSelectedUser(null);
    setIsMobileModalOpen(false);
  };

  const toggleVideo = (): void => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      isVideoEnabledRef.current = !isVideoEnabledRef.current;
    }
  };

  const toggleAudio = (): void => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      isAudioEnabledRef.current = !isAudioEnabledRef.current;
    }
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  useEffect(() => {
    if (messageContainerRef.current) {
      messageContainerRef.current.scrollTop = messageContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Render the "Start Call" UI based on call status and device type
  const renderCallInterface = () => {
    if (callStatusRef.current === 'connected') {
      return (
        <div className="w-full h-full flex flex-col">
          {/* Main video display (Remote) */}
          <div className="flex-1 bg-[#242424] rounded-lg relative overflow-hidden mb-4">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            {!remoteStreamRef.current && (
              <div className="absolute inset-0 flex items-center justify-center">
                <User size={80} className="text-gray-600" />
              </div>
            )}

            {/* Self video (Local) - Responsive sizing */}
            <div className="absolute bottom-4 right-4 w-24 h-32 sm:w-32 sm:h-40 bg-[#333333] rounded overflow-hidden border-2 border-gray-600">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {!localStreamRef.current && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <User size={24} className="text-gray-500" />
                </div>
              )}
            </div>
          </div>

          {/* Call controls - Made responsive */}
          <div className="flex justify-center gap-4 sm:gap-6">
            <button
              className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center ${isAudioEnabledRef.current
                ? 'bg-[#333333] hover:border-[#646cff] hover:border'
                : 'bg-red-500'
                }`}
              onClick={toggleAudio}
            >
              {isAudioEnabledRef.current ? (
                <Mic size={20} className="text-white" />
              ) : (
                <MicOff size={20} className="text-white" />
              )}
            </button>
            <button
              className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center ${isVideoEnabledRef.current
                ? 'bg-[#333333] hover:border-[#646cff] hover:border'
                : 'bg-red-500'
                }`}
              onClick={toggleVideo}
            >
              {isVideoEnabledRef.current ? (
                <VideoIcon size={20} className="text-white" />
              ) : (
                <VideoOff size={20} className="text-white" />
              )}
            </button>
            <button
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center"
              onClick={endCall}
            >
              <PhoneOff size={20} className="text-white" />
            </button>
          </div>
        </div>
      );
    } else if (callStatusRef.current === 'incoming') {
      return (
        <div className="text-center p-4 w-full h-full flex flex-col justify-center items-center">
          <h3 className="text-lg font-medium mb-6 text-white">
            Incoming call from {selectedUser?.username}
          </h3>
          <div className="flex justify-center gap-4">
            <button
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-green-600 hover:bg-green-700 flex items-center justify-center"
              onClick={acceptCall}
            >
              <Phone size={24} className="text-white" />
            </button>
            <button
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center"
              onClick={rejectCall}
            >
              <PhoneOff size={24} className="text-white" />
            </button>
          </div>
        </div>
      );
    } else if (callStatusRef.current === 'calling') {
      return (
        <div className="text-center p-4 w-full h-full flex flex-col justify-center items-center">
          <h3 className="text-lg font-medium mb-6 text-white">
            Calling {selectedUser?.username}...
          </h3>
          <button
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center"
            onClick={endCall}
          >
            <PhoneOff size={24} className="text-white" />
          </button>
        </div>
      );
    } else {
      return (
        <div className="text-center w-full h-full flex flex-col justify-center items-center p-4">
          <div className="w-24 h-24 rounded-full bg-[#242424] mx-auto flex items-center justify-center mb-4">
            <User size={40} className="text-gray-600" />
          </div>
          <h3 className="text-white font-medium mb-4">{selectedUser?.username}</h3>
          <button
            className="px-6 py-2 bg-[#646cff] hover:bg-[#535bf2] text-white rounded-full flex items-center justify-center mx-auto"
            onClick={startCall}
          >
            <Phone size={16} className="mr-2" />
            Start Video Call
          </button>
        </div>
      );
    }
  };

  if (!isJoined) {
    return (
      <div className="flex h-screen items-center justify-center p-4">
        <div className="bg-[#1a1a1a] p-8 rounded-lg shadow-md w-full max-w-md mx-auto">
          <h1 className="text-2xl font-bold mb-6 text-center">Join Socket Chat</h1>

          <div className="mb-4">
            <label className="block text-sm font-bold mb-2" htmlFor="username">
              Username
            </label>
            <input
              id="username"
              type="text"
              className="w-full px-3 py-2 border border-gray-600 bg-[#242424] rounded focus:outline-none focus:border-[#646cff]"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') handleJoinChat();
              }}
            />
          </div>

          <button
            className="w-full bg-[#646cff] hover:bg-[#535bf2] text-white font-bold py-2 px-4 rounded focus:outline-none"
            onClick={handleJoinChat}
          >
            Join Chat
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#242424]">
      {/* Navigation Bar - Made responsive */}
      <div className="bg-[#1a1a1a] text-white py-3 px-4 shadow-md">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-xl font-bold flex items-center">
            <MessageSquare className="mr-2" size={20} />
            <span className="hidden sm:inline">Socket Chat</span>
          </h1>
          <div className="flex items-center">
            <User className="mr-1" size={16} />
            <span className="text-sm">{username}</span>
          </div>
        </div>

        <div className="text-xs text-gray-300 mb-2 hidden sm:block">
          Active Users - Click on a user to start a video call
        </div>
        <div className="text-xs text-gray-300 mb-2 sm:hidden">
          Active Users - Tap to call
        </div>

        <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
          {activeUsers
            .filter(user => user.id !== clientIdRef.current)
            .map(user => (
              <button
                key={user.id}
                className={`px-3 py-1 rounded-full text-sm flex items-center ${selectedUser && selectedUser.id === user.id
                  ? 'bg-[#646cff] text-white'
                  : 'bg-[#333333] hover:border-[#646cff] hover:border'
                  }`}
                onClick={() => handleUserClick(user)}
              >
                <User size={12} className="mr-1" />
                {user.username}
              </button>
            ))}
        </div>
      </div>

      {/* Main Content - Made responsive */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Chat Area - Responsive layout */}
        <div className={`flex-1 flex flex-col ${(inCall || callStatusRef.current !== 'idle') ? 'hidden sm:flex' : 'flex'}`}>
          {/* Messages */}
          <div
            ref={messageContainerRef}
            className="flex-1 overflow-y-auto p-4"
          >
            {messages.map(msg => {
              if (msg.type === 'system') {
                return (
                  <div key={msg.id} className="text-center text-gray-400 text-sm my-2">
                    {msg.text}
                  </div>
                );
              } else {
                return (
                  <div
                    key={msg.id}
                    className={`mb-4 max-w-[75%] ${msg.type === 'self' ? 'ml-auto' : 'mr-auto'}`}
                  >
                    <div
                      className={`rounded-lg px-4 py-2 ${msg.type === 'self'
                        ? 'bg-[#646cff] text-white'
                        : 'bg-[#333333] text-gray-200'
                        }`}
                    >
                      <div className="font-bold text-sm">
                        {msg.type === 'self' ? 'You' : msg.username}
                      </div>
                      <div className="mt-1 break-words">{msg.text}</div>
                      <div className="text-xs mt-1 opacity-70 text-right">
                        {formatTime(msg.timestamp)}
                      </div>
                    </div>
                  </div>
                );
              }
            })}
          </div>

          {/* Message Input - Responsive padding */}
          <div className="bg-[#1a1a1a] p-3 sm:p-4 border-t border-gray-700">
            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 px-3 sm:px-4 py-2 border border-gray-600 bg-[#242424] rounded focus:outline-none focus:border-[#646cff]"
                placeholder="Type your message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') handleSendMessage();
                }}
              />
              <button
                className="bg-[#646cff] hover:bg-[#535bf2] text-white px-4 py-2 rounded whitespace-nowrap"
                onClick={handleSendMessage}
              >
                Send
              </button>
            </div>
          </div>
        </div>

        {/* Desktop Video Call Area */}
        {selectedUser && !isMobile && (
          <div
            className={`hidden sm:flex ${callStatusRef.current !== 'idle' ? 'w-80' : 'w-80'
              } bg-[#1a1a1a] border-l border-gray-700 flex-col`}
          >
            <div className="p-4 bg-[#242424] text-white">
              <div className="flex justify-between items-center">
                <h2 className="font-bold flex items-center">
                  <Video className="mr-2" size={16} />
                  {callStatusRef.current !== 'idle'
                    ? callStatusRef.current === 'connected'
                      ? 'In Call'
                      : callStatusRef.current === 'calling'
                        ? 'Calling...'
                        : 'Incoming Call'
                    : 'Start Call'}
                </h2>
                <button
                  className="text-gray-400 hover:text-white p-2"
                  onClick={closeModal}
                >
                  &times;
                </button>
              </div>
              <div className="text-sm text-gray-400 mt-1">
                {selectedUser.username}
              </div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center p-4 relative">
              {renderCallInterface()}
            </div>
          </div>
        )}

        {/* Mobile Video Call Modal */}
        {selectedUser && isMobile && isMobileModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 flex flex-col">
            {/* Custom Mobile Modal */}
            <div className="bg-[#1a1a1a] text-white rounded-t-xl flex flex-col h-full">
              {/* Modal Header */}
              <div className="p-4 bg-[#242424] text-white rounded-t-xl">
                <div className="flex justify-between items-center">
                  <h2 className="font-bold flex items-center">
                    <Video className="mr-2" size={16} />
                    {callStatusRef.current !== 'idle'
                      ? callStatusRef.current === 'connected'
                        ? 'In Call'
                        : callStatusRef.current === 'calling'
                          ? 'Calling...'
                          : 'Incoming Call'
                      : 'Start Call'}
                  </h2>
                  <button
                    className="text-gray-400 hover:text-white p-2"
                    onClick={closeModal}
                  >
                    &times;
                  </button>
                </div>
                <div className="text-sm text-gray-400 mt-1">
                  {selectedUser.username}
                </div>
              </div>

              {/* Modal Content */}
              <div className="flex-1 flex flex-col items-center justify-center p-4">
                {renderCallInterface()}
              </div>

              {/* Pull handle for better mobile UX */}
              <div className="mx-auto h-1 w-16 bg-gray-600 rounded-full mb-2"></div>
            </div>
          </div>
        )}

        {/* Mobile Call Controls Indicator (for better mobile UX) */}
        {(inCall || callStatusRef.current === 'calling' || callStatusRef.current === 'incoming') && (
          <div className="fixed bottom-4 right-4 sm:hidden">
            <button
              className="bg-[#646cff] w-12 h-12 rounded-full flex items-center justify-center shadow-lg"
              onClick={() => {
                if (!isMobileModalOpen) {
                  setIsMobileModalOpen(true);
                }
              }}
            >
              <Phone size={20} className="text-white" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SocketChatApp;