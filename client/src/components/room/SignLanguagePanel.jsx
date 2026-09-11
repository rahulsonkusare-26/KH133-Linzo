import React from 'react';
import SignLanguageAvatar from '../SignLanguageAvatar';

/**
 * SignLanguagePanel - Displays the AI Interpreter avatar and its animation controls.
 */
const SignLanguagePanel = ({
    userType,
    showAvatar,
    setShowAvatar,
    isSignLanguageActive,
    isBackgroundListening,
    isSignToVoiceActive,
    avatarType,
    setAvatarType,
    animationSpeed,
    setAnimationSpeed,
    pauseTime,
    setPauseTime,
    currentText,
    handleAnimationComplete
}) => {
    if (userType === 'normal') return null;

    return (
        <div className={`transition-all duration-500 ease-in-out ${showAvatar ? 'w-full h-full bg-white rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.05)] ring-1 ring-slate-100 overflow-hidden relative' : ''}`}>
            {/* See in Signs Toggle Button */}
            <div className="absolute z-20 top-4 left-4">
                <button
                    onClick={() => setShowAvatar(!showAvatar)}
                    className={`px-5 py-2.5 rounded-full text-sm font-bold shadow-sm transition-all flex items-center gap-2 transform hover:scale-105 active:scale-95 ${showAvatar ? 'bg-[#684CFE] text-white hover:bg-indigo-700' : 'bg-white text-[#684CFE] ring-1 ring-indigo-100 hover:bg-indigo-50'}`}
                >
                    {showAvatar ? '🤟 Hide Sign Avatar' : '🤟 See in Signs'}
                </button>
            </div>

            {showAvatar && (
                <>
                    <div className="absolute z-10 bottom-4 right-4 bg-white/70 backdrop-blur-2xl border border-white/40 text-slate-800 px-3 py-1.5 rounded-xl text-[11px] font-black flex items-center gap-2 shadow-xl shadow-slate-200/20 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <div className="flex items-center gap-1.5 uppercase tracking-wider">
                            <span className="text-base">🤖</span>
                            <span>AI Interpreter</span>
                        </div>
                        {isSignLanguageActive && (
                            <div className="flex items-center gap-1.5 bg-emerald-500 text-white px-2 py-0.5 rounded-lg shadow-sm shadow-emerald-500/20">
                                <div className="w-1 h-1 bg-white rounded-full animate-pulse"></div>
                                <span className="text-[9px] font-black tracking-tighter">LIVE</span>
                            </div>
                        )}
                        {isBackgroundListening && (
                            <div className="flex items-center justify-center w-6 h-6 bg-orange-500/10 text-orange-600 rounded-lg ring-1 ring-orange-500/20">
                                <span className="text-[10px] animate-bounce">🎤</span>
                            </div>
                        )}
                        {isSignToVoiceActive && (
                            <div className="flex items-center justify-center w-6 h-6 bg-indigo-500/10 text-indigo-600 rounded-lg ring-1 ring-indigo-500/20">
                                <span className="text-[10px] animate-pulse">🤟</span>
                            </div>
                        )}
                    </div>
                    {/* Hidden Avatar Controls - can be enabled if needed */}
                    {false && (
                        <div className="absolute z-10 top-3 right-3 flex flex-col gap-2">
                            <div className="flex gap-2">
                                <button onClick={() => setAvatarType('xbot')} className={`px-3 py-1 rounded text-xs font-bold ring-1 ${avatarType === 'xbot' ? 'bg-blue-600 text-white ring-blue-600' : 'bg-white text-gray-700 ring-gray-200 hover:bg-gray-50'}`}>XBOT</button>
                                <button onClick={() => setAvatarType('ybot')} className={`px-3 py-1 rounded text-xs font-bold ring-1 ${avatarType === 'ybot' ? 'bg-blue-600 text-white ring-blue-600' : 'bg-white text-gray-700 ring-gray-200 hover:bg-gray-50'}`}>YBOT</button>
                                <button onClick={() => setAvatarType('humanoid')} className={`px-3 py-1 rounded text-xs font-bold ring-1 ${avatarType === 'humanoid' ? 'bg-blue-600 text-white ring-blue-600' : 'bg-white text-gray-700 ring-gray-200 hover:bg-gray-50'}`}>HUMANOID</button>
                            </div>

                            <div className="bg-white rounded-lg p-2 shadow-lg border border-gray-200">
                                <div className="text-xs font-medium text-gray-700 mb-1">Speed: {Math.round(animationSpeed * 100) / 100}</div>
                                <input
                                    type="range"
                                    min="0.05"
                                    max="0.50"
                                    step="0.01"
                                    value={animationSpeed}
                                    onChange={(e) => setAnimationSpeed(parseFloat(e.target.value))}
                                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                                />
                            </div>

                            <div className="bg-white rounded-lg p-2 shadow-lg border border-gray-200">
                                <div className="text-xs font-medium text-gray-700 mb-1">Pause: {pauseTime}ms</div>
                                <input
                                    type="range"
                                    min="0"
                                    max="2000"
                                    step="100"
                                    value={pauseTime}
                                    onChange={(e) => setPauseTime(parseInt(e.target.value))}
                                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                                />
                            </div>
                        </div>
                    )}
                    <SignLanguageAvatar
                        text={currentText}
                        isActive={isSignLanguageActive}
                        avatarType={avatarType}
                        animationSpeed={animationSpeed}
                        pauseTime={pauseTime}
                        onAnimationComplete={handleAnimationComplete}
                    />
                </>
            )}
        </div>
    );
};

export default SignLanguagePanel;
