import { useEffect, useRef } from 'react';

/**
 * useMultilingualSTT — Extracted hook for multilingual speech recognition.
 * Handles auto-restart, exponential backoff, and socket broadcasting.
 */
export function useMultilingualSTT({
    isTranslationEnabled,
    preferredLanguage,
    preferredLanguageRef,
    socketRef,
    roomId,
    user,
    userNameRef,
    setChatMessages,
    isTTSPlayingRef,
    multilingualRecRef,
    multilingualRestartTimerRef,
    multilingualAllowRestartRef,
    addTranscription
}) {

    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) return;

        if (!isTranslationEnabled) {
            multilingualAllowRestartRef.current = false;
            if (multilingualRestartTimerRef.current) clearTimeout(multilingualRestartTimerRef.current);
            if (multilingualRecRef.current) {
                multilingualRecRef.current.onstart = null;
                multilingualRecRef.current.onend = null;
                multilingualRecRef.current.onerror = null;
                multilingualRecRef.current.onresult = null;
                try { multilingualRecRef.current.stop(); } catch { }
                multilingualRecRef.current = null;
            }
            return;
        }

        // Cleanup existing
        if (multilingualRecRef.current) {
            multilingualRecRef.current.onstart = null;
            multilingualRecRef.current.onend = null;
            multilingualRecRef.current.onerror = null;
            multilingualRecRef.current.onresult = null;
            try { multilingualRecRef.current.stop(); } catch { }
            multilingualRecRef.current = null;
        }

        const rec = new SpeechRecognition();
        multilingualRecRef.current = rec;

        const lang = preferredLanguage || 'en-US';
        rec.lang = lang;
        rec.interimResults = true;   // ✅ Smart Chunking: get words as they're spoken
        rec.continuous = true;        // ✅ Smart Chunking: keep mic open, no dead zones
        rec.maxAlternatives = 1;

        multilingualAllowRestartRef.current = true;
        let isRecognizing = false;
        let consecutiveAborts = 0;
        const MAX_ABORTS = 3;

        // ── Smart Chunking buffer ──────────────────────────────────────────────
        // We accumulate interim words and fire a translation every time the
        // speaker pauses for more than CHUNK_SILENCE_MS milliseconds, OR when
        // a "logical breaker" (comma / sentence end) is detected in the text.
        const CHUNK_SILENCE_MS = 1500; // fire after 1.5s of silence
        let chunkBuffer = '';          // interim text accumulated so far
        let chunkTimer = null;         // debounce timer
        let lastEmittedText = '';      // avoid sending duplicates

        const flushChunk = () => {
            if (chunkTimer) { clearTimeout(chunkTimer); chunkTimer = null; }
            const text = chunkBuffer.trim();
            chunkBuffer = '';

            if (!text || text.length < 2 || text === lastEmittedText) return;
            lastEmittedText = text;

            const myLang = preferredLanguageRef.current || preferredLanguage || 'en-US';
            const currentUserName = userNameRef.current || user?.name || 'You';

            console.log(`🌐 [MULTILINGUAL] ⚡ Chunk fired: "${text}"`);

            setChatMessages(prev => [...prev, {
                id: 'ml-' + Date.now(),
                text: `🌐 ${text}`,
                sender: currentUserName,
                timestamp: new Date().toLocaleTimeString()
            }]);

            if (addTranscription) {
                addTranscription(text, currentUserName, 'local');
            }

            if (socketRef.current) {
                const payload = {
                    id: Date.now(),
                    roomId,
                    text,
                    sourceLang: myLang,
                    from: socketRef.current.id,
                    sender: currentUserName,
                    type: 'speech'
                };
                socketRef.current.emit('speech-translation', payload);
                console.log(`🌐 [MULTILINGUAL] ✅ Emitted chunk:`, payload);
            }
        };

        // Logical breakers: flush immediately on sentence-ending punctuation
        const LOGICAL_BREAKERS = /[.!?,;]/;
        // ──────────────────────────────────────────────────────────────────────

        rec.onstart = () => {
            isRecognizing = true;
            console.log('🌐 [MULTILINGUAL] Speech recognition STARTED (continuous + chunking)');
        };

        rec.onresult = (e) => {
            consecutiveAborts = 0;
            if (isTTSPlayingRef.current) return; // TTS guard — don't process during playback

            let interimText = '';
            let finalText = '';

            for (let i = e.resultIndex; i < e.results.length; i++) {
                const transcript = e.results[i][0].transcript;
                if (e.results[i].isFinal) {
                    finalText += transcript;
                } else {
                    interimText += transcript;
                }
            }

            // Accumulate into buffer
            if (finalText) {
                // ✅ REPLACE buffer on final — don't append, interim is already in it
                chunkBuffer = finalText.trim();
                // Flush immediately — this is a confirmed final result
                flushChunk();
            } else if (interimText) {
                // Update buffer with latest interim (replace, don't append)
                chunkBuffer = interimText.trim();

                // Flush immediately on logical breaker (comma, period, etc.)
                if (LOGICAL_BREAKERS.test(chunkBuffer)) {
                    flushChunk();
                    return;
                }

                // Otherwise debounce: flush after 1.5s of silence
                if (chunkTimer) clearTimeout(chunkTimer);
                chunkTimer = setTimeout(flushChunk, CHUNK_SILENCE_MS);
            }
        };

        rec.onend = () => {
            console.log('🌐 [MULTILINGUAL] Speech recognition ENDED');
            isRecognizing = false;

            // Flush anything remaining in the buffer
            flushChunk();

            if (!multilingualAllowRestartRef.current) return;
            if (isTTSPlayingRef.current) return;

            if (consecutiveAborts >= MAX_ABORTS) {
                console.warn('🌐 [MULTILINGUAL] Too many aborts, backing off');
                multilingualRestartTimerRef.current = setTimeout(() => {
                    consecutiveAborts = 0;
                    if (multilingualAllowRestartRef.current && !isRecognizing && !isTTSPlayingRef.current && multilingualRecRef.current === rec) {
                        try { rec.start(); } catch { }
                    }
                }, 10000);
                return;
            }

            // Reduced restart delay since continuous mode rarely drops
            const delay = 500 + (consecutiveAborts * 1000);
            multilingualRestartTimerRef.current = setTimeout(() => {
                if (multilingualAllowRestartRef.current && !isRecognizing && !isTTSPlayingRef.current && multilingualRecRef.current === rec) {
                    try { rec.start(); } catch { }
                }
            }, delay);
        };

        rec.onerror = (e) => {
            console.warn('🌐 [MULTILINGUAL] Error:', e.error);
            if (chunkTimer) { clearTimeout(chunkTimer); chunkTimer = null; }
            if (e.error === 'aborted') {
                consecutiveAborts++;
                return;
            }
            if (e.error === 'no-speech') {
                consecutiveAborts = 0;
                return;
            }
            if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
                multilingualAllowRestartRef.current = false;
            }
            isRecognizing = false;
        };

        try {
            rec.start();
        } catch (e) {
            console.warn('🌐 [MULTILINGUAL] Initial start failed');
            setTimeout(() => {
                if (multilingualAllowRestartRef.current && !isRecognizing && multilingualRecRef.current === rec) {
                    try { rec.start(); } catch { }
                }
            }, 3000);
        }

        return () => {
            multilingualAllowRestartRef.current = false;
            isRecognizing = false;
            if (chunkTimer) clearTimeout(chunkTimer);
            if (multilingualRestartTimerRef.current) clearTimeout(multilingualRestartTimerRef.current);
            rec.onstart = null;
            rec.onend = null;
            rec.onerror = null;
            rec.onresult = null;
            try { rec.stop(); } catch { }
            multilingualRecRef.current = null;
        };
    }, [isTranslationEnabled, preferredLanguage, roomId, socketRef]);

    return {
        multilingualRecRef
    };
}
