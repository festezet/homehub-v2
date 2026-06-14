# SESSION 2026-04-10 — Dynamic Sidebar + Dynamic Pages

## Resume

Implementation de deux features majeures pour HomeHub v2 : sidebar dynamique pilotee par base de donnees (SQLite) avec edit mode, et systeme de pages HTML dynamiques creees a la volee par Claude.

## Travail realise

### Dynamic Sidebar
- **Backend** : `sidebar_routes.py` (API CRUD /api/sidebar/*), `sidebar_service.py` (SQLite sidebar.db)
- **Frontend** : `sidebar-edit.js` (edit mode avec reorder sections/tabs par fleches haut/bas)
- **DB** : `sidebar.db` — tables `sections` (6 sections) et `tabs` (30 tabs), `sort_order` pour l'ordre
- **Features** : rename sections, rename tabs, add/delete tabs, cross-section tab moves (reassign_tab), reorder via fleches

### Dynamic Pages
- **Backend** : `dynamic_pages_routes.py` (CRUD + /pin), `dynamic_pages_service.py` (SQLite dynamic_pages.db)
- **Frontend** : `dynamic-pages.js` (chargement, injection sidebar, toolbar), `dynamic-pages.css`
- **API client** : `api-features.js` — namespace `API.dynamicPages` (list, get, create, delete, pin)
- **Routing** : `base.html` switchPage gere les IDs `dp-*` vers le module dynamic-pages

### Boutons Garder/Supprimer (remplacement TTL)
- Suppression du TTL automatique 24h — pages permanentes par defaut
- Ajout boutons "Garder" (pin) et "Supprimer" (delete) en bas de chaque page dynamique
- Endpoint `POST /api/dynamic-pages/<id>/pin` pour epingler
- Badge "Gardee" pour les pages pinnees
- L'utilisateur controle le cycle de vie, pas le systeme

### Bug fix : sections dupliquees
- `dynamic-pages.js` `injectSidebarTab()` cherchait `data-section-name` mais les sections DB utilisent `data-section-id`
- Fix : recherche intermediaire par texte du titre de section

## Fichiers modifies

- `backend/api/sidebar_routes.py` — API sidebar CRUD
- `backend/api/dynamic_pages_routes.py` — API dynamic pages CRUD + pin
- `backend/services/sidebar_service.py` — service sidebar (SQLite)
- `backend/services/dynamic_pages_service.py` — service dynamic pages (SQLite, pin, cleanup lazy)
- `backend/app.py` — enregistrement blueprints sidebar + dynamic_pages
- `frontend/templates/base.html` — sidebar layout DB-driven, routing dp-*
- `frontend/static/js/sidebar-edit.js` — edit mode sidebar
- `frontend/static/js/dynamic-pages.js` — module pages dynamiques + toolbar Garder/Supprimer
- `frontend/static/js/api-features.js` — API.sidebar + API.dynamicPages
- `frontend/static/css/dynamic-pages.css` — styles pages dynamiques
- `data/sidebar.db` — DB sidebar (cree)
- `data/dynamic_pages.db` — DB pages dynamiques (cree)

## Decisions

- Pages permanentes par defaut (pas de TTL) — l'utilisateur decide via boutons
- Section "Claude" par defaut pour les pages generees
- Sidebar DB-driven avec fallback template Jinja si DB vide
- Lazy cleanup conserve pour les pages avec TTL explicite (usage API)

## Prochaines etapes

- Tester les boutons Garder/Supprimer dans le navigateur
- Creer d'autres pages dynamiques pour valider le workflow
