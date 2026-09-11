import { useState, useRef, useCallback } from 'react';

/**
 * useMediaControls — Manages mic, camera, screen share, and stream switching.
 * 
 * @param {React.MutableRefObject} socketRef - Socket.IO ref
 * @param {string} roomId - Current room ID
 * @param {React.MutableRefObject} peerConnectionsRef - Map of RTCPeerConnections
 * @returns Media control state and handlers
 */
export function useMediaControls(socketRef, roomId, peerConnectionsRef, passedLocalStreamRef) {
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [localStream, setLocalStream] = useState(null);

    // Use passed ref or internal one
    const localStreamRef = passedLocalStreamRef || useRef(null);
    const baseStreamRef = useRef(null);
    const localVideoRef = useRef(null);

    // Helper to switch the active local stream (e.g. between Webcam and AI Video)
    const switchStream = useCallback((newStream) => {
        if (!newStream) return;

        console.log('🔄 Switching local stream. Tracks:', newStream.getTracks().length);
        localStreamRef.current = newStream;
        setLocalStream(newStream);

        // 1. Update local video element
        if (localVideoRef.current) {
            localVideoRef.current.srcObject = newStream;
        }

        // 2. Apply current mute/video state to the new stream
        newStream.getAudioTracks().forEach(track => { track.enabled = !isMuted; });
        newStream.getVideoTracks().forEach(track => { track.enabled = !isVideoOff; });

        // 3. Update all existing peer connections
        Object.values(peerConnectionsRef.current).forEach(pc => {
            const senders = pc.getSenders();
            const videoTrack = newStream.getVideoTracks()[0];
            const audioTrack = newStream.getAudioTracks()[0];

            if (videoTrack) {
                const videoSender = senders.find(s => s.track?.kind === 'video');
                if (videoSender) videoSender.replaceTrack(videoTrack).catch(e => console.error('Error replacing video track:', e));
            }
            if (audioTrack) {
                const audioSender = senders.find(s => s.track?.kind === 'audio');
                if (audioSender) audioSender.replaceTrack(audioTrack).catch(e => console.error('Error replacing audio track:', e));
            }
        });
    }, [isMuted, isVideoOff, peerConnectionsRef]);

    const toggleMute = useCallback(() => {
        const stream = localStreamRef.current;
        if (stream) {
            const audioTrack = stream.getAudioTracks()[0];
            if (audioTrack) {
                const newMuteState = !isMuted;
                audioTrack.enabled = !newMuteState;
                setIsMuted(newMuteState);

                // Broadcast new state
                if (socketRef.current) {
                    socketRef.current.emit('media-state', {
                        roomId,
                        micOn: !newMuteState,
                        camOn: !isVideoOff
                    });
                }
            }
        }
    }, [isMuted, isVideoOff, socketRef, roomId]);

    const toggleVideo = useCallback(() => {
        const stream = localStreamRef.current;
        if (stream) {
            const videoTrack = stream.getVideoTracks()[0];
            if (videoTrack) {
                const newVideoState = !isVideoOff;
                videoTrack.enabled = !newVideoState;
                setIsVideoOff(newVideoState);

                // Broadcast new state
                if (socketRef.current) {
                    socketRef.current.emit('media-state', {
                        roomId,
                        micOn: !isMuted,
                        camOn: !newVideoState
                    });
                }
            }
        }
    }, [isMuted, isVideoOff, socketRef, roomId]);

    const toggleScreenShare = useCallback(async () => {
        if (!isScreenSharing) {
            try {
                const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
                const videoTrack = screenStream.getVideoTracks()[0];
                Object.values(peerConnectionsRef.current).forEach(pc => {
                    const sender = pc.getSenders().find(s => s.track?.kind === 'video');
                    if (sender) {
                        sender.replaceTrack(videoTrack);
                    }
                });
                setIsScreenSharing(true);
                videoTrack.onended = () => { toggleScreenShare(); };
            } catch (err) { console.error('Error sharing screen:', err); }
        } else {
            const stream = localStreamRef.current;
            const videoTrack = stream?.getVideoTracks()[0];
            Object.values(peerConnectionsRef.current).forEach(pc => {
                const sender = pc.getSenders().find(s => s.track?.kind === 'video');
                if (sender) { sender.replaceTrack(videoTrack); }
            });
            setIsScreenSharing(false);
        }
    }, [isScreenSharing, peerConnectionsRef]);

    return {
        isMuted,
        isVideoOff,
        isScreenSharing,
        localStream,
        setLocalStream,
        localStreamRef,
        baseStreamRef,
        localVideoRef,
        switchStream,
        toggleMute,
        toggleVideo,
        toggleScreenShare
    };
}
