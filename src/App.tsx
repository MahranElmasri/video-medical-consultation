import { useState, useEffect } from 'react';
import { LandingPage } from './components/LandingPage';
import { WaitingRoom } from './components/WaitingRoom';
import { CallInterface } from './components/CallInterface';
import { useWebRTC } from './hooks/useWebRTC';
import { supabase } from './lib/supabase';
import './index.css';

type AppState = 'landing' | 'waiting' | 'call';

interface RoomData {
  roomId: string;
  token: string;
  expiresAt: string;
  roomUrl: string;
}

function App() {
  const [appState, setAppState] = useState<AppState>('landing');
  const [roomData, setRoomData] = useState<RoomData | null>(null);
  const [userId] = useState(() => crypto.randomUUID());
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const {
    localStream,
    remoteStream,
    connectionState,
    iceConnectionState,
    connectionQuality,
    isScreenSharing,
    startLocalStream,
    createOffer,
    toggleAudio,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
    cleanup,
  } = useWebRTC(roomData?.roomId || '', userId);

  // Handle room creation
  const handleStartConsultation = async () => {
    try {
      const response = await supabase.functions.invoke('create-consultation-room');
      
      if (response.error) {
        throw new Error(response.error.message || 'Failed to create room');
      }

      const data = response.data?.data;
      if (!data) {
        throw new Error('Invalid response from server');
      }

      // Construct full room URL
      const fullRoomUrl = `${window.location.origin}/call/${data.roomId}`;
      
      setRoomData({
        roomId: data.roomId,
        token: data.token,
        expiresAt: data.expiresAt,
        roomUrl: fullRoomUrl,
      });

      setAppState('waiting');
    } catch (error) {
      console.error('Failed to create consultation room:', error);
      alert('Failed to create consultation room. Please try again.');
    }
  };

  // Handle joining call
  const handleJoinCall = async () => {
    try {
      setPermissionError(null);

      // Request camera and microphone permissions
      await startLocalStream();

      // Move to call state
      setAppState('call');

      // The signaling channel will handle offer/answer exchange automatically
      // via the "ready" signal mechanism - no need to manually call createOffer
    } catch (error) {
      console.error('Failed to access media devices:', error);
      
      // Provide user-friendly error message
      if (error instanceof DOMException) {
        if (error.name === 'NotAllowedError') {
          setPermissionError(
            'Camera and microphone access denied. Please enable permissions in your browser settings and try again.'
          );
        } else if (error.name === 'NotFoundError') {
          setPermissionError(
            'No camera or microphone found. Please connect a device and try again.'
          );
        } else {
          setPermissionError(
            'Failed to access camera or microphone. Please check your device and try again.'
          );
        }
      } else {
        setPermissionError('An unexpected error occurred. Please try again.');
      }
    }
  };

  // Handle cancel
  const handleCancel = () => {
    setRoomData(null);
    setAppState('landing');
  };

  // Handle end call
  const handleEndCall = () => {
    cleanup();
    setRoomData(null);
    setAppState('landing');
  };

  // Check for room ID in URL (for patients joining via shared link)
  useEffect(() => {
    const path = window.location.pathname;
    const match = path.match(/\/call\/([a-f0-9-]+)/);
    
    if (match) {
      const roomId = match[1];
      const roomUrl = window.location.href;
      
      setRoomData({
        roomId,
        token: '', // Patient doesn't need token for joining
        expiresAt: '',
        roomUrl,
      });
      
      // Automatically join the call - move to waiting room
      setAppState('waiting');
    }
  }, []); // Empty dependency array - only run once on mount

  // Enforce HTTPS for WebRTC
  useEffect(() => {
    if (window.location.protocol === 'http:' && window.location.hostname !== 'localhost') {
      alert('This application requires HTTPS for security and WebRTC functionality.');
    }
  }, []);

  return (
    <>
      {appState === 'landing' && (
        <LandingPage onStartConsultation={handleStartConsultation} />
      )}

      {appState === 'waiting' && roomData && (
        <WaitingRoom
          roomId={roomData.roomId}
          roomUrl={roomData.roomUrl}
          onCancel={handleCancel}
          onJoinCall={handleJoinCall}
        />
      )}

      {appState === 'call' && (
        <CallInterface
          localStream={localStream}
          remoteStream={remoteStream}
          connectionState={connectionState}
          iceConnectionState={iceConnectionState}
          connectionQuality={connectionQuality}
          isScreenSharing={isScreenSharing}
          onToggleAudio={toggleAudio}
          onToggleVideo={toggleVideo}
          onStartScreenShare={startScreenShare}
          onStopScreenShare={stopScreenShare}
          onEndCall={handleEndCall}
        />
      )}

      {/* Permission Error Modal */}
      {permissionError && (
        <div className="fixed inset-0 bg-overlay flex items-center justify-center p-4 z-50">
          <div className="bg-surface rounded-md shadow-modal p-8 max-w-md w-full">
            <h3 className="text-subtitle text-neutral-900 font-semibold mb-4">
              Camera/Microphone Access Required
            </h3>
            <p className="text-body text-neutral-700 mb-8">
              {permissionError}
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => {
                  setPermissionError(null);
                  handleJoinCall(); // Retry joining
                }}
                className="flex-1 h-12 bg-primary-500 text-white rounded-sm font-semibold text-body
                  hover:bg-primary-600 transition-colors duration-fast"
              >
                Retry
              </button>
              <button
                onClick={() => {
                  setPermissionError(null);
                  setAppState('waiting');
                }}
                className="flex-1 h-12 bg-neutral-100 border-2 border-neutral-200 text-neutral-900 rounded-sm font-semibold text-body
                  hover:bg-neutral-50 transition-colors duration-fast"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default App;
