# Linzo: Data Assets & Reference Datasets

This directory provides dataset manifests, vocabulary indices, accessibility persona profiles, and sample multimodal test fixtures utilized by Linzo's translation and semantic engine.

---

## Files Included

### 1. `isl_gesture_vocab.json`
Dictionary of supported Indian Sign Language (ISL) vocabulary tokens, fingerspelling alphabet mappings (A-Z), keyframe animation timing, and MediaPipe landmark orientation bounding thresholds.

### 2. `accessibility_profiles.json`
Pre-calibrated cognitive, sensory, and motor accessibility profile personas:
- **Deaf / Hard-of-Hearing (DHH)**: Avatar sign synthesis enabled, live captions with speaker identification, haptic turn notifications.
- **Blind / Low-Vision**: High-contrast dark theme, screen reader optimizations, ASCII Braille output, audio cue prioritization.
- **Neurodivergent / AAC**: Reduced visual clutter, AAC symbol grid assist, cognitive overload dampening.
- **Standard**: Full interactive UI with standard WebRTC video gallery.

### 3. `sample_conversations.json`
Multi-turn conversational benchmark transcripts pairing speech audio timestamps with corresponding ISL gestures, English text, and Grade 1 Braille cell encodings used for regression testing.
