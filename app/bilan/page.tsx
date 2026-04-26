'use client'
import { useState, useEffect } from 'react'
import { format, subWeeks, startOfWeek, endOfWeek } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Download, FileText, FileSpreadsheet, ChevronLeft, ChevronRight } from 'lucide-react'
import { getSessions, getSessionExercises, getAllRuns } from '@/lib/db'
import type { SportSession, SportRun } from '@/types'
import * as XLSX from 'xlsx'

type Period = { start: Date; end: Date; label: string }

function getPeriods(): Period[] {
  const periods: Period[] = []
  for (let i = 0; i < 6; i++) {
    const end = endOfWeek(subWeeks(new Date(), i * 2), { weekStartsOn: 1 })
    const start = startOfWeek(subWeeks(end, 1), { weekStartsOn: 1 })
    periods.push({
      start,
      end,
      label: `${format(start, 'd MMM', { locale: fr })} – ${format(end, 'd MMM yyyy', { locale: fr })}`,
    })
  }
  return periods
}

const RESSENTI_LABEL: Record<number, string> = { 1: '😩 Difficile', 2: '😕 Moyen', 3: '😐 Correct', 4: '😊 Bien', 5: '🔥 Super !' }
const TYPE_LABEL: Record<string, string> = { yoga: 'Yoga', muscu: 'Muscu / HIIT', cardio: 'Course' }
const TYPE_EMOJI: Record<string, string> = { yoga: '🧘', muscu: '💪', cardio: '🏃' }

interface BilanData {
  sessions: SportSession[]
  runs: (SportRun & { session: SportSession })[]
  byType: Record<string, SportSession[]>
  doneCount: number
  plannedCount: number
  avgRessenti: number
  totalMin: number
  totalKm: number
  avgPace: number | null
}

async function buildBilan(start: Date, end: Date): Promise<BilanData> {
  const allSessions = await getSessions(500)
  const sessions = allSessions.filter(s => {
    const d = new Date(s.date)
    return d >= start && d <= end
  })

  const allRuns = await getAllRuns()
  const runs = allRuns.filter(r => {
    const d = new Date(r.session.date)
    return d >= start && d <= end
  })

  const byType: Record<string, SportSession[]> = { yoga: [], muscu: [], cardio: [] }
  for (const s of sessions) byType[s.type]?.push(s)

  const doneCount = sessions.filter(s => s.status === 'done').length
  const plannedCount = sessions.length
  const avgRessenti = sessions.length
    ? Math.round((sessions.reduce((acc, s) => acc + s.ressenti, 0) / sessions.length) * 10) / 10
    : 0
  const totalMin = sessions.reduce((acc, s) => acc + (s.duration_minutes || 0), 0)
  const totalKm = runs.reduce((acc, r) => acc + (r.distance_km || 0), 0)
  const paces = runs.filter(r => r.pace_per_km && r.pace_per_km > 0).map(r => r.pace_per_km!)
  const avgPace = paces.length ? paces.reduce((a, b) => a + b, 0) / paces.length : null

  return { sessions, runs, byType, doneCount, plannedCount, avgRessenti, totalMin, totalKm, avgPace }
}

function formatPace(p: number) {
  return `${Math.floor(p)}:${Math.round((p % 1) * 60).toString().padStart(2, '0')}/km`
}

function generateMarkdown(bilan: BilanData, period: Period): string {
  const completion = bilan.plannedCount > 0 ? Math.round((bilan.doneCount / bilan.plannedCount) * 100) : 0
  const lines: string[] = [
    `# Bilan sportif — ${period.label}`,
    '',
    '## Résumé',
    `- **Séances réalisées** : ${bilan.doneCount} / ${bilan.plannedCount} (${completion}%)`,
    `- **Temps total** : ${bilan.totalMin} minutes`,
    `- **Ressenti moyen** : ${bilan.avgRessenti}/5`,
    '',
    '## Par discipline',
  ]

  for (const [type, sessions] of Object.entries(bilan.byType)) {
    if (sessions.length === 0) continue
    const done = sessions.filter(s => s.status === 'done').length
    const avg = sessions.length ? Math.round((sessions.reduce((a, s) => a + s.ressenti, 0) / sessions.length) * 10) / 10 : 0
    lines.push(`### ${TYPE_EMOJI[type]} ${TYPE_LABEL[type]}`)
    lines.push(`- Séances : ${done}/${sessions.length}`)
    lines.push(`- Ressenti moyen : ${avg}/5`)
    if (type === 'cardio' && bilan.totalKm > 0) {
      lines.push(`- Distance totale : ${Math.round(bilan.totalKm * 10) / 10} km`)
      if (bilan.avgPace) lines.push(`- Allure moyenne : ${formatPace(bilan.avgPace)}`)
    }
    lines.push('')
  }

  lines.push('## Détail des séances')
  for (const s of bilan.sessions) {
    const icon = s.status === 'done' ? '✅' : '📅'
    lines.push(`- ${icon} **${format(new Date(s.date), 'd MMM', { locale: fr })}** — ${TYPE_LABEL[s.type]} (${s.duration_minutes} min) — ${RESSENTI_LABEL[s.ressenti]}${s.notes ? ` — *${s.notes}*` : ''}`)
  }

  lines.push('')
  lines.push('---')
  lines.push('*Généré depuis Mon Sport*')

  return lines.join('\n')
}

