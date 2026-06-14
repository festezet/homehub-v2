"""
Gmail Knowledge Routes - Proxy to standalone service (port 5052)
All requests are forwarded to the gmail-cleaner knowledge API.
"""
import urllib.request
import urllib.error
import json

from flask import Blueprint, jsonify, request
from shared_lib.flask_helpers import error as api_error

gmail_knowledge_bp = Blueprint('gmail_knowledge', __name__, url_prefix='/api/gmail-knowledge')

BACKEND_URL = "http://127.0.0.1:5052/api"


def _proxy(path, method="GET"):
    """Forward request to gmail-knowledge backend."""
    url = f"{BACKEND_URL}/{path}"
    headers = {"Content-Type": "application/json"}
    req = urllib.request.Request(url, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read())
            return jsonify(result), resp.status
    except urllib.error.HTTPError as e:
        result = json.loads(e.read())
        return jsonify(result), e.code
    except urllib.error.URLError:
        return api_error(503, "Gmail Knowledge service unavailable (port 5052)")


@gmail_knowledge_bp.route('/stats')
def get_stats():
    return _proxy("stats")


@gmail_knowledge_bp.route('/accounts')
def get_accounts():
    params = request.query_string.decode()
    path = f"accounts?{params}" if params else "accounts"
    return _proxy(path)


@gmail_knowledge_bp.route('/contacts')
def get_contacts():
    params = request.query_string.decode()
    path = f"contacts?{params}" if params else "contacts"
    return _proxy(path)


@gmail_knowledge_bp.route('/annuaire')
def get_annuaire():
    """Merge accounts + contacts into a unified directory."""
    try:
        entries = []
        # Fetch accounts (limit=1000 to get all entries)
        url_acc = f"{BACKEND_URL}/accounts?limit=1000"
        req_acc = urllib.request.Request(url_acc, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req_acc, timeout=30) as resp:
            acc_data = json.loads(resp.read())
        for a in acc_data.get('accounts', []):
            entries.append({
                'name': a.get('service_name', ''),
                'email': a.get('email_used', ''),
                'category': a.get('category', ''),
                'type': 'compte',
                'detail': a.get('status', ''),
                'last_activity': a.get('last_activity_date', ''),
                'email_count': a.get('email_count', 0),
            })
        # Fetch contacts (limit=1000 to get all entries)
        url_con = f"{BACKEND_URL}/contacts?limit=1000"
        req_con = urllib.request.Request(url_con, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req_con, timeout=30) as resp:
            con_data = json.loads(resp.read())
        for c in con_data.get('contacts', []):
            entries.append({
                'name': c.get('name', ''),
                'email': c.get('email', ''),
                'category': c.get('company', '') or 'contact',
                'type': 'contact',
                'detail': c.get('company', ''),
                'last_activity': c.get('last_contact_date', ''),
                'email_count': c.get('email_count', 0),
            })
        # Filter by query params
        q = request.args.get('q', '').lower()
        type_filter = request.args.get('type', '')
        if q:
            entries = [e for e in entries if q in e['name'].lower() or q in e['email'].lower()]
        if type_filter:
            entries = [e for e in entries if e['type'] == type_filter]
        # Sort by last_activity desc (empty strings last)
        entries.sort(key=lambda e: e.get('last_activity') or '', reverse=True)
        return jsonify({'ok': True, 'entries': entries, 'total': len(entries)})
    except urllib.error.URLError:
        return api_error(503, "Gmail Knowledge service unavailable (port 5052)")


@gmail_knowledge_bp.route('/documents')
def get_documents():
    params = request.query_string.decode()
    # Ensure high limit to get all entries
    if 'limit' not in params:
        path = f"documents?{params}&limit=1000" if params else "documents?limit=1000"
    else:
        path = f"documents?{params}"
    return _proxy(path)


@gmail_knowledge_bp.route('/events')
def get_events():
    params = request.query_string.decode()
    if 'limit' not in params:
        path = f"events?{params}&limit=1000" if params else "events?limit=1000"
    else:
        path = f"events?{params}"
    return _proxy(path)


@gmail_knowledge_bp.route('/financial')
def get_financial():
    params = request.query_string.decode()
    if 'limit' not in params:
        path = f"financial?{params}&limit=1000" if params else "financial?limit=1000"
    else:
        path = f"financial?{params}"
    return _proxy(path)


@gmail_knowledge_bp.route('/search')
def search():
    params = request.query_string.decode()
    if 'limit' not in params:
        path = f"search?{params}&limit=1000" if params else "search?limit=1000"
    else:
        path = f"search?{params}"
    return _proxy(path)


@gmail_knowledge_bp.route('/pj/<message_id>/<path:filename>')
def serve_attachment(message_id, filename):
    """Proxy attachment file from gmail-knowledge service."""
    from urllib.parse import quote
    url = f"http://127.0.0.1:5052/pj/{message_id}/{quote(filename)}"
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=30) as resp:
            from flask import Response
            content = resp.read()
            content_type = resp.headers.get('Content-Type', 'application/octet-stream')
            return Response(content, content_type=content_type)
    except urllib.error.HTTPError as e:
        return api_error(e.code, f"Attachment not found: {filename}")
    except urllib.error.URLError:
        return api_error(503, "Gmail Knowledge service unavailable (port 5052)")


@gmail_knowledge_bp.route('/health')
def health():
    return _proxy("health")
