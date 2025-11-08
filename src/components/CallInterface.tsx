import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Lock, Wifi, Monitor, MonitorOff } from 'lucide-react';
import { ConnectionQuality } from '../hooks/useWebRTC';
import { shouldUseSyntheticVideo } from '../utils/syntheticVideoStream';

interface CallInterfaceProps {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  connectionState: RTCPeerConnectionState;
  iceConnectionState: RTCIceConnectionState;
  connectionQuality: ConnectionQuality;
  isScreenSharing: boolean;
  onToggleAudio: () => boolean;
  onToggleVideo: () => boolean;
  onStartScreenShare: () => Promise<boolean>;
  onStopScreenShare: () => void;
  onEndCall: () => void;
}

export const CallInterface = ({
  localStream,
  remoteStream,
  connectionState,
  iceConnectionState,
  connectionQuality,
  isScreenSharing,
  onToggleAudio,
  onToggleVideo,
  onStartScreenShare,
  onStopScreenShare,
  onEndCall,
}: CallInterfaceProps) => {
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [showEndCallConfirm, setShowEndCallConfirm] = useState(false);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();

  // Attach local stream to video element with ENHANCED playback reliability
  useEffect(() => {
    const videoElement = localVideoRef.current;
    if (!videoElement || !localStream) {
      console.log('[CallInterface] Skipping local attach - element or stream missing', {
        hasElement: !!videoElement,
        hasStream: !!localStream,
      });
      return;
    }

    console.log('[CallInterface] === ATTACHING LOCAL VIDEO ===');
    console.log('[CallInterface] Stream state:', {
      id: localStream.id,
      active: localStream.active,
      videoTracks: localStream.getVideoTracks().map(t => ({
        id: t.id,
        label: t.label,
        enabled: t.enabled,
        readyState: t.readyState,
        muted: t.muted,
      })),
    });

    // CRITICAL FIX: Explicitly enable all video tracks before attaching
    const videoTracks = localStream.getVideoTracks();
    videoTracks.forEach((track, idx) => {
      console.log(`[CallInterface] Enabling local video track ${idx}:`, track.label);
      track.enabled = true;
    });

    // Set video element properties for better playback
    videoElement.playsInline = true;
    videoElement.autoplay = true;
    videoElement.muted = true; // Local video should be muted

    // Set srcObject
    videoElement.srcObject = localStream;

    // ENHANCED: Multi-stage playback strategy with better retry logic
    let retryCount = 0;
    const maxRetries = 5;
    const retryDelays = [0, 100, 300, 500, 1000]; // Progressive delays

    const attemptPlay = async () => {
      if (!videoElement || retryCount >= maxRetries) {
        if (retryCount >= maxRetries) {
          console.error('[CallInterface] Max retries reached for local video playback');
        }
        return;
      }

      try {
        console.log(`[CallInterface] Attempting local video play (attempt ${retryCount + 1}/${maxRetries})`);
        await videoElement.play();
        console.log('[CallInterface] Local video playing successfully');
      } catch (error) {
        console.warn(`[CallInterface] Play attempt ${retryCount + 1} failed:`, error);
        retryCount++;

        if (retryCount < maxRetries) {
          const delay = retryDelays[retryCount - 1] || 1000;
          console.log(`[CallInterface] Retrying in ${delay}ms...`);
          setTimeout(attemptPlay, delay);
        }
      }
    };

    // ENHANCED: Wait for metadata with timeout protection
    const handleMetadataLoaded = () => {
      console.log('[CallInterface] Local video metadata loaded');
      console.log('[CallInterface] Video dimensions:', videoElement.videoWidth, 'x', videoElement.videoHeight);
      attemptPlay();
    };

    videoElement.addEventListener('loadedmetadata', handleMetadataLoaded);

    // Handle video errors
    const handleError = (e: Event) => {
      console.error('[CallInterface] Local video error:', e);
      // Attempt recovery
      setTimeout(() => {
        if (videoElement.srcObject === localStream) {
          attemptPlay();
        }
      }, 500);
    };

    videoElement.addEventListener('error', handleError);

    // Try immediate play if metadata already loaded
    if (videoElement.readyState >= videoElement.HAVE_METADATA) {
      console.log('[CallInterface] Metadata already loaded, playing immediately');
      handleMetadataLoaded();
    } else {
      // Fallback: force play after short delay even if metadata not loaded
      setTimeout(() => {
        if (videoElement.readyState < videoElement.HAVE_METADATA) {
          console.log('[CallInterface] Forcing play attempt without metadata');
          attemptPlay();
        }
      }, 500);
    }

    console.log('[CallInterface] Local video setup complete');

    return () => {
      console.log('[CallInterface] Cleaning up local video');
      videoElement.removeEventListener('loadedmetadata', handleMetadataLoaded);
      videoElement.removeEventListener('error', handleError);
      if (videoElement) {
        videoElement.srcObject = null;
      }
    };
  }, [localStream]);

  // Attach remote stream to video element with ENHANCED playback reliability
  useEffect(() => {
    const videoElement = remoteVideoRef.current;
    if (!videoElement || !remoteStream) {
      console.log('[CallInterface] Skipping remote attach - element or stream missing', {
        hasElement: !!videoElement,
        hasStream: !!remoteStream,
      });
      return;
    }

    console.log('[CallInterface] === ATTACHING REMOTE VIDEO ===');
    console.log('[CallInterface] Remote stream state:', {
      id: remoteStream.id,
      active: remoteStream.active,
      videoTracks: remoteStream.getVideoTracks().map(t => ({
        id: t.id,
        label: t.label,
        enabled: t.enabled,
        readyState: t.readyState,
      })),
    });

    // CRITICAL FIX: Verify remote tracks are enabled
    const videoTracks = remoteStream.getVideoTracks();
    videoTracks.forEach((track, idx) => {
      console.log(`[CallInterface] Remote video track ${idx} state:`, {
        enabled: track.enabled,
        readyState: track.readyState,
        muted: track.muted,
      });
    });

    // Set video element properties for better playback
    videoElement.playsInline = true;
    videoElement.autoplay = true;
    videoElement.muted = false; // Remote video should have audio

    // Set srcObject
    videoElement.srcObject = remoteStream;

    // ENHANCED: Multi-stage playback strategy with better retry logic
    let retryCount = 0;
    const maxRetries = 5;
    const retryDelays = [0, 100, 300, 500, 1000]; // Progressive delays

    const attemptPlay = async () => {
      if (!videoElement || retryCount >= maxRetries) {
        if (retryCount >= maxRetries) {
          console.error('[CallInterface] Max retries reached for remote video playback');
        }
        return;
      }

      try {
        console.log(`[CallInterface] Attempting remote video play (attempt ${retryCount + 1}/${maxRetries})`);
        await videoElement.play();
        console.log('[CallInterface] Remote video playing successfully');
      } catch (error) {
        console.warn(`[CallInterface] Remote play attempt ${retryCount + 1} failed:`, error);
        retryCount++;

        if (retryCount < maxRetries) {
          const delay = retryDelays[retryCount - 1] || 1000;
          console.log(`[CallInterface] Retrying remote video in ${delay}ms...`);
          setTimeout(attemptPlay, delay);
        }
      }
    };

    // ENHANCED: Wait for metadata with timeout protection
    const handleMetadataLoaded = () => {
      console.log('[CallInterface] Remote video metadata loaded');
      console.log('[CallInterface] Remote video dimensions:', videoElement.videoWidth, 'x', videoElement.videoHeight);
      attemptPlay();
    };

    // Monitor for track additions (for late-arriving tracks)
    const handleTrackAdded = () => {
      console.log('[CallInterface] New track added to remote stream, reattaching...');
      if (videoElement.srcObject !== remoteStream) {
        videoElement.srcObject = remoteStream;
      }
    };

    remoteStream.addEventListener('addtrack', handleTrackAdded);
    videoElement.addEventListener('loadedmetadata', handleMetadataLoaded);

    // Handle video errors
    const handleError = (e: Event) => {
      console.error('[CallInterface] Remote video error:', e);
      // Attempt recovery
      setTimeout(() => {
        if (videoElement.srcObject === remoteStream) {
          attemptPlay();
        }
      }, 500);
    };

    videoElement.addEventListener('error', handleError);

    // Try immediate play if metadata already loaded
    if (videoElement.readyState >= videoElement.HAVE_METADATA) {
      console.log('[CallInterface] Remote metadata already loaded, playing immediately');
      handleMetadataLoaded();
    } else {
      // Fallback: force play after short delay even if metadata not loaded
      setTimeout(() => {
        if (videoElement.readyState < videoElement.HAVE_METADATA) {
          console.log('[CallInterface] Forcing remote play attempt without metadata');
          attemptPlay();
        }
      }, 500);
    }

    console.log('[CallInterface] Remote video setup complete');

    return () => {
      console.log('[CallInterface] Cleaning up remote video');
      remoteStream.removeEventListener('addtrack', handleTrackAdded);
      videoElement.removeEventListener('loadedmetadata', handleMetadataLoaded);
      videoElement.removeEventListener('error', handleError);
      if (videoElement) {
        videoElement.srcObject = null;
      }
    };
  }, [remoteStream]);

  // Monitor and recover from track ended events
  useEffect(() => {
    if (!localStream) return;
    
    const handleTrackEnded = (event: Event) => {
      const track = event.target as MediaStreamTrack;
      console.error('[CallInterface] Local track ended unexpectedly:', track.kind);
      // Could trigger a re-request of user media here
    };
    
    localStream.getTracks().forEach(track => {
      track.addEventListener('ended', handleTrackEnded);
    });
    
    return () => {
      localStream?.getTracks().forEach(track => {
        track.removeEventListener('ended', handleTrackEnded);
      });
    };
  }, [localStream]);

  // Auto-hide controls after inactivity
  useEffect(() => {
    const resetTimeout = () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      setShowControls(true);
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    };

    const handleActivity = () => resetTimeout();
    
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('touchstart', handleActivity);
    window.addEventListener('click', handleActivity);

    resetTimeout();

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      window.removeEventListener('click', handleActivity);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

  const handleToggleAudio = () => {
    const enabled = onToggleAudio();
    setIsAudioEnabled(enabled);
  };

  const handleToggleVideo = () => {
    const enabled = onToggleVideo();
    setIsVideoEnabled(enabled);
  };

  const handleScreenShare = async () => {
    if (isScreenSharing) {
      onStopScreenShare();
    } else {
      await onStartScreenShare();
    }
  };

  const handleEndCall = () => {
    setShowEndCallConfirm(true);
  };

  const confirmEndCall = () => {
    onEndCall();
  };

  // Get connection quality indicator
  const getQualityIndicator = () => {
    const quality = connectionQuality.quality;
    
    if (quality === 'excellent') {
      return { color: 'bg-success', text: `Excellent (${Math.round(connectionQuality.bitrate)} kbps)`, icon: Wifi };
    } else if (quality === 'good') {
      return { color: 'bg-success', text: `Good (${Math.round(connectionQuality.bitrate)} kbps)`, icon: Wifi };
    } else if (quality === 'fair') {
      return { color: 'bg-warning', text: `Fair (${Math.round(connectionQuality.bitrate)} kbps)`, icon: Wifi };
    } else if (quality === 'poor') {
      return { color: 'bg-error', text: `Poor (${Math.round(connectionQuality.bitrate)} kbps)`, icon: Wifi };
    } else {
      return { color: 'bg-neutral-500', text: 'Connecting...', icon: Wifi };
    }
  };

  const quality = getQualityIndicator();
  const QualityIcon = quality.icon;

  return (
    <div className="relative w-full h-screen bg-neutral-900 overflow-hidden">
      {/* Remote Video (Full Screen) */}
      <div className="absolute inset-0">
        {remoteStream ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-neutral-800">
            <div className="text-center">
              <div className="w-24 h-24 bg-neutral-700 rounded-full flex items-center justify-center mb-4 mx-auto">
                <Video className="w-12 h-12 text-neutral-500" />
              </div>
              <p className="text-body text-neutral-400">Waiting for participant...</p>
            </div>
          </div>
        )}
      </div>

      {/* Local Video (Picture-in-Picture) */}
      <div className="absolute top-4 right-4 w-[120px] h-[160px] tablet:w-[160px] tablet:h-[200px] bg-neutral-900 rounded-md overflow-hidden shadow-modal border-2 border-white">
        {localStream ? (
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover mirror"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-neutral-800">
            <VideoOff className="w-8 h-8 text-neutral-500" />
          </div>
        )}
      </div>

      {/* Privacy Indicator (Top Left) */}
      <div className="absolute top-4 left-4 flex flex-col gap-2">
        <div className="bg-success/90 backdrop-blur-sm px-3 py-2 rounded-sm flex items-center gap-2">
          <Lock className="w-4 h-4 text-white" />
          <span className="text-small text-white font-medium">Encrypted</span>
        </div>
        
        {/* Test Mode Indicator */}
        {shouldUseSyntheticVideo() && (
          <div className="bg-warning/90 backdrop-blur-sm px-3 py-2 rounded-sm flex items-center gap-2">
            <Video className="w-4 h-4 text-white" />
            <span className="text-small text-white font-medium">TEST MODE</span>
          </div>
        )}
      </div>

      {/* Connection Quality Indicator (Top Center) */}
      {(iceConnectionState === 'checking' || connectionState !== 'connected') && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2">
          <div className={`${quality.color}/90 backdrop-blur-sm px-3 py-2 rounded-md flex items-center gap-2`}>
            <QualityIcon className="w-4 h-4 text-white" />
            <span className="text-small text-white font-medium">{quality.text}</span>
          </div>
        </div>
      )}

      {/* Debug Info Panel (Bottom Left) */}
      <div className="absolute bottom-20 left-4 bg-black/90 backdrop-blur-sm px-3 py-2 rounded-md text-xs text-white font-mono max-w-xs">
        <div className="mb-1">
          <span className="text-neutral-400">Local Stream: </span>
          <span className={localStream ? 'text-green-400' : 'text-red-400'}>
            {localStream ? `\u2713 Active (V:${localStream.getVideoTracks().length} A:${localStream.getAudioTracks().length})` : '\u2717 None'}
          </span>
        </div>
        {localStream && (
          <div className="mb-1 text-neutral-300 text-xxs">
            <span className="text-neutral-500">Local Video: </span>
            {localVideoRef.current ? (
              `${localVideoRef.current.videoWidth}x${localVideoRef.current.videoHeight} ${localVideoRef.current.paused ? '[PAUSED]' : '[PLAYING]'}`
            ) : 'No element'}
          </div>
        )}
        <div className="mb-1">
          <span className="text-neutral-400">Remote Stream: </span>
          <span className={remoteStream ? 'text-green-400' : 'text-red-400'}>
            {remoteStream ? `\u2713 Active (V:${remoteStream.getVideoTracks().length} A:${remoteStream.getAudioTracks().length})` : '\u2717 None'}
          </span>
        </div>
        {remoteStream && (
          <div className="mb-1 text-neutral-300 text-xxs">
            <span className="text-neutral-500">Remote Video: </span>
            {remoteVideoRef.current ? (
              `${remoteVideoRef.current.videoWidth}x${remoteVideoRef.current.videoHeight} ${remoteVideoRef.current.paused ? '[PAUSED]' : '[PLAYING]'}`
            ) : 'No element'}
          </div>
        )}
        <div className="mb-1">
          <span className="text-neutral-400">Connection: </span>
          <span className="text-blue-400">{connectionState}</span>
        </div>
        <div>
          <span className="text-neutral-400">ICE: </span>
          <span className="text-blue-400">{iceConnectionState}</span>
        </div>
      </div>

      {/* Control Bar (Bottom) - ALWAYS VISIBLE DURING CONNECTION */}
      <div
        className={`absolute bottom-0 left-0 right-0 transition-opacity duration-base ${
          (showControls || connectionState !== 'connected') ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="bg-white/95 backdrop-blur-md h-20 flex items-center justify-center gap-6 px-4">
          {/* Microphone Toggle */}
          <button
            onClick={handleToggleAudio}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-fast
              ${isAudioEnabled 
                ? 'bg-neutral-100 hover:bg-neutral-200' 
                : 'bg-error hover:bg-error/90'
              }`}
          >
            {isAudioEnabled ? (
              <Mic className="w-6 h-6 text-neutral-900" />
            ) : (
              <MicOff className="w-6 h-6 text-white" />
            )}
          </button>

          {/* Video Toggle */}
          <button
            onClick={handleToggleVideo}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-fast
              ${isVideoEnabled 
                ? 'bg-neutral-100 hover:bg-neutral-200' 
                : 'bg-error hover:bg-error/90'
              }`}
          >
            {isVideoEnabled ? (
              <Video className="w-6 h-6 text-neutral-900" />
            ) : (
              <VideoOff className="w-6 h-6 text-white" />
            )}
          </button>

          {/* Screen Share Toggle */}
          <button
            onClick={handleScreenShare}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-fast
              ${isScreenSharing 
                ? 'bg-primary hover:bg-primary/90' 
                : 'bg-neutral-100 hover:bg-neutral-200'
              }`}
          >
            {isScreenSharing ? (
              <MonitorOff className="w-6 h-6 text-white" />
            ) : (
              <Monitor className="w-6 h-6 text-neutral-900" />
            )}
          </button>

          {/* End Call */}
          <button
            onClick={handleEndCall}
            className="w-14 h-14 rounded-full bg-error hover:bg-error/90 flex items-center justify-center transition-all duration-fast"
          >
            <PhoneOff className="w-6 h-6 text-white" />
          </button>
        </div>
      </div>

      {/* End Call Confirmation Modal */}
      {showEndCallConfirm && (
        <div className="absolute inset-0 bg-overlay flex items-center justify-center p-4 z-50">
          <div className="bg-surface rounded-md shadow-modal p-8 max-w-md w-full">
            <h3 className="text-subtitle text-neutral-900 font-semibold mb-4">
              End Consultation?
            </h3>
            <p className="text-body text-neutral-700 mb-8">
              Are you sure you want to end this consultation? This will disconnect both participants.
            </p>
            <div className="flex gap-4">
              <button
                onClick={confirmEndCall}
                className="flex-1 h-12 bg-error text-white rounded-sm font-semibold text-body
                  hover:bg-error/90 transition-colors duration-fast"
              >
                End Call
              </button>
              <button
                onClick={() => setShowEndCallConfirm(false)}
                className="flex-1 h-12 bg-neutral-100 border-2 border-neutral-200 text-neutral-900 rounded-sm font-semibold text-body
                  hover:bg-neutral-50 transition-colors duration-fast"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .mirror {
          transform: scaleX(-1);
        }
      `}</style>
    </div>
  );
};
