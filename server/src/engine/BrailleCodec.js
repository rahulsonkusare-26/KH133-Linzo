/**
 * Samvaad AI Semantic Engine - Braille Codec
 * Translates text & canonical semantic intents into Unicode Braille (Grade 1 ASCII map)
 * for refreshable tactile Braille displays.
 */

export class BrailleCodec {
  static BRAILLE_MAP = {
    'a': '⠁', 'b': '⠃', 'c': '⠉', 'd': '⠙', 'e': '⠑', 'f': '⠋', 'g': '⠛', 'h': '⠓',
    'i': '⠊', 'j': '⠚', 'k': '⠅', 'l': '⠇', 'm': '⠍', 'n': '⠝', 'o': '⠕', 'p': '⠏',
    'q': '⠟', 'r': '⠗', 's': '⠌', 't': '⠞', 'u': '⠥', 'v': '⠧', 'w': '⠺', 'x': '⠭',
    'y': '⠽', 'z': '⠵', ' ': ' ', '0': '⠴', '1': '⠂', '2': '⠆', '3': '⠒', '4': '⠲',
    '5': '⠢', '6': '⠖', '7': '⠶', '8': '⠦', '9': '⠔'
  };

  /**
   * Encode text string into Unicode Braille sequence.
   * @param {string} text 
   * @returns {string}
   */
  static encodeText(text = '') {
    if (!text || typeof text !== 'string') return '';
    return text.toLowerCase().split('').map(ch => BrailleCodec.BRAILLE_MAP[ch] || ch).join('');
  }

  /**
   * Convert canonical event intent to Braille representation.
   * @param {Object} event 
   * @returns {Object} { text, braille, pinArray }
   */
  static encodeEvent(event) {
    const text = event?.payload?.phrase || event?.intent || 'EVENT';
    const braille = BrailleCodec.encodeText(text);
    return {
      text,
      braille,
      charCount: text.length,
      timestamp: Date.now()
    };
  }
}
