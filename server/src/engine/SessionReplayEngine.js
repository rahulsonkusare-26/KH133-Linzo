/**
 * Samvaad AI Semantic Engine - Session Replay Engine
 * Provides time-travel scrubbing and snapshot playback over immutable versioned session state history.
 */

export class SessionReplayEngine {
  constructor(sharedSessionState) {
    this.sessionState = sharedSessionState;
    this.isReplaying = false;
    this.replayCursor = 0;
  }

  /**
   * Load snapshot timeline for replay.
   */
  getTimelineSnapshots() {
    return this.sessionState.getHistory(500);
  }

  /**
   * Seek to a specific timeline version (e.g. "v2" or "v3") and restore snapshot.
   * @param {string|number} targetVersion 
   */
  seekToVersion(targetVersion) {
    const history = this.getTimelineSnapshots();
    const versionStr = typeof targetVersion === 'number' ? `v${targetVersion}` : targetVersion;
    const targetSnapshot = history.find(s => s.version === versionStr);

    if (!targetSnapshot) {
      throw new Error(`Replay Error: Version ${versionStr} not found in session history`);
    }

    this.replayCursor = versionStr;
    return targetSnapshot;
  }

  /**
   * Play back timeline events sequentially.
   * @param {Function} onStepCallback 
   * @param {number} stepDelayMs 
   */
  async playReplay(onStepCallback, stepDelayMs = 50) {
    const history = this.getTimelineSnapshots();
    this.isReplaying = true;

    for (const snapshot of history) {
      if (!this.isReplaying) break;
      this.replayCursor = snapshot.version;
      if (typeof onStepCallback === 'function') {
        onStepCallback(snapshot);
      }
      await new Promise(resolve => setTimeout(resolve, stepDelayMs));
    }

    this.isReplaying = false;
    return { status: 'REPLAY_COMPLETE', totalSnapshots: history.length };
  }

  stopReplay() {
    this.isReplaying = false;
  }
}
