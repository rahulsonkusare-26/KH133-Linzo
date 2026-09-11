import { Router } from 'express';
import twilio from 'twilio';
import { CallLog } from '../models/CallLog.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const VoiceResponse = twilio.twiml.VoiceResponse;

// In-memory store for mapping Call SIDs to user/room info
// Structure: { callSid: { userId, roomId, phoneNumber } }
const activeCallMap = new Map();

// Use environment variables or fallback to provided credentials (for development)
const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN
const TWILIO_NUMBER = process.env.TWILIO_PHONE_NUMBER
const TWIML_APP_SID = process.env.TWILIO_TWIML_APP_SID
const API_KEY_SID = process.env.TWILIO_API_KEY_SID
const API_KEY_SECRET = process.env.TWILIO_API_KEY_SECRET

const client = twilio(ACCOUNT_SID, AUTH_TOKEN);

// GET /api/twilio/token - Generate capability token for client
router.get('/token', requireAuth, (req, res) => {
    try {
        const rawIdentity = req.user.username || req.user.email || req.user.id || 'user';
        // Twilio requires identity to be alphanumeric and underscores only
        const identity = String(rawIdentity).replace(/[^a-zA-Z0-9_]/g, '_');

        const accessToken = new twilio.jwt.AccessToken(
            ACCOUNT_SID,
            API_KEY_SID,
            API_KEY_SECRET,
            { identity: identity }
        );

        const voiceGrant = new twilio.jwt.AccessToken.VoiceGrant({
            outgoingApplicationSid: TWIML_APP_SID,
            incomingAllow: true, // Allow incoming calls
        });

        accessToken.addGrant(voiceGrant);

        const token = accessToken.toJwt();
        console.log(`📞 Generated Twilio token for ${identity}`);

        res.json({
            token: token,
            identity: identity,
            twilioNumber: TWILIO_NUMBER
        });
    } catch (error) {
        console.error('Error generating Twilio token:', error);
        res.status(500).json({ message: 'Failed to generate token' });
    }
});

// POST /api/twilio/voice - TwiML webhook for outbound calls
router.post('/voice', (req, res) => {
    const { To, From, CallSid, translate, callerLang } = req.body;
    console.log(`📞 Voice webhook triggered: From ${From} to ${To}, CallSid: ${CallSid}`);
    console.log('Webhook Body:', req.body);

    const voiceResponse = new VoiceResponse();

    try {
        // Use translation mode if requested
        if (translate === 'true' || translate === true) {
            const lang = callerLang || 'hi';
            console.log(`🌐 Initiating Translated Call with ConversationRelay (Caller Lang: ${lang})`);

            const serverUrl = process.env.SERVER_URL?.replace('http', 'ws') || 'ws://localhost:5000';
            const wsUrlWithParams = `${serverUrl}/ws/conversation?leg=caller&callerLang=${lang}&callSid=${CallSid}&to=${encodeURIComponent(To)}`;

            // Map callerLang to full BCP-47 locale codes. Twilio's TwiML validator often rejects short codes for Deepgram.
            const DEEPGRAM_LANG = {
                hi: 'hi-IN', en: 'en-US', ta: 'ta-IN', te: 'te-IN', mr: 'mr-IN', bn: 'bn-IN',
                gu: 'gu-IN', kn: 'kn-IN', ur: 'ur-IN',
                // Foreign languages
                bg: 'bg-BG', ca: 'ca-ES', zh: 'zh-CN', 'zh-TW': 'zh-TW', cs: 'cs-CZ',
                da: 'da-DK', nl: 'nl-NL', et: 'et-EE', fi: 'fi-FI', fr: 'fr-FR',
                de: 'de-DE', el: 'el-GR', hu: 'hu-HU', id: 'id-ID', it: 'it-IT',
                ja: 'ja-JP', ko: 'ko-KR', lv: 'lv-LV', lt: 'lt-LT', ms: 'ms-MY',
                no: 'no-NO', pl: 'pl-PL', pt: 'pt-PT', ro: 'ro-RO', ru: 'ru-RU',
                sk: 'sk-SK', es: 'es-ES', sv: 'sv-SE', th: 'th-TH', tr: 'tr-TR',
                uk: 'uk-UA', vi: 'vi-VN'
            };

            // If the language maps to a specific BCP-47 tag, use it. Otherwise, attempt a standard fallback (e.g., 'fr' -> 'fr-FR', 'es' -> 'es-ES').
            const sttLang = DEEPGRAM_LANG[lang] || (lang.length === 2 ? `${lang}-${lang.toUpperCase()}` : lang);

            const connect = voiceResponse.connect();
            connect.conversationRelay({
                url: wsUrlWithParams,
                // Pass the specific caller language so Deepgram Nova-3 can transcribe it accurately
                language: sttLang,
                transcriptionProvider: 'deepgram',
                speechModel: 'nova-3-general', // Nova-3 supports Indian regional languages
                // CRITICAL FIX: ElevenLabs DOES NOT support Marathi, Telugu, Kannada, etc.
                // Twilio crashes with an Application Error if ttsProvider is elevenlabs for these languages.
                // Google TTS officially supports deeply regional Indian languages.
                ttsProvider: 'google'
            });

        } else {
            // Normal Call Flow
            // Start real-time transcription for the callee's speech (outbound_track)
            const start = voiceResponse.start();
            start.transcription({
                name: `transcription-${CallSid}`,
                track: 'outbound_track',
                statusCallbackUrl: `${process.env.SERVER_URL || 'https://your-server-url.com'}/api/twilio/transcription-callback`,
                statusCallbackMethod: 'POST'
            });

            const dial = voiceResponse.dial({
                callerId: TWILIO_NUMBER,
                answerOnBridge: true
            });

            if (To && /^[+\d]+$/.test(To)) {
                dial.number(To);
            } else {
                dial.client(To);
            }
        }

        res.type('text/xml');
        res.send(voiceResponse.toString());
    } catch (error) {
        console.error('❌ Voice webhook error:', error);
        const errResponse = new VoiceResponse();
        errResponse.say('We encountered an error connecting your call. Please try again.');
        res.type('text/xml');
        res.send(errResponse.toString());
    }
});

