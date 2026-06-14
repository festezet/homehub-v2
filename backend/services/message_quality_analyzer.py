"""
Message Quality Analyzer
Analyzes user messages using D1-D4 prompting framework
"""
import json
import re
from typing import Dict, List
from collections import Counter


class MessageQualityAnalyzer:
    """Analyzes message quality using D1-D4 framework"""

    def __init__(self):
        # Keywords for analysis
        self.purpose_keywords = ['je veux', 'j\'ai besoin', 'peux-tu', 'pourrais-tu', 'objectif', 'but']
        self.example_keywords = ['par exemple', 'comme', 'exemple:', 'voici', 'regarde']
        self.constraint_keywords = ['doit', 'ne doit pas', 'jamais', 'toujours', 'seulement', 'uniquement', 'important']
        self.decision_keywords = ['si', 'quand', 'lorsque', 'au cas où', 'préfère', 'plutôt']
        self.success_keywords = ['vérifie', 'assure-toi', 'valide', 'test', 'confirme']

    def analyze_message(self, message_text: str) -> Dict:
        """Analyze a single message and return D1-D4 scores"""
        if not message_text or len(message_text.strip()) == 0:
            return {
                'd1_score': 0, 'd2_score': 0, 'd3_score': 0, 'd4_score': 0,
                'overall_score': 0, 'category': 'empty',
                'recommendations': ['Message vide']
            }

        # Categorize message type first
        category = self._categorize_message(message_text)

        # Short messages get different analysis
        if len(message_text.strip()) <= 20:
            return self._analyze_short_message(message_text, category)

        d1_result = self._score_d1_clarity(message_text)
        d2_result = self._score_d2_conciseness(message_text)
        d3_result = self._score_d3_intent(message_text)
        d4_result = self._score_d4_structure(message_text)

        overall_score = int((d1_result['score'] + d2_result['score'] +
                           d3_result['score'] + d4_result['score']) / 4)

        recommendations = (d1_result['recommendations'] + d2_result['recommendations'] +
                         d3_result['recommendations'] + d4_result['recommendations'])

        return {
            'd1_score': d1_result['score'],
            'd2_score': d2_result['score'],
            'd3_score': d3_result['score'],
            'd4_score': d4_result['score'],
            'overall_score': overall_score,
            'category': category,
            'recommendations': recommendations,
            'd1_details': d1_result.get('details', {}),
            'd2_details': d2_result.get('details', {}),
            'd3_details': d3_result.get('details', {}),
            'd4_details': d4_result.get('details', {})
        }

    def _categorize_message(self, text: str) -> str:
        """Categorize message type"""
        text_lower = text.lower().strip()

        # Simple confirmations
        if text_lower in ['oui', 'ok', 'non', 'd\'accord', 'yes', 'no']:
            return 'confirmation'

        # Questions
        if text.strip().endswith('?') or any(q in text_lower for q in ['comment', 'pourquoi', 'quoi', 'où', 'quand', 'est-ce que']):
            return 'question'

        # Instructions/commands
        if any(cmd in text_lower for cmd in ['fais', 'crée', 'génère', 'modifie', 'ajoute', 'supprime', 'corrige']):
            return 'instruction'

        # Feedback/discussion
        if any(fb in text_lower for fb in ['c\'est', 'je pense', 'il faut', 'problème', 'erreur']):
            return 'discussion'

        return 'general'

    def _analyze_short_message(self, text: str, category: str) -> Dict:
        """Special analysis for short messages"""
        if category == 'confirmation':
            return {
                'd1_score': 100, 'd2_score': 100, 'd3_score': 100, 'd4_score': 100,
                'overall_score': 100, 'category': category,
                'recommendations': []
            }

        return {
            'd1_score': 30, 'd2_score': 100, 'd3_score': 20, 'd4_score': 20,
            'overall_score': 42,
            'category': category,
            'recommendations': [
                'Message très court - ajoutez plus de contexte',
                'Clarifiez votre intention et les résultats attendus'
            ]
        }

    def _score_d1_clarity(self, text: str) -> Dict:
        """D1: Clarté du prompt (0-100)"""
        score = 0
        recommendations = []
        details = {}

        # Has purpose? (+30)
        has_purpose = any(kw in text.lower() for kw in self.purpose_keywords)
        if has_purpose:
            score += 30
            details['purpose'] = 'Intention claire'
        else:
            recommendations.append('D1: Ajoutez une phrase d\'intention claire (ex: "Je veux...", "L\'objectif est...")')
            details['purpose'] = 'Intention implicite'

        # Has examples? (+25)
        has_examples = any(kw in text.lower() for kw in self.example_keywords) or '```' in text
        if has_examples:
            score += 25
            details['examples'] = 'Exemples fournis'
        else:
            recommendations.append('D1: Ajoutez des exemples concrets pour clarifier')
            details['examples'] = 'Pas d\'exemples'

        # Has constraints? (+25)
        constraint_count = sum(1 for kw in self.constraint_keywords if kw in text.lower())
        if constraint_count >= 2:
            score += 25
            details['constraints'] = f'{constraint_count} contraintes'
        elif constraint_count == 1:
            score += 15
            details['constraints'] = '1 contrainte'
        else:
            recommendations.append('D1: Spécifiez des contraintes (ce qui doit/ne doit pas être fait)')
            details['constraints'] = 'Pas de contraintes'

        # Good length? (+20)
        word_count = len(text.split())
        if 20 <= word_count <= 200:
            score += 20
            details['length'] = f'{word_count} mots (bon)'
        elif word_count > 200:
            score += 10
            details['length'] = f'{word_count} mots (trop long)'
            recommendations.append('D1: Message trop long - essayez d\'être plus concis')
        else:
            details['length'] = f'{word_count} mots (trop court)'

        return {'score': score, 'recommendations': recommendations, 'details': details}

    def _score_d2_conciseness(self, text: str) -> Dict:
        """D2: Concision et densité (0-100)"""
        score = 0
        recommendations = []
        details = {}

        # No fluff words? (+30)
        fluff_words = ['vraiment', 'très', 'juste', 'simplement', 'peut-être', 'probablement']
        fluff_count = sum(text.lower().count(fw) for fw in fluff_words)
        word_count = len(text.split())
        fluff_ratio = fluff_count / max(word_count, 1)

        if fluff_ratio < 0.05:
            score += 30
            details['fluff'] = f'{fluff_ratio*100:.1f}% mots de remplissage (bon)'
        elif fluff_ratio < 0.1:
            score += 20
            details['fluff'] = f'{fluff_ratio*100:.1f}% mots de remplissage (acceptable)'
        else:
            score += 10
            details['fluff'] = f'{fluff_ratio*100:.1f}% mots de remplissage'
            recommendations.append('D2: Réduisez les mots de remplissage (vraiment, très, juste...)')

        # Good information density? (+30)
        sentences = len([s for s in text.split('.') if s.strip()])
        info_density = word_count / max(sentences, 1)
        if 8 <= info_density <= 20:
            score += 30
            details['density'] = f'{info_density:.1f} mots/phrase (bon)'
        elif info_density < 8:
            score += 15
            details['density'] = f'{info_density:.1f} mots/phrase (phrases courtes)'
        else:
            details['density'] = f'{info_density:.1f} mots/phrase (phrases longues)'
            recommendations.append('D2: Phrases trop longues - décomposez-les')

        # Spelling/grammar check (+40)
        typo_patterns = [
            (r'\b(doit etre|peut etre|est ce|qu est)\b', 'Manque d\'accents/apostrophes'),
            (r'\s{2,}', 'Espaces multiples'),
            (r'[,;]\S', 'Ponctuation sans espace'),
        ]

        typos_found = []
        for pattern, desc in typo_patterns:
            if re.search(pattern, text, re.IGNORECASE):
                typos_found.append(desc)

        if len(typos_found) == 0:
            score += 40
            details['quality'] = 'Bonne orthographe'
        else:
            score += max(0, 40 - len(typos_found) * 15)
            details['quality'] = f'{len(typos_found)} problème(s) détecté(s)'
            recommendations.append(f'D2: Améliorez l\'orthographe/ponctuation: {", ".join(typos_found)}')

        return {'score': score, 'recommendations': recommendations, 'details': details}

    def _score_d3_intent(self, text: str) -> Dict:
        """D3: Intention et décisions (0-100)"""
        score = 0
        recommendations = []
        details = {}

        # Has decision criteria? (+40)
        decision_count = sum(1 for kw in self.decision_keywords if kw in text.lower())
        if decision_count >= 2:
            score += 40
            details['decisions'] = f'{decision_count} critères de décision'
        elif decision_count == 1:
            score += 20
            details['decisions'] = '1 critère de décision'
        else:
            recommendations.append('D3: Ajoutez des critères de décision (si X alors Y, préfère A plutôt que B)')
            details['decisions'] = 'Pas de critères'

        # Has success criteria? (+30)
        success_count = sum(1 for kw in self.success_keywords if kw in text.lower())
        if success_count >= 2:
            score += 30
            details['success'] = f'{success_count} critères de succès'
        elif success_count == 1:
            score += 15
            details['success'] = '1 critère de succès'
        else:
            recommendations.append('D3: Définissez comment vérifier le succès (vérifie que..., assure-toi que...)')
            details['success'] = 'Pas de critères de succès'

        # Clear expected outcome? (+30)
        outcome_keywords = ['résultat', 'attendu', 'devrait', 'doit produire', 'doit retourner']
        has_outcome = any(kw in text.lower() for kw in outcome_keywords)
        if has_outcome:
            score += 30
            details['outcome'] = 'Résultat attendu défini'
        else:
            recommendations.append('D3: Spécifiez le résultat attendu')
            details['outcome'] = 'Résultat non spécifié'

        return {'score': score, 'recommendations': recommendations, 'details': details}

    def _score_d4_structure(self, text: str) -> Dict:
        """D4: Structure et spécification (0-100)"""
        score = 0
        recommendations = []
        details = {}

        # Has numbered steps? (+40)
        numbered_steps = len(re.findall(r'\d+[\.\)]\s+', text))
        if numbered_steps >= 3:
            score += 40
            details['steps'] = f'{numbered_steps} étapes numérotées'
        elif numbered_steps > 0:
            score += 20
            details['steps'] = f'{numbered_steps} étape(s)'
        else:
            recommendations.append('D4: Décomposez en étapes numérotées pour les tâches complexes')
            details['steps'] = 'Pas d\'étapes'

        # Has bullet points? (+30)
        bullet_points = len(re.findall(r'[-*•]\s+', text))
        if bullet_points >= 2:
            score += 30
            details['bullets'] = f'{bullet_points} points'
        elif bullet_points == 1:
            score += 15
            details['bullets'] = '1 point'
        else:
            details['bullets'] = 'Pas de points'

        # Has clear sections? (+30)
        sections = len(re.findall(r'(?:^|\n)#{1,3}\s+', text))
        if sections >= 2:
            score += 30
            details['sections'] = f'{sections} sections'
        elif sections == 1:
            score += 15
            details['sections'] = '1 section'
        else:
            details['sections'] = 'Pas de sections'
            if numbered_steps == 0 and bullet_points == 0:
                recommendations.append('D4: Structurez votre message (sections, listes, étapes)')

        return {'score': score, 'recommendations': recommendations, 'details': details}

    def analyze_batch(self, messages: List[Dict]) -> Dict:
        """Analyze multiple messages and return statistics"""
        results = []

        for msg in messages:
            text = msg.get('display', '')
            analysis = self.analyze_message(text)
            analysis['message_id'] = msg.get('id')
            analysis['timestamp'] = msg.get('timestamp')
            analysis['project'] = msg.get('project')
            analysis['message_text'] = text[:100]  # First 100 chars
            results.append(analysis)

        # Calculate statistics
        stats = self._calculate_stats(results)

        return {
            'analyzed_count': len(results),
            'stats': stats,
            'samples': {
                'excellent': [r for r in results if r['overall_score'] >= 80][:5],
                'good': [r for r in results if 60 <= r['overall_score'] < 80][:5],
                'needs_improvement': [r for r in results if r['overall_score'] < 60][:5]
            },
            'category_distribution': Counter([r['category'] for r in results])
        }

    def _calculate_stats(self, results: List[Dict]) -> Dict:
        """Calculate aggregate statistics"""
        if not results:
            return {}

        scores = {
            'd1': [r['d1_score'] for r in results],
            'd2': [r['d2_score'] for r in results],
            'd3': [r['d3_score'] for r in results],
            'd4': [r['d4_score'] for r in results],
            'overall': [r['overall_score'] for r in results]
        }

        stats = {}
        for key, values in scores.items():
            stats[key] = {
                'avg': round(sum(values) / len(values), 1),
                'min': min(values),
                'max': max(values)
            }

        # Score distribution
        overall_scores = scores['overall']
        stats['distribution'] = {
            'excellent': len([s for s in overall_scores if s >= 80]),
            'good': len([s for s in overall_scores if 60 <= s < 80]),
            'needs_improvement': len([s for s in overall_scores if s < 60])
        }

        return stats
