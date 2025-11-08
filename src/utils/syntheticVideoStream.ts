/**
 * Synthetic Video Stream Generator for Testing
 * 
 * Creates a MediaStream with a synthetic video track showing a moving pattern.
 * This allows testing video rendering without requiring physical camera hardware.
 */

export function createSyntheticVideoStream(width = 640, height = 480): MediaStream {
  console.log('[SyntheticVideo] Creating synthetic video stream:', { width, height });
  
  // Create canvas element
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Could not get canvas context');
  }

  let frame = 0;
  
  // Animation function - creates moving gradient pattern
  function drawFrame() {
    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, `hsl(${(frame * 2) % 360}, 70%, 50%)`);
    gradient.addColorStop(1, `hsl(${(frame * 2 + 180) % 360}, 70%, 50%)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    
    // Moving circle
    const circleX = (Math.sin(frame * 0.02) * 0.3 + 0.5) * width;
    const circleY = (Math.cos(frame * 0.03) * 0.3 + 0.5) * height;
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(circleX, circleY, 40, 0, Math.PI * 2);
    ctx.fill();
    
    // Text overlay
    ctx.fillStyle = 'white';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('TEST VIDEO', width / 2, height / 2);
    
    // Frame counter
    ctx.font = '20px Arial';
    ctx.fillText(`Frame: ${frame}`, width / 2, height / 2 + 40);
    
    frame++;
  }
  
  // Animate at 30 FPS
  const intervalId = setInterval(drawFrame, 1000 / 30);
  
  // Capture stream from canvas
  const stream = canvas.captureStream(30);
  
  console.log('[SyntheticVideo] Stream created:', {
    id: stream.id,
    active: stream.active,
    videoTracks: stream.getVideoTracks().length,
  });
  
  // Add cleanup handler
  const videoTrack = stream.getVideoTracks()[0];
  if (videoTrack) {
    const originalStop = videoTrack.stop.bind(videoTrack);
    videoTrack.stop = () => {
      console.log('[SyntheticVideo] Stopping synthetic video stream');
      clearInterval(intervalId);
      originalStop();
    };
  }
  
  return stream;
}

/**
 * Create synthetic audio stream (silent audio for testing)
 */
export function createSyntheticAudioStream(): MediaStream {
  console.log('[SyntheticAudio] Creating synthetic audio stream');
  
  // Create AudioContext
  const audioContext = new AudioContext();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  // Very low volume sine wave
  oscillator.frequency.value = 440; // A4 note
  gainNode.gain.value = 0.01; // Very quiet
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  oscillator.start();
  
  // Create MediaStreamDestination
  const dest = audioContext.createMediaStreamDestination();
  gainNode.connect(dest);
  
  console.log('[SyntheticAudio] Audio stream created');
  
  return dest.stream;
}

/**
 * Create combined synthetic media stream (video + audio)
 */
export function createSyntheticMediaStream(width = 640, height = 480): MediaStream {
  console.log('[SyntheticMedia] Creating combined synthetic media stream');
  
  const videoStream = createSyntheticVideoStream(width, height);
  const audioStream = createSyntheticAudioStream();
  
  // Combine tracks
  const combinedStream = new MediaStream();
  
  videoStream.getVideoTracks().forEach(track => {
    combinedStream.addTrack(track);
    console.log('[SyntheticMedia] Added video track:', track.label);
  });
  
  audioStream.getAudioTracks().forEach(track => {
    combinedStream.addTrack(track);
    console.log('[SyntheticMedia] Added audio track:', track.label);
  });
  
  console.log('[SyntheticMedia] Combined stream ready:', {
    id: combinedStream.id,
    active: combinedStream.active,
    videoTracks: combinedStream.getVideoTracks().length,
    audioTracks: combinedStream.getAudioTracks().length,
  });
  
  return combinedStream;
}

/**
 * Check if we should use synthetic video (for testing without camera)
 */
export function shouldUseSyntheticVideo(): boolean {
  // Check URL parameter
  const params = new URLSearchParams(window.location.search);
  return params.get('testMode') === 'true' || params.get('synthetic') === 'true';
}
