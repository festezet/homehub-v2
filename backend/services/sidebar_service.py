"""
Sidebar Service - Manage sidebar layout (sections + tabs) from DB
"""

import sqlite3
import logging
import os

logger = logging.getLogger(__name__)

DB_PATH = '/data/projects/homehub-v2/data/sidebar.db'

DEFAULT_SECTIONS = [
    (1, 'Principal', 0),
    (2, 'Outils', 1),
    (3, 'Media', 2),
    (4, 'Apps', 3),
    (5, 'Perso', 4),
    (6, 'Systeme', 5),
    (7, 'Outils Prod', 6),
]

DEFAULT_TABS = [
    # section_id, page_key, label, icon, title, subtitle, position
    # -- Principal --
    (1, 'internet', 'Internet', '\U0001f310', 'Internet', 'Acces rapide a vos sites favoris', 0),
    # -- Outils --
    (2, 'formation', 'Formation', '\U0001f393', 'Formation', "Plan d'action DeepSignal V1", 0),
    (2, 'dashboard', 'TODOs', '\u2705', 'TODOs', 'Gestion des taches', 1),
    (2, 'thread-digest', 'Thread Digest', '\U0001f4ac', 'Thread Digest', 'Digests WhatsApp par Claude', 2),
    (2, 'calendar', 'Agenda', '\U0001f4c5', 'Agenda', 'Planning hebdomadaire et Google Calendar', 3),
    (2, 'markets', 'Marches', '\U0001f4c8', 'Marches', 'Suivi des marches financiers', 4),
    # -- Media --
    (3, 'mediastack', 'Media Stack', '\U0001f3ac', 'Media Stack', 'Streaming & Telechargement', 0),
    (3, 'media-reco', 'Recommandations', '\U0001f3af', 'Recommandations', 'Films & Series recommandes par IA', 1),
    # -- Apps --
    (4, 'local-apps', 'Applications Locales', '\U0001f4f1', 'Applications Locales', 'Projets developpes localement', 0),
    (4, 'ai-profile', 'AI Profile', '\U0001f916', 'AI Profile', 'Draft emails & notifications', 1),
    (4, 'linkedin-posts', 'LinkedIn Posts', '\U0001f4dd', 'LinkedIn Posts', 'Relecture et validation des posts', 2),
    (4, 'life-tasks', 'Life Tasks', '\U0001f4cc', 'Life Tasks', 'Projets de vie ephemeres', 3),
    (4, 'veille-ia', 'Veille IA', '\U0001f4e1', 'Veille IA', 'Curation et scoring de news IA', 4),
    (4, 'gmail-knowledge', 'Gmail Knowledge', '\U0001f4e7', 'Gmail Knowledge', 'Base de connaissances extraite des emails', 5),
    (4, 'invites', 'Invitations', '\U0001f4e8', 'Invitations', 'Envoyer des invitations calendrier', 6),
    (4, 'autism', 'Autism Companion', '\U0001f9e9', 'Autism Companion', 'Ressources, livres et outils', 7),
    # -- Perso --
    (5, 'patrimoine', 'Patrimoine', '\U0001f4b0', 'Patrimoine', 'Suivi epargne et placements', 0),
    (5, 'patrimoine-analyse', 'Analyse Patrimoine', '\U0001f4ca', 'Analyse Patrimoine', 'Comparatifs et recommandations', 1),
    # -- Systeme --
    (6, 'system-monitor', 'System Overview', '\U0001f4ca', 'System Overview', 'Hardware, stockage, backups, monitoring', 0),
    (6, 'project-status', 'Project Status', '\U0001f4cb', 'Project Status', 'Vue unifiee des projets et activites', 1),
    (6, 'services-ports', 'Services & Ports', '\U0001f50c', 'Services & Ports', 'Registre central des ports reseau', 3),
    (6, 'prompting-disciplines', 'Prompting Disciplines', '\U0001f9e0', 'Prompting Disciplines', "Framework d'optimisation Claude Code", 4),
    (6, 'claude-skills', 'Claude Skills', '\u26a1', 'Claude Skills', 'Skills, commands et extensions Claude Code', 5),
    (6, 'claude-instructions', 'Claude Instructions', '\U0001f4dc', 'Claude Instructions', 'CLAUDE.md, rules, skills et cross-references', 6),
    (6, 'hh-design', 'HH Design', '\U0001f3d7', 'HH Design', 'Architecture HomeHub et feature wishlist', 7),
    (6, 'session-bookmarks', 'Session Bookmarks', '\U0001f516', 'Session Bookmarks', 'Sauvegarder et reprendre le contexte de sessions Claude', 8),
    (6, 'claude-analytics', 'Claude Analytics', '\U0001f50d', 'Claude Analytics', 'Analyse des interactions Claude Code et patterns', 9),
    # -- Outils Prod --
    (7, 'email-draft', 'Email Draft', '\u2709\ufe0f', 'Email Draft', 'Generation de brouillons email', 0),
]


