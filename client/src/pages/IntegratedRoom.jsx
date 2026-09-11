import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useChat } from '../hooks/useChat';
import { useMediaControls } from '../hooks/useMediaControls';
import { useTranslation } from '../hooks/useTranslation';
import { useSignLanguage } from '../hooks/useSignLanguage';
import { useMeetingSummary } from '../hooks/useMeetingSummary';
import { useWebRTC } from '../hooks/useWebRTC';
import { useActiveSpeaker } from '../hooks/useActiveSpeaker';
import { useMultilingualSTT } from '../hooks/useMultilingualSTT';
import { useVoiceEmotion } from '../hooks/useVoiceEmotion';
import Webcam from 'react-webcam';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import io from 'socket.io-client';
import api from '../lib/api';
import UserTypeModal from '../components/room/UserTypeModal';
import RoomHeader from '../components/room/RoomHeader';
import AvatarSidebarLayout from '../components/room/AvatarSidebarLayout';
import VideoGallery from '../components/room/VideoGallery';
import ControlBar from '../components/room/ControlBar';
import ChatModal from '../components/room/ChatModal';
import ParticipantsModal from '../components/room/ParticipantsModal';
import TranscriptModal from '../components/room/TranscriptModal';
import NativeSpeechRecognition from '../components/NativeSpeechRecognition';
import CallWidget from '../components/CallWidget';
import SamvaadLogo from '../assets/samvaad-logo.png';

