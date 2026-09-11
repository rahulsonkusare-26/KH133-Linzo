import React from 'react';

/**
 * ParticipantsModal - Renders the list of participants in a modal popup.
 */
const ParticipantsModal = ({
    showParticipants,
    setShowParticipants,
    user,
    participants
}) => {
    if (!showParticipants) return null;

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                    <h2 className="text-xl font-bold text-gray-900">Participants</h2>
                    <button
                        onClick={() => setShowParticipants(false)}
                        className="rounded-full p-2 hover:bg-gray-100"
                    >
                        <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="space-y-3">
                        <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-3 ring-1 ring-gray-200">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold bg-blue-600">{user.name?.[0] || 'U'}</div>
                            <span className="text-sm font-medium">{user.name} (You)</span>
                        </div>
                        {participants.map((participant, index) => (
                            <div key={participant.id} className="flex items-center gap-3 bg-gray-50 rounded-lg p-3 ring-1 ring-gray-200">
                                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold bg-emerald-600">{index + 1}</div>
                                <span className="text-sm font-medium">Participant {index + 1}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ParticipantsModal;
