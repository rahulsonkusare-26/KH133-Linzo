import React from 'react';

/**
 * MasterTimelineVisualizer
 * Renders real-time Master Timeline (T_0) latency & jitter buffer metrics per participant.
 */
export function MasterTimelineVisualizer({ metrics = [] }) {
  const defaultMetrics = metrics.length > 0 ? metrics : [
    { participantId: 'User 1 (Speech)', skewMs: +12, bufferUsage: 45, status: 'SYNCED' },
    { participantId: 'User 2 (Sign Avatar)', skewMs: -8, bufferUsage: 60, status: 'SYNCED' },
    { participantId: 'User 3 (Braille)', skewMs: +3, bufferUsage: 30, status: 'SYNCED' }
  ];

  return (
    <div className="bg-slate-900 border border-slate-700/60 rounded-xl p-4 text-xs font-mono text-slate-200">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
        <span className="font-bold text-sky-400 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          Master Timeline (T₀) Synchronizer
        </span>
        <span className="text-slate-400">Target Latency: 50ms</span>
      </div>

      <div className="space-y-3">
        {defaultMetrics.map((m, idx) => (
          <div key={idx} className="bg-slate-800/80 rounded-lg p-2.5">
            <div className="flex justify-between mb-1.5">
              <span className="font-medium text-slate-300">{m.participantId}</span>
              <span className={m.skewMs >= 0 ? 'text-emerald-400' : 'text-amber-400'}>
                Skew: {m.skewMs > 0 ? `+${m.skewMs}` : m.skewMs} ms
              </span>
            </div>
            <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden flex">
              <div
                className="bg-sky-400 h-full transition-all duration-300"
                style={{ width: `${Math.min(100, m.bufferUsage)}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>Jitter Buffer: {m.bufferUsage}%</span>
              <span className="text-emerald-400 font-semibold">{m.status}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
