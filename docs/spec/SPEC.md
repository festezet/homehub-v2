# HomeHub v2 - Specification Technique
> Version: 1.0 | Date: 2026-03-13 | Projet: PRJ-010

---

## 1. Vision & Contexte

### 1.1 Probleme
HomeHub v1 etait un fichier HTML monolithique de 3500 lignes impossible a maintenir et a etendre. Fabrice avait besoin d'un centre de commande unifie pour gerer son poste de travail Linux : taches, bookmarks, Docker, applications, calendrier, formation, monitoring systeme - le tout accessible depuis un navigateur.

### 1.2 Utilisateurs

| Profil | Objectif | Usage |
|--------|----------|-------|
| Fabrice (admin/dev) | Piloter toutes les activites depuis une interface unique | Quotidien, toute la journee |
| Claude Code (agent IA) | Interagir avec les APIs (todos, bookmarks, calendrier) | Quotidien, via API |

### 1.3 Criteres de succes
- [x] Fichiers < 500 lignes chacun (vs 3500 monolithique)
- [x] Backend Flask unifie (vs 3 services separes)
- [x] Toutes les fonctionnalites de v1 migrees
- [x] APIs REST pour chaque module (utilisable par Claude Code)
- [ ] Temps de reponse API < 200ms
- [ ] Zero downtime sur une journee de travail

---

## 2. Stack Technique

| Couche | Technologie | Version | Justification |
|--------|------------|---------|---------------|
| Backend | Python + Flask | 3.0.0 | Leger, rapide a developper, maitrise existante |
| Frontend | HTML5 + Vanilla JS | ES6+ | Pas de framework = zero build, simplicite |
| Templates | Jinja2 | (Flask builtin) | Templating server-side natif Flask |
| Base de donnees | SQLite3 | 3.x | Fichier unique par domaine, zero config, backup simple |
| Containers | Docker SDK Python | 7.1.0 | Controle Docker natif depuis Python |
| Calendrier | Google Calendar API | v3 | OAuth 2.0, integration complete CRUD |
| Monitoring | psutil | 5.9.0 | Metriques systeme (CPU, RAM, disque) |
| Serveur | Flask dev server | - | Mode debug avec auto-reload |
| CORS | Flask-CORS | 4.0.0 | Permettre les appels cross-origin |

### 2.1 Dependances externes

| Service | Port | Role |
|---------|------|------|
| Google Calendar API | HTTPS | Evenements calendrier (OAuth 2.0) |
| Docker daemon | socket | Gestion containers |
| projects.db | fichier | Liste des projets (PRJ-XXX) |
| port_registry.json | fichier | Registre central des ports |
| formation.json | fichier | Contenu formation Skool |
| Backup Status API | 8887 | Statut des backups systeme |

---

## 3. Architecture

### 3.1 Vue Contexte (C4 Level 1)

```
                    ┌─────────────────┐
                    │    Fabrice       │
                    │  (navigateur)   │
                    └────────┬────────┘
                             │ HTTP :5000
                             v
                    ┌─────────────────┐
                    │   HomeHub v2    │
                    │  (Flask app)    │
                    └──┬──┬──┬──┬──┬─┘
                       │  │  │  │  │
          ┌────────────┘  │  │  │  └────────────┐
          v               v  │  v               v
   ┌──────────┐  ┌──────────┐│┌──────────┐ ┌──────────┐
   │ Google   │  │  Docker  │││ projects │ │ Backup   │
   │ Calendar │  │  daemon  │││   .db    │ │ Status   │
   │  API     │  │  socket  │││          │ │  :8887   │
   └──────────┘  └──────────┘│└──────────┘ └──────────┘
                              v
                       ┌──────────┐
                       │ Skool    │
                       │formation │
                       │  .json   │
                       └──────────┘
```

### 3.2 Vue Container (C4 Level 2)

