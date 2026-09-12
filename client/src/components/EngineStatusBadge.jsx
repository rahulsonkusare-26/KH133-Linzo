import React from 'react';

/**
 * EngineStatusBadge
 * Floating status indicator component showing real-time Samvaad AI Semantic Engine health & active version.
 */
export function EngineStatusBadge({ status = 'ACTIVE', version = 42, fps = 60 }) {
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/90 border border-emerald-500/40 text-xs font-mono backdrop-blur-md shadow-lg">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
      </span>
      <span className="font-semibold text-emerald-400">Samvaad AI Engine v{version}</span>
      <span className="text-slate-500">|</span>
      <span className="text-slate-300">{status}</span>
      <span className="text-slate-500">|</span>
      <span className="text-sky-400">{fps} FPS</span>
    </div>
  );
}
