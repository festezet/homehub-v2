#!/usr/bin/env python3
"""
One-shot script to populate spec_status fields in projects.db
by scanning for SPEC.md files in each active project.
"""

import sqlite3
import os
from datetime import datetime

DB_PATH = '/data/projects/project-management/data/projects.db'


def main():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute("SELECT id, name, path FROM projects WHERE status = 'active'")
    rows = cursor.fetchall()

    found = 0
    missing = 0

    for row in rows:
        spec_path = os.path.join(row['path'], 'docs', 'spec', 'SPEC.md')

        if os.path.exists(spec_path):
            stat = os.stat(spec_path)
            mtime = datetime.fromtimestamp(stat.st_mtime).strftime('%Y-%m-%d')
            with open(spec_path, 'r', encoding='utf-8') as f:
                lines = len(f.readlines())

            cursor.execute("""
                UPDATE projects
                SET spec_status = 'complete', spec_date = ?, spec_lines = ?
                WHERE id = ?
            """, (mtime, lines, row['id']))
            found += 1
            print(f"  [FOUND] {row['name']}: {lines} lines, date {mtime}")
        else:
            missing += 1
            print(f"  [MISS]  {row['name']}: no SPEC.md")

    conn.commit()
    conn.close()

    print(f"\nDone: {found} specs found, {missing} missing (total: {len(rows)} active projects)")


if __name__ == '__main__':
    main()
