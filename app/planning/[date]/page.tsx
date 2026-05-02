'use client'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { ChevronLeft, Play, Check } from 'lucide-react'
import { getSessions } from '@/lib/db'
import type { SportSession, DisciplineType } from '@/types'

const META: Record<DisciplineType, { label: string; color: string; emoji: string }> = {
  yoga:   { label: 'Yoga',         color: 'var(--yoga)',   emoji: '🧘' },
  muscu:  { label: 'Muscu / HIIT', color: 'var(--muscu)',  emoji: '💪' },
  cardio: { label: 'Course',       color: 'var(--cardio)', emoji: '🏃' },
}

export default function PlanningDayPage() {
  const router = useRouter()
  const { date } = useParams<{ date: string }>()
  const [sessions, setSessions] = useState<SportSession[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getSessions(500)
      .then(all => setSessions(all.filter(s => s.date === date)))
      .finally(() => setLoading(false))
  }, [date])

  const dateLabel = format(new Date(date), 'EEEE d MMMM', { locale: fr })

  return (
    <div className="page">
      <div style={{ padding: '56px 20px 16px', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <button onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-2)', fontSize: 14, marginBottom: 12, background: 'none', border: 'none', cursor: 'pointer' }}>
          <ChevronLeft size={18} /> Retour
        </button>
        <h1 style={{ fontSize: 24, fontWeight: 800, textTransform: 'capitalize' }}>{dateLabel}</h1>
        <p style={{ fontSize: 14, color: 'var(--text-2)', marginTop: 4 }}>{sessions.length} séance{sessions.length > 1 ? 's' : ''} prévue{sessions.length > 1 ? 's' : ''}</p>
      </div>

      <div style={{ padding: '20px 20px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {loading && <p style={{ color: 'var(--text-3)', textAlign: 'center', padding: '40px 0' }}>Chargement…</p>}

        {sessions.map(s => {
          const meta = META[s.type]
          const done = s.status === 'done'
          return (
            <div key={s.id} style={{ background: meta.color + '12', border: `1.5px solid ${meta.color}40`, borderRadius: 20, padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: meta.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0 }}>
                  {meta.emoji}
                </div>
                <div>
                  <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18 }}>{meta.label}</p>
                  <p style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 2 }}>
                    {s.duration_minutes} min · {done ? '✅ Faite' : '📅 Planifiée'}
                  </p>
                </div>
              </div>

              {s.notes && (
                <p style={{ fontSize: 14, color: 'var(--text-2)', background: 'var(--surface)', borderRadius: 12, padding: '10px 14px', marginBottom: 14 }}>
                  {s.notes}
                </p>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                {!done ? (
                  <Link href={`/session/${s.id}`} style={{ flex: 2 }}>
                    <button style={{
                      width: '100%', padding: '13px 20px',
                      background: meta.color, border: 'none', borderRadius: 14,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      color: 'white', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15,
                      cursor: 'pointer',
                    }}>
                      <Play size={16} fill="white" /> Lancer
                    </button>
                  </Link>
                ) : (
                  <div style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '13px', background: 'var(--surface)', borderRadius: 14 }}>
                    <Check size={16} color={meta.color} />
                    <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, color: meta.color }}>Accomplie</p>
                  </div>
                )}
                <Link href={`/historique/${s.id}`} style={{ flex: 1 }}>
                  <button className="btn-secondary" style={{ height: '100%' }}>Détails</button>
                </Link>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
