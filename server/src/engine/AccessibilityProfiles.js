/**
 * Samvaad AI Semantic Engine - Accessibility Profiles Registry
 * Pre-configured participant rendering profiles for tailored output dispatching.
 */

const ACCESSIBILITY_PROFILES = {
  DEAF_HARD_OF_HEARING: {
    id: 'deaf_hoh',
    name: 'Deaf / Hard of Hearing',
    primaryOutput: 'SIGN_AVATAR',
    secondaryOutput: 'TEXT_CAPTIONS',
    hapticAlerts: true,
    visualIndicators: true,
    defaultLanguage: 'ISL'
  },
  BLIND_VISUALLY_IMPAIRED: {
    id: 'blind_vi',
    name: 'Blind / Visually Impaired',
    primaryOutput: 'SPEECH_TTS',
    secondaryOutput: 'BRAILLE_CODEC',
    audioFeedback: true,
    screenReaderOptimized: true,
    defaultLanguage: 'en-US'
  },
  NON_VERBAL_AAC: {
    id: 'non_verbal_aac',
    name: 'Non-Verbal AAC User',
    primaryOutput: 'AAC_SYMBOLS',
    secondaryOutput: 'SPEECH_TTS',
    predictiveText: true,
    symbolGridSize: '4x4'
  },
  MOTOR_EYE_GAZE: {
    id: 'motor_eye_gaze',
    name: 'Motor Assist / Eye Gaze',
    primaryOutput: 'TEXT_CAPTIONS',
    secondaryOutput: 'SPEECH_TTS',
    dwellTimeMs: 400,
    largeTargets: true
  },
  STANDARD: {
    id: 'standard',
    name: 'Standard Multimodal',
    primaryOutput: 'SPEECH_TTS',
    secondaryOutput: 'TEXT_CAPTIONS',
    defaultLanguage: 'en-US'
  }
};

/**
 * Helper to retrieve or merge custom participant accessibility profiles.
 * @param {string} profileId 
 * @param {Object} customOverrides 
 * @returns {Object}
 */
function getProfile(profileId, customOverrides = {}) {
  const base = ACCESSIBILITY_PROFILES[profileId.toUpperCase()] || ACCESSIBILITY_PROFILES.STANDARD;
  return { ...base, ...customOverrides };
}

module.exports = { ACCESSIBILITY_PROFILES, getProfile };
