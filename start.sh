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

# Start Docker Control API (port 9999) if not already running
if ! curl -s http://localhost:9999/api/health > /dev/null 2>&1; then
    echo "🐳 Démarrage Docker Control API (port 9999)..."
    python3 /data/projects/infrastructure/scripts/docker_control_server.py &
    sleep 1
else
    echo "✅ Docker Control API déjà actif"
fi

# Start Flask application
echo "✅ Lancement serveur Flask..."
echo "📊 URL: http://localhost:5000"
python3 backend/app.py