```
┌─────────────────────────────────────────────────────────┐
│                    HomeHub v2                            │
│                                                         │
│  ┌──────────────────────┐  ┌─────────────────────────┐  │
│  │    Frontend           │  │     Backend (Flask)     │  │
│  │                       │  │                         │  │
│  │  base.html            │  │  app.py (736 lines)     │  │
│  │  + 14 templates       │  │  + 6 blueprints (api/)  │  │
│  │  + 18 modules JS      │  │  + 9 services           │  │
│  │  + 4 fichiers CSS     │  │                         │  │
│  │                       │  │  Blueprints:            │  │
│  │  Modules:             │  │  - todo_bp     /todos   │  │
│  │  - app.js (entry)     │  │  - internet_bp /internet│  │
│  │  - api.js (wrapper)   │  │  - docker_bp   /docker  │  │
│  │  - todo.js            │  │  - calendar_bp /calendar│  │
│  │  - calendar.js        │  │  - formation_bp/format. │  │
│  │  - docker.js          │  │  - local_apps_bp /local │  │
│  │  - internet.js        │  │                         │  │
│  │  - formation.js       │  │  Services:              │  │
│  │  - local-apps.js      │  │  - TodoService          │  │
│  │  - system-monitor.js  │  │  - InternetService      │  │
│  │  - projects-list.js   │  │  - DockerService        │  │
│  │  - ...                │  │  - CalendarService      │  │
│  └──────────────────────┘  │  - GoogleCalendarService │  │
│                             │  - FormationService     │  │
│                             │  - LocalAppsService     │  │
│                             │  - ActivityService      │  │
│                             │  - InfrastructureService│  │
│                             └─────────┬───────────────┘  │
│                                       │                  │
│  ┌────────────────────────────────────┼───────────────┐  │
│  │              Databases (SQLite3)   │               │  │
│  │                                    │               │  │
│  │  todo.db          internet_links.db               │  │
│  │  (infra/data/)    (homehub/data/)                 │  │
│  │                                                    │  │
│  │  local_apps.db    formation.db     homehub.db     │  │
│  │  (homehub/data/)  (homehub/data/)  (reserve)      │  │
│  └────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### 3.3 Structure du projet

```
homehub-v2/
├── backend/
│   ├── app.py                         # Point d'entree Flask (736 lignes)
│   ├── api/                           # Routes API (blueprints)
│   │   ├── todo_routes.py             # CRUD todos
│   │   ├── internet_routes.py         # CRUD bookmarks
│   │   ├── docker_routes.py           # Controle containers
│   │   ├── local_apps_routes.py       # Lancement applications
│   │   ├── formation_routes.py        # Suivi formation
│   │   ├── calendar_routes.py         # Calendrier Google
│   │   └── __init__.py
│   ├── services/                      # Logique metier
│   │   ├── todo_service.py            # 145 lignes
│   │   ├── internet_service.py        # 204 lignes
│   │   ├── docker_service.py          # 269 lignes
│   │   ├── local_apps_service.py      # 262 lignes
│   │   ├── calendar_service.py        # 204 lignes
│   │   ├── google_calendar_service.py # OAuth + CRUD events
│   │   ├── formation_service.py       # 290 lignes
│   │   ├── activity_service.py        # Timeline
│   │   ├── infrastructure_service.py  # Monitoring systeme
│   │   └── __init__.py
│   ├── data/
│   │   └── weekly_template.json       # Template horaire semaine
│   └── docker_control_server.py       # Serveur auxiliaire (port 9999)
├── frontend/
│   ├── templates/                     # 15 templates Jinja2
│   │   ├── base.html                  # Layout principal + sidebar
│   │   ├── dashboard.html             # Todolist
│   │   ├── calendar.html              # Calendrier
│   │   ├── formation.html             # Formation Skool
│   │   ├── local-apps.html            # Applications locales
│   │   ├── system-monitor.html        # Monitoring systeme
│   │   ├── prompting-disciplines.html # Disciplines prompting
│   │   ├── infrastructure.html        # Infrastructure
│   │   ├── internet.html              # Bookmarks
│   │   ├── projects-list.html         # Liste projets
│   │   ├── activity.html              # Timeline activite
│   │   ├── markets.html               # Donnees marche
│   │   ├── mediastack.html            # Stack media
│   │   ├── services-ports.html        # Registre ports
│   │   └── local.html                 # Applications locales (legacy)
│   └── static/
│       ├── js/                        # 18 modules JavaScript
│       │   ├── app.js                 # Entry point (200 lignes)
│       │   ├── api.js                 # Wrapper API centralise (209 lignes)
│       │   ├── utils.js               # Utilitaires (161 lignes)
│       │   ├── tabs.js                # Systeme d'onglets (100 lignes)
│       │   ├── calendar.js            # Module calendrier (1018 lignes)
│       │   ├── todo.js                # Module todolist (831 lignes)
│       │   ├── local-apps.js          # Module apps locales (586 lignes)
│       │   ├── formation.js           # Module formation (345 lignes)
│       │   ├── projects-list.js       # Module projets (339 lignes)
│       │   ├── internet.js            # Module bookmarks (331 lignes)
│       │   ├── system-monitor.js      # Module monitoring (289 lignes)
│       │   ├── markets.js             # Module marches (247 lignes)
│       │   ├── mediastack.js          # Module media (216 lignes)
│       │   ├── services-ports.js      # Module ports (181 lignes)
│       │   ├── local.js               # Module apps legacy (139 lignes)
│       │   ├── infrastructure.js      # Module infra (139 lignes)
│       │   ├── docker.js              # Module Docker (137 lignes)
│       │   └── activity.js            # Module activite (101 lignes)
│       └── css/
│           ├── modern-style.css       # Style principal (30.8 Ko)
│           ├── calendar.css           # Style calendrier (22.3 Ko)
│           ├── formation.css          # Style formation (13.3 Ko)
│           └── prompting-disciplines.css
├── credentials/                       # OAuth tokens Google (gitignore)
├── data/
│   ├── formation.db                   # Actions de formation
│   ├── internet_links.db             # Bookmarks internet
│   ├── local_apps.db                 # Applications locales
│   ├── homehub.db                    # Reserve (vide)
│   └── weekly_template.json          # Template horaire
├── scripts/                           # Scripts utilitaires
├── docs/
│   └── spec/                         # Cette specification
├── start.sh                          # Script de lancement
├── requirements.txt                  # Dependances Python
└── README.md
```

### 3.4 Flux de donnees

```
Flux 1 - Navigation utilisateur :
[Navigateur] → GET / → [Flask] → render base.html → [Jinja2] → HTML + JS modules
                                                                      │
