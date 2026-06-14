# SESSION 2026-04-28 — LinkedIn Posts : sous-onglets compte/stage + thumbnails + dates

**Projet** : PRJ-010 (homehub-v2) + PRJ-019 (ai-video-studio, contenu episodes)
**Duree** : ~3h
**Categorie** : dev

## Contexte

Fabrice a publie sur LinkedIn la serie "#TheGreatCompression" sur le compte AI :
- Mercredi 22 avril 2026 : teaser/lead magnet ("I analyzed the 10 most profitable AI companies per employee in 2026...")
- Mardi 28 avril 2026 : Episode 1 ("Build the organization around AI")

Besoin : interface HomeHub pour suivre l'avancement des posts par compte LinkedIn (AI, Offshore Wind) et par stage (Idees vs Post en cours), avec thumbnails images et dates d'envoi.

## Travail effectue

### 1. Backend — `linkedin_service.py`
- Ajout du champ `account` :
  - Articles (offshore wind) → `account='offshore-wind'`
  - Episodes (compression) → `account='ai'`
- Migration DB additive : `ALTER TABLE post_reviews ADD COLUMN stage TEXT DEFAULT 'idea'`
- Migration DB additive : `ALTER TABLE post_reviews ADD COLUMN scheduled_at TEXT`
- Nouvelle methode `_extract_image_path()` :
  - Markdown image syntax : `![alt](path)` (relatif au .md ou absolu)
  - Inline references : `images/xxx.png` dans blocs metadata
- Champ `has_image` (bool) ajoute au merge get_all_posts
- Stats etendues : `by_account`, `by_stage`, `per_account[acc].{by_status, by_stage, total}`
- `update_review()` accepte desormais `stage`, `scheduled_at`, `published_at`
- Fix `_parse_episode()` : strip lignes image markdown en debut de body + suppression inline `![alt](path)` (evite que le body affiche `![Episode 1 visual](images/episode_01.png)` en clair)

### 2. Backend — `linkedin_routes.py`
- PUT `/api/linkedin/posts/<id>/review` accepte `stage`, `scheduled_at`, `published_at`
- Nouveau endpoint GET `/api/linkedin/posts/<id>/image` :
  - Sert l'image associee via `send_file`
  - Protection path traversal : verification que `realpath` reste sous `/data/projects/ai-video-studio/data/output/posts`

### 3. Frontend — `linkedin-posts.html`
- Ajout `#linkedin-account-tabs` : 3 boutons `data-account="all|ai|offshore-wind"` avec compteur
- Ajout `#linkedin-stage-tabs` : 2 boutons `data-stage="idea|in_progress"` (💡 Idees / ⚡ Post en cours) avec compteur
- Defaut : tab "⚡ Post en cours" actif a l'ouverture (au lieu de "Idees")

### 4. Frontend — `linkedin-posts.js`
- State : `currentAccount='all'`, `currentStage='in_progress'`
- `_setActiveTab(account)`, `_setActiveStage(stage)`, `_renderTabCounts()` : visuel + filtrage
- `_applyFilters()` cumulatif : account + stage + type + status + serie, **trie par serie + numero d'episode** (TEASER → EP01 → ... → EP10)
- `_episodeNumber(p)` : extrait `EP00` → `TEASER`, `EP01`...`EP10` depuis `id`
- Cartes :
  - Thumbnail haute (140px) : vraie image via `/api/linkedin/posts/<id>/image` SI `has_image`, sinon placeholder noir avec gros texte vert monospace (style brand)
  - Badge orange episode (`TEASER`, `EP01`...) en tete
  - Badge date : `📅 Envoye DD/MM/YYYY` (published) ou `⏰ Prevu DD/MM/YYYY` (scheduled)
- Modal detail :
  - Image preview (max-height 320px)
  - Badge orange episode en gros
  - 2 inputs date : `linkedin-review-scheduled` (date prevue) + `linkedin-review-published` (date envoi reelle)
  - Bouton toggle stage (Idee ⇄ En cours)
- Fix bug initial render : `_loadPosts()` appelait `_renderPosts(this.posts)` direct (sans tri) → maintenant `_applyFilters()`

