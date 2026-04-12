'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Leaf, Flame, Wind, ChevronRight, Trash2 } from 'lucide-react'
import { getSessions, deleteSession } from '@/lib/db'
import type { SportSession, DisciplineType } from '@/types'

const DISCIPLINE_META = {
  yoga: { label: 'Yoga', color: 'var(--yoga)', lightColor: 'var(--yoga-light)', Icon: Leaf },
  muscu: { label: 'Muscu / HIIT', color: 'var(--muscu)', lightColor: 'var(--muscu-light)', Icon: Flame },
  cardio: { label: 'Course', color: 'var(--cardio)', lightColor: 'var(--cardio-light)', Icon: Wind },
}

const RESSENTI_EMOJI = ['', '😩', '😕', '😐', '😊', '🔥']

type Filter = 'all' | DisciplineType

export default function HistoriquePage() {
  const [sessions, setSessions] = useState<SportSession[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('all')
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    getSessions(100).then(setSessions).finally(() => setLoading(false))
  }, [])

  const filtered = filter === 'all' ? sessions : sessions.filter(s => s.type === filter)

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette séance ?')) return
    setDeleting(id)
    try {
      await deleteSession(id)
      setSessions(s => s.filter(x => x.id !== id))
    } finally {
      setDeleting(null)
    }
  }

  // Group by month
  const grouped = filtered.reduce<Record<string, SportSession[]>>((acc, s) => {
    const key = format(new Date(s.date), 'MMMM yyyy', { locale: fr })
    if (!acc[key]) acc[key] = []
    acc[key].push(s)
    return acc
  }, {})

  return (
    <div className="page">
      {/* Header */}
      <div style={{ padding: '56px 20px 16px', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>Journal</h1>
        <p style={{ fontSize: 14, color: 'var(--text-2)', marginTop: 4 }}>
          {sessions.length} séance{sessions.length !== 1 ? 's' : ''} enregistrée{sessions.length !== 1 ? 's' : ''}
        </p>

        {/* Filtres */}
        <div style={{ display: 'flex', gap: 8, marginTop: 14, overflowX: 'auto', paddingBottom: 4 }}>
          {(['all', 'yoga', 'muscu', 'cardio'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '7px 14px', borderRadius: 99, border: '1px solid',
                fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 600,
                whiteSpace: 'nowrap', transition: 'all 0.15s',
                background: filter === f
                  ? (f === 'all' ? 'var(--text)' : DISCIPLINE_META[f].color)
                  : 'var(--surface)',
                color: filter === f ? (f === 'all' ? 'var(--bg)' : 'white') : 'var(--text-2)',
                borderColor: filter === f
                  ? (f === 'all' ? 'var(--text)' : DISCIPLINE_META[f].color)
                  : 'var(--border)',
              }}
            >
              {f === 'all' ? 'Tout' : DISCIPLINE_META[f].label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '16px 20px 0' }}>
        {loading && <p style={{ color: 'var(--text-3)', textAlign: 'center', padding: '40px 0' }}>Chargement…</p>}

        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <p style={{ fontSize: 40, marginBottom: 12 }}>📋</p>
            <p style={{ color: 'var(--text-2)', fontSize: 16 }}>Aucune séance pour l'instant.</p>
            <Link href="/seance" style={{ display: 'inline-block', marginTop: 16 }}>
              <button className="btn-primary" style={{ width: 'auto', padding: '12px 24px' }}>Créer une séance</button>
            </Link>
          </div>
        )}

        {Object.entries(grouped).map(([month, monthSessions]) => (
          <div key={month} style={{ marginBottom: 24 }}>
            <p className="section-title">{month}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {monthSessions.map(session => {
                const meta = DISCIPLINE_META[session.type]
                const Icon = meta.Icon
                return (
                  <div key={session.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '12px 14px' }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: meta.lightColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={18} color={meta.color} />
                    </div>
                    <Link href={`/historique/${session.id}`} style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 500, fontSize: 15 }}>{meta.label}</p>
                      <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                        {format(new Date(session.date), "d MMM", { locale: fr })} · {session.duration_minutes} min · {RESSENTI_EMOJI[session.ressenti]}
                      </p>
                    </Link>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <button
                        onClick={() => handleDelete(session.id)}
                        disabled={deleting === session.id}
                        style={{ color: 'var(--text-3)', padding: 8 }}
                      >
                        <Trash2 size={15} />
                      </button>
                      <Link href={`/historique/${session.id}`}>
                        <ChevronRight size={18} color="var(--text-3)" />
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
