#!/usr/bin/env python3
"""
Seed Local Apps DB - Idempotent migration script
Imports active/stable projects from projects.db + Docker AI apps
"""

import sqlite3
import os
import sys

DB_PATH = '/data/projects/homehub-v2/data/local_apps.db'
PROJECTS_DB = '/data/projects/project-management/data/projects.db'

CATEGORIES = [
    ('ai', 'AI', '', 0),
    ('development', 'Development', '', 1),
    ('business', 'Business', '', 2),
    ('creative', 'Creative', '', 3),
    ('infrastructure', 'Infrastructure', '', 4),
    ('data', 'Data', '', 5),
    ('integration', 'Integration', '', 6),
]

# Docker AI apps to add
DOCKER_APPS = [
    {
        'name': 'LLM Local (Ollama)',
        'description': 'Modeles de langage locaux (Llama, Mistral) avec interface Open WebUI. GPU requis.',
        'category_slug': 'ai',
        'icon': '',
        'app_type': 'docker',
        'project_id': 'DOCKER-AI-LLM',
        'web_url': 'http://localhost:8081',
        'docker_stack': 'llm',
        'position': 0,
    },
    {
        'name': 'Stable Diffusion',
        'description': 'Generation d\'images par IA. GPU requis, temps de demarrage 2-3 min.',
        'category_slug': 'ai',
        'icon': '',
        'app_type': 'docker',
        'project_id': 'DOCKER-001',
        'web_url': 'http://localhost:7860',
        'docker_stack': 'stable-diffusion',
        'position': 1,
    },
]

# Additional apps not in projects.db
ADDITIONAL_APPS = [
    {
        'name': 'Claude Voice Input',
        'description': 'Dictee vocale avec Whisper pour Claude Code',
        'category_slug': 'ai',
        'icon': '',
        'app_type': 'system',
        'project_id': 'APP-005',
        'launcher_path': '/data/projects/voice-dictation/scripts/start_claude_voice_input.sh',
        'position': 2,
    },
]


def seed():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON")
    cursor = conn.cursor()

    # Create tables (idempotent)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS app_categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            slug TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            icon TEXT DEFAULT '',
            position INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS app_entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT DEFAULT '',
            category_slug TEXT NOT NULL,
            icon TEXT DEFAULT '',
            app_type TEXT NOT NULL DEFAULT 'project',
            project_id TEXT DEFAULT '',
            launcher_path TEXT DEFAULT '',
            launcher_type TEXT DEFAULT '',
            web_url TEXT DEFAULT '',
            docker_stack TEXT DEFAULT '',
            launch_count INTEGER DEFAULT 0,
            last_launched TIMESTAMP,
            position INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (category_slug) REFERENCES app_categories(slug)
        )
    """)
    conn.commit()

    # Seed categories (idempotent via INSERT OR IGNORE)
    for slug, name, icon, position in CATEGORIES:
        cursor.execute(
            "INSERT OR IGNORE INTO app_categories (slug, name, icon, position) VALUES (?, ?, ?, ?)",
            (slug, name, icon, position)
        )
    conn.commit()
    print(f"Categories: {len(CATEGORIES)} seeded")

    # Import projects from projects.db
    if not os.path.exists(PROJECTS_DB):
        print(f"WARNING: {PROJECTS_DB} not found, skipping project import")
    else:
        proj_conn = sqlite3.connect(PROJECTS_DB)
        proj_conn.row_factory = sqlite3.Row
        proj_cursor = proj_conn.cursor()

        proj_cursor.execute("""
            SELECT unique_id, name, description, category, path, launcher_path, launcher_type, web_url
            FROM projects
            WHERE status IN ('active', 'stable')
            ORDER BY category, name
        """)

        imported = 0
        skipped = 0

        for row in proj_cursor.fetchall():
            project_id = row['unique_id']

            # Skip if already exists (idempotent)
            cursor.execute("SELECT id FROM app_entries WHERE project_id = ?", (project_id,))
            if cursor.fetchone():
                skipped += 1
                continue

            # Map category - use as-is since categories match
            category_slug = row['category'] or 'development'

            cursor.execute("""
                INSERT INTO app_entries (name, description, category_slug, app_type, project_id,
                                        launcher_path, launcher_type, web_url, position)
                VALUES (?, ?, ?, 'project', ?, ?, ?, ?, 0)
            """, (
                row['name'],
                row['description'] or '',
                category_slug,
                project_id,
                row['launcher_path'] or '',
                row['launcher_type'] or 'bash',
                row['web_url'] or '',
            ))
            imported += 1

        proj_conn.close()
        conn.commit()
        print(f"Projects: {imported} imported, {skipped} already existed")

    # Add Docker apps (idempotent)
    docker_added = 0
    for app in DOCKER_APPS:
        cursor.execute("SELECT id FROM app_entries WHERE project_id = ?", (app['project_id'],))
        if cursor.fetchone():
            continue
        cursor.execute("""
            INSERT INTO app_entries (name, description, category_slug, icon, app_type,
                                    project_id, web_url, docker_stack, position)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            app['name'], app['description'], app['category_slug'], app['icon'],
            app['app_type'], app['project_id'], app['web_url'], app['docker_stack'],
            app['position']
        ))
        docker_added += 1
    conn.commit()
    print(f"Docker apps: {docker_added} added")

    # Add additional apps (idempotent)
    additional_added = 0
    for app in ADDITIONAL_APPS:
        cursor.execute("SELECT id FROM app_entries WHERE project_id = ?", (app['project_id'],))
        if cursor.fetchone():
            continue
        cursor.execute("""
            INSERT INTO app_entries (name, description, category_slug, icon, app_type,
                                    project_id, launcher_path, position)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            app['name'], app['description'], app['category_slug'], app['icon'],
            app['app_type'], app['project_id'], app.get('launcher_path', ''),
            app['position']
        ))
        additional_added += 1
    conn.commit()
    print(f"Additional apps: {additional_added} added")

    # Summary
    cursor.execute("SELECT COUNT(*) FROM app_entries")
    total = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM app_categories")
    cat_count = cursor.fetchone()[0]
    print(f"\nTotal: {total} apps in {cat_count} categories")

    conn.close()


if __name__ == '__main__':
    seed()
