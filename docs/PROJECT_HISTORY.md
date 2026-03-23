# PROJECT_HISTORY — HomeHub-v2 (PRJ-010)
Archive du contenu historique de PROJECT_STATUS.md
Date d'archivage : 2026-03-21

## Onglets principaux (18 onglets) — Detail

- **Internet** : bookmarks par categorie, edit mode CRUD, reorder liens/categories
- **Applications** : lancement apps locales
- **Formation** : 3 sous-onglets: Plan d'action, Contenu Skool, Apercu Skool avec videos avatar TTS
- **Todo** : CRUD complet, filtres, priorites, edition inline
- **Thread Digest** : MULTI-PLATFORM (2026-03-19) — WhatsApp + Signal + SMS. Claude analyse, HomeHub stocke/affiche. DB separee `thread_digests.db`, 3 proxies (Evolution API, signal-cli-rest-api, XML import), dashboard cards avec summaries/actions/liens/topics, platform badges couleur
- **Agenda** : Google Calendar OAuth2, CRUD
- **Marches** : crypto, bourses
- **Media Stack** : Plex, Radarr, Sonarr monitoring
- **Recommandations** : (2026-03-16) - Bibliotheque Radarr/Sonarr, Recommandations IA Claude, Preferences
- **Applications Locales** : Docker AI apps, statut temps reel
- **System Monitor** : CPU/GPU/RAM/Stockage
- **Project Status** : 7 sous-onglets : Overview, Health & Specs, Activity Log, Sessions, Actions Projet, Session Closes, Modularity — colonne Score ranking integree dans Overview
- **Infrastructure** : dashboard monitoring
- **Services & Ports** : registre central ports
- **Prompting Disciplines** : framework D1-D4
- **Claude Skills** : (2026-03-19) - Scan dynamique skills/commands Claude Code, filtres, cards avec commande invocable
- **LinkedIn Posts** : (2026-03-20) - Relecture/validation posts LinkedIn avant publication, indicateurs qualite, review workflow

## Feature : LinkedIn Posts Review (2026-03-20)

- **Statut** : COMPLET et fonctionnel
- **Sources** : articles depuis `ai-profile/data/content.json` (3), episodes depuis `ai-video-studio/data/output/posts/serie*/episode_*.md` (18)
- **DB** : `data/linkedin_posts.db` (table `post_reviews`) — stocke uniquement l'etat de review, contenu lu LIVE
- **Indicateurs qualite** : char_count (800-2000), hook (210 chars), CTA, hashtags (3-5), emojis (1-2)
- **Review workflow** : statuts draft/ready/review/published/archived, notes libres
- **API** : `GET /api/linkedin/posts` (filtres type/status/serie), `GET /posts/<id>`, `PUT /posts/<id>/review`, `GET /stats`, `POST /sync`
- **Frontend** : stats row, filtres 3 selects + Sync, grille cards avec badges qualite, modal detail avec hook highlight
- **Fichiers crees** : `linkedin_service.py`, `linkedin_routes.py`, `linkedin-posts.html`, `linkedin-posts.js`
- **Fichiers modifies** : `app.py`, `base.html`, `api-features.js`, `app.js`

## Feature : Claude Skills (2026-03-19)

- **Statut** : COMPLET et fonctionnel
- **Backend** : `claude_skills_service.py` scanne 3 emplacements (global skills, local skills, commands), parse YAML frontmatter
- **API** : `GET /api/claude/skills` — scan filesystem a chaque appel (pas de cache/DB)
- **Frontend** : stats cards, filtres par type/projet, skill cards avec badge invocable/internal, commande `/name`
- **Fichiers crees** : `claude_skills_service.py`, `claude_skills_routes.py`, `claude-skills.html`, `claude-skills.js`
- **Fichiers modifies** : `app.py`, `base.html`, `api-features.js`, `app.js`, `modern-style.css`
- **Inventaire** : 10 global skills, 7 commands, 14 local skills (2 projets)

## Feature : Thread Digest (2026-03-17)

- **Statut** : COMPLET et fonctionnel
- **Raison** : Ollama trop lent (~2min+) sur GTX 1080 pour resumer conversations WhatsApp
- **Nouveau flow** : Claude analyse manuellement → stocke digest via API → HomeHub affiche
- **Backend** : 3 nouveaux fichiers (whatsapp_proxy_service, thread_digest_service, thread_digest_routes)
- **Frontend** : dashboard cards avec summary, action items (urgency), liens extraits, topics tags
- **DB** : `data/thread_digests.db` (thread_configs, thread_digests, thread_analysis_log)
- **Hybrid trigger** : status calcule si analyse necessaire (seuils messages + jours)
- **Fil seede** : CA 2026 (JID `120363355718911950@g.us`), 147 messages live
- **Fichiers supprimes** : communications_service.py, communications_routes.py, communications.html, communications.js

