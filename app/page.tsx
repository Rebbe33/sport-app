'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { format, isToday, startOfWeek, addDays, isSameDay } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Leaf, Flame, Wind, Plus, Check } from 'lucide-react'
import { getSessionsByWeek, markSessionDone } from '@/lib/db'
import type { SportSession, DisciplineType } from '@/types'

const META: Record<DisciplineType, { label: string; color: string; icon: React.ReactNode }> = {
  yoga:   { label: 'Yoga',         color: 'var(--yoga)',   icon: <Leaf size={28} /> },
  muscu:  { label: 'Muscu / HIIT', color: 'var(--muscu)',  icon: <Flame size={28} /> },
  cardio: { label: 'Course',       color: 'var(--cardio)', icon: <Wind size={28} /> },
}

export default function HomePage() {
  const [sessions, setSessions] = useState<SportSession[]>([])
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
  const weekEnd   = addDays(weekStart, 6)

  useEffect(() => {
    getSessionsByWeek(
      format(weekStart, 'yyyy-MM-dd'),
      format(weekEnd, 'yyyy-MM-dd')
    ).then(setSessions)
  }, [])

  const todaySession = sessions.find(s => isSameDay(new Date(s.date), new Date()))
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const handleDone = async () => {
    if (!todaySession) return
    await markSessionDone(todaySession.id)
    setSessions(prev => prev.map(s =>
      s.id === todaySession.id ? { ...s, status: 'done' } : s
    ))
  }

  return (
    <div className="page">
      {/* Header date */}
      <div style={{ padding: '56px 20px 20px' }}>
        <p style={{ fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 700,
          letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)' }}>
          {format(new Date(), "EEEE d MMMM", { locale: fr })}
        </p>
        <h1 style={{ fontSize: 30, fontWeight: 800, marginTop: 4 }}>Aujourd'hui</h1>
      </div>

      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Séance du jour */}
        {todaySession ? (() => {
          const meta = META[todaySession.type]
          const isDone = todaySession.status === 'done'
          return (
            <div style={{
              background: meta.color + '14',
              border: `1.5px solid ${meta.color}44`,
              borderRadius: 20, padding: '20px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                <div style={{ width: 56, height: 56, borderRadius: 16,
                  background: meta.color + '22', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', color: meta.color }}>
                  {meta.icon}
                </div>
                <div>
                  <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800,
                    fontSize: 20, color: 'var(--text)' }}>{meta.label}</p>
                  <p style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 2 }}>
                    {todaySession.duration_minutes} min
                    {isDone ? ' · ✅ Séance faite !' : ' · À faire aujourd\'hui'}
                  </p>
                </div>
              </div>

              {todaySession.notes && (
                <p style={{ fontSize: 14, color: 'var(--text-2)',
                  background: 'var(--surface)', borderRadius: 12,
                  padding: '10px 14px', marginBottom: 14 }}>
                  {todaySession.notes}
                </p>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                {!isDone && (
                  <button onClick={handleDone} className="btn-primary"
                    style={{ background: meta.color, flex: 1 }}>
                    <Check size={16} style={{ display: 'inline', marginRight: 6 }} />
                    Marquer comme faite
                  </button>
                )}
                <Link href={`/historique/${todaySession.id}`} style={{ flex: isDone ? 1 : 0 }}>
                  <button className="btn-secondary" style={{ width: '100%' }}>
                    Détails
                  </button>
                </Link>
              </div>
            </div>
          )
        })() : (
          /* Pas de séance planifiée aujourd'hui */
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 20, padding: '28px 20px', textAlign: 'center' }}>
            <p style={{ fontSize: 36, marginBottom: 10 }}>🛋️</p>
            <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 17 }}>
              Jour de repos
            </p>
            <p style={{ fontSize: 14, color: 'var(--text-2)', marginTop: 6, marginBottom: 16 }}>
              Aucune séance prévue aujourd'hui
            </p>
            <Link href="/seance">
              <button className="btn-secondary">+ Ajouter quand même</button>
            </Link>
          </div>
        )}

        {/* Mini vue semaine */}
        <div>
          <p className="section-title">Cette semaine</p>
          <div style={{ display: 'flex', gap: 6 }}>
            {weekDays.map(day => {
              const s = sessions.find(x => isSameDay(new Date(x.date), day))
              const today = isToday(day)
              const meta = s ? META[s.type] : null
              return (
                <div key={day.toISOString()} style={{ flex: 1, display: 'flex',
                  flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                  <p style={{ fontSize: 10, fontFamily: 'var(--font-display)', fontWeight: 700,
                    textTransform: 'uppercase', color: today ? 'var(--accent)' : 'var(--text-3)' }}>
                    {format(day, 'EEE', { locale: fr }).slice(0, 2)}
                  </p>
                  <div style={{ width: 34, height: 34, borderRadius: 10,
                    background: s
                      ? (s.status === 'done' ? meta!.color : meta!.color + '33')
                      : 'var(--surface2)',
                    border: today ? '2px solid var(--accent)' : '1px solid transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {s?.status === 'done'
                      ? <Check size={14} color="white" />
                      : meta
                        ? <span style={{ color: meta.color, display: 'flex' }}>
                            {meta.icon}
                          </span>
                        : null
                    }
                  </div>
                </div>
              )
            })}
          </div>
        </div>

      </div>
    </div>
  )
}
