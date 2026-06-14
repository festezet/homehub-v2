"""
Pattern Detector - N-gram based pattern detection in Claude messages
Identifies recurring phrases and patterns to suggest improvements
"""

import re
import logging
from collections import Counter, defaultdict
from datetime import datetime

logger = logging.getLogger(__name__)

# Common stopwords to filter out
STOPWORDS = {
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be',
    'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
    'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that',
    'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me',
    'him', 'her', 'us', 'them', 'my', 'your', 'his', 'its', 'our', 'their'
}


class PatternDetector:
    """Detects recurring patterns in message text using n-gram analysis"""

    def __init__(self, min_frequency=3, min_ngram_length=2, max_ngram_length=5):
        """
        Initialize pattern detector

        Args:
            min_frequency: Minimum occurrences to consider a pattern
            min_ngram_length: Minimum n-gram size (words)
            max_ngram_length: Maximum n-gram size (words)
        """
        self.min_frequency = min_frequency
        self.min_ngram_length = min_ngram_length
        self.max_ngram_length = max_ngram_length

    def clean_text(self, text):
        """
        Clean and normalize text for pattern detection

        Args:
            text: Raw message text

        Returns:
            Cleaned lowercase text
        """
        # Convert to lowercase
        text = text.lower()

        # Remove URLs
        text = re.sub(r'http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+', '', text)

        # Remove file paths
        text = re.sub(r'/[a-zA-Z0-9_\-/\.]+', '', text)
        text = re.sub(r'[a-zA-Z]:\\[a-zA-Z0-9_\-\\\.]+', '', text)

        # Remove code blocks (```...```)
        text = re.sub(r'```[\s\S]*?```', '', text)

        # Remove inline code (`...`)
        text = re.sub(r'`[^`]+`', '', text)

        # Remove special characters but keep spaces and basic punctuation
        text = re.sub(r'[^a-z0-9\s\.\,\!\?]', ' ', text)

        # Remove multiple spaces
        text = re.sub(r'\s+', ' ', text)

        return text.strip()

    def tokenize(self, text):
        """
        Tokenize text into words

        Args:
            text: Cleaned text

        Returns:
            List of tokens
        """
        # Split on whitespace and punctuation
        tokens = re.findall(r'\b\w+\b', text)
        return tokens

    def generate_ngrams(self, tokens, n):
        """
        Generate n-grams from token list

        Args:
            tokens: List of tokens
            n: N-gram size

        Returns:
            List of n-gram tuples
        """
        ngrams = []
        for i in range(len(tokens) - n + 1):
            ngram = tuple(tokens[i:i+n])
            ngrams.append(ngram)
        return ngrams

    def is_valid_ngram(self, ngram):
        """
        Check if n-gram is valid (not all stopwords, has meaningful content)

        Args:
            ngram: Tuple of tokens

        Returns:
            True if valid, False otherwise
        """
        # Must have at least one non-stopword
        non_stopwords = [word for word in ngram if word not in STOPWORDS]
        if len(non_stopwords) == 0:
            return False

        # Must not be all single characters
        if all(len(word) <= 1 for word in ngram):
            return False

        # Must not start or end with a stopword for longer n-grams
        if len(ngram) >= 3:
            if ngram[0] in STOPWORDS and ngram[-1] in STOPWORDS:
                return False

        return True

    def detect_patterns(self, messages):
        """
        Detect patterns in a list of messages

        Args:
            messages: List of message dicts with 'id', 'display', 'timestamp' keys

        Returns:
            List of pattern dicts with pattern_text, frequency, example_messages
        """
        logger.info(f"Detecting patterns in {len(messages)} messages...")

        # Store all n-grams with their message references
        ngram_messages = defaultdict(list)

        for msg in messages:
            text = self.clean_text(msg['display'])
            tokens = self.tokenize(text)

            # Generate n-grams of different sizes
            for n in range(self.min_ngram_length, self.max_ngram_length + 1):
                ngrams = self.generate_ngrams(tokens, n)
                for ngram in ngrams:
                    if self.is_valid_ngram(ngram):
                        ngram_messages[ngram].append({
                            'id': msg['id'],
                            'display': msg['display'][:200],  # First 200 chars
                            'timestamp': msg['timestamp']
                        })

        # Filter by minimum frequency and create pattern objects
        patterns = []
        for ngram, message_list in ngram_messages.items():
            if len(message_list) >= self.min_frequency:
                # Get unique messages (same message might contain the ngram multiple times)
                unique_messages = {}
                for msg in message_list:
                    unique_messages[msg['id']] = msg

                if len(unique_messages) >= self.min_frequency:
                    pattern_text = ' '.join(ngram)
                    frequency = len(unique_messages)

                    # Get timestamps
                    timestamps = [msg['timestamp'] for msg in unique_messages.values()]
                    timestamps.sort()

                    # Sample up to 5 example messages
                    examples = list(unique_messages.values())[:5]

                    patterns.append({
                        'pattern_text': pattern_text,
                        'frequency': frequency,
                        'first_seen': timestamps[0] if timestamps else None,
                        'last_seen': timestamps[-1] if timestamps else None,
                        'example_messages': examples
                    })

        # Sort by frequency (descending)
        patterns.sort(key=lambda x: x['frequency'], reverse=True)

        logger.info(f"Found {len(patterns)} patterns with frequency >= {self.min_frequency}")

        return patterns

    def categorize_pattern(self, pattern_text):
        """
        Suggest a category for a pattern based on keywords

        Args:
            pattern_text: Pattern text

        Returns:
            Category string
        """
        text_lower = pattern_text.lower()

        # Question patterns
        if any(word in text_lower for word in ['how', 'what', 'why', 'when', 'where', 'which', 'who']):
            return 'question'

        # Command patterns
        if any(word in text_lower for word in ['create', 'add', 'update', 'delete', 'fix', 'implement', 'refactor']):
            return 'command'

        # File/code patterns
        if any(word in text_lower for word in ['file', 'function', 'class', 'method', 'variable', 'import']):
            return 'code_reference'

        # Error patterns
        if any(word in text_lower for word in ['error', 'bug', 'issue', 'problem', 'fail']):
            return 'error_report'

        # Request patterns
        if any(word in text_lower for word in ['please', 'can you', 'could you', 'would you']):
            return 'polite_request'

        return 'general'

    def suggest_skill_from_pattern(self, pattern_text, frequency):
        """
        Suggest if a pattern could become a skill

        Args:
            pattern_text: Pattern text
            frequency: How many times it appears

        Returns:
            Dict with suggestion details or None
        """
        if frequency < 5:
            return None

        category = self.categorize_pattern(pattern_text)

        # Only suggest skills for high-frequency command or question patterns
        if category in ['command', 'question'] and frequency >= 10:
            return {
                'reason': f'High frequency ({frequency}x) {category} pattern',
                'suggested_name': pattern_text.replace(' ', '-')[:50],
                'category': category
            }

        return None
