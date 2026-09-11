import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../lib/api';

/**
 * useTranslation — Manages translation state, TTS playback, and text translation.
 *
 * @returns Translation state, refs, and utility functions (speakText, translateIncomingText)
 */
export function useTranslation() {
    // State
    const [isTranslationEnabled, setIsTranslationEnabled] = useState(false);
    const [preferredLanguage, setPreferredLanguage] = useState('en-US');
    const [supportedLanguages, setSupportedLanguages] = useState([]);
    const [isTTSPlaying, setIsTTSPlaying] = useState(false);

    // Refs for stale closure avoidance
    const isTranslationEnabledRef = useRef(isTranslationEnabled);
    const preferredLanguageRef = useRef(preferredLanguage);
    const isTTSPlayingRef = useRef(false);
    const currentTTSAudioRef = useRef(null);

    // Multilingual speech recognition refs (managed here but lifecycle wired in parent)
    const multilingualRecRef = useRef(null);
    const multilingualRestartTimerRef = useRef(null);
    const multilingualAllowRestartRef = useRef(false);

    // Sync refs with state
    useEffect(() => {
        isTranslationEnabledRef.current = isTranslationEnabled;
        preferredLanguageRef.current = preferredLanguage;
    }, [isTranslationEnabled, preferredLanguage]);

    useEffect(() => {
        isTTSPlayingRef.current = isTTSPlaying;
    }, [isTTSPlaying]);

    // Fetch supported languages on mount
    useEffect(() => {
        api.get('/translate/supported-languages').then(res => {
            if (res.data?.languages) {
                setSupportedLanguages(res.data.languages);
            }
        }).catch(err => console.error('Failed to load languages', err));
    }, []);

    // Pre-load voices
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

    const FREE_PHRASES = ['hello', 'hi', 'how are you', 'thank you', 'thanks', 'goodbye', 'bye'];

    // Robust Speech Helper using Google TTS API (Bypasses flaky browser voices)
    const speakText = useCallback((text, language, emotion = 'neutral') => {
        if (!text) return;

        const normalizedText = text.toLowerCase().trim().replace(/[?.!,]/g, '');
        const isFree = FREE_PHRASES.includes(normalizedText);

        // 1. Stop any existing audio playback to prevent echo/reverberation

        if (currentTTSAudioRef.current) {
            try {
                currentTTSAudioRef.current.pause();
                currentTTSAudioRef.current.currentTime = 0;
                currentTTSAudioRef.current = null;
            } catch (e) {
                console.warn('Error stopping previous TTS audio:', e);
            }
        }

        // 2. Stop any existing browser speech to be safe
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }

        setIsTTSPlaying(true);
        isTTSPlayingRef.current = true;

        // PAUSE multilingual recognition while TTS plays to prevent mic-feedback loop
        if (multilingualRecRef.current) {
            try {
                multilingualRecRef.current.stop();
                console.log('🔇 [TTS] Paused multilingual recognition during TTS');
            } catch (e) { /* ignore */ }
        }

        try {
            // Emotion Simulation Mapping (Safe values, volume must be 0.0 - 1.0)
            const emotionMap = {
                happy: { pitch: 1.25, rate: 1.15, volume: 1.0 },
                sad: { pitch: 0.8, rate: 0.85, volume: 0.7 },
                angry: { pitch: 0.7, rate: 1.2, volume: 1.0 },
                surprised: { pitch: 1.3, rate: 1.2, volume: 1.0 },
                fearful: { pitch: 1.2, rate: 1.3, volume: 0.9 },
                disgusted: { pitch: 0.85, rate: 0.9, volume: 0.8 },
                neutral: { pitch: 1.0, rate: 1.0, volume: 1.0 }
            };
            const style = emotionMap[emotion] || emotionMap.neutral;

            // 3. Use our own SERVER PROXY to avoid browser blocking
            // BYPASS for free phrases to save Vertex AI/Google TTS costs
            if (isFree && 'speechSynthesis' in window) {
                console.log(`🆓 [TTS] Using FREE browser TTS for common phrase: "${text}"`);
                const u = new SpeechSynthesisUtterance(text);
                const langCode = (language || 'en-US');
                u.lang = langCode;

                const emotionMap = {
                    happy: { pitch: 1.25, rate: 1.15, volume: 1.0 },
                    sad: { pitch: 0.8, rate: 0.85, volume: 0.7 },
                    angry: { pitch: 0.7, rate: 1.2, volume: 1.0 },
                    surprised: { pitch: 1.3, rate: 1.2, volume: 1.0 },
                    neutral: { pitch: 1.0, rate: 1.0, volume: 1.0 }
                };
                const style = emotionMap[emotion] || emotionMap.neutral;
                u.pitch = style.pitch;
                u.rate = style.rate;
                u.volume = style.volume;

                u.onstart = () => setIsTTSPlaying(true);
                u.onend = () => {
                    setIsTTSPlaying(false);
                    isTTSPlayingRef.current = false;
                    // Resume recognition
                    if (multilingualRecRef.current && multilingualAllowRestartRef.current) {
                        try { multilingualRecRef.current.start(); } catch { }
                    }
                };
                u.onerror = () => setIsTTSPlaying(false);
                window.speechSynthesis.speak(u);
                return;
            }

            const langCode = (language || 'en').split('-')[0];

            const encodedText = encodeURIComponent(text);

            const signalingOrigin = import.meta.env.VITE_SIGNALING_URL || 'http://localhost:5000';
            
            // Removed &emotion from backend proxy to prevent 400 Bad Request if backend validates params
            const url = `${signalingOrigin.replace(/\/$/, '')}/api/translate/tts?text=${encodedText}&lang=${langCode}`;

            // 4. Play Audio
            const audio = new Audio(url);
            audio.crossOrigin = "anonymous";
            
            // Apply emotional speed/volume modifiers to the Proxy Audio stream too!
            audio.playbackRate = style.rate;
            audio.volume = style.volume;

            currentTTSAudioRef.current = audio;

            console.log(`🔊 Fetching TTS from Proxy: "${text}" (${langCode}, Emotion: ${emotion}, Rate: ${style.rate})`);

            // Safety timeout
            const safetyTimeout = setTimeout(() => {
                console.warn('⚠️ TTS safety timeout: resetting isTTSPlaying');
                setIsTTSPlaying(false);
                if (currentTTSAudioRef.current === audio) {
                    currentTTSAudioRef.current = null;
                }
            }, 10000);

            // Clean up reference when audio finishes
            audio.addEventListener('ended', () => {
                clearTimeout(safetyTimeout);
                setIsTTSPlaying(false);
                isTTSPlayingRef.current = false;
                if (currentTTSAudioRef.current === audio) {
                    currentTTSAudioRef.current = null;
                }
                // RESUME multilingual recognition after TTS ends
                if (multilingualRecRef.current && multilingualAllowRestartRef.current) {
                    setTimeout(() => {
                        if (multilingualRecRef.current && !isTTSPlayingRef.current) {
                            try {
                                multilingualRecRef.current.start();
                                console.log('🌐 [TTS] Resumed multilingual recognition after TTS');
                            } catch (e) { /* ignore - onend will handle */ }
                        }
                    }, 500);
                }
            });

            audio.addEventListener('error', () => {
                clearTimeout(safetyTimeout);
                setIsTTSPlaying(false);
                isTTSPlayingRef.current = false;
                if (currentTTSAudioRef.current === audio) {
                    currentTTSAudioRef.current = null;
                }
                // RESUME multilingual recognition after TTS error
                if (multilingualRecRef.current && multilingualAllowRestartRef.current) {
                    setTimeout(() => {
                        if (multilingualRecRef.current && !isTTSPlayingRef.current) {
                            try { multilingualRecRef.current.start(); } catch (e) { /* ignore */ }
                        }
                    }, 500);
                }
            });

            audio.play().then(() => {
                console.log("✅ Audio Playing Successfully with Emotion:", emotion);
            }).catch(err => {
                console.error("❌ Audio Playback Failed (Proxy):", err);

                if (currentTTSAudioRef.current === audio) {
                    currentTTSAudioRef.current = null;
                }
                setIsTTSPlaying(false);

                // Final Fallback to Browser Native TTS with EMOTION simulation
                if ('speechSynthesis' in window) {
                    console.log(`⚠️ Browser Native TTS Fallback (Emotion: ${emotion})...`);
                    const u = new SpeechSynthesisUtterance(text);
                    u.lang = language || 'en-US';
                    
                    u.pitch = style.pitch;
                    u.rate = style.rate;
                    u.volume = style.volume;

                    u.onstart = () => setIsTTSPlaying(true);
                    u.onend = () => setIsTTSPlaying(false);
                    u.onerror = () => setIsTTSPlaying(false);
                    window.speechSynthesis.speak(u);
                } else {
                    setIsTTSPlaying(false);
                }
            });

        } catch (e) {
            console.error("❌ Google TTS setup failed:", e);
            setIsTTSPlaying(false);
        }
    }, []);

    const normalizeLangCode = (language, fallback = 'en') => {
        return (language || fallback).split('-')[0].toLowerCase();
    };

    // Helper function to translate text
    const translateIncomingText = useCallback(async (text, sourceLanguage, targetLanguage) => {
        if (!text || !isTranslationEnabledRef.current) return text;

        const sourceLang = normalizeLangCode(sourceLanguage, 'auto');
        const targetLang = normalizeLangCode(targetLanguage || preferredLanguageRef.current, 'en');

        if (sourceLang !== 'auto' && sourceLang === targetLang) {
            return text;
        }

        console.error(`🔥 TRANSLATE START: "${text}" ${sourceLang} -> ${targetLang}`);

        try {
            const res = await api.post('/translate', {
                q: text,
                source: sourceLang,
                target: targetLang
            });

            if (res.data?.translatedText) {
                console.error(`🔥 TRANSLATED DONE: "${res.data.translatedText}"`);
                return res.data.translatedText;
            }
        } catch (error) {
            console.error('🔥 TRANSLATION FAILED:', error);
        }
        return text; // Fallback to original
    }, []);

    return {
        // State
        isTranslationEnabled,
        setIsTranslationEnabled,
        preferredLanguage,
        setPreferredLanguage,
        supportedLanguages,
        isTTSPlaying,
        setIsTTSPlaying,

        // Refs (exposed for parent to wire multilingual recognition lifecycle)
        isTranslationEnabledRef,
        preferredLanguageRef,
        isTTSPlayingRef,
        multilingualRecRef,
        multilingualRestartTimerRef,
        multilingualAllowRestartRef,

        // Handlers
        speakText,
        translateIncomingText
    };
}
