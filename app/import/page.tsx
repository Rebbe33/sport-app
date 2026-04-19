'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, FileSpreadsheet, CheckCircle, XCircle, AlertCircle, ChevronLeft } from 'lucide-react'
import * as XLSX from 'xlsx'
import { createSession, createRun, addYogaPose, addSessionExercise, createExercise } from '@/lib/db'
import type { DisciplineType, Ressenti } from '@/types'

type RowStatus = 'pending' | 'success' | 'error' | 'skipped'

interface ParsedRow {
  index: number
  date: string
  type: DisciplineType
  duration: number
  ressenti: Ressenti
  status: 'planned' | 'done'
  notes: string
  poses: string
  exercises: string
  muscleGroup: string
  runData: string
  rowStatus: RowStatus
  error?: string
}

function parseDate(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === '') return null

  // Objet Date natif (retourné par xlsx avec cellDates: true)
  if (raw instanceof Date) {
    if (isNaN(raw.getTime())) return null
    const y = raw.getFullYear()
    const m = String(raw.getMonth() + 1).padStart(2, '0')
    const d = String(raw.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  // Nombre série Excel (fallback)
  if (typeof raw === 'number') {
    const date = new Date((raw - 25569) * 86400 * 1000)
    if (isNaN(date.getTime())) return null
    const y = date.getUTCFullYear()
    const m = String(date.getUTCMonth() + 1).padStart(2, '0')
    const d = String(date.getUTCDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  const str = String(raw).trim()
  if (!str) return null

  // DD/MM/YYYY ou DD-MM-YYYY ou DD.MM.YYYY
  const dmy = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/)
  if (dmy) {
    const [, d, m, y] = dmy
    const year = y.length === 2 ? `20${y}` : y
    return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  // ISO YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10)

  return null
}

function parseRows(data: Record<string, unknown>[]): ParsedRow[] {
  if (data.length > 0) console.log('Première ligne brute:', JSON.stringify(data[0]))
  return data.map((row, i) => {
    const raw = (col: string) => {
      const val = row[col] ?? row[col.toLowerCase()] ?? ''
      return String(val).trim()
    }

   const dateKey = Object.keys(row).find(k => k.includes('Date') || k.includes('date')) || ''
const typeKey = Object.keys(row).find(k => k.includes('Type') || k.includes('type')) || ''
const dureeKey = Object.keys(row).find(k => (k.includes('ur') && !k.includes('Dist') && !k.includes('dist'))) || ''
const ressentiKey = Object.keys(row).find(k => k.includes('essenti')) || ''
const statutKey = Object.keys(row).find(k => k.includes('tatut')) || ''
const notesKey = Object.keys(row).find(k => k.includes('otes') || k.includes('rotocole')) || ''
const posesKey = Object.keys(row).find(k => k.includes('osture') || k.includes('YOGA')) || ''
const exosKey = Object.keys(row).find(k => k.includes('xercice') || k.includes('MUSCU')) || ''
const muscleKey = Object.keys(row).find(k => k.includes('roupe')) || ''
const runKey = Object.keys(row).find(k => k.includes('Dist') || k.includes('dist') || k.includes('CARDIO')) || ''
    if (i === 0) console.log('Keys détectées:', { posesKey, exosKey, runKey })
    
const dateStr = parseDate(row[dateKey])
    const type = String(row[typeKey] ?? '').trim().toLowerCase() as DisciplineType
const duration = parseInt(String(row[dureeKey] ?? '0'))
const ressenti = Math.min(5, Math.max(1, parseInt(String(row[ressentiKey] ?? '3')))) as Ressenti
const status = String(row[statutKey] ?? '').toLowerCase() === 'done' ? 'done' : 'planned'
const notes = String(row[notesKey] ?? '').trim()
const poses = String(row[posesKey] ?? '').trim()
const exercises = String(row[exosKey] ?? '').trim()
const muscleGroup = String(row[muscleKey] ?? '').trim()
const runData = String(row[runKey] ?? '').trim()

    let error: string | undefined
    if (!dateStr) error = 'Date invalide'
    else if (!['yoga', 'muscu', 'cardio'].includes(type)) error = `Type invalide : "${type}"`
    else if (!duration || duration <= 0) error = 'Durée invalide'

    return {
      index: i + 1,
      date: dateStr || '',
      type,
      duration,
      ressenti,
      status: status as 'planned' | 'done',
      notes,
      poses,
      exercises,
      muscleGroup,
      runData,
      rowStatus: error ? 'error' : 'pending',
      error,
    }
  })
}

async function importRow(row: ParsedRow): Promise<void> {
  const session = await createSession({
    type: row.type,
    date: row.date,
    duration_minutes: row.duration,
    ressenti: row.ressenti,
    status: row.status,
    notes: row.notes || undefined,
  })

  if (row.type === 'yoga' && row.poses) {
    for (const p of row.poses.split(';')) {
      const name = p.trim()
      if (name) await addYogaPose({ session_id: session.id, name, duration_seconds: 60 })
    }
  }

  if (row.type === 'muscu' && row.exercises) {
    const items = row.exercises.split(';')
    for (let i = 0; i < items.length; i++) {
      const raw = items[i].trim()
if (!raw) continue
const parts = raw.split(':')
const name = parts[0]?.trim()
if (!name) continue
const sets = parts[1] ? parseInt(parts[1].trim()) : 3
const reps = parts[2] ? parseInt(parts[2].trim()) : 10
const weight = parts[3] ? parseFloat(parts[3].trim()) : 0
      const ex = await createExercise({ name, muscle_group: row.muscleGroup || '', is_hiit: false })
      await addSessionExercise({ session_id: session.id, exercise_id: ex.id, sets, reps, weight_kg: weight || undefined, order_index: i })
    }
  }

  if (row.type === 'cardio' && row.runData) {
    const parts = row.runData.split('|')
    const distanceKm = parseFloat(parts[0]?.trim() || '0')
    const durationMin = parseFloat(parts[1]?.trim() || '0')
    if (distanceKm > 0 && durationMin > 0) {
      await createRun({ session_id: session.id, distance_km: distanceKm, duration_seconds: durationMin * 60 })
    }
  }
}

const DISCIPLINE_COLORS: Record<DisciplineType, string> = {
  yoga: 'var(--yoga)',
  muscu: 'var(--muscu)',
  cardio: 'var(--cardio)',
}

export default function ImportPage() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [importing, setImporting] = useState(false)
  const [done, setDone] = useState(false)
  const [fileName, setFileName] = useState('')

  const handleFile = (file: File) => {
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer)
      const wb = XLSX.read(data, { type: 'array', cellDates: true, dateNF: 'yyyy-mm-dd' })
      const sheetName = wb.SheetNames.find(n => 
  n.toLowerCase().includes('programme') || n.toLowerCase().includes('séance') || n.toLowerCase() === 'sheet1'
) || wb.SheetNames[0]
const ws = wb.Sheets[sheetName]
      console.log('Onglet utilisé:', sheetName, '— Tous les onglets:', wb.SheetNames)
      const json = XLSX.utils.sheet_to_json(ws, { 
  defval: '',
  range: 2  // saute les 2 premières lignes (titre + sous-titre), utilise la ligne 3 comme en-têtes
}) as Record<string, unknown>[]
      const filtered = json.filter((row: Record<string, unknown>) => {
  const date = row['Date\n(JJ/MM/AAAA)'] ?? row['Date'] ?? ''
  return String(date).trim() !== '' && String(date).trim() !== 'Date\n(JJ/MM/AAAA)'
})
setRows(parseRows(filtered))
      setDone(false)
    }
    reader.readAsArrayBuffer(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const handleImport = async () => {
    const valid = rows.filter(r => r.rowStatus === 'pending')
    if (!valid.length) return
    setImporting(true)
    const updated = [...rows]
    for (const row of valid) {
      try {
        await importRow(row)
        updated[row.index - 1] = { ...row, rowStatus: 'success' }
      } catch (e) {
        updated[row.index - 1] = { ...row, rowStatus: 'error', error: 'Erreur Supabase' }
      }
      setRows([...updated])
    }
    setImporting(false)
    setDone(true)
  }

  const validCount = rows.filter(r => r.rowStatus === 'pending').length
  const errorCount = rows.filter(r => r.rowStatus === 'error').length
  const successCount = rows.filter(r => r.rowStatus === 'success').length

  return (
    <div className="page">
      {/* Header */}
      <div style={{ padding: '56px 20px 16px', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <button onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-2)', fontSize: 14, marginBottom: 12 }}>
          <ChevronLeft size={18} /> Retour
        </button>
        <h1 style={{ fontSize: 26, fontWeight: 800 }}>Importer un programme</h1>
        <p style={{ fontSize: 14, color: 'var(--text-2)', marginTop: 4 }}>Fichier .xlsx formaté avec le modèle fourni</p>
      </div>

      <div style={{ padding: '20px 20px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Zone de drop */}
        {rows.length === 0 && (
          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => inputRef.current?.click()}
            style={{
              border: '2px dashed var(--border-strong)', borderRadius: 20,
              padding: '48px 20px', textAlign: 'center', cursor: 'pointer',
              background: 'var(--surface)', transition: 'border-color 0.15s',
            }}
          >
            <input ref={inputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }}
              onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
            <FileSpreadsheet size={40} color="var(--text-3)" style={{ margin: '0 auto 12px' }} />
            <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16 }}>
              Dépose ton fichier ici
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 6 }}>
              ou appuie pour choisir un fichier .xlsx
            </p>
          </div>
        )}

        {/* Résumé fichier chargé */}
        {rows.length > 0 && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <FileSpreadsheet size={20} color="var(--text-2)" />
              <p style={{ fontWeight: 500, fontSize: 14, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileName}</p>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <div style={{ flex: 1, background: 'var(--cardio-light)', borderRadius: 10, padding: '8px 12px', textAlign: 'center' }}>
                <p style={{ fontSize: 20, fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--cardio)' }}>{validCount}</p>
                <p style={{ fontSize: 11, color: 'var(--cardio-dark)', fontFamily: 'var(--font-display)', fontWeight: 600 }}>À importer</p>
              </div>
              {successCount > 0 && (
                <div style={{ flex: 1, background: '#E8F5E9', borderRadius: 10, padding: '8px 12px', textAlign: 'center' }}>
                  <p style={{ fontSize: 20, fontWeight: 800, fontFamily: 'var(--font-display)', color: '#2E7D32' }}>{successCount}</p>
                  <p style={{ fontSize: 11, color: '#2E7D32', fontFamily: 'var(--font-display)', fontWeight: 600 }}>Importées</p>
                </div>
              )}
              {errorCount > 0 && (
                <div style={{ flex: 1, background: '#FFEBEE', borderRadius: 10, padding: '8px 12px', textAlign: 'center' }}>
                  <p style={{ fontSize: 20, fontWeight: 800, fontFamily: 'var(--font-display)', color: '#C62828' }}>{errorCount}</p>
                  <p style={{ fontSize: 11, color: '#C62828', fontFamily: 'var(--font-display)', fontWeight: 600 }}>Erreurs</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Aperçu des lignes */}
        {rows.length > 0 && (
          <div>
            <p className="section-title">Aperçu ({rows.length} lignes)</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {rows.map(row => (
                <div key={row.index} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px', borderRadius: 12, background: 'var(--surface)',
                  border: `1px solid ${row.rowStatus === 'error' ? '#FFCDD2' : row.rowStatus === 'success' ? '#C8E6C9' : 'var(--border)'}`,
                  opacity: row.rowStatus === 'success' ? 0.6 : 1,
                }}>
                  {/* Icône statut */}
                  {row.rowStatus === 'success' && <CheckCircle size={16} color="#2E7D32" style={{ flexShrink: 0 }} />}
                  {row.rowStatus === 'error' && <XCircle size={16} color="#C62828" style={{ flexShrink: 0 }} />}
                  {row.rowStatus === 'pending' && <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'var(--surface2)', flexShrink: 0 }} />}

                  {/* Discipline dot */}
                  {row.rowStatus !== 'error' && (
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: DISCIPLINE_COLORS[row.type] || 'var(--text-3)', flexShrink: 0 }} />
                  )}

                  <div style={{ flex: 1, minWidth: 0 }}>
                    {row.error ? (
                      <p style={{ fontSize: 13, color: '#C62828' }}>Ligne {row.index} — {row.error}</p>
                    ) : (
                      <>
                        <p style={{ fontSize: 13, fontWeight: 500 }}>
                          {row.date} · {row.type} · {row.duration} min
                        </p>
                        <p style={{ fontSize: 11, color: 'var(--text-3)' }}>
                          Ressenti {row.ressenti}/5 · {row.status === 'done' ? '✅ faite' : '🗓 planifiée'}
                          {row.notes ? ` · ${row.notes.slice(0, 30)}…` : ''}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        {rows.length > 0 && !done && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              className="btn-primary"
              onClick={handleImport}
              disabled={importing || validCount === 0}
              style={{ opacity: validCount === 0 ? 0.5 : 1 }}
            >
              {importing
                ? `Import en cours… (${successCount}/${validCount + successCount})`
                : `Importer ${validCount} séance${validCount > 1 ? 's' : ''}`}
            </button>
            <button className="btn-secondary" onClick={() => { setRows([]); setFileName('') }}>
              Changer de fichier
            </button>
          </div>
        )}

        {done && (
          <div style={{ background: '#E8F5E9', border: '1px solid #A5D6A7', borderRadius: 16, padding: '20px', textAlign: 'center' }} className="animate-up">
            <p style={{ fontSize: 36 }}>🎉</p>
            <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, marginTop: 8, color: '#1B5E20' }}>
              {successCount} séance{successCount > 1 ? 's' : ''} importée{successCount > 1 ? 's' : ''} !
            </p>
            {errorCount > 0 && (
              <p style={{ fontSize: 13, color: '#C62828', marginTop: 6 }}>{errorCount} ligne{errorCount > 1 ? 's' : ''} en erreur — vérifie le format</p>
            )}
            <button className="btn-primary" style={{ marginTop: 16, background: '#2E7D32' }} onClick={() => router.push('/')}>
              Voir mon planning
            </button>
          </div>
        )}

        {/* Info format */}
        {rows.length === 0 && (
          <div style={{ background: 'var(--accent-light)', border: '1px solid #E8D5A0', borderRadius: 14, padding: '14px 16px' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <AlertCircle size={16} color="var(--accent)" style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#8B6914' }}>Utilise le modèle Excel fourni</p>
                <p style={{ fontSize: 12, color: '#8B6914', marginTop: 3, lineHeight: 1.5 }}>
                  Télécharge le fichier <strong>programme_sport_modele.xlsx</strong> et remplis-le. La feuille "Guide" explique chaque colonne.
                </p>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
