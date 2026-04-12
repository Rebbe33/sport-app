import { supabase } from './supabase'
import type { SportSession, SportExercise, SportYogaPose, SportRun, SportSessionExercise, DisciplineType } from '@/types'

// ── Sessions ──────────────────────────────────────────────

export async function getSessions(limit = 50): Promise<SportSession[]> {
  const { data, error } = await supabase
    .from('sport_sessions')
    .select('*')
    .order('date', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data || []
}

export async function getSessionsByWeek(startDate: string, endDate: string): Promise<SportSession[]> {
  const { data, error } = await supabase
    .from('sport_sessions')
    .select('*')
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true })
  if (error) throw error
  return data || []
}

export async function createSession(session: Omit<SportSession, 'id' | 'created_at'>): Promise<SportSession> {
  const { data, error } = await supabase
    .from('sport_sessions')
    .insert(session)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteSession(id: string): Promise<void> {
  const { error } = await supabase.from('sport_sessions').delete().eq('id', id)
  if (error) throw error
}

// ── Exercises (muscu/HIIT) ────────────────────────────────

export async function getExercises(): Promise<SportExercise[]> {
  const { data, error } = await supabase
    .from('sport_exercises')
    .select('*')
    .order('name')
  if (error) throw error
  return data || []
}

export async function createExercise(exercise: Omit<SportExercise, 'id'>): Promise<SportExercise> {
  const { data, error } = await supabase
    .from('sport_exercises')
    .insert(exercise)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getSessionExercises(sessionId: string): Promise<(SportSessionExercise & { exercise: SportExercise })[]> {
  const { data, error } = await supabase
    .from('sport_session_exercises')
    .select('*, exercise:sport_exercises(*)')
    .eq('session_id', sessionId)
    .order('order_index')
  if (error) throw error
  return data || []
}

export async function addSessionExercise(entry: Omit<SportSessionExercise, 'id'>): Promise<SportSessionExercise> {
  const { data, error } = await supabase
    .from('sport_session_exercises')
    .insert(entry)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteSessionExercises(sessionId: string): Promise<void> {
  const { error } = await supabase.from('sport_session_exercises').delete().eq('session_id', sessionId)
  if (error) throw error
}

// ── Yoga poses ────────────────────────────────────────────

export async function getSessionPoses(sessionId: string): Promise<SportYogaPose[]> {
  const { data, error } = await supabase
    .from('sport_yoga_poses')
    .select('*')
    .eq('session_id', sessionId)
  if (error) throw error
  return data || []
}

export async function addYogaPose(pose: Omit<SportYogaPose, 'id'>): Promise<SportYogaPose> {
  const { data, error } = await supabase
    .from('sport_yoga_poses')
    .insert(pose)
    .select()
    .single()
  if (error) throw error
  return data
}

// ── Runs ──────────────────────────────────────────────────

export async function getRun(sessionId: string): Promise<SportRun | null> {
  const { data, error } = await supabase
    .from('sport_runs')
    .select('*')
    .eq('session_id', sessionId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function createRun(run: Omit<SportRun, 'id' | 'pace_per_km'>): Promise<SportRun> {
  const pace = run.duration_seconds / 60 / run.distance_km
  const { data, error } = await supabase
    .from('sport_runs')
    .insert({ ...run, pace_per_km: pace })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getAllRuns(): Promise<(SportRun & { session: SportSession })[]> {
  const { data, error } = await supabase
    .from('sport_runs')
    .select('*, session:sport_sessions(*)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

// ── Stats helpers ─────────────────────────────────────────

export async function getRecentStats() {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { data } = await supabase
    .from('sport_sessions')
    .select('type, duration_minutes, date')
    .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
    .order('date')

  const sessions = data || []
  const byType = { yoga: 0, muscu: 0, cardio: 0 }
  let totalMin = 0

  for (const s of sessions) {
    byType[s.type as DisciplineType] = (byType[s.type as DisciplineType] || 0) + 1
    totalMin += s.duration_minutes || 0
  }

  return { sessions, byType, totalMin, totalSessions: sessions.length }
}