### 5. Contenu (PRJ-019)
- Cree `/data/projects/ai-video-studio/data/output/posts/serie1/episode_00.md` (teaser EN, lead magnet "Like + comment COMPRESSION")
- Copie `/home/fabrice-ryzen/Downloads/Grande compression post AI 1.png` → `serie1/images/teaser_01.png`
- Re-ecrit `/data/projects/ai-video-studio/data/output/posts/serie1/episode_01.md` en EN (texte publie)
- Copie `/home/fabrice-ryzen/Downloads/Grande compression post AI 2.png` → `serie1/images/episode_01.png`

### 6. DB updates (post_reviews)
- `serie1-ep00` : `status='published'`, `stage='in_progress'`, `published_at='2026-04-22 16:00:00'`
- `serie1-ep01` : `status='published'`, `stage='in_progress'`, `published_at='2026-04-28 16:00:00'`
- `serie1-ep02` a `serie1-ep10` : `stage='in_progress'` (preparation)

## Decisions

- **Account deduit du type** plutot que stocke en DB : evite migration de donnees, simple regle (article→offshore-wind, episode→ai)
- **Migrations additives uniquement** : `ADD COLUMN` avec defaut, jamais DROP+CREATE (cf. CLAUDE.md interdiction DB ephemere)
- **Path traversal protection** : `realpath` check sur endpoint image (allowed_root strict)
- **Default stage = "Post en cours"** : Fabrice travaille principalement sur les posts actifs
- **Placeholder thumbnail** : style monospace noir/vert pour mimer le brand visuel (evite texte gris terne)

## Fichiers modifies

- `/data/projects/homehub-v2/backend/services/linkedin_service.py`
- `/data/projects/homehub-v2/backend/api/linkedin_routes.py`
- `/data/projects/homehub-v2/frontend/templates/linkedin-posts.html`
- `/data/projects/homehub-v2/frontend/static/js/linkedin-posts.js`
- `/data/projects/homehub-v2/.claude/PROJECT_STATUS.md`
- `/data/projects/homehub-v2/data/linkedin_posts.db` (3 backups crees, pattern `.bak-YYYYMMDD-HHMMSS`)
- `/data/projects/ai-video-studio/data/output/posts/serie1/episode_00.md` (CREE)
- `/data/projects/ai-video-studio/data/output/posts/serie1/episode_01.md` (REECRIT EN)
- `/data/projects/ai-video-studio/data/output/posts/serie1/images/teaser_01.png` (COPIE)
- `/data/projects/ai-video-studio/data/output/posts/serie1/images/episode_01.png` (COPIE)

## Prochaines etapes

1. **Generer thumbnails reels EP02-EP10** : creer les visuels de la serie (10 images au style de teaser_01/episode_01) — depend de la production design
2. **Pre-remplir scheduled_at EP02-EP10** : cadence mercredi hebdomadaire (06/05, 13/05, 20/05, 27/05, 03/06, 10/06, 17/06, 24/06, 01/07)
3. **Traduire EP02-EP10 en EN** : actuellement en FR dans `episode_*.md`, alignement avec EP00/EP01

## Tests

Verifies via curl :
- `GET /api/linkedin/posts?serie=serie1` : 11 posts (ep00 a ep10), tous `stage=in_progress`, `account=ai`
- `GET /api/linkedin/posts/serie1-ep01` : `body` commence par "Most companies add AI..." (markdown image strippe), `has_image=True`, `published_at=2026-04-28 16:00:00`
- `GET /api/linkedin/posts/serie1-ep01/image` : 200 OK, image PNG servie

## URL

http://localhost:5000/#linkedin-posts

## Lecons

- **Fabrice teste tres concretement** : a fourni screenshots + textes EN reels pour valider l'integration. Le systeme de placeholder (gradient gris discret) etait insuffisant — il a fallu un style plus marque pour qu'il considere ca comme un "thumbnail".
- **Browser cache + ES modules** : `Cache-Control: no-cache` ne suffit pas toujours, hard reload (Ctrl+F5) reste necessaire apres edit JS. ETag se met a jour mais browser peut avoir un cache plus aggressif.
- **DB backup avant migration** : 3 backups crees pendant la session (avant ALTER TABLE stage, avant ALTER TABLE scheduled_at, avant UPDATE serie1-%). Rapide a faire, evite les regressions.
