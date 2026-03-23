# HomeHub v2 - Architecture Moderne

**Version** : 2.0 (en cours de migration)
**Basé sur** : Architecture Crypto Portfolio
**Date** : 2025-11-25 | **Derniere mise a jour** : 2026-03-22
**Dernière mise à jour** : 2026-03-21

## 🎯 Objectif

Refonte de HomeHub v1 (fichier monolithe de 3500 lignes) vers une architecture moderne, modulaire et maintenable.

## 📂 Structure

```
homehub-v2/
├── backend/                    # Backend Python Flask
│   ├── api/                   # Routes API REST
│   ├── models/                # Modèles SQLAlchemy
│   └── services/              # Logique métier
├── frontend/
│   ├── templates/             # Templates Jinja2
│   └── static/
│       ├── css/              # CSS modulaire
│       └── js/               # JavaScript modulaire
├── data/                      # Base de données SQLite
└── docs/                      # Documentation

Total estimé : ~4500 lignes réparties en ~25 fichiers (< 500 lignes chacun)
```

## 📚 Documentation

- **`docs/spec/SPEC.md`** : Specification technique complete (architecture, modele de donnees, features, API)
- **`docs/MIGRATION_ANALYSIS.md`** : Analyse complète de la migration v1 → v2
  - Comparaison avec Crypto Portfolio
  - Plan de migration détaillé
  - Recommandations

- **`docs/LESSONS_LEARNED.md`** : Résolution des bugs majeurs
  - BUG-001 : Lancement applications GUI (résolu 2026-02-23)
  - Solutions détaillées et leçons apprises

## 🚀 Avantages

- ✅ Fichiers < 500 lignes (vs 3500 actuellement)
- ✅ Backend Flask unifié (vs 3 services séparés)
- ✅ Code modulaire et testable
- ✅ Maintenance facilitée
- ✅ Évolutivité

## 📊 État d'avancement

- [x] Structure créée
- [x] Documentation rédigée
- [x] **Phase 1 : Extraction CSS/JS** ✅ (2025-12-04)
  - 5 modules CSS (base, tabs, cards, buttons, dashboard)
  - 4 modules JS fondamentaux (api, utils, tabs, app)
  - 6 templates Jinja2
  - Setup Flask backend + CORS
  - Script démarrage automatisé
- [x] **Phase 2 : Modules fonctionnels JS** ✅ (2025-12-04)
  - Module TODO (CRUD complet, tri, filtres, édition inline)
  - Module Docker (contrôle containers, auto-refresh)
  - Module Local (lancement applications)
  - Module Activity (placeholder timeline)
  - Module Infrastructure (monitoring statique)
  - Total : 9 modules JS (~40 Ko)
- [x] **Widget Backup Status** ✅ (2025-12-27)
  - Intégration dans System Monitor
  - API backup-status (port 8887)
  - Affichage date/statut backups système et données
- [x] **Lancement AI Docker depuis Applications locales** ✅ (2025-12-27)
  - Section dédiée "Applications IA (Docker)"
  - Carte LLM Local (Ollama + Open WebUI) avec statut temps réel
  - Carte Stable Diffusion avec statut temps réel
  - API Docker : `/api/docker/llm/start`, `/api/docker/stable-diffusion/start`, `/api/docker/llm/stop`, `/api/docker/stable-diffusion/stop`
  - Notifications toast + activation automatique boutons "Ouvrir WebUI"
  - **Correction port Open WebUI** : 8081 (au lieu de 8080, conflit avec qBittorrent)
  - **Boutons arrêt manuel** : Stopper LLM ou SD pour libérer VRAM
  - Mot de passe Open WebUI : `fabrice2025`
- [x] **Onglet Prompting Disciplines** ✅ (2026-03-06)
  - Section Système : nouvel onglet "🧠 Prompting Disciplines"
  - Documentation complète des 4 disciplines (D1-D4)
  - Stats contexte, explications détaillées, maintenance, quick reference
  - Lien avec PRJ-044 (prompting-disciplines)
- [ ] Phase 3 : Backend Flask API unifiée
- [ ] Phase 4 : Modèles SQLAlchemy
- [ ] Phase 5 : Services métier

## Installation

```bash
git clone <repo-url> /data/projects/homehub-v2
cd /data/projects/homehub-v2
pip install -r requirements.txt
```

## Usage

```bash
cd /data/projects/homehub-v2
bash start.sh
```

L'application est accessible sur http://localhost:5000.

## 🚀 Démarrage

### Lancer l'application

```bash
cd /data/projects/homehub-v2
bash start.sh
```

L'application sera accessible sur :
- **Interface web** : http://localhost:5000
- **API Health** : http://localhost:5000/api/health

### Services requis

HomeHub v2 communique avec ces services (doivent être démarrés) :
- **TODO API** : http://localhost:9998 (port 9998)
- **Docker Control API** : http://localhost:9999 (port 9999)

### Services AI (optionnels)

Accessible via l'onglet "Applications Locales" :
- **Open WebUI** : http://localhost:8081 (LLM locaux Ollama)
  - Identifiants : `fabrice.estezet@gmail.com` / `fabrice2025`
  - Modèles : mistral:7b, llama3.1:8b
- **Stable Diffusion WebUI** : http://localhost:7860 (génération d'images)

Pour les démarrer :
```bash
# TODO API
/data/projects/project-management/scripts/start_todo_server.sh

# Docker Control API
/data/projects/infrastructure/scripts/start_docker_control.sh
```

## 🔗 Références

- **HomeHub v1** : `/data/projects/infrastructure/HomeHub.html`
- **Crypto Portfolio** : `/data/projects/crypto-portfolio/`
- **API TODO existante** : `http://localhost:9998/api/todos`
- **Docker Control** : `http://localhost:9999/`

## 🐛 Bugs Connus

### ~~BUG-001 : Lancement applications natives~~ ✅ RÉSOLU
- **Statut** : ✅ **Résolu le 2026-02-23**
- **Date découverte** : 2025-12-19
- **Description** : Le clic sur les raccourcis d'applications natives (onglet "Applications") affichait "lancé avec succès" mais l'application ne s'ouvrait pas visuellement.
- **Cause** : Variables d'environnement incomplètes. DISPLAY/XAUTHORITY ne suffisent pas, il manquait DBUS_SESSION_BUS_ADDRESS et XDG_RUNTIME_DIR.
- **Solution** : Capture de l'environnement complet depuis `/proc/<systemd-user-pid>/environ` + logs visibles dans `/tmp/`
- **Voir** : `docs/LESSONS_LEARNED.md` pour la documentation complète de la résolution
- **Fichiers modifiés** :
  - `backend/app.py` (fonction `get_x11_env()`, lignes 37-100)
  - `backend/app.py` (lancement avec logs, lignes ~460 et ~520)

## 📝 Notes

Migration progressive recommandée : 8-12h de travail
Pas de React nécessaire : Vanilla JS suffit
