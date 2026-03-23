# Changelog — HomeHub v2

All notable changes to this project will be documented in this file.

## [2.1.0] - 2026-03-20

### Added
- LinkedIn Posts Review page: browse, filter, and review LinkedIn posts (articles + episodes) before publication
- Quality indicators: char count, hook detection, CTA, hashtags, emojis with color-coded badges
- Review workflow with status management (draft/ready/review/published/archived) and notes
- Multi-source reading: articles from ai-profile content.json, episodes from ai-video-studio markdown files

## [2.0.0] - 2026-03-19

### Added
- Project Actions and Session Close routes with UI
- Claude Skills page and project status ranking
- AI Profile UI enhancements, signal/SMS proxy services
- Activity log, project-status detail page, ai-profile page
- Google Calendar integration with CRUD
- Services & Ports page
- Formation tab with action tracker and Skool content browser
- Internet tab with edit mode
- Thread digest module
- Media recommender module
- Refresh buttons, click-to-pin panels

### Changed
- Migrated routes (batches 1 & 2) to shared_lib.flask_helpers
- Migrated app.py to shared_lib.flask_helpers + db
- Migrated google_calendar auth to shared-lib
- Extracted inline CSS to external files, removed dead CSS
- Unified Project Status tab with specs tracking

### Fixed
- Restored @app.route('/api/projects') on correct function
- Fixed 17+ Python RED modularity violations
- Fixed remaining RED violations in api-features.js and media-recommender.js

### Refactored
- Split calendar.js (1003 lines) into calendar.js + calendar-gcal.js
- Split local-apps.js into local-apps.js + local-apps-docker.js
- Split todo.js into todo.js + todo-renderers.js
- Split api.js into api.js + api-features.js
- Extracted sub-functions in specs.js, formation.js, internet.js, thread-digest.js, media-recommender.js, project-status.js
- Modularity audit: 53 RED reduced to manageable level
