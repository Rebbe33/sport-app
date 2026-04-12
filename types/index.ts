export type DisciplineType = 'yoga' | 'muscu' | 'cardio'

export type Ressenti = 1 | 2 | 3 | 4 | 5

export interface SportSession {
  id: string
  type: DisciplineType
  date: string // ISO date string
  duration_minutes: number
  ressenti: Ressenti
  notes?: string
  created_at: string
  status: 'planned' | 'done'
}

export interface SportSessionExercise {
  id: string
  session_id: string
  exercise_id: string
  sets: number
  reps: number
  weight_kg?: number
  order_index: number
}

export interface SportExercise {
  id: string
  name: string
  muscle_group: string
  is_hiit: boolean
}

export interface SportYogaPose {
  id: string
  name: string
  duration_seconds: number
  notes?: string
  session_id: string
}

export interface SportRun {
  id: string
  session_id: string
  distance_km: number
  duration_seconds: number
  pace_per_km?: number // calculated
}

// For weekly planning display
export interface WeekDay {
  date: Date
  dayLabel: string
  shortLabel: string
  session?: SportSession
  isToday: boolean
  isPast: boolean
}
