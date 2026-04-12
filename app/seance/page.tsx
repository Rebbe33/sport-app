'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Leaf, Flame, Wind, ChevronLeft, Plus, Trash2, Check } from 'lucide-react'
import { createSession, createRun, addYogaPose, addSessionExercise, createExercise, getExercises } from '@/lib/db'
import type { DisciplineType, Ressenti } from '@/types'

// ── Yoga form ──────────────────────────────────────────────
function YogaForm({ onSave }: { onSave: (data: { poses: { name: string; duration: number }[]; notes: string }) => void }) {
  const [poses, setPoses] = useState<{ name: string; duration: number }[]>([{ name: '', duration: 60 }])
  const [notes, setNotes] = useState('')

  const addPose = () => setPoses(p => [...p, { name: '', duration: 60 }])
  const removePose = (i: number) => setPoses(p => p.filter((_, idx) => idx !== i))
  const updatePose = (i: number, field: 'name' | 'duration', val: string | number) =>
    setPoses(p => p.map((pose, idx) => idx === i ? { ...pose, [field]: val } : pose))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <label className="field-label">Postures pratiquées</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {poses.map((pose, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                className="input-field"
                style={{ flex: 1 }}
                placeholder={`Posture ${i + 1}`}
                value={pose.name}
                onChange={e => updatePose(i, 'name', e.target.value)}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: '0 10px', height: 48, flexShrink: 0 }}>
                <input
                  type="number"
                  style={{ width: 36, background: 'none', border: 'none', outline: 'none', fontSize: 15, color: 'var(--text)', textAlign: 'center' }}
                  value={pose.duration}
                  onChange={e => updatePose(i, 'duration', Number(e.target.value))}
                  min={5}
                />
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>s</span>
              </div>
              {poses.length > 1 && (
                <button onClick={() => removePose(i)} style={{ color: 'var(--text-3)', padding: 8 }}>
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
          <button onClick={addPose} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--yoga)', fontSize: 14, fontWeight: 500, padding: '8px 0' }}>
            <Plus size={16} /> Ajouter une posture
          </button>
        </div>
      </div>
      <div>
        <label className="field-label">Notes (optionnel)</label>
        <textarea className="input-field" rows={2} placeholder="Ressentis, difficultés, progrès..." value={notes} onChange={e => setNotes(e.target.value)} style={{ resize: 'none' }} />
      </div>
      <button className="btn-primary" style={{ background: 'var(--yoga)' }} onClick={() => onSave({ poses, notes })}>
        <Check size={16} style={{ display: 'inline', marginRight: 6 }} /> Enregistrer la séance
      </button>
    </div>
  )
}

// ── Muscu/HIIT form ────────────────────────────────────────
function MuscuForm({ onSave }: { onSave: (data: { exercises: { name: string; muscleGroup: string; sets: number; reps: number; weight: number }[]; notes: string }) => void }) {
  const [exercises, setExercises] = useState([{ name: '', muscleGroup: '', sets: 3, reps: 10, weight: 0 }])
  const [notes, setNotes] = useState('')

  const MUSCLE_GROUPS = ['Pectoraux', 'Dos', 'Épaules', 'Biceps', 'Triceps', 'Abdos', 'Jambes', 'Fessiers', 'Corps entier']

  const addEx = () => setExercises(e => [...e, { name: '', muscleGroup: '', sets: 3, reps: 10, weight: 0 }])
  const removeEx = (i: number) => setExercises(e => e.filter((_, idx) => idx !== i))
  const update = (i: number, field: string, val: string | number) =>
    setExercises(e => e.map((ex, idx) => idx === i ? { ...ex, [field]: val } : ex))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {exercises.map((ex, i) => (
        <div key={i} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--muscu)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Exercice {i + 1}</p>
            {exercises.length > 1 && (
              <button onClick={() => removeEx(i)} style={{ color: 'var(--text-3)' }}><Trash2 size={15} /></button>
            )}
          </div>
          <input className="input-field" placeholder="Nom de l'exercice" value={ex.name} onChange={e => update(i, 'name', e.target.value)} />
          <select className="input-field" value={ex.muscleGroup} onChange={e => update(i, 'muscleGroup', e.target.value)}>
            <option value="">Groupe musculaire</option>
            {MUSCLE_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {[
              { field: 'sets', label: 'Séries', min: 1 },
              { field: 'reps', label: 'Reps', min: 1 },
              { field: 'weight', label: 'Kg', min: 0 },
            ].map(({ field, label, min }) => (
              <div key={field}>
                <label className="field-label" style={{ fontSize: 10 }}>{label}</label>
                <input
                  type="number"
                  className="input-field"
                  style={{ textAlign: 'center', padding: '10px 8px' }}
                  value={ex[field as keyof typeof ex]}
                  onChange={e => update(i, field, Number(e.target.value))}
                  min={min}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
      <button onClick={addEx} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--muscu)', fontSize: 14, fontWeight: 500, padding: '4px 0' }}>
        <Plus size={16} /> Ajouter un exercice
      </button>
      <div>
        <label className="field-label">Notes (optionnel)</label>
        <textarea className="input-field" rows={2} placeholder="Sensations, difficultés..." value={notes} onChange={e => setNotes(e.target.value)} style={{ resize: 'none' }} />
      </div>
      <button className="btn-primary" style={{ background: 'var(--muscu)' }} onClick={() => onSave({ exercises, notes })}>
        <Check size={16} style={{ display: 'inline', marginRight: 6 }} /> Enregistrer la séance
      </button>
    </div>
  )
}

// ── Cardio form ────────────────────────────────────────────
function CardioForm({ onSave }: { onSave: (data: { distanceKm: number; durationMin: number; durationSec: number; notes: string }) => void }) {
  const [km, setKm] = useState('')
  const [min, setMin] = useState('')
  const [sec, setSec] = useState('00')
  const [notes, setNotes] = useState('')

  const totalSec = (Number(min) * 60) + Number(sec)
  const pace = km && min ? (totalSec / 60 / Number(km)) : 0
  const paceMin = Math.floor(pace)
  const paceSec = Math.round((pace - paceMin) * 60)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label className="field-label">Distance (km)</label>
          <input type="number" className="input-field" placeholder="5.0" step="0.1" min="0" value={km} onChange={e => setKm(e.target.value)} />
        </div>
        <div>
          <label className="field-label">Durée</label>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <input type="number" className="input-field" style={{ flex: 1, textAlign: 'center' }} placeholder="30" value={min} onChange={e => setMin(e.target.value)} min={0} />
            <span style={{ color: 'var(--text-3)', fontSize: 14 }}>min</span>
            <input type="number" className="input-field" style={{ width: 56, textAlign: 'center' }} placeholder="00" value={sec} onChange={e => setSec(e.target.value)} min={0} max={59} />
          </div>
        </div>
      </div>

      {/* Allure calculée */}
      {pace > 0 && (
        <div style={{ background: 'var(--cardio-light)', borderRadius: 12, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ fontSize: 13, color: 'var(--cardio-dark)', fontFamily: 'var(--font-display)', fontWeight: 600 }}>Allure calculée</p>
          <p style={{ fontSize: 20, fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--cardio)' }}>
            {paceMin}:{paceSec.toString().padStart(2, '0')} <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--cardio-dark)' }}>/km</span>
          </p>
        </div>
      )}

      <div>
        <label className="field-label">Notes (optionnel)</label>
        <textarea className="input-field" rows={2} placeholder="Parcours, météo, sensations..." value={notes} onChange={e => setNotes(e.target.value)} style={{ resize: 'none' }} />
      </div>
      <button
        className="btn-primary"
        style={{ background: 'var(--cardio)' }}
        onClick={() => onSave({ distanceKm: Number(km), durationMin: Number(min), durationSec: Number(sec), notes })}
        disabled={!km || !min}
      >
        <Check size={16} style={{ display: 'inline', marginRight: 6 }} /> Enregistrer la séance
      </button>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────
const DISCIPLINES: { type: DisciplineType; label: string; sub: string; color: string; Icon: React.FC }[] = [
  { type: 'yoga', label: 'Yoga', sub: 'Postures · Respiration', color: 'var(--yoga)', Icon: () => <Leaf size={24} /> },
  { type: 'muscu', label: 'Muscu / HIIT', sub: 'Exercices · Séries · Reps', color: 'var(--muscu)', Icon: () => <Flame size={24} /> },
  { type: 'cardio', label: 'Course à pied', sub: 'Distance · Durée · Allure', color: 'var(--cardio)', Icon: () => <Wind size={24} /> },
]

const RESSENTI_OPTIONS: { val: Ressenti; emoji: string; label: string }[] = [
  { val: 1, emoji: '😩', label: 'Difficile' },
  { val: 2, emoji: '😕', label: 'Moyen' },
  { val: 3, emoji: '😐', label: 'Correct' },
  { val: 4, emoji: '😊', label: 'Bien' },
  { val: 5, emoji: '🔥', label: 'Super !' },
]

type Step = 'type' | 'meta' | 'detail' | 'done'

export default function SeancePage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('type')
  const [type, setType] = useState<DisciplineType | null>(null)
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [duration, setDuration] = useState('')
  const [ressenti, setRessenti] = useState<Ressenti>(3)
  const [saving, setSaving] = useState(false)

  const handleTypeSelect = (t: DisciplineType) => {
    setType(t)
    setStep('meta')
  }

  const handleMeta = () => setStep('detail')

  const handleSave = async (detailData: Record<string, unknown>) => {
    if (!type) return
    setSaving(true)
    try {
      const session = await createSession({
        type,
        date,
        duration_minutes: Number(duration),
        ressenti,
        notes: (detailData.notes as string) || undefined,
      })

      if (type === 'yoga' && detailData.poses) {
        const poses = detailData.poses as { name: string; duration: number }[]
        for (const pose of poses) {
          if (pose.name) {
            await addYogaPose({ session_id: session.id, name: pose.name, duration_seconds: pose.duration })
          }
        }
      } else if (type === 'muscu' && detailData.exercises) {
        const exs = detailData.exercises as { name: string; muscleGroup: string; sets: number; reps: number; weight: number }[]
        for (let i = 0; i < exs.length; i++) {
          const ex = exs[i]
          if (!ex.name) continue
          const dbEx = await createExercise({ name: ex.name, muscle_group: ex.muscleGroup, is_hiit: false })
          await addSessionExercise({ session_id: session.id, exercise_id: dbEx.id, sets: ex.sets, reps: ex.reps, weight_kg: ex.weight || undefined, order_index: i })
        }
      } else if (type === 'cardio') {
        const { distanceKm, durationMin, durationSec } = detailData as { distanceKm: number; durationMin: number; durationSec: number }
        await createRun({ session_id: session.id, distance_km: distanceKm, duration_seconds: durationMin * 60 + durationSec })
      }

      setStep('done')
      setTimeout(() => router.push('/'), 1800)
    } catch (e) {
      console.error(e)
      alert('Erreur lors de la sauvegarde. Vérifie ta connexion Supabase.')
    } finally {
      setSaving(false)
    }
  }

  if (step === 'done') {
    return (
      <div className="page" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 20px' }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
        <h2 style={{ fontSize: 24, fontWeight: 800, textAlign: 'center' }}>Séance enregistrée !</h2>
        <p style={{ color: 'var(--text-2)', marginTop: 8, textAlign: 'center' }}>Retour au planning…</p>
      </div>
    )
  }

  const activeMeta = type ? DISCIPLINES.find(d => d.type === type) : null

  return (
    <div className="page">
      {/* Header */}
      <div style={{ padding: '56px 20px 16px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
        {step !== 'type' && (
          <button onClick={() => setStep(step === 'detail' ? 'meta' : 'type')} style={{ color: 'var(--text-2)', padding: '4px 0' }}>
            <ChevronLeft size={24} />
          </button>
        )}
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800 }}>
            {step === 'type' ? 'Nouvelle séance' : step === 'meta' ? 'Infos générales' : 'Détail'}
          </h1>
          {activeMeta && (
            <p style={{ fontSize: 13, color: activeMeta.color, fontWeight: 500, marginTop: 2 }}>
              {activeMeta.label}
            </p>
          )}
        </div>
      </div>

      <div style={{ padding: '20px 20px 0' }}>
        {/* Step 1: Type */}
        {step === 'type' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }} className="animate-up">
            <p className="section-title">Quelle discipline ?</p>
            {DISCIPLINES.map(({ type: t, label, sub, color, Icon }) => (
              <button
                key={t}
                onClick={() => handleTypeSelect(t)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '16px 16px',
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 16, textAlign: 'left', width: '100%',
                  transition: 'transform 0.1s, border-color 0.15s',
                }}
                onTouchStart={e => (e.currentTarget.style.transform = 'scale(0.98)')}
                onTouchEnd={e => (e.currentTarget.style.transform = 'scale(1)')}
              >
                <div style={{ width: 48, height: 48, borderRadius: 14, background: color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>
                  <Icon />
                </div>
                <div>
                  <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16 }}>{label}</p>
                  <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>{sub}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Step 2: Meta (date, durée, ressenti) */}
        {step === 'meta' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }} className="animate-up">
            <div>
              <label className="field-label">Quand as-tu prévu cette séances ?</label>
              <input type="date" className="input-field" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div>
              <label className="field-label">Durée (minutes)</label>
              <input type="number" className="input-field" placeholder="45" min={1} value={duration} onChange={e => setDuration(e.target.value)} />
            </div>
            <div>
              <label className="field-label">Ressenti général</label>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
                {RESSENTI_OPTIONS.map(({ val, emoji, label }) => (
                  <button
                    key={val}
                    onClick={() => setRessenti(val)}
                    style={{
                      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                      padding: '10px 4px', borderRadius: 12,
                      background: ressenti === val ? (activeMeta?.color + '22' || 'var(--surface2)') : 'var(--surface)',
                      border: `1px solid ${ressenti === val ? (activeMeta?.color || 'var(--border-strong)') : 'var(--border)'}`,
                      transition: 'all 0.15s',
                    }}
                  >
                    <span style={{ fontSize: 22 }}>{emoji}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-display)', fontWeight: 600 }}>{label}</span>
                  </button>
                ))}
              </div>
            </div>
            <button className="btn-primary" onClick={handleMeta} disabled={!duration}>
              Continuer →
            </button>
          </div>
        )}

        {/* Step 3: Detail by discipline */}
        {step === 'detail' && (
          <div className="animate-up">
            {type === 'yoga' && <YogaForm onSave={handleSave} />}
            {type === 'muscu' && <MuscuForm onSave={handleSave} />}
            {type === 'cardio' && <CardioForm onSave={handleSave} />}
          </div>
        )}
      </div>
    </div>
  )
}
