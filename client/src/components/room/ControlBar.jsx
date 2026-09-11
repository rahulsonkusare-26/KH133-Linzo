import React, { useState } from 'react';

/**
 * ControlBar — Google Meet-style 3-zone bottom bar.
 * Desktop: [Left utility] [Center core AV] [Right utility] [Leave]
 * Mobile:  [Core AV] [⋯ More] [Leave]  → bottom-sheet tray for all utility actions
 *
 * ZERO actions removed. Lower-priority actions are moved to overflow tray on mobile.
 */
const ControlBar = ({
    toggleMute, isMuted,
    toggleVideo, isVideoOff,
    toggleBackgroundListening, isBackgroundListening,
    toggleSignToVoice, isSignToVoiceActive,
    detectedISLText,
    toggleISLTyping, isISLTypingActive,
    setShowChat,
    isCallWidgetOpen, setIsCallWidgetOpen,
    isSummaryEnabled, setIsSummaryEnabled,
    setShowTranscripts,
    socketRef, roomId,
    isSpeechActive,
    endCallWithSummary,
    leaveRoom,
    layoutMode, setLayoutMode,
}) => {
    const [showTray, setShowTray] = useState(false);

    /* ── Reusable icon-button components ── */
    const IconBtn = ({ onClick, active, danger, title, children, className = '' }) => (
        <button
            onClick={onClick}
            title={title}
            className={`
                group relative rounded-xl p-2.5 transition-all duration-200 active:scale-90 shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#684CFE]/50
                ${danger
                    ? (active ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/25 hover:bg-rose-600' : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-rose-100/60')
                    : (active ? 'bg-[#684CFE] text-white shadow-md shadow-[#684CFE]/30' : 'bg-slate-50 text-slate-600 hover:bg-white hover:text-[#684CFE] border border-indigo-100 hover:border-[#684CFE]/30')
                }
                ${className}
            `}
        >
            {children}
        </button>
    );

    /* ── Chip button (labelled) for AI features ── */
    const ChipBtn = ({ onClick, active, color = 'indigo', title, label, icon, pulse = false }) => {
        const colors = {
            indigo: active ? 'bg-indigo-600 text-white shadow-indigo-600/20' : 'bg-slate-50 text-slate-700 hover:bg-white hover:text-indigo-700 border border-indigo-100 hover:border-indigo-200',
            purple: active ? 'bg-purple-600 text-white shadow-purple-600/20' : 'bg-slate-50 text-slate-700 hover:bg-white hover:text-purple-700 border border-purple-100 hover:border-purple-200',
        };
        return (
            <button
                onClick={onClick}
                title={title}
                className={`group flex items-center gap-1.5 h-10 px-3 rounded-xl transition-all duration-200 active:scale-95 shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#684CFE]/50 ${colors[color]} ${active ? 'shadow-md' : ''}`}
            >
                <span className={pulse && active ? 'animate-pulse' : ''}>{icon}</span>
                <span className="hidden lg:inline text-[10px] font-black uppercase tracking-wider whitespace-nowrap">{label}</span>
            </button>
        );
    };

    /* ── SVG Icons ── */
    const MicIcon = ({ off }) => (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            {off && <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />}
        </svg>
    );
    const CamIcon = ({ off }) => (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            {off && <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />}
        </svg>
    );
    const HandIcon = () => (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1" />
        </svg>
    );
    const SpeakerIcon = () => (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
        </svg>
    );
    const ArrowIcon = () => (
        <svg className="w-3 h-3 opacity-30" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5-5 5" />
        </svg>
    );

    return (
        <>
            {/* ══════════════════════════════════════════════════════
                MAIN CONTROL BAR
            ══════════════════════════════════════════════════════ */}
            <div className="w-full shrink-0 bg-white/97 backdrop-blur-xl border-t border-slate-100 z-[100]">
                <div className="flex items-center justify-between px-3 sm:px-6 py-2 gap-2 sm:gap-3 max-w-[1400px] mx-auto">

                    {/* ── LEFT UTILITY — hidden on mobile, shown sm+ ── */}
                    <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
                        {/* Invite */}
                        <IconBtn
                            title="Copy Invite Link"
                            onClick={() => { const url = window.location.href; navigator.clipboard.writeText(url); }}
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                            </svg>
                        </IconBtn>
                        {/* ISL Finger Spelling */}
                        <IconBtn
                            title="Finger Spelling (ISL Typing)"
                            active={isISLTypingActive}
                            onClick={toggleISLTyping}
                        >
                            <HandIcon />
                        </IconBtn>
                    </div>

                    {/* ── CENTER CORE AV — always visible ── */}
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-1 justify-center">
                        {/* Mic */}
                        <IconBtn title={isMuted ? 'Unmute' : 'Mute'} active={isMuted} danger onClick={toggleMute}>
                            <MicIcon off={isMuted} />
                        </IconBtn>

                        {/* Camera */}
                        <IconBtn title={isVideoOff ? 'Start Video' : 'Stop Video'} active={isVideoOff} danger onClick={toggleVideo}>
                            <CamIcon off={isVideoOff} />
                        </IconBtn>

                        <div className="w-px h-7 bg-slate-100 mx-0.5 flex-shrink-0" />

                        {/* Voice → Sign */}
                        <ChipBtn
                            onClick={toggleBackgroundListening}
                            active={isBackgroundListening}
                            color="indigo"
                            title="Voice → Sign Language"
                            label="Voice→Sign"
                            pulse
                            icon={
                                <span className="flex items-center gap-1">
                                    <svg className={`w-4 h-4 ${isBackgroundListening ? 'animate-pulse' : ''}`} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                        <path d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                    </svg>
                                    <ArrowIcon />
                                    <HandIcon />
                                </span>
                            }
                        />

                        {/* Sign → Voice */}
                        <ChipBtn
                            onClick={toggleSignToVoice}
                            active={isSignToVoiceActive}
                            color="purple"
                            title="Sign Language → Voice"
                            label="Sign→Voice"
                            pulse
                            icon={
                                <span className="flex items-center gap-1">
                                    <HandIcon />
                                    <ArrowIcon />
                                    <SpeakerIcon />
                                </span>
                            }
                        />
                    </div>

                    {/* ── RIGHT UTILITY — hidden on mobile ── */}
                    <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
                        {/* Chat */}
                        <IconBtn title="Chat" onClick={() => setShowChat(true)}>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                            </svg>
                        </IconBtn>

                        {/* Transcript */}
                        <IconBtn
                            title="Transcript / Live Captions"
                            active={isSummaryEnabled}
                            onClick={() => { const n = !isSummaryEnabled; setIsSummaryEnabled(n); if (n) setShowTranscripts(true); }}
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </IconBtn>

                        {/* Phone Bridge */}
                        <IconBtn
                            title="Phone Bridge"
                            active={isCallWidgetOpen}
                            onClick={() => setIsCallWidgetOpen(!isCallWidgetOpen)}
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                        </IconBtn>
                    </div>

                    {/* ── MOBILE MORE BUTTON — shows bottom-sheet tray ── */}
                    <button
                        className="sm:hidden flex items-center justify-center w-10 h-10 rounded-xl bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-100 flex-shrink-0 transition-all active:scale-90"
                        onClick={() => setShowTray(true)}
                        title="More options"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="5" cy="12" r="1.5" />
                            <circle cx="12" cy="12" r="1.5" />
                            <circle cx="19" cy="12" r="1.5" />
                        </svg>
                    </button>

                    {/* ── LEAVE — premium redesign ── */}
                    <div className="flex-shrink-0 ml-1 sm:ml-4 pl-2 sm:pl-6 border-l border-slate-200/50">
                        <button
                            onClick={leaveRoom}
                            className="group relative flex items-center gap-2.5 px-4 sm:px-6 py-2.5 rounded-2xl transition-all duration-300 overflow-hidden active:scale-95"
                            title="Leave Call"
                        >
                            {/* Glass Background Layers */}
                            <div className="absolute inset-0 bg-rose-500/90 backdrop-blur-md group-hover:bg-rose-600 transition-colors"></div>
                            <div className="absolute inset-0 bg-gradient-to-tr from-rose-600/20 to-transparent"></div>
                            
                            {/* Subtle Glow Effect on Hover */}
                            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.15)_0%,_transparent_70%)]"></div>

                            <div className="relative z-10 flex items-center gap-2 text-white">
                                <svg className="w-4 h-4 sm:w-5 sm:h-5 transition-transform duration-300 group-hover:-translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                </svg>
                                <span className="hidden sm:inline text-[11px] font-black tracking-[0.1em] uppercase">Leave Call</span>
                            </div>
                            
                            {/* Interactive Ring */}
                            <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/20 group-hover:ring-white/40 transition-all"></div>
                        </button>
                    </div>
                </div>
            </div>

            {/* ══════════════════════════════════════════════════════
                MOBILE OVERFLOW BOTTOM-SHEET TRAY
                — All lower-priority actions reachable here on mobile
            ══════════════════════════════════════════════════════ */}
            {showTray && (
                <>
                    {/* Backdrop */}
                    <div className="lz-tray-backdrop" onClick={() => setShowTray(false)} />

                    {/* Sheet */}
                    <div className="lz-tray">
                        <div className="lz-tray-handle" />
                        <p className="lz-tray-title">More Actions</p>

                        <div className="lz-tray-grid">
                            {/* Invite */}
                            <button
                                className="lz-tray-item"
                                onClick={() => { navigator.clipboard.writeText(window.location.href); setShowTray(false); }}
                            >
                                <div className="lz-tray-icon">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                    </svg>
                                </div>
                                <span className="lz-tray-label">Invite</span>
                            </button>

                            {/* ISL Typing */}
                            <button
                                className={`lz-tray-item ${isISLTypingActive ? 'lz-tray-active' : ''}`}
                                onClick={() => { toggleISLTyping(); setShowTray(false); }}
                            >
                                <div className="lz-tray-icon"><HandIcon /></div>
                                <span className="lz-tray-label">Spelling</span>
                            </button>

                            {/* Chat */}
                            <button
                                className="lz-tray-item"
                                onClick={() => { setShowChat(true); setShowTray(false); }}
                            >
                                <div className="lz-tray-icon">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                                    </svg>
                                </div>
                                <span className="lz-tray-label">Chat</span>
                            </button>

                            {/* Transcript */}
                            <button
                                className={`lz-tray-item ${isSummaryEnabled ? 'lz-tray-active' : ''}`}
                                onClick={() => { const n = !isSummaryEnabled; setIsSummaryEnabled(n); if (n) setShowTranscripts(true); setShowTray(false); }}
                            >
                                <div className="lz-tray-icon">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                </div>
                                <span className="lz-tray-label">Transcript</span>
                            </button>

                            {/* Phone Bridge */}
                            <button
                                className={`lz-tray-item ${isCallWidgetOpen ? 'lz-tray-active' : ''}`}
                                onClick={() => { setIsCallWidgetOpen(!isCallWidgetOpen); setShowTray(false); }}
                            >
                                <div className="lz-tray-icon">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                    </svg>
                                </div>
                                <span className="lz-tray-label">Phone</span>
                            </button>
                        </div>
                    </div>
                </>
            )}
        </>
    );
};

export default ControlBar;
