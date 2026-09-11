# Samvaad AI: Data Flow & Sequence Blueprints

This document details the exact sequence and runtime event pipelines within the Samvaad AI platform.

---

## 1. WebRTC Signaling & Peer Handshake Sequence

```mermaid
sequenceDiagram
    autonumber
    participant Alice as Alice (Signer / Client A)
    participant Server as Node.js Socket.io Signaling
    participant Bob as Bob (Non-Signer / Client B)

    Alice->>Server: join-room { roomId: "samvaad-ai-101", userId: "alice_01" }
    Server-->>Alice: room-joined { participants: [] }

    Bob->>Server: join-room { roomId: "samvaad-ai-101", userId: "bob_02" }
    Server-->>Alice: participant-joined { userId: "bob_02" }
    Server-->>Bob: room-joined { participants: ["alice_01"] }

    Alice->>Server: signal-offer { sdp, to: "bob_02" }
    Server->>Bob: incoming-offer { sdp, from: "alice_01" }
    Bob->>Server: signal-answer { sdp, to: "alice_01" }
    Server->>Alice: incoming-answer { sdp, from: "bob_02" }

    Note over Alice,Bob: ICE Candidate Trickle Exchange
    Alice->>Server: ice-candidate { candidate, to: "bob_02" }
    Server->>Bob: ice-candidate { candidate, from: "alice_01" }

    Note over Alice,Bob: Direct P2P SRTP Audio / Video Connected
```

---

## 2. Real-Time Sign Language Translation & Avatar Synthesis Pipeline

```mermaid
sequenceDiagram
    autonumber
    participant Cam as Local Video Feed
    participant Worker as MediaPipe Worker
    participant ONNX as ONNX Inference Model
    participant Engine as Semantic Engine
    participant Peer as Remote Peer Display

    Cam->>Worker: 30 FPS Raw Video Frame
    Worker->>Worker: Extract 21 3D Hand Landmarks + 33 Pose Landmarks
    Worker->>ONNX: Normalized Landmark Vectors
    ONNX->>ONNX: Forward Pass (ISL Classifier)
    ONNX->>Engine: Detected Gesture: "THANK_YOU" (Confidence: 0.94)
    Engine->>Engine: Map to Canonical Event & Multimodal Codecs
    Engine->>Peer: Broadcast Subtitle Text: "Thank you"
    Engine->>Peer: Trigger 3D Avatar Sign Keyframe
    Engine->>Peer: Dispatch Haptic Pulse (200ms pattern)
```
