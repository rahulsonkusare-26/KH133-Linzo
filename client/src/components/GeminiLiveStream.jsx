import React, { useEffect, useRef, useState } from 'react';
import { Hands } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';

/**
 * GeminiLiveStream Component — Local Gesture Mode (Cost-Free)
 * Uses MediaPipe Hands to detect ISL/ASL gestures purely on-device.
 * No data is ever sent to Vertex AI / Gemini.
 *
 * Gesture → Phrase mapping:
 *  - Open Palm (4+ fingers extended)     → "Hello"
 *  - Fist (all fingers closed)            → "How are you?"
 *  - Thumbs Up (thumb up, fingers closed) → "Thank you"
 *  - Peace / V-Sign (index+middle only)   → "Good"
 *  - Pinky up (only pinky extended)       → "Goodbye"
 */
const GeminiLiveStream = ({
    isActive,
    onTextDetected,
    socketRef,
    roomId
}) => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [status, setStatus] = useState("Initializing MP...");
    const [error, setError] = useState(null);

    // Buffer for accumulating frames
    const frameBufferRef = useRef([]);
    const lastSendTimeRef = useRef(0);
    const handsMeshRef = useRef(null);
    const cameraRef = useRef(null);

    // Configuration
    const BUFFER_SIZE_MS = 600; // Buffer ~600ms of context
    const SEND_INTERVAL_MS = 500; // Send batch every 500ms
    const MIN_FRAMES_TO_SEND = 5;

    useEffect(() => {
        let hands = null;
        let camera = null;
        let gestureCooldownRef = { current: 0 };

        const GESTURE_COOLDOWN_MS = 3500; // Min time between any two gesture triggers
        const perGestureCooldown = {}; // Cooldown per gesture label

        /**
         * detectLocalGesture — Multi-Sign ISL Heuristic Detector
         *
         * Gesture → Output mapping:
         *  Open Palm  → "Hello"
         *  Fist       → "How are you?"
         *  Thumbs Up  → "Thank you"
         *  V-Sign     → "Good"
         *  Pinky Up   → "Goodbye"
         */
        const detectLocalGesture = (multiHandLandmarks) => {
            if (!multiHandLandmarks || multiHandLandmarks.length === 0) return null;

            for (const landmarks of multiHandLandmarks) {
                const wrist = landmarks[0];

                // Helper: Euclidean distance from wrist to a landmark
                const distFromWrist = (idx) => Math.sqrt(
                    Math.pow(landmarks[idx].x - wrist.x, 2) +
                    Math.pow(landmarks[idx].y - wrist.y, 2)
                );

                // Finger tip/joint indices
                const tips   = [8, 12, 16, 20]; // Index, Middle, Ring, Pinky
                const joints = [6, 10, 14, 18];

                let extendedCount = 0;
                const isExtended = tips.map((tip, i) => {
                    const extended = distFromWrist(tip) > distFromWrist(joints[i]) * 1.2;
                    if (extended) extendedCount++;
                    return extended;
                });

                const [indexExt, middleExt, ringExt, pinkyExt] = isExtended;

                // Thumb: compare tip (4) vs joint (3) horizontally (x-axis)
                const thumbExt = Math.abs(landmarks[4].x - landmarks[3].x) > 0.04;

                // --- Gesture Rules ---

                // 1. OPEN PALM — Hello (4+ fingers extended, any thumb state)
                if (extendedCount >= 4) return "Hello";

                // 2. FIST — How are you? (no fingers extended, thumb folded)
                if (extendedCount === 0 && !thumbExt) return "How are you?";

                // 3. THUMBS UP — Thank you (only thumb extended, fingers closed)
                if (extendedCount === 0 && thumbExt) return "Thank you";

                // 4. V-SIGN / PEACE — Good (index + middle only)
                if (indexExt && middleExt && !ringExt && !pinkyExt) return "Good";

                // 5. PINKY UP — Goodbye (only pinky extended)
                if (!indexExt && !middleExt && !ringExt && pinkyExt) return "Goodbye";
            }
            return null;
        };

        const onResults = (results) => {

            if (!canvasRef.current || !videoRef.current) return;

            // Draw landmarks for local feedback (optional/debug)
            const ctx = canvasRef.current.getContext('2d');
            ctx.save();
            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            ctx.drawImage(results.image, 0, 0, canvasRef.current.width, canvasRef.current.height);

            // 1. Process Detection
            if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
                setStatus("Hands Detected 👐");

                // --- LOCAL HEURISTIC GESTURE DETECTION ---
                const gesture = detectLocalGesture(results.multiHandLandmarks);
                if (gesture) {
                    const now = Date.now();
                    const lastFired = perGestureCooldown[gesture] || 0;
                    if (now - lastFired > GESTURE_COOLDOWN_MS) {
                        console.log(`🦾 [LOCAL] Detected gesture: "${gesture}" → Bypassing Gemini.`);
                        setStatus(`🤟 ${gesture}`);
                        onTextDetected(gesture);
                        perGestureCooldown[gesture] = now;
                        frameBufferRef.current = []; // Drain buffer, nothing to send
                    }
                }
                // ------------------------------------------

                // Draw hand landmarks on canvas for visual feedback
                for (const landmarks of results.multiHandLandmarks) {
                    for (const point of landmarks) {
                        ctx.beginPath();
                        ctx.arc(point.x * canvasRef.current.width, point.y * canvasRef.current.height, 3, 0, 2 * Math.PI);
                        ctx.fillStyle = '#00FF00';
                        ctx.fill();
                    }
                }
            } else {
                setStatus("Waiting for Hands...");
                // No hands detected — nothing to process
            }
            ctx.restore();

            // 3. Check Send Condition
            const now = Date.now();
            if (now - lastSendTimeRef.current > SEND_INTERVAL_MS) {
                sendBuffer();
            }
        };

        const sendBuffer = () => {
            // 🚫 VERTEX AI BYPASSED — All gesture processing is now done locally.
            // Frame data is intentionally never sent to Gemini to avoid costs.
            frameBufferRef.current = [];
        };

        const initMediaPipe = async () => {
            try {
                hands = new Hands({
                    locateFile: (file) => {
                        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
                    }
                });

                hands.setOptions({
                    maxNumHands: 2,
                    modelComplexity: 1,
                    minDetectionConfidence: 0.5,
                    minTrackingConfidence: 0.5
                });

                hands.onResults(onResults);
                handsMeshRef.current = hands;

                if (videoRef.current) {
                    camera = new Camera(videoRef.current, {
                        onFrame: async () => {
                            if (hands && videoRef.current) {
                                await hands.send({ image: videoRef.current });
                            }
                        },
                        width: 320,
                        height: 240
                    });
                    cameraRef.current = camera;
                    camera.start();
                    console.log("📸 MediaPipe Camera Started");
                }
            } catch (err) {
                console.error("MediaPipe Init Error:", err);
                setError("Failed to load Hand Tracking");
            }
        };

        if (isActive) {
            initMediaPipe();
            // NOTE: We do NOT emit 'start-gemini-stream' since Vertex AI is bypassed.
        }

        return () => {
            if (hands) hands.close();
            if (camera) camera.stop();
        };
    }, [isActive, socketRef, roomId]);

    // Handle Incoming Audio (PCM Streaming)
    useEffect(() => {
        if (!socketRef.current) return;

        // 1. Initialize Audio Context (Standard Gemini Rate is 24kHz)
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
        let nextStartTime = 0;

        const handleAudio = async (data) => {
            if (data.audio) {
                try {
                    // Resume context if suspended (browser autoplay policy)
                    if (audioCtx.state === 'suspended') {
                        await audioCtx.resume();
                    }

                    // 2. Decode Base64 -> Raw PCM (Int16)
                    const binaryString = window.atob(data.audio);
                    const len = binaryString.length;
                    const bytes = new Uint8Array(len);
                    for (let i = 0; i < len; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                    }
                    const int16Data = new Int16Array(bytes.buffer);

                    // 3. Convert Int16 -> Float32 (Web Audio API format)
                    const float32Data = new Float32Array(int16Data.length);
                    for (let i = 0; i < int16Data.length; i++) {
                        float32Data[i] = int16Data[i] / 32768.0; // Normalize to -1.0 -> 1.0
                    }

                    // 4. Create Buffer
                    const buffer = audioCtx.createBuffer(1, float32Data.length, 24000);
                    buffer.getChannelData(0).set(float32Data);

                    // 5. Schedule Playback (Gapless)
                    const source = audioCtx.createBufferSource();
                    source.buffer = buffer;
                    source.connect(audioCtx.destination);

                    // Ensure we schedule after the current "tail"
                    const currentTime = audioCtx.currentTime;
                    if (nextStartTime < currentTime) {
                        nextStartTime = currentTime;
                    }
                    source.start(nextStartTime);

                    // Update next start time
                    nextStartTime += buffer.duration;

                } catch (e) {
                    console.error("PCM Audio Decode Error:", e);
                }
            }
        };

        socketRef.current.on('gemini-audio', handleAudio);
        return () => {
            socketRef.current.off('gemini-audio', handleAudio);
            if (audioCtx) audioCtx.close();
        };
    }, [socketRef]);

    return (
        <div className="relative w-full h-full bg-black rounded-2xl overflow-hidden shadow-inner border border-gray-800">
            {/* Hidden Video Feed (Source) */}
            <video
                ref={videoRef}
                className="hidden"
                playsInline
                muted
            />

            {/* Debug Canvas (Visual Feedback) */}
            <canvas
                ref={canvasRef}
                width={320} height={240}
                className="w-full h-full object-cover transform scale-x-[-1]"
            />

            {/* Status Overlay */}
            <div className="absolute top-4 left-4 right-4 flex justify-between items-start pointer-events-none">
                <div className="bg-black/60 backdrop-blur-md text-white px-3 py-1.5 rounded-full text-xs font-medium border border-white/10 flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${status.includes("Wait") ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`}></div>
                    {error || status}
                </div>
            </div>

            <div className="absolute bottom-4 left-0 right-0 text-center pointer-events-none">
                <p className="text-white/50 text-[10px] uppercase tracking-widest font-mono">
                    LOCAL HEURISTICS • VERTEX BYPASSED
                </p>
            </div>
        </div>
    );
};

export default GeminiLiveStream;
