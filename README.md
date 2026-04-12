# Mon Sport — Application de suivi sportif personnel

Application mobile-first de suivi de séances (yoga, muscu/HIIT, course à pied).  
Stack : **Next.js 15** · **Tailwind CSS** · **Supabase** · **Vercel**

---

## 🚀 Mise en place

### 1. Supabase — Créer les tables

1. Ouvre ton projet Supabase → **SQL Editor**
2. Colle et exécute le fichier `supabase-migration.sql`
3. Toutes les tables sont préfixées `sport_` pour ne pas interférer avec l'existant

### 2. Variables d'environnement

```bash
cp .env.local.example .env.local
```

Remplace les valeurs par celles de ton projet Supabase (Settings → API) :

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### 3. Installation & lancement local

```bash
npm install
npm run dev
```

---

## 📦 Déploiement Vercel

1. Push sur GitHub
2. Importe le repo sur vercel.com
3. Ajoute les 2 variables d'environnement dans Settings → Environment Variables
4. Deploy !

---

## 📱 Saisir une séance (3 étapes)

1. Tab **Séance** → choisir la discipline
2. Date · durée · ressenti
3. Détails (postures / exercices / distance+durée)

---

## 🗄️ Tables Supabase (préfixe sport_)

| Table | Contenu |
|-------|---------|
| `sport_sessions` | Toutes les séances |
| `sport_exercises` | Bibliothèque d'exercices muscu |
| `sport_session_exercises` | Exercices réalisés par séance |
| `sport_yoga_poses` | Postures yoga par séance |
| `sport_runs` | Données de course par séance |