## Extension : Thread Digest Multi-Platform — Signal + SMS (2026-03-19)

- **Statut** : IMPLEMENTATION COMPLETE — tests restants (Docker Signal, QR link, UI)
- **Plan** : 5 phases, fichier plan `/home/fabrice-ryzen/.claude/plans/witty-wondering-simon.md`
- **Signal** :
  - Docker `signal-api` (bbernhard/signal-cli-rest-api) port 8083, mode json-rpc
  - `signal_proxy_service.py` : polling `/v1/receive`, stockage local `signal_messages` SQLite
  - Signal ne stocke PAS l'historique — polling obligatoire + stockage local
  - Route `POST /api/threads/signal/poll` pour declencher reception
  - Phone: `+33608741306`
- **SMS** :
  - `sms_proxy_service.py` : import XML (SMS Backup & Restore Android), stockage `sms_messages` SQLite
  - Route `POST /api/threads/sms/import` pour import fichier XML
- **Backend refactoring** :
  - `platform_proxies` dict dans `app.py` : whatsapp, signal, sms
  - `thread_digest_routes.py` : dispatch multi-platform via `_get_proxy(platform)`
  - `thread_digest_service.py` : `get_status(platform_proxies=None)` generique
- **Frontend** :
  - Selecteur platform (WhatsApp/Signal/SMS) dans modal config
  - Boutons conditionels : "Decouvrir" (WhatsApp/Signal) vs "Import SMS" (SMS)
  - Badges couleur : vert WhatsApp, bleu Signal, violet SMS (CSS `data-platform`)
  - Placeholders dynamiques selon platform selectionnee
- **Fichiers crees** : `signal_proxy_service.py`, `sms_proxy_service.py`
- **Fichiers modifies** : `app.py`, `thread_digest_routes.py`, `thread_digest_service.py`, `thread-digest.html`, `thread-digest.js`

## Feature : Media Recommender (2026-03-16)

- **Statut** : COMPLET et fonctionnel
- **Sous-onglets** : Bibliotheque (23 titres: 19 films + 4 series), Recommandations IA, Preferences
- **Backend** : service Radarr/Sonarr + Claude API + preferences JSON
- **Frontend** : cards avec posters TMDB, filtres, generation IA, gestion preferences chips

## Feature : Session Close DB + Project Actions Integration (2026-03-19)

- **Statut** : COMPLET et fonctionnel (9 phases)
- **DB** : table `session_close` dans `projects.db` (migration 004)
- **Backend** :
  - `session_close_service.py` : CRUD + auto-creation project_actions depuis next_steps
  - `project_actions_service.py` : CRUD avec resolution PRJ-XXX vers integer FK
  - `session_close_routes.py` : 4 endpoints (POST/GET /api/session-close, latest, recent)
  - `project_actions_routes.py` : 5 endpoints (GET/POST/PUT/DELETE /api/project-actions, stats)
- **CLI** : `/data/projects/infrastructure/scripts/session_close.py` (4 subcommands: close, history, recent, actions)
- **Frontend** : 2 nouveaux sous-onglets dans Project Status (Actions Projet, Session Closes)
  - API namespaces dans `api-features.js` : `API.sessionClose`, `API.projectActions`
  - JS render methods dans `project-status.js` : filtres status, CRUD inline, cards expandables
  - CSS dans `project-status.html` : styles `.ps-action-*`, `.ps-close-*`
- **Startup** : `startup_load.py` affiche les actions pending au demarrage
- **Fichiers crees** : session_close_service.py, project_actions_service.py, session_close_routes.py, project_actions_routes.py, session_close.py (CLI)
- **Fichiers modifies** : app.py (blueprints), api-features.js, project-status.js, project-status.html, startup_load.py, fin-session.md, CLAUDE.md

## Feature : Apercu Skool — sous-onglet Formation (2026-03-19)

- **Statut** : COMPLET et fonctionnel
- **Design** : reproduit le layout Skool (sidebar lecons + zone principale video/description/transcript)
- **Backend** :
  - `formation_routes.py` : 2 routes ajoutees (`GET /api/formation/transcript/<week>/<video>`, `GET /api/formation/media/<path>`)
  - Transcripts servis depuis `/data/media/skool-formation/transcriptions/`
  - Videos servies depuis `/data/media/skool-formation/generated/`
