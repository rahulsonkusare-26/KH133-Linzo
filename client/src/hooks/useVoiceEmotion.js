import { useEffect, useRef } from 'react';
import Meyda from 'meyda';

/**
 * useVoiceEmotion Hook
 * 
 * Lightweight voice emotion detection using Meyda.
 * Taps into an existing MediaStream and logs detected emotions to the console.
 * 
 * @param {MediaStream} stream - The local audio stream to analyze.
 * @param {boolean} isMuted - Whether the microphone is currently muted.
 * @param {boolean} isEnabled - Whether the emotion detection should be running.
 * @param {Function} onEmotionDetected - Callback for when an emotion is detected.
 */
export function useVoiceEmotion(stream, isMuted, isEnabled, onEmotionDetected) {
  const analyzerRef = useRef(null);
  const audioContextRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const lastLogTimeRef = useRef(0);

  useEffect(() => {
    // 1. Initial Checks: 
    // - Must be enabled (VoiceToSign)
    // - Stream must exist and contain at least one audio track
    // - Not muted
    if (!isEnabled || !stream || !stream.getAudioTracks().length || isMuted) {
      cleanup();
      return;
    }

    try {
      // 2. Initialize AudioContext if not already created
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }

      const audioContext = audioContextRef.current;

      // Ensure AudioContext is running (might be suspended by browser policy)
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }

      // 3. Create Source Node from the stream
      // Using a ref to prevent re-creating the source node if the stream is the same
      if (!sourceNodeRef.current || sourceNodeRef.current.mediaStream !== stream) {
        sourceNodeRef.current = audioContext.createMediaStreamSource(stream);
      }

      // 4. Initialize Meyda Analyzer
      if (!analyzerRef.current) {
        analyzerRef.current = Meyda.createMeydaAnalyzer({
          audioContext: audioContext,
          source: sourceNodeRef.current,
          bufferSize: 1024,
          featureExtractors: ['rms', 'spectralCentroid', 'zcr', 'spectralFlatness'],
          callback: (features) => {
            const now = Date.now();
            // Throttle logging to ~500ms
            if (now - lastLogTimeRef.current >= 500) {
              const emotionLabel = inferEmotion(features);
              
              // Only trigger callback if it's a "real" emotion change (ignore silence/noise for speed)
              const emotion = emotionLabel.split(' ')[0]; // Get 'angry', 'sad', 'neutral'
              if (onEmotionDetected && (emotion === 'angry' || emotion === 'sad' || emotion === 'neutral')) {
                onEmotionDetected(emotion);
              }

              console.log("🎭 [Voice Emotion]:", emotionLabel, {
                rms: features.rms.toFixed(3),
                centroid: Math.round(features.spectralCentroid),
                flatness: features.spectralFlatness.toFixed(3),
                zcr: features.zcr
              });
              lastLogTimeRef.current = now;
            }
          },
        });

        analyzerRef.current.start();
        console.log("✅ Voice Emotion Analyzer started.");
      }
    } catch (err) {
      console.error("❌ Error initializing Voice Emotion Analyzer:", err);
    }

    return () => {
      // We don't necessarily want to kill the AudioContext here if it's shared,
      // but Meyda needs to stop.
      if (analyzerRef.current) {
        analyzerRef.current.stop();
        analyzerRef.current = null;
      }
    };
  }, [stream, isMuted, isEnabled]);

  /**
   * Simple rule-based heuristic for emotion detection
   */
  const inferEmotion = (features) => {
    const { rms, spectralCentroid, zcr, spectralFlatness } = features;

    // 1. Silence Filter: Extreme silence
    if (rms < 0.002) {
      return 'neutral 😐 (silence)';
    }

    // 2. Noise/Wind Guard:
    // Spectral Flatness near 1.0 means pure white noise (like blowing air/wind).
    // Human speech is usually well structured (flatness < 0.4).
    if (spectralFlatness > 0.45) {
      return 'neutral 😐 (noise/wind)';
    }

    // 3. Angry: Higher energy and higher brightness/sharpness
    // Triggers if you are loud (>0.25) OR if you have high pitch/sharpness (>160 centroid / >300 ZCR)
    if (rms > 0.25 || spectralCentroid > 165 || zcr > 320) {
      return 'angry 🔥';
    }

    // 4. Sad: Consistent low energy and low pitch
    // Higher thresholds (0.20 and 140) to catch more "soft" speech as sad
    if (rms < 0.20 && spectralCentroid < 140) {
      return 'sad 💧';
    }

    // 5. Default: Neutral (standard speech)
    return 'neutral 😐';
  };

  /**
   * Cleanup Utility
   */
  const cleanup = () => {
    if (analyzerRef.current) {
      analyzerRef.current.stop();
      analyzerRef.current = null;
    }
  };

  // Cleanup on final unmount
  useEffect(() => {
    return () => {
      cleanup();
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, []);
}
