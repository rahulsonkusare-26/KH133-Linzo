import React, { useEffect, useRef, useState, useCallback } from 'react';
import Loader from './Loader';
import Webcam from 'react-webcam';
import { Holistic, POSE_CONNECTIONS, HAND_CONNECTIONS } from '@mediapipe/holistic';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';

const VideoWithPoseDetection = ({
  isActive,
  onTextDetected,
  onSpeechGenerated,
  onStreamReady,
  mode = 'phrases',
  onAlphabetLetter,
  onAlphabetControlGesture,
  alphabetModelUrl = '/onnx_models/isl_model.onnx',
}) => {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [detectionStatus, setDetectionStatus] = useState('initializing...');

  const [detectedText, setDetectedText] = useState('');
  const [hasFaceDetected, setHasFaceDetected] = useState(false);

  const holisticRef = useRef(null);
  const workerRef = useRef(null);
  const rafIdRef = useRef(null);
  const resultCountRef = useRef(0);
  const isActiveRef = useRef(isActive);
  const onnxReadyRef = useRef(false);

  const lastSpokenTimeRef = useRef(0);
  const lastSpokenLetterRef = useRef(null);
  const TTS_COOLDOWN_MS = 500;

  // Track isActive in a ref for the capture loop
  useEffect(() => {
    isActiveRef.current = isActive;
    console.log(`📹 VideoPose: isActive is now ${isActive}`);
  }, [isActive]);

  // Handle alphabet classification results from ONNX worker
  const handleAlphabetResult = useCallback((prediction) => {
    const letter = prediction.label;
    const confidence = prediction.confidence;

    if (confidence < 0.70) return;

    const now = performance.now();
    const letterChanged = lastSpokenLetterRef.current !== letter;
    const cooldownExpired = now - lastSpokenTimeRef.current > TTS_COOLDOWN_MS;

    if (letterChanged || cooldownExpired) {
      if (letter.toLowerCase() !== 'noaction') {
        onSpeechGenerated && onSpeechGenerated(letter);
        onAlphabetLetter && onAlphabetLetter(letter);
        // onTextDetected removed to prevent double TTS on receiver side
      }
      lastSpokenLetterRef.current = letter;
      lastSpokenTimeRef.current = now;
      setDetectedText(`${letter} (${(confidence * 100).toFixed(1)}%)`);
    }
  }, [onSpeechGenerated, onAlphabetLetter, onTextDetected]);

  // Initialize MediaPipe Holistic on main thread + ONNX worker
  useEffect(() => {
    if (holisticRef.current) return; // Prevent double initialization

    console.log('👷 VideoPose: Initializing MediaPipe (main thread) + ONNX worker...');

    // 1. Create ONNX Alphabet Worker
    try {
      const workerPath = new URL('../workers/alphabet.worker.js', import.meta.url);
      workerRef.current = new Worker(workerPath);

      workerRef.current.onmessage = (event) => {
        const { type, result, error } = event.data;
        if (type === 'INIT_DONE') {
          console.log('✅ VideoPose: ONNX Alphabet Worker Ready');
          onnxReadyRef.current = true;
        } else if (type === 'ALPHABET_RESULT') {
          handleAlphabetResult(result);
        } else if (type === 'ERROR') {
          console.error('❌ VideoPose: ONNX Worker Error:', error);
        }
      };

      workerRef.current.postMessage({
        type: 'INIT',
        data: { alphabetModelUrl }
      });
    } catch (e) {
      console.error('❌ VideoPose: Failed to create ONNX worker:', e);
    }

    // 2. Create MediaPipe Holistic on main thread
    try {
      setDetectionStatus('Loading MediaPipe...');
      const holistic = new Holistic({
        locateFile: (file) => `/mediapipe/${file}`
      });

      holistic.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
        refineFaceLandmarks: true
      });

      holistic.onResults((results) => {
        resultCountRef.current++;
        if (resultCountRef.current % 100 === 0) {
          console.log(`📈 VideoPose Heartbeat: #${resultCountRef.current}`);
        }

        // Draw landmarks on canvas
        if (canvasRef.current) {
          drawOnCanvas(results);
        }

        // Send hand landmarks to ONNX worker for alphabet classification
        if (onnxReadyRef.current && mode === 'alphabet') {
          const hand = results.rightHandLandmarks || results.leftHandLandmarks;
          if (hand && workerRef.current) {
            const video = webcamRef.current?.video;
            workerRef.current.postMessage({
              type: 'CLASSIFY',
              data: {
                landmarks: hand.map(lm => ({ x: lm.x, y: lm.y })),
                width: video?.videoWidth || 640,
                height: video?.videoHeight || 480,
                handSide: results.rightHandLandmarks ? 'right' : 'left'
              }
            });
          }
        }

        setHasFaceDetected(!!results.faceLandmarks);
      });

      holisticRef.current = holistic;
      setIsInitialized(true);
      setDetectionStatus('✅ Ready');
      console.log('✅ VideoPose: MediaPipe Holistic Ready (main thread)');
    } catch (e) {
      console.error('❌ VideoPose: Failed to init MediaPipe:', e);
      setDetectionStatus('❌ MediaPipe Init Failed');
    }

    return () => {
      console.log('🛑 VideoPose: Cleaning up...');
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
      if (holisticRef.current) {
        holisticRef.current.close();
        holisticRef.current = null;
      }
    };
  }, []);

  // Frame capture loop - sends video frames to MediaPipe on main thread
  const captureFrame = useCallback(async () => {
    if (!isActiveRef.current || !holisticRef.current || !webcamRef.current?.video) {
      rafIdRef.current = requestAnimationFrame(captureFrame);
      return;
    }

    try {
      const video = webcamRef.current.video;
      if (video.readyState === 4) {
        await holisticRef.current.send({ image: video });
      }
    } catch (e) {
      // Silently handle send errors
    }

    rafIdRef.current = requestAnimationFrame(captureFrame);
  }, []);

  useEffect(() => {
    if (isInitialized) {
      rafIdRef.current = requestAnimationFrame(captureFrame);
    }
    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, [isInitialized, captureFrame]);

  const drawOnCanvas = (results) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const video = webcamRef.current?.video;
    if (video) {
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (results.poseLandmarks) {
      drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, { color: '#00FF00', lineWidth: 2 });
    }
    if (results.leftHandLandmarks) {
      drawConnectors(ctx, results.leftHandLandmarks, HAND_CONNECTIONS, { color: '#FFFFFF', lineWidth: 2 });
      drawLandmarks(ctx, results.leftHandLandmarks, { color: '#FF0000', lineWidth: 1, radius: 2 });
    }
    if (results.rightHandLandmarks) {
      drawConnectors(ctx, results.rightHandLandmarks, HAND_CONNECTIONS, { color: '#FFFFFF', lineWidth: 2 });
      drawLandmarks(ctx, results.rightHandLandmarks, { color: '#0000FF', lineWidth: 1, radius: 2 });
    }
  };

  return (
    <div className="relative w-full h-full bg-black rounded-xl overflow-hidden shadow-2xl group border border-slate-700">
      <Webcam
        ref={webcamRef}
        audio={false}
        className="w-full h-full object-cover mirror"
        videoConstraints={{
          width: 1280,
          height: 720,
          facingMode: "user",
        }}
        onUserMedia={(stream) => {
          console.log('🎥 VideoPose: Webcam ready');
          if (onStreamReady) onStreamReady(stream);
        }}
      />
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 w-full h-full object-cover mirror pointer-events-none z-50"
        style={{ width: '100%', height: '100%' }}
      />

      {!isInitialized && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm z-[60] transition-all">
          <Loader />
          <p className="mt-4 text-white font-medium animate-pulse">{detectionStatus}</p>
        </div>
      )}

      {detectedText && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur-md px-6 py-2 rounded-full border border-white/20 shadow-xl pointer-events-none z-[60] transition-all duration-300">
          <p className="text-white text-lg font-bold tracking-wider">{detectedText}</p>
        </div>
      )}

      <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-[60] pointer-events-none">
        <div className="flex gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-md ${hasFaceDetected ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
            {hasFaceDetected ? '👤 Face Active' : '👤 No Face'}
          </span>
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30 backdrop-blur-md">
            ⚡ {isInitialized ? 'Ready' : 'Loading'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default VideoWithPoseDetection;