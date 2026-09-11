import React from 'react';
import LinzoLogo from '../../assets/linzo-logo.png';

/**
 * RoomHeader — Compact top bar.
 * Left: Logo | Room ID | Connection | Status badges
 * Right: Prominence toggle | Smart Rewind | Translation | Avatar
 * All existing props and handlers are 100% preserved.
 */
const RoomHeader = ({
    roomId,
    isConnected,
    socketRef,
    isSignLanguageActive,
    isBackgroundListening,
    isSignToVoiceActive,
    useClientAlphabetModel,
    isISLTypingActive,
    isTranslationEnabled,
    setIsTranslationEnabled,
    preferredLanguage,
    setPreferredLanguage,
    speakText,
    user,
    fetchSmartRewind,
    prominenceMode = 'grid',
    setProminenceMode = () => {},
    userType = 'normal',
    showAvatar = false,
}) => {
    const [rewindSummary, setRewindSummary] = React.useState(null);
    const [isRewinding, setIsRewinding] = React.useState(false);

    const handleRewind = async () => {
        if (isRewinding) return;
        setIsRewinding(true);
        setRewindSummary(null);
        try {
            const data = await fetchSmartRewind();
            if (data?.success) {
                setRewindSummary(data.summary);
                setTimeout(() => setRewindSummary(null), 15000);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsRewinding(false);
        }
    };

    return (
        <header className="sticky top-0 z-[110] bg-white/90 backdrop-blur-xl border-b border-slate-100 flex items-center justify-between px-3 sm:px-5 h-11 sm:h-12 shrink-0 transition-all duration-300">

            {/* ── Smart Rewind Card ── */}
            {rewindSummary && (
                <div className="fixed top-14 sm:top-16 right-3 sm:right-5 w-[92vw] sm:w-full max-w-sm bg-white/95 backdrop-blur-2xl border border-indigo-100/50 shadow-[0_20px_50px_rgba(0,0,0,0.1)] rounded-3xl p-5 z-[120] animate-fade-in-down ring-1 ring-white/50">
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-2 text-[#684CFE]">
                            <div className="bg-indigo-50 p-1.5 rounded-xl">
                                <svg className="w-4 h-4 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.334 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
                                </svg>
                            </div>
                            <span className="font-black text-[11px] tracking-widest uppercase">Smart Rewind</span>
                        </div>
                        <button onClick={() => setRewindSummary(null)} className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                    <div className="space-y-4 text-slate-700">
                        <div className="text-sm leading-relaxed whitespace-pre-wrap">
                            {rewindSummary.split('\n').map((line, i) => {
                                if (line.startsWith('SUMMARY:')) return <div key={i} className="font-black text-slate-900 border-b border-slate-50 pb-2 mb-3 uppercase text-[10px] tracking-widest">{line}</div>;
                                if (line.startsWith('KEY POINTS:')) return <div key={i} className="font-black text-slate-900 mt-4 mb-2 uppercase text-[10px] tracking-widest">{line}</div>;
                                if (line.startsWith('ACTION ITEMS:')) return <div key={i} className="font-black text-indigo-600 mt-4 mb-2 uppercase text-[10px] tracking-widest">{line}</div>;
                                if (line.includes('•')) return <div key={i} className="pl-2 flex items-start gap-2 text-slate-600 font-semibold my-1"><span className="text-indigo-400 mt-1.5 w-1.5 h-1.5 rounded-full bg-current shrink-0" /> {line.replace('•', '').trim()}</div>;
                                return <div key={i} className={line.trim() === 'None' ? 'italic text-slate-400' : 'text-slate-600 font-medium'}>{line}</div>;
                            })}
                        </div>
                    </div>
                    <div className="mt-5 pt-4 border-t border-slate-50 flex justify-between items-center bg-slate-50/50 -mx-5 -mb-5 px-5 py-3 rounded-b-3xl">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Auto-closing 15s</span>
                    </div>
                </div>
            )}

            {/* ── LEFT GROUP: Logo | Room | Status ── */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <img src={LinzoLogo} alt="Linzo" className="h-5 sm:h-[26px] w-auto flex-shrink-0" />

                <div className="hidden md:block w-px h-5 bg-slate-100" />

                {/* Room ID */}
                <span className="hidden sm:flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Room: <span className="font-mono text-[#684CFE] font-black">{roomId}</span>
                </span>

                <div className="hidden sm:block w-px h-5 bg-slate-100" />

                {/* Connection pill */}
                <span className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-tight ring-1 transition-all ${isConnected ? 'bg-green-50 text-green-700 ring-green-100' : 'bg-red-50 text-red-700 ring-red-100'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                    {isConnected ? 'LIVE' : 'OFFLINE'}
                </span>

                {/* Status badges */}
                <div className="flex gap-1">
                    {isSignLanguageActive && (
                        <span className="px-1.5 py-0.5 rounded-md bg-indigo-50 text-[#684CFE] ring-1 ring-indigo-100 animate-pulse flex items-center gap-1">
                            <span className="w-1 h-1 bg-[#684CFE] rounded-full" />
                            <span className="text-[8px] font-black tracking-widest hidden sm:inline">SIGN-SYNC</span>
                        </span>
                    )}
                    {isBackgroundListening && (
                        <span className="px-1.5 py-0.5 rounded-md bg-orange-50 text-orange-600 ring-1 ring-orange-100 animate-pulse flex items-center gap-1">
                            <span className="w-1 h-1 bg-orange-500 rounded-full" />
                            <span className="text-[8px] font-black tracking-widest hidden sm:inline">AURAL</span>
                        </span>
                    )}
                </div>
            </div>

            {/* ── RIGHT GROUP: Controls ── */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">

                {/* Prominence toggle — Normal users only, sm+ */}
                {(userType === 'normal' || !userType) && (
                    <div className="hidden sm:flex items-center bg-slate-100/70 p-0.5 rounded-xl ring-1 ring-slate-200/50">
                        <button
                            onClick={() => setProminenceMode('grid')}
                            title="Equal Grid"
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${prominenceMode === 'grid' ? 'bg-white text-[#684CFE] shadow-sm' : 'text-slate-400 hover:text-slate-600 hover:bg-white/40'}`}
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                            </svg>
                            <span className="hidden md:inline">Grid</span>
                        </button>
                        <button
                            onClick={() => setProminenceMode('inset')}
                            title="Floating Self-View"
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${prominenceMode === 'inset' ? 'bg-white text-[#684CFE] shadow-sm' : 'text-slate-400 hover:text-slate-600 hover:bg-white/40'}`}
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            <span className="hidden md:inline">Inset</span>
                        </button>
                    </div>
                )}

                {/* Smart Rewind */}
                <button
                    onClick={handleRewind}
                    disabled={isRewinding}
                    title="Smart Rewind (Alt+R)"
                    className={`group relative flex items-center gap-1.5 px-2.5 sm:px-4 py-2 rounded-full text-[10px] font-bold text-white uppercase tracking-tight transition-all border overflow-hidden
                        ${isRewinding
                            ? 'bg-indigo-100 border-indigo-200 cursor-wait text-indigo-600'
                            : 'bg-[#684CFE] hover:bg-indigo-700 border-indigo-500 shadow-md shadow-indigo-500/20 active:scale-95'
                        }`}
                >
                    {isRewinding ? (
                        <svg className="animate-spin h-4 w-4 text-indigo-500" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                    ) : (
                        <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.334 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
                        </svg>
                    )}
                    <span className="hidden sm:inline">Smart Rewind</span>
                    {!isRewinding && (
                        <span className="absolute inset-0 bg-white/20 -translate-x-full group-hover:translate-x-full transition-transform duration-700 skew-x-12 pointer-events-none" />
                    )}
                </button>

                {/* Translation toggle */}
                <div className="flex items-center gap-1.5 bg-slate-100/70 rounded-xl px-2 py-1.5 ring-1 ring-slate-200/50">
                    <div className="hidden md:flex flex-col leading-none">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Trans</span>
                        <span className="text-[9px] font-semibold text-[#684CFE] leading-tight">{isTranslationEnabled ? 'ON' : 'OFF'}</span>
                    </div>
                    <button
                        onClick={() => setIsTranslationEnabled(!isTranslationEnabled)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#684CFE] focus:ring-offset-1 ${isTranslationEnabled ? 'bg-[#684CFE]' : 'bg-slate-300'}`}
                    >
                        <span className={`${isTranslationEnabled ? 'translate-x-5' : 'translate-x-1'} inline-block h-3 w-3 transform rounded-full bg-white transition-transform shadow`} />
                    </button>
                    {isTranslationEnabled && (
                        <div className="flex items-center gap-1">
                            <select
                                value={preferredLanguage}
                                onChange={(e) => setPreferredLanguage(e.target.value)}
                                className="text-[10px] px-1.5 py-0.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-[#684CFE] cursor-pointer max-w-[55px] sm:max-w-[75px]"
                            >
                                <option value="en-US">English</option>
                                <option value="hi-IN">Hindi</option>
                                <option value="ta-IN">Tamil</option>
                                <option value="es-ES">Spanish</option>
                                <option value="fr-FR">French</option>
                                <option value="de-DE">German</option>
                                <option value="ja-JP">Japan</option>
                            </select>
                            <button
                                onClick={() => speakText('Testing translated voice output', preferredLanguage)}
                                className="p-1 text-slate-400 hover:text-[#684CFE] transition-colors hidden sm:block"
                                title="Test voice"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                </svg>
                            </button>
                        </div>
                    )}
                </div>

                {/* Avatar */}
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#684CFE]/10 ring-1 ring-[#684CFE]/25 text-[#684CFE] flex items-center justify-center font-bold text-sm flex-shrink-0">
                    {user.name?.[0]?.toUpperCase() || 'U'}
                </div>
            </div>
        </header>
    );
};

export default RoomHeader;