- **Frontend** :
  - 3eme sous-onglet "Apercu Skool" dans `formation.html`
  - `formation-apercu.css` (NOUVEAU, ~280 lignes) : dark theme, grid sidebar+main, video 16:9
  - `formation.js` : +150 lignes (loadApercuContent, renderApercuSidebar, selectLesson, renderLessonDetail, loadTranscript)
  - `api-features.js` : 2 methodes ajoutees (getTranscript, getMediaUrl)
- **Videos avatar TTS** : 8 videos S1 generees via `scripts/generate_avatar_videos.py`
  - edge-tts `fr-FR-RemyMultilingualNeural` (MAJ 2026-03-20, ex-HenriNeural) + Pillow (avatar statique) + ffmpeg (MP4 avec sous-titres SRT)
  - Voix Multilingual selectionnee apres comparaison des 5 voix FR disponibles (Remy et Vivienne OK, Henri/Denise/Eloise trop robotiques)
  - Stockees dans `/data/media/skool-formation/generated/S1/` (~43 MB total)
- **Donnees skool_text** : MAJ 2026-03-20 — 30 entrees S1-S4 corrigees (ajout `\n` line breaks), navigation garbage nettoyee (20 entrees), `_formatSkoolText()` simplifie (plus de regex-guessing)
- **Fichiers crees** : `formation-apercu.css`, `generate_avatar_videos.py`
- **Fichiers modifies** : `formation_routes.py`, `formation.html`, `base.html`, `formation.js`, `api-features.js`, `formation.json` (donnees)

## Sous-onglets Project Status — Detail

- **Overview** : stats, table projets, activite recente — MAJ 2026-03-19 : colonne Score ranking (tri cliquable 3 etats), popup detail avec breakdown activite/strategie/sante, recherche nom+description avec highlight, filtre archived
- **Health & Specs** : scan specs, health scan
- **Activity Log** : timeline filtrable, types
- **Sessions Recentes** : derniers SESSION_*.md par projet
- **Modularity** : (2026-03-16) - audit modularite via project-auditor
- ~~**Ranking Strategique**~~ : supprime (2026-03-19) - redondant avec colonne Score dans Overview

## Backend services — Historique complet

- `linkedin_service.py` : NOUVEAU (2026-03-20) - lecture multi-source articles+episodes, quality indicators, review state SQLite
- `linkedin_routes.py` : NOUVEAU (2026-03-20) - Blueprint /api/linkedin, 5 routes (posts CRUD, stats, sync)
- `claude_skills_service.py` : NOUVEAU (2026-03-19) - scan filesystem skills/commands, parse YAML frontmatter
- `claude_skills_routes.py` : NOUVEAU (2026-03-19) - Blueprint /api/claude, 1 route GET skills
- `thread_digest_service.py` : MAJ (2026-03-19) - DB CRUD, hybrid trigger status, multi-proxy
- `whatsapp_proxy_service.py` : NOUVEAU (2026-03-17) - proxy Evolution API WhatsApp
- `signal_proxy_service.py` : NOUVEAU (2026-03-19) - proxy signal-cli-rest-api + stockage local
- `sms_proxy_service.py` : NOUVEAU (2026-03-19) - import XML SMS + stockage SQLite
- `thread_digest_routes.py` : MAJ (2026-03-19) - multi-platform dispatch, Signal poll, SMS import
- `media_recommender_service.py` : (2026-03-16) - Radarr/Sonarr/Claude API/preferences
- `media_recommender_routes.py` : (2026-03-16) - 6 routes Blueprint /api/media-reco

## Fix + Feature : Internet Edit Mode — contraste + reorder (2026-03-21)

- **Statut** : COMPLET et fonctionnel
- **Contraste modal** : background inputs change de `rgba(255,255,255,0.05)` vers `var(--bg-card-hover)` + `color-scheme: dark`
- **Reorder liens** : fleches gauche/droite sur chaque carte en edit mode, swap position via API PUT
- **Reorder categories** : fleches haut/bas sur chaque titre categorie en edit mode, nouveau endpoint `PUT /api/internet/categories/<slug>`
- **Fichiers modifies** : `modern-style.css` (styles modal + arrows), `internet.js` (render arrows + moveLink/moveCategory), `api.js` (updateCategory), `internet_service.py` (update_category), `internet_routes.py` (PUT categories)

