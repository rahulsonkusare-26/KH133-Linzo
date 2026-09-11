import React, { useMemo, useEffect, useRef, useState } from 'react';
import LocalVideoTile from './LocalVideoTile';
import RemoteVideoTile from './RemoteVideoTile';

const MAX_VISIBLE = 9;

/** Measure a DOM element with ResizeObserver */
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

/** Decide layout mode from participant count, container width, and override states */
function deriveLayout({ count, width, hasPinned, isSpeaker, isAdhd }) {
    if (hasPinned || isSpeaker || isAdhd) return 'spotlight';
    if (count <= 1) return 'solo';
    if (count === 2) return 'duo';
    
    // Mobile specific layout overrides
    if (width < 768) {
        if (count === 3) return 'grid2'; // 3 tiles span seamlessly in grid2 with specific CSS
        if (count === 4) return 'grid2'; // 4 tiles form a neat 2x2 grid
        // 5+ tiles will also hit grid2, but maxVisible cap restricts it to 4
        return 'grid2'; 
    }

    if (count === 3) return 'trio';
    if (count === 4) return 'quad';
    if (count <= 6) return width >= 900 ? 'grid3' : 'grid2';
    return 'grid3';
}

const VideoGallery = (props) => {
    const {
        participants,
        layoutMode,
        setLayoutMode,
        pinnedParticipantId,
        setPinnedParticipantId,
        userType,
        showAvatar,
        isVideoOff,
        isMuted,
        selfIdRef,
        activeSpeakerId,
        cognitiveMode,
        prominenceMode = 'grid',
    } = props;

    const stageRef = useRef(null);
    const { width: cw } = useContainerSize(stageRef);

    const isAdhdFocus = cognitiveMode === 'focus';
    const isSpeakerMode = layoutMode === 'speaker';
    const isSidebarMode = (userType === 'deaf' || userType === 'mute') && showAvatar;
    const isInsetMode = prominenceMode === 'inset' && !isSidebarMode;

    useEffect(() => {
        if (isAdhdFocus && layoutMode !== 'speaker') setLayoutMode('speaker');
    }, [isAdhdFocus]); // eslint-disable-line

    /* ── Priority-sorted unified participant list ── */
    // IMPORTANT: activeSpeakerId is deliberately NOT in this dependency array.
    // Including it caused the entire list to re-sort on every speaker tick,
    // which triggered tile reordering and visual flashes.
    // The isActive prop is passed directly in tile() below without affecting order.
    const allParticipants = useMemo(() => {
        const selfId = selfIdRef?.current;
        const remote = participants
            .filter(p => p.id !== selfId && p.id !== 'local')
            .map(p => ({ ...p, isLocal: false }));
        const local = { id: 'local', isLocal: true };
        const rawList = [local, ...remote];

        // Annotate BEFORE sort so join-order index is stable even when pinning reorders tiles.
        // This is the stable index used for display name fallback ("Participant N").
        rawList.forEach((p, i) => { p._joinIdx = i; });

        // Priority: pinned → rest (stable — do NOT sort by activeSpeakerId)
        rawList.sort((a, b) => {
            if (a.id === pinnedParticipantId) return -1;
            if (b.id === pinnedParticipantId) return 1;
            return 0;
        });
        return rawList;
    }, [participants, selfIdRef, pinnedParticipantId]);

    /* In inset mode, local is removed from grid and shown as PiP */
    const gridParticipants = useMemo(
        () => (isInsetMode ? allParticipants.filter(p => p.id !== 'local') : allParticipants),
        [allParticipants, isInsetMode]
    );

    const visibleTiles = gridParticipants.slice(0, MAX_VISIBLE);
    const hiddenTiles  = gridParticipants.slice(MAX_VISIBLE);

    const layout = useMemo(() => deriveLayout({
        count: visibleTiles.length,
        width: cw,
        hasPinned: !!pinnedParticipantId,
        isSpeaker: isSpeakerMode,
        isAdhd: isAdhdFocus,
    }), [visibleTiles.length, cw, pinnedParticipantId, isSpeakerMode, isAdhdFocus]);

    /* ── Shared tile factory ── */
    const tile = (p, idx, { isLarge = false, isMain = false, asInset = false } = {}) => {
        const isActiveSpeaker = p.isLocal ? activeSpeakerId === 'local' : activeSpeakerId === p.id;
        const pinned = p.id === pinnedParticipantId || isMain;
        // Use stable join-order index for display name fallback.
        // This prevents the pinned main tile from inheriting idx=0 and showing "Participant 1".
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
                    isInset={asInset}
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
                {...props}
                participant={p}
                index={stableIdx}
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

    /* ── Layout renderers ── */
    const renderSolo = () => {
        if (!visibleTiles[0]) return null;
        return (
            <div className="lz-solo">
                <div className="lz-tile-wrapper lz-tile-solo">
                    {tile(visibleTiles[0], 0, { isLarge: true })}
                </div>
            </div>
        );
    };

    const renderDuo = () => (
        <div className="lz-duo">
            {visibleTiles.map((p, i) => (
                <div key={p.id} className="lz-tile-wrapper">{tile(p, i)}</div>
            ))}
        </div>
    );

    const renderTrio = () => (
        <div className="lz-trio">
            <div className="lz-trio-main lz-tile-wrapper">
                {tile(visibleTiles[0], 0, { isLarge: true })}
            </div>
            <div className="lz-trio-stack">
                {visibleTiles.slice(1).map((p, i) => (
                    <div key={p.id} className="lz-trio-secondary lz-tile-wrapper">{tile(p, i + 1)}</div>
                ))}
            </div>
        </div>
    );

    const renderQuad = () => (
        <div className="lz-quad">
            {visibleTiles.map((p, i) => (
                <div key={p.id} className="lz-tile-wrapper">{tile(p, i)}</div>
            ))}
        </div>
    );

    const renderGrid = (cls) => (
        <div className={cls}>
            {visibleTiles.map((p, i) => (
                <div key={p.id} className="lz-tile-wrapper">{tile(p, i)}</div>
            ))}
        </div>
    );

    const renderSpotlight = () => {
        const mainId = pinnedParticipantId || activeSpeakerId || gridParticipants[0]?.id || 'local';
        const mainP = allParticipants.find(p => p.id === mainId) || allParticipants[0];
        const others = allParticipants.filter(p => p.id !== mainP?.id);
        const sidebarCap = 8;
        const sidebarHidden = others.length > sidebarCap ? others.length - sidebarCap : 0;

        return (
            <div className="lz-spotlight">
                <div className="lz-spotlight-main">
                    {/* Tile fills main area — absolute inset so video covers fully */}
                    <div className="lz-tile-wrapper" style={{ position: 'absolute', inset: 0 }}>
                        {mainP && tile(mainP, 0, { isLarge: true, isMain: true })}
                    </div>
                </div>
                {others.length > 0 && (
                    <div className="lz-spotlight-sidebar">
                        {others.slice(0, sidebarCap).map((p, i) => (
                            <div key={p.id} className="lz-sidebar-tile">{tile(p, i + 1)}</div>
                        ))}
                    </div>
                )}
            </div>
        );
    };


    const renderStage = () => {
        switch (layout) {
            case 'spotlight': return renderSpotlight();
            case 'solo':      return renderSolo();
            case 'duo':       return renderDuo();
            case 'trio':      return renderTrio();
            case 'quad':      return renderQuad();
            case 'grid2':     return renderGrid('lz-grid2');
            case 'grid3':
            default:          return renderGrid('lz-grid3');
        }
    };

    /* ── Local participant for inset ── */
    const localP = allParticipants.find(p => p.id === 'local');

    return (
        <div ref={stageRef} className={`lz-stage ${isAdhdFocus ? 'adhd-focus-gallery' : ''}`}>

            {/* ADHD Focus indicator */}
            {isAdhdFocus && (
                <div className="adhd-focus-indicator">
                    <span className="adhd-focus-dot" />
                    <span>Focus Mode Active</span>
                </div>
            )}

            {renderStage()}

            {/* Floating inset self-view PiP */}
            {isInsetMode && localP && (
                <div className="lz-inset-pip">
                    <div className="lz-inset-pip-inner">
                        {tile(localP, 0, { asInset: true })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default VideoGallery;