const IntegratedRoom = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isConnected, setIsConnected] = useState(false);

  // Shared Refs
  const socketRef = useRef(null);
  const selfIdRef = useRef(null);
  const peerConnectionsRef = useRef({});
  const localStreamRef = useRef(null);
  const userNameRef = useRef('');
  const participantVideoRefs = useRef({});
  const hasJoinedRef = useRef(false);
  const [isCallWidgetOpen, setIsCallWidgetOpen] = useState(false);

  // Media controls (extracted to useMediaControls hook)
  const {
    isMuted, isVideoOff, isScreenSharing,
    localStream, setLocalStream, baseStreamRef, localVideoRef,
    switchStream, toggleMute, toggleVideo, toggleScreenShare
  } = useMediaControls(socketRef, roomId, peerConnectionsRef, localStreamRef);

  // Chat state (extracted to useChat hook)
  const {
    chatMessages, setChatMessages, chatInput, setChatInput,
    showChat, setShowChat, drawerTab, setDrawerTab,
    sendChatMessage, handleChatMessage, addSystemMessage
  } = useChat(socketRef, roomId);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showSTT, setShowSTT] = useState(false);

  // Translation state (extracted to useTranslation hook)
  const {
    isTranslationEnabled, setIsTranslationEnabled,
    preferredLanguage, setPreferredLanguage,
    supportedLanguages, isTTSPlaying, setIsTTSPlaying,
    isTranslationEnabledRef, preferredLanguageRef, isTTSPlayingRef,
    multilingualRecRef, multilingualRestartTimerRef, multilingualAllowRestartRef,
    speakText, translateIncomingText
  } = useTranslation();

  // Sign Language & Typing state (extracted to useSignLanguage hook)
  const {
    isSignLanguageActive, setIsSignLanguageActive,
    avatarType, setAvatarType,
    animationSpeed, setAnimationSpeed,
    pauseTime, setPauseTime,
    currentText, setCurrentText,
    isSignToVoiceActive, setIsSignToVoiceActive,
    isISLTypingActive, setIsISLTypingActive,
    useClientAlphabetModel, setUseClientAlphabetModel,
    typedPrefix, setTypedPrefix,
    currentSuggestion, setCurrentSuggestion,
    composedSentence, setComposedSentence,
    detectedISLText, setDetectedISLText,
    handleAnimationComplete,
    handleBroadcastSignLanguage,
    handleBroadcastAnimationComplete,
    toggleSignToVoice,
    handleSignTextDetected,
    handleSignSpeechGenerated,
    handleBroadcastTTS,
    toggleISLTyping,
    toggleClientAlphabet,
    handleAlphabetLetter,
    commitWordToSentence,
    finalizeSentence,
    handleAlphabetControlGesture,
    handleTextChange
  } = useSignLanguage({
    socketRef,
    roomId,
    setChatMessages,
    speakText,
    isTranslationEnabledRef,
    translateIncomingText,
    preferredLanguageRef
  });

  const [user, setUser] = useState({ name: 'You', avatar: '' });
  const [isBackgroundListening, setIsBackgroundListening] = useState(false);

  // User Type & Cognitive Accessibility State
  const [userType, setUserType] = useState(null); // 'normal', 'deaf', 'mute', null (unselected)
  const [cognitiveMode, setCognitiveMode] = useState(null); // 'focus', 'social', 'reading', 'standard', null
  const [showAvatar, setShowAvatar] = useState(true); // Toggle for Deaf/Mute users
  const [layoutMode, setLayoutMode] = useState('grid'); // 'grid' | 'speaker'
  const [prominenceMode, setProminenceMode] = useState('grid'); // 'grid' (integrated) | 'inset' (floating local)
  const [pinnedParticipantId, setPinnedParticipantId] = useState(null); // For speaker/pinned view

  // Meeting Summary state (extracted to useMeetingSummary hook)
  const {
    isSummaryEnabled, setIsSummaryEnabled,
    showTranscripts, setShowTranscripts,
    captions, setCaptions,
    isSpeechActive, setIsSpeechActive,
    addTranscription,
    processSocketTranscript,
    endCallWithSummary,
    isDuplicate,
    fetchSmartRewind
  } = useMeetingSummary({ roomId, navigate, socketRef });

  // WebRTC & Peer state (extracted to useWebRTC hook)
  const {
    participants, setParticipants,
    handleUserJoined, handleUserLeft,
    handleOffer, handleAnswer, handleIceCandidate,
    handleMediaState,
    remoteStreamsRef, pendingCandidatesRef,
    dataChannelsRef, dataChannelStatus
  } = useWebRTC({
    socketRef, roomId, localStreamRef,
    isMuted, isVideoOff, selfIdRef,
    peerConnectionsRef
  });

  // Active Speaker Detection
  const activeSpeakerId = useActiveSpeaker(localStream, participants);

  // Keep a ref of participants so ref callbacks can access current data without re-creating
  const participantsRef = useRef(participants);
  useEffect(() => { participantsRef.current = participants; }, [participants]);

  // Multilingual STT (extracted to useMultilingualSTT hook)
  useMultilingualSTT({
    isTranslationEnabled, preferredLanguage, preferredLanguageRef,
    socketRef, roomId, user, userNameRef, setChatMessages, isTTSPlayingRef,
    multilingualRecRef, multilingualRestartTimerRef, multilingualAllowRestartRef,
    addTranscription
  });

  // Handle voice emotion changes to adjust avatar animation speed
  const handleVoiceEmotionDetected = useCallback((emotion) => {
    switch (emotion) {
      case 'angry':
        setAnimationSpeed(0.9);  // Fastest speed
        break;
      case 'sad':
        setAnimationSpeed(0.15); // Slowest speed
        break;
      case 'neutral':
      default:
        setAnimationSpeed(0.4);  // Standard "good" speed
        break;
    }
  }, [setAnimationSpeed]);

  // Voice Emotion Detection (Meyda)
  useVoiceEmotion(localStream, isMuted, isBackgroundListening, handleVoiceEmotionDetected);

  // Stable video ref callback — EAGERLY attaches stream on new element registration.
  // Stable video ref callback — EAGERLY attaches stream on new element registration.
  // This is critical for speaker-layout tile swaps: when React creates a new <video> element
  // (because a tile moved from sidebar to main or vice versa), we immediately set srcObject
  // so the video is never blank.
  const setParticipantVideoRef = useCallback((participantId, element) => {
    if (element && participantVideoRefs.current[participantId] !== element) {
      participantVideoRefs.current[participantId] = element;
      console.log(`🎥 Ref updated for participant ${participantId}`);

      // Eagerly attach stream from current participants (avoids blank tiles on layout swap)
      const participant = participantsRef.current.find(p => p.id === participantId);
      if (participant?.stream) {
        console.log(`🎥 Eagerly attaching stream for ${participantId} (tracks: ${participant.stream.getTracks().length})`);
        element.srcObject = participant.stream;
        const playPromise = element.play();
        if (playPromise && typeof playPromise.then === 'function') {
          playPromise.catch(() => { });
        }
      }
    }
  }, []);

  // Update video streams when participants change or active speaker switches.
  // The activeSpeakerId dep is CRITICAL: when the speaker changes, VideoGallery re-renders
  // and React creates new <video> DOM elements. This effect re-attaches srcObject to them.
  useEffect(() => {
    // Get current participant IDs
    const currentParticipantIds = new Set(participants.map(p => p.id));

    // Clean up video elements for participants who left
    Object.keys(participantVideoRefs.current).forEach(participantId => {
      if (!currentParticipantIds.has(participantId)) {
        const videoElement = participantVideoRefs.current[participantId];
        if (videoElement) {
          videoElement.srcObject = null;
          delete participantVideoRefs.current[participantId];
        }
      }
    });

    // Update streams for current participants
    participants.forEach(participant => {
      const videoElement = participantVideoRefs.current[participant.id];
      if (videoElement && participant.stream) {
        if (videoElement.srcObject !== participant.stream) {
          console.log(`🎥 Updating stream for ${participant.id} in effect (Tracks: ${participant.stream.getTracks().length})`);
          videoElement.srcObject = participant.stream;
          const playPromise = videoElement.play();
          if (playPromise && typeof playPromise.then === 'function') {
            playPromise.catch((e) => {
              console.log('❌ Video play failed for participant:', participant.id, e);
            });
          }
        }
      }
    });
  }, [participants]);

  // Handle local video re-attachment on layout change or active speaker switch
  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current) {
      if (localVideoRef.current.srcObject !== localStreamRef.current) {
        console.log('🎥 Re-attaching local stream due to layout/speaker change');
        localVideoRef.current.srcObject = localStreamRef.current;
        const playPromise = localVideoRef.current.play?.();
        if (playPromise && typeof playPromise.then === 'function') {
          playPromise.catch(() => { });
        }
      }
    }
  }, [localVideoRef.current]);

  // Cleanup video elements on unmount
  useEffect(() => {
    return () => {
      // Clean up all video elements
      Object.values(participantVideoRefs.current).forEach(videoElement => {
        if (videoElement) {
          videoElement.srcObject = null;
        }
      });
      participantVideoRefs.current = {};
    };
  }, []);

  useEffect(() => {
    // Fetch user info for avatar
    api.get('/auth/me').then(res => {
      const userName = res.data?.user?.name || res.data?.name || 'You';
      setUser({
        name: userName,
        avatar: res.data?.user?.avatar || res.data?.avatar || '',
      });
      // Sync userNameRef for meeting summary
      userNameRef.current = userName;

      // Register meeting presence in DB (Create if not exists)
      api.post(`/meetings/${roomId}/join`, { username: userName })
        .then(() => console.log('✅ [SUMMARY] Meeting registered in DB'))
        .catch(e => console.error('❌ [SUMMARY] Failed to register meeting:', e));
    }).catch(() => { });

    // Language fetch is now handled by useTranslation hook
  }, []);

  const signalingUrl = useMemo(() => {
    const userUrl = searchParams.get('sig');
    if (userUrl) {
      console.log('🔌 Using custom signaling URL from params:', userUrl);
      return userUrl;
    }
    // Default fallback logic
    try {
      const origin = window.location.origin.replace(/\/$/, '');
      // If we are on port 5173 (dev), try 5000. Otherwise assume same origin/port or specific env.
      return import.meta.env.VITE_SIGNALING_URL || origin.replace(':5173', ':5000');
    } catch (e) {
      console.error('Error deriving signaling URL:', e);
      return 'http://localhost:5000';
    }
  }, [searchParams]);

  // Keyboard Shortcuts (Alt + R)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.altKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        const rewindBtn = document.querySelector('[title*="Smart Rewind"]');
        if (rewindBtn) rewindBtn.click();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    console.log('🔌 Connecting to signaling server:', signalingUrl);

    socketRef.current = io(signalingUrl, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      auth: {
        token: localStorage.getItem('token')
      }
    });

    socketRef.current.on('connect', () => {
      console.log('✅ Connected to server:', roomId, 'Socket ID:', socketRef.current.id);
      setIsConnected(true);
      selfIdRef.current = socketRef.current.id;
    });

    // Transcription State Sync
    socketRef.current.on('transcription-state', (data) => {
      setIsSummaryEnabled(data.enabled);
    });

    socketRef.current.on('disconnect', () => {
      console.log('❌ Disconnected from server');
      setIsConnected(false);
    });

    socketRef.current.on('connect_error', (error) => {
      console.error('❌ Connection error:', error);
      setIsConnected(false);
    });

    socketRef.current.off('user-joined');
    socketRef.current.off('user-left');
    socketRef.current.off('user-disconnected');
    socketRef.current.off('offer');
    socketRef.current.off('answer');
    socketRef.current.off('ice-candidate');
    socketRef.current.off('media-state');
    socketRef.current.off('chat-message');
    socketRef.current.off('broadcast-sign-language');
    socketRef.current.off('broadcast-animation-complete');
    socketRef.current.off('broadcast-tts');
    socketRef.current.off('twilio-transcription');
    socketRef.current.off('speech-translation');
    socketRef.current.off('gemini-audio');

    // Signaling & WebRTC
    socketRef.current.on('user-joined', handleUserJoined);
    socketRef.current.on('user-left', handleUserLeft);
    socketRef.current.on('user-disconnected', handleUserLeft);
    socketRef.current.on('offer', handleOffer);
    socketRef.current.on('answer', handleAnswer);
    socketRef.current.on('ice-candidate', handleIceCandidate);
    socketRef.current.on('media-state', handleMediaState);

    // Features
    socketRef.current.on('chat-message', handleChatMessage);
    socketRef.current.on('broadcast-sign-language', handleBroadcastSignLanguage);
    socketRef.current.on('broadcast-animation-complete', handleBroadcastAnimationComplete);
    socketRef.current.on('broadcast-tts', handleBroadcastTTS);

    // Twilio transcription listener
    socketRef.current.on('twilio-transcription', (data) => {
      console.log('📞 Received Twilio transcription:', data);

      if (data.text && data.text.trim()) {
        // Display transcription in chat
        const message = {
          id: Date.now(),
          text: `📞 Phone: "${data.text}"`,
          sender: 'Twilio Call',
          timestamp: new Date().toLocaleTimeString()
        };
        setChatMessages(prev => [...prev, message]);

        // Trigger sign language avatar animation
        setCurrentText(data.text.trim());
        setIsSignLanguageActive(true);

        console.log('✅ Twilio transcription displayed and avatar activated');
      }
    });

    // MERGED: Single listener for speech-translation to handle both Avatar/TTS and Transcripts
    socketRef.current.on('speech-translation', async (data) => {
      console.log('🔊 [SOCKET] Received speech-translation:', data);
      const { text, sender, type, sourceLang, from, id } = data;

      // 1. Handle "Transcript" Type (Meeting Summary / Captions)
      if (type === 'transcript') {
        processSocketTranscript(data);
        return;
      }

      // 2. Handle "Speech" Type (Avatar & TTS)
      // IGNORE self-messages (prevents "hearing myself")
      if (from === socketRef.current?.id) {
        console.log(`🔇 Ignoring speech from self (${from})`);
        return;
      }

      console.log(`🔊 Received speech from ${sender}: ${text}`);

      // Show original immediately (Optimistic UI)
      const messageId = id || Date.now();

      // Check if we already have this message (dedupe) - though ID should be unique from event
      setChatMessages(prev => {
        if (prev.some(m => m.id === messageId)) return prev;
        return [...prev, {
          id: messageId,
          sender: sender || 'Signer',
          text: `🤟 ${text} (Translating...)`, // Immediate feedback
          timestamp: new Date().toLocaleTimeString()
        }];
      });

      // Also track for summary since we have the text now (redundant if using 'transcript' type properly, but keeping for safety in legacy mode)
      // recentTranscriptsRef.current.push({ ... }); 

      let spokenText = text;

      // Translate if enabled
      if (isTranslationEnabledRef.current && text) {
        // Prevent translating if source and target are same
        const targetLang = preferredLanguageRef.current.split('-')[0];
        const sourceLangCode = (sourceLang || 'en').split('-')[0];

        if (targetLang !== sourceLangCode) {
          console.log(`🌐 Translating incoming speech: "${text}" (${sourceLangCode} -> ${targetLang})`);
          const translated = await translateIncomingText(text, sourceLangCode, targetLang);
          if (translated) {
            spokenText = translated;

            // Update UI with translated text
            setChatMessages(prev => prev.map(m =>
              m.id === messageId ? { ...m, text: `🤟 ${translated}` } : m
            ));
          }
        } else {
          // Same lang, just remove loading state
          setChatMessages(prev => prev.map(m =>
            m.id === messageId ? { ...m, text: `🤟 ${text}` } : m
          ));
        }
      } else {
        // Translation disabled
        setChatMessages(prev => prev.map(m =>
          m.id === messageId ? { ...m, text: `🤟 ${text}` } : m
        ));
      }

      // Speak it!
      // Sign language: ALWAYS speak (deaf user has no audible voice via WebRTC)
      // Regular speech: ONLY speak if translation actually changed the text
      const isSignLanguage = type === 'sign';
      if (isSignLanguage) {
        speakText(spokenText, isTranslationEnabledRef.current ? preferredLanguageRef.current : (sourceLang || 'en-US'), data.emotion || 'neutral');
      } else if (isTranslationEnabledRef.current && spokenText !== text) {
        speakText(spokenText, preferredLanguageRef.current, data.emotion || 'neutral');
      }
    });

    // 🔊 GLOBAL GEMINI AUDIO LISTENER (For Remote Participants)
    // This allows everyone in the room to hear the ISL translation
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
    let nextStartTime = 0;

    socketRef.current.on('gemini-audio', async (data) => {
      if (data.audio) {
        try {
          if (audioCtx.state === 'suspended') await audioCtx.resume();

          // Decode Base64 -> Raw PCM (Int16)
          const binaryString = window.atob(data.audio);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          const int16Data = new Int16Array(bytes.buffer);

          // Convert Int16 -> Float32
          const float32Data = new Float32Array(int16Data.length);
          for (let i = 0; i < int16Data.length; i++) {
            float32Data[i] = int16Data[i] / 32768.0;
          }

          // Play
          const buffer = audioCtx.createBuffer(1, float32Data.length, 24000);
          buffer.getChannelData(0).set(float32Data);

          const source = audioCtx.createBufferSource();
          source.buffer = buffer;
          source.connect(audioCtx.destination);

          const currentTime = audioCtx.currentTime;
          if (nextStartTime < currentTime) nextStartTime = currentTime;

          setIsTTSPlaying(true);
          source.onended = () => setIsTTSPlaying(false);
          source.start(nextStartTime);
          nextStartTime += buffer.duration;

        } catch (e) {
          console.error("Global Audio Decode Error:", e);
          setIsTTSPlaying(false);
        }
      }
    });

    // Defer local media acquisition to react-webcam (VideoWithPoseDetection)
    // We'll join the room once onStreamReady provides the stream
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      socketRef.current?.disconnect();
    };
  }, [roomId, signalingUrl]);

  // switchStream is now provided by useMediaControls hook

  // isDuplicate helper is now in useMeetingSummary

  // Monitor mode changes to restore base stream when both modes are off
  useEffect(() => {
    if (!isSignToVoiceActive && !isISLTypingActive) {
      // If both modes are off, revert to the base stream if available
      if (baseStreamRef.current && localStreamRef.current !== baseStreamRef.current) {
        console.log('↩️ Reverting to base webcam stream');
        switchStream(baseStreamRef.current);
      }
    }
  }, [isSignToVoiceActive, isISLTypingActive, switchStream]);

  // WebRTC signaling and peer management moved to useWebRTC hook
  // handleChatMessage is now provided by useChat hook

  // Ref to track currently playing TTS audio
  const currentTTSAudioRef = useRef(null);

  // Robust Speech Helper using Google TTS API (Bypasses flaky browser voices)
  // speakText is now provided by useTranslation hook

  // translateIncomingText is now provided by useTranslation hook

  // Sign language handlers are now provided by useSignLanguage hook
  // sendChatMessage is now provided by useChat hook
  /* Background Speech Logic Removed */

  // handleTextChange is now provided by useSignLanguage hook

  // Handler for FINAL speech results (TTS/Translation)
  const handleFinalSpeech = useCallback((text) => {
    // IGNORE if muted
    if (isMuted) return;

    console.log('🎤 FINAL SPEECH DETECTED:', text);
    if (socketRef.current && text.trim()) {
      const currentUserName = user.name || 'You';

      // 1. Show in chat locally
      const message = {
        id: Date.now(),
        text: text.trim(),
        sender: currentUserName,
        timestamp: new Date().toLocaleTimeString()
      };
      setChatMessages(prev => [...prev, message]);

      // 2. Add to Live Transcript & broadcast transcript (handled by hook)
      addTranscription(text.trim(), currentUserName, 'local');

      // 3. Broadcast for remote avatar animation if Voice→Sign is on
      // Uses broadcast-sign-language with source='voice' so remote gets avatar only (no TTS)
      // Remote participants already hear the actual voice via WebRTC audio
      if (isBackgroundListening) {
        socketRef.current.emit('broadcast-sign-language', {
          roomId,
          text: text.trim(),
          sender: currentUserName,
          timestamp: Date.now(),
          senderSocketId: socketRef.current.id,
          sourceLang: preferredLanguageRef.current || 'en-US',
          msgId: message.id,
          source: 'voice'  // Tells receiver: animate avatar only, no TTS
        });
      }
    }
  }, [roomId, user.name, isBackgroundListening, isMuted, addTranscription, setChatMessages, socketRef, preferredLanguageRef]);


  // Memoize listening change handler to prevent restart loops
  const handleListeningChange = useCallback((listening) => {
    // Only activate Avatar if Voice->Sign mode is ON
    if (isBackgroundListening) {
      setIsSignLanguageActive(listening);
    }
    // ALWAYS update UI status for Transcript panel
    setIsSpeechActive(listening);
  }, [isBackgroundListening]);

  // toggleMute, toggleVideo, toggleScreenShare are now provided by useMediaControls hook
  const leaveRoom = async () => {
    // 1. Stop local media tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    
    // 2. Mark meeting as ended on server so it doesn't show "IN PROGRESS" in history
    try {
      await api.post(`/meetings/${roomId}/end`);
    } catch (err) {
      console.error('Failed to mark meeting as ended:', err);
    }

    // 3. Navigate back to dashboard
    navigate('/dashboard');
  };

  // endCallWithSummary is now in useMeetingSummary

  // Toggle background speech recognition
  const toggleBackgroundListening = () => {
    const newState = !isBackgroundListening;
    setIsBackgroundListening(newState);

    // Add system message
    const message = {
      id: Date.now(),
      text: newState ? '🎤 Background listening enabled' : '🔇 Background listening disabled',
      sender: 'System',
      timestamp: new Date().toLocaleTimeString()
    };
    setChatMessages(prev => [...prev, message]);
  };

  // Pre-load voices (only if browser supports speechSynthesis)
  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        console.log('🎤 Voices loaded:', voices.length);
      }
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);

  // Removed corrupted manual STT & duplicate testConnection logic.
  // toggleSignToVoice and subsequent functions are now correctly in scope.

  // Sign language, TTS and Typing handlers are now provided by useSignLanguage hook

  // Responsive grid: single column on small screens, scales up on larger screens
  // This keeps layout usable on phones while taking advantage of space on desktops

  return (
    <div className={`h-[100dvh] overflow-hidden bg-[#f6f8fb] font-sans ${cognitiveMode === 'reading' ? 'dyslexia-assist' : ''}`}>
      {/* Dynamic Meeting Engine: 2-Step Onboarding Modal */}
      {(userType === null || cognitiveMode === null) && (
        <UserTypeModal
          onComplete={(uType, cMode) => {
            setUserType(uType);
            setCognitiveMode(cMode);
          }}
        />
      )}

      <div className="flex flex-col h-[100dvh] overflow-hidden bg-[#fcfdff] text-slate-900 selection:bg-indigo-100 selection:text-indigo-900">
        <RoomHeader
          roomId={roomId}
          isConnected={isConnected}
          socketRef={socketRef}
          isSignLanguageActive={isSignLanguageActive}
          isBackgroundListening={isBackgroundListening}
          isSignToVoiceActive={isSignToVoiceActive}
          useClientAlphabetModel={useClientAlphabetModel}
          isISLTypingActive={isISLTypingActive}
          isTranslationEnabled={isTranslationEnabled}
          setIsTranslationEnabled={setIsTranslationEnabled}
          preferredLanguage={preferredLanguage}
          setPreferredLanguage={setPreferredLanguage}
          speakText={speakText}
          user={user}
          fetchSmartRewind={fetchSmartRewind}
          prominenceMode={prominenceMode}
          setProminenceMode={setProminenceMode}
          userType={userType}
          showAvatar={showAvatar}
        />
        {/* Hidden webcam to initialize camera at meeting start and provide single stream */}
        <Webcam
          audio={true}
          mirrored={true}
          style={{ position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }}
          onUserMedia={(stream) => {
            if (!baseStreamRef.current) {
              console.log('🎥 Initial stream captured as base stream');
              baseStreamRef.current = stream;
            }

            if (!localStreamRef.current) {
              console.log('🎥 Initial stream ready from hidden Webcam');
              localStreamRef.current = stream;
              setLocalStream(stream);

              stream.getAudioTracks().forEach(track => { track.enabled = !isMuted; });
              stream.getVideoTracks().forEach(track => { track.enabled = !isVideoOff; });

              if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
                const playPromise = localVideoRef.current.play?.();
                if (playPromise && typeof playPromise.then === 'function') {
                  playPromise.catch(() => { });
                }
              }
              const emitJoin = () => {
                if (!hasJoinedRef.current) {
                  console.log('🚀 Joining room with initial webcam stream:', roomId);
                  socketRef.current.emit('join-room', roomId);
                  hasJoinedRef.current = true;
                }
              };
              if (socketRef.current?.connected) {
                emitJoin();
              } else {
                socketRef.current?.once('connect', emitJoin);
              }
            }
          }}
          videoConstraints={{ facingMode: 'user' }}
        />

        {(() => {
          const isDeafMuteProfile = userType === 'deaf' || userType === 'mute';
          const isSignAvatarEnabled = true;
          const isSignAvatarVisible = showAvatar;
          const isScreenShareActive = false; // Placeholder for future feature

          const shouldUseAvatarSidebarLayout =
            isDeafMuteProfile &&
            isSignAvatarEnabled &&
            isSignAvatarVisible &&
            !isScreenShareActive;

          // Shared props for child components
          const stageProps = {
            userType, showAvatar, setShowAvatar,
            isSignLanguageActive, isBackgroundListening, isSignToVoiceActive,
            avatarType, setAvatarType, animationSpeed, setAnimationSpeed,
            pauseTime, setPauseTime, currentText, handleAnimationComplete,
            prominenceMode, localVideoRef, localStream, isMuted, isVideoOff,
            isISLTypingActive, roomId, socketRef, switchStream, hasJoinedRef,
            setDetectedISLText, preferredLanguageRef, userNameRef, user,
            handleSignTextDetected, handleSignSpeechGenerated, handleAlphabetLetter,
            handleAlphabetControlGesture, useClientAlphabetModel, typedPrefix,
            currentSuggestion, composedSentence, participants, setParticipantVideoRef,
            selfIdRef, activeSpeakerId, layoutMode, setLayoutMode,
            pinnedParticipantId, setPinnedParticipantId, cognitiveMode
          };

          if (isScreenShareActive) {
            // Future extension point
            return <div className="flex-1 overflow-hidden" />;
          }

          if (shouldUseAvatarSidebarLayout) {
            return (
              <div className="flex-1 min-h-0 relative flex overflow-hidden transition-all duration-300">
                <AvatarSidebarLayout {...stageProps} />
              </div>
            );
          }

          return (
            <div className="flex-1 min-h-0 relative flex overflow-hidden transition-all duration-300">
              <VideoGallery {...stageProps} />
              {isDeafMuteProfile && !isSignAvatarVisible && (
                <div className="absolute z-[100] top-4 left-4">
                  <button
                    onClick={() => setShowAvatar(true)}
                    className="px-5 py-2.5 rounded-full text-sm font-bold shadow-md transition-all flex items-center gap-2 transform hover:scale-105 active:scale-95 bg-white text-[#684CFE] ring-1 ring-indigo-200 hover:bg-slate-50"
                  >
                    🤟 Show Sign Avatar
                  </button>
                </div>
              )}
            </div>
          );
        })()}

        <ControlBar
          toggleMute={toggleMute}
          isMuted={isMuted}
          toggleVideo={toggleVideo}
          isVideoOff={isVideoOff}
          toggleBackgroundListening={toggleBackgroundListening}
          isBackgroundListening={isBackgroundListening}
          toggleSignToVoice={toggleSignToVoice}
          isSignToVoiceActive={isSignToVoiceActive}
          detectedISLText={detectedISLText}
          toggleISLTyping={toggleISLTyping}
          isISLTypingActive={isISLTypingActive}
          setShowChat={setShowChat}
          isCallWidgetOpen={isCallWidgetOpen}
          setIsCallWidgetOpen={setIsCallWidgetOpen}
          isSummaryEnabled={isSummaryEnabled}
          setIsSummaryEnabled={setIsSummaryEnabled}
          setShowTranscripts={setShowTranscripts}
          socketRef={socketRef}
          roomId={roomId}
          isSpeechActive={isSpeechActive}
          endCallWithSummary={endCallWithSummary}
          leaveRoom={leaveRoom}
          layoutMode={layoutMode}
          setLayoutMode={setLayoutMode}
        />
      </div>

      {(isBackgroundListening || isSummaryEnabled) && !isTranslationEnabled && (
        <div className="fixed bottom-4 right-4 z-40 opacity-0 pointer-events-none w-1 h-1 overflow-hidden">
          <NativeSpeechRecognition
            onTextChange={handleTextChange}
            onFinalResult={handleFinalSpeech}
            onListeningChange={handleListeningChange}
            language={preferredLanguage}
            isMuted={isMuted || isTTSPlaying}
            isActive={isBackgroundListening || isSummaryEnabled}
            localStream={localStream}
            isVoiceToSign={isBackgroundListening}
          />
        </div>
      )}

      <ChatModal
        showChat={showChat}
        setShowChat={setShowChat}
        chatMessages={chatMessages}
        chatInput={chatInput}
        setChatInput={setChatInput}
        sendChatMessage={sendChatMessage}
        user={user}
      />

      <ParticipantsModal
        showParticipants={showParticipants}
        setShowParticipants={setShowParticipants}
        user={user}
        participants={participants}
      />

      <TranscriptModal
        showTranscripts={showTranscripts}
        setShowTranscripts={setShowTranscripts}
        isSpeechActive={isSpeechActive}
        captions={captions}
        userNameRef={userNameRef}
        user={user}
      />


      <CallWidget isOpen={isCallWidgetOpen} onClose={() => setIsCallWidgetOpen(false)} />
    </div>
  );
};

export default IntegratedRoom;
