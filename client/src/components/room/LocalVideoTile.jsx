import React, { useRef, useState, useEffect } from 'react';
import GeminiLiveStream from '../GeminiLiveStream';
import VideoWithPoseDetection from '../VideoWithPoseDetection';
import { useEmotionDetection } from '../../hooks/useEmotionDetection';

/**
 * LocalVideoTile — Clean, white-themed tile for the user's own video.
 * Features: object-fit cover, name overlay (always visible), avatar fallback,
 * blue border for active speaker, ML overlays for sign language, ADHD focus support.
 */
const LocalVideoTile = React.memo(({
    userType,
    showAvatar,
    localStream,
    localVideoRef,
    isMuted,
    isVideoOff,
    isSignToVoiceActive,
    isISLTypingActive,
    roomId,
    socketRef,
    switchStream,
    hasJoinedRef,
    setDetectedISLText,
    preferredLanguageRef,
    userNameRef,
    user,
    handleSignTextDetected,
    handleSignSpeechGenerated,
    handleAlphabetLetter,
    handleAlphabetControlGesture,
    useClientAlphabetModel,
    typedPrefix,
    currentSuggestion,
    composedSentence,
    className = "",
    isPinned = false,
    onPin = () => {},
    isActive = false,
    isLarge = false,
    adhdFocusMode = false,
    adhdIsMainSpeaker = false,
    isInset = false
}) => {
    const lastSpokenTextRef = useRef('');
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef(null);

    // Close menu on outside click
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

    // --- Emotion Detection Integration ---
    const { emotion } = useEmotionDetection(localVideoRef);
    // -------------------------------------

    // ADHD Focus Mode classes — use outline (pure CSS, no box-shadow repaint) for the ring
    const adhdActiveClass = adhdFocusMode && adhdIsMainSpeaker
        ? 'outline outline-2 outline-amber-400 outline-offset-[-2px] adhd-main-speaker'
        : '';
    const adhdDimClass = adhdFocusMode && !adhdIsMainSpeaker
        ? 'adhd-unfocused-tile'
        : '';

    return (
        <div className={`video-tile w-full h-full relative group 
            ${adhdActiveClass} ${adhdDimClass}
            ${className}`}>

            {/* Permanently mounted highlight ring — border-color only, no shadow, no animation */}
            <div 
                className={`absolute inset-0 pointer-events-none z-50 rounded-[inherit]
                    ${adhdFocusMode ? 'hidden' : ''}
                    ${isInset 
                        ? 'border-2 border-white/10' 
                        : isActive 
                            ? 'border-2 border-[#684CFE]' 
                            : 'border-2 border-transparent'
                    }`}
                style={{ transform: 'translateZ(0)' }}
            ></div>

            {/* Video stream */}
            <video
                ref={(node) => {
                    if (typeof localVideoRef === 'function') {
                        localVideoRef(node);
                    } else if (localVideoRef) {
                        localVideoRef.current = node;
                    }
                    if (node && localStream) {
                        if (node.srcObject !== localStream) {
                            node.srcObject = localStream;
                            const playPromise = node.play();
                            if (playPromise && typeof playPromise.then === 'function') {
                                playPromise.catch(() => {});
                            }
                        }
                    }
                }}
                autoPlay
                muted
                playsInline
                className={`w-full h-full transform scale-x-[-1] object-cover transition-opacity duration-200 ${isVideoOff ? 'opacity-0' : 'opacity-100'}`}
            />

            {/* Avatar fallback when camera is off */}
            {isVideoOff && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-950 z-10">
                    <div className={`bg-[#684CFE] rounded-full flex items-center justify-center text-white font-black shadow-2xl transition-colors duration-500
                        ${isLarge ? 'w-24 h-24 sm:w-32 sm:h-32 text-4xl sm:text-6xl' : 'w-14 h-14 sm:w-16 sm:h-16 text-xl sm:text-2xl'}`}>
                        {user.name?.charAt(0)?.toUpperCase() || 'Y'}
                    </div>
                </div>
            )}

            {/* Name label — always visible */}
            <div className="absolute bottom-3 left-3 right-3 z-30">
                <div className="flex items-center gap-2 bg-slate-900/40 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10">
                    <span className="text-white text-[11px] sm:text-xs font-bold truncate drop-shadow-sm flex items-center gap-2">
                        {user.name || 'You'} <span className="text-[10px] opacity-70 font-medium">(You)</span>
                    </span>
                    <div className="ml-auto flex items-center gap-2">
                        <span className="bg-indigo-500/80 text-white px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider">
                            {emotion}
                        </span>
                        {isMuted && (
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

            {/* Three-dot context menu — hidden if inset */}
            {!isInset && (
                <div
                    ref={menuRef}
                    className="absolute top-3 right-3 z-40 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-1 group-hover:translate-y-0"
                >
                    {/* Three-dot trigger */}
                    <button
                        onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o); }}
                        className="w-8 h-8 flex items-center justify-center rounded-xl bg-black/40 backdrop-blur-md border border-white/20 text-white hover:bg-black/60 hover:border-white/40 transition-all duration-200 shadow-lg"
                        title="Options"
                    >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="12" cy="5" r="1.5" />
                            <circle cx="12" cy="12" r="1.5" />
                            <circle cx="12" cy="19" r="1.5" />
                        </svg>
                    </button>

                    {/* Dropdown */}
                    {menuOpen && (
                        <div className="absolute top-full right-0 mt-1.5 w-40 bg-[#1a1a2e]/90 backdrop-blur-xl border border-white/15 rounded-xl shadow-2xl overflow-hidden">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onPin('local');
                                    setMenuOpen(false);
                                }}
                                className="w-full flex items-center gap-3 px-4 py-3 text-[13px] font-medium text-white hover:bg-white/10 transition-colors duration-150 text-left"
                            >
                                {isPinned ? (
                                    <>
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
            )}

            {/* SignToVoice / ISL Typing ML overlay */}
            {(isSignToVoiceActive || isISLTypingActive) && (
                <div className="absolute inset-0 z-10">
                    {isSignToVoiceActive ? (
                        <div className="flex-1 h-full bg-white rounded-xl overflow-hidden relative shadow-inner">
                            <GeminiLiveStream
                                roomId={roomId}
                                isActive={isSignToVoiceActive}
                                socketRef={socketRef}
                                onStreamReady={(stream) => {
                                    switchStream(stream);
                                    const emitJoin = () => {
                                        if (!hasJoinedRef.current) {
                                            socketRef.current.emit('join-room', roomId);
                                            hasJoinedRef.current = true;
                                        }
                                    };
                                    if (socketRef.current?.connected) emitJoin();
                                    else socketRef.current?.once('connect', emitJoin);
                                }}
                                onTextDetected={(text) => {
                                    if (!text) return;
                                    setDetectedISLText(text);
                                    if (text === lastSpokenTextRef.current) return;
                                    lastSpokenTextRef.current = text;
                                    if (socketRef.current) {
                                        socketRef.current.emit('speech-translation', {
                                            roomId, text,
                                            sourceLang: preferredLanguageRef.current || 'en-US',
                                            from: socketRef.current.id,
                                            sender: userNameRef.current || user.name || 'Me (Signer)',
                                            emotion: emotion,
                                            type: 'sign'  // Mark as sign language so receiver always plays TTS
                                        });
                                    }
                                    setTimeout(() => setDetectedISLText(''), 3000);
                                }}
                            />
                        </div>
                    ) : (
                        <VideoWithPoseDetection
                            isActive={isISLTypingActive}
                            mode="alphabet"
                            onTextDetected={(text, gesture) => handleSignTextDetected(text, gesture, emotion)}
                            onSpeechGenerated={(text) => handleSignSpeechGenerated(text, emotion)}
                            onAlphabetLetter={handleAlphabetLetter}
                            onAlphabetControlGesture={handleAlphabetControlGesture}
                            useClientAlphabetModel={useClientAlphabetModel}
                            onStreamReady={(stream) => {
                                switchStream(stream);
                                const emitJoin = () => {
                                    if (!hasJoinedRef.current) {
                                        socketRef.current?.emit('join-room', roomId);
                                        hasJoinedRef.current = true;
                                    }
                                };
                                if (socketRef.current?.connected) emitJoin();
                                else socketRef.current?.once('connect', emitJoin);
                            }}
                        />
                    )}
                </div>
            )}

            {/* ISL Typing overlay */}
            {isISLTypingActive && (
                <div className="absolute bottom-10 left-2 right-2 z-30">
                    <div className="bg-black/70 backdrop-blur-sm text-white rounded-lg p-2 text-xs flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                            <span className="opacity-60">Word</span>
                            <span className="font-mono bg-white/10 px-2 py-0.5 rounded">{typedPrefix || '—'}</span>
                            {currentSuggestion && currentSuggestion.toLowerCase() !== typedPrefix.toLowerCase() && (
                                <>
                                    <span className="opacity-50">→</span>
                                    <span className="font-mono bg-green-500/20 px-2 py-0.5 rounded">{currentSuggestion}</span>
                                </>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="opacity-60">Sentence</span>
                            <span className="truncate">{(composedSentence + typedPrefix).trim() || '—'}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}, (prevProps, nextProps) => {
    return (
        prevProps.localStream === nextProps.localStream &&
        prevProps.isMuted === nextProps.isMuted &&
        prevProps.isVideoOff === nextProps.isVideoOff &&
        prevProps.isActive === nextProps.isActive &&
        prevProps.isPinned === nextProps.isPinned &&
        prevProps.isSignToVoiceActive === nextProps.isSignToVoiceActive &&
        prevProps.isISLTypingActive === nextProps.isISLTypingActive &&
        prevProps.adhdFocusMode === nextProps.adhdFocusMode &&
        prevProps.adhdIsMainSpeaker === nextProps.adhdIsMainSpeaker &&
        prevProps.user?.name === nextProps.user?.name &&
        prevProps.user?.avatar === nextProps.user?.avatar &&
        prevProps.typedPrefix === nextProps.typedPrefix &&
        prevProps.currentSuggestion === nextProps.currentSuggestion &&
        prevProps.composedSentence === nextProps.composedSentence &&
        prevProps.isInset === nextProps.isInset &&
        prevProps.className === nextProps.className
    );
});

export default LocalVideoTile;