// GET /api/twilio/voice - Debug TwiML generation (browser view)
router.get('/voice', (req, res) => {
    const voiceResponse = new VoiceResponse();
    voiceResponse.say('Welcome to Linzo Meet. This is a debug message.');
    res.type('text/xml');
    res.send(voiceResponse.toString());
});

// GET /api/twilio/logs - Get call logs for user
router.get('/logs', requireAuth, async (req, res) => {
    try {
        const logs = await CallLog.find({ user: req.user._id })
            .sort({ timestamp: -1 })
            .limit(50);
        res.json(logs);
    } catch (error) {
        console.error('Error fetching call logs:', error);
        res.status(500).json({ message: 'Failed to fetch logs' });
    }
});

// POST /api/twilio/logs - Save a new call log
router.post('/logs', requireAuth, async (req, res) => {
    try {
        const { recipientNumber, direction, status, duration, sid } = req.body;

        const log = new CallLog({
            user: req.user._id,
            recipientNumber,
            direction,
            status,
            duration,
            sid
        });

        await log.save();
        console.log(`📝 Logged call to ${recipientNumber} (${duration}s)`);
        res.status(201).json(log);
    } catch (error) {
        console.error('Error saving call log:', error);
        res.status(500).json({ message: 'Failed to save log' });
    }
});

// POST /api/twilio/transcription-callback - Receive real-time transcription updates
router.post('/transcription-callback', (req, res) => {
    console.log(`📝 Transcription callback received from Twilio`);

    // The logs showed: "TranscriptionEvent": "transcription-content" and "TranscriptionData": "{\"transcript\":\"Hello\"...}"
    const { CallSid, TranscriptionEvent, TranscriptionData } = req.body;
    let text = '';

    // Handle Real-time <Stream> transcription events
    if (TranscriptionEvent === 'transcription-content' && TranscriptionData) {
        try {
            const data = JSON.parse(TranscriptionData);
            text = data.transcript;
            console.log(`🔍 Real-time Transcript: "${text}" (Confidence: ${data.confidence})`);
        } catch (e) {
            console.error('❌ Failed to parse TranscriptionData:', e);
        }
    }
    // Fallback for standard <Transcription> status callback (Legacy)
    else if (req.body.TranscriptionStatus === 'completed') {
        text = req.body.TranscriptionText;
    }

    if (text && text.trim()) {
        console.log(`💬 Processing text for avatar: "${text}"`);

        // Get call info from our mapping
        const callInfo = activeCallMap.get(CallSid);

        if (callInfo) {
            const io = req.io;
            if (io) {
                console.log(`🚀 Broadcasting transcription to room`);
                io.emit('twilio-transcription', {
                    callSid: CallSid,
                    text: text.trim(),
                    phoneNumber: callInfo.phoneNumber,
                    timestamp: Date.now()
                });
                console.log(`✅ Transcription broadcast complete`);
            } else {
                console.error('❌ Socket.IO not available on request object');
            }
        } else {
            // Broadcast even without call info map (resilience)
            const io = req.io;
            if (io) {
                io.emit('twilio-transcription', {
                    callSid: CallSid,
                    text: text.trim(),
                    phoneNumber: 'Unknown',
                    timestamp: Date.now()
                });
            }
            console.log(`⚠️ No call info found for CallSid: ${CallSid}, but broadcasted anyway.`);
        }
    }

    res.sendStatus(200);
});