function downloadMarkdown(content: string, period: Period) {
  const blob = new Blob([content], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `bilan_sport_${format(period.start, 'yyyy-MM-dd')}.md`
  a.click()
  URL.revokeObjectURL(url)
}

function downloadExcel(bilan: BilanData, period: Period) {
  const wb = XLSX.utils.book_new()

  // Feuille résumé
  const completion = bilan.plannedCount > 0 ? Math.round((bilan.doneCount / bilan.plannedCount) * 100) : 0
  const resumeData = [
    ['Bilan sportif', period.label],
    [],
    ['Séances réalisées', `${bilan.doneCount} / ${bilan.plannedCount}`],
    ['Taux de complétion', `${completion}%`],
    ['Temps total (min)', bilan.totalMin],
    ['Ressenti moyen', bilan.avgRessenti],
    ['Distance course (km)', Math.round(bilan.totalKm * 10) / 10],
    ['Allure moyenne', bilan.avgPace ? formatPace(bilan.avgPace) : '—'],
    [],
    ['Par discipline', 'Séances', 'Faites', 'Ressenti moyen'],
    ...Object.entries(bilan.byType)
      .filter(([, s]) => s.length > 0)
      .map(([type, sessions]) => [
        TYPE_LABEL[type],
        sessions.length,
        sessions.filter(s => s.status === 'done').length,
        sessions.length ? Math.round((sessions.reduce((a, s) => a + s.ressenti, 0) / sessions.length) * 10) / 10 : 0,
      ]),
  ]
  const wsResume = XLSX.utils.aoa_to_sheet(resumeData)
  XLSX.utils.book_append_sheet(wb, wsResume, 'Résumé')

  // Feuille détail séances
  const detailHeaders = ['Date', 'Discipline', 'Durée (min)', 'Statut', 'Ressenti', 'Notes']
  const detailRows = bilan.sessions.map(s => [
    format(new Date(s.date), 'dd/MM/yyyy'),
    TYPE_LABEL[s.type],
    s.duration_minutes,
    s.status === 'done' ? 'Faite' : 'Planifiée',
    s.ressenti,
    s.notes || '',
  ])
  const wsDetail = XLSX.utils.aoa_to_sheet([detailHeaders, ...detailRows])
  XLSX.utils.book_append_sheet(wb, wsDetail, 'Séances')

  // Feuille courses
  if (bilan.runs.length > 0) {
    const runHeaders = ['Date', 'Distance (km)', 'Durée (min)', 'Allure (/km)', 'Ressenti']
    const runRows = bilan.runs.map(r => [
      format(new Date(r.session.date), 'dd/MM/yyyy'),
      r.distance_km,
      Math.round(r.duration_seconds / 60),
      r.pace_per_km ? formatPace(r.pace_per_km) : '—',
      r.session.ressenti,
    ])
    const wsRuns = XLSX.utils.aoa_to_sheet([runHeaders, ...runRows])
    XLSX.utils.book_append_sheet(wb, wsRuns, 'Courses')
  }

  XLSX.writeFile(wb, `bilan_sport_${format(period.start, 'yyyy-MM-dd')}.xlsx`)
}

export default function BilanPage() {
  const periods = getPeriods()
  const [periodIdx, setPeriodIdx] = useState(0)
  const [bilan, setBilan] = useState<BilanData | null>(null)
  const [loading, setLoading] = useState(true)
  const [markdown, setMarkdown] = useState('')

  const period = periods[periodIdx]

  useEffect(() => {
    setLoading(true)
    buildBilan(period.start, period.end)
      .then(b => {
        setBilan(b)
        setMarkdown(generateMarkdown(b, period))
      })
      .finally(() => setLoading(false))
  }, [periodIdx])

  const completion = bilan ? (bilan.plannedCount > 0 ? Math.round((bilan.doneCount / bilan.plannedCount) * 100) : 0) : 0

  return (
    <div className="page">
      {/* Header */}
      <div style={{ padding: '56px 20px 16px', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>Bilan</h1>
        <p style={{ fontSize: 14, color: 'var(--text-2)', marginTop: 4 }}>Rapport bi-mensuel exportable</p>

        {/* Sélecteur de période */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
          <button
            onClick={() => setPeriodIdx(i => Math.min(i + 1, periods.length - 1))}
            disabled={periodIdx >= periods.length - 1}
            style={{ padding: 8, color: periodIdx >= periods.length - 1 ? 'var(--text-3)' : 'var(--text)', background: 'var(--surface2)', borderRadius: 8, border: 'none' }}
          >
            <ChevronLeft size={18} />
          </button>
          <p style={{ flex: 1, textAlign: 'center', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14 }}>
            {period.label}
          </p>
          <button
            onClick={() => setPeriodIdx(i => Math.max(i - 1, 0))}
            disabled={periodIdx === 0}
            style={{ padding: 8, color: periodIdx === 0 ? 'var(--text-3)' : 'var(--text)', background: 'var(--surface2)', borderRadius: 8, border: 'none' }}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div style={{ padding: '20px 20px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {loading && <p style={{ color: 'var(--text-3)', textAlign: 'center', padding: '40px 0' }}>Chargement…</p>}

        {!loading && bilan && (
          <>
            {/* Stats globales */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { label: 'Complétion', value: `${completion}%`, sub: `${bilan.doneCount}/${bilan.plannedCount} séances`, color: completion >= 75 ? 'var(--cardio)' : completion >= 50 ? 'var(--accent)' : 'var(--muscu)' },
                { label: 'Temps total', value: `${bilan.totalMin}`, sub: 'minutes actives', color: 'var(--text)' },
                { label: 'Ressenti moyen', value: `${bilan.avgRessenti}/5`, sub: RESSENTI_LABEL[Math.round(bilan.avgRessenti)] || '', color: 'var(--yoga)' },
                { label: 'Distance', value: bilan.totalKm > 0 ? `${Math.round(bilan.totalKm * 10) / 10} km` : '—', sub: bilan.avgPace ? `Allure ${formatPace(bilan.avgPace)}` : 'aucune course', color: 'var(--cardio)' },
              ].map(({ label, value, sub, color }) => (
                <div key={label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px' }}>
                  <p style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-display)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</p>
                  <p style={{ fontSize: 26, fontWeight: 800, fontFamily: 'var(--font-display)', marginTop: 4, color }}>{value}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{sub}</p>
                </div>
              ))}
            </div>

            {/* Par discipline */}
            <div>
              <p className="section-title">Par discipline</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {Object.entries(bilan.byType).filter(([, s]) => s.length > 0).map(([type, sessions]) => {
                  const done = sessions.filter(s => s.status === 'done').length
                  const avg = sessions.length ? Math.round((sessions.reduce((a, s) => a + s.ressenti, 0) / sessions.length) * 10) / 10 : 0
                  const pct = Math.round((done / sessions.length) * 100)
                  const colors: Record<string, string> = { yoga: 'var(--yoga)', muscu: 'var(--muscu)', cardio: 'var(--cardio)' }
                  return (
                    <div key={type} className="card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <p style={{ fontWeight: 700, fontSize: 15 }}>{TYPE_EMOJI[type]} {TYPE_LABEL[type]}</p>
                        <p style={{ fontSize: 13, color: 'var(--text-3)' }}>{done}/{sessions.length} · {avg}/5 😊</p>
                      </div>
                      <div style={{ height: 6, background: 'var(--surface2)', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: colors[type], borderRadius: 99 }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Détail séances */}
            <div>
              <p className="section-title">Séances ({bilan.sessions.length})</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {bilan.sessions.length === 0 && (
                  <p style={{ color: 'var(--text-3)', textAlign: 'center', padding: '20px 0' }}>Aucune séance sur cette période</p>
                )}
                {bilan.sessions.map(s => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
                    <p style={{ fontSize: 18 }}>{s.status === 'done' ? '✅' : '📅'}</p>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 500 }}>
                        {format(new Date(s.date), 'd MMM', { locale: fr })} · {TYPE_LABEL[s.type]} · {s.duration_minutes} min
                      </p>
                      {s.notes && <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.notes}</p>}
                    </div>
                    <p style={{ fontSize: 16, flexShrink: 0 }}>{RESSENTI_LABEL[s.ressenti]?.split(' ')[0]}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Aperçu markdown */}
            <div>
              <p className="section-title">Aperçu export texte</p>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px', maxHeight: 200, overflowY: 'auto' }}>
                <pre style={{ fontSize: 11, color: 'var(--text-2)', whiteSpace: 'pre-wrap', fontFamily: 'monospace', margin: 0 }}>{markdown}</pre>
              </div>
            </div>

            {/* Boutons export */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 8 }}>
              <button
                className="btn-primary"
                onClick={() => downloadMarkdown(markdown, period)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                <FileText size={17} /> Exporter en Markdown (.md)
              </button>
              <button
                className="btn-secondary"
                onClick={() => bilan && downloadExcel(bilan, period)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                <FileSpreadsheet size={17} /> Exporter en Excel (.xlsx)
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
