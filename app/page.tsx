'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { format, startOfWeek, addDays, isToday, isPast, isSameDay } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Plus, Flame, Leaf, Wind } from 'lucide-react'
import { getSessionsByWeek } from '@/lib/db'
import type { SportSession, DisciplineType } from '@/types'

const DISCIPLINE_META: Record<DisciplineType, { label: string; color: string; Icon: React.FC<{ size?: number }> }> = {
  yoga: { label: 'Yoga', color: 'var(--yoga)', Icon: ({ size = 16 }) => <Leaf size={size} /> },
  muscu: { label: 'Muscu / HIIT', color: 'var(--muscu)', Icon: ({ size = 16 }) => <Flame size={size} /> },
  cardio: { label: 'Cardio', color: 'var(--cardio)', Icon: ({ size = 16 }) => <Wind size={size} /> },
}

const RESSENTI_EMOJI = ['', '😩', '😕', '😐', '😊', '🔥']

export default function HomePage() {
  const [sessions, setSessions] = useState<SportSession[]>([])
  const [loading, setLoading] = useState(true)

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const weekStartStr = format(weekStart, 'yyyy-MM-dd')
  const weekEndStr = format(addDays(weekStart, 6), 'yyyy-MM-dd')

  useEffect(() => {
    getSessionsByWeek(weekStartStr, weekEndStr)
      .then(setSessions)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [weekStartStr, weekEndStr])

  const getSessionForDay = (date: Date) =>
    sessions.find(s => isSameDay(new Date(s.date), date))

  const totalThisWeek = sessions.length
  const totalMinutes = sessions.reduce((acc, s) => acc + (s.duration_minutes || 0), 0)

  return (
    <div className="page" style={{ padding: '0 0 calc(var(--nav-h) + var(--safe-bottom) + 16px)' }}>
      {/* Header */}
      <div style={{ padding: '56px 20px 20px', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <p style={{ fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 4 }}>
          {format(new Date(), "MMMM yyyy", { locale: fr })}
        </p>
        <h1 style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.1 }}>Ma semaine</h1>

        {/* Stats rapides */}
        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          <div style={{ flex: 1, background: 'var(--surface2)', borderRadius: 12, padding: '10px 14px' }}>
            <p style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-display)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Séances</p>
            <p style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-display)', marginTop: 2 }}>{totalThisWeek}<span style={{ fontSize: 14, color: 'var(--text-3)', marginLeft: 3 }}>/4</span></p>
          </div>
          <div style={{ flex: 1, background: 'var(--surface2)', borderRadius: 12, padding: '10px 14px' }}>
            <p style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-display)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Minutes</p>
            <p style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-display)', marginTop: 2 }}>{totalMinutes}</p>
          </div>
          <div style={{ flex: 1, background: 'var(--surface2)', borderRadius: 12, padding: '10px 14px' }}>
            <p style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-display)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Repos</p>
            <p style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-display)', marginTop: 2 }}>{7 - totalThisWeek}<span style={{ fontSize: 14, color: 'var(--text-3)', marginLeft: 3 }}>j</span></p>
          </div>
        </div>
      </div>

      {/* Planning jours */}
      <div style={{ padding: '20px 20px 0' }}>
        <p className="section-title">Planning</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {weekDays.map((day) => {
            const session = getSessionForDay(day)
            const today = isToday(day)
            const past = isPast(day) && !today
            const meta = session ? DISCIPLINE_META[session.type] : null

            return (
              <div
                key={day.toISOString()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 14px',
                  background: today ? 'var(--surface)' : 'transparent',
                  border: today ? '1.5px solid var(--border-strong)' : '1px solid transparent',
                  borderRadius: 14,
                  opacity: past && !session ? 0.45 : 1,
                }}
              >
                {/* Jour */}
                <div style={{ width: 42, flexShrink: 0, textAlign: 'center' }}>
                  <p style={{ fontSize: 10, fontFamily: 'var(--font-display)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: today ? 'var(--accent)' : 'var(--text-3)' }}>
                    {format(day, 'EEE', { locale: fr })}
                  </p>
                  <p style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-display)', color: today ? 'var(--text)' : 'var(--text-2)', lineHeight: 1.2 }}>
                    {format(day, 'd')}
                  </p>
                </div>

                {/* Contenu */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {session && meta ? (
                    <Link href={`/historique/${session.id}`}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 10, background: meta.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span style={{ color: meta.color }}><meta.Icon size={16} /></span>
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontWeight: 500, fontSize: 14, color: 'var(--text)' }}>{meta.label}</p>
                          <p style={{ fontSize: 12, color: 'var(--text-3)' }}>
                            {session.duration_minutes} min · {RESSENTI_EMOJI[session.ressenti]}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ) : (
                    <p style={{ fontSize: 14, color: 'var(--text-3)' }}>
                      {today ? 'Pas encore de séance' : 'Repos'}
                    </p>
                  )}
                </div>

                {/* Bouton + si aujourd'hui sans séance */}
                {today && !session && (
                  <Link href="/seance">
                    <div style={{
                      width: 34, height: 34, borderRadius: 10,
                      background: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <Plus size={18} color="var(--bg)" />
                    </div>
                  </Link>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* CTA fixe si pas de séance aujourd'hui */}
      {!loading && !getSessionForDay(new Date()) && (
        <div style={{ padding: '20px 20px 0' }} className="animate-up">
          <Link href="/seance">
            <button className="btn-primary">
              + Saisir ma séance du jour
            </button>
          </Link>
        </div>
      )}
    </div>
  )
}
