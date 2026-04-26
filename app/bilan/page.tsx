'use client'
import { useState, useEffect } from 'react'
import { format, subWeeks, startOfWeek, endOfWeek } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Download, ChevronLeft, ChevronRight } from 'lucide-react'
import { getSessions, getAllRuns } from '@/lib/db'
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

interface BilanQuestionnaire {
  sante: string
  difficulte: 'trop_facile' | 'adapte' | 'trop_dur' | ''
  aime: string
  ameliorer: string
  douleurs: string
  motivation: 1 | 2 | 3 | 4 | 5 | null
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

function generateMarkdown(bilan: BilanData, period: Period, questionnaire?: BilanQuestionnaire): string {
  const completion = bilan.plannedCount > 0 ? Math.round((bilan.doneCount / bilan.plannedCount) * 100) : 0
  const lines: string[] = [
    `# Bilan sportif — ${period.label}`,
    '',
    '## 📊 Statistiques',
    `- **Séances réalisées** : ${bilan.doneCount} / ${bilan.plannedCount} (${completion}%)`,
    `- **Temps total** : ${bilan.totalMin} minutes`,
    `- **Ressenti moyen** : ${bilan.avgRessenti}/5`,
  ]
  if (bilan.totalKm > 0) lines.push(`- **Distance course** : ${Math.round(bilan.totalKm * 10) / 10} km`)
  if (bilan.avgPace) lines.push(`- **Allure moyenne** : ${formatPace(bilan.avgPace)}`)

  lines.push('', '## 📋 Par discipline')
  for (const [type, sessions] of Object.entries(bilan.byType)) {
    if (sessions.length === 0) continue
    const done = sessions.filter(s => s.status === 'done').length
    const avg = sessions.length ? Math.round((sessions.reduce((a, s) => a + s.ressenti, 0) / sessions.length) * 10) / 10 : 0
    lines.push(`### ${TYPE_EMOJI[type]} ${TYPE_LABEL[type]}`)
    lines.push(`- ${done}/${sessions.length} séances · Ressenti moyen ${avg}/5`)
    if (type === 'cardio' && bilan.totalKm > 0) {
      lines.push(`- Distance : ${Math.round(bilan.totalKm * 10) / 10} km`)
      if (bilan.avgPace) lines.push(`- Allure moyenne : ${formatPace(bilan.avgPace)}`)
    }
  }

  const withFeedback = bilan.sessions.filter(s => s.feedback)
  if (withFeedback.length > 0) {
    lines.push('', '## 💬 Comptes-rendus de séances')
    for (const s of withFeedback) {
      const f = s.feedback!
      lines.push(`### ${format(new Date(s.date), 'd MMM', { locale: fr })} — ${TYPE_LABEL[s.type]}`)
      lines.push(`- Ressenti : ${f.ressenti}/5`)
      if (f.courbatures?.length) lines.push(`- Courbatures : ${f.courbatures.join(', ')}`)
      if (f.bien) lines.push(`- ✅ Ce qui s'est bien passé : ${f.bien}`)
      if (f.difficile) lines.push(`- ⚠️ Ce qui était difficile : ${f.difficile}`)
    }
  }

  lines.push('', '## 📅 Détail des séances')
  for (const s of bilan.sessions) {
    const icon = s.status === 'done' ? '✅' : '📅'
    lines.push(`- ${icon} **${format(new Date(s.date), 'd MMM', { locale: fr })}** — ${TYPE_LABEL[s.type]} (${s.duration_minutes} min)${s.notes ? ` — *${s.notes}*` : ''}`)
  }

  if (questionnaire) {
    const DIFF_LABEL: Record<string, string> = { trop_facile: 'Trop facile', adapte: 'Bien adapté', trop_dur: 'Trop difficile' }
    lines.push('', '## 🧠 Bilan global')
    if (questionnaire.motivation) lines.push(`- **Motivation** : ${questionnaire.motivation}/5`)
    if (questionnaire.sante) lines.push(`- **Forme physique** : ${questionnaire.sante}`)
    if (questionnaire.difficulte) lines.push(`- **Niveau du programme** : ${DIFF_LABEL[questionnaire.difficulte] || questionnaire.difficulte}`)
    if (questionnaire.aime) lines.push(`- **Ce que j'ai aimé** : ${questionnaire.aime}`)
    if (questionnaire.ameliorer) lines.push(`- **Ce que je veux améliorer** : ${questionnaire.ameliorer}`)
    if (questionnaire.douleurs) lines.push(`- **Douleurs / blessures** : ${questionnaire.douleurs}`)
  }

  lines.push('', '---', '*Généré depuis Mon Sport*')
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

function downloadExcel(bilan: BilanData, period: Period, questionnaire?: BilanQuestionnaire) {
  const wb = XLSX.utils.book_new()
  const completion = bilan.plannedCount > 0 ? Math.round((bilan.doneCount / bilan.plannedCount) * 100) : 0
  const resumeData: (string | number)[][] = [
    ['Bilan sportif', period.label],
    [],
    ['Séances réalisées', `${bilan.doneCount} / ${bilan.plannedCount}`],
    ['Taux de complétion', `${completion}%`],
    ['Temps total (min)', bilan.totalMin],
    ['Distance course (km)', Math.round(bilan.totalKm * 10) / 10],
    ['Allure moyenne', bilan.avgPace ? formatPace(bilan.avgPace) : '—'],
    [],
    ['Par discipline', 'Séances', 'Faites'],
    ...Object.entries(bilan.byType)
      .filter(([, s]) => s.length > 0)
      .map(([type, sessions]) => [
        TYPE_LABEL[type],
        sessions.length,
        sessions.filter(s => s.status === 'done').length,
      ]),
  ]
  if (questionnaire) {
    const DIFF_LABEL: Record<string, string> = { trop_facile: 'Trop facile', adapte: 'Bien adapté', trop_dur: 'Trop difficile' }
    resumeData.push(
      [],
      ['Bilan global'],
      ['Motivation', questionnaire.motivation ? `${questionnaire.motivation}/5` : '—'],
      ['Forme physique', questionnaire.sante || '—'],
      ['Niveau programme', questionnaire.difficulte ? DIFF_LABEL[questionnaire.difficulte] : '—'],
      ["Ce que j'ai aimé", questionnaire.aime || '—'],
      ['À améliorer', questionnaire.ameliorer || '—'],
      ['Douleurs', questionnaire.douleurs || '—'],
    )
  }
  const wsResume = XLSX.utils.aoa_to_sheet(resumeData)
  XLSX.utils.book_append_sheet(wb, wsResume, 'Résumé')

  const detailHeaders = ['Date', 'Discipline', 'Durée (min)', 'Statut', 'Notes']
  const detailRows = bilan.sessions.map(s => [
    format(new Date(s.date), 'dd/MM/yyyy'),
    TYPE_LABEL[s.type],
    s.duration_minutes,
    s.status === 'done' ? 'Faite' : 'Planifiée',
    s.notes || '',
  ])
  const wsDetail = XLSX.utils.aoa_to_sheet([detailHeaders, ...detailRows])
  XLSX.utils.book_append_sheet(wb, wsDetail, 'Séances')

  if (bilan.runs.length > 0) {
    const runHeaders = ['Date', 'Distance (km)', 'Durée (min)', 'Allure (/km)']
    const runRows = bilan.runs.map(r => [
      format(new Date(r.session.date), 'dd/MM/yyyy'),
      r.distance_km,
      Math.round(r.duration_seconds / 60),
      r.pace_per_km ? formatPace(r.pace_per_km) : '—',
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
  const [questionnaire, setQuestionnaire] = useState<BilanQuestionnaire>({
    sante: '',
    difficulte: '',
    aime: '',
    ameliorer: '',
    douleurs: '',
    motivation: null,
  })
  const [questionnaireStep, setQuestionnaireStep] = useState<'stats' | 'questions' | 'done'>('stats')

  const period = periods[periodIdx]

  useEffect(() => {
    localStorage.setItem('lastBilanDate', new Date().toISOString())
  }, [])

  useEffect(() => {
    setLoading(true)
    buildBilan(period.start, period.end)
      .then(b => {
        setBilan(b)
        setMarkdown(generateMarkdown(b, period))
      })
      .finally(() => setLoading(false))
  }, [periodIdx])

  useEffect(() => {
    setQuestionnaireStep('stats')
    setQuestionnaire({ sante: '', difficulte: '', aime: '', ameliorer: '', douleurs: '', motivation: null })
  }, [periodIdx])

  const completion = bilan ? (bilan.plannedCount > 0 ? Math.round((bilan.doneCount / bilan.plannedCount) * 100) : 0) : 0

  return (
    <div className="page">
      {/* Header */}
      <div style={{ padding: '56px 20px 16px', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>Bilan</h1>
        <p style={{ fontSize: 14, color: 'var(--text-2)', marginTop: 4 }}>Rapport bi-mensuel exportable</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
          <button
            onClick={() => setPeriodIdx(i => Math.min(i + 1, periods.length - 1))}
            disabled={periodIdx >= periods.length - 1}
            style={{ padding: 8, color: periodIdx >= periods.length - 1 ? 'var(--text-3)' : 'var(--text)', background: 'var(--surface2)', borderRadius: 8, border: 'none', cursor: 'pointer' }}
          >
            <ChevronLeft size={18} />
          </button>
          <p style={{ flex: 1, textAlign: 'center', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14 }}>
            {period.label}
          </p>
          <button
            onClick={() => setPeriodIdx(i => Math.max(i - 1, 0))}
            disabled={periodIdx === 0}
            style={{ padding: 8, color: periodIdx === 0 ? 'var(--text-3)' : 'var(--text)', background: 'var(--surface2)', borderRadius: 8, border: 'none', cursor: 'pointer' }}
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
                  const pct = Math.round((done / sessions.length) * 100)
                  const colors: Record<string, string> = { yoga: 'var(--yoga)', muscu: 'var(--muscu)', cardio: 'var(--cardio)' }
                  return (
                    <div key={type} className="card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <p style={{ fontWeight: 700, fontSize: 15 }}>{TYPE_EMOJI[type]} {TYPE_LABEL[type]}</p>
                        <p style={{ fontSize: 13, color: 'var(--text-3)' }}>{done}/{sessions.length}</p>
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

            {/* Bouton vers questionnaire */}
            {questionnaireStep === 'stats' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 8 }}>
                <button
                  className="btn-primary"
                  onClick={() => setQuestionnaireStep('questions')}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  Remplir le bilan →
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => { downloadMarkdown(markdown, period); downloadExcel(bilan, period) }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  <Download size={17} /> Exporter sans questionnaire
                </button>
              </div>
            )}

            {/* Questionnaire */}
            {questionnaireStep === 'questions' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 8 }} className="animate-up">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                  <button onClick={() => setQuestionnaireStep('stats')} style={{ color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 20 }}>←</button>
                  <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18 }}>Bilan global</p>
                </div>

                {/* Motivation */}
                <div>
                  <label className="field-label">Niveau de motivation ces 2 semaines</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {([1, 2, 3, 4, 5] as const).map(v => (
                      <button key={v} onClick={() => setQuestionnaire(q => ({ ...q, motivation: v }))}
                        style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: '1px solid',
                          background: questionnaire.motivation === v ? 'var(--accent-light)' : 'var(--surface)',
                          borderColor: questionnaire.motivation === v ? 'var(--accent)' : 'var(--border)',
                          fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, cursor: 'pointer',
                        }}>
                        {v}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                    <p style={{ fontSize: 10, color: 'var(--text-3)' }}>Nulle</p>
                    <p style={{ fontSize: 10, color: 'var(--text-3)' }}>Au top</p>
                  </div>
                </div>

                {/* Forme physique */}
                <div>
                  <label className="field-label">Comment tu te sens physiquement ?</label>
                  <textarea className="input-field" rows={2} style={{ resize: 'none' }}
                    placeholder="Fatigue, énergie, récupération..."
                    value={questionnaire.sante}
                    onChange={e => setQuestionnaire(q => ({ ...q, sante: e.target.value }))}
                  />
                </div>

                {/* Niveau du programme */}
                <div>
                  <label className="field-label">Le programme était...</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[
                      { val: 'trop_facile', label: '😴 Trop facile' },
                      { val: 'adapte', label: '✅ Adapté' },
                      { val: 'trop_dur', label: '😤 Trop dur' },
                    ].map(({ val, label }) => (
                      <button key={val}
                        onClick={() => setQuestionnaire(q => ({ ...q, difficulte: val as BilanQuestionnaire['difficulte'] }))}
                        style={{ flex: 1, padding: '10px 4px', borderRadius: 12, border: '1px solid', fontSize: 12,
                          fontFamily: 'var(--font-display)', fontWeight: 600, cursor: 'pointer',
                          background: questionnaire.difficulte === val ? 'var(--surface2)' : 'var(--surface)',
                          borderColor: questionnaire.difficulte === val ? 'var(--text)' : 'var(--border)',
                        }}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Ce que j'ai aimé */}
                <div>
                  <label className="field-label">Ce que tu as aimé</label>
                  <textarea className="input-field" rows={2} style={{ resize: 'none' }}
                    placeholder="Exercices, progression, ambiance..."
                    value={questionnaire.aime}
                    onChange={e => setQuestionnaire(q => ({ ...q, aime: e.target.value }))}
                  />
                </div>

                {/* À améliorer */}
                <div>
                  <label className="field-label">Ce que tu veux améliorer ou changer</label>
                  <textarea className="input-field" rows={2} style={{ resize: 'none' }}
                    placeholder="Fréquence, intensité, type de séances..."
                    value={questionnaire.ameliorer}
                    onChange={e => setQuestionnaire(q => ({ ...q, ameliorer: e.target.value }))}
                  />
                </div>

                {/* Douleurs */}
                <div>
                  <label className="field-label">Douleurs ou blessures ?</label>
                  <textarea className="input-field" rows={2} style={{ resize: 'none' }}
                    placeholder="Aucune, ou décris si besoin..."
                    value={questionnaire.douleurs}
                    onChange={e => setQuestionnaire(q => ({ ...q, douleurs: e.target.value }))}
                  />
                </div>

                <button
                  className="btn-primary"
                  onClick={() => {
                    const md = generateMarkdown(bilan!, period, questionnaire)
                    setMarkdown(md)
                    downloadMarkdown(md, period)
                    downloadExcel(bilan!, period, questionnaire)
                    setQuestionnaireStep('done')
                  }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  <Download size={17} /> Exporter le bilan complet
                </button>
              </div>
            )}

            {/* Confirmation */}
            {questionnaireStep === 'done' && (
              <div style={{ background: 'var(--cardio-light)', border: '1px solid var(--cardio)', borderRadius: 14, padding: '20px', textAlign: 'center', marginBottom: 8 }} className="animate-up">
                <p style={{ fontSize: 32, marginBottom: 8 }}>📥</p>
                <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: 'var(--cardio-dark)' }}>Bilan exporté !</p>
                <p style={{ fontSize: 13, color: 'var(--cardio-dark)', marginTop: 6, lineHeight: 1.5 }}>
                  Le fichier .md est prêt à coller dans ta conversation Claude, le .xlsx pour tes archives.
                </p>
                <button onClick={() => setQuestionnaireStep('questions')}
                  style={{ fontSize: 12, color: 'var(--cardio-dark)', marginTop: 12, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                  Modifier les réponses
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
