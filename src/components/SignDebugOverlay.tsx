import React, { useState } from 'react';
import { Bug, X } from 'lucide-react';
import { ExtractedFeatures, MatchResult } from '../lib/signRecognition/types';

export default function SignDebugOverlay({ 
  debugInfo 
}: { 
  debugInfo: { features: ExtractedFeatures | null, rawMatch: MatchResult | null } | null 
}) {
  const [isOpen, setIsOpen] = useState(false);

  if (!debugInfo) return null;
  const { features, rawMatch } = debugInfo;

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 left-4 z-50 bg-slate-900/80 text-white p-2 rounded-lg backdrop-blur-sm border border-slate-700 hover:bg-slate-800 shadow-xl"
      >
        <Bug size={18} />
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 z-[200] max-w-sm w-[90vw] bg-black/90 backdrop-blur-md border border-slate-700 rounded-xl shadow-2xl p-4 text-xs font-mono text-green-400 overflow-hidden flex flex-col gap-3">
      <div className="flex justify-between items-center text-white border-b border-slate-700 pb-2">
        <span className="font-bold uppercase tracking-wider flex items-center gap-2">
          <Bug size={14} className="text-blue-400" /> Vision Debug
        </span>
        <button onClick={() => setIsOpen(false)} className="hover:text-red-400 transition-colors">
          <X size={16} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[10px]">
        <div className="bg-slate-900 rounded p-2 border border-slate-800">
          <div className="text-slate-400 mb-1 font-bold">Primary Hand</div>
          {features ? (
            <>
              <div>Shape: <span className="text-white">{features.primaryHand.handShape}</span></div>
              <div>Loc: <span className="text-white">{features.primaryHand.relativeLocation}</span></div>
              <div>Dir: <span className="text-white">{features.primaryHand.motion.primaryDirection}</span></div>
              <div>Vel: <span className="text-white">{features.primaryHand.motion.averageVelocity.toFixed(2)}</span></div>
              <div>Rep: <span className="text-white">{features.primaryHand.motion.repetition}</span></div>
              <div>Fix: <span className="text-white">{features.primaryHand.motion.stability.toFixed(2)}</span></div>
            </>
          ) : <span>No hand</span>}
        </div>

        <div className="bg-slate-900 rounded p-2 border border-slate-800">
          <div className="text-slate-400 mb-1 font-bold">Multi-Hand</div>
          {features ? (
            <>
              <div>L: <span className={features.multiHand.leftHandPresent ? 'text-green-400' : 'text-slate-600'}>{features.multiHand.leftHandPresent ? 'Yes' : 'No'}</span> | R: <span className={features.multiHand.rightHandPresent ? 'text-green-400' : 'text-slate-600'}>{features.multiHand.rightHandPresent ? 'Yes' : 'No'}</span></div>
              <div>Active: <span className="text-white">{features.multiHand.activeHand}</span></div>
              {features.secondaryHand && (
                <>
                  <div>Sec Shape: <span className="text-white">{features.secondaryHand.handShape}</span></div>
                  <div>Symmetry: <span className="text-white">{features.multiHand.symmetry}</span></div>
                </>
              )}
            </>
          ) : <span>No structure</span>}
        </div>
      </div>

      <div className="bg-slate-900 rounded p-2 border border-slate-800 mt-1">
        <div className="text-slate-400 mb-1 font-bold">Heuristic Match</div>
        {rawMatch ? (
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-lg font-bold text-blue-400">{rawMatch.gloss}</span>
              <span className="text-sm">{(rawMatch.confidence * 100).toFixed(0)}%</span>
            </div>
            <div className="flex gap-1 text-[9px] flex-wrap">
              <span className="bg-blue-900/50 px-1 rounded text-blue-300">Shp: {(rawMatch.breakdown.handshape*100).toFixed(0)}</span>
              <span className="bg-blue-900/50 px-1 rounded text-blue-300">Loc: {(rawMatch.breakdown.location*100).toFixed(0)}</span>
              <span className="bg-blue-900/50 px-1 rounded text-blue-300">Mot: {(rawMatch.breakdown.motion*100).toFixed(0)}</span>
              <span className="bg-blue-900/50 px-1 rounded text-blue-300">Han: {(rawMatch.breakdown.handedness*100).toFixed(0)}</span>
              <span className="bg-blue-900/50 px-1 rounded text-blue-300">Sym: {(rawMatch.breakdown.multiHand*100).toFixed(0)}</span>
            </div>
          </div>
        ) : (
          <div className="text-yellow-600">Unstable / Comparing...</div>
        )}
      </div>

    </div>
  );
}
