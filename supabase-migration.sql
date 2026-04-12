-- ============================================================
-- Migration : tables application sport personnelle
-- Préfixe : sport_
-- À exécuter dans Supabase > SQL Editor
-- ============================================================

-- 1. Sessions principales (toutes disciplines)
CREATE TABLE IF NOT EXISTS sport_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type          TEXT NOT NULL CHECK (type IN ('yoga', 'muscu', 'cardio')),
  date          DATE NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 0,
  ressenti      SMALLINT NOT NULL DEFAULT 3 CHECK (ressenti BETWEEN 1 AND 5),
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Bibliothèque d'exercices muscu/HIIT
CREATE TABLE IF NOT EXISTS sport_exercises (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  muscle_group  TEXT NOT NULL DEFAULT '',
  is_hiit       BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index pour éviter les doublons d'exercices par nom
CREATE UNIQUE INDEX IF NOT EXISTS sport_exercises_name_idx ON sport_exercises (lower(name));

-- 3. Exercices réalisés dans une séance
CREATE TABLE IF NOT EXISTS sport_session_exercises (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID NOT NULL REFERENCES sport_sessions(id) ON DELETE CASCADE,
  exercise_id   UUID NOT NULL REFERENCES sport_exercises(id) ON DELETE CASCADE,
  sets          SMALLINT NOT NULL DEFAULT 1,
  reps          SMALLINT NOT NULL DEFAULT 1,
  weight_kg     NUMERIC(5,2),
  order_index   SMALLINT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Postures yoga d'une séance
CREATE TABLE IF NOT EXISTS sport_yoga_poses (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        UUID NOT NULL REFERENCES sport_sessions(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  duration_seconds  INTEGER NOT NULL DEFAULT 60,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Données course à pied
CREATE TABLE IF NOT EXISTS sport_runs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        UUID NOT NULL REFERENCES sport_sessions(id) ON DELETE CASCADE,
  distance_km       NUMERIC(6,2) NOT NULL,
  duration_seconds  INTEGER NOT NULL,
  pace_per_km       NUMERIC(6,3),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Row Level Security (désactivé par défaut pour usage perso)
-- Activer si nécessaire :
-- ALTER TABLE sport_sessions ENABLE ROW LEVEL SECURITY;
-- ============================================================

-- Indexes utiles
CREATE INDEX IF NOT EXISTS sport_sessions_date_idx ON sport_sessions (date DESC);
CREATE INDEX IF NOT EXISTS sport_sessions_type_idx ON sport_sessions (type);
CREATE INDEX IF NOT EXISTS sport_session_exercises_session_idx ON sport_session_exercises (session_id);
CREATE INDEX IF NOT EXISTS sport_yoga_poses_session_idx ON sport_yoga_poses (session_id);
CREATE INDEX IF NOT EXISTS sport_runs_session_idx ON sport_runs (session_id);
