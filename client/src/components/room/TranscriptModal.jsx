import React from 'react';

/**
 * TranscriptModal - Renders the live transcript interface in a modal popup.
 */
const TranscriptModal = ({
    showTranscripts,
    setShowTranscripts,
    isSpeechActive,
    captions,
    userNameRef,
    user
}) => {
    if (!showTranscripts) return null;

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2 text-indigo-600">
                        <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                        </svg>
                        Live Transcript
                    </h2>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-gray-100 rounded-full">
                            <span className={`w-2 h-2 rounded-full ${isSpeechActive ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`}></span>
                            <span className="text-xs text-gray-600 font-medium">{isSpeechActive ? 'Listening' : 'Paused'}</span>
                        </div>
                        <button
                            onClick={() => setShowTranscripts(false)}
                            className="rounded-full p-2 hover:bg-gray-100 transition-colors"
                        >
                            <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/50">
                    {captions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400 opacity-70">
                            <svg className="w-12 h-12 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                            </svg>
                            <p className="text-sm font-medium">Start speaking to see live captions...</p>
                        </div>
                    ) : (
                        captions.map(c => {
                            const isMe = c.speaker === 'You' || c.speaker === (userNameRef.current || user.name);
                            return (
                                <div key={c.id} className={`flex w-full ${isMe ? 'justify-start' : 'justify-end'}`}>
                                    <div className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ${isMe
                                        ? 'bg-indigo-600 text-white rounded-tl-sm'
                                        : 'bg-white border border-gray-200 text-gray-800 rounded-tr-sm'
                                        }`}>
                                        <div className={`text-xs font-bold uppercase tracking-wider mb-1 ${isMe ? 'text-indigo-200' : 'text-indigo-600'}`}>
                                            {c.speaker}
                                        </div>
                                        <p className="text-sm leading-relaxed">{c.text}</p>
                                        <div className={`text-[10px] mt-1.5 text-right ${isMe ? 'text-indigo-200/80' : 'text-gray-400'}`}>
                                            {c.timestamp}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
};

export default TranscriptModal;
