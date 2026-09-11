import { useState, useEffect, useRef, useCallback } from 'react';
import * as faceapi from '@vladmandic/face-api';

/**
 * useEmotionDetection Hook
 * 
 * Detects facial emotions from a video element in real-time using face-api.js.
 * Provides a smoothed, dominant emotion.
 */
export function useEmotionDetection(videoRef) {
    const [emotion, setEmotion] = useState('neutral');
    const [isModelsLoaded, setIsModelsLoaded] = useState(false);
    const emotionBufferRef = useRef([]);
    const BUFFER_SIZE = 5; // Smoothing over last 5 detections
    const detectionIntervalRef = useRef(null);

    // 1. Load Face API Models
    useEffect(() => {
        const loadModels = async () => {
            try {
                // Point to the local weights directory provided in the task
                const MODEL_URL = '/models/face-api-weights';
                
                console.log('🎭 Loading Face-API models from:', MODEL_URL);
                
                await Promise.all([
                    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
                    faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
                    faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)
                ]);
                
                setIsModelsLoaded(true);
                console.log('✅ Face-API models loaded successfully');
            } catch (err) {
                console.error('❌ Failed to load Face-API models:', err);
            }
        };

        loadModels();
    }, []);

    // 2. Start Detection Loop
    useEffect(() => {
        if (!isModelsLoaded || !videoRef.current) return;

        const detectEmotion = async () => {
            const video = videoRef.current;
            if (!video || video.paused || video.ended || video.readyState !== 4) return;

            try {
                // Use TinyFaceDetector with a larger inputSize so it reliably finds the face, but remains very fast.
                const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.4 });
                
                // IMPORTANT: Adding .withFaceLandmarks(true) forces the library to align the face BEFORE
                // running the expression model. Without alignment, the expression model is notoriously inaccurate.
                // The boolean 'true' tells it to use the Tiny version of the landmark net we loaded above.
                const detections = await faceapi.detectSingleFace(video, options)
                    .withFaceLandmarks(true) 
                    .withFaceExpressions();

                if (detections && detections.expressions) {
                    const expressions = detections.expressions;
                    
                    // Log raw expressions occasionally for debugging
                    if (Math.random() < 0.1) {
                        console.log('🧐 Fast Aligned Face Expressions:', expressions);
                    }

                    // We still keep the slight de-biasing logic to make it highly responsive
                    let dominant = 'neutral';
                    let maxScore = -1;

                    for (const [emotion, score] of Object.entries(expressions)) {
                        let adjustedScore = score;
                        if (emotion !== 'neutral') {
                            adjustedScore = score * 2.0; // Boost multiplier
                        }
                        
                        // Set a minimum threshold for non-neutral to be considered at all
                        if (emotion !== 'neutral' && score < 0.2) {
                            adjustedScore = 0; 
                        }

                        if (adjustedScore > maxScore) {
                            maxScore = adjustedScore;
                            dominant = emotion;
                        }
                    }

                    updateEmotionBuffer(dominant);
                } else {
                    // Log when no face is found
                    if (Math.random() < 0.1) {
                        console.warn('⚠️ No face detected in frame (TinyDetector).');
                    }
                    updateEmotionBuffer('neutral');
                }
            } catch (err) {
                console.error('Error during emotion detection:', err);
            }
        };

        const updateEmotionBuffer = (newEmotion) => {
            emotionBufferRef.current.push(newEmotion);
            if (emotionBufferRef.current.length > BUFFER_SIZE) {
                emotionBufferRef.current.shift();
            }

            // Majority vote for smoothing
            const counts = {};
            emotionBufferRef.current.forEach(e => { counts[e] = (counts[e] || 0) + 1; });
            const smoothed = Object.keys(counts).reduce((a, b) => 
                counts[a] > counts[b] ? a : b
            );

            setEmotion(smoothed);
        };

        detectionIntervalRef.current = setInterval(detectEmotion, 500); // Detect every 500ms

        return () => {
            if (detectionIntervalRef.current) {
                clearInterval(detectionIntervalRef.current);
            }
        };
    }, [isModelsLoaded, videoRef]);

    return { emotion, isModelsLoaded };
}
