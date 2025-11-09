import { useState, useEffect } from 'react';
import { LandingPage } from './components/LandingPage';
import { WaitingRoom } from './components/WaitingRoom';
import { CallInterface } from './components/CallInterface';
import { useWebRTC } from './hooks/useWebRTC';
import { supabase } from './lib/supabase';
import { detectBrowser, getBrowserInstructions } from './utils/permissionCheck';
import { getUserLocation } from './utils/geolocation';
import { getBrowserInfo, getMobilePermissionHelp } from './utils/browserCompatibility';
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
    remoteLocation,
    drawingMessages,
    startLocalStream,
    createOffer,
    toggleAudio,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
    sendLocation,
    sendDrawingMessage,
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

      // Get and send patient location (if patient is joining)
      // Patients are identified by empty token
      if (!roomData?.token) {
        console.log('[App] Patient joining - getting location...');
        try {
          const location = await getUserLocation();
          console.log('[App] Patient location obtained:', location);

          // Send location to doctor after a short delay to ensure channel is ready
          setTimeout(() => {
            sendLocation(location);
          }, 1000);
        } catch (error) {
          console.warn('[App] Failed to get patient location:', error);
          // Continue anyway - location is optional
        }
      }

      // The signaling channel will handle offer/answer exchange automatically
      // via the "ready" signal mechanism - no need to manually call createOffer
    } catch (error) {
      console.error('Failed to access media devices:', error);

      // Get mobile-specific error messages
      const browserInfo = getBrowserInfo();
      let errorMessage = '';

      if (error instanceof Error) {
        // Use the detailed error message from our mobile compatibility layer
        errorMessage = error.message;
      } else if (error instanceof DOMException) {
        if (error.name === 'NotAllowedError') {
          errorMessage = browserInfo.isMobile
            ? 'Camera and microphone access denied. Please close any overlays (chat bubbles) from other apps, then enable permissions in your browser settings.'
            : 'Camera and microphone access denied. Please enable permissions in your browser settings and try again.';
        } else if (error.name === 'NotFoundError') {
          errorMessage = 'No camera or microphone found. Please connect a device and try again.';
        } else if (error.name === 'NotReadableError') {
          errorMessage = 'Camera or microphone is already in use by another app. Please close other apps and try again.';
        } else {
          errorMessage = 'Failed to access camera or microphone. Please check your device and try again.';
        }
      } else {
        errorMessage = 'An unexpected error occurred. Please try again.';
      }

      setPermissionError(errorMessage);
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
          isDoctor={!!roomData.token}
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
          remoteLocation={remoteLocation}
          isDoctor={!!roomData?.token}
          drawingMessages={drawingMessages}
          onToggleAudio={toggleAudio}
          onToggleVideo={toggleVideo}
          onStartScreenShare={startScreenShare}
          onStopScreenShare={stopScreenShare}
          onSendDrawingMessage={sendDrawingMessage}
          onEndCall={handleEndCall}
        />
      )}

      {/* Permission Error Modal */}
      {permissionError && (() => {
        const browserInfo = getBrowserInfo();
        const mobileHelp = getMobilePermissionHelp();
        const instructions = browserInfo.isMobile
          ? mobileHelp.steps
          : getBrowserInstructions(detectBrowser());
        const helpTitle = browserInfo.isMobile ? mobileHelp.title : `How to enable permissions in ${detectBrowser()}`;

        return (
          <div className="fixed inset-0 bg-overlay flex items-center justify-center p-4 z-50">
            <div className="bg-surface rounded-md shadow-modal p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
              <h3 className="text-subtitle text-neutral-900 font-semibold mb-4">
                Camera/Microphone Access Required
              </h3>
              <p className="text-body text-neutral-700 mb-4">
                {permissionError}
              </p>

              {/* Browser/Mobile-specific instructions */}
              <div className="bg-primary-50 border border-primary-100 rounded-sm p-4 mb-4">
                <p className="text-small font-semibold text-neutral-900 mb-2">
                  {helpTitle}
                </p>
                <ol className="text-small text-neutral-700 space-y-2">
                  {instructions.map((instruction, index) => (
                    <li key={index} className="flex gap-2">
                      <span className="font-semibold">{index + 1}.</span>
                      <span>{instruction}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {browserInfo.isMobile && (
                <div className="bg-warning/10 border border-warning rounded-sm p-3 mb-4">
                  <p className="text-xs text-neutral-900 font-semibold mb-1">
                    Common Issue on Mobile:
                  </p>
                  <p className="text-xs text-neutral-700">
                    If you see "This site can't ask for your permission", close any floating chat bubbles
                    (Facebook Messenger, WhatsApp) or overlays from other apps, then try again.
                  </p>
                </div>
              )}

              <div className="bg-neutral-50 border border-neutral-200 rounded-sm p-3 mb-4">
                <p className="text-xs text-neutral-600">
                  <strong>Note:</strong> {browserInfo.isMobile
                    ? 'Make sure you are accessing this page via HTTPS (secure connection) and not in private/incognito mode on some browsers.'
                    : 'If you don\'t see a permission prompt, your browser may have already blocked access. Look for a camera icon with an "X" or slash through it in the address bar.'}
                </p>
              </div>

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
        );
      })()}
    </>
  );
}

export default App;
