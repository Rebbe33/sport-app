'use client'
import { useState, useEffect } from 'react'
import { format, subWeeks, startOfWeek, endOfWeek, eachWeekOfInterval } from 'date-fns'
import { fr } from 'date-fns/locale'
import { getAllRuns, getRecentStats } from '@/lib/db'
import type { SportRun, SportSession } from '@/types'

type StatsData = {
  sessions: SportSession[]
  byType: { yoga: number; muscu: number; cardio: number }
  totalMin: number
  totalSessions: number
}

export default function ProgresPage() {
  const [stats, setStats] = useState<StatsData | null>(null)
  const [runs, setRuns] = useState<(SportRun & { session: SportSession })[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getRecentStats(), getAllRuns()])
      .then(([s, r]) => { setStats(s as StatsData); setRuns(r) })
      .finally(() => setLoading(false))
  }, [])

  // Compute weekly session counts for past 6 weeks
  const weeks = eachWeekOfInterval({
    start: subWeeks(new Date(), 5),
    end: new Date(),
  }, { weekStartsOn: 1 })

  const weeklyData = weeks.map(weekStart => {
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 })
    const count = stats?.sessions.filter(s => {
      const d = new Date(s.date)
      return d >= weekStart && d <= weekEnd
    }).length || 0
    return { label: format(weekStart, 'd MMM', { locale: fr }), count }
  })

  const maxCount = Math.max(...weeklyData.map(w => w.count), 1)

  // Recent runs for allure chart
  const recentRuns = runs.slice(0, 8).reverse()
  const maxPace = Math.max(...recentRuns.map(r => r.pace_per_km || 0), 1)

  const formatPace = (p: number) => `${Math.floor(p)}:${Math.round((p % 1) * 60).toString().padStart(2, '0')}`

  if (loading) return (
    <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'var(--text-3)' }}>Chargement…</p>
    </div>
  )

  return (
    <div className="page">
      <div style={{ padding: '56px 20px 20px', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>Progrès</h1>
        <p style={{ fontSize: 14, color: 'var(--text-2)', marginTop: 4 }}>30 derniers jours</p>
      </div>

      <div style={{ padding: '20px 20px 0', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { label: 'Séances total', value: stats?.totalSessions || 0, unit: '' },
            { label: 'Minutes actives', value: stats?.totalMin || 0, unit: 'min' },
            { label: 'Courses', value: stats?.byType.cardio || 0, unit: '', color: 'var(--cardio)' },
            { label: 'Yoga', value: stats?.byType.yoga || 0, unit: '', color: 'var(--yoga)' },
          ].map(({ label, value, unit, color }) => (
            <div key={label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px' }}>
              <p style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-display)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</p>
              <p style={{ fontSize: 28, fontWeight: 800, fontFamily: 'var(--font-display)', marginTop: 4, color: color || 'var(--text)' }}>
                {value}<span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text-3)', marginLeft: 2 }}>{unit}</span>
              </p>
            </div>
          ))}
        </div>

        {/* Discipline repartition */}
        {stats && stats.totalSessions > 0 && (
          <div>
            <p className="section-title">Répartition</p>
            <div className="card">
              {[
                { key: 'yoga', label: 'Yoga', color: 'var(--yoga)' },
                { key: 'muscu', label: 'Muscu / HIIT', color: 'var(--muscu)' },
                { key: 'cardio', label: 'Course', color: 'var(--cardio)' },
              ].map(({ key, label, color }) => {
                const count = stats.byType[key as keyof typeof stats.byType]
                const pct = stats.totalSessions ? Math.round((count / stats.totalSessions) * 100) : 0
                return (
                  <div key={key} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                      <p style={{ fontSize: 13, fontWeight: 500 }}>{label}</p>
                      <p style={{ fontSize: 13, color: 'var(--text-3)' }}>{count} séance{count !== 1 ? 's' : ''} · {pct}%</p>
                    </div>
                    <div style={{ height: 6, background: 'var(--surface2)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 99, transition: 'width 0.6s ease' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Weekly frequency chart */}
        <div>
          <p className="section-title">Fréquence hebdo (6 semaines)</p>
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 80 }}>
              {weeklyData.map(({ label, count }, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <p style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600, fontFamily: 'var(--font-display)' }}>{count > 0 ? count : ''}</p>
                  <div style={{ width: '100%', height: 52, display: 'flex', alignItems: 'flex-end' }}>
                    <div style={{
                      width: '100%',
                      height: count ? `${Math.round((count / maxCount) * 100)}%` : '6px',
                      background: count ? 'var(--text)' : 'var(--surface2)',
                      borderRadius: '4px 4px 0 0',
                      minHeight: 6,
                      transition: 'height 0.5s ease',
                    }} />
                  </div>
                  <p style={{ fontSize: 9, color: 'var(--text-3)', fontFamily: 'var(--font-display)', fontWeight: 600, textAlign: 'center' }}>{label}</p>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center', marginTop: 8 }}>Objectif : 4 séances/semaine</p>
          </div>
        </div>

        {/* Runs pace evolution */}
        {recentRuns.length > 1 && (
          <div>
            <p className="section-title">Évolution allure course</p>
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 80 }}>
                {recentRuns.map((r, i) => {
                  const pace = r.pace_per_km || 0
                  const heightPct = maxPace ? Math.round((1 - (pace / maxPace)) * 70) + 30 : 50
                  return (
                    <div key={r.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <div style={{ width: '100%', height: 60, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                        <div
                          style={{
                            width: 8, height: 8, borderRadius: '50%',
                            background: 'var(--cardio)',
                            marginBottom: `${heightPct}%`,
                          }}
                        />
                      </div>
                      <p style={{ fontSize: 9, color: 'var(--text-3)', fontFamily: 'var(--font-display)', fontWeight: 600 }}>{formatPace(pace)}</p>
                    </div>
                  )
                })}
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center', marginTop: 4 }}>Plus le point est haut, meilleure est l'allure</p>
            </div>
          </div>
        )}

        {/* Empty state */}
        {stats && stats.totalSessions === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <p style={{ fontSize: 40 }}>📈</p>
            <p style={{ color: 'var(--text-2)', marginTop: 12 }}>Tes statistiques apparaîtront ici une fois quelques séances enregistrées.</p>
          </div>
        )}
      </div>
    </div>
  )
}
