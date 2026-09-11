import React, { useState } from 'react';

/**
 * UserTypeModal
 * 
 * Renders the modal to select the user's experience type at the start of a meeting.
 *
 * @param {Object} props
 * @param {Function} props.onComplete - Function to set the user's experience type and cognitive mode: (userType, cognitiveMode) => void
 * @param {Function} props.setUserType - Legacy prop fallback (optional)
 */
const UserTypeModal = ({ onComplete, setUserType }) => {
    const [step, setStep] = useState(1);
    const [tempUserType, setTempUserType] = useState(null);

    const handleStep1Selection = (type) => {
        setTempUserType(type);
        setStep(2);
    };

    const handleStep2Selection = (mode) => {
        if (onComplete) {
            onComplete(tempUserType, mode);
        } else if (setUserType) {
            // Fallback for pages that might not have migrated to onComplete yet
            setUserType(tempUserType);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gradient-to-br from-[#684CFE]/20 via-white/80 to-blue-100/40 backdrop-blur-sm p-4 overflow-hidden">
            <div className="bg-white rounded-3xl shadow-2xl shadow-[#684CFE]/15 w-full max-w-3xl max-h-[90vh] flex flex-col p-4 md:p-8 text-center animate-in fade-in zoom-in duration-300 border border-gray-100 overflow-hidden transform -translate-y-8 md:-translate-y-12 relative">

                {/* Back Button for Step 2 */}
                {step === 2 && (
                    <button
                        onClick={() => setStep(1)}
                        className="absolute top-4 left-4 md:top-8 md:left-8 flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors font-medium text-sm"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Back
                    </button>
                )}

                <div className="overflow-y-auto px-2 py-2 md:py-4 custom-scrollbar mt-4 md:mt-0">
                    <h2 className="text-xl md:text-3xl font-bold text-gray-900 mb-1">
                        {step === 1 ? "Welcome to Samvaad AI" : "Select Your Cognitive Workspace"}
                    </h2>
                    <p className="text-gray-500 mb-4 md:mb-8 text-xs md:text-sm">
                        {step === 1 ? "Select how you'd like to participate physically" : "Choose an adaptive overlay to suit your processing needs"}
                    </p>

                    {/* Step 1: Physical Modality */}
                    {step === 1 && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-6">
                            {/* Normal / Hearing Tile */}
                            <button
                                onClick={() => handleStep1Selection('normal')}
                                className="group flex flex-col items-center p-3 md:p-6 rounded-2xl border-2 border-gray-100 bg-[#FAFAFE] hover:border-[#684CFE] hover:shadow-xl hover:shadow-[#684CFE]/15 hover:-translate-y-1 transition-all duration-300 text-center"
                            >
                                <div className="flex flex-row sm:flex-col items-center w-full">
                                    <div className="w-12 h-12 sm:w-24 sm:h-24 flex-shrink-0 mb-0 sm:mb-4 rounded-xl sm:rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-50 group-hover:from-[#684CFE]/10 group-hover:to-blue-100 flex items-center justify-center transition-colors">
                                        <svg className="w-8 h-8 sm:w-16 sm:h-16" viewBox="0 0 120 120" fill="none">
                                            <circle cx="60" cy="38" r="16" fill="#684CFE" opacity="0.15" />
                                            <circle cx="60" cy="38" r="14" fill="#684CFE" opacity="0.25" />
                                            <path d="M36 85c0-13.255 10.745-24 24-24s24 10.745 24 24v10H36V85z" fill="#684CFE" opacity="0.15" />
                                            <path d="M40 85c0-11.046 8.954-20 20-20s20 8.954 20 20v6H40V85z" fill="#684CFE" opacity="0.3" />
                                            <path d="M35 55a25 25 0 0150 0" stroke="#684CFE" strokeWidth="3" fill="none" strokeLinecap="round" />
                                            <rect x="30" y="52" width="8" height="14" rx="4" fill="#684CFE" />
                                            <rect x="82" y="52" width="8" height="14" rx="4" fill="#684CFE" />
                                        </svg>
                                    </div>
                                    <div className="ml-4 sm:ml-0 text-left sm:text-center flex-1">
                                        <div className="font-bold text-gray-900 group-hover:text-[#684CFE] transition-colors text-sm sm:text-base">Normal / Hearing</div>
                                        <div className="text-[10px] sm:text-xs text-gray-400 mt-0.5">Standard meeting experience</div>
                                    </div>
                                </div>
                            </button>

                            {/* Deaf / Hard of Hearing Tile */}
                            <button
                                onClick={() => handleStep1Selection('deaf')}
                                className="group flex flex-col items-center p-3 md:p-6 rounded-2xl border-2 border-gray-100 bg-[#FAFAFE] hover:border-emerald-500 hover:shadow-xl hover:shadow-emerald-500/15 hover:-translate-y-1 transition-all duration-300 text-center"
                            >
                                <div className="flex flex-row sm:flex-col items-center w-full">
                                    <div className="w-12 h-12 sm:w-24 sm:h-24 flex-shrink-0 mb-0 sm:mb-4 rounded-xl sm:rounded-2xl bg-gradient-to-br from-emerald-50 to-green-50 group-hover:from-emerald-100 group-hover:to-green-100 flex items-center justify-center transition-colors">
                                        <svg className="w-8 h-8 sm:w-16 sm:h-16" viewBox="0 0 120 120" fill="none">
                                            <circle cx="55" cy="38" r="16" fill="#10B981" opacity="0.15" />
                                            <circle cx="55" cy="38" r="14" fill="#10B981" opacity="0.25" />
                                            <path d="M31 85c0-13.255 10.745-24 24-24s24 10.745 24 24v10H31V85z" fill="#10B981" opacity="0.15" />
                                            <path d="M35 85c0-11.046 8.954-20 20-20s20 8.954 20 20v6H35V85z" fill="#10B981" opacity="0.3" />
                                            <path d="M78 30c3 0 7 3 7 8s-2 7-4 9l-3 3" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                                            <circle cx="78" cy="42" r="4" fill="#10B981" opacity="0.3" />
                                            <line x1="72" y1="28" x2="88" y2="52" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" />
                                        </svg>
                                    </div>
                                    <div className="ml-4 sm:ml-0 text-left sm:text-center flex-1">
                                        <div className="font-bold text-gray-900 group-hover:text-emerald-600 transition-colors text-sm sm:text-base">Deaf / Hard of Hearing</div>
                                        <div className="text-[10px] sm:text-xs text-gray-400 mt-0.5">Sign language & captions prioritized</div>
                                    </div>
                                </div>
                            </button>

                            {/* Mute / Non-Verbal Tile */}
                            <button
                                onClick={() => handleStep1Selection('mute')}
                                className="group flex flex-col items-center p-3 md:p-6 rounded-2xl border-2 border-gray-100 bg-[#FAFAFE] hover:border-purple-500 hover:shadow-xl hover:shadow-purple-500/15 hover:-translate-y-1 transition-all duration-300 text-center"
                            >
                                <div className="flex flex-row sm:flex-col items-center w-full">
                                    <div className="w-12 h-12 sm:w-24 sm:h-24 flex-shrink-0 mb-0 sm:mb-4 rounded-xl sm:rounded-2xl bg-gradient-to-br from-purple-50 to-fuchsia-50 group-hover:from-purple-100 group-hover:to-fuchsia-100 flex items-center justify-center transition-colors">
                                        <svg className="w-8 h-8 sm:w-16 sm:h-16" viewBox="0 0 120 120" fill="none">
                                            <circle cx="55" cy="38" r="16" fill="#8B5CF6" opacity="0.15" />
                                            <circle cx="55" cy="38" r="14" fill="#8B5CF6" opacity="0.25" />
                                            <path d="M31 85c0-13.255 10.745-24 24-24s24 10.745 24 24v10H31V85z" fill="#8B5CF6" opacity="0.15" />
                                            <path d="M35 85c0-11.046 8.954-20 20-20s20 8.954 20 20v6H35V85z" fill="#8B5CF6" opacity="0.3" />
                                            <g transform="translate(72, 28)">
                                                <path d="M12 2v20M8 6v14M16 4v18M20 10v10M4 10v8" stroke="#8B5CF6" strokeWidth="3" strokeLinecap="round" />
                                                <path d="M2 18c0 8 6 14 14 14h4c4 0 8-2 8-6" stroke="#8B5CF6" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                                            </g>
                                        </svg>
                                    </div>
                                    <div className="ml-4 sm:ml-0 text-left sm:text-center flex-1">
                                        <div className="font-bold text-gray-900 group-hover:text-purple-600 transition-colors text-sm sm:text-base">Mute / Non-Verbal</div>
                                        <div className="text-[10px] sm:text-xs text-gray-400 mt-0.5">Sign-to-voice & typing prioritized</div>
                                    </div>
                                </div>
                            </button>
                        </div>
                    )}

                    {/* Step 2: Cognitive Adaptive Mode */}
                    {step === 2 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                            {/* Standard */}
                            <button
                                onClick={() => handleStep2Selection('standard')}
                                className="group p-3 sm:p-4 rounded-2xl border-2 border-gray-100 bg-[#FAFAFE] hover:border-gray-400 hover:shadow-xl hover:shadow-gray-400/15 hover:-translate-y-1 transition-all duration-300 text-center"
                            >
                                <div className="flex flex-row sm:flex-col items-center w-full">
                                    <div className="w-12 h-12 sm:w-16 sm:h-16 flex-shrink-0 mb-0 sm:mb-3 rounded-xl sm:rounded-2xl bg-gradient-to-br from-gray-50 to-slate-50 group-hover:from-gray-100 group-hover:to-slate-100 flex items-center justify-center text-2xl sm:text-3xl shadow-inner transition-colors">
                                        ⚙️
                                    </div>
                                    <div className="ml-4 sm:ml-0 text-left sm:text-center flex-1">
                                        <div className="font-bold text-gray-900 group-hover:text-gray-600 text-sm mb-1 transition-colors">Standard Mode</div>
                                        <div className="text-[10.5px] text-gray-500 leading-tight">Default meeting view with no cognitive overlays.</div>
                                    </div>
                                </div>
                            </button>

                            {/* Focus Mode */}
                            <button
                                onClick={() => handleStep2Selection('focus')}
                                className="group p-3 sm:p-4 rounded-2xl border-2 border-gray-100 bg-[#FAFAFE] hover:border-amber-400 hover:shadow-xl hover:shadow-amber-400/15 hover:-translate-y-1 transition-all duration-300 text-center"
                            >
                                <div className="flex flex-row sm:flex-col items-center w-full">
                                    <div className="w-12 h-12 sm:w-16 sm:h-16 flex-shrink-0 mb-0 sm:mb-3 rounded-xl sm:rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 group-hover:from-amber-100 group-hover:to-orange-100 flex items-center justify-center text-2xl sm:text-3xl shadow-inner transition-colors">
                                        🌟
                                    </div>
                                    <div className="ml-4 sm:ml-0 text-left sm:text-center flex-1">
                                        <div className="font-bold text-gray-900 group-hover:text-amber-600 text-sm mb-1 transition-colors">AI Focus Mode</div>
                                        <div className="text-[10.5px] text-gray-500 leading-tight">Hides visual clutter, shows live bullet summaries & key points. (ADHD)</div>
                                    </div>
                                </div>
                            </button>

                            {/* Social Assist */}
                            <button
                                onClick={() => handleStep2Selection('social')}
                                className="group p-3 sm:p-4 rounded-2xl border-2 border-gray-100 bg-[#FAFAFE] hover:border-rose-400 hover:shadow-xl hover:shadow-rose-400/15 hover:-translate-y-1 transition-all duration-300 text-center"
                            >
                                <div className="flex flex-row sm:flex-col items-center w-full">
                                    <div className="w-12 h-12 sm:w-16 sm:h-16 flex-shrink-0 mb-0 sm:mb-3 rounded-xl sm:rounded-2xl bg-gradient-to-br from-rose-50 to-pink-50 group-hover:from-rose-100 group-hover:to-pink-100 flex items-center justify-center text-2xl sm:text-3xl shadow-inner transition-colors">
                                        👁️
                                    </div>
                                    <div className="ml-4 sm:ml-0 text-left sm:text-center flex-1">
                                        <div className="font-bold text-gray-900 group-hover:text-rose-500 text-sm mb-1 transition-colors">Social Assist</div>
                                        <div className="text-[10.5px] text-gray-500 leading-tight">Shows real-time emotion and conversational tone tags. (Autism)</div>
                                    </div>
                                </div>
                            </button>

                            {/* Reading Assist */}
                            <button
                                onClick={() => handleStep2Selection('reading')}
                                className="group p-3 sm:p-4 rounded-2xl border-2 border-gray-100 bg-[#FAFAFE] hover:border-cyan-400 hover:shadow-xl hover:shadow-cyan-400/15 hover:-translate-y-1 transition-all duration-300 text-center"
                            >
                                <div className="flex flex-row sm:flex-col items-center w-full">
                                    <div className="w-12 h-12 sm:w-16 sm:h-16 flex-shrink-0 mb-0 sm:mb-3 rounded-xl sm:rounded-2xl bg-gradient-to-br from-cyan-50 to-sky-50 group-hover:from-cyan-100 group-hover:to-sky-100 flex items-center justify-center text-2xl sm:text-3xl shadow-inner transition-colors">
                                        📖
                                    </div>
                                    <div className="ml-4 sm:ml-0 text-left sm:text-center flex-1">
                                        <div className="font-bold text-gray-900 group-hover:text-cyan-600 text-sm mb-1 transition-colors">Reading Assist</div>
                                        <div className="text-[10.5px] text-gray-500 leading-tight">Applies readable fonts, large spacing, and simplified layouts. (Dyslexia)</div>
                                    </div>
                                </div>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UserTypeModal;