[Navigateur] ← HTML complet ←──────────────────────────────────────────┘
     │
     └→ JS app.js init() → checkAPIs() → loadTabData('dashboard')
                                              │
                                              v
                              [API /api/todos] → [TodoService] → [todo.db]
                                              → JSON response → DOM update

Flux 2 - CRUD via API (exemple: creer un todo) :
[JS todo.js] → POST /api/todos {action, priority, ...}
                    │
                    v
            [todo_routes.py] → [TodoService.create_todo()] → INSERT todo.db
                    │
                    v
            JSON {"status": "ok", "data": {...}} → [JS] → Toast + refresh list

Flux 3 - Lancement application GUI :
[JS local-apps.js] → POST /api/local-apps/apps/<id>/launch
                           │
                           v
                    [local_apps_routes.py] → get_x11_env() → capture DISPLAY/DBUS
                           │
                           v
                    subprocess.Popen(command, env=x11_env) → [Application GUI]
                           │
                           v
                    record_launch(id) → UPDATE launch_count + last_launched

Flux 4 - Google Calendar :
[JS calendar.js] → GET /api/calendar/events?start_date=...&end_date=...
                         │
                         v
                  [calendar_routes.py] → [GoogleCalendarService]
                         │                      │
                         │               OAuth 2.0 token check
                         │                      │
                         │               Google Calendar API v3
                         │                      │
                         v                      v
                  JSON {events: [...]} → [JS] → render calendar grid
```

---

## 4. Modele de Donnees

### 4.1 Schema conceptuel

| Entite | Description | DB | Relations |
|--------|-------------|-----|-----------|
| Todo | Tache a faire avec priorite, deadline, categorie | todo.db | → Objective |
| Objective | Objectif de vie (6 axes) | todo.db | ← Todo |
| InternetCategory | Categorie de bookmarks (slug unique) | internet_links.db | ← InternetLink |
| InternetLink | Bookmark internet | internet_links.db | → InternetCategory |
| AppCategory | Categorie d'applications | local_apps.db | ← AppEntry |
| AppEntry | Application locale (projet, docker, systeme) | local_apps.db | → AppCategory |
| FormationAction | Action de formation hierarchique | formation.db | → FormationAction (parent) |

### 4.2 Schema SQL

```sql
-- ============================================================
-- DATABASE: todo.db (/data/projects/infrastructure/data/todo.db)
-- Note: DB partagee, geree par infrastructure, pas par homehub
-- ============================================================

CREATE TABLE todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,                          -- Description de la tache
    blocking TEXT DEFAULT 'Non',                   -- 'Oui' / 'Non'
    category TEXT DEFAULT 'Admin',                 -- Categorie (voir liste)
    withClaude TEXT DEFAULT 'Non',                 -- Faisable avec Claude Code
    created TEXT,                                  -- Date de creation manuelle
    deadline TEXT,                                 -- Date limite
    status TEXT DEFAULT 'To Do',                   -- Statut (voir liste)
    notes TEXT,                                    -- Notes libres
    priority TEXT DEFAULT 'P3-Normal',             -- Priorite (voir liste)
    time INTEGER DEFAULT 30,                       -- Temps estime (minutes)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    objective TEXT DEFAULT ''                       -- Objectif de vie associe
);

-- Valeurs autorisees:
-- category: Admin, Projet, Perso, Pro, SASU, Maison, Bricolage, Finance,
--           Sante, Tech, Infrastructure, Musique, Auto, Immobilier, Loisirs,
--           Todo projet
-- priority: P1-Urgent, P2-High, P2-Important, P3-Normal, P4-Low
-- status: "To Do", "In Progress", "Done", "Blocked", "Standby"

