import React, { useEffect, useState, useRef } from 'react'
import { Lightbulb, Hand, MapPin, ArrowRight, Users, Smile } from 'lucide-react'

interface SignPrimitives {
  direction: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'FORWARD' | 'CIRCULAR' | 'TAP' | 'HOLD' | 'NONE'
  repetition: 'SINGLE' | 'REPEAT'
  handshape: 'FLAT' | 'FIST' | 'POINT' | 'OPEN' | 'CURVED' | 'UNKNOWN'
  location: 'HEAD' | 'FACE' | 'CHIN' | 'CHEST' | 'TORSO' | 'NEUTRAL' | 'UNKNOWN'
  two_hands: boolean
  facial: boolean
  can_animate: boolean
}

interface SmartTipsOverlayProps {
  predictedGloss: string | null
  predictedConfidence: number
  primitives: SignPrimitives | null
  topMatches?: Array<{ gloss: string; confidence: number }>
  highContrast?: boolean
  visible?: boolean
}

// Human-readable tip generators
export function getHandshapeTip(shape: SignPrimitives['handshape']): string | null {
  const map: Record<string, string> = {
    FLAT:    'Hold your hand flat, palm facing forward',
    FIST:    'Make a fist with your hand',
    POINT:   'Extend your index finger outward',
    OPEN:    'Spread all fingers apart, palm open',
    CURVED:  'Cup your hand as if holding a ball',
    UNKNOWN: '',
  }
  return map[shape] || null
}

export function getLocationTip(loc: SignPrimitives['location']): string | null {
  const map: Record<string, string> = {
    HEAD:    'Raise your hand to head height',
    FACE:    'Hold your hand near your face',
    CHIN:    'Bring your hand to chin level',
    CHEST:   'Place your hand at chest level',
    TORSO:   'Hold your hand at torso level',
    NEUTRAL: 'Hold your hand in neutral space in front of you',
    UNKNOWN: '',
  }
  return map[loc] || null
}

export function getDirectionTip(dir: SignPrimitives['direction']): string | null {
  const map: Record<string, string> = {
    UP:       'Move your hand upward',
    DOWN:     'Move your hand downward',
    LEFT:     'Move your hand to the left',
    RIGHT:    'Move your hand to the right',
    FORWARD:  'Push your hand forward',
    CIRCULAR: 'Make a smooth circular motion',
    TAP:      'Tap gently and briefly',
    HOLD:     'Hold the position still',
    NONE:     '',
  }
  return map[dir] || null
}

export function getRepetitionTip(rep: SignPrimitives['repetition']): string | null {
  return rep === 'REPEAT' ? 'Repeat the movement twice' : null
}

interface TipItem {
  icon: React.ReactNode
  text: string
  color: string
}

function buildTips(primitives: SignPrimitives | null): TipItem[] {
  if (!primitives) return []
  const tips: TipItem[] = []

  const shapeTip = getHandshapeTip(primitives.handshape)
  if (shapeTip) tips.push({ icon: <Hand size={14} />, text: shapeTip, color: 'from-violet-500 to-purple-500' })

  const locTip = getLocationTip(primitives.location)
  if (locTip) tips.push({ icon: <MapPin size={14} />, text: locTip, color: 'from-blue-500 to-cyan-500' })

  const dirTip = getDirectionTip(primitives.direction)
  if (dirTip) tips.push({ icon: <ArrowRight size={14} />, text: dirTip, color: 'from-emerald-500 to-teal-500' })

  const repTip = getRepetitionTip(primitives.repetition)
  if (repTip) tips.push({ icon: <ArrowRight size={14} />, text: repTip, color: 'from-amber-500 to-orange-500' })

  if (primitives.two_hands) tips.push({ icon: <Users size={14} />, text: 'Use both hands together', color: 'from-rose-500 to-pink-500' })
  if (primitives.facial) tips.push({ icon: <Smile size={14} />, text: 'Add a facial expression', color: 'from-amber-400 to-yellow-500' })

  return tips
}

