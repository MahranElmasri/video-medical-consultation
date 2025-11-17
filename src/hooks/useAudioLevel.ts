import { useEffect, useState, useRef } from 'react';

/**
 * Custom hook to measure audio level from a MediaStream
 * Returns a value from 0-100 representing the current volume level
 */
export const useAudioLevel = (stream: MediaStream | null): number => {
  const [audioLevel, setAudioLevel] = useState(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const streamIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!stream) {
      // Clean up if stream is null
      setAudioLevel(0);
      return;
    }

    // CRITICAL FIX: Always re-initialize when stream changes
    // Even if the ID is the same, tracks might have changed (e.g., after screen share)
    console.log('[useAudioLevel] Initializing audio analyzer for stream:', stream.id);
    streamIdRef.current = stream.id;

    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      console.warn('[useAudioLevel] No audio tracks in stream');
      setAudioLevel(0);
      return;
    }

    console.log('[useAudioLevel] Audio tracks found:', audioTracks.length);

    try {
      // Create audio context and analyser
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);

      // Configure analyser
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      // Connect source to analyser
      source.connect(analyser);

      // Store references
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      dataArrayRef.current = dataArray;

      // Animation loop to update audio level
      const updateLevel = () => {
        if (!analyserRef.current || !dataArrayRef.current) {
          return;
        }

        // Get frequency data
        analyserRef.current.getByteFrequencyData(dataArrayRef.current);

        // Calculate average volume
        let sum = 0;
        for (let i = 0; i < dataArrayRef.current.length; i++) {
          sum += dataArrayRef.current[i];
        }
        const average = sum / dataArrayRef.current.length;

        // Normalize to 0-100 scale (byte values are 0-255)
        const normalizedLevel = Math.min(100, (average / 255) * 100 * 2); // Multiply by 2 for better sensitivity

        setAudioLevel(normalizedLevel);

        // Continue animation loop
        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };

      // Start the animation loop
      updateLevel();

      // Cleanup function
      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        if (audioContextRef.current) {
          audioContextRef.current.close();
        }
      };
    } catch (error) {
      console.error('Failed to create audio analyser:', error);
      setAudioLevel(0);
    }
  }, [stream]);

  return audioLevel;
};
