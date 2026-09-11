import React, { useState, useRef, useEffect } from 'react';

/**
 * RemoteVideoTile — Clean, white-themed video tile for remote participants.
 * Features: object-fit cover, name overlay (always visible), avatar fallback,
 * blue border for active speaker, ADHD focus mode support.
 */
const RemoteVideoTile = React.memo(({
    participant,
    index,
    userType,
    showAvatar,
    setParticipantVideoRef,
    className = "",
    isPinned = false,
    onPin = () => {},
    isActive = false,
    isLarge = false,
    adhdFocusMode = false,
    adhdIsMainSpeaker = false
}) => {
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef(null);

    // Close menu when clicking outside
    useEffect(() => {
        if (!menuOpen) return;
        const handleClick = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [menuOpen]);
    // ADHD Focus Mode classes — use outline (pure CSS, no box-shadow repaint) for the ring
    const adhdActiveClass = adhdFocusMode && adhdIsMainSpeaker
        ? 'outline outline-2 outline-amber-400 outline-offset-[-2px] adhd-main-speaker'
        : '';
    const adhdDimClass = adhdFocusMode && !adhdIsMainSpeaker
        ? 'adhd-unfocused-tile'
        : '';

    return (
        <div
            className={`video-tile w-full h-full relative group shadow-[0_8px_30px_rgb(0,0,0,0.04)] 
                ${adhdActiveClass} ${adhdDimClass}
                ${className}`}
            onClick={() => setMenuOpen(false)}
        >
            {/* Permanently mounted highlight ring — border-color only, no shadow, no animation */}
            <div 
                className={`absolute inset-0 pointer-events-none z-50 rounded-[inherit]
                    ${adhdFocusMode ? 'hidden' : ''}
                    ${isActive 
                        ? 'border-2 border-[#684CFE]' 
                        : isPinned 
                            ? 'border-2 border-[#684CFE]/30' 
                            : 'border-2 border-transparent'
                    }`}
                style={{ transform: 'translateZ(0)' }}
            ></div>

            {/* Video element */}
            <video
                key={participant.stream?.id || 'no-stream'}
                ref={(el) => setParticipantVideoRef(participant.id, el)}
                autoPlay
                playsInline
                className={`w-full h-full object-cover transition-opacity duration-200 ${participant.isCamOn === false ? 'opacity-0' : 'opacity-100'}`}
            />

            {/* Avatar fallback when camera is off */}
            {participant.isCamOn === false && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-950 z-10">
                    <div className={`bg-[#684CFE] rounded-full flex items-center justify-center text-white font-black shadow-2xl transition-colors duration-500
                        ${isLarge ? 'w-24 h-24 sm:w-32 sm:h-32 text-4xl sm:text-6xl' : 'w-14 h-14 sm:w-16 sm:h-16 text-xl sm:text-2xl'}`}>
                        {participant.name?.charAt(0)?.toUpperCase() || `P`}
                    </div>
                </div>
            )}

            {/* Name label — always visible */}
            <div className="absolute bottom-3 left-3 right-3 z-30">
                <div className="flex items-center gap-2 bg-slate-900/40 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10">
                    <span className="text-white text-[11px] sm:text-xs font-bold truncate drop-shadow-sm flex items-center gap-2">
                        {participant.name || `Participant ${index + 1}`}
                    </span>
                    <div className="ml-auto flex items-center gap-1.5">
                        {isPinned && <span className="text-indigo-400 text-[10px] drop-shadow-sm">📌</span>}
                        {participant.isMicOn === false && (
                            <div className="bg-red-500/80 p-1 rounded-lg">
                                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
                                </svg>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Three-dot context menu — on hover */}
            <div
                ref={menuRef}
                className="absolute top-3 right-3 z-40 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-1 group-hover:translate-y-0"
            >
                {/* Three-dot trigger button */}
                <button
                    onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o); }}
                    className="w-8 h-8 flex items-center justify-center rounded-xl bg-black/40 backdrop-blur-md border border-white/20 text-white hover:bg-black/60 hover:border-white/40 transition-all duration-200 shadow-lg"
                    title="Options"
                >
                    {/* Vertical three dots */}
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="5" r="1.5" />
                        <circle cx="12" cy="12" r="1.5" />
                        <circle cx="12" cy="19" r="1.5" />
                    </svg>
                </button>

                {/* Dropdown menu */}
                {menuOpen && (
                    <div className="absolute top-full right-0 mt-1.5 w-40 bg-[#1a1a2e]/90 backdrop-blur-xl border border-white/15 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onPin(participant.id);
                                setMenuOpen(false);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 text-[13px] font-medium text-white hover:bg-white/10 transition-colors duration-150 text-left"
                        >
                            {isPinned ? (
                                <>
                                    {/* Unpin icon */}
                                    <svg className="w-4 h-4 text-indigo-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="2" y1="2" x2="22" y2="22" />
                                        <path d="M12 17v5" />
                                        <path d="M9 17h6" />
                                        <path d="M15 4.5l1.5 1.5L14 9l2 2-5.5 5.5" />
                                    </svg>
                                    <span>Unpin Tile</span>
                                </>
                            ) : (
                                <>
                                    {/* Pin icon — matches 100ms Outline/Pin */}
                                    <svg className="w-4 h-4 text-indigo-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M12 17v5" />
                                        <path d="M9 17h6" />
                                        <path d="M15.5 4.5l-7 7L5 14l5-0.5 6.5-6.5-1-2.5z" />
                                        <path d="M15.5 4.5l4 4" />
                                    </svg>
                                    <span>Pin Tile</span>
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}, (prevProps, nextProps) => {
    return (
        prevProps.participant.id === nextProps.participant.id &&
        prevProps.participant.stream === nextProps.participant.stream &&
        prevProps.participant.isMicOn === nextProps.participant.isMicOn &&
        prevProps.participant.isCamOn === nextProps.participant.isCamOn &&
        prevProps.userType === nextProps.userType &&
        prevProps.showAvatar === nextProps.showAvatar &&
        prevProps.index === nextProps.index &&
        prevProps.adhdFocusMode === nextProps.adhdFocusMode &&
        prevProps.adhdIsMainSpeaker === nextProps.adhdIsMainSpeaker &&
        prevProps.isActive === nextProps.isActive &&
        prevProps.isPinned === nextProps.isPinned
    );
});

export default RemoteVideoTile;
