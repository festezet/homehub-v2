#!/bin/bash
# HomeHub v2 - Start Script

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🚀 Démarrage HomeHub v2..."

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "📦 Création environnement virtuel..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install/update dependencies
echo "📥 Installation dépendances..."
pip install -q -r requirements.txt

# Start TODO API (port 9998) if not already running
if ! curl -s http://localhost:9998/health > /dev/null 2>&1; then
    echo "📋 Démarrage TODO API (port 9998)..."
    python3 /data/projects/infrastructure/scripts/launcher_server.py &
    sleep 1
else
    echo "✅ TODO API déjà actif"
fi

# Docker Control API (port 9999) - managed by systemd: homehub-docker-control.service
# Enable if not done: sudo systemctl enable --now homehub-docker-control.service
if ! curl -s http://localhost:9999/api/health > /dev/null 2>&1; then
    echo "⚠️  Docker Control API (port 9999) non actif"
    echo "   Activer: sudo systemctl enable --now homehub-docker-control.service"
fi

# Start Media Recommender (port 5056) if not already running
if ! curl -s http://localhost:5056/api/health > /dev/null 2>&1; then
    echo "🎬 Démarrage Media Recommender (port 5056)..."
    bash /data/projects/media-recommender/scripts/start.sh > /tmp/media-reco.log 2>&1 &
    sleep 2
else
    echo "✅ Media Recommender déjà actif"
fi

# Start Flask application
echo "✅ Lancement serveur Flask..."
echo "📊 URL: http://localhost:5000"
python3 backend/app.py
