import { WebSocketServer } from 'ws';
import twilio from 'twilio';
import callTranslationService from '../services/callTranslationService.js';

const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

/**
 * WebSocket handler for Twilio ConversationRelay.
 *
 * TWO-LEG TRANSLATION BRIDGE
 * ─────────────────────────
 * Leg 1 (caller): Person 1 (app) → ConversationRelay → this WS server
 * Leg 2 (callee): Person 2 (phone) → ConversationRelay → this WS server
 *
 * In ConversationRelay, the 'prompt' event carries the caller's transcribed
 * speech in the `voicePrompt` field. We translate that text and send it as
 * a 'text' token to the OTHER leg so ElevenLabs speaks the translation.
 *
 * Ref: https://www.twilio.com/docs/voice/conversationrelay
 */

// Map of parentCallSid -> { callerWs, calleeWs, callerLang, calleeNumber, outboundCallSid }
const sessions = new Map();

function sendText(ws, text) {
    if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify({ type: 'text', token: text, last: true }));
    }
}

function normalizeSpeechText(text) {
    return String(text || '')
        .trim()
        .toLowerCase()
        .replace(/[\s]+/g, ' ')
        .replace(/[?.!,;:]+$/g, '');
}

function shouldSkipRepeatedSpeech(session, leg, text) {
    const normalized = normalizeSpeechText(text);
    if (!normalized) return true;

    if (!session.recentSpeechByLeg) session.recentSpeechByLeg = {};
    const now = Date.now();
    const recent = session.recentSpeechByLeg[leg] || [];
    const fresh = recent.filter(item => now - item.at < 7000);

    const duplicate = fresh.some(item => item.normalized === normalized);
    const fragmentOfRecentLonger = fresh.some(item =>
        item.normalized.length > normalized.length + 4 && item.normalized.includes(normalized)
    );

    session.recentSpeechByLeg[leg] = [...fresh, { normalized, at: now }].slice(-8);
    return duplicate || fragmentOfRecentLonger;
}

