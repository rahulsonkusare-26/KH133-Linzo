import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useActiveSpeaker - Monitors audio levels for local and remote streams to detect the current speaker.
 * 
 * Fixes applied (Google Meet-style active speaker detection):
 * 1. LOCAL_DAMPENING — Local mic is ~3-5x louder than WebRTC remote audio; dampening equalizes comparison.
 * 2. Ref-based activeSpeakerId inside rAF loop to avoid stale closures and dependency cycles.
 * 3. Proper stream reconnection — disconnects old analysers when streams change.
 * 4. AudioContext resume — ensures suspended context is resumed.
 * 5. Smoothed volume history — uses a rolling average to prevent jitter.
 * 6. "Keep last speaker" — retains last active speaker during silence instead of resetting.
 * 
 * @param {MediaStream} localStream - User's own webcam/mic stream
 * @param {Array} participants - List of remote participants with their streams
 * @returns {string|null} activeSpeakerId - 'local' or the participant's socket ID
 */
export function useActiveSpeaker(localStream, participants) {
    const [activeSpeakerId, setActiveSpeakerId] = useState(null);
    const activeSpeakerIdRef = useRef(null); // Ref mirror to avoid stale closures in rAF

    const audioContextRef = useRef(null);
    const analysersRef = useRef({});       // id → { analyser, source, streamId }
    const smoothedVolumesRef = useRef({}); // id → smoothed volume (rolling average)
    const lastSwitchTimeRef = useRef(0);
    const silenceStartTimeRef = useRef(null);
    const requestRef = useRef(null);

    // ── Tuning Constants ──
    const THRESHOLD = 8;              // Minimum volume to be considered "speaking" (lowered from 15)
    const SWITCH_DELAY = 800;          // 800ms damping (reduced from 1500ms for responsiveness)
    const LOCAL_DAMPENING = 0.3;       // Local mic is ~3x louder than remote; scale it down
    const SMOOTHING_FACTOR = 0.3;      // Exponential moving average factor (0=smooth, 1=instant)
    const DOMINANCE_RATIO = 1.3;       // New speaker must be 1.3x louder than current to switch

    // Sync ref whenever state changes
    const updateActiveSpeaker = useCallback((id) => {
        if (id !== activeSpeakerIdRef.current) {
            activeSpeakerIdRef.current = id;
            setActiveSpeakerId(id);
        }
    }, []);

    // ── Analyser Setup & Teardown ──
    useEffect(() => {
        // Initialize AudioContext (lazily)
        if (!audioContextRef.current) {
            try {
                audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
            } catch (err) {
                console.error('❌ ActiveSpeaker: Failed to create AudioContext:', err);
                return;
            }
        }

        const audioContext = audioContextRef.current;

        // Resume suspended AudioContext (browsers require user gesture)
        if (audioContext.state === 'suspended') {
            audioContext.resume().then(() => {
                console.log('🎙️ ActiveSpeaker: AudioContext resumed');
            }).catch(() => {});
        }

        /**
         * Setup or reconnect an analyser for a given stream.
         * Handles stream changes by comparing stream IDs.
         */
        const setupAnalyser = (id, stream) => {
            if (!stream) return;

            const audioTracks = stream.getAudioTracks();
            if (!audioTracks.length) {
                console.log(`🎙️ ActiveSpeaker: No audio tracks for ${id}`);
                return;
            }

            // Check if we already have an analyser for this exact stream
            const existing = analysersRef.current[id];
            if (existing && existing.streamId === stream.id) {
                return; // Same stream, no need to reconnect
            }

            // Disconnect old analyser if stream changed
            if (existing) {
                try {
                    existing.source.disconnect();
                } catch (e) { /* already disconnected */ }
                console.log(`🎙️ ActiveSpeaker: Reconnecting analyser for ${id} (stream changed)`);
            }

            try {
                const source = audioContext.createMediaStreamSource(stream);
                const analyser = audioContext.createAnalyser();
                analyser.fftSize = 256;
                analyser.smoothingTimeConstant = 0.5; // Built-in smoothing
                source.connect(analyser);

                analysersRef.current[id] = {
                    analyser,
                    source,
                    streamId: stream.id
                };

                // Initialize smoothed volume
                if (smoothedVolumesRef.current[id] === undefined) {
                    smoothedVolumesRef.current[id] = 0;
                }

                console.log(`🎙️ ActiveSpeaker: Monitoring ${id} (stream: ${stream.id}, tracks: ${audioTracks.length})`);
            } catch (err) {
                console.error(`❌ ActiveSpeaker: Error setting up analyser for ${id}:`, err);
            }
        };

        // Setup for local stream
        if (localStream) {
            setupAnalyser('local', localStream);
        }

        // Setup for remote participants
        participants.forEach(p => {
            if (p.stream) {
                setupAnalyser(p.id, p.stream);
            }
        });

        // ── Volume Monitoring Loop ──
        const checkVolumes = () => {
            const now = Date.now();
            let loudestId = null;
            let maxVolume = 0;
            let currentSpeakerVolume = 0;
            const currentSpeaker = activeSpeakerIdRef.current;

            Object.entries(analysersRef.current).forEach(([id, entry]) => {
                const { analyser } = entry;
                const dataArray = new Uint8Array(analyser.frequencyBinCount);
                analyser.getByteFrequencyData(dataArray);

                // Calculate average volume from frequency data
                let sum = 0;
                for (let i = 0; i < dataArray.length; i++) {
                    sum += dataArray[i];
                }
                let rawAverage = sum / dataArray.length;

                // Apply local dampening — local mic is much louder than remote WebRTC audio
                if (id === 'local') {
                    rawAverage *= LOCAL_DAMPENING;
                }

                // Exponential moving average for smoothing
                const prevSmoothed = smoothedVolumesRef.current[id] || 0;
                const smoothed = prevSmoothed * (1 - SMOOTHING_FACTOR) + rawAverage * SMOOTHING_FACTOR;
                smoothedVolumesRef.current[id] = smoothed;

                // Track current speaker's volume (for dominance comparison)
                if (id === currentSpeaker) {
                    currentSpeakerVolume = smoothed;
                }

                if (smoothed > THRESHOLD && smoothed > maxVolume) {
                    maxVolume = smoothed;
                    loudestId = id;
                }
            });

            // Switch logic with dominance ratio and damping
            if (loudestId && loudestId !== currentSpeaker) {
                const timeSinceLastSwitch = now - lastSwitchTimeRef.current;

                // Only switch if:
                // 1. Enough time has passed (damping)
                // 2. New speaker is significantly louder (dominance ratio)
                // 3. OR current speaker is silent
                const currentIsSilent = currentSpeakerVolume < THRESHOLD;
                const newIsDominant = maxVolume > currentSpeakerVolume * DOMINANCE_RATIO;

                if (timeSinceLastSwitch > SWITCH_DELAY && (currentIsSilent || newIsDominant)) {
                    updateActiveSpeaker(loudestId);
                    lastSwitchTimeRef.current = now;
                }
            } else if (!loudestId && currentSpeaker) {
                // If NO ONE is speaking above the threshold (or the speaker muted themselves)
                if (!silenceStartTimeRef.current) {
                    silenceStartTimeRef.current = now;
                }
                
                // Only clear the highlight after continuous silence for 1 second
                // This prevents violent flickering during natural mid-sentence breathing pauses
                if (now - silenceStartTimeRef.current > SWITCH_DELAY + 200) {
                    updateActiveSpeaker(null);
                    lastSwitchTimeRef.current = now;
                    silenceStartTimeRef.current = null;
                }
            } else {
                // Someone is speaking, reset the silence timer
                silenceStartTimeRef.current = null;
            }

            requestRef.current = requestAnimationFrame(checkVolumes);
        };

        requestRef.current = requestAnimationFrame(checkVolumes);

        return () => {
            if (requestRef.current) {
                cancelAnimationFrame(requestRef.current);
                requestRef.current = null;
            }
        };
    }, [localStream, participants, updateActiveSpeaker]);
    // Note: activeSpeakerId is deliberately NOT in deps to avoid infinite re-render loops.
    // We use activeSpeakerIdRef inside the rAF loop instead.

    // ── Cleanup for participants who left ──
    useEffect(() => {
        const participantIds = new Set(participants.map(p => p.id));

        Object.keys(analysersRef.current).forEach(id => {
            if (id !== 'local' && !participantIds.has(id)) {
                // Disconnect and remove
                try {
                    analysersRef.current[id].source.disconnect();
                } catch (e) { /* already disconnected */ }
                delete analysersRef.current[id];
                delete smoothedVolumesRef.current[id];
                console.log(`🎙️ ActiveSpeaker: Cleaned up analyser for departed ${id}`);
            }
        });
    }, [participants]);

    return activeSpeakerId;
}
