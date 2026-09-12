# Samvaad AI Semantic Engine Architecture Guide

The **Samvaad AI Semantic Engine** is a multimodal orchestration platform that unifies heterogeneous inputs (Speech, Sign Language Landmarks, Text, Eye Gaze) into canonical semantic events, collapses equivalent meanings in real-time, and dispatches participant-aware rendering outputs over a Master Timeline ($T_0$).

---

## 5-Stage Orchestration Pipeline

1. **Stage 1: Feature Encoders (`encoders/`)**
   - Transmutes raw inputs (audio samples, MediaPipe landmark vectors, text tokens) into a `UnifiedFeatureStream`.
2. **Stage 2: Canonical Event Generator (`canonical/`)**
   - Parses intent, entities, actor, and temporal boundaries into standardized `CanonicalSemanticEvent` schemas.
3. **Stage 3: Semantic Equivalence Engine (`equivalence/`)**
   - Collapses concurrent multi-modal duplicates (`JOIN_SPEECH` + `JOIN_SIGN` $\to$ `JOIN`) within a temporal window (default 800ms).
4. **Stage 4: Shared Session-Scoped Semantic State (`state/`)**
   - Performs thread-safe atomic commits, incrementing session version ($v_1 \to v_2 \dots$) and appending to immutable timeline history.
5. **Stage 5: Participant-Aware Rendering Adapters (`adapters/`)**
   - Renders personalized outputs (Speech Synthesizer, 3D Avatar Sign Generator, Text Formatter, Braille Codec, AAC Symbol Mapper, Haptic Signal Synthesizer) aligned over Master Timeline ($T_0$).

---

## API Endpoints

- `GET /api/engine/status`: Retrieve real-time engine health and version.
- `GET /api/engine/timeline`: Fetch versioned state timeline snapshot history.
- `POST /api/engine/simulate`: Trigger simulated multimodal semantic events.
