"""
Skill Analyzer - D1-D4 Framework Scoring
Analyzes Claude skills against the 4 Disciplines of Prompting framework
"""

import re
from typing import Dict, List, Tuple
import os


class SkillAnalyzer:
    """Analyzes skills using D1-D4 framework scoring"""

    # Stopwords for fluff detection
    FLUFF_WORDS = {
        'very', 'really', 'just', 'quite', 'rather', 'somewhat', 'pretty',
        'actually', 'basically', 'literally', 'seriously', 'honestly',
        'clearly', 'obviously', 'essentially', 'particularly', 'especially'
    }

    def __init__(self):
        pass

    def analyze_skill(self, skill_path: str) -> Dict:
        """
        Analyze a skill file and return D1-D4 scores with recommendations

        Args:
            skill_path: Path to SKILL.md file

        Returns:
            Dict with scores, recommendations, and metadata
        """
        try:
            with open(skill_path, 'r', encoding='utf-8') as f:
                content = f.read()
        except Exception as e:
            return {
                'error': f'Failed to read skill file: {str(e)}',
                'd1_score': 0, 'd2_score': 0, 'd3_score': 0, 'd4_score': 0,
                'overall_score': 0, 'recommendations': []
            }

        # Calculate individual discipline scores
        d1_result = self._score_d1_prompt_craft(content)
        d2_result = self._score_d2_context_engineering(content, skill_path)
        d3_result = self._score_d3_intent_engineering(content)
        d4_result = self._score_d4_specification_engineering(content)

        # Calculate overall score (average)
        overall_score = int((d1_result['score'] + d2_result['score'] +
                            d3_result['score'] + d4_result['score']) / 4)

        # Combine all recommendations
        recommendations = (d1_result['recommendations'] + d2_result['recommendations'] +
                          d3_result['recommendations'] + d4_result['recommendations'])

        return {
            'd1_score': d1_result['score'],
            'd2_score': d2_result['score'],
            'd3_score': d3_result['score'],
            'd4_score': d4_result['score'],
            'overall_score': overall_score,
            'recommendations': recommendations,
            'd1_details': d1_result.get('details', {}),
            'd2_details': d2_result.get('details', {}),
            'd3_details': d3_result.get('details', {}),
            'd4_details': d4_result.get('details', {})
        }

    def _score_d1_prompt_craft(self, content: str) -> Dict:
        """
        D1: Prompt Craft (0-100)
        - +30 points: Clear purpose statement
        - +20 points: Has examples
        - +20 points: Has constraints
        - +15 points: Has output format specification
        - +15 points: Appropriate length (100-1000 words ideal)
        """
        score = 0
        recommendations = []
        details = {}

        word_count = len(content.split())

        # Purpose statement (30 points)
        purpose_keywords = ['use this', 'goal:', 'purpose:', 'this skill', 'objective:']
        has_purpose = any(kw in content.lower() for kw in purpose_keywords)
        if has_purpose:
            score += 30
            details['purpose'] = 'Clear purpose statement found'
        else:
            recommendations.append('D1: Add clear purpose statement (use keywords: "goal:", "purpose:", "use this")')
            details['purpose'] = 'No purpose statement'

        # Examples (20 points)
        has_code_blocks = '```' in content
        has_example_keyword = 'example:' in content.lower() or 'examples:' in content.lower()
        bullet_lists = len(re.findall(r'^\s*[-*]\s+', content, re.MULTILINE))

        if has_code_blocks or has_example_keyword or bullet_lists >= 3:
            score += 20
            details['examples'] = f'Has examples (code blocks: {has_code_blocks}, example keyword: {has_example_keyword}, bullets: {bullet_lists})'
        else:
            recommendations.append('D1: Add examples (code blocks, bullet lists, or "example:" sections)')
            details['examples'] = 'No examples found'

        # Constraints (20 points)
        constraint_keywords = ['must', 'never', 'always', 'only', 'required', 'do not', "don't"]
        constraint_count = sum(1 for kw in constraint_keywords if kw in content.lower())

        if constraint_count >= 3:
            score += 20
            details['constraints'] = f'Has {constraint_count} constraint keywords'
        else:
            recommendations.append('D1: Add constraints (use keywords: "must", "never", "always", "only")')
            details['constraints'] = f'Only {constraint_count} constraint keywords'

        # Output format (15 points)
        format_keywords = ['format:', 'output:', 'return:', 'response format', 'structure:']
        has_format = any(kw in content.lower() for kw in format_keywords)

        if has_format:
            score += 15
            details['format'] = 'Output format specified'
        else:
            recommendations.append('D1: Specify output format (use keywords: "format:", "output:", "return:")')
            details['format'] = 'No output format'

        # Length (15 points) - ideal 100-1000 words
        if 100 <= word_count <= 1000:
            score += 15
            details['length'] = f'{word_count} words (ideal range)'
        elif word_count < 100:
            recommendations.append(f'D1: Skill too short ({word_count} words). Aim for 100-1000 words.')
            details['length'] = f'{word_count} words (too short)'
        else:
            recommendations.append(f'D1: Skill too long ({word_count} words). Consider splitting or reducing to under 1000 words.')
            details['length'] = f'{word_count} words (too long)'

        return {'score': score, 'recommendations': recommendations, 'details': details}

    def _score_d2_context_engineering(self, content: str, skill_path: str) -> Dict:
        """
        D2: Context Engineering (0-100)
        - +30 points: File size < 10KB (ideal), -10 per 5KB over
        - +20 points: Low fluff word ratio (< 15%)
        - +20 points: High information density (code/bullet ratio)
        - +15 points: No repetition (< 5% duplicate sentences)
        - +15 points: Uses reference files for large content
        """
        score = 0
        recommendations = []
        details = {}

        # File size (30 points)
        try:
            file_size_kb = os.path.getsize(skill_path) / 1024
            if file_size_kb < 10:
                score += 30
                details['file_size'] = f'{file_size_kb:.1f}KB (ideal)'
            else:
                penalty = min(30, int((file_size_kb - 10) / 5) * 10)
                score += max(0, 30 - penalty)
                recommendations.append(f'D2: File size {file_size_kb:.1f}KB exceeds 10KB. Consider moving large content to reference files.')
                details['file_size'] = f'{file_size_kb:.1f}KB (too large, -{penalty} points)'
        except:
            details['file_size'] = 'Unable to check'

        # Fluff word ratio (20 points)
        words = content.lower().split()
        fluff_count = sum(1 for word in words if word.strip('.,!?;:') in self.FLUFF_WORDS)
        fluff_ratio = fluff_count / len(words) if words else 0

        if fluff_ratio < 0.15:
            score += 20
            details['fluff_ratio'] = f'{fluff_ratio*100:.1f}% (good)'
        else:
            recommendations.append(f'D2: High fluff word ratio ({fluff_ratio*100:.1f}%). Remove unnecessary words: {", ".join(list(self.FLUFF_WORDS)[:5])}...')
            details['fluff_ratio'] = f'{fluff_ratio*100:.1f}% (too high)'

        # Information density (20 points)
        code_blocks = content.count('```')
        bullet_lists = len(re.findall(r'^\s*[-*]\s+', content, re.MULTILINE))
        numbered_lists = len(re.findall(r'^\s*\d+\.\s+', content, re.MULTILINE))

        info_density = code_blocks + bullet_lists + numbered_lists
        if info_density >= 5:
            score += 20
            details['info_density'] = f'{info_density} structured elements (good)'
        else:
            recommendations.append('D2: Increase information density with code blocks, bullet lists, or numbered lists.')
            details['info_density'] = f'{info_density} structured elements (low)'

        # Repetition check (15 points)
        sentences = re.split(r'[.!?]\s+', content)
        unique_sentences = set(s.strip().lower() for s in sentences if len(s.strip()) > 20)
        repetition_ratio = 1 - (len(unique_sentences) / len(sentences)) if sentences else 0

        if repetition_ratio < 0.05:
            score += 15
            details['repetition'] = f'{repetition_ratio*100:.1f}% duplicate (good)'
        else:
            recommendations.append(f'D2: High repetition detected ({repetition_ratio*100:.1f}%). Remove duplicate sentences.')
            details['repetition'] = f'{repetition_ratio*100:.1f}% duplicate (too high)'

        # Reference files (15 points)
        has_reference = 'reference' in content.lower() or 'see also' in content.lower() or '.md' in content
        if has_reference or file_size_kb < 5:
            score += 15
            details['references'] = 'Uses references or small enough'
        else:
            recommendations.append('D2: Consider using reference files for large content (link to .md files).')
            details['references'] = 'No references found'

        return {'score': score, 'recommendations': recommendations, 'details': details}

    def _score_d3_intent_engineering(self, content: str) -> Dict:
        """
        D3: Intent Engineering (0-100)
        - +30 points: Has decision criteria
        - +25 points: Includes trade-offs
        - +25 points: Has escalation paths
        - +20 points: Defines success/failure conditions
        """
        score = 0
        recommendations = []
        details = {}

        # Decision criteria (30 points)
        decision_keywords = ['if', 'when', 'should', 'consider', 'unless', 'in case']
        decision_count = sum(1 for kw in decision_keywords if kw in content.lower())

        if decision_count >= 5:
            score += 30
            details['decisions'] = f'{decision_count} decision keywords found'
        else:
            recommendations.append('D3: Add decision criteria (use keywords: "if", "when", "should", "consider").')
            details['decisions'] = f'Only {decision_count} decision keywords'

        # Trade-offs (25 points)
        tradeoff_keywords = ['prefer', ' vs ', ' vs.', 'instead of', 'rather than', 'trade-off', 'tradeoff', 'balance']
        has_tradeoffs = any(kw in content.lower() for kw in tradeoff_keywords)

        if has_tradeoffs:
            score += 25
            details['tradeoffs'] = 'Trade-offs discussed'
        else:
            recommendations.append('D3: Include trade-offs (use keywords: "prefer", "vs", "instead of", "rather than").')
            details['tradeoffs'] = 'No trade-offs discussed'

        # Escalation paths (25 points)
        escalation_keywords = ['ask user', 'confirm', 'uncertain', 'unclear', 'ambiguous', 'verify']
        has_escalation = any(kw in content.lower() for kw in escalation_keywords)

        if has_escalation:
            score += 25
            details['escalation'] = 'Escalation paths defined'
        else:
            recommendations.append('D3: Add escalation paths (use keywords: "ask user", "confirm", "uncertain").')
            details['escalation'] = 'No escalation paths'

        # Success/failure conditions (20 points)
        success_keywords = ['verify', 'ensure', 'must', 'should result', 'expected', 'validate']
        success_count = sum(1 for kw in success_keywords if kw in content.lower())

        if success_count >= 3:
            score += 20
            details['success'] = f'{success_count} success criteria keywords'
        else:
            recommendations.append('D3: Define success/failure conditions (use keywords: "verify", "ensure", "expected").')
            details['success'] = f'Only {success_count} success keywords'

        return {'score': score, 'recommendations': recommendations, 'details': details}

    def _score_d4_specification_engineering(self, content: str) -> Dict:
        """
        D4: Specification Engineering (0-100)
        - +30 points: Has numbered steps or clear structure
        - +25 points: Has acceptance criteria
        - +25 points: Testable outcomes defined
        - +20 points: Decomposed into sub-tasks
        """
        score = 0
        recommendations = []
        details = {}

        # Numbered steps (30 points)
        numbered_steps = len(re.findall(r'^\s*\d+\.\s+', content, re.MULTILINE))
        has_headers = len(re.findall(r'^#+\s+', content, re.MULTILINE))

        if numbered_steps >= 3 or has_headers >= 3:
            score += 30
            details['structure'] = f'{numbered_steps} numbered steps, {has_headers} headers'
        else:
            recommendations.append('D4: Add numbered steps or clear section headers for structure.')
            details['structure'] = f'Only {numbered_steps} steps, {has_headers} headers'

        # Acceptance criteria (25 points)
        acceptance_keywords = ['verify', 'ensure', 'must', 'should', 'acceptance', 'criteria']
        acceptance_count = sum(1 for kw in acceptance_keywords if kw in content.lower())

        if acceptance_count >= 4:
            score += 25
            details['acceptance'] = f'{acceptance_count} acceptance keywords'
        else:
            recommendations.append('D4: Add acceptance criteria (use keywords: "verify", "ensure", "must").')
            details['acceptance'] = f'Only {acceptance_count} acceptance keywords'

        # Testable outcomes (25 points)
        test_keywords = ['test', 'check', 'validate', 'confirm', 'verify that']
        test_count = sum(1 for kw in test_keywords if kw in content.lower())

        if test_count >= 3:
            score += 25
            details['testable'] = f'{test_count} testable keywords'
        else:
            recommendations.append('D4: Define testable outcomes (use keywords: "test", "validate", "verify that").')
            details['testable'] = f'Only {test_count} testable keywords'

        # Sub-tasks (20 points)
        bullet_lists = len(re.findall(r'^\s*[-*]\s+', content, re.MULTILINE))

        if bullet_lists >= 5 or numbered_steps >= 5:
            score += 20
            details['subtasks'] = f'{bullet_lists} bullets, {numbered_steps} steps'
        else:
            recommendations.append('D4: Decompose into sub-tasks using bullet or numbered lists.')
            details['subtasks'] = f'Only {bullet_lists} bullets, {numbered_steps} steps'

        return {'score': score, 'recommendations': recommendations, 'details': details}

    def get_score_color(self, score: int) -> str:
        """Get color coding for score"""
        if score >= 80:
            return 'green'
        elif score >= 60:
            return 'yellow'
        else:
            return 'red'
