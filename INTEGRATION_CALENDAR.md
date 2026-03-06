# Integration du Module Agenda - Instructions

Ce document decrit comment integrer le module Agenda dans HomeHub v2.

## Fichiers Crees

### Backend
- `backend/api/calendar_routes.py` - Routes Flask pour l'API calendrier
- `backend/services/calendar_service.py` - Logique metier semaine type
- `backend/services/google_calendar.py` - Integration Google Calendar OAuth
- `backend/services/schedule_service.py` - Planification des TODOs
- `backend/data/weekly_template.json` - Semaine type en JSON

### Frontend
- `frontend/templates/calendar.html` - Template HTML de l'onglet
- `frontend/static/js/calendar.js` - Module JavaScript
- `frontend/static/css/calendar.css` - Styles CSS

## Modifications a Effectuer

### 1. Backend: app.py

Ajouter l'import et l'enregistrement du blueprint:

```python
# Ligne ~24: Ajouter l'import
from api.calendar_routes import calendar_bp, init_calendar_routes

# Ligne ~47: Enregistrer le blueprint
app.register_blueprint(calendar_bp)
```

### 2. Frontend: base.html

Ajouter l'onglet dans la navigation (apres "TODOs" dans la section Outils):

```html
<!-- Ligne ~47: Apres l'item TODOs -->
<li class="nav-item" data-page="calendar">
    <a href="#calendar">
        <span class="icon">📅</span>
        <span class="label">Agenda</span>
    </a>
</li>
```

### 3. Frontend: app.js

Ajouter le case pour charger le module calendar:

```javascript
// Dans la fonction loadTabData(), ajouter le case:
case 'calendar':
    // Calendar is self-initializing via its template
    break;
```

### 4. Requirements.txt

Ajouter les dependances Google:

```
google-auth>=2.23.0
google-auth-oauthlib>=1.1.0
google-auth-httplib2>=0.1.1
google-api-python-client>=2.108.0
```

### 5. Configuration Google Cloud Console

1. Aller sur https://console.cloud.google.com/
2. Creer un nouveau projet ou selectionner un existant
3. Activer "Google Calendar API"
4. Configurer "OAuth consent screen" (External, nom app, email)
5. Creer des "Credentials" > "OAuth 2.0 Client ID"
   - Type: Web application
   - Redirect URI: `http://localhost:5000/api/calendar/google/callback`
6. Telecharger le JSON et le sauvegarder dans:
   `homehub-v2/credentials/google_oauth.json`

### 6. .gitignore

Ajouter pour securite:

```
credentials/
*.json
!backend/data/weekly_template.json
```

## Test de l'Integration

1. Demarrer HomeHub:
```bash
cd /data/projects/homehub-v2
./start.sh
```

2. Ouvrir http://localhost:5000

3. Cliquer sur l'onglet "Agenda"

4. Verifier:
   - La semaine type s'affiche en fond
   - Le bouton "Connecter" Google apparait
   - Le panel lateral affiche les TODOs P1/P2

## API Endpoints

| Endpoint | Methode | Description |
|----------|---------|-------------|
| `/api/calendar/template` | GET | Recuperer semaine type |
| `/api/calendar/template` | PUT | Modifier semaine type |
| `/api/calendar/google/status` | GET | Status connexion Google |
| `/api/calendar/google/auth` | GET | Initier OAuth |
| `/api/calendar/events` | GET | Evenements Google |
| `/api/calendar/schedule/propose` | GET | Proposition planning |
| `/api/calendar/schedule/apply` | POST | Appliquer planning |
| `/api/calendar/combined` | GET | Vue combinee complete |

## Prochaines Etapes

1. [ ] Effectuer les modifications dans app.py
2. [ ] Ajouter l'onglet dans base.html
3. [ ] Ajouter le case dans app.js
4. [ ] Installer les dependances pip
5. [ ] Configurer Google Cloud Console
6. [ ] Tester l'integration
