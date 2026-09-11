import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import io from 'socket.io-client';
import SmartReplyPanel from '../components/SmartReplyPanel';
import CallWidget from '../components/CallWidget';
import SamvaadSemanticEngineInspector from '../components/SamvaadSemanticEngineInspector';
import SamvaadLogo from '../assets/samvaad-logo.png';

const LANGUAGE_LOCALES = {
  en: 'en-US',
  hi: 'hi-IN',
  ta: 'ta-IN',
  te: 'te-IN',
  mr: 'mr-IN',
  gu: 'gu-IN',
  bn: 'bn-IN',
  es: 'es-ES',
  fr: 'fr-FR',
  de: 'de-DE',
  ja: 'ja-JP',
  ko: 'ko-KR',
  zh: 'zh-CN'
};

const normalizeLanguageCode = (language, fallback = 'en') => {
  const value = String(language || fallback).trim().toLowerCase();
  return value ? value.split('-')[0] : fallback;
};

const toSpeechRecognitionLang = (language) => {
  const code = normalizeLanguageCode(language, 'en');
  return LANGUAGE_LOCALES[code] || language || 'en-US';
};

const isInvalidTranslatedText = (text) => {
  const normalized = String(text || '').trim().toLowerCase();
  return !normalized || normalized.includes('invalid source language') || normalized.includes('invalid target language') || normalized.includes('translation failed');
};
export default function MultiCallRoom() {
  const { roomId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();

  // Get language from URL params, default to English
  const urlLanguage = normalizeLanguageCode(params.get('lang') || 'en', 'en');

  const [participants, setParticipants] = useState([]); // {id, stream}
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  // Translation and Caption States
  const [captions, setCaptions] = useState([]); // {id, text, speaker, timestamp}
  const [preferredLang, setPreferredLang] = useState(urlLanguage);
  const preferredLangRef = useRef(urlLanguage);
  const [lockedLang, setLockedLang] = useState(false);
  const [showLangModal, setShowLangModal] = useState(false);
  const [translatedCaptions, setTranslatedCaptions] = useState([]); // {id, text, timestamp}
  const [meetingSummary, setMeetingSummary] = useState([]); // {id, original, translated, speaker, timestamp}
  const [paragraphSummary, setParagraphSummary] = useState("No conversation yet. Start speaking to see the meeting summary.");
  const [dataChannelStatus, setDataChannelStatus] = useState('Disconnected');
  const [socketStatus, setSocketStatus] = useState('Disconnected');
  const [showEngineInspector, setShowEngineInspector] = useState(false);

  const [supportedLanguages, setSupportedLanguages] = useState([
    { code: 'en', name: 'English', nativeName: 'English' },
    { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
    { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்' },
    { code: 'es', name: 'Spanish', nativeName: 'Español' },
    { code: 'fr', name: 'French', nativeName: 'Français' },
    { code: 'de', name: 'German', nativeName: 'Deutsch' },
    { code: 'ja', name: 'Japanese', nativeName: '日本語' },
    { code: 'ko', name: 'Korean', nativeName: '한국어' },
    { code: 'zh', name: 'Chinese', nativeName: '中文' }
  ]);

  const socketRef = useRef(null);
  const selfIdRef = useRef(null);
  const pcsRef = useRef({});
  const remoteStreamsRef = useRef({});
  const localStreamRef = useRef(null);
  const localVideoRef = useRef(null);
  const dataChannelsRef = useRef({});
  const speechRecRef = useRef(null);
  const speechRestartTimerRef = useRef(null);
  const allowSpeechRestartRef = useRef(false);
  const [isSpeechActive, setIsSpeechActive] = useState(false);
  const speechRecognitionRef = useRef(null);

  // Smart Reply States
  const [smartReplies, setSmartReplies] = useState([]);
  const [isLoadingReplies, setIsLoadingReplies] = useState(false);
  const lastSmartReplyFetchRef = useRef(0);

  // Twilio Call State
  const [isCallWidgetOpen, setIsCallWidgetOpen] = useState(false);

  const signalingUrl = useMemo(() => {
    const userUrl = params.get('sig');
    if (userUrl) return userUrl;
    // Fallback to env var or default dev logic
    return import.meta.env.VITE_SIGNALING_URL || window.location.origin.replace(/\/$/, '').replace(':5173', ':5000');
  }, [params]);

  useEffect(() => {
    socketRef.current = io(signalingUrl || undefined, { withCredentials: true, auth: { token: localStorage.getItem('token') } });
    socketRef.current.on('connect', () => {
      selfIdRef.current = socketRef.current.id;
      setSocketStatus('Connected');
      console.log('🔌 WebSocket connected, ID:', selfIdRef.current);
    });
    socketRef.current.on('disconnect', () => {
      setSocketStatus('Disconnected');
      console.log('🔌 WebSocket disconnected');
    });
    socketRef.current.on('user-joined', handleUserJoined);
    socketRef.current.on('user-left', handleUserLeft);
    socketRef.current.on('offer', handleOffer);
    socketRef.current.on('answer', handleAnswer);
    socketRef.current.on('ice-candidate', handleCandidate);

    // Listen for speech translation via WebSocket
    socketRef.current.on('speech-translation', (data) => {
      console.log('🔊 [WEBSOCKET] ========== RECEIVED SPEECH TRANSLATION EVENT ==========');
      console.log('🔊 [WEBSOCKET] Full data object:', JSON.stringify(data, null, 2));
      console.log('🔊 [WEBSOCKET] Self ID:', selfIdRef.current);
      console.log('🔊 [WEBSOCKET] Data from:', data?.from);
      console.log('🔊 [WEBSOCKET] Socket connected:', socketRef.current?.connected);
      console.log('🔊 [WEBSOCKET] Socket ID:', socketRef.current?.id);
      console.log('🔊 [WEBSOCKET] Data type:', typeof data);
      console.log('🔊 [WEBSOCKET] Data keys:', data ? Object.keys(data) : 'null/undefined');

      // Validate data structure
      if (!data || typeof data !== 'object') {
        console.error('❌ [WEBSOCKET] Invalid data structure - data is:', data);
        return;
      }

      if (!data.text || !data.sourceLang || !data.from) {
        console.error('❌ [WEBSOCKET] Missing required fields:', {
          text: !!data.text,
          sourceLang: !!data.sourceLang,
          from: !!data.from,
          actualData: data
        });
        return;
      }

      // Only process if it's not from ourselves
      if (data.from !== selfIdRef.current) {
        console.log('🔊 [WEBSOCKET] ✅ Processing speech translation from peer:', data.from);
        console.log('🔊 [WEBSOCKET] Text:', data.text);
        console.log('🔊 [WEBSOCKET] Source Lang:', data.sourceLang);
        console.log('🔊 [WEBSOCKET] My ID:', selfIdRef.current);
        console.log('🔊 [WEBSOCKET] From ID:', data.from);
        console.log('🔊 [WEBSOCKET] Calling handleSpeechTranslation now...');
        handleSpeechTranslation(data);
      } else {
        console.log('🔊 [WEBSOCKET] ⏭️ Ignoring speech translation from self (ID:', selfIdRef.current, ')');
      }
    });

    async function getMediaAndJoin() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          const p = localVideoRef.current.play?.();
          if (p && typeof p.then === 'function') p.catch(() => { });
        }
        if (socketRef.current?.connected) {
          socketRef.current.emit('join-room', roomId);
        } else {
          socketRef.current?.once('connect', () => socketRef.current.emit('join-room', roomId));
        }
      } catch (e) {
        console.error(e);
      }
    }
    getMediaAndJoin();

    return () => {
      Object.values(pcsRef.current).forEach(pc => pc.close());
      pcsRef.current = {};
      if (localStreamRef.current) localStreamRef.current.getTracks().forEach(t => t.stop());
      socketRef.current?.disconnect();
    };
  }, [roomId, signalingUrl]);

  // Load supported languages from API
  useEffect(() => {
    const loadSupportedLanguages = async () => {
      try {
        // Always use relative path for Vite proxy in development
        // The proxy in vite.config.js will forward /api/* to http://localhost:5000/api/*
        const apiUrl = '/api/translate/supported-languages';

        console.log('🌐 [LANGUAGES] Loading from:', apiUrl);

        const response = await fetch(apiUrl, { credentials: 'include' });
        if (response.ok) {
          const data = await response.json();
          setSupportedLanguages(data.languages);
          console.log('✅ [LANGUAGES] Loaded supported languages:', data.languages.length);
        } else {
          console.log('⚠️ [LANGUAGES] Could not load supported languages, using defaults. Status:', response.status);
        }
      } catch (error) {
        console.log('⚠️ [LANGUAGES] Could not load supported languages, using defaults:', error.message);
      }
    };
    loadSupportedLanguages();
  }, []); // Remove signalingUrl dependency - always use proxy

  // SIMPLE VOICE TRANSLATION SYSTEM - REWRITTEN FROM SCRATCH
  const [isTranslating, setIsTranslating] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  // Localized labels for summary (translated to user's preferred language)
  const [summaryLabels, setSummaryLabels] = useState({ you: 'You', peer: 'Other participant' });

  // Simple translation function with proper error handling
  const translateText = async (text, fromLang, toLang) => {
    if (!text || text.trim().length === 0) {
      console.log('🔄 [TRANSLATE] Empty text, returning');
      return text;
    }

    // Normalize language codes (remove region codes if present)
    const normalizedFrom = normalizeLanguageCode(fromLang, '');
    const normalizedTo = normalizeLanguageCode(toLang, 'en');

    // Skip translation if same language
    if (normalizedFrom === normalizedTo) {
      console.log(`ℹ️ [TRANSLATE] Same language (${normalizedFrom}), skipping translation`);
      return text;
    }

    console.log(`🔄 [TRANSLATE] Starting translation: "${text}" (${normalizedFrom} → ${normalizedTo})`);
    console.log(`🔄 [TRANSLATE] Original lang codes: from=${fromLang}, to=${toLang}`);
    setIsTranslating(true);

    try {
      // Always use relative path for Vite proxy in development
      // The proxy in vite.config.js will forward /api/* to http://localhost:5000/api/*
      const apiUrl = '/api/translate';

      console.log(`🌐 [TRANSLATE] Translation API URL: ${apiUrl}`);

      const requestBody = { q: text, source: normalizedFrom, target: normalizedTo };
      console.log(`🔄 [TRANSLATE] Request body:`, requestBody);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        credentials: 'include'
      });

      console.log(`🔄 [TRANSLATE] Response status:`, response.status, response.statusText);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`API error: ${response.status} - ${errorData.message || response.statusText}`);
      }

      const data = await response.json();
      console.log(`🔄 [TRANSLATE] Response data:`, data);

      const result = data?.translatedText || data?.translated || '';

      console.log(`🔄 [TRANSLATE] Extracted result: "${result}"`);

      if (isInvalidTranslatedText(result)) {
        throw new Error('Translation provider returned invalid text');
      }

      if (result === text) {
        console.warn(`⚠️ [TRANSLATE] Translation returned same text, might have failed`);
        console.warn(`⚠️ [TRANSLATE] Original: "${text}", Result: "${result}"`);
      } else {
        console.log(`✅ [TRANSLATE] Translation successful: "${text}" → "${result}"`);
        console.log(`✅ [TRANSLATE] Method used: ${data?.method || 'unknown'}`);
      }

      return result;
    } catch (error) {
      console.error('❌ Translation failed:', error);
      console.error('❌ Error details:', {
        message: error.message,
        text,
        fromLang,
        toLang
      });
      // Return original text on error so user still sees something
      return text;
    } finally {
      setIsTranslating(false);
    }
  };

  // Enhanced TTS function with better error handling and voice loading
  const speakText = (text, lang) => {
    if (!text || text.trim().length === 0) {
      console.log('🔊 [TTS] Empty text, skipping TTS');
      return;
    }

    if (!window.speechSynthesis) {
      console.error('🔊 [TTS] ❌ Speech synthesis not available');
      return;
    }

    console.log(`🔊 [TTS] Starting TTS: "${text}" in ${lang}`);
    console.log(`🔊 [TTS] Speech synthesis available:`, !!window.speechSynthesis);
    console.log(`🔊 [TTS] Currently speaking:`, window.speechSynthesis.speaking);

    // Function to actually speak (called after voices are loaded)
    const doSpeak = () => {
      try {
        // Stop any current speech
        window.speechSynthesis.cancel();

        // Wait a moment for cancellation
        setTimeout(() => {
          try {
            // Create new speech
            const utterance = new SpeechSynthesisUtterance(text.trim());
            utterance.lang = lang;
            utterance.rate = 0.9;
            utterance.volume = 1.0;
            utterance.pitch = 1.0;

            console.log(`🔊 [TTS] Utterance created:`, {
              text: utterance.text,
              lang: utterance.lang,
              rate: utterance.rate,
              volume: utterance.volume
            });

            // Get available voices (may need to be called multiple times)
            let voices = window.speechSynthesis.getVoices();
            console.log(`🔊 [TTS] Available voices:`, voices.length);

            // If no voices, wait a bit and try again (voices load asynchronously)
            if (voices.length === 0) {
              console.log('🔊 [TTS] No voices available yet, waiting...');
              setTimeout(() => {
                voices = window.speechSynthesis.getVoices();
                console.log(`🔊 [TTS] Voices after wait:`, voices.length);
                if (voices.length > 0) {
                  selectAndSpeak(voices, utterance);
                } else {
                  // Speak without voice selection
                  console.log('🔊 [TTS] Speaking without voice selection');
                  setupUtterance(utterance);
                  window.speechSynthesis.speak(utterance);
                }
              }, 500);
              return;
            }

            selectAndSpeak(voices, utterance);

          } catch (error) {
            console.error('🔊 [TTS] ❌ Failed to create utterance:', error);
            setIsSpeaking(false);
          }
        }, 50);
      } catch (error) {
        console.error('🔊 [TTS] ❌ Error in doSpeak:', error);
        setIsSpeaking(false);
      }
    };

    // Helper function to select voice and speak
    const selectAndSpeak = (voices, utterance) => {
      // Try to find a voice for the language
      const langCode = lang.split('-')[0].toLowerCase(); // Get base language code (e.g., 'hi' from 'hi-IN')

      // Map language codes to common TTS language formats
      const langMap = {
        'hi': 'hi-IN',
        'en': 'en-US',
        'es': 'es-ES',
        'fr': 'fr-FR',
        'de': 'de-DE',
        'ja': 'ja-JP',
        'ko': 'ko-KR',
        'zh': 'zh-CN'
      };

      const ttsLang = langMap[langCode] || lang;
      utterance.lang = ttsLang; // Set proper TTS language format

      console.log(`🔊 [TTS] Looking for voice with lang: ${ttsLang} (code: ${langCode})`);

      const targetVoice = voices.find(voice =>
        voice.lang.toLowerCase().startsWith(langCode) && voice.localService
      ) || voices.find(voice =>
        voice.lang.toLowerCase().startsWith(langCode)
      ) || voices.find(voice =>
        voice.lang.toLowerCase().includes(langCode)
      ) || voices.find(voice =>
        voice.lang.toLowerCase().includes(ttsLang.toLowerCase())
      ) || voices[0];

      if (targetVoice) {
        utterance.voice = targetVoice;
        console.log(`🔊 [TTS] Using voice: ${targetVoice.name} (${targetVoice.lang})`);
      } else {
        console.log(`🔊 [TTS] Using default voice for ${ttsLang}`);
        if (voices.length > 0) {
          console.log(`🔊 [TTS] Available voices:`, voices.map(v => `${v.name} (${v.lang})`).slice(0, 5));
        }
      }

      setupUtterance(utterance);

      console.log(`🔊 [TTS] About to call speechSynthesis.speak()...`);
      console.log(`🔊 [TTS] Utterance details:`, {
        text: utterance.text.substring(0, 50),
        lang: utterance.lang,
        voice: utterance.voice?.name || 'default'
      });

      try {
        window.speechSynthesis.speak(utterance);
        console.log(`🔊 [TTS] speak() called successfully`);
      } catch (speakError) {
        console.error(`🔊 [TTS] ❌ Error calling speak():`, speakError);
        setIsSpeaking(false);
      }

      // Verify TTS started
      setTimeout(() => {
        if (window.speechSynthesis.speaking) {
          console.log('🔊 [TTS] ✅ Confirmed: TTS is speaking');
        } else {
          console.log('🔊 [TTS] ⚠️ TTS may not have started - check browser autoplay policies');
          console.log('🔊 [TTS] ⚠️ Try clicking "Activate Translation" button to unlock audio');
        }
      }, 300);
    };

    // Helper function to setup utterance event handlers
    const setupUtterance = (utterance) => {
      utterance.onstart = () => {
        console.log('🔊 [TTS] ✅ Started speaking successfully');
        setIsSpeaking(true);
      };

      utterance.onend = () => {
        console.log('🔊 [TTS] ✅ Finished speaking');
        setIsSpeaking(false);
      };

      utterance.onerror = (e) => {
        console.error('🔊 [TTS] ❌ Error:', e);
        console.error('🔊 [TTS] Error details:', {
          error: e.error,
          type: e.type,
          charIndex: e.charIndex,
          message: e.message
        });
        setIsSpeaking(false);
      };

      utterance.onpause = () => {
        console.log('🔊 [TTS] ⏸️ Paused');
      };

      utterance.onresume = () => {
        console.log('🔊 [TTS] ▶️ Resumed');
      };
    };

    // Check if voices are already loaded
    let voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      doSpeak();
    } else {
      // Wait for voices to load
      console.log('🔊 [TTS] Waiting for voices to load...');
      const onVoicesChanged = () => {
        console.log('🔊 [TTS] Voices loaded');
        window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
        doSpeak();
      };
      window.speechSynthesis.addEventListener('voiceschanged', onVoicesChanged);

      // Fallback: try after a delay even if voiceschanged doesn't fire
      setTimeout(() => {
        window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
        if (window.speechSynthesis.getVoices().length === 0) {
          console.log('🔊 [TTS] Voices still not loaded, proceeding anyway');
        }
        doSpeak();
      }, 1000);
    }
  };

  // Enhanced meeting summary function with paragraph generation
  const addToSummary = (original, translated, speaker) => {
    const entry = {
      id: Date.now() + Math.random(),
      timestamp: new Date().toLocaleTimeString(),
      original: original,
      translated: translated,
      speaker: speaker
    };

    console.log('📝 [SUMMARY] Adding entry:', entry);
    setMeetingSummary(prev => {
      const newSummary = [...prev, entry].slice(-50); // Keep more entries for better summary
      console.log('📝 [SUMMARY] Updated summary with', newSummary.length, 'entries');
      return newSummary;
    });
  };

  // Generate ChatGPT-like paragraph summary using recent utterances
  const generateParagraphSummary = (summaryEntries) => {
    if (!summaryEntries || summaryEntries.length === 0) {
      return "No conversation yet. Start speaking to see the meeting summary.";
    }

    // Prefer the last ~30 utterances for recency and performance
    const recent = summaryEntries.slice(-30);

    // Collect normalized utterances (already in user's preferred language for peers)
    const utterances = recent.map(e => ({
      speaker: e.speaker === 'You' ? summaryLabels.you : summaryLabels.peer,
      text: (e.translated || e.original || '').toString().trim(),
    })).filter(u => u.text.length > 0);

    if (utterances.length === 0) {
      return "No conversation yet. Start speaking to see the meeting summary.";
    }

    // Lightweight keyword extraction
    const stop = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'if', 'then', 'so', 'to', 'of', 'in', 'on', 'for', 'at', 'by', 'with', 'about', 'into', 'from', 'up', 'down', 'over', 'under', 'again', 'further', 'once',
      'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being', 'do', 'does', 'did', 'doing', 'have', 'has', 'had', 'having', 'it', 'its', 'this', 'that', 'these', 'those', 'as', 'not', 'no', 'yes',
      'i', 'you', 'he', 'she', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'their', 'our', 'mine', 'yours', 'hers', 'theirs', 'ours'
    ]);
    const freq = new Map();
    const tokenize = (t) => t.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
    utterances.forEach(u => {
      tokenize(u.text).forEach(tok => {
        if (!stop.has(tok) && tok.length > 2) freq.set(tok, (freq.get(tok) || 0) + 1);
      });
    });
    const topTerms = Array.from(freq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([w]) => w);

    // Detect tentative action items heuristically
    const actionUtterances = utterances.filter(u => /\b(will|should|let's|plan|next|todo|follow\s*up)\b/i.test(u.text));

    // Build cohesive paragraph
    const topicSentence = topTerms.length > 0
      ? `The discussion primarily focuses on ${topTerms.slice(0, 3).join(', ')}.`
      : `The discussion covers multiple topics.`;

    // Capture perspective of each participant succinctly
    const speakerBuckets = utterances.reduce((acc, u) => {
      acc[u.speaker] = acc[u.speaker] || [];
      acc[u.speaker].push(u.text);
      return acc;
    }, {});

    const summarizeBucket = (texts) => {
      if (!texts || texts.length === 0) return '';
      const last = texts.slice(-5); // the most recent highlights
      // Use 1-2 concise clauses from the last messages
      const sample = last.map(s => s).join(' ').split(/(?<=[.!?])\s+/).slice(0, 2).join(' ');
      return sample;
    };

    const youSummary = summarizeBucket(speakerBuckets[summaryLabels.you]);
    const peerSummary = summarizeBucket(speakerBuckets[summaryLabels.peer]);

    const participantSentence = [
      youSummary ? `${summaryLabels.you} discusses ${youSummary}` : '',
      peerSummary ? `${summaryLabels.peer} responds with ${peerSummary}` : ''
    ].filter(Boolean).join(' ');

    const keyPointsSentence = topTerms.length > 0
      ? `Key points include ${topTerms.join(', ')}.`
      : '';

    const actionsSentence = actionUtterances.length > 0
      ? `Potential actions mentioned: ${actionUtterances.slice(-3).map(u => u.text).join(' ')}.`
      : '';

    // Final paragraph
    return [topicSentence, participantSentence, keyPointsSentence, actionsSentence]
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  // Auto-update summary every 15 seconds
  useEffect(() => {
    console.log('📝 [SUMMARY] Setting up auto-update interval');
    const summaryInterval = setInterval(() => {
      console.log('📝 [SUMMARY] Auto-update triggered, summary length:', meetingSummary.length);
      if (meetingSummary.length > 0) {
        const paragraphSummary = generateParagraphSummary(meetingSummary);
        setParagraphSummary(paragraphSummary);
        console.log('📝 [SUMMARY] Auto-updated paragraph summary:', paragraphSummary.substring(0, 100) + '...');
      } else {
        console.log('📝 [SUMMARY] No summary entries to update');
      }
    }, 15000); // Update every 15 seconds

    return () => {
      console.log('📝 [SUMMARY] Clearing auto-update interval');
      clearInterval(summaryInterval);
    };
  }, [meetingSummary, summaryLabels]);

  // Localize static speaker labels once language is locked, using the translation API
  useEffect(() => {
    const localizeLabels = async () => {
      try {
        const targetLang = preferredLangRef.current || preferredLang;
        if (!targetLang || targetLang === 'en') return; // English defaults are fine
        const you = await translateText('You', 'en', targetLang);
        const peer = await translateText('Other participant', 'en', targetLang);
        setSummaryLabels({ you: you || 'You', peer: peer || 'Other participant' });
      } catch (_) {
        // Fallback to defaults on any error
        setSummaryLabels({ you: 'You', peer: 'Other participant' });
      }
    };
    if (lockedLang) localizeLabels();
  }, [lockedLang, preferredLang]);

  // Also update summary immediately when new entries are added
  useEffect(() => {
    if (meetingSummary.length > 0) {
      console.log('📝 [SUMMARY] Immediate update triggered, summary length:', meetingSummary.length);
      const paragraphSummary = generateParagraphSummary(meetingSummary);
      setParagraphSummary(paragraphSummary);
      console.log('📝 [SUMMARY] Immediate update completed');
    }
  }, [meetingSummary.length]);

  // Fetch smart replies periodically when there are new messages
  const fetchSmartReplies = async () => {
    if (!lockedLang || !meetingSummary || meetingSummary.length === 0) {
      return;
    }

    // Throttle requests - don't fetch more than once every 12 seconds
    const now = Date.now();
    if (now - lastSmartReplyFetchRef.current < 12000) {
      return;
    }

    lastSmartReplyFetchRef.current = now;
    setIsLoadingReplies(true);

    try {
      const apiUrl = '/api/translate/smart-replies';

      // Prepare context from meeting summary
      const context = meetingSummary.slice(-8).map(entry => ({
        speaker: entry.speaker,
        text: entry.translated || entry.original
      }));

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context,
          summary: paragraphSummary,
          targetLang: preferredLangRef.current || preferredLang
        }),
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        console.log('🤖 Smart replies received:', data.replies);
        setSmartReplies(data.replies || []);
      } else {
        console.warn('⚠️ Smart reply request failed:', response.status);
      }
    } catch (error) {
      console.error('❌ Failed to fetch smart replies:', error);
    } finally {
      setIsLoadingReplies(false);
    }
  };

  // Auto-fetch smart replies when summary updates
  useEffect(() => {
    if (meetingSummary.length > 0 && lockedLang) {
      // Delay slightly to allow summary to stabilize
      const timer = setTimeout(() => {
        fetchSmartReplies();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [meetingSummary.length, lockedLang]);

  // Handle smart reply click - send it as if user spoke it
  const handleSmartReplyClick = (replyText) => {
    console.log('🤖 Smart reply clicked:', replyText);

    const myLang = normalizeLanguageCode(preferredLangRef.current || preferredLang, 'en');
    const captionId = 'smart-reply-' + Date.now();

    // Add to local captions
    const caption = {
      id: captionId,
      text: replyText,
      speaker: 'You',
      timestamp: new Date().toLocaleTimeString()
    };
    setCaptions(prev => [...prev, caption].slice(-10));

    // Send to other users
    const message = {
      type: 'speech',
      text: replyText,
      roomId,
      sourceLang: myLang,
      from: selfIdRef.current,
      speakerName: 'You',
      timestamp: Date.now()
    };

    try {
      socketRef.current.emit('speech-translation', message);
      console.log('✅ Smart reply sent to other users:', replyText);

      // Add to summary
      addToSummary(replyText, replyText, 'You');

      // Speak it if TTS is available
      if (window.speechSynthesis) {
        speakText(replyText, myLang);
      }
    } catch (error) {
      console.error('❌ Failed to send smart reply:', error);
    }
  };

  const buildPeer = (peerId) => {
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    pcsRef.current[peerId] = pc;

    const stream = localStreamRef.current;
    if (stream) {
      stream.getTracks().forEach(track => {
        if (track.kind === 'audio') return; // do not send original audio
        pc.addTrack(track, stream);
      });
    }

    pc.ontrack = (e) => {
      let remote = remoteStreamsRef.current[peerId];
      if (!remote) {
        remote = new MediaStream();
        remoteStreamsRef.current[peerId] = remote;
      }
      if (e.track && !remote.getTracks().some(t => t.id === e.track.id)) remote.addTrack(e.track);
      const s = e.streams?.[0] || remote;
      setParticipants(prev => prev.some(p => p.id === peerId) ? prev.map(p => p.id === peerId ? { ...p, stream: s } : p) : [...prev, { id: peerId, stream: s }]);
    };

    pc.onicecandidate = (ev) => {
      if (ev.candidate) socketRef.current.emit('ice-candidate', { candidate: ev.candidate, to: peerId });
    };

    // Answerer receives data channel via ondatachannel
    pc.ondatachannel = (event) => {
      console.log('Received data channel from peer:', peerId, 'Channel name:', event.channel.label);
      const channel = event.channel;

      // Store the received data channel
      if (!dataChannelsRef.current[peerId]) {
        dataChannelsRef.current[peerId] = channel;
      }

      channel.onmessage = (ev) => handleData(ev.data, peerId);

      channel.onopen = () => {
        console.log('Received data channel opened for peer:', peerId);
        setDataChannelStatus('Connected');
        // Send test message back
        setTimeout(() => {
          try {
            channel.send(JSON.stringify({ type: 'test', message: 'Hello from receiver ' + selfIdRef.current }));
            console.log('Test message sent from receiver to peer:', peerId);
          } catch (error) {
            console.error('Failed to send test message from receiver:', error);
          }
        }, 2000);
      };

      channel.onerror = (error) => {
        console.error('Received data channel error for peer:', peerId, error);
      };
    };

    return pc;
  };

  const handleUserJoined = async (peerId) => {
    console.log('User joined:', peerId, 'Self ID:', selfIdRef.current);
    if (pcsRef.current[peerId]) return;
    const pc = buildPeer(peerId);
    const selfId = selfIdRef.current;

    // ALWAYS create a data channel for bidirectional communication
    console.log('Creating data channel for peer:', peerId);
    const channel = pc.createDataChannel('captions-' + selfId);
    dataChannelsRef.current[peerId] = channel;
    channel.onmessage = (ev) => handleData(ev.data, peerId);

    channel.onopen = () => {
      console.log('Data channel opened for peer:', peerId);
      setDataChannelStatus('Connected');
      // Send test message
      setTimeout(() => {
        try {
          channel.send(JSON.stringify({ type: 'test', message: 'Hello from ' + selfId }));
          console.log('Test message sent to peer:', peerId);
        } catch (error) {
          console.error('Failed to send test message:', error);
        }
      }, 1000);
    };

    channel.onerror = (error) => {
      console.error('Data channel error for peer:', peerId, error);
    };

    if (selfId && selfId < peerId) {
      // Offerer creates the offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socketRef.current.emit('offer', { offer, to: peerId });
    } else {
      console.log('Waiting for offer from peer:', peerId);
    }
  };

  const handleOffer = async ({ offer, from }) => {
    console.log('Received offer from:', from);
    let pc = pcsRef.current[from];
    if (!pc) pc = buildPeer(from);

    // Create a data channel for the answerer to send data back
    if (!dataChannelsRef.current[from]) {
      console.log('Creating answerer data channel for peer:', from);
      const channel = pc.createDataChannel('captions-' + selfIdRef.current);
      dataChannelsRef.current[from] = channel;
      channel.onmessage = (ev) => handleData(ev.data, from);

      channel.onopen = () => {
        console.log('Answerer data channel opened for peer:', from);
        setDataChannelStatus('Connected');
        // Send test message back
        setTimeout(() => {
          try {
            channel.send(JSON.stringify({ type: 'test', message: 'Hello from answerer ' + selfIdRef.current }));
            console.log('Test message sent from answerer to peer:', from);
          } catch (error) {
            console.error('Failed to send test message from answerer:', error);
          }
        }, 1500);
      };

      channel.onerror = (error) => {
        console.error('Answerer data channel error for peer:', from, error);
      };
    }

    await pc.setRemoteDescription(offer);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socketRef.current.emit('answer', { answer, to: from });
  };

  const handleAnswer = async ({ answer, from }) => {
    const pc = pcsRef.current[from];
    if (pc) await pc.setRemoteDescription(answer);
  };

  const handleCandidate = async ({ candidate, from }) => {
    const pc = pcsRef.current[from];
    if (pc && candidate) await pc.addIceCandidate(candidate);
  };

  const handleUserLeft = (peerId) => {
    setParticipants(prev => prev.filter(p => p.id !== peerId));
    if (pcsRef.current[peerId]) {
      pcsRef.current[peerId].close();
      delete pcsRef.current[peerId];
    }
  };

  // Local controls
  const toggleMic = () => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setMuted(!track.enabled);
    }
  };
  const toggleCam = () => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setCamOff(!track.enabled);
    }
  };

  const leave = async () => {
    try {
      // Mark meeting as ended on server so it doesn't show "IN PROGRESS" in history
      await fetch(`/api/meetings/${roomId}/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
    } catch (err) {
      console.error('Failed to mark meeting as ended:', err);
    }
    navigate('/multicall');
  };

  // Enhanced speech recognition setup for mobile Chrome stability
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.log('❌ Speech Recognition not supported');
      return;
    }
    if (!lockedLang) return;

    // Stop existing recognition
    try {
      speechRecRef.current?.stop?.();
      speechRecognitionRef.current?.stop?.();
    } catch { }

    const rec = new SpeechRecognition();
    speechRecRef.current = rec;
    speechRecognitionRef.current = rec;

    // Enhanced configuration for mobile Chrome stability
    rec.lang = toSpeechRecognitionLang(preferredLangRef.current || preferredLang);
    rec.interimResults = false; // Disable interim results to reduce processing
    rec.continuous = true;
    rec.maxAlternatives = 1;

    // Mobile Chrome specific settings
    const isMobileChrome = navigator.userAgent.includes('Chrome') && /Mobile|Android/i.test(navigator.userAgent);
    const isMobile = /Mobile|Android|iPhone|iPad/i.test(navigator.userAgent);

    if (isMobileChrome) {
      console.log('📱 Mobile Chrome detected - applying ULTRA STABLE fixes');
      rec.continuous = false; // Use false for mobile Chrome stability
      rec.interimResults = false;
      rec.grammars = undefined; // Remove grammars for mobile
      rec.maxAlternatives = 1;
      // Additional mobile Chrome stability settings
      rec.serviceURI = undefined; // Use default service
    }

    // Additional mobile optimizations
    if (isMobile) {
      console.log('📱 Mobile device detected - applying ULTRA STABLE optimizations');
      rec.continuous = false; // Use false for better mobile stability
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      // Disable features that cause instability on mobile
      rec.serviceURI = undefined;
    }

    // Enable restart but with better control
    allowSpeechRestartRef.current = true;
    setIsSpeechActive(true);

    let isProcessing = false;
    let lastResultTime = 0;

    rec.onresult = (e) => {
      console.log('🎤 [RESULT] Speech recognition result received:', e);
      console.log('🎤 [RESULT] Results length:', e.results.length);
      console.log('🎤 [RESULT] Result index:', e.resultIndex);
      console.log('🎤 [RESULT] Device type:', isMobile ? 'Mobile' : 'Desktop');
      console.log('🎤 [RESULT] User agent:', navigator.userAgent);

      // Prevent rapid processing
      const now = Date.now();
      if (isProcessing || (now - lastResultTime) < 1000) {
        console.log('🎤 [SKIP] Too frequent or already processing');
        return;
      }

      isProcessing = true;
      lastResultTime = now;

      // Get final speech result
      let finalText = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        console.log(`🎤 [RESULT] Processing result ${i}:`, e.results[i]);
        if (e.results[i].isFinal) {
          const transcript = e.results[i][0].transcript.trim();
          console.log(`🎤 [RESULT] Final transcript: "${transcript}"`);
          finalText += (finalText ? ' ' : '') + transcript;
        }
      }

      console.log(`🎤 [RESULT] Final text: "${finalText}"`);

      if (!finalText || finalText.length < 2) {
        console.log('🎤 [RESULT] Text too short or empty, skipping');
        isProcessing = false;
        return;
      }

      const myLang = normalizeLanguageCode(preferredLangRef.current || preferredLang, 'en');
      console.log(`🎤 [SEND] I spoke: "${finalText}" in ${myLang}`);
      console.log(`🎤 [SEND] Socket connected:`, socketRef.current?.connected);
      console.log(`🎤 [SEND] Socket ID:`, socketRef.current?.id);
      console.log(`🎤 [SEND] Self ID:`, selfIdRef.current);
      console.log(`🎤 [SEND] Device:`, isMobile ? 'Mobile' : 'Desktop');

      // Add to captions (what I spoke)
      const captionId = 'you-' + Date.now();
      const caption = {
        id: captionId,
        text: finalText,
        speaker: 'You',
        timestamp: new Date().toLocaleTimeString()
      };
      setCaptions(prev => [...prev, caption].slice(-10));
      console.log('🎤 [SEND] Added to captions');

      // Send to other users with my preferred language as source
      const message = {
        type: 'speech',
        text: finalText,
        roomId,
        sourceLang: myLang,
        from: selfIdRef.current,
        speakerName: 'You',
        timestamp: Date.now()
      };

      console.log('🎤 [SEND] Sending message:', message);

      try {
        console.log('🎤 [SEND] About to emit speech-translation event');
        console.log('🎤 [SEND] Socket state:', {
          connected: socketRef.current?.connected,
          id: socketRef.current?.id,
          readyState: socketRef.current?.readyState
        });

        socketRef.current.emit('speech-translation', message);
        console.log(`✅ [SEND] Successfully sent to other users: "${finalText}" (${myLang})`);
        console.log(`✅ [SEND] Message details:`, {
          text: finalText,
          sourceLang: myLang,
          from: selfIdRef.current,
          timestamp: message.timestamp
        });

        // Add to summary immediately for better tracking
        addToSummary(finalText, finalText, 'You');
        console.log('🎤 [SEND] Added to summary');

      } catch (error) {
        console.error('❌ [SEND] Failed to send message:', error);
        console.error('❌ [SEND] Error details:', {
          message: error.message,
          stack: error.stack,
          socketConnected: socketRef.current?.connected
        });
      }

      // Reset processing flag after a delay
      setTimeout(() => {
        isProcessing = false;
      }, 2000);
    };

    rec.onstart = () => {
      console.log('🎤 [START] Speech recognition started');
      setIsSpeechActive(true);
    };

    rec.onend = () => {
      console.log('🎤 [END] Speech recognition ended');
      setIsSpeechActive(false);

      // Only restart if we're still supposed to be listening
      if (!allowSpeechRestartRef.current) return;

      // Clear any existing timer
      if (speechRestartTimerRef.current) clearTimeout(speechRestartTimerRef.current);

      // Longer delay for mobile Chrome to prevent constant cycling
      const isMobileChrome = navigator.userAgent.includes('Chrome') && /Mobile|Android/i.test(navigator.userAgent);
      const isMobile = /Mobile|Android|iPhone|iPad/i.test(navigator.userAgent);
      const delay = isMobileChrome ? 8000 : (isMobile ? 6000 : 3000);

      speechRestartTimerRef.current = setTimeout(() => {
        if (allowSpeechRestartRef.current && lockedLang) {
          try {
            console.log('🎤 [RESTART] Restarting speech recognition...');
            rec.start();
          } catch (e) {
            console.log('🎤 [RESTART] Failed to restart speech recognition:', e);
            // Try again after longer delay
            setTimeout(() => {
              if (allowSpeechRestartRef.current && lockedLang) {
                try { rec.start(); } catch (err) {
                  console.log('🎤 [RESTART] Second attempt failed:', err);
                }
              }
            }, 3000);
          }
        }
      }, delay);
    };

    rec.onerror = (e) => {
      console.log('🎤 [ERROR] Speech recognition error:', e.error);
      console.log('🎤 [ERROR] Error details:', {
        error: e.error,
        type: e.type,
        charIndex: e.charIndex,
        device: isMobile ? 'Mobile' : 'Desktop'
      });
      setIsSpeechActive(false);

      // Clear processing flag on error
      isProcessing = false;

      // ULTRA STABLE approach for mobile - disable auto-restart
      if (isMobile) {
        console.log('📱 [MOBILE ERROR] Mobile device - DISABLING auto-restart for stability');
        console.log('📱 [MOBILE ERROR] User must manually restart speech recognition');
        // Don't auto-restart on mobile - let user control it manually
        allowSpeechRestartRef.current = false;
        setIsSpeechActive(false);
        console.log('📱 [MOBILE ERROR] Speech recognition stopped. Click 🎙️ to restart manually.');
      } else {
        // Desktop restart logic
        if (e.error === 'no-speech' || e.error === 'audio-capture' || e.error === 'not-allowed') {
          if (speechRestartTimerRef.current) clearTimeout(speechRestartTimerRef.current);

          speechRestartTimerRef.current = setTimeout(() => {
            if (allowSpeechRestartRef.current && lockedLang) {
              try {
                console.log('🎤 [ERROR] Attempting to restart after error...');
                rec.start();
              } catch (restartError) {
                console.log('🎤 [ERROR] Failed to restart after error:', restartError);
              }
            }
          }, 5000);
        }
      }
    };

    // Start recognition with mobile-specific handling
    const startRecognition = () => {
      try {
        rec.start();
        console.log('🎤 [INIT] Speech recognition started successfully');
      } catch (e) {
        console.log('🎤 [INIT] Failed to start speech recognition:', e);

        // Mobile Chrome fallback - try again after a delay
        if (isMobileChrome) {
          console.log('📱 [MOBILE] Retrying speech recognition in 2 seconds...');
          setTimeout(() => {
            try {
              rec.start();
              console.log('📱 [MOBILE] Speech recognition started on retry');
            } catch (retryError) {
              console.error('📱 [MOBILE] Retry failed:', retryError);
            }
          }, 2000);
        }
      }
    };

    // Start with a small delay for mobile Chrome
    if (isMobileChrome) {
      console.log('📱 [MOBILE] Starting speech recognition with delay for mobile Chrome');
      setTimeout(startRecognition, 1000);
    } else {
      startRecognition();
    }

    return () => {
      console.log('🎤 [CLEANUP] Cleaning up speech recognition');
      allowSpeechRestartRef.current = false;
      if (speechRestartTimerRef.current) clearTimeout(speechRestartTimerRef.current);
      try { rec.stop(); } catch { }
    };
  }, [lockedLang, preferredLang]);

  const shareLink = () => {
    const link = window.location.href;
    if (navigator.share) {
      navigator.share({ url: link, title: 'Join my Samvaad AI call' }).catch(() => { });
    } else {
      navigator.clipboard.writeText(link).catch(() => { });
      alert('Room link copied to clipboard');
    }
  };

  // Multi-language speech translation handler
  const handleSpeechTranslation = async (data) => {
    try {
      console.log('🔊 [HANDLER] ========== STARTING SPEECH TRANSLATION HANDLER ==========');
      console.log('🔊 [HANDLER] Received data:', JSON.stringify(data, null, 2));

      const { text, sourceLang, from } = data;
      const originalText = String(text || '').trim();

      console.log('🔊 [HANDLER] Extracted values:', {
        text: originalText,
        sourceLang,
        from,
        textLength: originalText.length
      });

      if (!originalText) {
        console.error('🔊 [HANDLER] ❌ Empty text, returning');
        return;
      }

      console.log(`🔊 [HANDLER] From ${from}: "${originalText}" (${sourceLang})`);

      // Get my preferred language
      const myLang = normalizeLanguageCode(preferredLangRef.current || preferredLang, 'en');
      console.log(`🔊 [HANDLER] My language: ${myLang}, Source: ${sourceLang}`);
      console.log(`🔊 [HANDLER] Preferred lang ref:`, preferredLangRef.current);
      console.log(`🔊 [HANDLER] Preferred lang state:`, preferredLang);

      // Add to captions (what peer spoke) - always show original
      const captionId = 'peer-' + Date.now();
      const caption = {
        id: captionId,
        text: originalText,
        speaker: 'Peer',
        timestamp: new Date().toLocaleTimeString()
      };
      setCaptions(prev => [...prev, caption].slice(-10));
      console.log('🔊 [HANDLER] Added original to captions');

      // Normalize language codes for comparison and translation
      const normalizedSourceLang = normalizeLanguageCode(sourceLang, '');
      const normalizedMyLang = normalizeLanguageCode(myLang, 'en');

      console.log(`🔊 [HANDLER] Language comparison:`, {
        sourceLang: sourceLang,
        normalizedSourceLang,
        myLang: myLang,
        normalizedMyLang,
        areEqual: normalizedSourceLang === normalizedMyLang
      });

      // Only translate if the source language is different from my preferred language
      if (!normalizedSourceLang) {
        console.warn('[Socket] Dropping speech payload without sourceLang:', data);
        addToSummary(originalText, originalText, 'Peer');
        return;
      }

      if (normalizedSourceLang === normalizedMyLang) {
        console.log(`ℹ️ [HANDLER] Same language (${normalizedSourceLang}), no translation needed`);
        // Still add to summary without translation
        addToSummary(originalText, originalText, 'Peer');
        return;
      }

      // Additional check: Only process if we actually need translation
      console.log(`🔊 [HANDLER] Language mismatch detected - will translate from ${sourceLang} to ${myLang}`);

      // Translate to my preferred language (supports all languages)
      // Use already normalized language codes
      console.log(`🔄 [HANDLER] Translating "${originalText}" from ${normalizedSourceLang} to ${normalizedMyLang}`);
      console.log(`🔄 [HANDLER] Original lang codes: source=${sourceLang}, target=${myLang}`);

      const translated = await translateText(originalText, normalizedSourceLang, normalizedMyLang);

      console.log(`🔄 [HANDLER] Translation returned: "${translated}"`);
      console.log(`🔄 [HANDLER] Translation different from original: ${translated !== originalText}`);

      if (!isInvalidTranslatedText(translated) && translated !== originalText) {
        console.log(`✅ [HANDLER] Translation result: "${originalText}" → "${translated}"`);

        // Add translated caption with matching ID
        const translatedCaption = {
          id: captionId, // Match the original caption ID
          text: translated,
          timestamp: new Date().toLocaleTimeString()
        };
        setTranslatedCaptions(prev => {
          // Remove any existing caption with same ID and add new one
          const filtered = prev.filter(c => c.id !== captionId);
          return [...filtered, translatedCaption].slice(-10);
        });
        console.log('🔊 [HANDLER] Added translated caption');

        // Add to summary
        addToSummary(originalText, translated, 'Peer');
        console.log('🔊 [HANDLER] Added to summary');

        // Speak the translation in my preferred language
        console.log(`🔊 [HANDLER] Speaking: "${translated}" in ${myLang}`);
        console.log(`🔊 [HANDLER] TTS will be called now...`);
        console.log(`🔊 [HANDLER] Speech synthesis available:`, !!window.speechSynthesis);
        console.log(`🔊 [HANDLER] Current speaking state:`, window.speechSynthesis?.speaking);

        // Ensure TTS is called - use requestAnimationFrame for better timing
        requestAnimationFrame(() => {
          setTimeout(() => {
            console.log('🔊 [HANDLER] Calling speakText now...');
            try {
              speakText(translated, normalizedMyLang);
              console.log('🔊 [HANDLER] TTS initiated');

              // Double-check TTS started after a delay
              setTimeout(() => {
                if (window.speechSynthesis?.speaking) {
                  console.log('🔊 [HANDLER] ✅ TTS confirmed speaking');
                } else {
                  console.warn('🔊 [HANDLER] ⚠️ TTS may not have started - check browser console for errors');
                  console.warn('🔊 [HANDLER] This might be due to browser autoplay policies - try clicking "Activate Translation" button');
                }
              }, 500);
            } catch (ttsError) {
              console.error('🔊 [HANDLER] ❌ Error calling speakText:', ttsError);
            }
          }, 150);
        });
      } else {
        if (translated === originalText) {
          console.log(`⚠️ [HANDLER] Translation returned same text - translation may have failed`);
        } else {
          console.log(`⚠️ [HANDLER] Translation returned empty or failed`);
        }
        // Still add original to summary
        addToSummary(originalText, originalText, 'Peer');
      }

    } catch (error) {
      console.error('❌ [HANDLER] Error:', error);
      console.error('❌ [HANDLER] Error stack:', error.stack);
    }
  };

  // Handle messages arriving on the data channel (WebRTC fallback)
  const handleData = async (raw, fromId) => {
    try {
      const msg = typeof raw === 'string' ? JSON.parse(raw) : raw;
      console.log('📡 [DATA CHANNEL] Received data from peer:', fromId, 'Message:', msg);

      if (msg?.type === 'test') {
        console.log('📡 [DATA CHANNEL] Test message received:', msg.message);
        return;
      }

      if (msg?.type === 'pref') {
        console.log('📡 [DATA CHANNEL] Peer preference received:', msg);
        return;
      }

      // Handle speech data from WebRTC data channel (fallback to WebSocket)
      if (msg?.type === 'speech' && msg.text) {
        console.log('📡 [DATA CHANNEL] Speech data received, forwarding to WebSocket handler');

        // Forward to the main WebSocket handler for consistency
        const speechData = {
          type: 'speech',
          text: msg.text,
          sourceLang: msg.sourceLang,
          from: fromId,
          timestamp: msg.timestamp || Date.now()
        };

        handleSpeechTranslation(speechData);
      }
    } catch (error) {
      console.error('❌ [DATA CHANNEL] Error handling data channel message:', error);
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f8fb] font-sans text-slate-900 flex flex-col">
      {/* Standard Dashboard Header */}
      <header className="sticky top-0 z-20 w-full border-b border-gray-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <img src={SamvaadLogo} alt="Samvaad AI Logo" className="h-[45px] sm:h-[55px] w-auto" />
          </a>

          {/* Room Info Badge - Centered or Integrated */}
          <div className="hidden md:flex items-center gap-3 px-4 py-2 bg-slate-50 rounded-full ring-1 ring-slate-200">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-xs font-semibold text-slate-700 tracking-wide uppercase">Live Room</span>
            </div>
            <div className="w-px h-4 bg-slate-300"></div>
            <span className="text-sm font-mono text-slate-600">{roomId}</span>
          </div>

          <nav className="flex items-center gap-3">
            <button
              onClick={() => setShowEngineInspector(true)}
              className="hidden sm:flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium text-sm transition-all shadow-sm active:scale-95"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" /></svg>
              Engine Inspector
            </button>
            <button
              onClick={shareLink}
              className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white ring-1 ring-gray-200 text-gray-700 hover:bg-gray-50 rounded-xl font-medium text-sm transition-all shadow-sm active:scale-95"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
              Share Link
            </button>
            <button
              onClick={leave}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium text-sm shadow-md shadow-red-200 transition-all active:scale-95 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              Leave
            </button>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 lg:py-8">
        {/* Control Bar - Language & Status */}
        <div className="mb-8 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl ring-1 ring-gray-200 shadow-sm">
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <label className="text-sm font-semibold text-gray-700 whitespace-nowrap">Speaking Language:</label>
            <div className="relative flex-1 sm:flex-initial">
              <select
                disabled={lockedLang}
                value={preferredLang}
                onChange={(e) => { setPreferredLang(e.target.value); preferredLangRef.current = e.target.value; }}
                className="w-full sm:w-64 pl-4 pr-10 py-2.5 rounded-xl border-0 bg-slate-50 ring-1 ring-slate-200 text-slate-900 focus:ring-2 focus:ring-[#684CFE] font-medium text-sm transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed appearance-none"
              >
                {supportedLanguages.map(lang => (
                  <option key={lang.code} value={lang.code}>{lang.name} ({lang.nativeName})</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            {!lockedLang ? (
              <button
                onClick={() => {
                  setLockedLang(true);
                  preferredLangRef.current = preferredLang;

                  // Notify peers about language preference
                  Object.values(dataChannelsRef.current).forEach(dc => {
                    if (dc && dc.readyState === 'open') {
                      try { dc.send(JSON.stringify({ type: 'pref', preferredLang })); } catch { }
                    }
                  });

                  // Start Gemini Streaming
                  console.log('🚀 Starting Gemini Live Stream from Client...');
                  socketRef.current.emit('gemini-connect');

                  // Start Frame Capture Loop (5 FPS = 200ms)
                  if (captureIntervalRef.current) clearInterval(captureIntervalRef.current);
                  captureIntervalRef.current = setInterval(() => {
                    if (!localVideoRef.current) return;

                    const canvas = document.createElement('canvas');
                    canvas.width = 640; // Downscale for bandwidth
                    canvas.height = 480;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(localVideoRef.current, 0, 0, canvas.width, canvas.height);

                    // Convert to base64 JPEG
                    const base64Data = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];

                    socketRef.current.emit('gemini-stream-data', {
                      mimeType: 'image/jpeg',
                      data: base64Data
                    });
                  }, 200);

                  // Unlock TTS
                  try {
                    const u = new SpeechSynthesisUtterance('Gemini Live Interpreter Active');
                    u.lang = 'en-US';
                    u.volume = 0.5;
                    window.speechSynthesis.cancel();
                    window.speechSynthesis.speak(u);
                  } catch (e) { console.error(e); }
                }}
                className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-[#684CFE] to-purple-600 hover:from-[#533bdb] hover:to-purple-700 text-white rounded-xl font-semibold text-sm shadow-lg shadow-[#684CFE]/30 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                Activate AI Interpreter
              </button>
            ) : (
              <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl ring-1 ring-emerald-200 text-sm font-semibold">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                Translation Active
              </div>
            )}
          </div>
        </div>

        {/* Status Pills */}
        <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ring-1 transition-all ${isSpeechActive ? 'bg-[#684CFE]/10 text-[#684CFE] ring-[#684CFE]/30' : 'bg-slate-100 text-slate-500 ring-slate-200'}`}>
            <div className={`w-2 h-2 rounded-full ${isSpeechActive ? 'bg-[#684CFE] animate-pulse' : 'bg-slate-400'}`}></div>
            {isSpeechActive ? 'Listening' : 'Mic Off'}
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ring-1 transition-all ${isTranslating ? 'bg-orange-50 text-orange-700 ring-orange-200' : 'bg-slate-100 text-slate-500 ring-slate-200'}`}>
            <div className={`w-2 h-2 rounded-full ${isTranslating ? 'bg-orange-500 animate-pulse' : 'bg-slate-400'}`}></div>
            {isTranslating ? 'Translating' : 'Translation Ready'}
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ring-1 transition-all ${dataChannelStatus === 'Connected' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-red-50 text-red-700 ring-red-200'}`}>
            <div className={`w-2 h-2 rounded-full ${dataChannelStatus === 'Connected' ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
            P2P: {dataChannelStatus}
          </div>
        </div>

        {/* Main Grid: Video (Left) + Sidebar (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-auto lg:h-[calc(100vh-22rem)] min-h-[500px]">
          {/* Video Section - Spans 8 cols */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            {/* Call Grid */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
              {/* Local User */}
              <div className="relative group bg-white rounded-3xl overflow-hidden ring-1 ring-gray-200 shadow-xl transition-all hover:ring-[#684CFE]/50">
                <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 flex items-end justify-between">
                  <span className="text-white font-medium text-sm drop-shadow-md">You (Host)</span>
                  <div className="flex gap-2">
                    {muted && <div className="p-1.5 rounded-lg bg-red-500/90 text-white backdrop-blur-md shadow-sm"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" /></svg></div>}
                    {camOff && <div className="p-1.5 rounded-lg bg-red-500/90 text-white backdrop-blur-md shadow-sm"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" /></svg></div>}
                  </div>
                </div>
              </div>

              {/* Remote Users */}
              {participants.length > 0 ? participants.map(p => (
                <div key={p.id} className="relative group bg-white rounded-3xl overflow-hidden ring-1 ring-gray-200 shadow-xl transition-all hover:ring-[#684CFE]/50">
                  <video
                    ref={el => {
                      if (el && p.stream) {
                        el.srcObject = p.stream;
                        const pr = el.play?.();
                        if (pr) pr.catch(() => { });
                        try { el.muted = true; el.volume = 0; } catch { }
                      }
                    }}
                    autoPlay muted playsInline className="w-full h-full object-cover" />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 flex flex-col gap-2">
                    <span className="text-white font-medium text-sm drop-shadow-md">Remote Participant</span>
                    {translatedCaptions.length > 0 && (
                      <div className="bg-black/60 backdrop-blur-md rounded-xl p-3 border border-white/10 shadow-lg">
                        <div className="text-xs text-[#8d76fe] font-semibold mb-1">
                          Translated to {supportedLanguages.find(lang => lang.code === preferredLang)?.nativeName || preferredLang}
                        </div>
                        {translatedCaptions.slice(-1).map(c => (
                          <div key={c.id} className="text-white text-sm font-medium leading-relaxed">{c.text}</div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )) : (
                <div className="flex flex-col items-center justify-center bg-slate-50 rounded-3xl ring-1 ring-slate-200 border-2 border-dashed border-slate-300 p-8 text-center animate-in fade-in duration-700">
                  <div className="w-16 h-16 rounded-2xl bg-white shadow-sm ring-1 ring-slate-100 flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900">Waiting for participants</h3>
                  <p className="text-slate-500 text-sm mt-1 mb-6">Share the room link to invite others</p>
                  <button onClick={shareLink} className="inline-flex items-center gap-2 px-5 py-2.5 bg-white hover:bg-slate-50 text-[#684CFE] font-medium rounded-xl ring-1 ring-slate-200 shadow-sm transition-all">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    Copy Link
                  </button>
                </div>
              )}
            </div>

            {/* Bottom Controls */}
            <div className="flex items-center justify-center gap-6 pb-6">
              <button onClick={toggleMic} className={`p-4 rounded-full shadow-lg transition-all active:scale-95 ${muted ? 'bg-red-500 text-white ring-4 ring-red-100' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:ring-[#684CFE]/30'}`}>
                {muted ? <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" /></svg>
                  : <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>}
              </button>
              <button onClick={toggleCam} className={`p-4 rounded-full shadow-lg transition-all active:scale-95 ${camOff ? 'bg-red-500 text-white ring-4 ring-red-100' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:ring-[#684CFE]/30'}`}>
                {camOff ? <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" /></svg>
                  : <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>}
              </button>
              <button
                onClick={() => {
                  if (isSpeechActive) {
                    allowSpeechRestartRef.current = false;
                    try { speechRecRef.current?.stop?.(); } catch { }
                    setIsSpeechActive(false);
                  } else {
                    allowSpeechRestartRef.current = true;
                    try { speechRecRef.current?.start?.(); } catch { }
                  }
                }}
                className={`p-4 rounded-full shadow-lg transition-all active:scale-95 ${isSpeechActive ? 'bg-[#684CFE] text-white ring-4 ring-[#684CFE]/30' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:ring-[#684CFE]/30'}`}
                title={isSpeechActive ? 'Stop Active Listening' : 'Start Listening'}
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
              </button>
              <div className="w-px h-8 bg-gray-300 mx-2"></div>
              <button onClick={leave} className="px-8 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-2xl shadow-lg shadow-red-200 transition-all active:scale-95">
                End Call
              </button>
            </div>
          </div>

          {/* Sidebar: Summary & Captions - Spans 4 cols */}
          <div className="lg:col-span-4 flex flex-col gap-6 h-[500px] lg:h-full overflow-hidden">
            {/* Summary Card */}
            <div className="flex-1 bg-white rounded-3xl p-6 ring-1 ring-gray-200 shadow-xl flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900">Meeting Summary</h3>
                <span className="flex items-center gap-2 px-2.5 py-1 bg-[#684CFE]/10 text-[#684CFE] rounded-lg text-xs font-semibold">
                  <span className="w-2 h-2 bg-[#684CFE] rounded-full animate-pulse"></span>
                  Live
                </span>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
                <div className="bg-slate-50 rounded-2xl p-4 ring-1 ring-slate-100">
                  <div className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">Current Context</div>
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{paragraphSummary || "Conversation has not started yet..."}</p>
                </div>

                <div className="space-y-3">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider sticky top-0 bg-white py-1">Recent Activity</div>
                  {meetingSummary.length === 0 && <p className="text-sm text-slate-400 italic">No translations yet.</p>}
                  {meetingSummary.slice(-5).map((entry, i) => (
                    <div key={i} className="group p-3 rounded-2xl bg-white ring-1 ring-slate-100 hover:ring-indigo-200 hover:bg-indigo-50/30 transition-all shadow-sm">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-xs font-bold text-indigo-600">{entry.speaker}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{entry.timestamp}</span>
                      </div>
                      <div className="text-sm text-slate-600 mb-1.5">{entry.original}</div>
                      <div className="text-sm font-medium text-slate-800 pl-3 border-l-2 border-indigo-200">{entry.translated}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Smart Replies - Fixed at bottom of sidebar if active */}
            {lockedLang && (
              <div className="bg-white rounded-3xl p-4 ring-1 ring-gray-200 shadow-lg">
                <SmartReplyPanel
                  replies={smartReplies}
                  onReplyClick={handleSmartReplyClick}
                  isLoading={isLoadingReplies}
                />
              </div>
            )}
          </div>
        </div>

        <CallWidget isOpen={isCallWidgetOpen} onClose={() => setIsCallWidgetOpen(false)} />
        <SamvaadSemanticEngineInspector
          isOpen={showEngineInspector}
          onClose={() => setShowEngineInspector(false)}
        />
      </main>
    </div>
  );
}
