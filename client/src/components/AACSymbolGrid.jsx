import React from 'react';

/**
 * AACSymbolGrid
 * AAC pictographic symbol grid allowing touch/click dispatching of canonical intents.
 */
export function AACSymbolGrid({ onSelectSymbol }) {
  const symbols = [
    { label: 'Hello', symbol: '👋', intent: 'GREETING' },
    { label: 'Yes', symbol: '👍', intent: 'AFFIRM' },
    { label: 'No', symbol: '👎', intent: 'NEGATE' },
    { label: 'Join', symbol: '🚪', intent: 'JOIN' },
    { label: 'Leave', symbol: '👋', intent: 'LEAVE' },
    { label: 'Help', symbol: '❓', intent: 'HELP' }
  ];

  return (
    <div className="bg-slate-900 border border-slate-700/80 rounded-xl p-3">
      <h4 className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
        AAC Quick Symbols
      </h4>
      <div className="grid grid-cols-3 gap-2">
        {symbols.map((item, idx) => (
          <button
            key={idx}
            onClick={() => onSelectSymbol && onSelectSymbol(item)}
            className="flex flex-col items-center justify-center p-2 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-95 transition-all text-slate-200 border border-slate-700/50"
          >
            <span className="text-xl">{item.symbol}</span>
            <span className="text-[10px] mt-1 font-medium">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
