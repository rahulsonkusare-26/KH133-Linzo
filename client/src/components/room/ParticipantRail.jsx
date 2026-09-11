import React, { useMemo, useEffect, useRef, useState } from 'react';
import LocalVideoTile from './LocalVideoTile';
import RemoteVideoTile from './RemoteVideoTile';

const MAX_VISIBLE = 9;

function useContainerSize(ref) {
    const [size, setSize] = useState({ width: 0, height: 0 });
    useEffect(() => {
        if (!ref.current) return;
        const ro = new ResizeObserver(([entry]) => {
            const { width, height } = entry.contentRect;
            setSize({ width, height });
        });
        ro.observe(ref.current);
        return () => ro.disconnect();
    }, []);
    return size;
}

/**
 * ParticipantRail - Dedicated component for rendering participant tiles as a secondary column/row
 * alongside the Sign Avatar. It has its own layout logic tailored to sidebar constraints.
 */
const ParticipantRail = (props) => {
    const {
        participants,
        pinnedParticipantId,
        setPinnedParticipantId,
        isVideoOff,
        isMuted,
        selfIdRef,
        activeSpeakerId,
        cognitiveMode,
    } = props;

    const railRef = useRef(null);
    const { width: cw } = useContainerSize(railRef);
    const [showOverflow, setShowOverflow] = useState(false);
    
    // Detect mobile boundary to branch layout logic between Bottom Tray and Side Rail
    const [isMobileMode, setIsMobileMode] = useState(window.innerWidth < 768);
    useEffect(() => {
        const handleResize = () => setIsMobileMode(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const isAdhdFocus = cognitiveMode === 'focus';

    /* Priority-sorted unified participant list */
    // IMPORTANT: activeSpeakerId is deliberately NOT in this dependency array.
    // Including it caused the entire list to re-sort on every speaker tick,
    // which triggered tile reordering and visual flashes in the sidebar.
    const allParticipants = useMemo(() => {
        const selfId = selfIdRef?.current;
        const remote = participants
            .filter(p => p.id !== selfId && p.id !== 'local')
            .map(p => ({ ...p, isLocal: false }));
        const local = { id: 'local', isLocal: true };
        
        const rawList = [local, ...remote];

        // Annotate BEFORE sort so join-order index is stable even when pinning reorders tiles.
        rawList.forEach((p, i) => { p._joinIdx = i; });

        // Sort by pinned only — do NOT sort by activeSpeakerId to prevent tile re-ordering flashes
        rawList.sort((a, b) => {
            if (a.id === pinnedParticipantId) return -1;
            if (b.id === pinnedParticipantId) return 1;
            return 0;
        });
        return rawList;
    }, [participants, selfIdRef, pinnedParticipantId]);

    const visibleTiles = allParticipants.slice(0, MAX_VISIBLE);
    const hiddenTilesCount = allParticipants.length > MAX_VISIBLE ? allParticipants.length - MAX_VISIBLE : 0;

    // Factory
    const renderTile = (p, idx, isLarge = false, isMain = false) => {
        const isActiveSpeaker = p.isLocal ? activeSpeakerId === 'local' : activeSpeakerId === p.id;
        const pinned = p.id === pinnedParticipantId || isMain;
        // Use stable join-order index for display name fallback (prevents "Participant 1" on pin).
        const stableIdx = p._joinIdx !== undefined ? p._joinIdx : idx;

        if (p.isLocal) {
            return (
                <LocalVideoTile
                    key="local"
                    {...props}
                    isVideoOff={isVideoOff}
                    isMuted={isMuted}
                    isActive={isActiveSpeaker}
                    isLarge={isLarge}
                    isInset={false}
                    isPinned={pinned}
                    onPin={() => setPinnedParticipantId(prev => prev === 'local' ? null : 'local')}
                    adhdFocusMode={isAdhdFocus}
                    adhdIsMainSpeaker={isMain && isAdhdFocus}
                    className="w-full h-full"
                />
            );
        }
        return (
            <RemoteVideoTile
                key={p.id}
                index={stableIdx}
                {...props}
                participant={p}
                isPinned={pinned}
                isActive={isActiveSpeaker}
                isLarge={isLarge}
                adhdFocusMode={isAdhdFocus}
                adhdIsMainSpeaker={isMain && isAdhdFocus}
                onPin={(id) => setPinnedParticipantId(prev => prev === id ? null : id)}
                className="w-full h-full"
            />
        );
    };

    // Determine grid classes based on count and width
    // We want readable tiles: never shrink below ~140px height.
    const getLayoutConfig = () => {
        const c = visibleTiles.length;
        if (c === 0) return { type: 'empty' };
        
        // MOBILE / SMALL SCREEN (Bottom Stack Mode)
        // Strictly restore original vertical scrolling logic per specific user requirement!
        // Avatar must be primary top surface, and participant tile array must list neatly below WITHOUT horizontal scrolling
        if (isMobileMode) {
            if (c === 1) return { type: 'solo', gridClass: 'grid-cols-1 grid-rows-1 h-full' };
            if (c === 2) return { type: 'stack', gridClass: 'grid-cols-1 auto-rows-[minmax(140px,auto)]' }; 
            return { type: 'stack', gridClass: 'grid-cols-1 auto-rows-[minmax(140px,180px)]' };
        }

        // DESKTOP (Side Rail Mode)
        if (c === 1) return { type: 'solo', gridClass: 'grid-cols-1 grid-rows-1 h-full' };
        if (c === 2) return { type: 'duo', gridClass: 'grid-cols-1 grid-rows-2 h-full' };
        if (c === 3) return { type: 'trio', gridClass: 'grid-cols-1 grid-rows-3 h-full' };
        
        // 4+ participants
        if (c === 4) {
            return cw > 350 
                ? { type: 'quad', gridClass: 'grid-cols-2 grid-rows-2 h-full' }
                : { type: 'quad-stack', gridClass: 'grid-cols-1 auto-rows-[minmax(180px,1fr)]' };
        }
        
        return cw > 350 
            ? { type: 'grid', gridClass: 'grid-cols-2 auto-rows-[minmax(140px,auto)]' }
            : { type: 'stack', gridClass: 'grid-cols-1 auto-rows-[minmax(180px,auto)]' };
    };

    const config = getLayoutConfig();

    return (
        <div ref={railRef} className={`w-full h-full p-2 flex flex-col relative z-0 content-start overflow-y-auto overflow-x-hidden`}>
            {config.type !== 'empty' && (
                <div className={`w-full grid gap-2 ${config.gridClass}`}>
                    {visibleTiles.map((p, idx) => (
                        <div key={p.id} className={`min-h-[140px] relative w-full overflow-hidden rounded-2xl bg-slate-900 shrink-0 shadow-[0_4px_20px_rgba(0,0,0,0.06)]`}>
                            {renderTile(p, idx, config.type === 'solo', p.id === pinnedParticipantId || p.id === activeSpeakerId)}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ParticipantRail;