export const registerConversationRelayHandler = (server) => {
    const wss = new WebSocketServer({ noServer: true });

    server.on('upgrade', (request, socket, head) => {
        const protocol = request.headers['x-forwarded-proto'] || 'http';
        const host = request.headers['host'];
        const fullUrlString = `${protocol}://${host}${request.url}`;
        const requestUrl = new URL(fullUrlString);
        const pathname = requestUrl.pathname;

        if (pathname === '/ws/conversation') {
            const twilioSignature = request.headers['x-twilio-signature'];
            const authToken = process.env.TWILIO_AUTH_TOKEN;

            if (!twilioSignature) {
                console.warn('⚠️ Missing X-Twilio-Signature. Rejecting.');
                socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
                socket.destroy();
                return;
            }

            const wsFullUrl = fullUrlString.replace('https:', 'wss:').replace('http:', 'ws:');
            const httpsFullUrl = fullUrlString.replace('wss:', 'https:').replace('ws:', 'http:');

            const isValid =
                twilio.validateRequest(authToken, twilioSignature, wsFullUrl, {}) ||
                twilio.validateRequest(authToken, twilioSignature, httpsFullUrl, {});

            if (!isValid) {
                console.warn(`⚠️ Invalid Twilio Signature. URL: ${fullUrlString}`);
                socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
                socket.destroy();
                return;
            }

            console.log('✅ Twilio Signature Validated');
            wss.handleUpgrade(request, socket, head, (ws) => {
                wss.emit('connection', ws, request);
            });
        }
    });

    wss.on('connection', (ws, request) => {
        const protocol = request.headers['x-forwarded-proto'] || 'http';
        const host = request.headers['host'];
        const requestUrl = new URL(request.url, `${protocol}://${host}`);
        const query = Object.fromEntries(requestUrl.searchParams.entries());

        const callerLang = query.callerLang || 'hi';
        const calleeLang = query.calleeLang || 'en'; // Defaults to English if not provided
        const parentCallSid = query.callSid;
        const leg = query.leg || 'caller'; // 'caller' or 'callee'

        console.log(`🔌 [${leg}] Connected. CallSid: ${parentCallSid}`);

        ws.on('message', async (data) => {
            try {
                const message = JSON.parse(data.toString());
                const msgType = message.type;

                switch (msgType) {
                    // ──────────────────────────────────────────────────────
                    // SETUP: Session established. For leg=caller, dial Person 2.
                    // ──────────────────────────────────────────────────────
                    case 'setup': {
                        const callSid = message.callSid || parentCallSid;
                        console.log(`✅ [${leg}] Session ready. SID: ${callSid}`);

                        if (leg === 'caller') {
                            const calleeNumber = query.to;
                            console.log(`📞 [Leg 1] Dialing Person 2 at: ${calleeNumber}`);

                            sessions.set(callSid, {
                                callerWs: ws,
                                calleeWs: null,
                                callerLang,
                                calleeLang: 'en', // Will be updated when callee leg connects
                                calleeNumber,
                                parentCallSid: callSid
                            });

                            // Build callee WS URL
                            const serverUrl = process.env.SERVER_URL || 'http://localhost:5000';
                            
                            // Build callee TwiML with <Gather> for IVR language selection
                            const VoiceResponse = twilio.twiml.VoiceResponse;
                            const calleeResponse = new VoiceResponse();
                            
                            const gatherParams = `?callSid=${callSid}&callerLang=${callerLang}`;
                            
                            const gather = calleeResponse.gather({
                                numDigits: 1,
                                action: `${serverUrl}/api/twilio/handle-language-selection${gatherParams}`,
                                method: 'POST',
                                timeout: 10
                            });
                            
                            gather.say({ language: 'en-IN' }, 
                                "Please select the language in which you want to continue the conversation. " +
                                "Press 1 for English. Press 2 for Hindi. Press 3 for Marathi. Press 4 for Bengali. " +
                                "Press 5 for Gujarati. Press 6 for Kannada. Press 7 for Tamil. Press 8 for Telugu. Press 9 for Urdu."
                            );
                            
                            // If user doesn't press anything within timeout, fallback
                            calleeResponse.say({ language: 'en-IN' }, "No input received. Defaulting to English.");
                            calleeResponse.redirect({ method: 'POST' }, `${serverUrl}/api/twilio/handle-language-selection${gatherParams}&Digits=1`);

                            try {
                                const formatted = calleeNumber.startsWith('+') ? calleeNumber : `+${calleeNumber}`;
                                const outboundCall = await twilioClient.calls.create({
                                    to: formatted,
                                    from: process.env.TWILIO_PHONE_NUMBER,
                                    twiml: calleeResponse.toString()
                                });
                                console.log(`📞 [Leg 2] Outbound call initiated. SID: ${outboundCall.sid}`);
                                sessions.get(callSid).outboundCallSid = outboundCall.sid;
                            } catch (err) {
                                console.error('❌ Failed to dial callee:', err.message);
                                sendText(ws, 'Sorry, we could not connect your call. Please try again.');
                            }

                        } else {
                            // Leg 2 callee: link to the existing session
                            const session = sessions.get(parentCallSid);
                            if (session) {
                                session.calleeWs = ws;
                                session.calleeLang = query.calleeLang || 'en'; // Store the selected language
                                console.log(`🔗 [Leg 2] Callee linked. Callee selected language: ${session.calleeLang}`);
                            } else {
                                console.warn('⚠️ [Leg 2] No session found for:', parentCallSid);
                            }
                        }
                        break;
                    }

                    // ──────────────────────────────────────────────────────
                    // PROMPT: Twilio sends this when a person has spoken.
                    // The speech is in message.voicePrompt
                    // We translate it and send to the OTHER leg.
                    // ──────────────────────────────────────────────────────
                    case 'prompt': {
                        const spokenText = message.voicePrompt;

                        if (!spokenText || !spokenText.trim()) {
                            // No speech in this prompt – send empty ack so Twilio keeps listening
                            sendText(ws, '');
                            break;
                        }

                        console.log(`🗣️ [${leg}] Prompt speech: "${spokenText}"`);

                        const session = sessions.get(parentCallSid);
                        if (!session) {
                            console.warn(`⚠️ No session for SID: ${parentCallSid}`);
                            sendText(ws, '');
                            break;
                        }

                        if (shouldSkipRepeatedSpeech(session, leg, spokenText)) {
                            console.log(`↩️ [${leg}] Skipping repeated/fragment speech: "${spokenText}"`);
                            sendText(ws, '');
                            break;
                        }

                        let sourceLang, targetLang, destinationWs;
                        if (leg === 'caller') {
                            // Person 1 speaks -> Translate to Callee's selected language
                            sourceLang = session.callerLang || callerLang || 'auto';
                            targetLang = session.calleeLang || 'en';
                            destinationWs = session.calleeWs;
                        } else {
                            // Person 2 speaks -> Translate to Caller's original language
                            sourceLang = session.calleeLang || calleeLang || 'auto';
                            targetLang = session.callerLang;
                            destinationWs = session.callerWs;
                        }

                        console.log(`🌐 Translating [${leg}]: "${spokenText}" (${sourceLang} -> ${targetLang})`);

                        try {
                            const translatedText = await callTranslationService.translate(
                                spokenText,
                                sourceLang,
                                targetLang
                            );
                            console.log(`📤 Translation: "${translatedText}" → injecting into ${leg === 'caller' ? 'callee' : 'caller'}`);

                            if (destinationWs && destinationWs.readyState === 1) {
                                sendText(destinationWs, translatedText);
                            } else {
                                console.warn(`⚠️ Destination WS not ready — translation dropped.`);
                            }

                            // Also send empty ack to the source side so it keeps listening
                            sendText(ws, '');
                        } catch (err) {
                            console.error(`❌ Translation error:`, err.message);
                            sendText(ws, '');
                        }
                        break;
                    }

                    // ──────────────────────────────────────────────────────
                    // UTTERANCE: Some ConversationRelay configs send this
                    // instead of / alongside prompt.
                    // ──────────────────────────────────────────────────────
                    case 'utterance': {
                        const originalText = message.utterance || message.voicePrompt;
                        if (!originalText || !originalText.trim()) break;

                        console.log(`🗣️ [${leg}] Utterance: "${originalText}"`);
                        const session = sessions.get(parentCallSid);
                        if (!session) break;

                        if (shouldSkipRepeatedSpeech(session, leg, originalText)) {
                            console.log(`↩️ [${leg}] Skipping repeated/fragment utterance: "${originalText}"`);
                            break;
                        }

                        const sourceLang = leg === 'caller'
                            ? (session.callerLang || callerLang || 'auto')
                            : (session.calleeLang || calleeLang || 'auto');
                        const targetLang = leg === 'caller' ? (session.calleeLang || 'en') : session.callerLang;
                        const destinationWs = leg === 'caller' ? session.calleeWs : session.callerWs;

                        try {
                            const translatedText = await callTranslationService.translate(originalText, sourceLang, targetLang);
                            console.log(`📤 [utterance] (${sourceLang} -> ${targetLang}) "${translatedText}"`);
                            if (destinationWs && destinationWs.readyState === 1) {
                                sendText(destinationWs, translatedText);
                            }
                        } catch (err) {
                            console.error(`❌ Translation error (utterance):`, err.message);
                        }
                        break;
                    }

                    case 'interruption':
                        console.log(`🛑 [${leg}] Interruption`);
                        break;

                    case 'error':
                        console.error(`❌ [${leg}] Error:`, message.error || message);
                        break;

                    default:
                        console.log(`❓ [${leg}] Unhandled: ${msgType}`, JSON.stringify(message).slice(0, 200));
                }
            } catch (err) {
                console.error(`❌ [${leg}] Error processing message:`, err);
            }
        });

        ws.on('close', () => {
            console.log(`🔌 [${leg}] Disconnected. CallSid: ${parentCallSid}`);
            if (leg === 'caller' && parentCallSid) {
                sessions.delete(parentCallSid);
                console.log(`🗑️ Session cleaned up: ${parentCallSid}`);
            }
        });

        ws.on('error', (err) => {
            console.error(`❌ [${leg}] WebSocket Error:`, err);
        });
    });

    return wss;
};
