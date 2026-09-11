/**
 * Samvaad AI Semantic Engine - Haptic Feedback Synthesizer
 * Converts canonical semantic intents into tactile vibration pattern arrays for accessibility hardware.
 */

export class HapticFeedbackSynthesizer {
  static PATTERN_MAP = {
    'GREETING': [100, 50, 100],         // Double pulse
    'JOIN': [200, 100, 200, 100, 200], // Triple long pulse
    'LEAVE': [300, 100, 100],           // Descending feel
    'AFFIRM': [80, 40, 80],            // Gentle double tap
    'ALERT': [150, 50, 150, 50, 150],   // Rapid alert
    'DEFAULT': [100]
  };

  /**
   * Synthesize a vibration pattern from intent or canonical event.
   * @param {string|Object} intentOrEvent 
   * @returns {number[]} Vibration duration array in milliseconds
   */
  static synthesize(intentOrEvent) {
    const intent = typeof intentOrEvent === 'string'
      ? intentOrEvent
      : (intentOrEvent?.intent || 'DEFAULT');

    const pattern = HapticFeedbackSynthesizer.PATTERN_MAP[intent] || HapticFeedbackSynthesizer.PATTERN_MAP.DEFAULT;
    return [...pattern];
  }
}
