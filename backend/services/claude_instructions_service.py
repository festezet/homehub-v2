"""
Claude Instructions Service - Scans .claude/ directories for instructions, rules, skills
Provides tree browsing, file reading, and cross-reference graph
"""

import os
import re
import glob
import logging

logger = logging.getLogger(__name__)

PROJECTS_BASE = '/data/projects'
INFRA_CLAUDE = os.path.join(PROJECTS_BASE, 'infrastructure', '.claude')

# Allowed extensions for file reading
ALLOWED_EXTENSIONS = {'.md'}
# Files must be under .claude/ directories within /data/projects/
ALLOWED_BASE = PROJECTS_BASE


class ClaudeInstructionsService:

    def get_tree(self):
        """Scan all .claude/ directories and return structured tree."""
        master = self._scan_master()
        rules = self._scan_dir(os.path.join(INFRA_CLAUDE, 'rules'), 'rule')
        skills = self._scan_skills_dir(os.path.join(INFRA_CLAUDE, 'skills'))
        state_files = self._scan_state_files()
        projects = self._scan_project_claudes()

        stats = {
            'rules': len(rules),
            'skills': len(skills),
            'state_files': len(state_files),
            'projects_with_claude': len(projects),
        }

        return {
            'master': master,
            'rules': rules,
            'skills': skills,
            'state_files': state_files,
            'projects': projects,
            'stats': stats,
        }

    def get_file(self, path):
        """Read a file securely — must be under /data/projects/, contain /.claude/, and be .md."""
        if not path:
            return None, 'path is required'

        real = os.path.realpath(path)

        # Security checks
        if not real.startswith(ALLOWED_BASE):
            return None, 'Path must be under /data/projects/'
        if '/.claude/' not in real and not real.endswith('/.claude'):
            return None, 'Path must be within a .claude/ directory'
        _, ext = os.path.splitext(real)
        if ext.lower() not in ALLOWED_EXTENSIONS:
            return None, 'Only .md files are allowed'
        if not os.path.isfile(real):
            return None, 'File not found'

        try:
            with open(real, 'r', encoding='utf-8') as f:
                content = f.read()
            return {
                'path': real,
                'name': os.path.basename(real),
                'content': content,
                'size': len(content),
                'lines': content.count('\n') + 1,
            }, None
        except Exception as e:
            logger.error(f"Error reading {real}: {e}")
            return None, str(e)

    def get_graph(self):
        """Build cross-reference graph from .claude/ files."""
        nodes = []
        edges = []
        node_ids = set()

        # Scan master
        master_path = os.path.join(INFRA_CLAUDE, 'CLAUDE.md')
        if os.path.isfile(master_path):
            nodes.append({'id': 'master', 'label': 'CLAUDE.md', 'type': 'master', 'path': master_path})
            node_ids.add('master')

        # Scan rules
        rules_dir = os.path.join(INFRA_CLAUDE, 'rules')
        if os.path.isdir(rules_dir):
            for f in sorted(os.listdir(rules_dir)):
                if f.endswith('.md'):
                    nid = f'rule:{f}'
                    nodes.append({'id': nid, 'label': f, 'type': 'rule',
                                  'path': os.path.join(rules_dir, f)})
                    node_ids.add(nid)

        # Scan skills
        skills_dir = os.path.join(INFRA_CLAUDE, 'skills')
        if os.path.isdir(skills_dir):
            for entry in sorted(os.listdir(skills_dir)):
                skill_path = os.path.join(skills_dir, entry)
                if os.path.isdir(skill_path):
                    skill_file = os.path.join(skill_path, 'SKILL.md')
                    if os.path.isfile(skill_file):
                        nid = f'skill:{entry}'
                        nodes.append({'id': nid, 'label': entry, 'type': 'skill',
                                      'path': skill_file})
                        node_ids.add(nid)

        # Scan state files
        for name in ('SYSTEM_STATE_CORE.md', 'SYSTEM_STATE.md', 'PROJECT_STATUS.md',
                      'USER_PREFERENCES.md', 'LESSONS_LEARNED.md'):
            fpath = os.path.join(INFRA_CLAUDE, name)
            if os.path.isfile(fpath):
                nid = f'state:{name}'
                nodes.append({'id': nid, 'label': name, 'type': 'state', 'path': fpath})
                node_ids.add(nid)

        # Build edges by scanning content for cross-references
        ref_patterns = [
            (r'rules/(\S+\.md)', 'rule'),
            (r'skills/(\S+)', 'skill'),
            (r'(SYSTEM_STATE_CORE\.md|SYSTEM_STATE\.md|PROJECT_STATUS\.md|USER_PREFERENCES\.md|LESSONS_LEARNED\.md)', 'state'),
        ]

        for node in nodes:
            if not os.path.isfile(node.get('path', '')):
                continue
            try:
                with open(node['path'], 'r', encoding='utf-8') as f:
                    content = f.read()
            except Exception:
                continue

            for pattern, ref_type in ref_patterns:
                for match in re.finditer(pattern, content):
                    ref_name = match.group(1)
                    # Clean up skill references (may have trailing chars)
                    if ref_type == 'skill':
                        ref_name = ref_name.rstrip('`,.) \n\r')
                        if '/' in ref_name:
                            ref_name = ref_name.split('/')[0]
                    target_id = f'{ref_type}:{ref_name}'
                    if target_id in node_ids and target_id != node['id']:
                        edges.append({'source': node['id'], 'target': target_id})

        # Deduplicate edges
        seen = set()
        unique_edges = []
        for e in edges:
            key = (e['source'], e['target'])
            if key not in seen:
                seen.add(key)
                unique_edges.append(e)

        return {'nodes': nodes, 'edges': unique_edges}

    def _scan_master(self):
        """Get master CLAUDE.md info."""
        path = os.path.join(INFRA_CLAUDE, 'CLAUDE.md')
        if not os.path.isfile(path):
            return None
        try:
            size = os.path.getsize(path)
            with open(path, 'r', encoding='utf-8') as f:
                lines = f.read().count('\n') + 1
            return {'path': path, 'name': 'CLAUDE.md', 'size': size, 'lines': lines}
        except Exception:
            return None

    def _scan_dir(self, dirpath, file_type):
        """Scan a directory for .md files."""
        items = []
        if not os.path.isdir(dirpath):
            return items
        for f in sorted(os.listdir(dirpath)):
            if not f.endswith('.md'):
                continue
            fpath = os.path.join(dirpath, f)
            try:
                size = os.path.getsize(fpath)
                items.append({'name': f, 'path': fpath, 'type': file_type, 'size': size})
            except Exception:
                continue
        return items

    def _scan_skills_dir(self, dirpath):
        """Scan skills directory for SKILL.md files."""
        items = []
        if not os.path.isdir(dirpath):
            return items
        for entry in sorted(os.listdir(dirpath)):
            skill_dir = os.path.join(dirpath, entry)
            if not os.path.isdir(skill_dir):
                continue
            skill_file = os.path.join(skill_dir, 'SKILL.md')
            if os.path.isfile(skill_file):
                try:
                    size = os.path.getsize(skill_file)
                    items.append({'name': entry, 'path': skill_file, 'type': 'skill', 'size': size})
                except Exception:
                    continue
        return items

    def _scan_state_files(self):
        """Scan .claude/ for state/config files."""
        items = []
        state_names = ['SYSTEM_STATE_CORE.md', 'SYSTEM_STATE.md', 'PROJECT_STATUS.md',
                        'USER_PREFERENCES.md', 'LESSONS_LEARNED.md']
        for name in state_names:
            fpath = os.path.join(INFRA_CLAUDE, name)
            if os.path.isfile(fpath):
                try:
                    size = os.path.getsize(fpath)
                    items.append({'name': name, 'path': fpath, 'type': 'state', 'size': size})
                except Exception:
                    continue
        return items

    def _scan_project_claudes(self):
        """Scan all projects for .claude/ directories."""
        projects = []
        pattern = os.path.join(PROJECTS_BASE, '*', '.claude')
        for claude_dir in sorted(glob.glob(pattern)):
            project_path = os.path.dirname(claude_dir)
            project_name = os.path.basename(project_path)
            if project_name == 'infrastructure':
                continue  # Already covered by master/rules/skills

            files = []
            for f in sorted(os.listdir(claude_dir)):
                fpath = os.path.join(claude_dir, f)
                if os.path.isfile(fpath) and f.endswith('.md'):
                    files.append({'name': f, 'path': fpath, 'size': os.path.getsize(fpath)})

            # Also check rules/ and skills/ subdirs
            for subdir in ('rules', 'skills'):
                sub_path = os.path.join(claude_dir, subdir)
                if os.path.isdir(sub_path):
                    for entry in sorted(os.listdir(sub_path)):
                        entry_path = os.path.join(sub_path, entry)
                        if os.path.isfile(entry_path) and entry.endswith('.md'):
                            files.append({'name': f'{subdir}/{entry}', 'path': entry_path,
                                          'size': os.path.getsize(entry_path)})
                        elif os.path.isdir(entry_path):
                            skill_file = os.path.join(entry_path, 'SKILL.md')
                            if os.path.isfile(skill_file):
                                files.append({'name': f'{subdir}/{entry}/SKILL.md',
                                              'path': skill_file,
                                              'size': os.path.getsize(skill_file)})

            if files:
                projects.append({
                    'project': project_name,
                    'path': project_path,
                    'claude_dir': claude_dir,
                    'files': files,
                    'file_count': len(files),
                })
        return projects


claude_instructions_service = ClaudeInstructionsService()
