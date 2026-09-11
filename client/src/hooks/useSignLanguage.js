import { useState, useCallback, useRef } from 'react';
import { getSuggestions, nextSuggestion } from '../lib/suggest';

/**
 * useSignLanguage — Manages Sign Language detection, ISL typing, and Avatar animations.
 * 
 * @param {Object} params
 * @param {React.MutableRefObject} params.socketRef - Socket.IO ref
 * @param {string} params.roomId - Current room ID
 * @param {Function} params.setChatMessages - Function to update chat messages
 * @param {Function} params.speakText - Function to speak text (from useTranslation)
 * @param {React.MutableRefObject} params.isTranslationEnabledRef - Translation ref
 * @param {Function} params.translateIncomingText - Translation function
 * @param {React.MutableRefObject} params.preferredLanguageRef - Language ref
 * @returns Sign language state and handlers
 */
export function useSignLanguage({
    socketRef,
    roomId,
    setChatMessages,
    speakText,
    isTranslationEnabledRef,
    translateIncomingText,
    preferredLanguageRef
}) {
    const [isSignLanguageActive, setIsSignLanguageActive] = useState(false);
    const [avatarType, setAvatarType] = useState('xbot');
    const [animationSpeed, setAnimationSpeed] = useState(0.4);
    const [pauseTime, setPauseTime] = useState(300);
    const [currentText, setCurrentText] = useState('');
    const [isSignToVoiceActive, setIsSignToVoiceActive] = useState(false);
    const [isISLTypingActive, setIsISLTypingActive] = useState(false);
    const [useClientAlphabetModel, setUseClientAlphabetModel] = useState(true);
    const [typedPrefix, setTypedPrefix] = useState('');
    const [currentSuggestion, setCurrentSuggestion] = useState('');
    const [composedSentence, setComposedSentence] = useState('');
    const [detectedISLText, setDetectedISLText] = useState('');

    const handleAnimationComplete = useCallback(() => {
        // Don't set isSignLanguageActive to false here!
        // It should depend on whether we are still processing/listening
        console.log('✅ [AVATAR] Animation complete in room:', roomId);

        // Broadcast completion to other participants
        if (socketRef.current) {
            socketRef.current.emit('broadcast-animation-complete', {
                roomId,
                timestamp: Date.now(),
                senderSocketId: socketRef.current.id
            });
        }
    }, [socketRef, roomId]);

    const handleBroadcastSignLanguage = useCallback(async (data) => {
        try {
            console.error("🔥 BROADCAST RECEIVED from " + (data.senderSocketId || 'unknown') + ":", data);

            if (data.senderSocketId === socketRef.current?.id) {
                console.error("🔥 IGNORING SELF BROADCAST");
                return;
            }

            let textToProcess = data.text;

            if (isTranslationEnabledRef.current) {
                console.error("🔥 TRANSLATION ENABLED, PROCESSING...");
                textToProcess = await translateIncomingText(data.text, data.sourceLang, preferredLanguageRef.current);
            }

            console.error("🔥 SETTING AVATAR TEXT:", textToProcess);
            setCurrentText(textToProcess);
            setIsSignLanguageActive(true);

            const messageId = data.msgId || Date.now();
            setChatMessages(prev => {
                if (prev.some(m => m.id === messageId)) return prev;
                return [...prev, {
                    id: messageId,
                    sender: data.sender || 'Signer',
                    text: `🤟 ${textToProcess}`,
                    timestamp: new Date().toLocaleTimeString()
                }];
            });

            // Only TTS for Sign→Voice broadcasts, NOT for Voice→Sign
            // Voice→Sign sets source='voice' — those should animate avatar only (no audio)
            // The speaker's actual voice is already audible via WebRTC audio
            if (data.source !== 'voice') {
                speakText(textToProcess, isTranslationEnabledRef.current ? preferredLanguageRef.current : (data.sourceLang || 'en-US'), data.emotion || 'neutral');
            }
        } catch (e) {
            console.error("🔥 Broadcast error:", e);
        }
    }, [socketRef, isTranslationEnabledRef, translateIncomingText, setChatMessages, speakText, preferredLanguageRef]);

    const handleBroadcastAnimationComplete = useCallback((data) => {
        if (data.senderSocketId === socketRef.current?.id) return;
        setIsSignLanguageActive(false);
    }, [socketRef]);

    const toggleSignToVoice = useCallback(() => {
        const next = !isSignToVoiceActive;
        if (!next) setDetectedISLText('');
        setIsSignToVoiceActive(next);
        if (next && isISLTypingActive) setIsISLTypingActive(false);

        setChatMessages(prev => [...prev, {
            id: Date.now(),
            text: next ? 'Sign-to-Voice detection started' : 'Sign-to-Voice detection stopped',
            sender: 'System',
            timestamp: new Date().toLocaleTimeString()
        }]);
    }, [isSignToVoiceActive, isISLTypingActive, setChatMessages]);

    const handleSignTextDetected = useCallback((text, gesture, emotion) => {
        if (!text) return;
        setDetectedISLText(text);

        setChatMessages(prev => [...prev, {
            id: Date.now(),
            text: `🤟 Sign detected: ${text} (${gesture})`,
            sender: 'You (Sign)',
            timestamp: new Date().toLocaleTimeString()
        }]);

        if (socketRef.current) {
            socketRef.current.emit('broadcast-sign-language', {
                roomId,
                text,
                gesture,
                sender: 'You',
                senderSocketId: socketRef.current.id,
                sourceLang: preferredLanguageRef.current,
                msgId: Date.now(),
                emotion: emotion || 'neutral'
            });
        }
    }, [socketRef, roomId, preferredLanguageRef, setChatMessages]);

    const handleSignSpeechGenerated = useCallback((text, emotion) => {
        if (!text) return;

        // Fingerspelling: broadcast detected letter as TTS to OTHER participants.
        // No local avatar, no local TTS — the signer only sees the overlay.
        if (socketRef.current) {
            socketRef.current.emit('broadcast-tts', {
                roomId,
                text,
                senderId: socketRef.current.id,
                emotion: emotion || 'neutral'
            });
        }
    }, [socketRef, roomId]);

    const handleBroadcastTTS = useCallback(async ({ text, senderId, emotion }) => {
        if (senderId === socketRef.current?.id) return;

        let textToSpeak = text;
        if (isTranslationEnabledRef.current) {
            textToSpeak = await translateIncomingText(text, 'en', preferredLanguageRef.current);
        }

        setChatMessages(prev => [...prev, {
            id: Date.now(),
            text: `🔊 Sign detected: "${textToSpeak}"`,
            sender: 'Remote Signer',
            timestamp: new Date().toLocaleTimeString()
        }]);

        // Only speak via TTS — NO avatar animation for fingerspelling
        speakText(textToSpeak, isTranslationEnabledRef.current ? preferredLanguageRef.current : 'en-US', emotion || 'neutral');
    }, [socketRef, isTranslationEnabledRef, translateIncomingText, setChatMessages, speakText, preferredLanguageRef]);

    const toggleISLTyping = useCallback(() => {
        const next = !isISLTypingActive;
        if (next && isSignToVoiceActive) setIsSignToVoiceActive(false);
        setIsISLTypingActive(next);

        if (!next) {
            setTypedPrefix('');
            setCurrentSuggestion('');
            setComposedSentence('');
        }

        setChatMessages(prev => [...prev, {
            id: Date.now(),
            text: next ? 'ISL Alphabet Typing enabled' : 'ISL Alphabet Typing disabled',
            sender: 'System',
            timestamp: new Date().toLocaleTimeString()
        }]);
    }, [isISLTypingActive, isSignToVoiceActive, setChatMessages]);

    const toggleClientAlphabet = useCallback(() => {
        const next = !useClientAlphabetModel;
        if (next && isSignToVoiceActive) setIsSignToVoiceActive(false);
        if (next && !isISLTypingActive) setIsISLTypingActive(true);
        setUseClientAlphabetModel(next);

        setChatMessages(prev => [...prev, {
            id: Date.now(),
            text: next
                ? 'Client-side ISL alphabet predictions enabled (ONNX runtime)'
                : 'Client-side ISL alphabet predictions disabled (server fallback)',
            sender: 'System',
            timestamp: new Date().toLocaleTimeString()
        }]);
    }, [useClientAlphabetModel, isSignToVoiceActive, isISLTypingActive, setChatMessages]);

    const handleAlphabetLetter = useCallback((letter) => {
        const next = (typedPrefix + letter).toLowerCase();
        setTypedPrefix(next);
        const [sugg] = getSuggestions(next, 1);
        setCurrentSuggestion(sugg || '');
    }, [typedPrefix]);

    const commitWordToSentence = useCallback(() => {
        const word = (currentSuggestion || typedPrefix).trim();
        if (!word) return;
        const nextSentence = (composedSentence + ' ' + word).trim();
        setComposedSentence(nextSentence + ' ');
        setTypedPrefix('');
        setCurrentSuggestion('');
    }, [typedPrefix, currentSuggestion, composedSentence]);

    const finalizeSentence = useCallback(() => {
        const finalText = (composedSentence + ' ' + (currentSuggestion || typedPrefix)).trim();
        if (!finalText) return;

        const message = {
            id: Date.now(),
            text: finalText,
            sender: 'You',
            timestamp: new Date().toLocaleTimeString()
        };
        setChatMessages(prev => [...prev, message]);
        socketRef.current?.emit('chat-message', { roomId, message: message.text, sender: 'You' });

        setComposedSentence('');
        setTypedPrefix('');
        setCurrentSuggestion('');
    }, [composedSentence, currentSuggestion, typedPrefix, socketRef, roomId, setChatMessages]);

    const handleAlphabetControlGesture = useCallback((gesture) => {
        if (gesture === 'yes') {
            if (currentSuggestion) setTypedPrefix(currentSuggestion);
        } else if (gesture === 'no') {
            const next = nextSuggestion(currentSuggestion, typedPrefix);
            if (next) setCurrentSuggestion(next);
        } else if (gesture === 'hello') {
            commitWordToSentence();
        } else if (gesture === 'help') {
            if (typedPrefix.length > 0) {
                const trimmed = typedPrefix.slice(0, -1);
                setTypedPrefix(trimmed);
                const [sugg] = getSuggestions(trimmed, 1);
                setCurrentSuggestion(sugg || '');
            }
        } else if (gesture === 'thank_you') {
            finalizeSentence();
        }
    }, [currentSuggestion, typedPrefix, commitWordToSentence, finalizeSentence]);

    const handleTextChange = useCallback(async (text) => {
        // Local avatar update only — no broadcast on interim text.
        // Broadcasting on every interim fragment caused TTS spam on remote participants.
        // Final results are broadcast via handleFinalSpeech in IntegratedRoom.
        setCurrentText(text);
        setIsSignLanguageActive(true);
    }, []);

    return {
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
    };
}
