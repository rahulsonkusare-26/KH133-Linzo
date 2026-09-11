import React, { useState, useEffect, useRef } from 'react';
import { Device } from '@twilio/voice-sdk';
import api from '../lib/api';

const CallWidget = ({ isOpen, onClose }) => {
    const [activeTab, setActiveTab] = useState('dialpad'); // dialpad, history
    const [phoneNumber, setPhoneNumber] = useState('');
    const [device, setDevice] = useState(null);
    const [token, setToken] = useState(null);
    const [callStatus, setCallStatus] = useState('idle'); // idle, connecting, connected, disconnecting
    const [activeCall, setActiveCall] = useState(null);
    const [callDuration, setCallDuration] = useState(0);
    const [callLogs, setCallLogs] = useState([]);
    const [callMode, setCallMode] = useState('normal'); // normal, translate
    const [callerLang, setCallerLang] = useState('hi'); // Default to Hindi as per request
    const [isMuted, setIsMuted] = useState(false);
    const durationIntervalRef = useRef(null);

    // Initialize Twilio Device
    useEffect(() => {
        if (isOpen && !device) {
            setupDevice();
        }
        if (isOpen) {
            fetchLogs();
        }
    }, [isOpen]);

    const setupDevice = async () => {
        try {
            const response = await api.get('/twilio/token');
            const data = response.data;
            setToken(data.token);

            const newDevice = new Device(data.token, {
                codecPreferences: ['opus', 'pcmu'],
                fakeLocalDTMF: true,
                enableRingingState: true
            });

            newDevice.on('ready', () => console.log('📞 Twilio Device ready'));
            newDevice.on('error', (error) => {
                console.error('📞 Twilio Device error:', error);
            });

            // Handle incoming calls
            newDevice.on('incoming', (conn) => {
                setCallStatus('incoming');
                setActiveCall(conn);

                conn.on('accept', () => {
                    setCallStatus('connected');
                    startDurationTimer();
                });

                conn.on('disconnect', () => {
                    handleDisconnect();
                });
            });

            setDevice(newDevice);
        } catch (error) {
            console.error('Failed to setup Twilio device:', error);
            alert(`Call Setup Failed: ${error.message}`);
        }
    };

    const fetchLogs = async () => {
        try {
            const response = await api.get('/twilio/logs');
            setCallLogs(response.data);
        } catch (error) {
            console.error('Failed to fetch call logs:', error);
        }
    };

    const saveLog = async (logData) => {
        try {
            await api.post('/twilio/logs', logData);
            fetchLogs(); // Refresh logs
        } catch (error) {
            console.error('Failed to save call log:', error);
        }
    };

    const handleCall = async () => {
        if (!device || !phoneNumber) return;

        let numberToCall = phoneNumber;
        
        try {
            setCallStatus('connecting');

            const connectParams = {
                To: numberToCall,
                translate: callMode === 'translate',
                callerLang: callerLang
            };

            console.log('📞 Initiating call with params:', connectParams);

            const conn = await device.connect({ params: connectParams });
            setActiveCall(conn);

            conn.on('accept', async () => {
                setCallStatus('connected');
                startDurationTimer();
                console.log('📞 Call accepted');

                try {
                    const callSid = conn.parameters.CallSid;
                    console.log('📞 Notifying backend of call start, CallSid:', callSid);
                    await api.post('/twilio/call-started', {
                        callSid,
                        phoneNumber: numberToCall,
                        roomId: null,
                        translate: callMode === 'translate',
                        callerLang: callerLang
                    });
                } catch (error) {
                    console.error('Failed to notify backend of call start:', error);
                }
            });

            conn.on('disconnect', () => {
                handleDisconnect();
                console.log('📞 Call disconnected');
            });

            conn.on('error', (error) => {
                console.error('Call connection error:', error);
                handleDisconnect();
            });

        } catch (error) {
            console.error('Failed to make call:', error);
            alert(`Call Failed: ${error.message || 'Unknown error'}`);
            setCallStatus('idle');
        }
    };

    const handleHangup = () => {
        if (activeCall) {
            activeCall.disconnect();
        }
        handleDisconnect();
    };

    const handleDisconnect = async () => {
        setCallStatus('idle');
        setIsMuted(false);

        if (activeCall) {
            try {
                const callSid = activeCall.parameters?.CallSid;
                if (callSid) {
                    console.log('📞 Notifying backend of call end, CallSid:', callSid);
                    await api.post('/twilio/call-ended', { callSid });
                }
            } catch (error) {
                console.error('Failed to notify backend of call end:', error);
            }
        }

        if (durationIntervalRef.current) {
            clearInterval(durationIntervalRef.current);
            durationIntervalRef.current = null;
        }

        if (phoneNumber) {
            saveLog({
                recipientNumber: phoneNumber,
                direction: 'outbound',
                status: 'completed',
                duration: callDuration,
            });
        }

        setCallDuration(0);
        setActiveCall(null);
    };

    const startDurationTimer = () => {
        setCallDuration(0);
        if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);

        const startTime = Date.now();
        durationIntervalRef.current = setInterval(() => {
            setCallDuration(Math.floor((Date.now() - startTime) / 1000));
        }, 1000);
    };

    const toggleMute = () => {
        if (activeCall) {
            const newState = !isMuted;
            activeCall.mute(newState);
            setIsMuted(newState);
        }
    };

    const handleBackspace = () => {
        setPhoneNumber(prev => prev.slice(0, -1));
    };

    const formatDuration = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const DialButton = ({ value, sub = '', onClick }) => (
        <button
            onClick={() => onClick(value)}
            className="w-[72px] h-[72px] sm:w-[56px] sm:h-[56px] rounded-full bg-gray-50/80 hover:bg-gray-100 active:bg-gray-200 flex flex-col items-center justify-center transition-all shadow-sm ring-1 ring-gray-200/50"
        >
            <span className="text-3xl sm:text-xl font-normal text-gray-800 leading-none">{value}</span>
            {sub && <span className="text-[11px] sm:text-[8px] text-gray-400 font-bold uppercase tracking-widest mt-1 sm:mt-0">{sub}</span>}
        </button>
    );

    if (!isOpen) return null;

    return (
        <div className="fixed top-0 left-0 right-0 bottom-[64px] sm:absolute sm:inset-auto sm:right-6 sm:top-[48px] sm:bottom-[48px] w-full sm:w-[320px] bg-white sm:bg-white/95 sm:backdrop-blur-2xl rounded-none sm:rounded-3xl shadow-none sm:shadow-2xl ring-0 sm:ring-1 ring-black/5 overflow-hidden flex flex-col z-[60] animate-in fade-in zoom-in-95 duration-200 origin-top-right">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-white shadow-sm sm:shadow-none z-10 w-full">
                <div className="font-bold text-gray-800 text-lg tracking-tight">Call</div>
                <button onClick={onClose} className="hidden sm:block text-gray-400 hover:text-gray-600 p-2 -mr-2 rounded-full hover:bg-gray-100 transition-colors">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <div className="flex-1 flex flex-col overflow-hidden relative">
                {activeTab === 'dialpad' ? (
                    <div className="flex flex-col h-full bg-white overflow-y-auto custom-scrollbar">
                        <div className="px-6 py-2 border-b border-gray-50 bg-white flex flex-col justify-end">
                            {callStatus === 'idle' ? (
                                <div className="w-full flex flex-col items-center gap-3">
                                    <div className="w-full relative flex items-center justify-center">
                                        <input
                                            type="text"
                                            value={phoneNumber}
                                            onChange={(e) => setPhoneNumber(e.target.value)}
                                            placeholder="Enter number..."
                                            className="text-2xl font-semibold text-center bg-transparent border-none outline-none w-full placeholder:text-gray-300 text-gray-800 tracking-wider"
                                        />
                                        {phoneNumber && (
                                            <button onClick={handleBackspace} className="absolute right-0 text-gray-300 hover:text-gray-500 p-1">
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V7a2 2 0 00-2-2h-8.172a2 2 0 00-1.414.586L3 12z" /></svg>
                                            </button>
                                        )}
                                    </div>

                                    <div className="flex bg-gray-100/80 p-1 rounded-[14px] w-full max-w-[200px]">
                                        <button onClick={() => setCallMode('normal')} className={`flex-1 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${callMode === 'normal' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-400'}`}>Normal</button>
                                        <button onClick={() => setCallMode('translate')} className={`flex-1 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${callMode === 'translate' ? 'bg-[#684CFE] text-white shadow-sm' : 'text-gray-400'}`}>Translate</button>
                                    </div>

                                    {callMode === 'translate' && (
                                        <div className="flex flex-col items-center gap-1 w-full animate-in fade-in slide-in-from-top-1 duration-200">
                                            <select
                                                value={callerLang}
                                                onChange={(e) => setCallerLang(e.target.value)}
                                                className="bg-white/50 border border-gray-100 rounded-lg px-2 py-1 text-[11px] font-bold text-gray-600 outline-none hover:bg-white transition-colors w-full max-w-[220px]"
                                            >
                                                <option value="bg">Bulgarian (Български)</option><option value="ca">Catalan (Català)</option><option value="zh">Chinese Simplified (普通话)</option><option value="zh-TW">Chinese Traditional (繁體中文)</option><option value="cs">Czech (Čeština)</option><option value="da">Danish (Dansk)</option><option value="nl">Dutch (Nederlands)</option><option value="en">English</option><option value="et">Estonian (Eesti)</option><option value="fi">Finnish (Suomi)</option><option value="fr">French (Français)</option><option value="de">German (Deutsch)</option><option value="el">Greek (Ελληνικά)</option><option value="hi">Hindi (हिन्दी)</option><option value="bn">Bengali (বাংলা)</option><option value="gu">Gujarati (ગુજરાતી)</option><option value="kn">Kannada (ಕನ್ನಡ)</option><option value="mr-IN">Marathi (มराठी)</option><option value="ta-IN">Tamil (தமிழ்)</option><option value="te">Telugu (తెలుగు)</option><option value="ur">Urdu (اردو)</option><option value="hu">Hungarian (Magyar)</option><option value="id">Indonesian (Bahasa Indonesia)</option><option value="it">Italian (Italiano)</option><option value="ja">Japanese (日本語)</option><option value="ko">Korean (한국어)</option><option value="lv">Latvian (Latviešu)</option><option value="lt">Lithuanian (Lietuvių)</option><option value="ms">Malay (Bahasa Melayu)</option><option value="no">Norwegian (Norsk)</option><option value="pl">Polish (Polski)</option><option value="pt">Portuguese (Português)</option><option value="ro">Romanian (Română)</option><option value="ru">Russian (Русский)</option><option value="sk">Slovak (Slovenčina)</option><option value="es">Spanish (Español)</option><option value="sv">Swedish (Svenska)</option><option value="th">Thai (ไทย)</option><option value="tr">Turkish (Türkçe)</option><option value="uk">Ukrainian (Українська)</option><option value="vi">Vietnamese (Tiếng Việt)</option>
                                            </select>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center py-2 animate-in fade-in scale-95 duration-300">
                                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mb-2 shadow-inner">
                                        <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                    </div>
                                    <div className="text-lg font-bold text-gray-800 mb-1">{phoneNumber}</div>
                                    <div className={`text-xs font-bold px-3 py-1 rounded-full ${callStatus === 'connected' ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500 animate-pulse'}`}>
                                        {callStatus === 'connected' ? formatDuration(callDuration) : 'Initiating...'}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex-1 flex flex-col justify-center p-6 sm:p-2 pb-safe min-h-[320px] sm:min-h-0">
                            {callStatus === 'idle' ? (
                                <>
                                    <div className="grid grid-cols-3 gap-x-4 sm:gap-x-4 gap-y-1.5 sm:gap-y-1.5 mb-1 sm:mb-2 mx-auto">
                                        <DialButton value="1" onClick={(v) => setPhoneNumber(p => p + v)} />
                                        <DialButton value="2" sub="ABC" onClick={(v) => setPhoneNumber(p => p + v)} />
                                        <DialButton value="3" sub="DEF" onClick={(v) => setPhoneNumber(p => p + v)} />
                                        <DialButton value="4" sub="GHI" onClick={(v) => setPhoneNumber(p => p + v)} />
                                        <DialButton value="5" sub="JKL" onClick={(v) => setPhoneNumber(p => p + v)} />
                                        <DialButton value="6" sub="MNO" onClick={(v) => setPhoneNumber(p => p + v)} />
                                        <DialButton value="7" sub="PQRS" onClick={(v) => setPhoneNumber(p => p + v)} />
                                        <DialButton value="8" sub="TUV" onClick={(v) => setPhoneNumber(p => p + v)} />
                                        <DialButton value="9" sub="WXYZ" onClick={(v) => setPhoneNumber(p => p + v)} />
                                        <DialButton value="*" onClick={(v) => setPhoneNumber(p => p + v)} />
                                        <DialButton value="0" sub="+" onClick={(v) => setPhoneNumber(p => p + v)} />
                                        <DialButton value="#" onClick={(v) => setPhoneNumber(p => p + v)} />
                                    </div>
                                    <div className="flex justify-center pb-4 sm:pb-2">
                                        <button
                                            onClick={handleCall}
                                            disabled={!phoneNumber}
                                            className={`w-[72px] h-[72px] sm:w-[56px] sm:h-[56px] rounded-full flex items-center justify-center text-white shadow-xl transition-all active:scale-90 ${phoneNumber ? 'bg-[#4ade80] hover:bg-[#22c55e]' : 'bg-gray-200 cursor-not-allowed opacity-50'}`}
                                        >
                                            <svg className="w-8 h-8 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className="flex flex-col items-center gap-8 py-4">
                                    <div className="grid grid-cols-2 gap-8">
                                        <button onClick={toggleMute} className="flex flex-col items-center gap-2">
                                            <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isMuted ? 'bg-[#684CFE] text-white shadow-lg' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}>
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />{isMuted && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 3l18 18" />}</svg>
                                            </div>
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{isMuted ? 'Muted' : 'Mute'}</span>
                                        </button>
                                        <button className="flex flex-col items-center gap-2 opacity-30 cursor-not-allowed">
                                            <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center text-gray-400">
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>
                                            </div>
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Keypad</span>
                                        </button>
                                    </div>
                                    <button onClick={handleHangup} className="w-[72px] h-[72px] sm:w-[56px] sm:h-[56px] rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-xl shadow-red-500/30 transition-all active:scale-90">
                                        <svg className="w-8 h-8 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 8l2-2m0 0l2-2m-2 2 l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 01-5.516-5.516l2.257-1.13a1 1 0 00.502-1.21L8.228 8.028A1 1 0 007.28 7.344H4z" /></svg>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <HistoryView callLogs={callLogs} onClose={() => setActiveTab('dialpad')} onCall={(number) => { setPhoneNumber(number); setActiveTab('dialpad'); }} />
                )}
            </div>

            <div 
                className="flex border-t border-gray-100 bg-white/95 backdrop-blur-md pt-2 sm:pb-0 sm:pt-0" 
                style={{ paddingBottom: 'calc(8px + env(safe-area-inset-bottom, 16px))' }}
            >
                <button onClick={() => setActiveTab('history')} className="flex-1 flex flex-col items-center justify-center py-3 gap-1 group">
                    <svg className={`w-6 h-6 transition-colors ${activeTab === 'history' ? 'text-[#684CFE]' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <span className={`text-[9px] font-bold uppercase tracking-widest ${activeTab === 'history' ? 'text-[#684CFE]' : 'text-gray-400'}`}>Recents</span>
                </button>
                <button onClick={onClose} className="flex-1 flex flex-col items-center justify-center py-3 gap-1 group sm:hidden">
                    <svg className="w-6 h-6 text-gray-400 group-hover:text-rose-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                    <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400 group-hover:text-rose-500 transition-colors">Close</span>
                </button>
                <button onClick={() => setActiveTab('dialpad')} className="flex-1 flex flex-col items-center justify-center py-3 gap-1 group">
                    <svg className={`w-6 h-6 transition-colors ${activeTab === 'dialpad' ? 'text-[#684CFE]' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                    <span className={`text-[9px] font-bold uppercase tracking-widest ${activeTab === 'dialpad' ? 'text-[#684CFE]' : 'text-gray-400'}`}>Keypad</span>
                </button>
            </div>
        </div>
    );
};

const HistoryView = ({ callLogs, onClose, onCall }) => {
    const [selectedNumber, setSelectedNumber] = useState(null);

    const groupedLogs = callLogs.reduce((acc, log) => {
        if (!acc[log.recipientNumber]) acc[log.recipientNumber] = [];
        acc[log.recipientNumber].push(log);
        return acc;
    }, {});

    const sortedNumbers = Object.keys(groupedLogs).sort((a, b) => new Date(groupedLogs[b][0].timestamp) - new Date(groupedLogs[a][0].timestamp));

    if (selectedNumber) {
        const numberLogs = groupedLogs[selectedNumber];
        return (
            <div className="flex-1 overflow-y-auto bg-gray-50/50 p-4">
                <div className="flex items-center mb-4 sticky top-0 bg-gray-50/95 backdrop-blur-sm z-10 pb-2">
                    <button onClick={() => setSelectedNumber(null)} className="mr-3 text-[#684CFE] bg-[#684CFE]/10 p-2 rounded-full"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg></button>
                    <h3 className="font-bold text-gray-900 text-xl tracking-tight">{selectedNumber}</h3>
                </div>
                <div className="space-y-3">
                    {numberLogs.map((log) => (
                        <div key={log._id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${log.direction === 'outbound' ? 'bg-[#684CFE]/10 text-[#684CFE]' : 'bg-green-50 text-green-500'}`}>
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        {log.direction === 'outbound' ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" /> : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19.5 4.5l-15 15m0 0h11.25m-11.25 0V8.25" />}
                                    </svg>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500 font-bold">{new Date(log.timestamp).toLocaleDateString()}</div>
                                    <div className="text-sm font-semibold text-gray-800">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                </div>
                            </div>
                            <div className="px-3 py-1 rounded-full bg-gray-100/50 text-xs font-bold text-gray-600">{Math.floor(log.duration / 60)}:{(log.duration % 60).toString().padStart(2, '0')}</div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto bg-gray-50/50 p-2 sm:p-4">
            {sortedNumbers.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 py-12">
                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3"><svg className="w-6 h-6 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
                    <span className="text-xs font-medium">No recent calls</span>
                </div>
            ) : (
                <div className="space-y-2">
                    {sortedNumbers.map((number) => {
                        const logs = groupedLogs[number];
                        const lastLog = logs[0];
                        return (
                            <div key={number} onClick={() => setSelectedNumber(number)} className="bg-white px-4 py-3 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between cursor-pointer active:bg-gray-50 transition-all">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#684CFE]/10 to-[#684CFE]/20 text-[#684CFE] flex items-center justify-center font-bold text-base">{logs.length > 1 ? logs.length : <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>}</div>
                                    <div>
                                        <div className="font-bold text-gray-900 text-base mb-0.5">{number}</div>
                                        <div className="text-[10px] text-gray-500 font-semibold">{lastLog.direction === 'outbound' ? 'Outgoing' : 'Incoming'} • {new Date(lastLog.timestamp).toLocaleDateString()}</div>
                                    </div>
                                </div>
                                <button onClick={(e) => { e.stopPropagation(); onCall(number); }} className="w-10 h-10 rounded-full bg-[#4ade80] text-white flex items-center justify-center transition-all active:scale-95"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg></button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default CallWidget;
