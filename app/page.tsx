'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { format, startOfWeek, addDays, isToday, isSameDay } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Leaf, Flame, Wind, Check, Play } from 'lucide-react'
import { getSessionsByWeek } from '@/lib/db'
import type { SportSession, DisciplineType } from '@/types'

const META: Record<DisciplineType, { label: string; color: string; emoji: string }> = {
  yoga:   { label: 'Yoga',         color: 'var(--yoga)',   emoji: '🧘' },
  muscu:  { label: 'Muscu / HIIT', color: 'var(--muscu)',  emoji: '💪' },
  cardio: { label: 'Course',       color: 'var(--cardio)', emoji: '🏃' },
}

const ICON: Record<DisciplineType, React.FC<{ size?: number }>> = {
  yoga:   ({ size = 16 }) => <Leaf size={size} />,
  muscu:  ({ size = 16 }) => <Flame size={size} />,
  cardio: ({ size = 16 }) => <Wind size={size} />,
}

export default function HomePage() {
  const [sessions, setSessions] = useState<SportSession[]>([])
  const [loading, setLoading] = useState(true)

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  useEffect(() => {
    getSessionsByWeek(
      format(weekStart, 'yyyy-MM-dd'),
      format(addDays(weekStart, 6), 'yyyy-MM-dd')
    ).then(setSessions).finally(() => setLoading(false))
  }, []) // eslint-disable-line

  const todaySessions = sessions.filter(s => isSameDay(new Date(s.date), new Date()))
const todaySession = todaySessions[0] // pour la compatibilité
const isDone = todaySessions.length > 0 && todaySessions.every(s => s.status === 'done')
  // Rappel bilan toutes les 2 semaines
const [showBilanReminder, setShowBilanReminder] = useState(false)

useEffect(() => {
  const lastBilan = localStorage.getItem('lastBilanDate')
  if (!lastBilan) {
    setShowBilanReminder(true)
  } else {
    const diff = (Date.now() - new Date(lastBilan).getTime()) / (1000 * 60 * 60 * 24)
    if (diff >= 14) setShowBilanReminder(true)
  }
}, [])

  return (
    <div className="page">
      {/* Header */}
      <div style={{ padding: '56px 20px 20px', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <p style={{ fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)' }}>
          {format(new Date(), "EEEE d MMMM", { locale: fr })}
        </p>
        <h1 style={{ fontSize: 30, fontWeight: 800, marginTop: 4 }}>Aujourd'hui</h1>
      </div>
      {showBilanReminder && (
  <Link href="/bilan">
    <div style={{
      margin: '0 20px',
      background: 'var(--accent-light)',
      border: '1px solid var(--accent)',
      borderRadius: 14,
      padding: '12px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginTop: 12,
    }}>
      <span style={{ fontSize: 24 }}>📊</span>
      <div style={{ flex: 1 }}>
        <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>
          Bilan des 2 dernières semaines
        </p>
        <p style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>
          C'est le moment de faire le point !
        </p>
      </div>
      <span style={{ fontSize: 18 }}>→</span>
    </div>
  </Link>
)}

      <div style={{ padding: '20px 20px 0', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Carte séance du jour */}
        {!loading && (todaySessions.length > 0 ? (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
    {todaySessions.map(s => {
      const meta = META[s.type]
      const done = s.status === 'done'
      return (
        <div key={s.id} style={{ background: meta.color + '12', border: `1.5px solid ${meta.color}40`, borderRadius: 20, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: meta.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, flexShrink: 0 }}>
              {meta.emoji}
            </div>
            <div>
              <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20 }}>{meta.label}</p>
              <p style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 2 }}>
                {s.duration_minutes} min
                {done ? ' · ✅ Faite !' : ' · Planifiée'}
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
                  width: '100%', padding: '14px 20px',
                  background: meta.color, border: 'none', borderRadius: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  color: 'white', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15,
                  cursor: 'pointer',
                }}>
                  <Play size={17} fill="white" /> Lancer
                </button>
              </Link>
            ) : (
              <div style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '14px', background: 'var(--surface)', borderRadius: 14 }}>
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
) : (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: '28px 20px', textAlign: 'center' }}>
            <p style={{ fontSize: 36, marginBottom: 10 }}>🛋️</p>
            <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 17 }}>Jour de repos</p>
            <p style={{ fontSize: 14, color: 'var(--text-2)', marginTop: 6, marginBottom: 16 }}>Aucune séance prévue aujourd'hui</p>
            <Link href="/seance">
              <button className="btn-secondary">+ Ajouter quand même</button>
            </Link>
          </div>
        ))}

        {/* Mini planning semaine */}
        <div>
          <p className="section-title">Cette semaine</p>
          <div style={{ display: 'flex', gap: 6 }}>
            {weekDays.map(day => {
              const daySessions = sessions.filter(x => isSameDay(new Date(x.date), day))
const s = daySessions[0]
const meta = s ? META[s.type] : null
const Icon = s ? ICON[s.type] : null
const allDone = daySessions.length > 0 && daySessions.every(x => x.status === 'done')
const hasMultiple = daySessions.length > 1
      const today = isToday(day)
              return (
                <div key={day.toISOString()} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                  <p style={{ fontSize: 10, fontFamily: 'var(--font-display)', fontWeight: 700, textTransform: 'uppercase', color: today ? 'var(--accent)' : 'var(--text-3)' }}>
                    {format(day, 'EEE', { locale: fr }).slice(0, 2)}
                  </p>
                  {s && s.status !== 'done' ? (
  <Link href={`/session/${s.id}`}>
    {daySessions.length > 0 && !allDone ? (
  <Link href={hasMultiple ? `/planning/${format(day, 'yyyy-MM-dd')}` : `/session/${s!.id}`}>
    <div style={{
      width: 34, height: 34, borderRadius: 10,
      background: meta!.color + '30',
      border: today ? '2px solid var(--accent)' : '1px solid transparent',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative',
    }}>
      <span style={{ color: meta!.color, display: 'flex' }}>
        {Icon && <Icon size={14} />}
      </span>
      {hasMultiple && (
        <div style={{ position: 'absolute', top: -4, right: -4, width: 14, height: 14, borderRadius: '50%', background: meta!.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 8, color: 'white', fontWeight: 700 }}>{daySessions.length}</span>
        </div>
      )}
    </div>
  </Link>
) : (
  <div style={{
    width: 34, height: 34, borderRadius: 10,
    background: s ? meta!.color : 'var(--surface2)',
    border: today ? '2px solid var(--accent)' : '1px solid transparent',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  }}>
    {allDone && <Check size={14} color="white" />}
    {hasMultiple && allDone && (
      <div style={{ position: 'absolute', top: -4, right: -4, width: 14, height: 14, borderRadius: '50%', background: 'white', border: `1px solid ${meta!.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 8, color: meta!.color, fontWeight: 700 }}>{daySessions.length}</span>
      </div>
    )}
  </div>
)}
                </div>
              )
            })}
          </div>
        </div>

        {!loading && !todaySession && (
          <Link href="/seance">
            <button className="btn-primary">+ Planifier une séance</button>
          </Link>
        )}

      </div>
    </div>
  )
}
