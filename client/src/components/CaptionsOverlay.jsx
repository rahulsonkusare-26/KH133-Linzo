import React from 'react';

/**
 * CaptionsOverlay
 * Live subtitle overlay rendering speaker badge, high contrast background, and text captions.
 */
export function CaptionsOverlay({ speaker = 'Participant', text = '', modality = 'SPEECH' }) {
  if (!text) return null;

  return (
    <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-40 max-w-2xl w-full px-4 pointer-events-none">
      <div className="bg-slate-950/90 border border-slate-700/80 rounded-2xl p-4 shadow-2xl backdrop-blur-xl flex flex-col gap-1 text-center">
        <div className="flex items-center justify-center gap-2 text-xs font-semibold">
          <span className="text-sky-400 font-mono">{speaker}</span>
          <span className="text-slate-500">•</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
            {modality}
          </span>
        </div>
        <p className="text-lg font-medium text-white tracking-wide leading-relaxed">
          {text}
        </p>
      </div>
    </div>
  );
}
