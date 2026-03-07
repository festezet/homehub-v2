"""
Formation Service - Plan d'action DeepSignal V1
Tracks actions and sub-actions for the Micro-SaaS Studio 05 formation
"""

import sqlite3
import os
import json
from datetime import datetime

DB_PATH = '/data/projects/homehub-v2/data/formation.db'


class FormationService:
    def __init__(self, db_path=DB_PATH):
        self.db_path = os.path.abspath(db_path)
        self._init_db()

    def _get_connection(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

    def _init_db(self):
        conn = self._get_connection()
        cursor = conn.cursor()

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS formation_actions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                parent_id INTEGER,
                title TEXT NOT NULL,
                description TEXT,
                who TEXT DEFAULT 'Claude',
                status TEXT DEFAULT 'pending',
                priority INTEGER DEFAULT 0,
                prerequisite_ids TEXT DEFAULT '[]',
                position INTEGER DEFAULT 0,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (parent_id) REFERENCES formation_actions(id)
            )
        """)

        # Seed data if table is empty
        cursor.execute("SELECT COUNT(*) FROM formation_actions")
        if cursor.fetchone()[0] == 0:
            self._seed_data(cursor)

        conn.commit()
        conn.close()

    def _seed_data(self, cursor):
        """Seed the 7 actions from PLAN_ACTION_DEEPSIGNAL_V1.md"""
        actions = [
            # Action 1: Recuperer livrables S1-S2
            {
                "title": "Recuperer les livrables S1-S2",
                "description": "Fabrice partage ses livrables, Claude sauvegarde localement",
                "who": "Fabrice + Claude",
                "priority": 1,
                "position": 1,
                "children": [
                    {"title": "Canvas Micro-SaaS (12 sections)", "description": "Template Notion avec les 12 sections remplies pour DeepSignal", "who": "Fabrice", "priority": 1},
                    {"title": "Resultats 5 GPTs S1", "description": "Gold Digger, Solution Architect, Ikigai, Score Canvas, Stack Technique", "who": "Fabrice", "priority": 2},
                    {"title": "Workflow Whimsical (S1-V7)", "description": "Workflow DeepSignal etape par etape", "who": "Fabrice", "priority": 1},
                    {"title": "Tunnel de vente Whimsical (S1-V9)", "description": "Trafic -> Conversion prospect -> Achat -> Onboarding", "who": "Fabrice", "priority": 3},
                    {"title": "Prototype Gemini (S2-V4)", "description": "Maquette visuelle de reference creee avec Google AI Studio", "who": "Fabrice", "priority": 2},
                    {"title": "Resultats 2 GPTs S2", "description": "Vibe code ta maquette + Kodefast Assistant", "who": "Fabrice", "priority": 3},
                ]
            },
            # Action 2: Definir features V1
            {
                "title": "Definir les features V1 avec types",
                "description": "A partir du Canvas et du workflow, definir chaque feature avec son type Kodefast (Sync/Queue/Webhook/Scheduled)",
                "who": "Claude + Fabrice",
                "priority": 2,
                "position": 2,
                "prerequisite_ids": [1],
                "children": [
                    {"title": "Lister les features depuis Canvas + workflow", "description": "Extraire les fonctionnalites necessaires", "who": "Claude"},
                    {"title": "Typer chaque feature (Sync/Queue/Webhook/Scheduled)", "description": "Attribuer le bon type Kodefast a chaque feature", "who": "Claude"},
                    {"title": "Validation par Fabrice", "description": "Fabrice valide la liste avant implementation", "who": "Fabrice"},
                ]
            },
            # Action 3: Configurer Edge Functions
            {
                "title": "Configurer les Edge Functions",
                "description": "Configurer les fonctions existantes puis ajouter les features DeepSignal",
                "who": "Claude",
                "priority": 3,
                "position": 3,
                "prerequisite_ids": [2],
                "children": [
                    {"title": "Configurer fonctions existantes (S3-V10)", "description": "Mega-prompt: analyser Edge Functions existantes, croiser avec workflow/DB/auth", "who": "Claude"},
                    {"title": "Ajouter features DeepSignal (S3-V11)", "description": "Creer les Edge Functions pour chaque feature definie", "who": "Claude"},
                    {"title": "Tester en mode demo (sans JWT)", "description": "Verifier que tout fonctionne en local avec npm run dev", "who": "Claude"},
                ]
            },
            # Action 4: Checklists pre-deploiement
            {
                "title": "Checklists pre-deploiement",
                "description": "Executer les 3 mega-prompts d'audit (Supabase, Securite, UX)",
                "who": "Claude",
                "priority": 4,
                "position": 4,
                "prerequisite_ids": [3],
                "children": [
                    {"title": "Audit Supabase (14 points)", "description": "demo mode, RLS, auth, CORS, SERVICE_ROLE_KEY", "who": "Claude"},
                    {"title": "Audit Securite (8 points)", "description": ".env.local, secrets, NEXT_PUBLIC_, validation, console.log", "who": "Claude"},
                    {"title": "Audit UX & Responsive (14 points)", "description": "landing, pricing, legales, 404, responsive, meta, favicon", "who": "Claude"},
                    {"title": "Corriger les points identifies", "description": "Appliquer les corrections pour chaque audit", "who": "Claude"},
                ]
            },
            # Action 5: Deployer
            {
                "title": "Deployer",
                "description": "Deployer sur Vercel avec les env vars Supabase",
                "who": "Claude + Fabrice",
                "priority": 5,
                "position": 5,
                "prerequisite_ids": [4],
                "children": [
                    {"title": "Configurer Vercel", "description": "Creer compte, connecter GitHub, configurer env vars", "who": "Fabrice + Claude"},
                    {"title": "Deployer sur .vercel.app", "description": "3 env vars: SUPABASE_URL, SUPABASE_ANON_KEY, SITE_URL", "who": "Claude"},
                    {"title": "Tester le deploiement", "description": "Verifier que tout fonctionne en production", "who": "Fabrice"},
                ]
            },
            # Action 6: Soumettre Portail Kreator
            {
                "title": "Soumettre au Portail Kreator",
                "description": "Preparer et soumettre le contenu sur le formulaire Portail Kreator",
                "who": "Fabrice",
                "priority": 6,
                "position": 6,
                "prerequisite_ids": [5],
                "children": [
                    {"title": "Claude prepare le contenu", "description": "Generer texte a copier-coller pour chaque section du formulaire", "who": "Claude"},
                    {"title": "Soumettre sur le portail", "description": "https://form.nokode-academy.com/portail-kreator", "who": "Fabrice"},
                ]
            },
            # Action 7: Interface HomeHub (this one!)
            {
                "title": "Interface HomeHub Formation",
                "description": "Onglet Formation dans HomeHub-v2 avec plan d'action et statut",
                "who": "Claude",
                "priority": 1,
                "position": 7,
                "status": "in_progress",
                "children": [
                    {"title": "Backend (service + routes)", "description": "SQLite DB + API REST", "who": "Claude", "status": "in_progress"},
                    {"title": "Frontend (template + JS)", "description": "Interface visuelle avec checkboxes et progression", "who": "Claude"},
                    {"title": "Integration dans HomeHub", "description": "Sidebar, app.js, base.html", "who": "Claude"},
                ]
            },
        ]

        for action in actions:
            children = action.pop("children", [])
            prereqs = action.pop("prerequisite_ids", [])
            action["prerequisite_ids"] = json.dumps(prereqs)
            status = action.get("status", "pending")

            cursor.execute("""
                INSERT INTO formation_actions (parent_id, title, description, who, status, priority, prerequisite_ids, position)
                VALUES (NULL, ?, ?, ?, ?, ?, ?, ?)
            """, (action["title"], action["description"], action["who"], status, action["priority"], action["prerequisite_ids"], action["position"]))

            parent_id = cursor.lastrowid

            for i, child in enumerate(children):
                child_status = child.get("status", "pending")
                child_priority = child.get("priority", 0)
                cursor.execute("""
                    INSERT INTO formation_actions (parent_id, title, description, who, status, priority, prerequisite_ids, position)
                    VALUES (?, ?, ?, ?, ?, ?, '[]', ?)
                """, (parent_id, child["title"], child["description"], child["who"], child_status, child_priority, i + 1))

    def get_all(self):
        """Get all actions organized hierarchically"""
        conn = self._get_connection()
        cursor = conn.cursor()

        # Get parent actions (no parent_id)
        cursor.execute("""
            SELECT * FROM formation_actions
            WHERE parent_id IS NULL
            ORDER BY position
        """)
        parents = [dict(row) for row in cursor.fetchall()]

        # Get children for each parent
        for parent in parents:
            cursor.execute("""
                SELECT * FROM formation_actions
                WHERE parent_id = ?
                ORDER BY position
            """, (parent["id"],))
            parent["children"] = [dict(row) for row in cursor.fetchall()]

        conn.close()
        return parents

    def get_stats(self):
        """Get completion statistics"""
        conn = self._get_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT COUNT(*) FROM formation_actions WHERE parent_id IS NULL")
        total_actions = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM formation_actions WHERE parent_id IS NULL AND status = 'done'")
        done_actions = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM formation_actions WHERE parent_id IS NOT NULL")
        total_sub = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM formation_actions WHERE parent_id IS NOT NULL AND status = 'done'")
        done_sub = cursor.fetchone()[0]

        conn.close()
        return {
            "total_actions": total_actions,
            "done_actions": done_actions,
            "total_sub_actions": total_sub,
            "done_sub_actions": done_sub,
            "progress_percent": round((done_actions / total_actions * 100) if total_actions > 0 else 0)
        }

    def toggle_status(self, action_id):
        """Toggle action between pending/in_progress/done"""
        conn = self._get_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT status, parent_id FROM formation_actions WHERE id = ?", (action_id,))
        row = cursor.fetchone()
        if not row:
            conn.close()
            return None

        current = row["status"]
        # Cycle: pending -> in_progress -> done -> pending
        new_status = {"pending": "in_progress", "in_progress": "done", "done": "pending"}.get(current, "pending")

        cursor.execute("""
            UPDATE formation_actions
            SET status = ?, updated_at = datetime('now')
            WHERE id = ?
        """, (new_status, action_id))

        # If toggling a sub-action to done, check if all siblings are done -> mark parent done
        if new_status == "done" and row["parent_id"]:
            cursor.execute("""
                SELECT COUNT(*) FROM formation_actions
                WHERE parent_id = ? AND status != 'done'
            """, (row["parent_id"],))
            remaining = cursor.fetchone()[0]
            if remaining == 0:
                cursor.execute("""
                    UPDATE formation_actions
                    SET status = 'done', updated_at = datetime('now')
                    WHERE id = ?
                """, (row["parent_id"],))

        conn.commit()
        conn.close()
        return new_status

    def update_status(self, action_id, status):
        """Set specific status for an action"""
        if status not in ("pending", "in_progress", "done"):
            return None

        conn = self._get_connection()
        cursor = conn.cursor()

        cursor.execute("""
            UPDATE formation_actions
            SET status = ?, updated_at = datetime('now')
            WHERE id = ?
        """, (status, action_id))

        affected = cursor.rowcount
        conn.commit()
        conn.close()
        return status if affected > 0 else None


formation_service = FormationService()