CREATE TABLE objectives (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,                     -- Nom de l'objectif
    description TEXT,
    year TEXT DEFAULT '2025-2026',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Objectifs: "Revenus et Stabilite Financiere", "Sante et Bien-etre",
--            "Relations Familiales et Amicales", "Developpement Personnel",
--            "Projets et Creativite", "Equilibre Vie Pro-Perso"

-- ============================================================
-- DATABASE: internet_links.db (homehub-v2/data/)
-- ============================================================

CREATE TABLE internet_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,                     -- Identifiant URL-safe
    name TEXT NOT NULL,                            -- Nom affiche
    icon TEXT DEFAULT '',                          -- Icone (emoji ou classe)
    position INTEGER DEFAULT 0,                   -- Ordre d'affichage
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Categories par defaut: frequent-sites, crypto, news, ai, tools, search,
--   banks, weather, social, music, real-estate, admin, business, car,
--   leisure, wind-energy

CREATE TABLE internet_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,                            -- Nom du lien
    url TEXT NOT NULL,                             -- URL complete
    category_slug TEXT NOT NULL,                   -- FK vers categories
    favicon_alt TEXT DEFAULT '',                   -- Texte alternatif favicon
    description TEXT DEFAULT '',                   -- Description optionnelle
    position INTEGER DEFAULT 0,                   -- Ordre dans la categorie
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_slug) REFERENCES internet_categories(slug)
);

-- Comportement: si category_slug n'existe pas au POST, la categorie
-- est auto-creee avec slug=category_slug, name=category_slug

-- ============================================================
-- DATABASE: local_apps.db (homehub-v2/data/)
-- ============================================================

CREATE TABLE app_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    icon TEXT DEFAULT '',
    position INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE app_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,                            -- Nom de l'application
    description TEXT DEFAULT '',
    category_slug TEXT NOT NULL,                   -- FK vers categories
    icon TEXT DEFAULT '',                          -- Icone
    app_type TEXT NOT NULL DEFAULT 'project',      -- 'project'|'docker'|'system'
    project_id TEXT DEFAULT '',                    -- PRJ-XXX ou APP-XXX
    launcher_path TEXT DEFAULT '',                 -- Chemin du script de lancement
    launcher_type TEXT DEFAULT '',                 -- Type de lanceur
    web_url TEXT DEFAULT '',                       -- URL web si applicable
    docker_stack TEXT DEFAULT '',                  -- Stack Docker associee
    launch_count INTEGER DEFAULT 0,               -- Compteur de lancements
    last_launched TIMESTAMP,                       -- Dernier lancement
    position INTEGER DEFAULT 0,                   -- Ordre d'affichage
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_slug) REFERENCES app_categories(slug)
);

-- Categorie virtuelle "frequent-use": generee a la volee
-- = top 5 apps par launch_count (si launch_count > 0)

-- ============================================================
-- DATABASE: formation.db (homehub-v2/data/)
-- ============================================================

CREATE TABLE formation_actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_id INTEGER,                             -- NULL = action racine
    title TEXT NOT NULL,
    description TEXT,
    who TEXT DEFAULT 'Claude',                     -- 'Claude' ou 'Fabrice'
    status TEXT DEFAULT 'pending',                 -- 'pending'|'in_progress'|'done'
    priority INTEGER DEFAULT 0,                    -- Ordre de priorite
    prerequisite_ids TEXT DEFAULT '[]',             -- JSON array d'IDs prerequis
    position INTEGER DEFAULT 0,                    -- Ordre d'affichage
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (parent_id) REFERENCES formation_actions(id)
);

-- Comportement: quand tous les enfants d'un parent sont 'done',
-- le parent est automatiquement marque 'done'

