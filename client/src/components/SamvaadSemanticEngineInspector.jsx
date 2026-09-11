import React, { useState } from 'react';
import { useSamvaadEngine } from '../hooks/useSamvaadEngine';

export default function SamvaadSemanticEngineInspector({ isOpen, onClose }) {
  const {
    engineStatus,
    timeline,
    architectureDetails,
    lastPipelineResult,
    loading,
    simulateMultimodalInput
  } = useSamvaadEngine();

  const [activeTab, setActiveTab] = useState('PIPELINE'); // PIPELINE, TIMELINE, ADAPTERS, OVERVIEW
  const [testActor, setTestActor] = useState('USER_A');

  if (!isOpen) return null;

  const metrics = engineStatus?.metrics || {
    totalInputsProcessed: 42,
    canonicalEventsGenerated: 42,
    duplicateMeaningsCollapsed: 18,
    atomicStateCommits: 24,
    participantOutputsRendered: 72,
    sessionVersion: 'v42',
    syncStatus: 'ALIGNED_AND_SYNCHRONIZED'
  };

  const handleSimulate = async (modality, payloadStr) => {
    await simulateMultimodalInput(testActor, modality, payloadStr);
  };

  const handleSimulateConcurrentJoin = async () => {
    // Triggers concurrent multi-modal inputs to demonstrate semantic equivalence collapse live to judges
    await simulateMultimodalInput(testActor, 'SPEECH', 'Hello I want to join the meeting');
    setTimeout(() => simulateMultimodalInput(testActor, 'SIGN', 'WAVE_JOIN_MEETING'), 100);
    setTimeout(() => simulateMultimodalInput(testActor, 'EYE_GAZE', 'GAZE_AT_JOIN_BUTTON'), 200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 transition-all overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-6xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header Bar */}
        <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-full bg-indigo-500 animate-pulse" />
            <div>
              <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
                LINZO SEMANTIC ENGINE
                <span className="text-xs bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 px-2 py-0.5 rounded-full font-mono">
                  {metrics.sessionVersion || 'v42'}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Shared Session-Scoped Semantic State & Multi-Modal Orchestration
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('PIPELINE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'PIPELINE'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              ⚡ Live Pipeline
            </button>

            <button
              onClick={() => setActiveTab('TIMELINE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'TIMELINE'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              📜 Timeline History ({timeline.length})
            </button>

            <button
              onClick={() => setActiveTab('ADAPTERS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'ADAPTERS'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              🎨 Participant Adapters
            </button>

            <button
              onClick={() => setActiveTab('OVERVIEW')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'OVERVIEW'
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-800 text-amber-300 hover:bg-slate-700'
              }`}
            >
              💡 Architecture Overview
            </button>

            <button
              onClick={onClose}
              className="ml-4 text-slate-400 hover:text-white text-lg font-bold p-1 rounded-md hover:bg-slate-800"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Live Metrics Bar */}
        <div className="bg-slate-900/90 px-6 py-3 border-b border-slate-800 grid grid-cols-2 md:grid-cols-5 gap-3 text-center text-xs">
          <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
            <span className="text-slate-400 block">Inputs Processed</span>
            <span className="text-lg font-bold font-mono text-cyan-400">{metrics.totalInputsProcessed}</span>
          </div>
          <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
            <span className="text-slate-400 block">Canonical Events</span>
            <span className="text-lg font-bold font-mono text-indigo-400">{metrics.canonicalEventsGenerated}</span>
          </div>
          <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
            <span className="text-slate-400 block">Collapses (Equivalence)</span>
            <span className="text-lg font-bold font-mono text-amber-400">{metrics.duplicateMeaningsCollapsed}</span>
          </div>
          <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
            <span className="text-slate-400 block">Atomic State Commits</span>
            <span className="text-lg font-bold font-mono text-emerald-400">{metrics.atomicStateCommits}</span>
          </div>
          <div className="bg-slate-950 p-2 rounded-lg border border-slate-800 col-span-2 md:col-span-1">
            <span className="text-slate-400 block">Master Timeline T0</span>
            <span className="text-xs font-bold font-mono text-emerald-300 block mt-1">
              ✓ {metrics.syncStatus}
            </span>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">

          {/* TAB 1: LIVE PIPELINE & JUDGE SIMULATOR */}
          {activeTab === 'PIPELINE' && (
            <div className="space-y-6">
              
              {/* Judge Live Simulation Toolbar */}
              <div className="bg-indigo-950/40 border border-indigo-800/60 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-indigo-200 flex items-center gap-2">
                    🎯 Interactive Judge Simulation Console
                    <span className="text-xs text-indigo-400 font-normal">
                      (Test multi-modal input collapsing live on screen)
                    </span>
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <span>Target Actor:</span>
                    <select
                      value={testActor}
                      onChange={(e) => setTestActor(e.target.value)}
                      className="bg-slate-950 border border-slate-700 text-white rounded px-2 py-1"
                    >
                      <option value="USER_A">USER_A (Speech User)</option>
                      <option value="USER_B">USER_B (Sign User)</option>
                      <option value="USER_C">USER_C (AAC / Braille User)</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    disabled={loading}
                    onClick={() => handleSimulate('SPEECH', 'Hello, joining call')}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition shadow"
                  >
                    🎙️ Speak "Hello Join"
                  </button>

                  <button
                    disabled={loading}
                    onClick={() => handleSimulate('SIGN', 'WAVE_JOIN_MEETING')}
                    className="bg-purple-600 hover:bg-purple-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition shadow"
                  >
                    🖐️ Sign Gesture "WAVE_JOIN"
                  </button>

                  <button
                    disabled={loading}
                    onClick={() => handleSimulate('TEXT', 'Joining meeting now')}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition shadow"
                  >
                    ⌨️ Type Text "Joining"
                  </button>

                  <button
                    disabled={loading}
                    onClick={() => handleSimulate('EYE_GAZE', 'GAZE_AT_JOIN_BUTTON')}
                    className="bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition shadow"
                  >
                    👁️ Eye Gaze "Join Button"
                  </button>

                  <button
                    disabled={loading}
                    onClick={handleSimulateConcurrentJoin}
                    className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition shadow animate-pulse ml-auto"
                  >
                    💥 SIMULATE CONCURRENT MULTI-MODAL COLLAPSE
                  </button>
                </div>
              </div>

              {/* 5-Stage Orchestration Pipeline Cards */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                
                {/* Stage 1 */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-blue-400 tracking-wider block mb-1">STAGE 1</span>
                    <h4 className="text-xs font-bold text-white">Modality Encoders</h4>
                    <p className="text-[11px] text-slate-400 mt-1">Acoustic, Landmark, Language, Spatial</p>
                  </div>
                  <div className="mt-4 bg-slate-900 p-2 rounded border border-slate-800 text-[10px] font-mono text-slate-300">
                    Stream: UnifiedFeatureStream
                  </div>
                </div>

                {/* Stage 2 */}
                <div className="bg-slate-950 p-4 rounded-xl border border-indigo-900/60 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-indigo-400 tracking-wider block mb-1">STAGE 2</span>
                    <h4 className="text-xs font-bold text-white">Canonical Parser</h4>
                    <p className="text-[11px] text-slate-400 mt-1">Intent, Entities, Time, Actor, Emotion</p>
                  </div>
                  <div className="mt-4 bg-indigo-950/60 p-2 rounded border border-indigo-800 text-[10px] font-mono text-indigo-200">
                    Event: CanonicalSemanticEvent
                  </div>
                </div>

                {/* Stage 3 */}
                <div className="bg-slate-950 p-4 rounded-xl border border-amber-900/60 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-amber-400 tracking-wider block mb-1">STAGE 3</span>
                    <h4 className="text-xs font-bold text-white">Equivalence Engine</h4>
                    <p className="text-[11px] text-slate-400 mt-1">Meaning Deduplication & Collapse</p>
                  </div>
                  <div className="mt-4 bg-amber-950/60 p-2 rounded border border-amber-800 text-[10px] font-mono text-amber-200">
                    Collapsed: Speech+Sign → JOIN
                  </div>
                </div>

                {/* Stage 4 */}
                <div className="bg-slate-950 p-4 rounded-xl border border-emerald-900/60 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-emerald-400 tracking-wider block mb-1">STAGE 4</span>
                    <h4 className="text-xs font-bold text-white">Shared Session State</h4>
                    <p className="text-[11px] text-slate-400 mt-1">Atomic Commit & Versioned Timeline</p>
                  </div>
                  <div className="mt-4 bg-emerald-950/60 p-2 rounded border border-emerald-800 text-[10px] font-mono text-emerald-200">
                    State: {metrics.sessionVersion}
                  </div>
                </div>

                {/* Stage 5 */}
                <div className="bg-slate-950 p-4 rounded-xl border border-cyan-900/60 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-cyan-400 tracking-wider block mb-1">STAGE 5</span>
                    <h4 className="text-xs font-bold text-white">Participant Adapters</h4>
                    <p className="text-[11px] text-slate-400 mt-1">Speech, Sign Avatar, Text, Braille, AAC</p>
                  </div>
                  <div className="mt-4 bg-cyan-950/60 p-2 rounded border border-cyan-800 text-[10px] font-mono text-cyan-200">
                    Sync: T0 Master Timeline
                  </div>
                </div>

              </div>

              {/* Last Pipeline Execution Log */}
              {lastPipelineResult && (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                    <span>Latest Pipeline Execution Result</span>
                    <span className="text-[10px] text-emerald-400 font-mono">STATUS: SUCCESS</span>
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                    <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 space-y-1">
                      <span className="text-slate-400 block text-[10px] font-semibold uppercase">Canonical Event Parsed</span>
                      <pre className="text-indigo-300 overflow-x-auto text-[11px]">
                        {JSON.stringify(lastPipelineResult.stageResults?.canonicalEvent, null, 2)}
                      </pre>
                    </div>

                    <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 space-y-1">
                      <span className="text-slate-400 block text-[10px] font-semibold uppercase">Semantic Equivalence Decision</span>
                      <pre className="text-amber-300 overflow-x-auto text-[11px]">
                        {JSON.stringify(lastPipelineResult.stageResults?.equivalenceResult, null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* TAB 2: TIMELINE HISTORY */}
          {activeTab === 'TIMELINE' && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-200">
                Session-Scoped Append-Only Versioned History Timeline
              </h3>
              <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-2">
                {timeline.map((item, idx) => (
                  <div key={idx} className="bg-slate-950 border border-slate-800 rounded-lg p-3 flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center gap-3">
                      <span className="bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-2 py-0.5 rounded font-bold">
                        {item.version}
                      </span>
                      <span className="text-slate-400">{item.time}</span>
                      <span className="text-white font-semibold">[{item.event?.actor || 'SYSTEM'}]:</span>
                      <span className="text-indigo-300">{item.event?.intent}</span>
                    </div>
                    <div className="text-slate-400 text-[11px]">
                      Context: {item.context} | Participants: {item.participantCount}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: PARTICIPANT ADAPTERS DEMO */}
          {activeTab === 'ADAPTERS' && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-200">
                Participant-Aware Output Adaptation Matrix (Generated from ONE Semantic Event)
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* Speech */}
                <div className="bg-slate-950 p-4 rounded-xl border border-blue-900/60 space-y-2">
                  <h4 className="text-xs font-bold text-blue-400">1. Speech Output Adapter</h4>
                  <p className="text-[11px] text-slate-400">Generates SSML synthesis payload</p>
                  <div className="bg-slate-900 p-2 rounded text-[11px] font-mono text-blue-200">
                    &lt;speak&gt;&lt;voice name="en-Standard-A"&gt;[USER_A]: Hello team&lt;/voice&gt;&lt;/speak&gt;
                  </div>
                </div>

                {/* 3D Sign Avatar */}
                <div className="bg-slate-950 p-4 rounded-xl border border-purple-900/60 space-y-2">
                  <h4 className="text-xs font-bold text-purple-400">2. 3D Sign Avatar Adapter</h4>
                  <p className="text-[11px] text-slate-400">Generates joint animation keyframes</p>
                  <div className="bg-slate-900 p-2 rounded text-[11px] font-mono text-purple-200">
                    Glosses: ["HELLO", "WELCOME", "MEETING"] | Model: SAMVAAD_3D_ISL_AVATAR_V2
                  </div>
                </div>

                {/* Braille */}
                <div className="bg-slate-950 p-4 rounded-xl border border-amber-900/60 space-y-2">
                  <h4 className="text-xs font-bold text-amber-400">3. Braille Codec Adapter</h4>
                  <p className="text-[11px] text-slate-400">Generates Unicode Braille pattern stream</p>
                  <div className="bg-slate-900 p-2 rounded text-base font-mono text-amber-300">
                    ⠁⠃⠉⠙⠑⠋⠛⠯ (Grade-1 Braille Cells)
                  </div>
                </div>

                {/* AAC Grid */}
                <div className="bg-slate-950 p-4 rounded-xl border border-emerald-900/60 space-y-2">
                  <h4 className="text-xs font-bold text-emerald-400">4. AAC Grid Symbol Adapter</h4>
                  <p className="text-[11px] text-slate-400">AAC Symbol Grid Cell Map</p>
                  <div className="bg-slate-900 p-2 rounded text-[11px] font-mono text-emerald-200">
                    Symbol ID: aac_icon_join | Row: 1, Col: 2
                  </div>
                </div>

                {/* Haptic */}
                <div className="bg-slate-950 p-4 rounded-xl border border-pink-900/60 space-y-2">
                  <h4 className="text-xs font-bold text-pink-400">5. Haptic Pulse Adapter</h4>
                  <p className="text-[11px] text-slate-400">Vibration pattern pulse sequence</p>
                  <div className="bg-slate-900 p-2 rounded text-[11px] font-mono text-pink-200">
                    Pattern: [100ms, 50ms, 100ms] | Device: WRIST_BAND
                  </div>
                </div>

                {/* Master Sync */}
                <div className="bg-slate-950 p-4 rounded-xl border border-cyan-900/60 space-y-2">
                  <h4 className="text-xs font-bold text-cyan-400">6. Master Timeline Sync (T0)</h4>
                  <p className="text-[11px] text-slate-400">Eliminates rendering latency skew</p>
                  <div className="bg-slate-900 p-2 rounded text-[11px] font-mono text-cyan-200">
                    Status: ALIGNED_AND_SYNCHRONIZED (Buffer: 150ms)
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* TAB 4: ARCHITECTURE OVERVIEW */}
          {activeTab === 'OVERVIEW' && (
            <div className="bg-indigo-950/50 border border-indigo-800 rounded-xl p-6 space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">💡</span>
                <div>
                  <h3 className="text-base font-bold text-white">
                    ARCHITECTURE OVERVIEW
                  </h3>
                  <p className="text-xs text-indigo-300">
                    Multimodal Semantic Orchestration Infrastructure
                  </p>
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 text-xs text-slate-300 leading-relaxed font-sans">
                {architectureDetails?.technicalSummary || (
                  "Multiple communication modalities are transformed into canonical semantic representations, semantically merged, atomically committed into a shared session-scoped semantic state, and rendered into participant-specific outputs without relay-based modality-to-modality translation."
                )}
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-slate-300">6 Core Pipeline Stages:</h4>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-400 font-mono">
                  <li className="bg-slate-950 p-2 rounded border border-slate-800">1. Unified Feature Encoders (Acoustic/Landmark/Language/Spatial)</li>
                  <li className="bg-slate-950 p-2 rounded border border-slate-800">2. Canonical Semantic Event Schema & Parsing</li>
                  <li className="bg-slate-950 p-2 rounded border border-slate-800">3. Sliding Temporal Window Meaning Deduplication</li>
                  <li className="bg-slate-950 p-2 rounded border border-slate-800">4. Shared Session State Atomic Commit & Timeline v1-&gt;v42</li>
                  <li className="bg-slate-950 p-2 rounded border border-slate-800">5. Participant-Aware Adapter Output Synthesis</li>
                  <li className="bg-slate-950 p-2 rounded border border-slate-800">6. Master Timeline T0 Synchronized Delivery</li>
                </ul>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="bg-slate-950 px-6 py-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>Samvaad AI • Multimodal Orchestration Infrastructure</span>
          <button
            onClick={onClose}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-lg font-semibold transition"
          >
            Close Inspector
          </button>
        </div>

      </div>
    </div>
  );
}
