# SESSION — Claude Config Merge (PRJ-002)
Date : 2026-04-15

## Contexte
HomeHub avait 2 pages separees pour la configuration Claude Code :
- **Claude Skills** : cartes skills avec metadata, filtres, tableau scores D1-D4
- **Claude Instructions** : arbre fichiers `.claude/`, visualisation logigramme D3

Objectif : fusionner en une seule page "Claude Config" avec 4 sous-onglets.

## Travail realise

### Fusion frontend (pas de modif backend)
- Cree `claude-config.html` (185 lignes) — template unifie avec 4 sub-tabs
- Cree `claude-config.js` (~520 lignes) — module fusionne `ClaudeConfigModule`
- Modifie `base.html` — 1 include au lieu de 2, hash redirects backward compat
- Modifie `app.js` — 1 import/loader au lieu de 2
- Modifie `sidebar.db` — 2 tabs supprimees, 1 nouvelle tab "Claude Config"
- Supprime `claude-skills.html`, `claude-skills.js`, `claude-instructions.html`, `claude-instructions.js`

### Sous-onglets
1. **Skills** : cartes skills avec filtres Global/Local/Commands
2. **Analysis D1-D4** : tableau scores qualite avec pagination et modal detail
3. **Browser** : arbre fichiers `.claude/` + viewer de fichier
4. **Logigramme** : graphe D3 cross-references entre fichiers

### Bug fixes
- **Infinite recursion Browser** : `window.ClaudeConfigModule` = meme reference objet que `claudeConfigModule`. Les arrow functions assignees en own-properties shadowed les methodes prototype, causant une boucle infinie. Fix : suppression des 3 lignes d'assignation.
- **Fond blanc tableau Analysis** : `background: #0d1117` applique seulement au premier `<td>`, les autres avaient le fond blanc par defaut. `onmouseout` resetait a `transparent`. Fix : background deplace sur `<tr>`, `onmouseout` restaure `#0d1117`.

## Decisions
- Backend inchange (services/routes intactes) — pure consolidation frontend
- Pas de split du module JS (520 lignes < seuil 700 du plan)
- Prefixe `cc-` pour tous les IDs DOM (eviter collisions)

## Fichiers cles
- `frontend/templates/claude-config.html`
- `frontend/static/js/claude-config.js`
- `frontend/templates/base.html` (modifie)
- `frontend/static/js/app.js` (modifie)
