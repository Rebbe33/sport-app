'use client'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { ChevronLeft, Leaf, Flame, Wind } from 'lucide-react'
import { getSessions, getSessionExercises, getSessionPoses, getRun } from '@/lib/db'
import type { SportSession, SportSessionExercise, SportExercise, SportYogaPose, SportRun } from '@/types'

const DISCIPLINE_META = {
  yoga: { label: 'Yoga', color: 'var(--yoga)', Icon: Leaf },
  muscu: { label: 'Muscu / HIIT', color: 'var(--muscu)', Icon: Flame },
  cardio: { label: 'Course à pied', color: 'var(--cardio)', Icon: Wind },
}
const RESSENTI_LABEL = ['', '😩 Difficile', '😕 Moyen', '😐 Correct', '😊 Bien', '🔥 Super !']

export default function SessionDetailPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [session, setSession] = useState<SportSession | null>(null)
  const [exercises, setExercises] = useState<(SportSessionExercise & { exercise: SportExercise })[]>([])
  const [poses, setPoses] = useState<SportYogaPose[]>([])
  const [run, setRun] = useState<SportRun | null>(null)

  useEffect(() => {
    getSessions(100).then(all => {
      const s = all.find(x => x.id === id)
      if (!s) return
      setSession(s)
      if (s.type === 'muscu') getSessionExercises(id).then(setExercises)
      if (s.type === 'yoga') getSessionPoses(id).then(setPoses)
      if (s.type === 'cardio') getRun(id).then(r => r && setRun(r))
    })
  }, [id])

  if (!session) return (
    <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'var(--text-3)' }}>Chargement…</p>
    </div>
  )

  const meta = DISCIPLINE_META[session.type]
  const Icon = meta.Icon

  return (
    <div className="page">
      {/* Header */}
      <div style={{ padding: '56px 20px 20px', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <button onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center', gap: 4, color: meta.color, fontSize: 15, fontWeight: 500, marginBottom: 12 }}>
          <ChevronLeft size={20} /> Retour
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: meta.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={22} color={meta.color} />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800 }}>{meta.label}</h1>
            <p style={{ fontSize: 14, color: 'var(--text-2)', marginTop: 2 }}>
              {format(new Date(session.date), "EEEE d MMMM yyyy", { locale: fr })}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <div style={{ flex: 1, background: 'var(--surface2)', borderRadius: 12, padding: '10px 12px' }}>
            <p style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-display)', fontWeight: 600, textTransform: 'uppercase' }}>Durée</p>
            <p style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-display)', marginTop: 2 }}>{session.duration_minutes}<span style={{ fontSize: 12, color: 'var(--text-3)', marginLeft: 2 }}>min</span></p>
          </div>
          <div style={{ flex: 1, background: 'var(--surface2)', borderRadius: 12, padding: '10px 12px' }}>
            <p style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-display)', fontWeight: 600, textTransform: 'uppercase' }}>Ressenti</p>
            <p style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>{RESSENTI_LABEL[session.ressenti]}</p>
          </div>
        </div>
      </div>

      <div style={{ padding: '20px 20px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Yoga poses */}
        {session.type === 'yoga' && poses.length > 0 && (
          <div>
            <p className="section-title">Postures ({poses.length})</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {poses.map((pose) => (
                <div key={pose.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
                  <p style={{ fontWeight: 500, fontSize: 15 }}>{pose.name}</p>
                  <p style={{ fontSize: 13, color: 'var(--text-3)' }}>{pose.duration_seconds}s</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Muscu exercises */}
        {session.type === 'muscu' && exercises.length > 0 && (
          <div>
            <p className="section-title">Exercices ({exercises.length})</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {exercises.map((entry) => (
                <div key={entry.id} className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <p style={{ fontWeight: 600, fontSize: 15 }}>{entry.exercise.name}</p>
                    {entry.exercise.muscle_group && (
                      <span style={{ fontSize: 11, background: 'var(--muscu-light)', color: 'var(--muscu-dark)', padding: '2px 8px', borderRadius: 99, fontFamily: 'var(--font-display)', fontWeight: 600 }}>
                        {entry.exercise.muscle_group}
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-2)' }}>
                    {entry.sets} séries × {entry.reps} reps{entry.weight_kg ? ` · ${entry.weight_kg} kg` : ''}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Run */}
        {session.type === 'cardio' && run && (
          <div>
            <p className="section-title">Données course</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { label: 'Distance', value: `${run.distance_km} km` },
                { label: 'Durée', value: `${Math.floor(run.duration_seconds / 60)}min ${run.duration_seconds % 60}s` },
                { label: 'Allure', value: run.pace_per_km ? `${Math.floor(run.pace_per_km)}:${Math.round((run.pace_per_km % 1) * 60).toString().padStart(2, '0')}/km` : '—' },
              ].map(({ label, value }) => (
                <div key={label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px' }}>
                  <p style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-display)', fontWeight: 600, textTransform: 'uppercase' }}>{label}</p>
                  <p style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-display)', marginTop: 4, color: 'var(--cardio)' }}>{value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        {session.notes && (
          <div>
            <p className="section-title">Notes</p>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px' }}>
              <p style={{ fontSize: 15, color: 'var(--text-2)', lineHeight: 1.6 }}>{session.notes}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