const SmartTipsOverlay: React.FC<SmartTipsOverlayProps> = ({
  predictedGloss,
  predictedConfidence,
  primitives,
  topMatches = [],
  highContrast = false,
  visible = true,
}) => {
  const [show, setShow] = useState(false)
  const [animateIn, setAnimateIn] = useState(false)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevGloss = useRef<string | null>(null)

  useEffect(() => {
    if (!visible || !predictedGloss || predictedConfidence < 0.35) {
      setAnimateIn(false)
      setTimeout(() => setShow(false), 350)
      return
    }

    if (predictedGloss !== prevGloss.current) {
      prevGloss.current = predictedGloss
      setShow(true)
      // Trigger animation on next tick
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setAnimateIn(true))
      })
    }

    // Auto-dismiss after 6s of same gloss
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => {
      setAnimateIn(false)
      setTimeout(() => setShow(false), 350)
    }, 6000)

    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current)
    }
  }, [predictedGloss, predictedConfidence, visible])

  if (!show) return null

  const tips = buildTips(primitives)
  const pct = Math.round(predictedConfidence * 100)
  const confColor = predictedConfidence >= 0.7 ? '#10b981' : predictedConfidence >= 0.45 ? '#f59e0b' : '#f43f5e'

  if (highContrast) {
    return (
      <div
        className="absolute bottom-0 left-0 right-0 z-30 p-4"
        style={{
          transition: 'opacity 0.35s, transform 0.35s',
          opacity: animateIn ? 1 : 0,
          transform: animateIn ? 'translateY(0)' : 'translateY(20px)',
        }}
      >
        <div className="bg-black border-2 border-yellow-400 rounded-2xl p-4 space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb size={16} className="text-yellow-400" />
            <span className="text-yellow-400 font-black text-sm uppercase tracking-wider">Smart Tips</span>
            <span className="ml-auto text-yellow-300 font-bold text-sm">{predictedGloss} — {pct}%</span>
          </div>
          {tips.length === 0 && (
            <p className="text-yellow-200 text-sm">Keep signing — tips will appear when the sign is recognised.</p>
          )}
          {tips.map((t, i) => (
            <div key={i} className="flex items-start gap-2 text-yellow-200 text-sm">
              <span className="text-yellow-400 mt-0.5">{t.icon}</span>
              <span>{t.text}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-30 p-4"
      style={{
        transition: 'opacity 0.35s cubic-bezier(0.4,0,0.2,1), transform 0.35s cubic-bezier(0.4,0,0.2,1)',
        opacity: animateIn ? 1 : 0,
        transform: animateIn ? 'translateY(0)' : 'translateY(24px)',
      }}
    >
      {/* Backdrop blur card */}
      <div
        className="rounded-2xl overflow-hidden shadow-2xl"
        style={{
          background: 'rgba(10, 10, 30, 0.82)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.10)',
        }}
      >
        {/* Header bar */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/10">
          <div className="flex items-center gap-1.5 text-amber-400">
            <Lightbulb size={14} className="animate-pulse" />
            <span className="text-[11px] font-black uppercase tracking-widest text-amber-400">Smart Tips</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-white font-bold text-sm">{predictedGloss}</span>
            <span
              className="text-[11px] font-black px-2 py-0.5 rounded-full"
              style={{ color: confColor, background: `${confColor}22`, border: `1px solid ${confColor}55` }}
            >
              {pct}%
            </span>
          </div>
        </div>

        {/* Tip pills */}
        <div className="px-4 py-3 flex flex-wrap gap-2">
          {tips.length === 0 ? (
            <p className="text-slate-400 text-xs italic w-full text-center py-1">
              Detecting hand shape… keep signing
            </p>
          ) : (
            tips.map((tip, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white text-xs font-semibold"
                style={{
                  background: `linear-gradient(135deg, var(--tw-gradient-from), var(--tw-gradient-to))`,
                  animationDelay: `${i * 60}ms`,
                  opacity: animateIn ? 1 : 0,
                  transition: `opacity 0.3s ${i * 60}ms`,
                }}
              >
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white text-xs font-semibold bg-gradient-to-r ${tip.color}`}
                >
                  {tip.icon}
                  {tip.text}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Top matches mini bar */}
        {topMatches.length > 1 && (
          <div className="px-4 pb-3 flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider shrink-0">Also:</span>
            {topMatches.slice(1, 3).map((m, i) => (
              <span
                key={i}
                className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-white/10 text-slate-300"
              >
                {m.gloss} {Math.round(m.confidence * 100)}%
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default SmartTipsOverlay