## Fichiers cles modifies — Historique complet

- `frontend/static/css/modern-style.css` — fix contraste modal + styles fleches reorder (2026-03-21)
- `frontend/static/js/internet.js` — fleches reorder liens/categories + handlers moveLink/moveCategory (2026-03-21)
- `frontend/static/js/api.js` — ajout updateCategory() (2026-03-21)
- `backend/services/internet_service.py` — ajout update_category() (2026-03-21)
- `backend/api/internet_routes.py` — ajout PUT /categories/<slug> (2026-03-21)
- `backend/services/linkedin_service.py` — NOUVEAU lecture multi-source + quality indicators (2026-03-20)
- `backend/api/linkedin_routes.py` — NOUVEAU blueprint /api/linkedin (2026-03-20)
- `frontend/static/js/linkedin-posts.js` — NOUVEAU module JS cards + modal review (2026-03-20)
- `frontend/templates/linkedin-posts.html` — NOUVEAU template grid + modal detail (2026-03-20)
- `backend/services/claude_skills_service.py` — NOUVEAU scan skills/commands filesystem (2026-03-19)
- `backend/api/claude_skills_routes.py` — NOUVEAU blueprint /api/claude (2026-03-19)
- `frontend/static/js/claude-skills.js` — NOUVEAU module JS skills cards + filtres (2026-03-19)
- `frontend/templates/claude-skills.html` — NOUVEAU template skills page (2026-03-19)
- `backend/services/signal_proxy_service.py` — NOUVEAU proxy Signal + stockage local (2026-03-19)
- `backend/services/sms_proxy_service.py` — NOUVEAU proxy SMS XML import (2026-03-19)
- `backend/services/thread_digest_service.py` — MAJ multi-proxy get_status (2026-03-19)
- `backend/api/thread_digest_routes.py` — MAJ multi-platform dispatch + Signal poll + SMS import (2026-03-19)
- `backend/app.py` — ajout imports signal/sms + platform_proxies dict (2026-03-19)
- `frontend/templates/thread-digest.html` — platform selector + SMS import btn + badges couleur (2026-03-19)
- `frontend/static/js/thread-digest.js` — multi-platform logic ~407 lignes (2026-03-19)
- `frontend/static/js/api.js` — namespace threads 10 methodes (2026-03-17), getRanking (2026-03-19)
- `frontend/static/js/project-status.js` — suppression sub-tab Ranking (redondant), colonne Score header, methodologie (2026-03-19)
- `frontend/static/js/projects-list.js` — colonne Score avec tri 3 etats, popup detail avec breakdown score, rankingMap enrichi (2026-03-19)
- `backend/services/activity_service.py` — scoring per-activity dans get_top_projects (2026-03-19)
- `backend/services/activity_service.py` — get_strategic_ranking via project-auditor (2026-03-19)
- `backend/api/activity_routes.py` — GET /api/projects/ranking (2026-03-19)
- `frontend/static/js/app.js` — import threadDigestModule + case switch (2026-03-17)
- `frontend/templates/base.html` — nav + include + pageTitles (2026-03-17)

## Migration shared_lib.flask_helpers (2026-03-19)

- **Statut** : COMPLET — merge fast-forward sur main
- **Branche** : refactor/flask-helpers-migration → main (branche supprimee)
- **Scope** : 4 commits, 26 fichiers (16 backend .py + 10 frontend .js), -793 / +452 lignes
- **Backend** : 17 route files + app.py migres de `jsonify()` vers `shared_lib.flask_helpers.success/error`
- **Frontend** : 10 JS files migres de `data.status === 'ok'` vers `data.ok`, error msgs `data.error?.message`
- **Exception** : `local-apps-docker.js` non modifie (LLM/SD start/stop = passthroughs docker_service)
- **Format** : `{"ok": true, key1: val1, ...}` (success), `{"ok": false, "error": {"message": "..."}}` (error)
- **Tests** : port 5060 parallele OK, production 5000 relancee et validee

## Merge branche refactor/modularity-audit (2026-03-19)

- **Statut** : MERGE COMPLET (fast-forward sur main)
- **Branche** : refactor/modularity-audit → main (branche supprimee)
- **Scope** : 17 commits, 42 fichiers modifies (refactoring modularite + features ai-profile)
- **Contenu** : reduction violations RED dans services backend (thread_digest, media_recommender, etc.)
- **Verification** : HomeHub API fonctionnel post-merge (localhost:5000)
