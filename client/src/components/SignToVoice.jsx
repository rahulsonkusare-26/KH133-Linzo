import React, { useEffect, useRef, useState } from 'react';
import Loader from './Loader';

const SignToVoice = ({ isActive, onTextDetected, onSpeechGenerated, onClose }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const poseRef = useRef(null);
  const cameraRef = useRef(null);
  const drawingUtilsRef = useRef(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [detectedText, setDetectedText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [poseResults, setPoseResults] = useState(null);
  const [voiceTestStatus, setVoiceTestStatus] = useState(''); // '', 'speaking', 'done', 'error'

  // ISL Gesture Database with proper pose landmarks
  const islGestures = {
    'hello': {
      description: 'Open hand with fingers spread',
      landmarks: {
        leftWrist: { x: 0.5, y: 0.6 },
        leftElbow: { x: 0.4, y: 0.5 },
        leftShoulder: { x: 0.3, y: 0.4 },
        rightWrist: { x: 0.7, y: 0.6 },
        rightElbow: { x: 0.6, y: 0.5 },
        rightShoulder: { x: 0.5, y: 0.4 }
      },
      confidence: 0.8
    },
    'thank_you': {
      description: 'Both hands open, palms up',
      landmarks: {
        leftWrist: { x: 0.4, y: 0.7 },
        rightWrist: { x: 0.6, y: 0.7 }
      },
      confidence: 0.8
    },
    'yes': {
      description: 'Thumbs up gesture',
      landmarks: {
        rightWrist: { x: 0.7, y: 0.5 },
        rightElbow: { x: 0.6, y: 0.4 }
      },
      confidence: 0.7
    },
    'no': {
      description: 'Index finger pointing',
      landmarks: {
        rightWrist: { x: 0.7, y: 0.6 },
        rightIndex: { x: 0.8, y: 0.5 }
      },
      confidence: 0.7
    },
    'help': {
      description: 'Hands raised for help',
      landmarks: {
        leftWrist: { x: 0.4, y: 0.3 },
        rightWrist: { x: 0.6, y: 0.3 }
      },
      confidence: 0.8
    }
  };

  // Load script dynamically
  const loadScript = (src) => {
    return new Promise((resolve, reject) => {
      // Check if script already exists
      const existingScript = document.querySelector(`script[src="${src}"]`);
      if (existingScript) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  };

  // Initialize MediaPipe Pose
  const initializePoseDetection = async () => {
    try {
      console.log('🤟 Initializing MediaPipe Pose...');

      // Load MediaPipe scripts dynamically
      await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469408/pose.js');
      await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils@0.3.1675466862/camera_utils.js');
      await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils@0.3.1675466862/drawing_utils.js');

      // Wait for scripts to load
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check if MediaPipe is available
      if (!window.Pose) {
        throw new Error('MediaPipe Pose not loaded');
      }

      // Initialize MediaPipe Pose
      const pose = new window.Pose({
        locateFile: (file) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469408/${file}`;
        }
      });

      pose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        enableSegmentation: false,
        smoothSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      pose.onResults(onPoseResults);

      // Initialize drawing utils
      const drawingUtils = new window.DrawingUtils(canvasRef.current.getContext('2d'));

      poseRef.current = pose;
      drawingUtilsRef.current = drawingUtils;
      setIsInitialized(true);

      console.log('✅ MediaPipe Pose initialized successfully');
    } catch (error) {
      console.error('❌ Error initializing MediaPipe Pose:', error);
    }
  };

  // Handle pose detection results
  const onPoseResults = (results) => {
    if (!canvasRef.current) return;

    const canvasCtx = canvasRef.current.getContext('2d');
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasRef.current.width, canvasRef.current.height);

    // Draw pose landmarks
    if (results.poseLandmarks) {
      // Draw connections
      drawingUtilsRef.current.drawConnectors(
        results.poseLandmarks,
        window.POSE_CONNECTIONS,
        { color: '#00FF00', lineWidth: 2 }
      );

      // Draw landmarks
      drawingUtilsRef.current.drawLandmarks(
        results.poseLandmarks,
        { color: '#FF0000', lineWidth: 1, radius: 3 }
      );

      // Process pose for ISL detection
      processPoseForISL(results.poseLandmarks);
    }

    canvasCtx.restore();
    setPoseResults(results);
  };

  // Process pose landmarks for ISL gesture detection
  const processPoseForISL = (landmarks) => {
    if (!landmarks || isProcessing) return;

    // Extract key landmarks for ISL detection
    const poseData = {
      leftWrist: landmarks[15],
      leftElbow: landmarks[13],
      leftShoulder: landmarks[11],
      rightWrist: landmarks[16],
      rightElbow: landmarks[14],
      rightShoulder: landmarks[12],
      leftIndex: landmarks[19],
      rightIndex: landmarks[20]
    };

    // Detect ISL gestures
    const detectedGesture = detectISLGesture(poseData);

    if (detectedGesture) {
      setIsProcessing(true);
      const text = gestureToText(detectedGesture);
      setDetectedText(text);

      console.log('🤟 Detected ISL gesture:', detectedGesture, '->', text);

      // Speak the detected text
      speakText(text);

      if (onTextDetected) {
        onTextDetected(text, detectedGesture);
      }

      // Reset processing after a delay
      setTimeout(() => {
        setIsProcessing(false);
        setDetectedText('');
      }, 3000);
    }
  };

  // Detect ISL gestures based on pose landmarks
  const detectISLGesture = (poseData) => {
    for (const [gestureName, gesture] of Object.entries(islGestures)) {
      let matchScore = 0;
      let totalChecks = 0;

      // Check each landmark position
      for (const [landmarkName, expectedPos] of Object.entries(gesture.landmarks)) {
        const actualLandmark = poseData[landmarkName];
        if (actualLandmark && actualLandmark.visibility > 0.5) {
          const distance = Math.sqrt(
            Math.pow(actualLandmark.x - expectedPos.x, 2) +
            Math.pow(actualLandmark.y - expectedPos.y, 2)
          );

          if (distance < 0.25) { // Threshold for matching (was 0.1 — too strict)
            matchScore++;
          }
          totalChecks++;
        }
      }

      if (totalChecks > 0 && (matchScore / totalChecks) >= gesture.confidence) {
        return gestureName;
      }
    }

    return null;
  };

  // Convert gesture to text
  const gestureToText = (gesture) => {
    const gestureMap = {
      'hello': 'Hello',
      'thank_you': 'Thank you',
      'yes': 'Yes',
      'no': 'No',
      'help': 'Help'
    };

    return gestureMap[gesture] || gesture;
  };

  // Text to Speech using Web Speech API
  const speakText = (text, onDone) => {
    if (!('speechSynthesis' in window)) {
      console.error('❌ Speech synthesis not supported');
      if (onDone) onDone('error');
      return;
    }

    // Cancel any currently speaking or queued utterance first
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onend = () => { if (onDone) onDone('done'); };
    utterance.onerror = (e) => {
      console.error('❌ TTS error:', e);
      if (onDone) onDone('error');
    };

    const doSpeak = (voices) => {
      const preferredVoice =
        voices.find(v => v.lang.includes('en') && v.name.includes('Google')) ||
        voices.find(v => v.lang.includes('en')) ||
        voices[0];

      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      window.speechSynthesis.speak(utterance);
      console.log('🔊 Speaking:', text, '| Voice:', utterance.voice?.name || 'default');

      if (onSpeechGenerated) {
        onSpeechGenerated(text);
      }
    };

    // Voices may not be loaded yet — wait for them if needed
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      doSpeak(voices);
    } else {
      // Voices haven't loaded yet; wait for the voiceschanged event
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.onvoiceschanged = null;
        doSpeak(window.speechSynthesis.getVoices());
      };
    }
  };

  // Manual voice test — lets user verify TTS works independently of gestures
  const handleTestVoice = () => {
    setVoiceTestStatus('speaking');
    speakText('Hello! Sign to voice is working correctly.', (result) => {
      setVoiceTestStatus(result); // 'done' or 'error'
      setTimeout(() => setVoiceTestStatus(''), 3000);
    });
  };

  // Start camera stream
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: 640,
          height: 480,
          facingMode: 'user'
        }
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Initialize camera with MediaPipe
      const camera = new window.Camera(videoRef.current, {
        onFrame: async () => {
          if (poseRef.current && isActive) {
            await poseRef.current.send({ image: videoRef.current });
          }
        },
        width: 640,
        height: 480
      });

      cameraRef.current = camera;
      await camera.start();

      console.log('📹 Camera started successfully');
    } catch (error) {
      console.error('❌ Error starting camera:', error);
    }
  };

  // Initialize when component mounts
  useEffect(() => {
    if (isActive && !isInitialized) {
      initializePoseDetection();
    }
  }, [isActive, isInitialized]);

  // Start/stop camera stream
  useEffect(() => {
    if (isActive && isInitialized) {
      startCamera();
    } else {
      if (cameraRef.current) {
        cameraRef.current.stop();
        cameraRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    }

    return () => {
      if (cameraRef.current) {
        cameraRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [isActive, isInitialized]);

  if (!isActive) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-4xl w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span className="text-purple-600">🤟</span>
            Sign to Voice (ISL) - Real-time Pose Detection
          </h2>
          <div className="flex items-center gap-2">
            {isProcessing && (
              <div className="flex items-center gap-2 text-purple-600">
                <div className="w-3 h-3 bg-purple-500 rounded-full animate-pulse"></div>
                <span className="text-sm">Processing...</span>
              </div>
            )}
            <button
              onClick={onClose}
              className="rounded-full p-2 hover:bg-gray-100 transition-colors"
              title="Close"
            >
              <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="relative">
          <video
            ref={videoRef}
            className="w-full h-96 bg-gray-900 rounded-lg object-cover"
            autoPlay
            playsInline
            muted
          />
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-96 rounded-lg pointer-events-none"
            width="640"
            height="480"
          />

          {detectedText && (
            <div className="absolute bottom-4 left-4 right-4 bg-purple-600 text-white px-4 py-2 rounded-lg text-center">
              <span className="font-semibold">Detected: {detectedText}</span>
            </div>
          )}
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-purple-50 rounded-lg">
            <h3 className="font-semibold text-purple-800 mb-2">Supported ISL Gestures:</h3>
            <div className="space-y-1 text-sm text-purple-700">
              {Object.entries(islGestures).map(([gesture, config]) => (
                <div key={gesture} className="flex justify-between">
                  <span>• {gestureToText(gesture)}</span>
                  <span className="text-xs text-purple-500">{config.description}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 bg-blue-50 rounded-lg">
            <h3 className="font-semibold text-blue-800 mb-2">Real-time Detection:</h3>
            <div className="space-y-1 text-sm text-blue-700">
              <div>Status: {isInitialized ? '✅ Active' : <span className="inline-flex items-center gap-2"><Loader size="small" /> Initializing...</span>}</div>
              <div>Camera: {streamRef.current ? '✅ Connected' : '❌ Disconnected'}</div>
              <div>Pose Detection: {poseResults ? '✅ Tracking' : '⏸️ Waiting'}</div>
              <div>Processing: {isProcessing ? '✅ Detecting' : '⏸️ Idle'}</div>
              <div>Last Detection: {detectedText || 'None'}</div>
            </div>
          </div>
        </div>

        {/* Test Voice button — isolates TTS from gesture detection */}
        <div className="mt-4 flex items-center justify-between gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
          <div className="text-sm text-green-800">
            <span className="font-semibold">🔊 Voice Test:</span>{' '}
            {voiceTestStatus === 'speaking' && <span className="text-blue-600">Speaking…</span>}
            {voiceTestStatus === 'done' && <span className="text-green-600">✅ Voice works!</span>}
            {voiceTestStatus === 'error' && <span className="text-red-600">❌ TTS error — check browser/system audio</span>}
            {!voiceTestStatus && <span className="text-gray-500">Click to test if your browser can speak</span>}
          </div>
          <button
            id="sign-to-voice-test-btn"
            onClick={handleTestVoice}
            disabled={voiceTestStatus === 'speaking'}
            className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            🔊 Test Voice
          </button>
        </div>

        <div className="mt-2 text-center text-sm text-gray-600">
          Position yourself in front of the camera to detect ISL gestures.
          The system will show real-time pose landmarks and detect gestures automatically.
        </div>
      </div>
    </div>
  );
};

export default SignToVoice;
