import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare, Video, User, Phone, PhoneOff, Mic,
  MicOff, Video as VideoIcon, VideoOff, Search, Bell, Settings, Users
} from 'lucide-react';
import { WEB_SOCKET_ADDRESS } from "../constants";
import JoinChatForm from "../components/JoinChatForm";
import { Button } from "../components/ui/button";
import { ChatMessage, UserData } from "../types/home";


const SocketChatApp: React.FC = () => {
  const [username, setUsername] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeUsers, setActiveUsers] = useState<UserData[]>([]);

  const [isJoined, setIsJoined] = useState<boolean>(false);
  const [isMobileModalOpen, setIsMobileModalOpen] = useState<boolean>(false);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [onlineUsers, setOnlineUsers] = useState(0);

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


  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);

    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);

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
    };

    ws.onmessage = (event) => {
      let data = JSON.parse(event.data);
      console.log('WebSocket message received:', data);

      if (data.type === "yourId") {
        clientIdRef.current = data.message;
        setOnlineUsers(data.onlineUsers);
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

  if (!isJoined) {
    return (
      <JoinChatForm username={username}
        handleJoinChat={handleJoinChat}
        setUsername={setUsername} onlineUsers={onlineUsers} />
    );
  }

  return (
    <div className="flex h-screen bg-[#242424]">
      {/* Sidebar - Desktop Only */}
      <div className="hidden sm:flex flex-col w-64 bg-[#1a1a1a] border-r border-gray-800">
        <div className="p-4 border-b border-gray-800">
          <h1 className="font-bold text-sm flex items-center text-white">
            <MessageSquare className="mr-2" size={24} />
            <span className='text-xl'>Anonymous Chat</span>
          </h1>
        </div>

        {/* User Profile */}
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#2a2a2a] flex items-center justify-center">
              <User size={20} className="text-gray-300" />
            </div>
            <div className="flex-1">
              <div className="text-white font-medium">{username}</div>
              <div className="text-xs text-green-500">Online</div>
            </div>
            <Settings size={18} className="text-gray-400 hover:text-white cursor-pointer" />
          </div>
        </div>

        {/* Navigation */}
        <div className="p-2">
          <Button className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white">
            <Users size={18} />
            Active Users
          </Button>
          <Button className="w-full my-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white">
            <Bell size={18} />
            Notifications
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Navigation Bar */}
        <div className="bg-[#1a1a1a] text-white p-3 sm:p-4 shadow-md">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-xl font-bold flex items-center sm:hidden">
              <MessageSquare className="mr-2" size={20} />
              <span className="hidden sm:inline">Anonymous Chat</span>
            </h1>
            <div className="hidden sm:flex items-center gap-4 flex-1 max-w-2xl">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Search users..."
                  className="w-full bg-[#2a2a2a] rounded-lg px-4 py-2 pl-10 text-sm border border-gray-700 focus:outline-none focus:ring-1 focus:ring-[#646cff] text-white placeholder-gray-400"
                />
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              </div>
            </div>
            <div className="flex items-center gap-2 bg-[#2a2a2a] px-3 py-1.5 rounded-full text-white">
              <User size={14} />
              <span className="text-sm">{username}</span>
            </div>
          </div>

          <div className="text-sm text-gray-300 mb-2 hidden sm:block">
            Active Users - Click on a user to start a video call
          </div>
          <div className="text-sm text-gray-300 mb-2 sm:hidden">
            Active Users - Tap to call
          </div>

          <div className="flex flex-wrap gap-2 max-h-20 overflow-y-auto scrollbar-thin">
            {activeUsers.filter(user => user.id !== clientIdRef.current).length === 0 ? (
              <p className="text-sm text-gray-400 bg-[#2a2a2a] px-4 py-2 rounded-lg">
                No users online. Open in multiple browsers or invite friends.
              </p>
            ) : (
              activeUsers
                .filter(user => user.id !== clientIdRef.current)
                .map(user => (
                  <Button
                    key={user.id}
                    className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
                    onClick={() => handleUserClick(user)}
                  >
                    <User size={12} className="mr-1" />
                    {user.username}
                  </Button>
                ))
            )}
          </div>
        </div>

        {/* Chat Container */}
        <div className="flex flex-1 overflow-hidden">
          {/* Messages Area */}
          <div className={`flex-1 flex flex-col ${(inCall || callStatusRef.current !== 'idle') ? 'hidden sm:flex' : 'flex'}`}>
            {/* Messages */}
            <div
              ref={messageContainerRef}
              className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#242424]"
            >
              {messages.map(msg => {
                if (msg.type === 'system') {
                  return (
                    <div key={msg.id} className="text-center">
                      <span className="bg-[#2a2a2a] text-gray-400 text-xs px-3 py-1 rounded-full">
                        {msg.text}
                      </span>
                    </div>
                  );
                } else {
                  const isSelf = msg.type === 'self';
                  return (
                    <div
                      key={msg.id}
                      className={`max-w-[85%] sm:max-w-[70%] ${isSelf ? 'ml-auto' : ''}`}
                    >
                      <div
                        className={`rounded-2xl ${isSelf
                          ? 'bg-[#646cff] text-white rounded-tr-none'
                          : 'bg-[#2a2a2a] text-gray-200 rounded-tl-none'
                          } px-4 py-2`}
                      >
                        <div className="font-medium text-sm">
                          {isSelf ? 'You' : msg.username}
                        </div>
                        <div className="mt-1 break-words">{msg.text}</div>
                        <div className="text-[10px] mt-1 opacity-70 text-right">
                          {formatTime(msg.timestamp)}
                        </div>
                      </div>
                    </div>
                  );
                }
              })}
            </div>

            {/* Message Input */}
            <div className="bg-[#1a1a1a] p-3 sm:p-4 border-t border-gray-800">
              <div className="flex gap-2 max-w-5xl mx-auto">
                <input
                  type="text"
                  className="flex-1 px-4 py-2.5 border border-gray-700 bg-[#2a2a2a] rounded-full focus:outline-none focus:border-[#646cff] text-white text-sm placeholder-gray-400"
                  placeholder="Type your message..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') handleSendMessage();
                  }}
                />
                <Button
                  className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
                  onClick={handleSendMessage}
                >
                  Send
                </Button>
              </div>
            </div>
          </div>

          {/* Video Call Area - Desktop */}
          {selectedUser && !isMobile && (
            <div
              className={`hidden sm:flex ${callStatusRef.current !== 'idle' ? 'w-80' : 'w-80'
                } bg-[#1a1a1a] border-l border-gray-800 flex-col`}
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
                  <Button
                    className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
                    onClick={closeModal}
                  >
                    &times;
                  </Button>
                </div>
                <div className="text-sm text-gray-400 mt-1">
                  {selectedUser.username}
                </div>
              </div>

              <div className="flex-1 flex flex-col items-center justify-center p-4 relative">
                {callStatusRef.current === 'connected' && (
                  <div className="w-full h-full flex flex-col">
                    {/* Video elements */}
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

                      {/* Local video */}
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

                    {/* Call controls */}
                    <div className="flex justify-center gap-4 sm:gap-6">
                      <Button
                        className="w-18 h-18 sm:w-14 sm:h-14 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
                        onClick={toggleAudio}
                      >
                        {isAudioEnabledRef.current ? (
                          <Mic size={20} className="text-white" />
                        ) : (
                          <MicOff size={20} className="text-white" />
                        )}
                      </Button>
                      <Button
                        className="w-18 h-18 sm:w-14 sm:h-14 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
                        onClick={toggleVideo}
                      >
                        {isVideoEnabledRef.current ? (
                          <VideoIcon size={20} className="text-white" />
                        ) : (
                          <VideoOff size={20} className="text-white" />
                        )}
                      </Button>
                      <Button
                        className="w-18 h-18 sm:w-14 sm:h-14 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
                        onClick={endCall}
                      >
                        <PhoneOff size={20} className="text-white" />
                      </Button>
                    </div>
                  </div>
                )}

                {callStatusRef.current === 'incoming' && (
                  <div className="text-center p-4 w-full h-full flex flex-col justify-center items-center">
                    <h3 className="text-lg font-medium mb-6 text-white">
                      Incoming call from {selectedUser.username}
                    </h3>
                    <div className="flex justify-center gap-4">
                      <Button
                        className="w-18 h-18 sm:w-16 sm:h-16 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
                        onClick={acceptCall}
                      >
                        <Phone size={24} className="text-white" />
                      </Button>
                      <Button
                        className="w-18 h-18 sm:w-16 sm:h-16 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
                        onClick={rejectCall}
                      >
                        <PhoneOff size={24} className="text-white" />
                      </Button>
                    </div>
                  </div>
                )}

                {callStatusRef.current === 'calling' && (
                  <div className="text-center p-4 w-full h-full flex flex-col justify-center items-center">
                    <h3 className="text-lg font-medium mb-6 text-white">
                      Calling {selectedUser.username}...
                    </h3>
                    <Button
                      className="w-18 h-18 sm:w-16 sm:h-16 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
                      onClick={endCall}
                    >
                      <PhoneOff size={24} className="text-white" />
                    </Button>
                  </div>
                )}

                {callStatusRef.current === 'idle' && (
                  <div className="text-center w-full h-full flex flex-col justify-center items-center p-4">
                    <div className="w-24 h-24 rounded-full bg-[#242424] mx-auto flex items-center justify-center mb-4">
                      <User size={40} className="text-gray-600" />
                    </div>
                    <h3 className="text-white font-medium mb-4">{selectedUser.username}</h3>
                    <Button
                      className="px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-full flex items-center justify-center mx-auto"
                      onClick={startCall}
                    >
                      <Phone size={16} className="mr-2" />
                      Start Video Call
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Video Call Modal */}
      {selectedUser && isMobile && isMobileModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
          <div className="bg-[#1a1a1a] text-white rounded-t-2xl flex flex-col h-full">
            {/* Modal Header */}
            <div className="p-4 bg-[#242424] text-white rounded-t-2xl">
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
                <Button
                  className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
                  onClick={closeModal}
                >
                  &times;
                </Button>
              </div>
              <div className="text-sm text-gray-400 mt-1">
                {selectedUser.username}
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 flex flex-col items-center justify-center p-4">
              {callStatusRef.current === 'connected' && (
                <div className="w-full h-full flex flex-col">
                  {/* Video elements */}
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

                    {/* Local video */}
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

                  {/* Call controls */}
                  <div className="flex justify-center gap-4">
                    <Button
                      className="w-18 h-18 sm:w-14 sm:h-14 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
                      onClick={toggleAudio}
                    >
                      {isAudioEnabledRef.current ? (
                        <Mic size={20} className="text-white" />
                      ) : (
                        <MicOff size={20} className="text-white" />
                      )}
                    </Button>
                    <Button
                      className="w-18 h-18 sm:w-14 sm:h-14 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
                      onClick={toggleVideo}
                    >
                      {isVideoEnabledRef.current ? (
                        <VideoIcon size={20} className="text-white" />
                      ) : (
                        <VideoOff size={20} className="text-white" />
                      )}
                    </Button>
                    <Button
                      className="w-18 h-18 sm:w-14 sm:h-14 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
                      onClick={endCall}
                    >
                      <PhoneOff size={20} className="text-white" />
                    </Button>
                  </div>
                </div>
              )}

              {callStatusRef.current === 'incoming' && (
                <div className="text-center p-4 w-full h-full flex flex-col justify-center items-center">
                  <h3 className="text-lg font-medium mb-6 text-white">
                    Incoming call from {selectedUser.username}
                  </h3>
                  <div className="flex justify-center gap-4">
                    <Button
                      className="w-18 h-18 sm:w-16 sm:h-16 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
                      onClick={acceptCall}
                    >
                      <Phone size={24} className="text-white" />
                    </Button>
                    <Button
                      className="w-18 h-18 sm:w-16 sm:h-16 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
                      onClick={rejectCall}
                    >
                      <PhoneOff size={24} className="text-white" />
                    </Button>
                  </div>
                </div>
              )}

              {callStatusRef.current === 'calling' && (
                <div className="text-center p-4 w-full h-full flex flex-col justify-center items-center">
                  <h3 className="text-lg font-medium mb-6 text-white">
                    Calling {selectedUser.username}...
                  </h3>
                  <Button
                    className="w-18 h-18 sm:w-16 sm:h-16 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
                    onClick={endCall}
                  >
                    <PhoneOff size={24} className="text-white" />
                  </Button>
                </div>
              )}

              {callStatusRef.current === 'idle' && (
                <div className="text-center w-full h-full flex flex-col justify-center items-center p-4">
                  <div className="w-24 h-24 rounded-full bg-[#242424] mx-auto flex items-center justify-center mb-4">
                    <User size={40} className="text-gray-600" />
                  </div>
                  <h3 className="text-white font-medium mb-4">{selectedUser.username}</h3>
                  <Button
                    className="px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-full flex items-center justify-center mx-auto"
                    onClick={startCall}
                  >
                    <Phone size={16} className="mr-2" />
                    Start Video Call
                  </Button>
                </div>
              )}
            </div>

            {/* Pull handle */}
            <div className="mx-auto h-1 w-16 bg-gray-600 rounded-full mb-2"></div>
          </div>
        </div>
      )}

      {/* Mobile Call Controls */}
      {(callStatusRef.current === 'incoming') && (
        <div className="fixed bottom-24 right-4 sm:hidden z-50 animate-fade-in">
          <div className="bg-[#1a1a1a] rounded-2xl shadow-xl p-3 flex items-center space-x-3 border border-[#646cff] animate-pulse">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-[#646cff] opacity-50 animate-ping"></div>
              <Button
                className="w-12 h-12 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white flex items-center justify-center shadow-lg transition-all relative z-10"
                onClick={() => {
                  if (!isMobileModalOpen) setIsMobileModalOpen(true);
                }}
              >
                <Phone size={20} className="text-white" />
              </Button>
            </div>

            <div className="text-left">
              <p className="text-sm font-semibold text-white">{selectedUser?.username}</p>
              <p className="text-xs text-gray-300 animate-pulse">Incoming Call...</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SocketChatApp;