class SidebarService:
    """Service to manage sidebar layout from SQLite"""

    def __init__(self, db_path=DB_PATH):
        self.db_path = db_path
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        self._init_db()
        logger.info(f"SidebarService initialized with database: {db_path}")

    def _get_connection(self):
        conn = sqlite3.connect(self.db_path)
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

    def _init_db(self):
        """Create tables and seed defaults if empty"""
        conn = self._get_connection()
        cursor = conn.cursor()

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS sidebar_sections (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                position INTEGER NOT NULL DEFAULT 0
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS sidebar_tabs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                section_id INTEGER NOT NULL REFERENCES sidebar_sections(id),
                page_key TEXT NOT NULL,
                label TEXT NOT NULL,
                icon TEXT NOT NULL,
                title TEXT,
                subtitle TEXT,
                position INTEGER NOT NULL DEFAULT 0
            )
        """)

        # Migrate: remove UNIQUE constraint on page_key if present
        self._migrate_remove_unique_page_key(cursor)

        # Seed if empty
        cursor.execute("SELECT COUNT(*) FROM sidebar_sections")
        if cursor.fetchone()[0] == 0:
            self._seed_defaults(cursor)

        conn.commit()
        conn.close()

    def _migrate_remove_unique_page_key(self, cursor):
        """Remove UNIQUE constraint on page_key to allow shortcuts/duplicates"""
        cursor.execute("PRAGMA index_list(sidebar_tabs)")
        indexes = cursor.fetchall()
        has_unique_page_key = False
        for idx in indexes:
            idx_name = idx[1]
            is_unique = idx[2]
            if is_unique:
                cursor.execute(f"PRAGMA index_info({idx_name})")
                cols = [row[2] for row in cursor.fetchall()]
                if 'page_key' in cols:
                    has_unique_page_key = True
                    break

        if not has_unique_page_key:
            return

        logger.info("Migrating sidebar_tabs: removing UNIQUE on page_key")
        cursor.execute("""
            CREATE TABLE sidebar_tabs_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                section_id INTEGER NOT NULL REFERENCES sidebar_sections(id),
                page_key TEXT NOT NULL,
                label TEXT NOT NULL,
                icon TEXT NOT NULL,
                title TEXT,
                subtitle TEXT,
                position INTEGER NOT NULL DEFAULT 0
            )
        """)
        cursor.execute("INSERT INTO sidebar_tabs_new SELECT * FROM sidebar_tabs")
        cursor.execute("DROP TABLE sidebar_tabs")
        cursor.execute("ALTER TABLE sidebar_tabs_new RENAME TO sidebar_tabs")
        logger.info("Migration complete: page_key is no longer UNIQUE")

    def _seed_defaults(self, cursor):
        """Insert default sections and tabs"""
        for sid, name, pos in DEFAULT_SECTIONS:
            cursor.execute(
                "INSERT INTO sidebar_sections (id, name, position) VALUES (?, ?, ?)",
                (sid, name, pos)
            )
        for section_id, page_key, label, icon, title, subtitle, pos in DEFAULT_TABS:
            cursor.execute(
                "INSERT INTO sidebar_tabs (section_id, page_key, label, icon, title, subtitle, position) "
                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                (section_id, page_key, label, icon, title, subtitle, pos)
            )
        logger.info("Sidebar seeded with default layout")

    # ---- Read ----

    def get_layout(self):
        """Get full sidebar layout: sections with nested tabs, ordered by position"""
        conn = self._get_connection()
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        cursor.execute("SELECT * FROM sidebar_sections ORDER BY position, id")
        sections = []
        for sec_row in cursor.fetchall():
            section = dict(sec_row)
            cursor.execute(
                "SELECT * FROM sidebar_tabs WHERE section_id = ? ORDER BY position, id",
                (section['id'],)
            )
            section['tabs'] = [dict(row) for row in cursor.fetchall()]
            sections.append(section)

        conn.close()
        return sections

    # ---- Update ----

    def update_section(self, section_id, **kwargs):
        """Update a section's name or position"""
        valid_fields = {'name', 'position'}
        updates = {k: v for k, v in kwargs.items() if k in valid_fields}
        if not updates:
            raise ValueError(f"No valid fields. Valid: {valid_fields}")

        conn = self._get_connection()
        cursor = conn.cursor()
        set_clause = ", ".join(f"{k} = ?" for k in updates)
        values = list(updates.values()) + [section_id]
        cursor.execute(f"UPDATE sidebar_sections SET {set_clause} WHERE id = ?", values)
        if cursor.rowcount == 0:
            conn.close()
            raise ValueError(f"Section {section_id} not found")
        conn.commit()
        conn.close()

    def update_tab(self, tab_id, **kwargs):
        """Update a tab's fields"""
        valid_fields = {'section_id', 'label', 'icon', 'title', 'subtitle', 'position'}
        updates = {k: v for k, v in kwargs.items() if k in valid_fields}
        if not updates:
            raise ValueError(f"No valid fields. Valid: {valid_fields}")

        conn = self._get_connection()
        cursor = conn.cursor()
        set_clause = ", ".join(f"{k} = ?" for k in updates)
        values = list(updates.values()) + [tab_id]
        cursor.execute(f"UPDATE sidebar_tabs SET {set_clause} WHERE id = ?", values)
        if cursor.rowcount == 0:
            conn.close()
            raise ValueError(f"Tab {tab_id} not found")
        conn.commit()
        conn.close()

    # ---- Move ----

    def move_section(self, section_id, direction):
        """Move a section up or down"""
        conn = self._get_connection()
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        cursor.execute("SELECT * FROM sidebar_sections ORDER BY position, id")
        sections = [dict(row) for row in cursor.fetchall()]

        idx = next((i for i, s in enumerate(sections) if s['id'] == section_id), None)
        if idx is None:
            conn.close()
            raise ValueError(f"Section {section_id} not found")

        swap_idx = idx - 1 if direction == 'up' else idx + 1
        if swap_idx < 0 or swap_idx >= len(sections):
            conn.close()
            return  # already at boundary

        # Swap positions
        pos_a, pos_b = sections[idx]['position'], sections[swap_idx]['position']
        cursor.execute("UPDATE sidebar_sections SET position = ? WHERE id = ?",
                        (pos_b, sections[idx]['id']))
        cursor.execute("UPDATE sidebar_sections SET position = ? WHERE id = ?",
                        (pos_a, sections[swap_idx]['id']))
        conn.commit()
        conn.close()

    def move_tab(self, tab_id, direction):
        """Move a tab up or down within its section"""
        conn = self._get_connection()
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        cursor.execute("SELECT * FROM sidebar_tabs WHERE id = ?", (tab_id,))
        tab = cursor.fetchone()
        if not tab:
            conn.close()
            raise ValueError(f"Tab {tab_id} not found")

        section_id = tab['section_id']
        cursor.execute(
            "SELECT * FROM sidebar_tabs WHERE section_id = ? ORDER BY position, id",
            (section_id,)
        )
        tabs = [dict(row) for row in cursor.fetchall()]

        idx = next((i for i, t in enumerate(tabs) if t['id'] == tab_id), None)
        swap_idx = idx - 1 if direction == 'up' else idx + 1
        if swap_idx < 0 or swap_idx >= len(tabs):
            conn.close()
            return  # already at boundary

        pos_a, pos_b = tabs[idx]['position'], tabs[swap_idx]['position']
        cursor.execute("UPDATE sidebar_tabs SET position = ? WHERE id = ?",
                        (pos_b, tabs[idx]['id']))
        cursor.execute("UPDATE sidebar_tabs SET position = ? WHERE id = ?",
                        (pos_a, tabs[swap_idx]['id']))
        conn.commit()
        conn.close()

    # ---- Reassign tab to another section ----

    def reassign_tab(self, tab_id, target_section_id, position=None):
        """Move a tab to a different section, optionally at a given position"""
        conn = self._get_connection()
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        cursor.execute("SELECT * FROM sidebar_tabs WHERE id = ?", (tab_id,))
        tab = cursor.fetchone()
        if not tab:
            conn.close()
            raise ValueError(f"Tab {tab_id} not found")

        cursor.execute("SELECT id FROM sidebar_sections WHERE id = ?", (target_section_id,))
        if not cursor.fetchone():
            conn.close()
            raise ValueError(f"Section {target_section_id} not found")

        # Default position: end of target section
        if position is None:
            cursor.execute(
                "SELECT COALESCE(MAX(position), -1) + 1 FROM sidebar_tabs WHERE section_id = ?",
                (target_section_id,)
            )
            position = cursor.fetchone()[0]

        # Shift existing tabs in target section to make room
        cursor.execute(
            "UPDATE sidebar_tabs SET position = position + 1 "
            "WHERE section_id = ? AND position >= ?",
            (target_section_id, position)
        )

        # Move the tab
        cursor.execute(
            "UPDATE sidebar_tabs SET section_id = ?, position = ? WHERE id = ?",
            (target_section_id, position, tab_id)
        )

        # Compact positions in source section (close the gap)
        old_section_id = tab['section_id']
        cursor.execute(
            "SELECT id FROM sidebar_tabs WHERE section_id = ? ORDER BY position",
            (old_section_id,)
        )
        for i, row in enumerate(cursor.fetchall()):
            cursor.execute("UPDATE sidebar_tabs SET position = ? WHERE id = ?", (i, row['id']))

        conn.commit()
        conn.close()
        logger.info(f"Tab {tab_id} reassigned to section {target_section_id} at position {position}")

    # ---- Create / Delete ----

    def create_section(self, name):
        """Create a new section at the end"""
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT COALESCE(MAX(position), -1) + 1 FROM sidebar_sections")
        next_pos = cursor.fetchone()[0]
        cursor.execute(
            "INSERT INTO sidebar_sections (name, position) VALUES (?, ?)",
            (name, next_pos)
        )
        section_id = cursor.lastrowid
        conn.commit()
        conn.close()
        logger.info(f"Created section '{name}' (id={section_id}, position={next_pos})")
        return section_id

    def delete_section(self, section_id):
        """Delete a section and all its tabs"""
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM sidebar_sections WHERE id = ?", (section_id,))
        if not cursor.fetchone():
            conn.close()
            raise ValueError(f"Section {section_id} not found")
        cursor.execute("DELETE FROM sidebar_tabs WHERE section_id = ?", (section_id,))
        cursor.execute("DELETE FROM sidebar_sections WHERE id = ?", (section_id,))
        conn.commit()
        conn.close()
        logger.info(f"Deleted section {section_id} and its tabs")

    # ---- Add tab shortcut ----

    def get_all_tabs(self):
        """Get all unique tabs (deduplicated by page_key, first occurrence wins)"""
        conn = self._get_connection()
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM sidebar_tabs ORDER BY id"
        )
        seen = set()
        tabs = []
        for row in cursor.fetchall():
            tab = dict(row)
            if tab['page_key'] not in seen:
                seen.add(tab['page_key'])
                tabs.append(tab)
        conn.close()
        return tabs

    def add_tab_to_section(self, section_id, page_key):
        """Add a shortcut of an existing tab to a section"""
        conn = self._get_connection()
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # Verify section exists
        cursor.execute("SELECT id FROM sidebar_sections WHERE id = ?", (section_id,))
        if not cursor.fetchone():
            conn.close()
            raise ValueError(f"Section {section_id} not found")

        # Find source tab (first occurrence of this page_key)
        cursor.execute(
            "SELECT * FROM sidebar_tabs WHERE page_key = ? ORDER BY id LIMIT 1",
            (page_key,)
        )
        source = cursor.fetchone()
        if not source:
            conn.close()
            raise ValueError(f"Tab with page_key '{page_key}' not found")

        # Check not already in this section
        cursor.execute(
            "SELECT id FROM sidebar_tabs WHERE section_id = ? AND page_key = ?",
            (section_id, page_key)
        )
        if cursor.fetchone():
            conn.close()
            raise ValueError(f"Tab '{page_key}' already exists in this section")

        # Next position in target section
        cursor.execute(
            "SELECT COALESCE(MAX(position), -1) + 1 FROM sidebar_tabs WHERE section_id = ?",
            (section_id,)
        )
        next_pos = cursor.fetchone()[0]

        cursor.execute(
            "INSERT INTO sidebar_tabs (section_id, page_key, label, icon, title, subtitle, position) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (section_id, page_key, source['label'], source['icon'],
             source['title'], source['subtitle'], next_pos)
        )
        tab_id = cursor.lastrowid
        conn.commit()
        conn.close()
        logger.info(f"Added tab shortcut '{page_key}' to section {section_id} (id={tab_id})")
        return tab_id

    def delete_tab(self, tab_id):
        """Delete a single tab by id"""
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id, page_key FROM sidebar_tabs WHERE id = ?", (tab_id,))
        tab = cursor.fetchone()
        if not tab:
            conn.close()
            raise ValueError(f"Tab {tab_id} not found")
        cursor.execute("DELETE FROM sidebar_tabs WHERE id = ?", (tab_id,))
        conn.commit()
        conn.close()
        logger.info(f"Deleted tab {tab_id} (page_key={tab[1]})")

    # ---- Reset ----

    def reset_to_defaults(self):
        """Reset sidebar to default layout"""
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM sidebar_tabs")
        cursor.execute("DELETE FROM sidebar_sections")
        self._seed_defaults(cursor)
        conn.commit()
        conn.close()
        logger.info("Sidebar reset to defaults")


# Singleton
sidebar_service = SidebarService()
