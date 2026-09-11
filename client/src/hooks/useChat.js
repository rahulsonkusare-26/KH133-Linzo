import { useState, useCallback } from 'react';

/**
 * useChat — Manages chat messages, input, and panel state.
 * 
 * @param {React.MutableRefObject} socketRef - Socket.IO ref for emitting chat events
 * @param {string} roomId - Current room ID
 * @returns Chat state and handlers
 */
export function useChat(socketRef, roomId) {
    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [showChat, setShowChat] = useState(false);
    const [drawerTab, setDrawerTab] = useState('chat');

    // Send a chat message
    const sendChatMessage = useCallback(() => {
        if (chatInput.trim()) {
            const message = {
                id: Date.now(),
                text: chatInput.trim(),
                sender: 'You',
                timestamp: new Date().toLocaleTimeString()
            };
            setChatMessages(prev => [...prev, message]);
            setChatInput('');

            // Emit chat message to other participants
            if (socketRef.current) {
                socketRef.current.emit('chat-message', {
                    roomId,
                    message: message.text,
                    sender: 'You'
                });
            }
        }
    }, [chatInput, socketRef, roomId]);

    // Handle incoming chat message from socket
    const handleChatMessage = useCallback((data) => {
        const message = data.message ? {
            id: Date.now(),
            text: data.message,
            sender: data.sender || 'Unknown',
            timestamp: new Date().toLocaleTimeString()
        } : {
            id: Date.now(),
            text: data.text || data,
            sender: data.sender || 'Unknown',
            timestamp: new Date().toLocaleTimeString()
        };

        setChatMessages(prev => [...prev, message]);
    }, []);

    // Helper to add system messages from other parts of the app
    const addSystemMessage = useCallback((text) => {
        const message = {
            id: Date.now(),
            text,
            sender: 'System',
            timestamp: new Date().toLocaleTimeString()
        };
        setChatMessages(prev => [...prev, message]);
    }, []);

    return {
        chatMessages,
        setChatMessages,
        chatInput,
        setChatInput,
        showChat,
        setShowChat,
        drawerTab,
        setDrawerTab,
        sendChatMessage,
        handleChatMessage,
        addSystemMessage
    };
}
