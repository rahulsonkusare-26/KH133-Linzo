/**
 * Samvaad AI Semantic Engine - Event Serializer & Schema Validator
 * Encodes, decodes, and validates Canonical Semantic Events for transmission over WebSockets and WebRTC data channels.
 */

const { CanonicalSemanticEvent } = require('./CanonicalSemanticEvent');

class EventSerializer {
  /**
   * Serialize a CanonicalSemanticEvent to JSON string or packed Buffer.
   * @param {CanonicalSemanticEvent} event 
   * @returns {string}
   */
  static serialize(event) {
    if (!event || typeof event.toJSON !== 'function') {
      throw new TypeError('Invalid CanonicalSemanticEvent instance');
    }
    return JSON.stringify(event.toJSON());
  }

  /**
   * Deserialize a raw string into a CanonicalSemanticEvent.
   * @param {string|Object} rawData 
   * @returns {CanonicalSemanticEvent}
   */
  static deserialize(rawData) {
    const payload = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
    this.validateSchema(payload);
    return CanonicalSemanticEvent.fromJSON(payload);
  }

  /**
   * Validate that an event object adheres to the Canonical Semantic Schema.
   * @param {Object} schema 
   * @returns {boolean}
   */
  static validateSchema(schema) {
    if (!schema || typeof schema !== 'object') {
      throw new Error('Schema validation failed: Event must be a non-null object');
    }
    const requiredFields = ['eventId', 'actor', 'intent', 'modality', 'payload'];
    for (const field of requiredFields) {
      if (!(field in schema)) {
        throw new Error(`Schema validation failed: Missing required field '${field}'`);
      }
    }
    return true;
  }
}

module.exports = { EventSerializer };
