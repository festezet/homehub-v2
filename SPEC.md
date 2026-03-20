# SPEC — HomeHub v2 (PRJ-010)

## Objectif
Dashboard personnel centralise : todolist, controle Docker, lancement d'applications, monitoring systeme, suivi projets.

## Stack technique
- Python Flask (backend, port 5000)
- Jinja2 + Vanilla JS + CSS modulaire (frontend)
- SQLite (todos, internet_links, projets)
- Communique avec TODO API (9998) et Docker Control API (9999)

## Architecture
- `backend/app.py` : serveur Flask principal (routes + API)
- `backend/api/` : routes API REST (todos, docker, projects, specs, internet links)
- `backend/services/` : logique metier (specs_service, docker_control, etc.)
- `frontend/templates/` : templates Jinja2 (6 templates)
- `frontend/static/js/` : 9 modules JS (~40 Ko)
- `frontend/static/css/` : 5 modules CSS

## Interfaces
- Web : `http://localhost:5000` (lancement via `bash start.sh`)
- API : `/api/todos`, `/api/docker/*`, `/api/internet/links`, `/api/specs/*`
- Ports : 5000 (web), 9998 (TODO API), 9999 (Docker Control)

## Contraintes
- Migration progressive depuis v1 (monolithe 3500 lignes) — phases 3-5 restantes
- Necessite services backend TODO API et Docker Control demarres separement
- Specification technique detaillee dans `docs/spec/SPEC.md`
