import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../lib/api';

/**
 * useMeetingSummary — Manages meeting transcription, live captions, and summary generation.
 * 
 * @param {Object} params
 * @param {string} params.roomId - Current room ID
 * @param {Function} params.navigate - Navigation function
 * @param {React.MutableRefObject} params.socketRef - Socket.IO ref
 * @returns Meeting summary state and handlers
 */
export function useMeetingSummary({ roomId, navigate, socketRef }) {
    const [isSummaryEnabled, setIsSummaryEnabled] = useState(false);
    const [showTranscripts, setShowTranscripts] = useState(false);
    const [captions, setCaptions] = useState([]); // {id, text, speaker, timestamp}
    const [isSpeechActive, setIsSpeechActive] = useState(false);
    const recentTranscriptsRef = useRef([]);

    // Removed auto-open effect to prevent modal from popping up unexpectedly.
    // Visibility is now controlled purely by user interaction in the ControlBar.

    // Helper to check for duplicates (Echo cancellation for meeting summary)
    const isDuplicate = useCallback((text, excludeSource) => {
        const now = Date.now();
        // Clean up old entries (> 5 seconds)
        recentTranscriptsRef.current = recentTranscriptsRef.current.filter(t => now - t.timestamp < 5000);

        // Check for similarity
        const normalizedNew = text.toLowerCase().trim();
        return recentTranscriptsRef.current.some(t => {
            if (t.source === excludeSource) return false;
            const normalizedExisting = t.text.toLowerCase().trim();

            if (normalizedNew === normalizedExisting) return true;
            if ((normalizedNew.includes(normalizedExisting) || normalizedExisting.includes(normalizedNew)) &&
                Math.abs(normalizedNew.length - normalizedExisting.length) <= 3) {
                return true;
            }
            return false;
        });
    }, []);

    const addTranscription = useCallback((text, speaker, source = 'local') => {
        if (!text) return;

        // Dedupe
        if (isDuplicate(text, source === 'local' ? 'remote' : 'local')) {
            console.log(`🚫 [DEDUPE] Ignoring ${source} transcript (duplicate):`, text);
            return;
        }

        const caption = {
            id: Date.now() + Math.random(),
            text: text.trim(),
            speaker: speaker || 'Participant',
            timestamp: new Date().toLocaleTimeString()
        };

        setCaptions(prev => [...prev, caption].slice(-50));
        recentTranscriptsRef.current.push({ text: text.trim(), source, timestamp: Date.now() });

        // Broadcast for peers if local
        if (source === 'local' && socketRef.current) {
            socketRef.current.emit('speech-translation', {
                roomId,
                text: text.trim(),
                sender: speaker,
                speakerName: speaker,
                type: 'transcript'
            });

            // Send to backend for summary persistence
            try {
                api.post(`/meetings/${roomId}/transcript`, {
                    speaker: speaker,
                    text: text.trim()
                });
            } catch (err) {
                console.error('❌ [SUMMARY] Failed to send transcript:', err);
            }
        }
    }, [roomId, socketRef, isDuplicate]);

    const processSocketTranscript = useCallback((data) => {
        const { text, sender, speakerName, from } = data;
        if (from === socketRef.current?.id) return; // Skip self

        if (text) {
            addTranscription(text, speakerName || sender || 'Participant', 'remote');
        }
    }, [socketRef, addTranscription]);

    const endCallWithSummary = useCallback(async () => {
        if (!isSummaryEnabled) {
            alert('Meeting Summary is not enabled. Please enable it first to generate a summary.');
            return;
        }

        if (!window.confirm('End call and generate meeting summary?')) return;

        try {
            console.log('🎬 [SUMMARY] Ending call and generating summary...');
            await api.post(`/meetings/${roomId}/end`);
            console.log('✅ [SUMMARY] Summary generation requested');
            navigate(`/summary-call/${roomId}/details`);
        } catch (error) {
            console.error('❌ [SUMMARY] Error ending call with summary:', error);
            alert('Failed to generate summary. Please try again.');
        }
    }, [isSummaryEnabled, roomId, navigate]);

    const fetchSmartRewind = useCallback(async () => {
        try {
            const response = await api.get(`/meetings/${roomId}/smart-rewind`);
            return response.data;
        } catch (error) {
            console.error('❌ [REWIND] Failed to fetch smart rewind:', error);
            throw error;
        }
    }, [roomId]);

    return {
        isSummaryEnabled, setIsSummaryEnabled,
        showTranscripts, setShowTranscripts,
        captions, setCaptions,
        isSpeechActive, setIsSpeechActive,
        addTranscription,
        processSocketTranscript,
        endCallWithSummary,
        isDuplicate,
        fetchSmartRewind
    };
}
