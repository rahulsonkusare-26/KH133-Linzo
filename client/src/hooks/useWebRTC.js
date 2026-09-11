import { useState, useRef, useCallback } from 'react';

/**
 * useWebRTC — Manages WebRTC peer connections, signaling, and participant streams.
 * 
 * @param {Object} params
 * @param {React.MutableRefObject} params.socketRef - Socket.IO ref
 * @param {string} params.roomId - Current room ID
 * @param {React.MutableRefObject} params.localStreamRef - Ref to local media stream
 * @param {boolean} params.isMuted - Current mic mute state
 * @param {boolean} params.isVideoOff - Current camera off state
 * @param {React.MutableRefObject} params.selfIdRef - Ref to own socket ID
 * @returns WebRTC state and signaling handlers
 */
export function useWebRTC({
    socketRef,
    roomId,
    localStreamRef,
    isMuted,
    isVideoOff,
    selfIdRef,
    peerConnectionsRef
}) {
    const [participants, setParticipants] = useState([]);
    const [dataChannelStatus, setDataChannelStatus] = useState('Disconnected');

    const remoteStreamsRef = useRef({});
    const pendingCandidatesRef = useRef({});
    const dataChannelsRef = useRef({});

    const handleMediaState = useCallback(({ socketId, micOn, camOn }) => {
        console.log(`📡 Media state update for ${socketId}: Mic=${micOn}, Cam=${camOn}`);
        setParticipants(prev => prev.map(p => {
            if (p.id === socketId) {
                return { ...p, isMicOn: micOn, isCamOn: camOn };
            }
            return p;
        }));
    }, []);

    const buildPeer = useCallback((peerId) => {
        // 1. Create RTCPeerConnection
        const pc = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' }
            ]
        });
        peerConnectionsRef.current[peerId] = pc;

        // 2. Add local tracks
        const stream = localStreamRef.current;
        if (stream) {
            stream.getTracks().forEach(track => {
                pc.addTrack(track, stream);
            });
        }

        // 3. Handle remote tracks
        pc.ontrack = (e) => {
            console.log(`🎥 Received remote track from ${peerId}:`, e.track.kind);
            let remote = remoteStreamsRef.current[peerId];
            if (!remote) {
                remote = new MediaStream();
                remoteStreamsRef.current[peerId] = remote;
            }
            if (e.track && !remote.getTracks().some(t => t.id === e.track.id)) {
                remote.addTrack(e.track);
            }

            const s = e.streams?.[0] || remote;
            // Update participants state with the new stream
            setParticipants(prev => {
                const exists = prev.some(p => p.id === peerId);
                if (exists) {
                    return prev.map(p => p.id === peerId ? { ...p, stream: s } : p);
                } else {
                    console.log('Detected new participant via track:', peerId);
                    return [...prev, { id: peerId, stream: s, isMicOn: true, isCamOn: true }];
                }
            });
        };

        // 4. Handle ICE candidates
        pc.onicecandidate = (ev) => {
            if (ev.candidate && socketRef.current) {
                socketRef.current.emit('ice-candidate', { candidate: ev.candidate, to: peerId });
            }
        };

        // 5. Data Channel
        pc.ondatachannel = (event) => {
            console.log('Using data channel from peer:', peerId, event.channel.label);
            const channel = event.channel;
            dataChannelsRef.current[peerId] = channel;
            channel.onopen = () => setDataChannelStatus('Connected');
            channel.onerror = (err) => console.error('Data channel error:', err);
        };

        return pc;
    }, [socketRef, roomId, localStreamRef]);

    const handleUserJoined = useCallback(async (userId) => {
        console.log('👥 User joined:', userId);

        // Broadcast my current media state to the new user
        if (socketRef.current) {
            socketRef.current.emit('media-state', {
                roomId,
                micOn: !isMuted,
                camOn: !isVideoOff
            });
        }

        // Avoid duplicates in the participants list
        setParticipants(prev => {
            if (prev.some(p => p.id === userId)) {
                console.log('⚠️ User already in participants list:', userId);
                return prev;
            }
            console.log('✅ Added new participant:', userId);
            return [...prev, { id: userId, stream: null, isMicOn: true, isCamOn: true }];
        });

        if (peerConnectionsRef.current[userId]) return;

        const peerConnection = buildPeer(userId);

        // Glare avoidance: only the client with the LOWER socket id creates the offer
        const selfId = selfIdRef.current;
        if (selfId && selfId < userId && socketRef.current) {
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            socketRef.current.emit('offer', { offer, to: userId });
        }
    }, [socketRef, roomId, isMuted, isVideoOff, buildPeer, selfIdRef]);

    const handleUserLeft = useCallback((userId) => {
        console.log('👋 User left:', userId);
        setParticipants(prev => {
            const filtered = prev.filter(p => p.id !== userId);
            console.log('📊 Participants after user left:', filtered.length);
            return filtered;
        });
        if (peerConnectionsRef.current[userId]) {
            console.log('🔌 Closing peer connection for:', userId);
            peerConnectionsRef.current[userId].close();
            delete peerConnectionsRef.current[userId];
        }
        if (remoteStreamsRef.current[userId]) {
            delete remoteStreamsRef.current[userId];
        }
        if (dataChannelsRef.current[userId]) {
            delete dataChannelsRef.current[userId];
        }
    }, []);

    const handleOffer = useCallback(async ({ offer, from }) => {
        console.log('Received offer from:', from);
        setParticipants(prev => (prev.some(p => p.id === from) ? prev : [...prev, { id: from, stream: null }]));

        let peerConnection = peerConnectionsRef.current[from];
        if (!peerConnection) {
            console.log('Creating new peer connection for answerer side');
            peerConnection = buildPeer(from);
        }

        // Create a data channel for the answerer to send data back if needed
        if (!dataChannelsRef.current[from]) {
            console.log('Creating answerer data channel for peer:', from);
            try {
                const channel = peerConnection.createDataChannel('data-' + (selfIdRef.current || 'unknown'));
                dataChannelsRef.current[from] = channel;
                channel.onopen = () => setDataChannelStatus('Connected');
            } catch (e) {
                console.error('Error creating data channel on answerer:', e);
            }
        }

        try {
            if (socketRef.current) {
                await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
                const answer = await peerConnection.createAnswer();
                await peerConnection.setLocalDescription(answer);
                socketRef.current.emit('answer', { answer, to: from });

                // Flush queued candidates
                const queued = pendingCandidatesRef.current[from] || [];
                if (queued.length > 0) {
                    console.log(`❄️ Flushing ${queued.length} queued ICE candidates for ${from}`);
                    for (const c of queued) {
                        try { await peerConnection.addIceCandidate(new RTCIceCandidate(c)); } catch (e) { console.error('Error adding queued candidate:', e); }
                    }
                    pendingCandidatesRef.current[from] = [];
                }
            }
        } catch (err) {
            console.error('Error handling offer:', err);
        }
    }, [socketRef, buildPeer, selfIdRef]);

    const handleAnswer = useCallback(async ({ answer, from }) => {
        const pc = peerConnectionsRef.current[from];
        if (pc) {
            try {
                await pc.setRemoteDescription(new RTCSessionDescription(answer));

                const queued = pendingCandidatesRef.current[from] || [];
                if (queued.length > 0) {
                    console.log(`❄️ Flushing ${queued.length} queued ICE candidates for ${from} (after Answer)`);
                    for (const c of queued) {
                        try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch (e) { console.error('Error adding queued candidate:', e); }
                    }
                    pendingCandidatesRef.current[from] = [];
                }
            } catch (err) {
                console.error('Error setting remote description:', err);
            }
        }
    }, []);

    const handleIceCandidate = useCallback(async ({ candidate, from }) => {
        const pc = peerConnectionsRef.current[from];
        if (pc && pc.remoteDescription) {
            try {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (err) {
                console.error('Error adding ice candidate:', err);
            }
        } else {
            if (!pendingCandidatesRef.current[from]) pendingCandidatesRef.current[from] = [];
            pendingCandidatesRef.current[from].push(candidate);
            console.log(`❄️ Queued ICE candidate for ${from} (Total: ${pendingCandidatesRef.current[from].length})`);
        }
    }, []);

    return {
        participants,
        setParticipants,
        handleUserJoined,
        handleUserLeft,
        handleOffer,
        handleAnswer,
        handleIceCandidate,
        handleMediaState,
        peerConnectionsRef,
        remoteStreamsRef,
        pendingCandidatesRef,
        dataChannelsRef,
        dataChannelStatus
    };
}
