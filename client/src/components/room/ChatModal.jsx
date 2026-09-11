import React from 'react';

/**
 * ChatModal - Renders the chat interface in a modal popup.
 */
const ChatModal = ({
    showChat,
    setShowChat,
    chatMessages,
    chatInput,
    setChatInput,
    sendChatMessage,
    user
}) => {
    if (!showChat) return null;

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                    <h2 className="text-xl font-bold text-gray-900">💬 Chat</h2>
                    <button
                        onClick={() => setShowChat(false)}
                        className="rounded-full p-2 hover:bg-gray-100"
                    >
                        <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="mb-4">
                        <h3 className="text-lg font-semibold text-gray-800 mb-3">💬 Chat Messages</h3>

                        {/* Audio Test Button */}
                        <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-100 flex items-center justify-between">
                            <span className="text-sm text-blue-700">🔊 Enable/Test Audio</span>
                            <button
                                onClick={() => {
                                    if ('speechSynthesis' in window) {
                                        window.speechSynthesis.cancel();
                                        const utterance = new SpeechSynthesisUtterance("Audio enabled");
                                        utterance.volume = 1.0;
                                        window.speechSynthesis.speak(utterance);
                                        console.log('🔊 Test audio triggered');
                                    }
                                }}
                                className="px-3 py-1 bg-blue-600 text-white text-xs rounded-full hover:bg-blue-700 transition-colors"
                            >
                                Test Sound
                            </button>
                        </div>

                        <div className="space-y-3 max-h-60 overflow-y-auto">
                            {chatMessages.length === 0 ? (
                                <div className="text-center text-gray-500 text-sm py-8">
                                    No messages yet. Start the conversation!
                                </div>
                            ) : (
                                chatMessages.map(message => (
                                    <div key={message.id} className={`rounded-lg px-4 py-2 ${message.sender === 'System'
                                        ? 'bg-blue-50 border border-blue-200'
                                        : 'bg-gray-100'
                                        }`}>
                                        <div className="flex justify-between items-center mb-1">
                                            <span className={`font-semibold ${message.sender === 'System' ? 'text-blue-700' : 'text-blue-700'
                                                }`}>
                                                {message.sender}
                                            </span>
                                            <span className="text-xs text-gray-400">{message.timestamp}</span>
                                        </div>
                                        <div className="text-sm text-gray-700">{message.text}</div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                            placeholder="Type your message..."
                            className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                        />
                        <button
                            onClick={sendChatMessage}
                            disabled={!chatInput.trim()}
                            className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Send
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ChatModal;
