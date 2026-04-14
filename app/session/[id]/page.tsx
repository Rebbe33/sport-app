'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ChevronRight, X, SkipForward, Pause, Play, CheckCircle } from 'lucide-react'
import { getSessions, getSessionPoses, getSessionExercises, getRun, markSessionDone } from '@/lib/db'
import type { SportSession, SportYogaPose, SportRun } from '@/types'

// ── Sound helpers ──────────────────────────────────────────
function beep(freq = 880, duration = 120, volume = 0.3) {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = freq
    gain.gain.setValueAtTime(volume, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration / 1000)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + duration / 1000)
  } catch {}
}

function vibrate(pattern: number | number[]) {
  try { navigator.vibrate?.(pattern) } catch {}
}

function alertTransition() {
  beep(660, 150)
  setTimeout(() => beep(880, 200), 180)
  vibrate([100, 50, 100])
}

function alertDone() {
  beep(523, 200)
  setTimeout(() => beep(659, 200), 220)
  setTimeout(() => beep(784, 400), 440)
  vibrate([100, 50, 100, 50, 200])
}

// ── Helpers ────────────────────────────────────────────────
function formatTime(s: number) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${String(sec).padStart(2, '0')}`
}

// ── Types internes ─────────────────────────────────────────
interface Step {
  label: string
  sublabel?: string
  duration?: number // secondes, undefined = manuel
  isRest?: boolean
}

function buildSteps(
  type: string,
  poses: SportYogaPose[],
  exercises: { name: string; sets: number; reps: number; weight_kg?: number }[],
  run: SportRun | null
): Step[] {
  if (type === 'yoga') {
    const steps: Step[] = [{ label: 'Échauffement', sublabel: 'Respirations profondes', duration: 60 }]
    for (const p of poses) {
      steps.push({ label: p.name, sublabel: `Maintenir la posture`, duration: p.duration_seconds })
      steps.push({ label: 'Transition', sublabel: 'Respire, prépare la suivante', duration: 15, isRest: true })
    }
    steps.push({ label: 'Savasana', sublabel: 'Relaxation finale', duration: 120 })
    return steps
  }

  if (type === 'muscu') {
    const steps: Step[] = [{ label: 'Échauffement', sublabel: '5 min de mobilité articulaire', duration: 300 }]
    for (const ex of exercises) {
      for (let s = 1; s <= ex.sets; s++) {
        steps.push({
          label: ex.name,
          sublabel: `Série ${s}/${ex.sets} · ${ex.reps} reps${ex.weight_kg ? ` · ${ex.weight_kg} kg` : ''}`,
          duration: undefined, // manuel — appuyer pour valider
        })
        if (s < ex.sets) {
          steps.push({ label: 'Repos', sublabel: 'Récupération entre séries', duration: 60, isRest: true })
        }
      }
      steps.push({ label: 'Repos', sublabel: 'Récupération avant prochain exercice', duration: 90, isRest: true })
    }
    return steps
  }

  if (type === 'cardio') {
    const steps: Step[] = [
      { label: 'Échauffement', sublabel: 'Marche rapide 5 min', duration: 300 },
      {
        label: 'Course',
        sublabel: run ? `Objectif : ${run.distance_km} km` : 'Lance-toi !',
        duration: run ? run.duration_seconds : undefined,
      },
      { label: 'Récupération', sublabel: 'Marche douce 3 min', duration: 180 },
      { label: 'Étirements', sublabel: 'Mollets, quadriceps, hanches', duration: 180 },
    ]
    return steps
  }

  return [{ label: 'Séance', sublabel: 'C\'est parti !', duration: undefined }]
}

// ── Circular progress ──────────────────────────────────────
function CircleTimer({ progress, color, size = 240, children }: {
  progress: number; color: string; size?: number; children: React.ReactNode
}) {
  const r = (size - 16) / 2
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - Math.max(0, Math.min(1, progress)))
  return (
    <div style={{ position: 'relative', width: size, height: size, margin: '0 auto' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', position: 'absolute', top: 0, left: 0 }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface2)" strokeWidth={8} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={8}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.5s linear' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        {children}
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────
export default function SessionPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()

  const [session, setSession] = useState<SportSession | null>(null)
  const [steps, setSteps] = useState<Step[]>([])
  const [stepIdx, setStepIdx] = useState(0)
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const [totalElapsed, setTotalElapsed] = useState(0)
  const [paused, setPaused] = useState(false)
  const [finished, setFinished] = useState(false)
  const [started, setStarted] = useState(false)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Load session data ────────────────────────────────────
  useEffect(() => {
    async function load() {
      const all = await getSessions(100)
      const s = all.find(x => x.id === id)
      if (!s) return
      setSession(s)

      let poses: SportYogaPose[] = []
      let exercises: { name: string; sets: number; reps: number; weight_kg?: number }[] = []
      let run: SportRun | null = null

      if (s.type === 'yoga') poses = await getSessionPoses(id)
      if (s.type === 'muscu') {
        const exs = await getSessionExercises(id)
        exercises = exs.map(e => ({ name: e.exercise.name, sets: e.sets, reps: e.reps, weight_kg: e.weight_kg }))
      }
      if (s.type === 'cardio') run = await getRun(id)

      const built = buildSteps(s.type, poses, exercises, run)
      setSteps(built)
      setTimeLeft(built[0]?.duration ?? null)
    }
    load()
  }, [id])

  // ── Elapsed global timer ──────────────────────────────────
  useEffect(() => {
    if (!started || finished || paused) return
    elapsedRef.current = setInterval(() => setTotalElapsed(t => t + 1), 1000)
    return () => { if (elapsedRef.current) clearInterval(elapsedRef.current) }
  }, [started, finished, paused])

  // ── Step timer ────────────────────────────────────────────
  const goNext = useCallback(() => {
    setStepIdx(prev => {
      const next = prev + 1
      if (next >= steps.length) {
        setFinished(true)
        alertDone()
        if (timerRef.current) clearInterval(timerRef.current)
        if (elapsedRef.current) clearInterval(elapsedRef.current)
        return prev
      }
      alertTransition()
      setTimeLeft(steps[next]?.duration ?? null)
      return next
    })
  }, [steps])

  useEffect(() => {
    if (!started || paused || finished) return
    if (timeLeft === null) return // étape manuelle

    if (timeLeft <= 0) {
      goNext()
      return
    }

    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t === null) return null
        if (t <= 1) { clearInterval(timerRef.current!); return 0 }
        return t - 1
      })
    }, 1000)

    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [started, paused, finished, stepIdx, goNext]) // eslint-disable-line

  const handlePause = () => {
    setPaused(p => {
      if (!p) {
        if (timerRef.current) clearInterval(timerRef.current)
        if (elapsedRef.current) clearInterval(elapsedRef.current)
      }
      return !p
    })
  }

  const handleSkip = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    goNext()
  }

  const handleFinish = async () => {
    if (session) await markSessionDone(session.id)
    router.push('/')
  }

  if (!session || steps.length === 0) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-3)' }}>Chargement…</p>
      </div>
    )
  }

  const COLORS: Record<string, string> = { yoga: 'var(--yoga)', muscu: 'var(--muscu)', cardio: 'var(--cardio)' }
  const color = COLORS[session.type] || 'var(--text)'
  const currentStep = steps[stepIdx]
  const stepDuration = currentStep?.duration ?? null
  const progress = stepDuration && timeLeft !== null ? timeLeft / stepDuration : 1

  // ── Écran de départ ───────────────────────────────────────
  if (!started) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', background: 'var(--bg)' }}>
        <div style={{ width: 80, height: 80, borderRadius: 24, background: color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24, fontSize: 36 }}>
          {session.type === 'yoga' ? '🧘' : session.type === 'muscu' ? '💪' : '🏃'}
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, textAlign: 'center', marginBottom: 8 }}>
          {session.type === 'yoga' ? 'Yoga' : session.type === 'muscu' ? 'Muscu / HIIT' : 'Course à pied'}
        </h1>
        <p style={{ color: 'var(--text-2)', marginBottom: 8, textAlign: 'center' }}>
          {steps.length} étapes · ~{session.duration_minutes} min
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: '20px 0 32px', width: '100%', maxWidth: 340 }}>
          {steps.slice(0, 5).map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', background: s.isRest ? 'var(--surface2)' : 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: s.isRest ? 'var(--text-3)' : color, flexShrink: 0 }} />
              <p style={{ fontSize: 13, color: s.isRest ? 'var(--text-3)' : 'var(--text)', flex: 1 }}>{s.label}</p>
              {s.duration && <p style={{ fontSize: 12, color: 'var(--text-3)' }}>{formatTime(s.duration)}</p>}
            </div>
          ))}
          {steps.length > 5 && (
            <p style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center' }}>+ {steps.length - 5} étapes</p>
          )}
        </div>
        <button
          className="btn-primary"
          style={{ background: color, maxWidth: 340, width: '100%' }}
          onClick={() => setStarted(true)}
        >
          C'est parti ! 🚀
        </button>
        <button onClick={() => router.back()} style={{ marginTop: 14, color: 'var(--text-3)', fontSize: 14 }}>
          Annuler
        </button>
      </div>
    )
  }

  // ── Écran de fin ──────────────────────────────────────────
  if (finished) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', background: 'var(--bg)' }}>
        <div style={{ fontSize: 72, marginBottom: 20 }}>🏆</div>
        <h1 style={{ fontSize: 30, fontWeight: 800, textAlign: 'center' }}>Séance terminée !</h1>
        <p style={{ color: 'var(--text-2)', marginTop: 8, marginBottom: 32, textAlign: 'center' }}>
          {formatTime(totalElapsed)} au total · Bravo ! 💪
        </p>
        <button className="btn-primary" style={{ background: color, maxWidth: 340, width: '100%' }} onClick={handleFinish}>
          <CheckCircle size={16} style={{ display: 'inline', marginRight: 6 }} />
          Valider et retourner au planning
        </button>
      </div>
    )
  }

  // ── Écran de séance ───────────────────────────────────────
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', padding: '0 20px' }}>

      {/* Header */}
      <div style={{ paddingTop: 'max(48px, env(safe-area-inset-top))', paddingBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={() => { if (confirm('Abandonner la séance ?')) router.back() }} style={{ color: 'var(--text-3)', padding: 4 }}>
          <X size={22} />
        </button>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-3)' }}>
            Étape {stepIdx + 1} / {steps.length}
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{formatTime(totalElapsed)} écoulé</p>
        </div>
        <button onClick={handleSkip} style={{ color: 'var(--text-3)', padding: 4 }}>
          <SkipForward size={22} />
        </button>
      </div>

      {/* Progress bar */}
      <div style={{ height: 4, background: 'var(--surface2)', borderRadius: 99, marginBottom: 32, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${((stepIdx) / steps.length) * 100}%`, background: color, borderRadius: 99, transition: 'width 0.4s ease' }} />
      </div>

      {/* Timer circle */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 32 }}>
        <CircleTimer progress={progress} color={currentStep.isRest ? 'var(--text-3)' : color}>
          {timeLeft !== null ? (
            <>
              <p style={{ fontSize: 52, fontWeight: 800, fontFamily: 'var(--font-display)', lineHeight: 1, color: currentStep.isRest ? 'var(--text-3)' : color }}>
                {formatTime(timeLeft)}
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
                {paused ? 'En pause' : 'restant'}
              </p>
            </>
          ) : (
            <>
              <p style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-display)', color, textAlign: 'center', padding: '0 24px' }}>
                À ton rythme
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>appuie pour valider</p>
            </>
          )}
        </CircleTimer>

        {/* Step info */}
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: 26, fontWeight: 800, color: currentStep.isRest ? 'var(--text-2)' : 'var(--text)' }}>
            {currentStep.label}
          </h2>
          {currentStep.sublabel && (
            <p style={{ fontSize: 15, color: 'var(--text-2)', marginTop: 6 }}>{currentStep.sublabel}</p>
          )}
        </div>

        {/* Prochaine étape */}
        {stepIdx + 1 < steps.length && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
            <p style={{ fontSize: 12, color: 'var(--text-3)' }}>Ensuite :</p>
            <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-2)' }}>{steps[stepIdx + 1].label}</p>
            {steps[stepIdx + 1].duration && (
              <p style={{ fontSize: 12, color: 'var(--text-3)', marginLeft: 4 }}>· {formatTime(steps[stepIdx + 1].duration!)}</p>
            )}
            <ChevronRight size={14} color="var(--text-3)" />
          </div>
        )}
      </div>

      {/* Contrôles */}
      <div style={{ paddingBottom: 'max(32px, env(safe-area-inset-bottom))', display: 'flex', gap: 12 }}>
        <button
          onClick={handlePause}
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15 }}
        >
          {paused ? <><Play size={18} /> Reprendre</> : <><Pause size={18} /> Pause</>}
        </button>
        {timeLeft === null && (
          <button
            onClick={goNext}
            style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '16px', background: color, border: 'none', borderRadius: 16, color: 'white', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15 }}
          >
            <CheckCircle size={18} /> Série validée
          </button>
        )}
      </div>
    </div>
  )
}
