# SESSION 2026-03-13 : Onglet Project Status unifie (Phases 3 + 4)

## Contexte

Suite des sessions precedentes (Phases 1 + 2). Objectif : fusionner 3 onglets separes (Liste Projets, Specifications, Activite) en 1 onglet "Project Status" avec 3 sous-onglets.

Plan complet : `/home/fabrice-ryzen/.claude/plans/groovy-greeting-anchor.md`

## Phase 3 : Navigation (swap visible)

### base.html - 8 edits
- Retire nav items : `projects-list`, `specs`, `activity`
- Ajoute nav item `project-status` (section Systeme)
- Retire page divs : `#projects-list-page`, `#specs-page`, `#activity-page`
- Ajoute page div `#project-status-page` avec `{% include 'project-status.html' %}`
- Ajoute script tag `project-status.js`
- MAJ `pageTitles` : retire 3 entries, ajoute `project-status`
- Ajoute hash redirects backward compat (`#projects-list`, `#specs`, `#activity` -> `#project-status`)

### app.js
- Import `projectStatusModule`
- Remplace 3 cases switch par 1 case `project-status`

## Phase 4 : Integration Claude + cleanup

### Instruction fin de session
- `CLAUDE.md` : ajout checklist item "Activity Log" dans section Fin de Session
- `rules/fin-session.md` : section complete avec template curl POST, types disponibles, explications

### Cleanup fichiers orphelins
- **Templates supprimes** : `activity.html`, `projects-list.html`, `specs.html` (plus references nulle part)
- **JS supprime** : `activity.js` (plus importe nulle part)
- **Imports nettoyes** : `app.js` retire `activityModule`, `projectsListModule`, `specsModule`
- **tabs.js** : retire case `'activity'` obsolete
- **base.html** : retire script tag `activity.js`

### Verification
- 200 milestones en DB, 19 projets actifs
- API fonctionnelle (timeline, stats, log)
- Session enregistree via POST API (id #202)
- Homepage HTTP 200

## Fichiers modifies

### homehub-v2
| Fichier | Action |
|---------|--------|
| `frontend/templates/base.html` | Modifie (nav, pages, scripts, hash redirects) |
| `frontend/static/js/app.js` | Modifie (imports, switch) |
| `frontend/static/js/tabs.js` | Modifie (retire case activity) |
| `frontend/templates/activity.html` | Supprime |
| `frontend/templates/projects-list.html` | Supprime |
| `frontend/templates/specs.html` | Supprime |
| `frontend/static/js/activity.js` | Supprime |

### infrastructure
| Fichier | Action |
|---------|--------|
| `.claude/CLAUDE.md` | Modifie (checklist fin session) |
| `.claude/rules/fin-session.md` | Modifie (section Activity Log) |

## Etat final

Les 4 phases du plan sont completes. L'onglet "Project Status" est fonctionnel avec :
- **Overview** : stats + tableau projets + 5 dernieres activites
- **Health & Specs** : tracking specs + sante (delegue a specs.js)
- **Activity Log** : timeline filtrable par projet/type (50 entries)

API Activity : GET timeline, GET stats, GET project/<id>, POST log
