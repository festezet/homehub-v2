"""
Session Quality Analyzer
Analyzes conversation sessions to detect vague prompts that led to time waste
"""
import re
from typing import Dict, List
from collections import defaultdict


class SessionQualityAnalyzer:
    """Analyzes session quality to detect problematic prompting patterns"""

    def __init__(self):
        # Keywords that indicate problems/corrections
        self.correction_keywords = [
            'non', 'pas comme', 'pas ça', 'oublie', 'recommence', 'annule',
            'mauvais', 'erreur', 'incorrect', 'faux', 'refais'
        ]

        self.clarification_keywords = [
            'je veux dire', 'en fait', 'plutôt', 'au lieu de', 'finalement',
            'non attends', 'correction'
        ]

        self.frustration_keywords = [
            'toujours pas', 'encore une fois', 'combien de fois', 'ça marche pas',
            'comprends pas', 'problème', 'bug'
        ]

    def analyze_session(self, messages: List[Dict]) -> Dict:
        """
        Analyze a single session to detect quality issues

        Args:
            messages: List of messages in chronological order

        Returns:
            Dict with session analysis
        """
        if not messages or len(messages) == 0:
            return {'error': 'Empty session'}

        session_id = messages[0].get('session_id')
        project = messages[0].get('project', 'unknown')

        # Get first substantive message (not just "ok" or "oui")
        initial_prompt = self._get_initial_prompt(messages)

        # Detect problems
        correction_count = self._count_corrections(messages)
        clarification_count = self._count_clarifications(messages)
        frustration_count = self._count_frustrations(messages)

        # Calculate metrics
        message_count = len(messages)
        avg_message_length = sum(len(m.get('display', '')) for m in messages) / max(message_count, 1)
        short_message_ratio = len([m for m in messages if len(m.get('display', '').strip()) <= 20]) / max(message_count, 1)

        # Detect back-and-forth pattern (alternating short messages)
        back_and_forth_score = self._detect_back_and_forth(messages)

        # Calculate problem score (0-100, higher = more problematic)
        problem_score = 0
        problem_indicators = []

        # Correction rate
        correction_rate = correction_count / max(message_count, 1)
        if correction_rate > 0.3:
            problem_score += 30
            problem_indicators.append(f'{int(correction_rate*100)}% messages de correction')
        elif correction_rate > 0.15:
            problem_score += 15
            problem_indicators.append(f'{int(correction_rate*100)}% messages de correction')

        # Clarification rate
        clarification_rate = clarification_count / max(message_count, 1)
        if clarification_rate > 0.2:
            problem_score += 25
            problem_indicators.append(f'{int(clarification_rate*100)}% messages de clarification')
        elif clarification_rate > 0.1:
            problem_score += 12

        # Frustration indicators
        if frustration_count > 2:
            problem_score += 20
            problem_indicators.append(f'{frustration_count} indicateurs de frustration')
        elif frustration_count > 0:
            problem_score += 10

        # Session length (very long sessions may indicate issues)
        if message_count > 50:
            problem_score += 15
            problem_indicators.append(f'Session très longue ({message_count} messages)')
        elif message_count > 30:
            problem_score += 8

        # High ratio of short messages (lots of back-and-forth)
        if short_message_ratio > 0.6:
            problem_score += 10
            problem_indicators.append(f'{int(short_message_ratio*100)}% messages courts (va-et-vient)')

        # Back-and-forth pattern
        if back_and_forth_score > 5:
            problem_score += 10
            problem_indicators.append(f'Pattern de va-et-vient détecté')

        # Analyze initial prompt quality
        initial_prompt_analysis = self._analyze_initial_prompt(initial_prompt)

        # If initial prompt was weak and session had problems, increase score
        if initial_prompt_analysis['score'] < 40 and problem_score > 20:
            problem_score += 10
            problem_indicators.append('Prompt initial vague/incomplet')

        # Overall category
        if problem_score >= 60:
            category = 'problematic'
            severity = 'high'
        elif problem_score >= 40:
            category = 'needs_improvement'
            severity = 'medium'
        elif problem_score >= 20:
            category = 'minor_issues'
            severity = 'low'
        else:
            category = 'good'
            severity = 'none'

        # Generate recommendations
        recommendations = self._generate_session_recommendations(
            initial_prompt_analysis,
            correction_count,
            clarification_count,
            message_count
        )

        return {
            'session_id': session_id,
            'project': project,
            'message_count': message_count,
            'problem_score': min(problem_score, 100),
            'category': category,
            'severity': severity,
            'indicators': problem_indicators,
            'metrics': {
                'correction_count': correction_count,
                'correction_rate': round(correction_rate * 100, 1),
                'clarification_count': clarification_count,
                'clarification_rate': round(clarification_rate * 100, 1),
                'frustration_count': frustration_count,
                'avg_message_length': round(avg_message_length, 1),
                'short_message_ratio': round(short_message_ratio * 100, 1),
                'back_and_forth_score': back_and_forth_score
            },
            'initial_prompt': {
                'text': initial_prompt[:200],  # First 200 chars
                'analysis': initial_prompt_analysis
            },
            'recommendations': recommendations,
            'timestamps': {
                'start': messages[0].get('timestamp'),
                'end': messages[-1].get('timestamp')
            }
        }

    def _get_initial_prompt(self, messages: List[Dict]) -> str:
        """Get the first substantive message (skip greetings/confirmations)"""
        skip_words = {'oui', 'ok', 'non', 'd\'accord', 'bonjour', 'salut', 'hello'}

        for msg in messages[:5]:  # Check first 5 messages
            text = msg.get('display', '').strip().lower()
            if len(text) > 20 and text not in skip_words:
                return msg.get('display', '')

        # If all short, return first non-empty
        for msg in messages:
            text = msg.get('display', '').strip()
            if len(text) > 0:
                return text

        return ''

    def _count_corrections(self, messages: List[Dict]) -> int:
        """Count correction messages"""
        count = 0
        for msg in messages:
            text = msg.get('display', '').lower()
            if any(kw in text for kw in self.correction_keywords):
                count += 1
        return count

    def _count_clarifications(self, messages: List[Dict]) -> int:
        """Count clarification messages"""
        count = 0
        for msg in messages:
            text = msg.get('display', '').lower()
            if any(kw in text for kw in self.clarification_keywords):
                count += 1
        return count

    def _count_frustrations(self, messages: List[Dict]) -> int:
        """Count frustration indicators"""
        count = 0
        for msg in messages:
            text = msg.get('display', '').lower()
            if any(kw in text for kw in self.frustration_keywords):
                count += 1
        return count

    def _detect_back_and_forth(self, messages: List[Dict]) -> int:
        """Detect pattern of short alternating messages (indicates confusion)"""
        if len(messages) < 4:
            return 0

        score = 0
        for i in range(len(messages) - 3):
            # Check for 4 consecutive short messages
            window = messages[i:i+4]
            if all(len(m.get('display', '').strip()) <= 30 for m in window):
                score += 1

        return score

    def _analyze_initial_prompt(self, text: str) -> Dict:
        """Quick analysis of initial prompt quality"""
        if not text or len(text.strip()) == 0:
            return {'score': 0, 'issues': ['Prompt vide']}

        score = 50  # Base score
        issues = []
        strengths = []

        word_count = len(text.split())

        # Too short
        if word_count < 5:
            score -= 30
            issues.append('Trop court (< 5 mots)')
        elif word_count < 10:
            score -= 15
            issues.append('Très court (< 10 mots)')
        else:
            strengths.append(f'{word_count} mots')

        # Has clear intent keywords
        intent_keywords = ['je veux', 'j\'ai besoin', 'peux-tu', 'crée', 'modifie', 'ajoute', 'objectif']
        if any(kw in text.lower() for kw in intent_keywords):
            score += 20
            strengths.append('Intention claire')
        else:
            issues.append('Intention implicite')

        # Has context/details
        context_keywords = ['parce que', 'car', 'pour', 'afin de', 'le projet', 'le fichier']
        if any(kw in text.lower() for kw in context_keywords):
            score += 15
            strengths.append('Contexte fourni')
        else:
            issues.append('Manque de contexte')

        # Has examples or specifics
        if '```' in text or 'exemple' in text.lower() or any(c in text for c in [':', '-', '•']):
            score += 15
            strengths.append('Exemples/détails')
        else:
            issues.append('Pas d\'exemples')

        return {
            'score': max(0, min(score, 100)),
            'issues': issues,
            'strengths': strengths
        }

    def _generate_session_recommendations(
        self,
        initial_analysis: Dict,
        correction_count: int,
        clarification_count: int,
        message_count: int
    ) -> List[str]:
        """Generate specific recommendations for improving prompting"""
        recommendations = []

        # Initial prompt issues
        if 'Trop court' in str(initial_analysis.get('issues', [])):
            recommendations.append(
                "💡 Prompt initial trop court - Commencez avec une description détaillée (10-50 mots minimum)"
            )

        if 'Intention implicite' in str(initial_analysis.get('issues', [])):
            recommendations.append(
                "💡 Spécifiez clairement votre intention dès le début : 'Je veux...', 'L\'objectif est...'"
            )

        if 'Manque de contexte' in str(initial_analysis.get('issues', [])):
            recommendations.append(
                "💡 Ajoutez du contexte : pourquoi vous faites ça, dans quel projet, avec quelles contraintes"
            )

        if 'Pas d\'exemples' in str(initial_analysis.get('issues', [])):
            recommendations.append(
                "💡 Donnez des exemples concrets ou des références pour clarifier votre demande"
            )

        # Correction patterns
        if correction_count > 3:
            recommendations.append(
                f"⚠️ {correction_count} corrections dans cette session - Le prompt initial manquait probablement de précision"
            )

        # Clarification patterns
        if clarification_count > 2:
            recommendations.append(
                f"⚠️ {clarification_count} clarifications nécessaires - Anticipez les questions en donnant plus de détails dès le départ"
            )

        # Long sessions
        if message_count > 30:
            recommendations.append(
                "⚠️ Session très longue - Décomposez les tâches complexes en sous-tâches avec des prompts séparés"
            )

        return recommendations

    def analyze_batch(self, sessions_data: List[List[Dict]]) -> Dict:
        """
        Analyze multiple sessions

        Args:
            sessions_data: List of sessions, where each session is a list of messages

        Returns:
            Dict with aggregate analysis
        """
        results = []

        for session_messages in sessions_data:
            if len(session_messages) == 0:
                continue

            analysis = self.analyze_session(session_messages)
            results.append(analysis)

        # Calculate statistics
        if not results:
            return {'error': 'No sessions to analyze'}

        stats = {
            'total_sessions': len(results),
            'problematic': len([r for r in results if r['category'] == 'problematic']),
            'needs_improvement': len([r for r in results if r['category'] == 'needs_improvement']),
            'minor_issues': len([r for r in results if r['category'] == 'minor_issues']),
            'good': len([r for r in results if r['category'] == 'good']),
            'avg_problem_score': round(sum(r['problem_score'] for r in results) / len(results), 1),
            'avg_corrections_per_session': round(sum(r['metrics']['correction_count'] for r in results) / len(results), 1),
            'avg_messages_per_session': round(sum(r['message_count'] for r in results) / len(results), 1)
        }

        # Get worst sessions (highest problem scores)
        worst_sessions = sorted(results, key=lambda x: x['problem_score'], reverse=True)[:10]

        # Get best sessions (lowest problem scores, but with substantial content)
        best_sessions = sorted(
            [r for r in results if r['message_count'] >= 3],
            key=lambda x: x['problem_score']
        )[:10]

        return {
            'stats': stats,
            'worst_sessions': worst_sessions,
            'best_sessions': best_sessions,
            'all_results': results
        }
