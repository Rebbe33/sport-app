'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ChevronRight, X, SkipForward, Pause, Play, CheckCircle, Volume2, VolumeX, Info } from 'lucide-react'
import { getSessions, getSessionPoses, getSessionExercises, getRun, markSessionDone } from '@/lib/db'
import type { SportSession, SportYogaPose, SportRun } from '@/types'

// ── Sound ──────────────────────────────────────────────────
function beep(freq = 880, duration = 120, volume = 0.8) {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    if (ctx.state === 'suspended') ctx.resume()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'square'
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

// ── Voice ──────────────────────────────────────────────────
function speak(text: string, enabled: boolean) {
  if (!enabled) return
  try {
    window.speechSynthesis.cancel()
    const utt = new SpeechSynthesisUtterance(text)
    utt.lang = 'fr-FR'
    utt.rate = 0.95
    utt.pitch = 1.05
    utt.volume = 1
    const voices = window.speechSynthesis.getVoices()
    const fr = voices.find(v => v.lang.startsWith('fr'))
    if (fr) utt.voice = fr
    window.speechSynthesis.speak(utt)
  } catch {}
}

// ── Wikipedia ──────────────────────────────────────────────
async function fetchExerciseInfo(name: string): Promise<{ extract: string; image?: string } | null> {
  try {
    const frUrl = `https://fr.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`
    const frRes = await fetch(frUrl)
    if (frRes.ok) {
      const d = await frRes.json()
      if (d.extract) return { extract: d.extract, image: d.thumbnail?.source }
    }
    const enUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`
    const enRes = await fetch(enUrl)
    if (enRes.ok) {
      const d = await enRes.json()
      if (d.extract) return { extract: d.extract, image: d.thumbnail?.source }
    }
    return null
  } catch { return null }
}

// ── Helpers ────────────────────────────────────────────────
function formatTime(s: number) {
  const m = Math.floor(Math.abs(s) / 60)
  const sec = Math.abs(s) % 60
  return `${m}:${String(sec).padStart(2, '0')}`
}

interface Step {
  label: string
  sublabel?: string
  duration?: number
  isRest?: boolean
}

function buildStepSpeech(step: Step): string {
  if (step.isRest) return `Repos. ${step.duration ? `${step.duration} secondes.` : ''} Récupère.`
  return [step.label, step.sublabel, step.duration ? `${step.duration} secondes.` : ''].filter(Boolean).join('. ')
}

function buildSteps(
  type: string,
  poses: SportYogaPose[],
  exercises: { name: string; sets: number; reps: number; weight_kg?: number }[],
  run: SportRun | null,
  notes: string = ''
): Step[] {
  if (type === 'yoga') {
    const steps: Step[] = [{ label: 'Échauffement', sublabel: 'Respirations profondes', duration: 60 }]
    for (const p of poses) {
      steps.push({ label: p.name, sublabel: 'Maintenir la posture', duration: p.duration_seconds })
      steps.push({ label: 'Transition', sublabel: 'Respire, prépare la suivante', duration: 15, isRest: true })
    }
    steps.push({ label: 'Savasana', sublabel: 'Relaxation finale', duration: 120 })
    return steps
  }

  if (type === 'muscu') {
    const steps: Step[] = [{ label: 'Échauffement', sublabel: '5 min de mobilité articulaire', duration: 300 }]
    const maxSets = Math.max(...exercises.map(ex => ex.sets), 1)
    for (let s = 1; s <= maxSets; s++) {
      for (const ex of exercises) {
        if (s > ex.sets) continue
        steps.push({
          label: ex.name,
          sublabel: `Série ${s} sur ${ex.sets} · ${ex.reps} répétitions${ex.weight_kg ? ` · ${ex.weight_kg} kg` : ''}`,
          duration: undefined,
        })
      }
      if (s < maxSets) steps.push({ label: 'Repos', sublabel: 'Récupération entre les tours', duration: 90, isRest: true })
    }
    return steps
  }

  if (type === 'cardio') {
    const steps: Step[] = [{ label: 'Échauffement', sublabel: 'Marche rapide', duration: 300 }]
    const totalSeconds = run ? run.duration_seconds : 0
    const isContinue = notes.toLowerCase().includes('continu')
    const fractMatch = notes.match(/(\d+)(s?)\s*:\s*(\d+)(s?)/i)

    if (!isContinue && fractMatch) {
      const val1 = parseInt(fractMatch[1])
      const unit1 = fractMatch[2].toLowerCase() === 's' ? 1 : 60
      const val2 = parseInt(fractMatch[3])
      const unit2 = fractMatch[4].toLowerCase() === 's' ? 1 : 60
      const runSec = val1 * unit1
      const walkSec = val2 * unit2
      const cycles = totalSeconds > 0 ? Math.round(totalSeconds / (runSec + walkSec)) : 10
      for (let i = 1; i <= cycles; i++) {
        steps.push({ label: '🏃 Course', sublabel: `Cycle ${i}/${cycles} — cours !`, duration: runSec })
        if (i < cycles) steps.push({ label: '🚶 Marche', sublabel: `Cycle ${i}/${cycles} — récupère`, duration: walkSec, isRest: true })
      }
    } else {
      steps.push({
        label: '🏃 Course',
        sublabel: run ? `${run.distance_km > 0 ? run.distance_km + ' km · ' : ''}${Math.floor(totalSeconds / 60)} min` : 'Lance-toi !',
        duration: totalSeconds || undefined,
      })
    }
    steps.push({ label: 'Récupération', sublabel: 'Marche douce', duration: 180 })
    steps.push({ label: 'Étirements', sublabel: 'Mollets, quadriceps, hanches', duration: 180 })
    return steps
  }

  return [{ label: 'Séance', sublabel: "C'est parti !", duration: undefined }]
}

// ── Circle timer ───────────────────────────────────────────
function CircleTimer({ progress, color, size = 240, children }: {
  progress: number; color: string; size?: number; children: React.ReactNode
}) {
  const r = (size - 16) / 2
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - Math.max(0, Math.min(1, progress)))
  return (
    <div style={{ position: 'relative', width: size, height: size, margin: '0 auto' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', position: 'absolute', top: 0, left: 0 }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--surface2)" strokeWidth={8} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={8}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.9s linear' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        {children}
      </div>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────
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
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [guideInfo, setGuideInfo] = useState<{ label: string; extract: string; image?: string } | null>(null)
  const [guideLoading, setGuideLoading] = useState(false)

  const stepsRef = useRef<Step[]>([])
  const stepIdxRef = useRef(0)
  const pausedRef = useRef(false)
  const finishedRef = useRef(false)
  const voiceRef = useRef(true)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeLeftRef = useRef<number | null>(null)
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)

  useEffect(() => { stepsRef.current = steps }, [steps])
  useEffect(() => { stepIdxRef.current = stepIdx }, [stepIdx])
  useEffect(() => { pausedRef.current = paused }, [paused])
  useEffect(() => { finishedRef.current = finished }, [finished])
  useEffect(() => { voiceRef.current = voiceEnabled }, [voiceEnabled])

  // ── Load ──────────────────────────────────────────────────
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
      const built = buildSteps(s.type, poses, exercises, run, s.notes || '')
      setSteps(built)
      stepsRef.current = built
      timeLeftRef.current = built[0]?.duration ?? null
      setTimeLeft(built[0]?.duration ?? null)
    }
    load()
  }, [id])

  // ── Wake lock ─────────────────────────────────────────────
  useEffect(() => {
    if (!started || finished) return
    async function requestWakeLock() {
      try {
        if ('wakeLock' in navigator) {
          wakeLockRef.current = await (navigator as unknown as { wakeLock: { request: (t: string) => Promise<WakeLockSentinel> } }).wakeLock.request('screen')
        }
      } catch {}
    }
    requestWakeLock()
    const handleVisibility = () => { if (document.visibilityState === 'visible') requestWakeLock() }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      wakeLockRef.current?.release().catch(() => {})
    }
  }, [started, finished])

  // ── goNext ────────────────────────────────────────────────
  const goNext = useCallback(() => {
    const nextIdx = stepIdxRef.current + 1
    const allSteps = stepsRef.current
    if (nextIdx >= allSteps.length) {
      finishedRef.current = true
      setFinished(true)
      alertDone()
      speak('Bravo ! Séance terminée !', voiceRef.current)
      if (tickRef.current) clearInterval(tickRef.current)
      return
    }
    alertTransition()
    const nextStep = allSteps[nextIdx]
    speak(buildStepSpeech(nextStep), voiceRef.current)
    stepIdxRef.current = nextIdx
    setStepIdx(nextIdx)
    const nextDuration = nextStep.duration ?? null
    timeLeftRef.current = nextDuration
    setTimeLeft(nextDuration)
  }, [])

  // ── Tick global ───────────────────────────────────────────
  useEffect(() => {
    if (!started) return
    if (tickRef.current) clearInterval(tickRef.current)
    tickRef.current = setInterval(() => {
      if (pausedRef.current || finishedRef.current) return
      setTotalElapsed(t => t + 1)
      if (timeLeftRef.current === null) return
      const next = timeLeftRef.current - 1
      timeLeftRef.current = next
      setTimeLeft(next)
      if (next <= 0) { timeLeftRef.current = 0; goNext() }
    }, 1000)
    return () => { if (tickRef.current) clearInterval(tickRef.current) }
  }, [started, goNext])

  // ── Announce first step ───────────────────────────────────
  useEffect(() => {
    if (started && steps.length > 0) {
      setTimeout(() => speak(buildStepSpeech(steps[0]), voiceRef.current), 500)
    }
  }, [started]) // eslint-disable-line

  const handlePause = () => {
    const next = !pausedRef.current
    pausedRef.current = next
    setPaused(next)
    if (!next && steps[stepIdxRef.current]) speak(buildStepSpeech(steps[stepIdxRef.current]), voiceRef.current)
  }

  const handleSkip = () => { goNext() }

  const toggleVoice = () => {
    const next = !voiceRef.current
    voiceRef.current = next
    setVoiceEnabled(next)
    if (!next) try { window.speechSynthesis.cancel() } catch {}
  }

  const handleShowGuide = async (label: string) => {
    setGuideInfo({ label, extract: '', image: undefined })
    setGuideLoading(true)
    const info = await fetchExerciseInfo(label)
    setGuideInfo({
      label,
      extract: info?.extract || `Aucune description trouvée. Recherche "${label}" sur YouTube pour voir la technique.`,
      image: info?.image,
    })
    setGuideLoading(false)
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
        <div style={{ fontSize: 64, marginBottom: 20 }}>
          {session.type === 'yoga' ? '🧘' : session.type === 'muscu' ? '💪' : '🏃'}
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, textAlign: 'center', marginBottom: 8 }}>
          {session.type === 'yoga' ? 'Yoga' : session.type === 'muscu' ? 'Muscu / HIIT' : 'Course à pied'}
        </h1>
        <p style={{ color: 'var(--text-2)', marginBottom: 8, textAlign: 'center' }}>
          {steps.length} étapes · ~{session.duration_minutes} min
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: '20px 0 24px', width: '100%', maxWidth: 340 }}>
          {steps.slice(0, 5).map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', background: s.isRest ? 'var(--surface2)' : 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: s.isRest ? 'var(--text-3)' : color, flexShrink: 0 }} />
              <p style={{ fontSize: 13, color: s.isRest ? 'var(--text-3)' : 'var(--text)', flex: 1 }}>{s.label}</p>
              {s.duration && <p style={{ fontSize: 12, color: 'var(--text-3)' }}>{formatTime(s.duration)}</p>}
            </div>
          ))}
          {steps.length > 5 && <p style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center' }}>+ {steps.length - 5} étapes</p>}
        </div>
        <button
          onClick={toggleVoice}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: voiceEnabled ? color + '18' : 'var(--surface2)', border: `1px solid ${voiceEnabled ? color + '44' : 'var(--border)'}`, borderRadius: 12, marginBottom: 20, color: voiceEnabled ? color : 'var(--text-3)', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14 }}
        >
          {voiceEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          Guidage vocal {voiceEnabled ? 'activé' : 'désactivé'}
        </button>
        <button className="btn-primary" style={{ background: color, maxWidth: 340, width: '100%' }} onClick={() => setStarted(true)}>
          C'est parti ! 🚀
        </button>
        <button onClick={() => router.back()} style={{ marginTop: 14, color: 'var(--text-3)', fontSize: 14 }}>Annuler</button>
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

  // ── Écran séance ──────────────────────────────────────────
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
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={toggleVoice} style={{ color: voiceEnabled ? color : 'var(--text-3)', padding: 4 }}>
            {voiceEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </button>
          <button onClick={handleSkip} style={{ color: 'var(--text-3)', padding: 4 }}>
            <SkipForward size={22} />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 4, background: 'var(--surface2)', borderRadius: 99, marginBottom: 32, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${(stepIdx / steps.length) * 100}%`, background: color, borderRadius: 99, transition: 'width 0.4s ease' }} />
      </div>

      {/* Timer + content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28 }}>
        <CircleTimer progress={progress} color={currentStep.isRest ? 'var(--text-3)' : color}>
          {timeLeft !== null ? (
            <>
              <p style={{ fontSize: 52, fontWeight: 800, fontFamily: 'var(--font-display)', lineHeight: 1, color: currentStep.isRest ? 'var(--text-3)' : color }}>
                {formatTime(timeLeft)}
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
                {paused ? '⏸ pause' : 'restant'}
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

        {/* Step label */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <h2 style={{ fontSize: 26, fontWeight: 800, color: currentStep.isRest ? 'var(--text-2)' : 'var(--text)' }}>
              {currentStep.label}
            </h2>
            {session.type === 'muscu' && !currentStep.isRest && (
              <button
                onClick={() => handleShowGuide(currentStep.label)}
                style={{ width: 28, height: 28, borderRadius: '50%', background: color + '22', border: `1px solid ${color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}
              >
                <Info size={14} />
              </button>
            )}
          </div>
          {currentStep.sublabel && (
            <p style={{ fontSize: 15, color: 'var(--text-2)', marginTop: 6 }}>{currentStep.sublabel}</p>
          )}
        </div>

        {/* Next step */}
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

      {/* Controls */}
      <div style={{ paddingBottom: 'calc(var(--nav-h) + var(--safe-bottom) + 16px)', display: 'flex', gap: 12 }}>
        <button
          onClick={handlePause}
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}
        >
          {paused ? <><Play size={18} /> Reprendre</> : <><Pause size={18} /> Pause</>}
        </button>
        {timeLeft === null && (
          <button
            onClick={goNext}
            style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '16px', background: color, border: 'none', borderRadius: 16, color: 'white', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}
          >
            <CheckCircle size={18} /> Série validée
          </button>
        )}
      </div>

      {/* Guide modal */}
      {guideInfo !== null && (
        <div
          onClick={() => setGuideInfo(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', maxHeight: '75vh', overflowY: 'auto' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 20, fontWeight: 800, color }}>{guideInfo.label}</h3>
              <button onClick={() => setGuideInfo(null)} style={{ color: 'var(--text-3)' }}><X size={20} /></button>
            </div>
            {guideLoading ? (
              <p style={{ color: 'var(--text-3)', textAlign: 'center', padding: '20px 0' }}>Chargement…</p>
            ) : (
              <>
                {guideInfo.image != null && (
                  <img
                    src={guideInfo.image}
                    alt={guideInfo.label}
                    style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 12, marginBottom: 14 }}
                  />
                )}
                <p style={{ fontSize: 15, color: 'var(--text-2)', lineHeight: 1.7 }}>{guideInfo.extract}</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
