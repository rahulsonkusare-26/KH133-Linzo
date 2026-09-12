/**
 * Samvaad AI Semantic Engine - Shared Session-Scoped Semantic State (Stage 4)
 * Single source of truth for real-time session state with immutable versioned timeline.
 */

export class SharedSessionState {
  constructor(sessionId = `S${Math.floor(100 + Math.random() * 900)}`) {
    this.sessionId = sessionId;
    this.version = 1;
    this.currentEvent = null;
    this.participants = new Map(); // participantId -> Profile
    this.context = 'ACTIVE_MEETING';
    this.createdAt = Date.now();
    this.updatedAt = Date.now();
    
    // Versioned Timeline History (v1, v2, v3, ...)
    this.history = [];
  }

  /**
   * Registers a participant and their accessibility profile
   */
  registerParticipant(participantId, profile = {}) {
    const defaultProfile = {
      participantId,
      name: profile.name || `Participant_${participantId.substr(0, 4)}`,
      preferredModality: profile.preferredModality || 'TEXT', // SPEECH, SIGN_AVATAR, TEXT, BRAILLE, AAC, HAPTIC
      language: profile.language || 'en',
      accessibility: profile.accessibility || { visualImpairment: false, hearingImpairment: false },
      deviceCapability: profile.deviceCapability || { audioOutput: true, hapticFeedback: true, display3D: true }
    };

    this.participants.set(participantId, defaultProfile);
    this._commitStateChange('PARTICIPANT_JOINED', { participantId, profile: defaultProfile });
    return defaultProfile;
  }

  unregisterParticipant(participantId) {
    if (this.participants.has(participantId)) {
      this.participants.delete(participantId);
      this._commitStateChange('PARTICIPANT_LEFT', { participantId });
    }
  }

  /**
   * Atomically commits a new canonical semantic event into session state.
   * Increments state version (v41 -> v42) and records to append-only timeline.
   */
  atomicCommit(canonicalEvent) {
    this.version += 1;
    this.currentEvent = canonicalEvent;
    this.updatedAt = Date.now();

    const snapshot = {
      version: `v${this.version}`,
      event: canonicalEvent.toJSON ? canonicalEvent.toJSON() : canonicalEvent,
      participantCount: this.participants.size,
      context: this.context,
      timestamp: this.updatedAt,
      time: new Date(this.updatedAt).toISOString().split('T')[1].split('.')[0]
    };

    // Immutable timeline append
    this.history.push(Object.freeze(snapshot));

    // Cap history in memory to last 500 events
    if (this.history.length > 500) {
      this.history.shift();
    }

    return snapshot;
  }

  _commitStateChange(type, data) {
    this.version += 1;
    this.updatedAt = Date.now();

    const snapshot = {
      version: `v${this.version}`,
      event: {
        event_id: `SYS_${Date.now()}`,
        intent: type,
        actor: 'SYSTEM',
        payload: data
      },
      participantCount: this.participants.size,
      context: this.context,
      timestamp: this.updatedAt,
      time: new Date(this.updatedAt).toISOString().split('T')[1].split('.')[0]
    };

    this.history.push(Object.freeze(snapshot));
  }

  getSnapshot() {
    return {
      session: this.sessionId,
      version: `v${this.version}`,
      currentEvent: this.currentEvent ? (this.currentEvent.toJSON ? this.currentEvent.toJSON() : this.currentEvent) : null,
      participants: Array.from(this.participants.values()),
      context: this.context,
      updatedAt: new Date(this.updatedAt).toISOString().split('T')[1].split('.')[0],
      historyCount: this.history.length
    };
  }

  getHistory(limit = 20) {
    return this.history.slice(-limit);
  }
}
