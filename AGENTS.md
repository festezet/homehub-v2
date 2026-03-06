# AGENTS.md

## Project Overview

**HomeHub v2** is a centralized dashboard for managing 40+ development projects, Docker containers, system monitoring, and local services. It serves as the single control point for an entire self-hosted development infrastructure.

## Key Facts

- **Author**: Fabrice Estezet
- **Stack**: Python 3, Flask, SQLite, JavaScript (vanilla), Docker API
- **License**: Personal use
- **Status**: Production

## Architecture

```
backend/app.py              → Flask application (unified backend)
backend/api/                → REST API routes
backend/models/             → SQLAlchemy models
backend/services/           → Business logic
frontend/templates/         → Jinja2 HTML templates (tabbed interface)
frontend/static/css/        → Modular CSS (5 modules)
frontend/static/js/         → Modular JS (9 modules: api, utils, tabs, todo, docker, etc.)
```

## Features

- **Project Dashboard**: Overview of all projects with status and quick actions
- **Docker Control**: Start/stop containers, view logs, manage AI stacks (Ollama, Stable Diffusion)
- **Todo API**: Full CRUD with categories, priorities, and objectives
- **Bookmark Manager**: Internet links with auto-categorization
- **System Monitor**: Real-time CPU, GPU, RAM, storage metrics
- **Application Launcher**: Launch native Linux apps with proper X11 environment handling

## API Endpoints

- `GET/POST/PUT/DELETE /api/todos` - Todo list management
- `GET/POST/PUT/DELETE /api/internet/links` - Bookmark management
- `GET /api/docker/containers` - Docker container status
- `POST /api/docker/<service>/start|stop` - Docker service control
- `GET /api/system/stats` - System metrics
- `POST /api/launch/<app>` - Launch native applications

## Skills Demonstrated

- Full-stack web development (Flask + vanilla JS)
- Docker API integration and container orchestration
- Modular frontend architecture without frameworks
- REST API design with multiple resource types
- System-level Linux integration (X11, D-Bus, process management)
- SQLite database management
