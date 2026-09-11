import React, { useState, useEffect, useRef, useCallback } from 'react';

const NativeSpeechRecognition = ({
  onTextChange,
  onListeningChange,
  onFinalResult,
  language = 'en-US',
  isMuted = false,
  isActive = true,
  localStream = null,
  isVoiceToSign = false
}) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState('');
  const [isSupported, setIsSupported] = useState(false);
  const [confidence, setConfidence] = useState(0);
  const [debugInfo, setDebugInfo] = useState('');

  // ===== SINGLE INSTANCE + STRICT RUNNING FLAG =====
  const recognitionRef = useRef(null);
  const isRecognizingRef = useRef(false);   // THE guard — prevents duplicate start()
  const shouldBeRunningRef = useRef(false); // Whether we WANT recognition active
  const restartTimerRef = useRef(null);

  // Refs for callbacks to avoid stale closures
  const onTextChangeRef = useRef(onTextChange);
  const onListeningChangeRef = useRef(onListeningChange);
  const onFinalResultRef = useRef(onFinalResult);

  useEffect(() => {
    onTextChangeRef.current = onTextChange;
    onListeningChangeRef.current = onListeningChange;
    onFinalResultRef.current = onFinalResult;
  }, [onTextChange, onListeningChange, onFinalResult]);

  // ===== SAFE START — never calls start() if already running =====
  const safeStart = useCallback(() => {
    if (isRecognizingRef.current) {
      console.log('🎤 [SAFE] Already running, skip start()');
      return;
    }
    if (!recognitionRef.current) {
      console.log('🎤 [SAFE] No recognition instance, skip start()');
      return;
    }
    try {
      recognitionRef.current.start();
      // isRecognizingRef is set to true in onstart, not here
      console.log('🎤 [SAFE] start() called successfully');
    } catch (e) {
      console.warn('🎤 [SAFE] start() failed:', e.message);
      isRecognizingRef.current = false;
    }
  }, []);

  // ===== SAFE STOP =====
  const safeStop = useCallback(() => {
    shouldBeRunningRef.current = false;
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.stop();
    } catch (e) {
      // ignore
    }
  }, []);

  // ===== CREATE AND CONFIGURE RECOGNITION INSTANCE =====
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSupported(false);
      setError('Speech recognition is not supported in this browser.');
      return;
    }

    setIsSupported(true);

    // Clean up any previous instance completely
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onstart = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onresult = null;
        recognitionRef.current.stop();
      } catch (e) { /* ignore */ }
      recognitionRef.current = null;
    }
    isRecognizingRef.current = false;

    const rec = new SpeechRecognition();
    recognitionRef.current = rec;
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = language;
    rec.maxAlternatives = 1;

    // ----- onstart: SET the flag -----
    rec.onstart = () => {
      console.log('🎤 [NSR] Recognition STARTED');
      isRecognizingRef.current = true;
      setIsListening(true);
      setError('');
      if (onListeningChangeRef.current) onListeningChangeRef.current(true);
    };

    // ----- onend: ONLY place that restarts -----
    rec.onend = () => {
      console.log('🎤 [NSR] Recognition ENDED');
      isRecognizingRef.current = false;
      setIsListening(false);
      if (onListeningChangeRef.current) onListeningChangeRef.current(false);

      // Only restart if we SHOULD be running
      if (shouldBeRunningRef.current) {
        if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
        restartTimerRef.current = setTimeout(() => {
          if (shouldBeRunningRef.current && !isRecognizingRef.current && recognitionRef.current === rec) {
            console.log('🎤 [NSR] Auto-restarting from onend...');
            safeStart();
          }
        }, 300);
      }
    };

    // ----- onerror: DO NOT restart here — let onend handle it -----
    rec.onerror = (event) => {
      console.warn('🎤 [NSR] Error:', event.error);

      if (event.error === 'aborted') {
        // Do NOT restart — onend will fire and handle it
        return;
      }

      if (event.error === 'no-speech') {
        setDebugInfo('No speech detected, will auto-restart...');
        // onend fires after this, which will restart
        return;
      }

      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        shouldBeRunningRef.current = false;
        setError('Microphone access denied.');
      } else if (event.error === 'audio-capture') {
        setError('Microphone not available.');
      } else if (event.error === 'network') {
        setError('Network error.');
      } else {
        setError(`Speech error: ${event.error}`);
      }

      isRecognizingRef.current = false;
      setIsListening(false);
      if (onListeningChangeRef.current) onListeningChangeRef.current(false);
    };

    // ----- onresult -----
    rec.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';
      let highestConfidence = 0;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i][0];
        const text = result.transcript;
        const conf = result.confidence || 0;

        if (event.results[i].isFinal) {
          finalTranscript += text;
          highestConfidence = Math.max(highestConfidence, conf);
        } else {
          interimTranscript += text;
        }
      }

      setConfidence(highestConfidence);

      if (finalTranscript) {
        console.log('🎤 [NSR] Final:', finalTranscript);
        if (onFinalResultRef.current) onFinalResultRef.current(finalTranscript);
      } else if (interimTranscript) {
        if (onTextChangeRef.current) onTextChangeRef.current(interimTranscript);
      }

      const newTranscript = (transcript + ' ' + finalTranscript).trim();
      setTranscript(newTranscript);
    };

    setDebugInfo('Recognition configured for: ' + language);

    // Cleanup: nuclear — kill everything
    return () => {
      shouldBeRunningRef.current = false;
      isRecognizingRef.current = false;
      if (restartTimerRef.current) {
        clearTimeout(restartTimerRef.current);
        restartTimerRef.current = null;
      }
      if (recognitionRef.current) {
        recognitionRef.current.onstart = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onresult = null;
        try { recognitionRef.current.stop(); } catch (e) { /* ignore */ }
        recognitionRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  // ===== REACT TO isActive + isMuted CHANGES =====
  useEffect(() => {
    if (!isSupported) return;

    const shouldListen = isActive && !isMuted;

    if (shouldListen && !isRecognizingRef.current) {
      console.log('🎤 [NSR] Should listen → starting');
      shouldBeRunningRef.current = true;
      // Small delay to avoid racing with cleanup
      const t = setTimeout(() => safeStart(), 200);
      return () => clearTimeout(t);
    } else if (!shouldListen && isRecognizingRef.current) {
      console.log('🎤 [NSR] Should stop → stopping');
      safeStop();
    } else if (!shouldListen) {
      shouldBeRunningRef.current = false;
    }
  }, [isMuted, isActive, isSupported, safeStart, safeStop]);

  const clearTranscript = () => {
    setTranscript('');
    setConfidence(0);
    if (onTextChangeRef.current) onTextChangeRef.current('');
  };

  if (!isSupported) {
    return (
      <div className="p-4 bg-red-50 text-red-800 rounded-lg border border-red-200 mb-4">
        <h4 className="text-lg font-semibold mb-3">Speech Recognition Not Available</h4>
        <p className="text-sm mb-3">
          {error || 'Speech recognition is not supported. Please use Chrome, Edge, or Safari.'}
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-lg font-semibold text-gray-700 mb-2">
          🎤 Automatic Voice-to-Sign Language
        </h4>
        <div className="flex gap-2">
          <button
            onClick={() => { shouldBeRunningRef.current = true; safeStart(); }}
            disabled={isListening}
            className={`px-4 py-2 rounded-md font-medium transition-all duration-200 ${isListening
              ? 'bg-green-500 text-white cursor-not-allowed shadow-lg'
              : 'bg-green-600 text-white hover:bg-green-700 hover:shadow-md active:scale-95'
              }`}
          >
            {isListening ? '🎤 Active' : '🎤 Start'}
          </button>

          <button
            onClick={safeStop}
            disabled={!isListening}
            className={`px-4 py-2 rounded-md font-medium transition-all duration-200 ${!isListening
              ? 'bg-gray-500 text-white cursor-not-allowed'
              : 'bg-red-600 text-white hover:bg-red-700 hover:shadow-md active:scale-95'
              }`}
          >
            ⏹️ Stop
          </button>

          <button
            onClick={clearTranscript}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 hover:shadow-md active:scale-95 transition-all duration-200"
          >
            🗑️ Clear
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-800 rounded-md border border-red-200 mb-4 text-sm">
          ⚠️ {error}
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Live Speech Translation:
          </label>
          <textarea
            value={transcript}
            readOnly
            className="w-full min-h-20 p-3 border border-green-300 rounded-md text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white shadow-inner"
            placeholder="🎤 Just speak naturally - your words will be instantly translated to sign language..."
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full animate-pulse ${isListening ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm text-gray-600">
              Status: {isListening ? '🎤 Listening & Translating' : '⏸️ Stopped'}
            </span>
          </div>

          {confidence > 0 && (
            <div className="text-xs text-green-600 font-medium">
              Confidence: {Math.round(confidence * 100)}%
            </div>
          )}
        </div>

        {isListening && (
          <div className="p-3 bg-green-50 text-green-800 rounded-md border border-green-200 text-sm text-center animate-pulse">
            🎤 <strong>Speak now!</strong> Your voice is being instantly translated to sign language.
            <br />
            <span className="text-xs opacity-80">No buttons needed - just talk naturally!</span>
          </div>
        )}

        {!isListening && transcript && (
          <div className="p-3 bg-blue-50 text-blue-800 rounded-md border border-blue-200 text-sm text-center">
            💡 <strong>Ready to translate!</strong> Click "Start" to begin automatic voice recognition.
          </div>
        )}

        <div className="p-3 bg-blue-50 text-blue-800 rounded-md border border-blue-200 text-sm">
          💡 <strong>How it works:</strong>
          <br />
          • Speech recognition starts automatically when you join
          <br />
          • Just speak naturally - no need to press buttons
          <br />
          • 3D avatar instantly translates your words to sign language
          <br />
          • Works continuously for seamless communication
        </div>

        <div className="p-3 bg-gray-50 text-gray-700 rounded-md border border-gray-200 text-xs font-mono">
          🔍 <strong>Debug Info:</strong> {debugInfo}
        </div>
      </div>
    </div>
  );
};

export default NativeSpeechRecognition;
