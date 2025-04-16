
import React from 'react';
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { MessageSquare, Shield, Users, Globe, Lock } from "lucide-react";

interface JoinChatFormProps {
  username: string;
  setUsername: (username: string) => void;
  handleJoinChat: () => void;
  onlineUsers: number;
}

const JoinChatForm = ({ username, setUsername, handleJoinChat, onlineUsers }: JoinChatFormProps) => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-b from-gray-900 to-black">
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        {/* Left side - Features */}
        <div className="space-y-8 p-6 hidden lg:block">
          <h2 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">
            Welcome to Anonymous Chat
          </h2>
          <div className="space-y-6">
            <FeatureCard
              icon={<Shield className="w-6 h-6 text-purple-400" />}
              title="Anonymous & Secure"
              description="Chat freely without sharing personal information"
            />
            <FeatureCard
              icon={<Users className="w-6 h-6 text-pink-400" />}
              title="Global Community"
              description="Connect with people from around the world"
            />
            <FeatureCard
              icon={<MessageSquare className="w-6 h-6 text-blue-400" />}
              title="Real-time Chat"
              description="Instant messaging with zero lag"
            />
          </div>
        </div>

        {/* Right side - Join Form */}
        <Card className="w-full max-w-md mx-auto bg-gray-900/50 border-gray-800">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-center">Join the Conversation</CardTitle>
            <CardDescription className="text-center text-gray-400">
              Enter a username to start chatting anonymously
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="relative">
                <Input
                  type="text"
                  placeholder="Choose your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') handleJoinChat();
                  }}
                  className="bg-gray-800/50 border-gray-700 focus:border-purple-500 pl-10"
                />
                <Users className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              </div>

              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Lock className="w-4 h-4" />
                <span>Your privacy is guaranteed</span>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button 
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
              onClick={handleJoinChat}
            >
              Join Chat
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* Bottom section - Online count */}
      <div className="mt-8 flex items-center gap-2 text-gray-400">
        <Globe className="w-4 h-4 animate-pulse" />
        <span>{onlineUsers} users online now</span>
      </div>
    </div>
  );
};

const FeatureCard = ({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) => (
  <div className="flex items-start space-x-4 p-4 rounded-lg bg-gray-800/30 hover:bg-gray-800/50 transition-colors">
    <div>{icon}</div>
    <div>
      <h3 className="font-semibold text-gray-200">{title}</h3>
      <p className="text-sm text-gray-400">{description}</p>
    </div>
  </div>
);

export default JoinChatForm;