-- ============================================================
-- DATABASE: homehub.db (homehub-v2/data/) - RESERVE, schema vide
-- ============================================================
```

---

## 5. Features (Exigences Fonctionnelles)

### F-001: Todolist (P1)
**User story :** En tant que Fabrice, je veux gerer mes taches quotidiennes avec priorites, categories et deadlines, afin de rester organise.

**Criteres d'acceptation :**
- [x] CRUD complet (creer, lire, modifier, supprimer)
- [x] Tri par statut → priorite → deadline
- [x] Filtrage par categorie
- [x] Edition inline (clic sur un champ pour modifier)
- [x] 16 categories, 5 niveaux de priorite, 5 statuts
- [x] Association a un objectif de vie (6 axes)
- [x] Champ "withClaude" pour marquer les taches faisables avec l'IA
- [x] Estimation du temps par tache

**Cas limites :**
- Tache sans action (champ requis) → erreur 400
- Categorie inconnue → acceptee (pas de validation stricte)
- Modification d'un champ inexistant → erreur 400

**API :** `GET/POST /api/todos`, `PUT/DELETE /api/todos/<id>`

---

### F-002: Bookmarks Internet (P1)
**User story :** En tant que Fabrice, je veux organiser mes liens web par categories, afin d'acceder rapidement a mes sites frequents.

**Criteres d'acceptation :**
- [x] CRUD complet liens et categories
- [x] Groupement par categorie avec position
- [x] Auto-creation de categorie si slug inconnu
- [x] Favicon alternatif (texte) si pas d'icone
- [x] Mode edition inline (ajout/modif/suppression)
- [x] 16 categories predefinies

**Cas limites :**
- Lien sans nom ou URL → erreur 400
- Suppression d'une categorie avec des liens → liens orphelins (a gerer)
- URL en double → acceptee (pas de verification d'unicite)

**API :** `GET/POST /api/internet/links`, `PUT/DELETE /api/internet/links/<id>`, `GET/POST /api/internet/categories`

---

### F-003: Controle Docker (P1)
**User story :** En tant que Fabrice, je veux demarrer/arreter mes containers Docker depuis l'interface, afin de gerer mes services sans terminal.

**Criteres d'acceptation :**
- [x] Liste tous les containers avec statut, image, ports
- [x] Actions: start, stop, restart par container
- [x] Stacks AI speciales: LLM (Ollama + Open WebUI), Stable Diffusion
- [x] Exclusion mutuelle GPU: demarrer LLM arrete SD et vice-versa
- [x] Statut temps reel des stacks AI

**Cas limites :**
- Docker daemon non accessible → erreur 500
- Container inexistant → erreur 404
- Start d'un container deja running → Docker ignore silencieusement

**API :** `GET /api/docker/containers`, `POST /api/docker/control`, `POST/GET /api/docker/llm/*`, `POST/GET /api/docker/stable-diffusion/*`

---

### F-004: Applications locales (P1)
**User story :** En tant que Fabrice, je veux lancer mes applications (projets dev, apps systeme, stacks Docker) depuis l'interface web.

**Criteres d'acceptation :**
- [x] CRUD applications avec categories
- [x] 3 types: project, docker, system
- [x] Lancement effectif avec detection X11 (DISPLAY, DBUS)
- [x] Compteur de lancements + last_launched
- [x] Categorie virtuelle "frequent-use" (top 5)
- [x] Logs de lancement dans /tmp/homehub_*.log

**Cas limites :**
- Application sans launcher_path → erreur au lancement
- X11 non disponible (session SSH) → lancement echoue silencieusement
- Application deja en cours → nouveau processus lance (pas de singleton)

**API :** `GET/POST /api/local-apps/apps`, `PUT/DELETE /api/local-apps/apps/<id>`, `POST /api/local-apps/apps/<id>/launch`

---

### F-005: Calendrier Google (P1)
**User story :** En tant que Fabrice, je veux voir mon agenda Google et planifier mes taches todo dans les creneaux disponibles.

**Criteres d'acceptation :**
- [x] OAuth 2.0 avec refresh token persistant
- [x] CRUD evenements Google Calendar
- [x] Vue semaine avec template horaire recurrent
- [x] Proposition automatique de creneaux pour les todos
- [x] Vue combinee: template + Google + todos planifies
- [x] 7 categories d'activite: routine, veille, musique, prospection, dev, loisirs, pause

**Cas limites :**
- Token OAuth expire → refresh automatique
- Google API down → erreur 500 avec message explicite
- Conflit de creneaux → la proposition evite les creneaux occupes

**API :** Voir section 6 - 15 endpoints calendrier

---

### F-006: Formation Skool (P2)
**User story :** En tant que Fabrice, je veux suivre ma progression dans la formation Micro-SaaS DeepSignal avec actions hierarchiques.

**Criteres d'acceptation :**
- [x] Actions hierarchiques (parent/enfant)
- [x] Toggle statut: pending → in_progress → done → pending
- [x] Stats de completion (total, done, pourcentage)
- [x] Contenu formation depuis formation.json externe
- [x] Auto-completion parent quand tous enfants done

**API :** `GET /api/formation/actions`, `POST /api/formation/actions/<id>/toggle`, `GET /api/formation/stats`, `GET /api/formation/content`

---

### F-007: Monitoring systeme (P2)
**User story :** En tant que Fabrice, je veux voir l'etat de mon systeme (CPU, RAM, disques, backups) en un coup d'oeil.

**Criteres d'acceptation :**
- [x] Dashboard infrastructure (CPU, RAM, swap, uptime)
- [x] Stockage disque hierarchique par SSD (sda, sdb, sdc, sdd)
- [x] Statut backups via API backup-status (:8887)
- [x] Liste des projets avec categories et statuts
- [x] Registre des ports reseau

**API :** `GET /api/infrastructure/dashboard`, `GET /api/system/storage`, `GET /api/services/ports`, `GET /api/projects`

---

### F-008: Lancement projets (P2)
**User story :** En tant que Fabrice, je veux lancer mes projets dev (PRJ-XXX) directement depuis HomeHub.

**Criteres d'acceptation :**
- [x] Liste des projets depuis projects.db
- [x] Lancement via start.sh du projet
- [x] Ouverture du dossier dans le file manager
- [x] Detection automatique de start.sh, app.py, main.py
- [x] Environnement X11 complet pour les GUI

**Cas limites :**
- Projet sans start.sh ni app.py → erreur "Pas de lanceur trouve"
- Projet avec venv → activation automatique avant lancement

**API :** `GET /api/projects`, `POST /api/projects/launch/<id>`, `POST /api/projects/open/<id>`

---

### F-009: Applications natives (P2)
**User story :** En tant que Fabrice, je veux lancer mes applications systeme (GIMP, Firefox, etc.) depuis l'interface.

**Criteres d'acceptation :**
- [x] Liste statique d'apps natives (GIMP, Kdenlive, Sublime Text, Firefox, Cursor)
- [x] Lancement avec environnement X11 complet
- [x] Logs dans /tmp/

**API :** `GET /api/apps`, `POST /api/apps/launch/<app_id>`

---

### F-010: Prompting Disciplines (P3)
**User story :** En tant que Fabrice, je veux consulter la documentation des 4 disciplines de prompting depuis HomeHub.

**Criteres d'acceptation :**
- [x] Page dediee avec les 4 disciplines (D1-D4)
- [x] Stats contexte, explications, maintenance, quick reference
- [x] Lien avec PRJ-044

---

## 6. API / Interfaces

### 6.1 Format de reponse standard

**Succes :**
```json
{"status": "ok", "data": ...}
```

**Erreur :**
```json
{"status": "error", "message": "Description de l'erreur"}
```

**Codes HTTP :** 200 (ok), 201 (cree), 400 (bad request), 404 (not found), 500 (erreur serveur)

### 6.2 Endpoints REST complets

#### Module TODO (`/api/todos`) - todo_routes.py

| Methode | Route | Body/Params | Reponse | Description |
|---------|-------|-------------|---------|-------------|
| GET | `/api/todos` | - | `{status, data: [todos]}` | Liste triee par statut/priorite/deadline |
| POST | `/api/todos` | `{action(req), status, priority, deadline, blocking, category, notes, objective, withClaude, time}` | `{status, data: {id, ...}}` | Creer un todo |
| PUT | `/api/todos/<id>` | `{field(req), value(req)}` | `{status}` | Modifier un champ specifique |
| DELETE | `/api/todos/<id>` | - | `{status}` | Supprimer |
| GET | `/api/todos/health` | - | `{status, count}` | Health check |

#### Module Internet (`/api/internet`) - internet_routes.py

| Methode | Route | Body/Params | Reponse | Description |
|---------|-------|-------------|---------|-------------|
| GET | `/api/internet/links` | - | `{status, data: {categories: [...]}}` | Liens groupes par categorie |
| POST | `/api/internet/links` | `{name(req), url(req), category(req), description, favicon_alt, position}` | `{status, data: {id}}` | Creer un lien |
| PUT | `/api/internet/links/<id>` | `{name, url, category, description, favicon_alt, position}` | `{status}` | Modifier |
| DELETE | `/api/internet/links/<id>` | - | `{status}` | Supprimer |
| GET | `/api/internet/categories` | - | `{status, data: [categories]}` | Liste categories |
| POST | `/api/internet/categories` | `{slug(req), name(req), icon, position}` | `{status, data: {id}}` | Creer categorie |
| GET | `/api/internet/health` | - | `{status, count}` | Health check |

#### Module Docker (`/api/docker`) - docker_routes.py

| Methode | Route | Body/Params | Reponse | Description |
|---------|-------|-------------|---------|-------------|
| GET | `/api/docker/containers` | - | `{status, containers: [...]}` | Liste containers |
| POST | `/api/docker/control` | `{name(req), action(req): start/stop/restart}` | `{status, message}` | Controler container |
| GET | `/api/docker/health` | - | `{status}` | Health check |
| POST | `/api/docker/llm/start` | - | `{status, message}` | Demarrer stack LLM |
| POST | `/api/docker/llm/stop` | - | `{status, message}` | Arreter stack LLM |
| GET | `/api/docker/llm/status` | - | `{status, data: {ollama, openwebui, gpu_available}}` | Statut LLM |
| POST | `/api/docker/stable-diffusion/start` | - | `{status, message}` | Demarrer SD |
| POST | `/api/docker/stable-diffusion/stop` | - | `{status, message}` | Arreter SD |
| GET | `/api/docker/stable-diffusion/status` | - | `{status, data: {...}}` | Statut SD |

#### Module Local Apps (`/api/local-apps`) - local_apps_routes.py

| Methode | Route | Body/Params | Reponse | Description |
|---------|-------|-------------|---------|-------------|
| GET | `/api/local-apps/apps` | - | `{status, data: {categories: [...]}}` | Apps groupees par categorie |
| POST | `/api/local-apps/apps` | `{name(req), category(req), description, icon, app_type, project_id, launcher_path, launcher_type, web_url, docker_stack, position}` | `{status, data: {id}}` | Creer app |
| PUT | `/api/local-apps/apps/<id>` | champs optionnels | `{status}` | Modifier |
| DELETE | `/api/local-apps/apps/<id>` | - | `{status}` | Supprimer |
| POST | `/api/local-apps/apps/<id>/launch` | - | `{status, message, app_type}` | Lancer l'app |
| GET | `/api/local-apps/categories` | - | `{status, data: [categories]}` | Liste categories |
| GET | `/api/local-apps/health` | - | `{status, count}` | Health check |

#### Module Formation (`/api/formation`) - formation_routes.py

| Methode | Route | Body/Params | Reponse | Description |
|---------|-------|-------------|---------|-------------|
| GET | `/api/formation/actions` | - | `{status, data: [actions]}` | Actions hierarchiques + stats |
| POST | `/api/formation/actions/<id>/toggle` | - | `{status, data: {new_status}}` | Toggle statut |
| PUT | `/api/formation/actions/<id>/status` | `{status(req)}` | `{status}` | Set statut |
| GET | `/api/formation/stats` | - | `{status, data: {total, done, progress}}` | Stats completion |
| GET | `/api/formation/content` | - | `{status, data: formation_json}` | Contenu Skool |

#### Module Calendrier (`/api/calendar`) - calendar_routes.py

| Methode | Route | Body/Params | Reponse | Description |
|---------|-------|-------------|---------|-------------|
| GET | `/api/calendar/template` | - | `{status, data: template}` | Template semaine |
| PUT | `/api/calendar/template` | template JSON | `{status}` | MAJ template |
| GET | `/api/calendar/template/week` | `?start_date=YYYY-MM-DD` | `{status, data: week}` | Semaine resolue |
| GET | `/api/calendar/categories` | - | `{status, data: [categories]}` | Categories activite |
| GET | `/api/calendar/google/status` | - | `{status, connected}` | Statut OAuth |
| GET | `/api/calendar/events` | `?start_date&end_date` | `{status, events: [...]}` | Events Google |
| GET | `/api/calendar/events/week` | `?start_date` | `{status, data: {days: {...}}}` | Events par jour |
| POST | `/api/calendar/google/events` | event data | `{status, data: event}` | Creer event |
| PUT | `/api/calendar/google/events/<id>` | event data | `{status, data: event}` | MAJ event |
| DELETE | `/api/calendar/google/events/<id>` | - | `{status}` | Supprimer event |
| GET | `/api/calendar/schedule/propose` | - | `{status, data: proposals}` | Proposer creneaux |
| POST | `/api/calendar/schedule/apply` | proposals | `{status}` | Appliquer propositions |
| GET | `/api/calendar/schedule` | `?start_date&end_date` | `{status, data: [...]}` | Todos planifies |
| DELETE | `/api/calendar/schedule/<id>` | - | `{status}` | Annuler planification |
| GET | `/api/calendar/schedule/todos` | - | `{status, data: [todos]}` | Todos planifiables |
| GET | `/api/calendar/combined` | - | `{status, data: combined}` | Vue combinee |

#### Routes principales (app.py)

| Methode | Route | Description |
|---------|-------|-------------|
| GET | `/` | Page principale (base.html) |
| GET | `/api/health` | Health check general |
| GET | `/api/activity/timeline` | Timeline activite recente |
| GET | `/api/infrastructure/dashboard` | Dashboard monitoring |
| GET | `/api/services/ports` | Registre ports (port_registry.json) |
| GET | `/api/apps` | Liste apps natives statiques |
| GET | `/api/projects` | Liste projets (projects.db) |
| GET | `/api/system/storage` | Stockage disque hierarchique |
| POST | `/api/apps/launch/<app_id>` | Lancer app native |
| POST | `/api/projects/launch/<project_id>` | Lancer projet |
| POST | `/api/projects/open/<project_id>` | Ouvrir dossier projet |
| GET | `/api/files/calendar` | Fichier calendrier HTML genere |

**Total : 56 endpoints REST**

---

## 7. Exigences Non-Fonctionnelles

### 7.1 Performance

| Metrique | Cible | Situation actuelle |
|----------|-------|--------------------|
| Temps reponse API (CRUD) | < 200ms | ~50ms (SQLite local) |
| Chargement page initiale | < 2s | ~1s (pas de build, fichiers statiques) |
| Refresh Docker containers | < 3s | ~1-2s (Docker API) |
| Google Calendar fetch | < 5s | Variable (API externe) |

### 7.2 Securite

- **Authentification** : Aucune (usage local uniquement, localhost)
- **CORS** : Ouvert (`CORS(app)` - toutes origines)
- **Google OAuth** : Tokens stockes dans `credentials/` (gitignore)
- **Donnees sensibles** : Mot de passe Open WebUI en clair dans README (usage local)
- **Validation entrees** : Minimale (champs requis verifies, pas de sanitization XSS)
- **Acces fichiers** : Lecture directe de port_registry.json, projects.db, formation.json

### 7.3 Fiabilite

- **Backup** : Pas de backup automatique des DB homehub (contrairement a todo.db gere par infrastructure)
- **Mode debug** : Flask en debug=True (auto-reload mais pas production-ready)
- **Health checks** : Chaque module expose un `/health` endpoint
- **Gestion d'erreurs** : Try/catch global avec JSON error response
- **Recovery** : Redemarrage via `bash start.sh` (kill + restart)

### 7.4 Limites connues

- **Pas d'authentification** : Quiconque sur le reseau local peut acceder a l'API
- **Pas de mode production** : Flask dev server uniquement (pas de gunicorn/nginx)
- **Pas de migrations DB** : Schema defini au premier lancement, pas d'evolution automatique
- **Pas de tests automatises** : Verification manuelle uniquement
- **Single-user** : Concu pour un seul utilisateur (Fabrice)
- **X11 dependant** : Le lancement d'apps GUI necessite une session X11 active
- **Pas de websockets** : Pas de mise a jour temps reel (polling cote JS)
- **CSS monolithique** : modern-style.css fait 30 Ko (en cours d'extraction)

---

## 8. Deploiement & Configuration

### 8.1 Prerequis
- Python 3.10+
- Docker (pour le module Docker)
- Session X11 active (pour le lancement d'apps GUI)
- Google Cloud project avec Calendar API (pour le calendrier)

### 8.2 Installation
```bash
cd /data/projects/homehub-v2
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 8.3 Variables d'environnement

| Variable | Description | Requis | Defaut |
|----------|-------------|--------|--------|
| DISPLAY | Display X11 | Oui (auto-detect) | :1 |
| XAUTHORITY | Fichier auth X11 | Oui (auto-detect) | ~/.Xauthority |
| DBUS_SESSION_BUS_ADDRESS | Adresse bus D-Bus | Oui (auto-detect) | - |
| XDG_RUNTIME_DIR | Repertoire runtime | Oui (auto-detect) | /run/user/1000 |

Note : Toutes ces variables sont detectees automatiquement par `get_x11_env()`.

### 8.4 Lancement

```bash
# Lancement complet (recommande)
cd /data/projects/homehub-v2 && bash start.sh

# Ce que start.sh fait :
# 1. Active le venv
# 2. Installe les dependances
# 3. Lance launcher_server.py sur port 9998 (background)
# 4. Lance docker_control_server.py sur port 9999 (background)
# 5. Lance Flask app sur port 5000

# Lancement manuel (debug)
cd /data/projects/homehub-v2
source venv/bin/activate
python3 backend/app.py
```

### 8.5 Ports reseau

| Port | Service | Enregistre dans port_registry |
|------|---------|------|
| 5000 | Flask principal (HomeHub) | Oui |
| 9998 | TODO launcher API | Oui |
| 9999 | Docker control API | Oui |

---

## 9. Glossaire

| Terme | Definition |
|-------|-----------|
| Blueprint | Module Flask qui regroupe des routes API liees |
| Service | Classe Python qui encapsule la logique metier et l'acces DB |
| Template horaire | Planning semaine recurrent avec creneaux et activites |
| Stack AI | Ensemble de containers Docker pour une fonctionnalite IA (LLM ou SD) |
| PRJ-XXX | Identifiant unique d'un projet dans projects.db |
| APP-XXX | Identifiant d'une application native |
| Slug | Identifiant URL-safe (minuscules, tirets, pas d'espaces) |
| Health check | Endpoint /health qui verifie que le module fonctionne |
| get_x11_env() | Fonction critique qui capture l'environnement X11 pour lancer des GUI |
| Frequent-use | Categorie virtuelle auto-generee avec les 5 apps les plus lancees |

---

## Annexes

### A. Decisions architecturales (ADRs)

Voir `docs/spec/decisions/` :
- ADR-001 : Vanilla JS plutot que React
- ADR-002 : SQLite multi-fichiers plutot que PostgreSQL
- ADR-003 : Flask dev server plutot que Gunicorn
- ADR-004 : X11 env capture via /proc plutot que variables hardcodees

### B. Historique des versions

| Version | Date | Changements |
|---------|------|-------------|
| 1.0 | 2026-03-13 | Creation initiale - specification complete |
