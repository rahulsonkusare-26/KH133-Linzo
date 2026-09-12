/**
 * Samvaad AI Semantic Engine - Semantic Context Tracker
 * Maintains active conversation topic context, participant turns, and intent transition graphs across meeting turns.
 */

export class SemanticContextTracker {
  constructor() {
    this.activeTopic = 'GENERAL';
    this.lastSpeaker = null;
    this.intentSequence = [];
  }

  recordTurn(event) {
    if (!event) return;

    this.lastSpeaker = event.actor || 'ANONYMOUS';
    this.intentSequence.push({
      intent: event.intent,
      actor: event.actor,
      timestamp: event.timestamp || Date.now()
    });

    if (this.intentSequence.length > 100) {
      this.intentSequence.shift();
    }

    this.inferTopic(event);
  }

  inferTopic(event) {
    const payloadStr = JSON.stringify(event.payload || {}).toLowerCase();
    if (payloadStr.includes('join') || event.intent === 'JOIN') {
      this.activeTopic = 'PARTICIPANT_ENTRY';
    } else if (payloadStr.includes('leave') || event.intent === 'LEAVE') {
      this.activeTopic = 'PARTICIPANT_EXIT';
    } else if (event.intent === 'GREETING') {
      this.activeTopic = 'WELCOME_GREETINGS';
    }
  }

  getContextSummary() {
    return {
      activeTopic: this.activeTopic,
      lastSpeaker: this.lastSpeaker,
      totalTurns: this.intentSequence.length,
      recentIntents: this.intentSequence.slice(-5).map(i => i.intent)
    };
  }
}
