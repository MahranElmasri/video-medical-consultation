import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { createSyntheticMediaStream, shouldUseSyntheticVideo } from '../utils/syntheticVideoStream';
import type { LocationInfo } from '../utils/geolocation';
import { requestMediaDevicesMobile, getBrowserInfo } from '../utils/browserCompatibility';

export interface WebRTCMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'ready' | 'leave' | 'location-info';
  data: any;
  from: string;
}

export interface ConnectionQuality {
  bitrate: number;
  packetLoss: number;
  jitter: number;
  rtt: number;
  quality: 'excellent' | 'good' | 'fair' | 'poor' | 'connecting';
}

export const useWebRTC = (roomId: string, userId: string) => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>('new');
  const [iceConnectionState, setIceConnectionState] = useState<RTCIceConnectionState>('new');
  const [connectionQuality, setConnectionQuality] = useState<ConnectionQuality>({
    bitrate: 0,
    packetLoss: 0,
    jitter: 0,
    rtt: 0,
    quality: 'connecting',
  });
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [remoteLocation, setRemoteLocation] = useState<LocationInfo | null>(null);

  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const channel = useRef<any>(null);
  const pendingCandidates = useRef<RTCIceCandidate[]>([]);
  const cameraStream = useRef<MediaStream | null>(null);
  const screenStream = useRef<MediaStream | null>(null);
  const statsInterval = useRef<NodeJS.Timeout | null>(null);
  const isInitialized = useRef<boolean>(false);
  const makingOffer = useRef<boolean>(false);
  const ignoreOffer = useRef<boolean>(false);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const receivedTracks = useRef<Set<string>>(new Set());
  const reconnectAttempts = useRef<number>(0);
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);
  const maxReconnectAttempts = 3;
  const remotePeerId = useRef<string | null>(null);
  const disconnectTimeout = useRef<NodeJS.Timeout | null>(null);

  // Initialize peer connection with STUN/TURN servers for reliable NAT traversal
  const createPeerConnection = useCallback((): RTCPeerConnection => {
    console.log('[useWebRTC] Creating new peer connection');

    const pc = new RTCPeerConnection({
      iceServers: [
        // STUN servers for NAT discovery
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
        // Public TURN servers for relay (fallback for restrictive NATs)
        // NOTE: For production, replace these with your own TURN server credentials
        {
          urls: [
            'turn:openrelay.metered.ca:80',
            'turn:openrelay.metered.ca:443',
            'turn:openrelay.metered.ca:443?transport=tcp',
          ],
          username: 'openrelayproject',
          credential: 'openrelayproject',
        },
        {
          urls: [
            'turns:openrelay.metered.ca:443',
            'turns:openrelay.metered.ca:443?transport=tcp',
          ],
          username: 'openrelayproject',
          credential: 'openrelayproject',
        },
      ],
      // ICE transport policy: 'all' tries direct, then relay
      iceTransportPolicy: 'all',
      // Bundle policy for better performance
      bundlePolicy: 'max-bundle',
      // RTP/RTCP multiplexing
      rtcpMuxPolicy: 'require',
    });

    // Monitor connection states with ENHANCED reconnection logic
    pc.onconnectionstatechange = () => {
      console.log('[useWebRTC] Connection state changed:', pc.connectionState);
      setConnectionState(pc.connectionState);

      // Handle successful connection
      if (pc.connectionState === 'connected') {
        console.log('[useWebRTC] Connection successful! Resetting reconnect counter');
        reconnectAttempts.current = 0;
        if (reconnectTimeout.current) {
          clearTimeout(reconnectTimeout.current);
          reconnectTimeout.current = null;
        }
      }

      // Auto-recover from failed connections with retry logic
      if (pc.connectionState === 'failed') {
        console.error('[useWebRTC] Connection failed!');

        if (reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current - 1), 5000);

          console.log(`[useWebRTC] Attempting reconnection ${reconnectAttempts.current}/${maxReconnectAttempts} in ${delay}ms...`);

          reconnectTimeout.current = setTimeout(() => {
            console.log('[useWebRTC] Executing ICE restart...');
            pc.restartIce();

            // Renegotiation after ICE restart will be triggered by the negotiationneeded event
            // No need to manually call createOffer here
          }, delay);
        } else {
          console.error('[useWebRTC] Max reconnection attempts reached. Connection cannot be established.');
        }
      }

      // Handle disconnection state
      if (pc.connectionState === 'disconnected') {
        console.warn('[useWebRTC] Connection disconnected, monitoring for recovery...');

        // Start a timer to attempt reconnection if not recovered
        if (!reconnectTimeout.current) {
          reconnectTimeout.current = setTimeout(() => {
            if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
              console.log('[useWebRTC] Still disconnected after timeout, attempting ICE restart');
              pc.restartIce();
            }
          }, 3000); // Wait 3 seconds before intervening
        }

        // Start a timer to clear remote stream if peer doesn't return
        if (!disconnectTimeout.current) {
          disconnectTimeout.current = setTimeout(() => {
            if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
              console.warn('[useWebRTC] ⚠️ Peer disconnected for too long, clearing remote stream');
              console.warn('[useWebRTC] Waiting for peer to rejoin...');
              setRemoteStream(null);
              remoteStreamRef.current = null;
              receivedTracks.current.clear();
              remotePeerId.current = null; // Allow new peer to connect
            }
          }, 10000); // Clear after 10 seconds of disconnect
        }
      }

      // Clear disconnect timeout when connection is restored
      if (pc.connectionState === 'connected' && disconnectTimeout.current) {
        console.log('[useWebRTC] Connection restored, clearing disconnect timeout');
        clearTimeout(disconnectTimeout.current);
        disconnectTimeout.current = null;
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('[useWebRTC] ICE connection state changed:', pc.iceConnectionState);
      setIceConnectionState(pc.iceConnectionState);

      // Handle ICE connection success
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        console.log('[useWebRTC] ICE connection established successfully');
        reconnectAttempts.current = 0;
      }

      // Handle ICE disconnection with automatic recovery
      if (pc.iceConnectionState === 'disconnected') {
        console.warn('[useWebRTC] ICE disconnected, monitoring for automatic recovery...');
        // ICE will try to reconnect automatically, but we monitor the state
      }

      // Handle ICE failure
      if (pc.iceConnectionState === 'failed') {
        console.error('[useWebRTC] ICE connection failed completely');
        // The connection state handler above will manage reconnection
      }
    };

    // Handle incoming remote tracks - ENHANCED FIX for bidirectional video
    pc.ontrack = (event) => {
      console.log('[useWebRTC] === RECEIVED REMOTE TRACK ===');
      console.log('[useWebRTC] Track details:', {
        kind: event.track.kind,
        label: event.track.label,
        id: event.track.id,
        enabled: event.track.enabled,
        readyState: event.track.readyState,
        muted: event.track.muted,
      });

      // Prevent duplicate track processing
      if (receivedTracks.current.has(event.track.id)) {
        console.log('[useWebRTC] Track already processed, skipping:', event.track.id);
        return;
      }
      receivedTracks.current.add(event.track.id);

      // ENHANCED: Properly handle track aggregation
      if (event.streams && event.streams.length > 0) {
        const stream = event.streams[0];
        console.log('[useWebRTC] Using stream from event.streams[0]:', {
          id: stream.id,
          active: stream.active,
          videoTracks: stream.getVideoTracks().length,
          audioTracks: stream.getAudioTracks().length,
        });

        // Store reference and update state
        remoteStreamRef.current = stream;
        setRemoteStream(stream);
      } else {
        console.log('[useWebRTC] No stream in event, building stream from tracks');

        // Create or update existing remote stream
        if (!remoteStreamRef.current) {
          console.log('[useWebRTC] Creating new MediaStream for remote tracks');
          remoteStreamRef.current = new MediaStream();
        }

        // Add track to the stream if not already present
        const existingTrack = remoteStreamRef.current.getTracks().find(t => t.id === event.track.id);
        if (!existingTrack) {
          console.log('[useWebRTC] Adding track to remote stream:', event.track.kind);
          remoteStreamRef.current.addTrack(event.track);

          // Update state with the accumulated stream
          setRemoteStream(new MediaStream(remoteStreamRef.current.getTracks()));

          console.log('[useWebRTC] Remote stream now has:', {
            videoTracks: remoteStreamRef.current.getVideoTracks().length,
            audioTracks: remoteStreamRef.current.getAudioTracks().length,
          });
        }
      }

      // Monitor track lifecycle
      event.track.onended = () => {
        console.warn('[useWebRTC] Remote track ended:', event.track.kind);
        receivedTracks.current.delete(event.track.id);
      };

      event.track.onmute = () => {
        console.warn('[useWebRTC] Remote track muted:', event.track.kind);
      };

      event.track.onunmute = () => {
        console.log('[useWebRTC] Remote track unmuted:', event.track.kind);
      };
    };

    // Send ICE candidates via Supabase Realtime
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('[useWebRTC] ICE candidate generated:', {
          type: event.candidate.type,
          protocol: event.candidate.protocol,
          address: event.candidate.address,
        });
        
        if (channel.current) {
          console.log('[useWebRTC] Sending ICE candidate via signaling');
          channel.current.send({
            type: 'broadcast',
            event: 'webrtc-signal',
            payload: {
              type: 'ice-candidate',
              data: event.candidate.toJSON(),
              from: userId,
            },
          });
        } else {
          console.warn('[useWebRTC] Channel not ready, cannot send ICE candidate');
        }
      } else {
        console.log('[useWebRTC] ICE candidate gathering complete (null candidate)');
      }
    };

    // Handle negotiation needed - DISABLED to prevent automatic offers
    // We use manual "ready" signal negotiation instead to avoid race conditions
    pc.onnegotiationneeded = async () => {
      console.log('[useWebRTC] Negotiation needed event fired (but automatic offer disabled)');
      // Don't automatically create offers - wait for "ready" signal exchange
    };

    return pc;
  }, [userId, localStream]);

  // Get user media (camera + microphone) - CRITICAL FIX with TEST MODE support
  const startLocalStream = useCallback(async () => {
    try {
      console.log('[useWebRTC] === STARTING LOCAL STREAM ===');
      
      let stream: MediaStream;
      
      // Check if we should use synthetic video for testing
      if (shouldUseSyntheticVideo()) {
        console.log('[useWebRTC] TEST MODE ENABLED - Using synthetic video stream');
        stream = createSyntheticMediaStream(1280, 720);
        console.log('[useWebRTC] Synthetic stream created successfully');
      } else {
        // Normal mode - use real camera with mobile-optimized request
        console.log('[useWebRTC] Requesting user media (mobile-optimized)...');
        stream = await requestMediaDevicesMobile();
        console.log('[useWebRTC] Media stream obtained via mobile-optimized request');
      }

      console.log('[useWebRTC] Media stream obtained successfully!');
      console.log('[useWebRTC] Stream details:', {
        id: stream.id,
        active: stream.active,
        videoTracks: stream.getVideoTracks().length,
        audioTracks: stream.getAudioTracks().length,
      });
      
      // CRITICAL FIX: Explicitly enable all tracks and log their states
      stream.getTracks().forEach((track, index) => {
        // Force enable track
        track.enabled = true;
        
        console.log(`[useWebRTC] Track ${index} ENABLED:`, {
          kind: track.kind,
          label: track.label,
          enabled: track.enabled,
          readyState: track.readyState,
          muted: track.muted,
        });
        
        // Keep tracks alive - prevent them from ending
        track.onended = () => {
          console.error('[useWebRTC] Local track ended unexpectedly:', track.kind);
        };
        
        track.onmute = () => {
          console.warn('[useWebRTC] Local track muted:', track.kind);
        };
        
        track.onunmute = () => {
          console.log('[useWebRTC] Local track unmuted:', track.kind);
        };
      });

      // Store camera stream ref for screen sharing restoration
      cameraStream.current = stream;
      
      // Set local stream state - THIS IS CRITICAL
      setLocalStream(stream);
      
      // Initialize or get peer connection
      if (!peerConnection.current) {
        peerConnection.current = createPeerConnection();
      }
      
      const pc = peerConnection.current;
      
      // Clear existing senders to avoid duplicates
      const existingSenders = pc.getSenders();
      console.log('[useWebRTC] Existing senders:', existingSenders.length);
      
      // Remove old senders if any
      existingSenders.forEach(sender => {
        if (sender.track) {
          pc.removeTrack(sender);
        }
      });
      
      // Add all tracks to peer connection
      stream.getTracks().forEach((track) => {
        console.log('[useWebRTC] Adding track to peer connection:', {
          kind: track.kind,
          label: track.label,
          enabled: track.enabled,
        });
        pc.addTrack(track, stream);
      });
      
      console.log('[useWebRTC] All tracks added. Final senders count:', pc.getSenders().length);
      console.log('[useWebRTC] === LOCAL STREAM SETUP COMPLETE ===');

      // Send "ready" signal now that we have a local stream with tracks
      if (channel.current) {
        console.log('[useWebRTC] Sending ready signal to peer');
        channel.current.send({
          type: 'broadcast',
          event: 'webrtc-signal',
          payload: {
            type: 'ready',
            data: null,
            from: userId,
          },
        });
      }

      return stream;
    } catch (error: any) {
      console.error('[useWebRTC] ERROR accessing media devices:', error);
      throw error;
    }
  }, [createPeerConnection, userId]);

  // Create and send offer - Enhanced with bandwidth constraints and codec preferences
  const createOffer = useCallback(async () => {
    if (!peerConnection.current) {
      console.warn('[useWebRTC] Cannot create offer: no peer connection');
      return;
    }

    const pc = peerConnection.current;

    try {
      console.log('[useWebRTC] Creating offer...');
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });

      // Modify SDP to add bandwidth constraints and codec preferences
      if (offer.sdp) {
        // Add bandwidth constraints (in kbps)
        // b=AS:2000 means 2 Mbps max for video
        // b=TIAS:2000000 means 2 Mbps in bits/sec
        let modifiedSdp = offer.sdp;

        // Add bandwidth limit for video (2 Mbps)
        modifiedSdp = modifiedSdp.replace(
          /(m=video.*\r\n)/g,
          '$1b=AS:2000\r\nb=TIAS:2000000\r\n'
        );

        // Add bandwidth limit for audio (128 kbps)
        modifiedSdp = modifiedSdp.replace(
          /(m=audio.*\r\n)/g,
          '$1b=AS:128\r\nb=TIAS:128000\r\n'
        );

        // Prefer H.264 codec for better compatibility and hardware acceleration
        // Move H.264 to the front of the codec list
        const h264Preference = /m=video (\d+) UDP\/TLS\/RTP\/SAVPF (.+)/;
        const match = modifiedSdp.match(h264Preference);
        if (match) {
          const codecs = match[2].split(' ');
          // Find H.264 codec payload types (usually 96-127)
          const h264Payloads = codecs.filter(codec => {
            const rtpMapPattern = new RegExp(`a=rtpmap:${codec} H264`, 'i');
            return rtpMapPattern.test(modifiedSdp);
          });

          if (h264Payloads.length > 0) {
            // Move H.264 to front
            const otherCodecs = codecs.filter(c => !h264Payloads.includes(c));
            const reorderedCodecs = [...h264Payloads, ...otherCodecs];
            modifiedSdp = modifiedSdp.replace(
              h264Preference,
              `m=video ${match[1]} UDP/TLS/RTP/SAVPF ${reorderedCodecs.join(' ')}`
            );
            console.log('[useWebRTC] Reordered codecs to prefer H.264');
          }
        }

        offer.sdp = modifiedSdp;
        console.log('[useWebRTC] Applied bandwidth constraints and codec preferences');
      }

      await pc.setLocalDescription(offer);
      console.log('[useWebRTC] Local description set');

      if (channel.current) {
        console.log('[useWebRTC] Sending offer');
        channel.current.send({
          type: 'broadcast',
          event: 'webrtc-signal',
          payload: {
            type: 'offer',
            data: offer,
            from: userId,
          },
        });
      }
    } catch (error) {
      console.error('[useWebRTC] Error creating offer:', error);
    }
  }, [userId]);

  // Handle received offer - Stable version
  const handleOffer = useCallback(async (offer: RTCSessionDescriptionInit, from: string) => {
    console.log('[useWebRTC] === HANDLING OFFER ===');
    
    if (!peerConnection.current) {
      peerConnection.current = createPeerConnection();
    }
    
    const pc = peerConnection.current;
    
    try {
      // Perfect negotiation pattern
      const offerCollision = pc.signalingState !== 'stable' || makingOffer.current;
      ignoreOffer.current = offerCollision;
      
      if (ignoreOffer.current) {
        console.log('[useWebRTC] Ignoring offer due to collision');
        return;
      }

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      console.log('[useWebRTC] Remote description set');
      
      // Process pending ICE candidates
      if (pendingCandidates.current.length > 0) {
        console.log('[useWebRTC] Adding pending ICE candidates:', pendingCandidates.current.length);
        for (const candidate of pendingCandidates.current) {
          await pc.addIceCandidate(candidate);
        }
        pendingCandidates.current = [];
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      console.log('[useWebRTC] Answer created and local description set');

      if (channel.current) {
        console.log('[useWebRTC] Sending answer');
        channel.current.send({
          type: 'broadcast',
          event: 'webrtc-signal',
          payload: {
            type: 'answer',
            data: answer,
            from: userId,
          },
        });
      }
    } catch (error) {
      console.error('[useWebRTC] Error handling offer:', error);
    }
  }, [userId, createPeerConnection]);

  // Handle received answer - Stable version
  const handleAnswer = useCallback(async (answer: RTCSessionDescriptionInit) => {
    console.log('[useWebRTC] === HANDLING ANSWER ===');
    
    if (!peerConnection.current) {
      console.warn('[useWebRTC] No peer connection to handle answer');
      return;
    }

    const pc = peerConnection.current;

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      console.log('[useWebRTC] Remote description set from answer');
      
      // Process pending ICE candidates
      if (pendingCandidates.current.length > 0) {
        console.log('[useWebRTC] Adding pending ICE candidates:', pendingCandidates.current.length);
        for (const candidate of pendingCandidates.current) {
          await pc.addIceCandidate(candidate);
        }
        pendingCandidates.current = [];
      }
    } catch (error) {
      console.error('[useWebRTC] Error handling answer:', error);
    }
  }, []);

  // Handle received ICE candidate - Stable version
  const handleIceCandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
    console.log('[useWebRTC] === HANDLING ICE CANDIDATE ===');
    console.log('[useWebRTC] Candidate details:', {
      candidate: candidate.candidate,
      sdpMid: candidate.sdpMid,
      sdpMLineIndex: candidate.sdpMLineIndex,
    });
    
    if (!peerConnection.current) {
      console.warn('[useWebRTC] No peer connection for ICE candidate');
      return;
    }

    const pc = peerConnection.current;

    try {
      if (pc.remoteDescription && pc.remoteDescription.type) {
        console.log('[useWebRTC] Adding ICE candidate immediately (remote description set)');
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
        console.log('[useWebRTC] ICE candidate added successfully');
      } else {
        console.log('[useWebRTC] Buffering ICE candidate (no remote description yet)');
        pendingCandidates.current.push(new RTCIceCandidate(candidate));
        console.log('[useWebRTC] Buffered candidates count:', pendingCandidates.current.length);
      }
    } catch (error) {
      console.error('[useWebRTC] Error adding ICE candidate:', error);
    }
  }, []);

  // Toggle audio
  const toggleAudio = useCallback(() => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        console.log('[useWebRTC] Audio toggled:', audioTrack.enabled);
        return audioTrack.enabled;
      }
    }
    return false;
  }, [localStream]);

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        console.log('[useWebRTC] Video toggled:', videoTrack.enabled);
        return videoTrack.enabled;
      }
    }
    return false;
  }, [localStream]);

  // Start screen sharing - CRITICAL FIX
  const startScreenShare = useCallback(async () => {
    console.log('[useWebRTC] === STARTING SCREEN SHARE ===');
    
    if (!peerConnection.current || !cameraStream.current) {
      console.error('[useWebRTC] Cannot start screen share: missing resources');
      return false;
    }

    try {
      // Request display media
      console.log('[useWebRTC] Requesting display media...');
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });

      const screenTrack = displayStream.getVideoTracks()[0];
      if (!screenTrack) {
        console.error('[useWebRTC] No screen track obtained');
        return false;
      }
      
      console.log('[useWebRTC] Screen track obtained:', screenTrack.label);
      
      // Find the video sender and replace track
      const videoSender = peerConnection.current.getSenders().find(s => s.track?.kind === 'video');
      if (!videoSender) {
        console.error('[useWebRTC] No video sender found');
        displayStream.getTracks().forEach(track => track.stop());
        return false;
      }
      
      // Replace the track in peer connection
      await videoSender.replaceTrack(screenTrack);
      console.log('[useWebRTC] Screen track replaced in peer connection');
      
      // CRITICAL FIX: Update local stream to show screen share
      const audioTrack = localStream?.getAudioTracks()[0];
      const newLocalStream = new MediaStream();
      newLocalStream.addTrack(screenTrack);
      if (audioTrack) {
        newLocalStream.addTrack(audioTrack);
      }
      setLocalStream(newLocalStream);
      
      // Store screen stream
      screenStream.current = displayStream;
      setIsScreenSharing(true);

      // Handle user stopping screen share via browser UI
      screenTrack.onended = () => {
        console.log('[useWebRTC] Screen share ended by user');
        stopScreenShare();
      };

      console.log('[useWebRTC] Screen sharing started successfully');
      return true;
    } catch (error) {
      console.error('[useWebRTC] Error starting screen share:', error);
      return false;
    }
  }, [localStream]);

  // Stop screen sharing and restore camera - CRITICAL FIX
  const stopScreenShare = useCallback(async () => {
    console.log('[useWebRTC] === STOPPING SCREEN SHARE ===');
    
    if (!peerConnection.current || !cameraStream.current) {
      console.log('[useWebRTC] Cannot stop screen share: missing resources');
      return;
    }

    try {
      // Stop all screen stream tracks
      if (screenStream.current) {
        screenStream.current.getTracks().forEach(track => {
          track.stop();
          console.log('[useWebRTC] Stopped screen track:', track.kind);
        });
      }
      
      // Get the camera video track
      const cameraVideoTrack = cameraStream.current.getVideoTracks()[0];
      if (!cameraVideoTrack) {
        console.error('[useWebRTC] No camera video track found');
        return;
      }
      
      // Ensure camera track is enabled
      cameraVideoTrack.enabled = true;
      
      // Find the video sender and replace track back to camera
      const videoSender = peerConnection.current.getSenders().find(s => s.track?.kind === 'video');
      if (videoSender) {
        await videoSender.replaceTrack(cameraVideoTrack);
        console.log('[useWebRTC] Camera track restored in peer connection');
      }

      // CRITICAL FIX: Restore local stream to camera
      setLocalStream(cameraStream.current);
      
      screenStream.current = null;
      setIsScreenSharing(false);
      
      console.log('[useWebRTC] Screen sharing stopped, camera restored');
    } catch (error) {
      console.error('[useWebRTC] Error stopping screen share:', error);
    }
  }, []);

  // Monitor connection quality using getStats
  const monitorConnectionQuality = useCallback(async () => {
    const pc = peerConnection.current;
    if (!pc) return;

    try {
      const stats = await pc.getStats();
      let bitrate = 0;
      let packetLoss = 0;
      let jitter = 0;
      let rtt = 0;

      stats.forEach((report) => {
        if (report.type === 'inbound-rtp' && report.kind === 'video') {
          bitrate = report.bytesReceived ? (report.bytesReceived * 8) / 1000 : 0;
          packetLoss = report.packetsLost || 0;
          jitter = report.jitter || 0;
        }
        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          rtt = report.currentRoundTripTime ? report.currentRoundTripTime * 1000 : 0;
        }
      });

      // Calculate quality based on metrics
      let quality: ConnectionQuality['quality'] = 'excellent';
      
      if (iceConnectionState === 'checking' || iceConnectionState === 'new') {
        quality = 'connecting';
      } else if (bitrate > 1000 && packetLoss < 1 && rtt < 150) {
        quality = 'excellent';
      } else if (bitrate > 500 && packetLoss < 3 && rtt < 200) {
        quality = 'good';
      } else if (bitrate > 300 && packetLoss < 5 && rtt < 300) {
        quality = 'fair';
      } else {
        quality = 'poor';
      }

      setConnectionQuality({
        bitrate,
        packetLoss,
        jitter,
        rtt,
        quality,
      });
    } catch (error) {
      console.error('[useWebRTC] Error monitoring connection quality:', error);
    }
  }, [iceConnectionState]);

  // Start quality monitoring
  useEffect(() => {
    if (connectionState === 'connected') {
      statsInterval.current = setInterval(monitorConnectionQuality, 1000);
      return () => {
        if (statsInterval.current) {
          clearInterval(statsInterval.current);
        }
      };
    }
  }, [connectionState, monitorConnectionQuality]);

  // Reset peer connection when peer disconnects/rejoins
  const resetPeerConnection = useCallback(() => {
    console.log('[useWebRTC] === RESETTING PEER CONNECTION ===');

    // Clear remote stream
    setRemoteStream(null);
    remoteStreamRef.current = null;
    receivedTracks.current.clear();

    // Clear pending candidates
    pendingCandidates.current = [];

    // Close existing peer connection
    if (peerConnection.current) {
      console.log('[useWebRTC] Closing existing peer connection');
      peerConnection.current.close();
      peerConnection.current = null;
    }

    // Reset state flags
    makingOffer.current = false;
    ignoreOffer.current = false;
    reconnectAttempts.current = 0;

    // Clear reconnect timeout
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current);
      reconnectTimeout.current = null;
    }

    // Clear disconnect timeout
    if (disconnectTimeout.current) {
      clearTimeout(disconnectTimeout.current);
      disconnectTimeout.current = null;
    }

    // Create fresh peer connection if we have a local stream
    if (localStream) {
      console.log('[useWebRTC] Creating fresh peer connection with local stream');
      peerConnection.current = createPeerConnection();

      // Re-add local tracks to new connection
      localStream.getTracks().forEach((track) => {
        console.log('[useWebRTC] Re-adding track to new connection:', track.kind);
        peerConnection.current!.addTrack(track, localStream);
      });
    }

    console.log('[useWebRTC] Peer connection reset complete');
  }, [localStream, createPeerConnection]);

  // Send location info to remote peer
  const sendLocation = useCallback((locationInfo: LocationInfo) => {
    if (!channel.current) {
      console.warn('[useWebRTC] Cannot send location - channel not ready');
      return;
    }

    console.log('[useWebRTC] Sending location info:', locationInfo);

    const message: WebRTCMessage = {
      type: 'location-info',
      data: locationInfo,
      from: userId,
    };

    channel.current.send({
      type: 'broadcast',
      event: 'webrtc-signal',
      payload: message,
    });
  }, [userId]);

  // Cleanup function - ENHANCED with reconnection cleanup
  const cleanup = useCallback(() => {
    console.log('[useWebRTC] === CLEANUP ===');

    // Clear reconnection timeout
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current);
      reconnectTimeout.current = null;
      console.log('[useWebRTC] Cleared reconnection timeout');
    }

    // Reset reconnection counter
    reconnectAttempts.current = 0;

    if (statsInterval.current) {
      clearInterval(statsInterval.current);
      statsInterval.current = null;
    }

    if (screenStream.current) {
      screenStream.current.getTracks().forEach((track) => {
        track.stop();
        console.log('[useWebRTC] Stopped screen track');
      });
      screenStream.current = null;
    }

    if (cameraStream.current) {
      cameraStream.current.getTracks().forEach((track) => {
        track.stop();
        console.log('[useWebRTC] Stopped camera track');
      });
      cameraStream.current = null;
    }

    if (localStream) {
      localStream.getTracks().forEach((track) => {
        track.stop();
        console.log('[useWebRTC] Stopped local stream track');
      });
    }

    if (peerConnection.current) {
      peerConnection.current.close();
      console.log('[useWebRTC] Closed peer connection');
      peerConnection.current = null;
    }

    if (channel.current) {
      supabase.removeChannel(channel.current);
      console.log('[useWebRTC] Removed Supabase channel');
      channel.current = null;
    }

    // Clear track tracking
    receivedTracks.current.clear();
    remoteStreamRef.current = null;

    setLocalStream(null);
    setRemoteStream(null);
    setConnectionState('closed');
    setIceConnectionState('closed');
    isInitialized.current = false;

    console.log('[useWebRTC] Cleanup complete');
  }, [localStream]);

  // Initialize Supabase Realtime channel for signaling
  useEffect(() => {
    if (!roomId) return;

    console.log('[useWebRTC] === INITIALIZING SIGNALING CHANNEL ===');

    const realtimeChannel = supabase.channel(`room:${roomId}`, {
      config: {
        broadcast: { self: false }, // Don't receive our own messages
        presence: { key: userId },
      },
    });

    realtimeChannel
      .on('broadcast', { event: 'webrtc-signal' }, ({ payload }: { payload: WebRTCMessage }) => {
        // Ignore messages from self (extra safety)
        if (payload.from === userId) {
          console.log('[useWebRTC] Ignoring message from self');
          return;
        }

        console.log('[useWebRTC] Received signal:', payload.type, 'from:', payload.from);

        // Detect if this is a new/different peer or a peer rejoining
        if (payload.type === 'ready' || payload.type === 'offer') {
          if (remotePeerId.current && remotePeerId.current !== payload.from) {
            console.log('[useWebRTC] ⚠️ Different peer detected! Previous:', remotePeerId.current, 'New:', payload.from);
            console.log('[useWebRTC] Resetting connection for new peer');
            resetPeerConnection();
          } else if (remotePeerId.current === payload.from && payload.type === 'ready') {
            // Same peer sent "ready" again - they likely refreshed/rejoined
            console.log('[useWebRTC] ⚠️ Same peer rejoined! Resetting connection');
            resetPeerConnection();
          }

          // Update remote peer ID
          remotePeerId.current = payload.from;

          // Clear disconnect timeout since peer is active
          if (disconnectTimeout.current) {
            clearTimeout(disconnectTimeout.current);
            disconnectTimeout.current = null;
          }
        }

        switch (payload.type) {
          case 'offer':
            console.log('[useWebRTC] Calling handleOffer');
            handleOffer(payload.data, payload.from);
            break;
          case 'answer':
            console.log('[useWebRTC] Calling handleAnswer');
            handleAnswer(payload.data);
            break;
          case 'ice-candidate':
            handleIceCandidate(payload.data);
            break;
          case 'ready':
            console.log('[useWebRTC] Peer is ready, checking if should create offer');
            // If we have local stream and peer connection, create offer
            if (peerConnection.current) {
              console.log('[useWebRTC] Peer connection exists, signaling state:', peerConnection.current.signalingState);
              if (peerConnection.current.signalingState === 'stable') {
                console.log('[useWebRTC] Calling createOffer');
                createOffer();
              }
            } else {
              console.log('[useWebRTC] No peer connection yet');
            }
            break;
          case 'location-info':
            console.log('[useWebRTC] Received location info from peer:', payload.data);
            setRemoteLocation(payload.data);
            break;
        }
      })
      .subscribe((status) => {
        console.log('[useWebRTC] Channel subscription status:', status);

        if (status === 'SUBSCRIBED') {
          console.log('[useWebRTC] Connected to signaling channel');
          channel.current = realtimeChannel;

          // Don't send "ready" immediately - wait for local stream
          // The "ready" signal will be sent from startLocalStream instead
        }
      });

    // Cleanup when effect re-runs or component unmounts
    return () => {
      console.log('[useWebRTC] Cleaning up signaling channel...');
      if (channel.current) {
        supabase.removeChannel(channel.current);
        channel.current = null;
      }
    };
  }, [roomId, userId, handleOffer, handleAnswer, handleIceCandidate, createOffer, resetPeerConnection]); // Include handlers so channel uses latest versions

  return {
    localStream,
    remoteStream,
    connectionState,
    iceConnectionState,
    connectionQuality,
    isScreenSharing,
    remoteLocation,
    startLocalStream,
    createOffer,
    toggleAudio,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
    sendLocation,
    cleanup,
  };
};
