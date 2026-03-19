"""
Claude Skills Service - Scans filesystem for Claude Code skills and commands
"""

import os
import glob
import logging
import re

logger = logging.getLogger(__name__)

GLOBAL_SKILLS_DIR = os.path.expanduser('~/.claude/skills')
GLOBAL_COMMANDS_DIR = os.path.expanduser('~/.claude/commands')
PROJECTS_BASE = '/data/projects'


def _parse_frontmatter(content):
    """Extract YAML frontmatter from SKILL.md content"""
    if not content.startswith('---'):
        return {}
    end = content.find('---', 3)
    if end == -1:
        return {}
    fm_text = content[3:end].strip()
    result = {}
    for line in fm_text.split('\n'):
        if ':' in line:
            key, _, value = line.partition(':')
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and value:
                result[key] = value
    return result


def _extract_first_heading(content):
    """Extract first markdown heading as fallback description"""
    for line in content.split('\n'):
        line = line.strip()
        if line.startswith('# '):
            return line[2:].strip()
    return None


class ClaudeSkillsService:
    """Scans filesystem for Claude Code skills and commands"""

    def scan_all(self):
        """Scan all skill locations and return structured data"""
        global_skills = self._scan_global_skills()
        local_skills = self._scan_local_skills()
        commands = self._scan_global_commands()

        return {
            'global_skills': global_skills,
            'local_skills': local_skills,
            'commands': commands,
            'stats': {
                'global_skills': len(global_skills),
                'local_skills': sum(len(s['skills']) for s in local_skills),
                'commands': len(commands),
                'projects_with_skills': len(local_skills),
            }
        }

    def _scan_global_skills(self):
        """Scan ~/.claude/skills/*/SKILL.md"""
        skills = []
        if not os.path.isdir(GLOBAL_SKILLS_DIR):
            return skills

        for entry in sorted(os.listdir(GLOBAL_SKILLS_DIR)):
            skill_dir = os.path.join(GLOBAL_SKILLS_DIR, entry)
            skill_file = os.path.join(skill_dir, 'SKILL.md')
            if os.path.isdir(skill_dir) and os.path.isfile(skill_file):
                info = self._parse_skill_file(skill_file, entry)
                if info:
                    skills.append(info)
        return skills

    def _scan_local_skills(self):
        """Scan /data/projects/*/.claude/skills/ for local skills"""
        results = []
        pattern = os.path.join(PROJECTS_BASE, '*', '.claude', 'skills')
        for skills_dir in sorted(glob.glob(pattern)):
            project_path = os.path.dirname(os.path.dirname(skills_dir))
            project_name = os.path.basename(project_path)
            skills = []

            for entry in sorted(os.listdir(skills_dir)):
                full_path = os.path.join(skills_dir, entry)
                # Subdirectory with SKILL.md
                if os.path.isdir(full_path):
                    skill_file = os.path.join(full_path, 'SKILL.md')
                    if os.path.isfile(skill_file):
                        info = self._parse_skill_file(skill_file, entry)
                        if info:
                            skills.append(info)
                # Direct .md file (alternative format)
                elif entry.endswith('.md'):
                    name = entry[:-3]
                    info = self._parse_skill_file(full_path, name)
                    if info:
                        skills.append(info)

            if skills:
                results.append({
                    'project': project_name,
                    'project_path': project_path,
                    'skills': skills,
                })
        return results

    def _scan_global_commands(self):
        """Scan ~/.claude/commands/*.md"""
        commands = []
        if not os.path.isdir(GLOBAL_COMMANDS_DIR):
            return commands

        for entry in sorted(os.listdir(GLOBAL_COMMANDS_DIR)):
            if not entry.endswith('.md'):
                continue
            name = entry[:-3]
            filepath = os.path.join(GLOBAL_COMMANDS_DIR, entry)
            info = self._parse_skill_file(filepath, name)
            if info:
                commands.append(info)
        return commands

    def _parse_skill_file(self, filepath, fallback_name):
        """Parse a skill/command .md file and extract metadata"""
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
        except Exception as e:
            logger.warning(f"Could not read {filepath}: {e}")
            return None

        fm = _parse_frontmatter(content)
        heading = _extract_first_heading(content)

        name = fm.get('name', fallback_name)
        description = fm.get('description', heading or fallback_name)
        # Truncate long descriptions
        if len(description) > 200:
            description = description[:197] + '...'

        return {
            'name': name,
            'description': description,
            'argument_hint': fm.get('argument-hint', ''),
            'allowed_tools': fm.get('allowed-tools', ''),
            'user_invocable': fm.get('user-invocable', 'true') != 'false',
            'file': filepath,
        }