// POST /api/twilio/call-started - Track when a call starts (called from frontend)
router.post('/call-started', requireAuth, (req, res) => {
    try {
        const { callSid, phoneNumber, roomId } = req.body;

        if (!callSid || !phoneNumber) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        // Store call mapping
        activeCallMap.set(callSid, {
            userId: req.user._id.toString(),
            phoneNumber,
            roomId: roomId || null,
            startTime: Date.now()
        });

        console.log(`📞 Call started - SID: ${callSid}, User: ${req.user.username}, Phone: ${phoneNumber}`);
        console.log(`📊 Active calls: ${activeCallMap.size}`);

        res.json({ success: true });
    } catch (error) {
        console.error('Error tracking call start:', error);
        res.status(500).json({ message: 'Failed to track call' });
    }
});

// POST /api/twilio/call-ended - Clean up when a call ends (called from frontend)
router.post('/call-ended', requireAuth, (req, res) => {
    try {
        const { callSid } = req.body;

        if (callSid && activeCallMap.has(callSid)) {
            activeCallMap.delete(callSid);
            console.log(`📞 Call ended - SID: ${callSid}`);
            console.log(`📊 Active calls: ${activeCallMap.size}`);
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error tracking call end:', error);
        res.status(500).json({ message: 'Failed to track call end' });
    }
});

// POST /api/twilio/handle-language-selection - Handle IVR language selection
router.post('/handle-language-selection', (req, res) => {
    const digits = req.body.Digits || req.query.Digits || '1'; // Default to 1 if no input
    const callSid = req.query.callSid;
    const callerLang = req.query.callerLang;

    // Map digits to Twilio short code
    // 1: English, 2: Hindi, 3: Marathi, 4: Bengali, 5: Gujarati, 6: Kannada, 7: Tamil, 8: Telugu, 9: Urdu
    const langMap = {
        '1': 'en', '2': 'hi', '3': 'mr', '4': 'bn',
        '5': 'gu', '6': 'kn', '7': 'ta', '8': 'te', '9': 'ur'
    };

    const selectedShortCode = langMap[digits] || 'en';

    // Map short code to BCP-47 for Deepgram exactly as done in /voice
    const DEEPGRAM_LANG = {
        hi: 'hi-IN', en: 'en-US', ta: 'ta-IN', te: 'te-IN', mr: 'mr-IN', bn: 'bn-IN',
        gu: 'gu-IN', kn: 'kn-IN', ur: 'ur-IN'
    };
    const selectedSttLang = DEEPGRAM_LANG[selectedShortCode] || selectedShortCode;

    const wsBaseUrl = process.env.SERVER_URL?.replace('http', 'ws') || 'ws://localhost:5000';
    const calleeWsUrl = `${wsBaseUrl}/ws/conversation?leg=callee&callSid=${callSid}&callerLang=${callerLang}&calleeLang=${selectedShortCode}`;

    console.log(`🎙️ External callee selected language: ${selectedShortCode} (Digits: ${digits})`);

    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    response.connect().conversationRelay({
        url: calleeWsUrl,
        language: selectedSttLang,
        transcriptionProvider: 'deepgram',
        speechModel: 'nova-3-general',
        ttsProvider: 'google'
    });

    res.type('text/xml');
    res.send(response.toString());
});

export default router;
