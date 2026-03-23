"""
LinkedIn Posts Review Service
Reads posts from ai-profile (articles) and ai-video-studio (episodes),
tracks review state in a local SQLite DB, computes quality indicators.
"""

import sqlite3
import os
import re
import json
import glob
from datetime import datetime

DB_PATH = '/data/projects/homehub-v2/data/linkedin_posts.db'
CONTENT_JSON = '/data/projects/ai-profile/data/content.json'
EPISODES_BASE = '/data/projects/ai-video-studio/data/output/posts'


class LinkedInService:
    def __init__(self, db_path=DB_PATH):
        self.db_path = os.path.abspath(db_path)
        self._init_db()

    def _get_connection(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        conn = self._get_connection()
        conn.execute("""
            CREATE TABLE IF NOT EXISTS post_reviews (
                id TEXT PRIMARY KEY,
                status TEXT DEFAULT 'draft',
                notes TEXT DEFAULT '',
                reviewed_at TEXT,
                published_at TEXT,
                updated_at TEXT DEFAULT (datetime('now'))
            )
        """)
        conn.commit()
        conn.close()

    # ------------------------------------------------------------------
    # Data reading (live from source files)
    # ------------------------------------------------------------------

    def _read_articles(self):
        """Read articles from ai-profile content.json"""
        if not os.path.exists(CONTENT_JSON):
            return []

        with open(CONTENT_JSON, 'r', encoding='utf-8') as f:
            data = json.load(f)

        articles = []
        for item in data.get('itemListElement', []):
            body = item.get('articleBody', '')
            article_id = item.get('id', '')
            status_map = {'published': 'published', 'ready': 'ready'}
            articles.append({
                'id': article_id,
                'type': 'article',
                'serie': None,
                'episode': None,
                'title': item.get('headline', ''),
                'body': body,
                'date_created': item.get('dateCreated'),
                'date_published': item.get('datePublished'),
                'keywords': item.get('keywords', []),
                'source_status': item.get('status', 'draft'),
                'source_path': CONTENT_JSON,
                'quality': self._compute_quality(body),
            })
        return articles

    def _read_episodes(self):
        """Read episode markdown files from all series"""
        episodes = []
        for serie_dir in sorted(glob.glob(os.path.join(EPISODES_BASE, 'serie*'))):
            serie_name = os.path.basename(serie_dir)
            serie_num = serie_name.replace('serie', '')

            for ep_path in sorted(glob.glob(os.path.join(serie_dir, 'episode_*.md'))):
                ep_file = os.path.basename(ep_path)
                ep_match = re.search(r'episode_(\d+)', ep_file)
                if not ep_match:
                    continue
                ep_num = int(ep_match.group(1))
                post_id = f"{serie_name}-ep{ep_num:02d}"

                title, body = self._parse_episode(ep_path)
                episodes.append({
                    'id': post_id,
                    'type': 'episode',
                    'serie': serie_name,
                    'episode': ep_num,
                    'title': title,
                    'body': body,
                    'date_created': None,
                    'date_published': None,
                    'keywords': [],
                    'source_status': 'draft',
                    'source_path': ep_path,
                    'quality': self._compute_quality(body),
                })
        return episodes

    @staticmethod
    def _parse_episode(filepath):
        """Extract title and body from an episode markdown file"""
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        lines = content.split('\n')
        title = ''
        body_start = 0

        for i, line in enumerate(lines):
            stripped = line.strip()
            if stripped.startswith('## ') and not title:
                title = stripped[3:].strip()
                body_start = i + 1
                break
            elif stripped.startswith('# ') and not title:
                # H1 = serie identifier, skip it
                continue

        # Body = everything after title line, skip leading separators
        body_lines = lines[body_start:]
        while body_lines and body_lines[0].strip() in ('', '---'):
            body_lines.pop(0)

        body = '\n'.join(body_lines).strip()
        return title, body

    # ------------------------------------------------------------------
    # Quality indicators
    # ------------------------------------------------------------------

    @staticmethod
    def _compute_quality(text):
        """Compute quality indicators based on LinkedIn viral research"""
        if not text:
            return {'char_count': 0, 'char_status': 'bad', 'hook': '',
                    'has_cta': False, 'hashtag_count': 0, 'hashtag_status': 'ok',
                    'emoji_count': 0, 'emoji_status': 'ok', 'word_count': 0}

        char_count = len(text)
        word_count = len(text.split())

        # Character count status (sweet spot 800-2000)
        if 800 <= char_count <= 2000:
            char_status = 'good'
        elif 500 <= char_count < 800 or 2000 < char_count <= 3000:
            char_status = 'warning'
        else:
            char_status = 'bad'

        # Hook = first 210 chars (visible before "voir plus")
        hook = text[:210]

        # CTA detection: question at the end of the post
        last_lines = text.strip().split('\n')[-5:]
        last_text = ' '.join(last_lines)
        has_cta = '?' in last_text

        # Hashtag count (optimal 3-5)
        hashtags = re.findall(r'#\w+', text)
        hashtag_count = len(hashtags)
        if 3 <= hashtag_count <= 5:
            hashtag_status = 'good'
        elif hashtag_count == 0 or hashtag_count <= 2:
            hashtag_status = 'warning'
        else:
            hashtag_status = 'bad'

        # Emoji count (1-2 OK, >3 excessive)
        emoji_pattern = re.compile(
            "[\U0001F600-\U0001F64F\U0001F300-\U0001F5FF"
            "\U0001F680-\U0001F6FF\U0001F1E0-\U0001F1FF"
            "\U00002702-\U000027B0\U000024C2-\U0001F251"
            "\U0000FE00-\U0000FE0F\U00002600-\U000026FF"
            "\U0000200D\U00002B50\U00002B55\U0000231A-\U0000231B"
            "\U00002934-\U00002935\U000025AA-\U000025FE"
            "\U00002194-\U000021AA]+", flags=re.UNICODE
        )
        emojis = emoji_pattern.findall(text)
        emoji_count = len(emojis)
        if emoji_count <= 2:
            emoji_status = 'good'
        elif emoji_count <= 4:
            emoji_status = 'warning'
        else:
            emoji_status = 'bad'

        return {
            'char_count': char_count,
            'char_status': char_status,
            'hook': hook,
            'has_cta': has_cta,
            'hashtag_count': hashtag_count,
            'hashtag_status': hashtag_status,
            'emoji_count': emoji_count,
            'emoji_status': emoji_status,
            'word_count': word_count,
        }

    # ------------------------------------------------------------------
    # Review state (DB)
    # ------------------------------------------------------------------

    def _get_review_states(self):
        """Get all review states as a dict {id: row}"""
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM post_reviews")
        states = {row['id']: dict(row) for row in cursor.fetchall()}
        conn.close()
        return states

    def _ensure_review(self, post_id):
        """Create review entry if it doesn't exist"""
        conn = self._get_connection()
        conn.execute(
            "INSERT OR IGNORE INTO post_reviews (id) VALUES (?)",
            (post_id,)
        )
        conn.commit()
        conn.close()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def get_all_posts(self):
        """Get all posts (articles + episodes) with review state + quality"""
        articles = self._read_articles()
        episodes = self._read_episodes()
        all_posts = articles + episodes

        # Sync: ensure all posts have a review entry
        conn = self._get_connection()
        for post in all_posts:
            conn.execute(
                "INSERT OR IGNORE INTO post_reviews (id) VALUES (?)",
                (post['id'],)
            )
        conn.commit()

        # Read review states
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM post_reviews")
        states = {row['id']: dict(row) for row in cursor.fetchall()}
        conn.close()

        # Merge review state into posts
        for post in all_posts:
            state = states.get(post['id'], {})
            post['review_status'] = state.get('status', 'draft')
            post['review_notes'] = state.get('notes', '')
            post['reviewed_at'] = state.get('reviewed_at')
            post['published_at'] = state.get('published_at')
            # Override with source status if published
            if post['source_status'] == 'published':
                post['review_status'] = 'published'

        return all_posts

    def get_post(self, post_id):
        """Get a single post by ID"""
        all_posts = self.get_all_posts()
        for post in all_posts:
            if post['id'] == post_id:
                return post
        return None

    def update_review(self, post_id, status=None, notes=None):
        """Update review status and/or notes for a post"""
        valid_statuses = ('draft', 'ready', 'review', 'published', 'archived')
        if status and status not in valid_statuses:
            return None

        conn = self._get_connection()
        self._ensure_review(post_id)

        updates = []
        params = []
        if status:
            updates.append("status = ?")
            params.append(status)
            if status == 'review':
                updates.append("reviewed_at = datetime('now')")
            elif status == 'published':
                updates.append("published_at = datetime('now')")
        if notes is not None:
            updates.append("notes = ?")
            params.append(notes)

        updates.append("updated_at = datetime('now')")
        params.append(post_id)

        conn.execute(
            f"UPDATE post_reviews SET {', '.join(updates)} WHERE id = ?",
            params
        )
        conn.commit()
        conn.close()
        return True

    def get_stats(self):
        """Get counts by status and type"""
        all_posts = self.get_all_posts()
        stats = {
            'total': len(all_posts),
            'by_status': {},
            'by_type': {},
            'by_serie': {},
        }

        for post in all_posts:
            s = post['review_status']
            stats['by_status'][s] = stats['by_status'].get(s, 0) + 1

            t = post['type']
            stats['by_type'][t] = stats['by_type'].get(t, 0) + 1

            serie = post.get('serie') or 'articles'
            stats['by_serie'][serie] = stats['by_serie'].get(serie, 0) + 1

        return stats

    def sync_posts(self):
        """Force sync: re-read all files and create missing DB entries"""
        all_posts = self.get_all_posts()
        return {'synced': len(all_posts)}


linkedin_service = LinkedInService()
