"""
LinkedIn Prospection Routes — Native HomeHub blueprint.

Migrated from /data/projects/linkedin-prospection/backend/app.py + routes/prospection.py
URL prefix : /api/linkedin-prospection

Sources :
  - Leads, signals, messages, content, dashboard, pipeline-stats, icebreakers (ex app.py)
  - Scraping sources, phantom runs, launch, status, results, import, enrich (ex prospection.py)

DB : /data/projects/infrastructure/data/crm.db (shared CRM)
Env : charge depuis /data/projects/linkedin-prospection/.env (cles PB/Anthropic/...)
"""

import json
import os
import sys
from pathlib import Path

from flask import Blueprint, request

from shared_lib.db import get_connection, query_db, execute_db
from shared_lib.flask_helpers import success, error

# Charger les cles API depuis le .env de linkedin-prospection (source de verite unique).
# dotenv est optionnel : si absent, on parse manuellement (best-effort).
_LP_ENV_PATH = "/data/projects/linkedin-prospection/.env"
if os.path.exists(_LP_ENV_PATH):
    try:
        from dotenv import load_dotenv
        load_dotenv(_LP_ENV_PATH)
    except ImportError:
        with open(_LP_ENV_PATH) as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, _, v = line.partition("=")
                k = k.strip()
                v = v.strip().strip('"').strip("'")
                if k and k not in os.environ:
                    os.environ[k] = v

# Charge le module phantombuster depuis linkedin-prospection/backend/services/
# Via importlib pour eviter la collision avec backend/services/ de HomeHub.
# On prepend aussi LP backend au sys.path pour que phantombuster.py trouve son `config` local.
import importlib.util as _ilu

_LP_BACKEND_PATH = "/data/projects/linkedin-prospection/backend"
if _LP_BACKEND_PATH not in sys.path:
    sys.path.insert(0, _LP_BACKEND_PATH)

# Pre-charge config sous le nom 'config' dans sys.modules (avant d'evaluer phantombuster)
_cfg_spec = _ilu.spec_from_file_location("config", f"{_LP_BACKEND_PATH}/config.py")
_cfg_mod = _ilu.module_from_spec(_cfg_spec)
sys.modules["config"] = _cfg_mod
_cfg_spec.loader.exec_module(_cfg_mod)

_PB_PATH = f"{_LP_BACKEND_PATH}/services/phantombuster.py"
_pb_spec = _ilu.spec_from_file_location("lp_phantombuster", _PB_PATH)
_pb_mod = _ilu.module_from_spec(_pb_spec)
_pb_spec.loader.exec_module(_pb_mod)

launch_phantom = _pb_mod.launch_phantom
get_agent_status = _pb_mod.get_agent_status
fetch_result_object = _pb_mod.fetch_result_object
parse_search_results = _pb_mod.parse_search_results
parse_commenters_results = _pb_mod.parse_commenters_results
parse_profile_results = _pb_mod.parse_profile_results

# DB partagee
CRM_DB_PATH = "/data/projects/infrastructure/data/crm.db"

linkedin_prospection_bp = Blueprint(
    "linkedin_prospection",
    __name__,
    url_prefix="/api/linkedin-prospection",
)


def get_db():
    return get_connection(CRM_DB_PATH)


# ── Leads ──────────────────────────────────────────────────────────────

@linkedin_prospection_bp.route("/leads")
def list_leads():
    """List leads with optional filters: account, tier, min_score, limit, offset."""
    account = request.args.get("account")
    tier = request.args.get("tier")
    min_score = request.args.get("min_score", type=int)
    limit = request.args.get("limit", 50, type=int)
    offset = request.args.get("offset", 0, type=int)
    search = request.args.get("q")

    conditions = []
    params = []

    if account:
        conditions.append("linkedin_account = ?")
        params.append(account)
    if tier == "hot":
        conditions.append("linkedin_score >= 70")
    elif tier == "warm":
        conditions.append("linkedin_score >= 40 AND linkedin_score < 70")
    elif tier == "cold":
        conditions.append("linkedin_score < 40")
    if min_score is not None:
        conditions.append("linkedin_score >= ?")
        params.append(min_score)
    if search:
        conditions.append("(prenom LIKE ? OR nom LIKE ? OR entreprise LIKE ? OR poste LIKE ?)")
        q = f"%{search}%"
        params.extend([q, q, q, q])

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    sort_map = {
        "name": "prenom",
        "company": "entreprise",
        "title": "poste",
        "deepsignal": "linkedin_score",
        "pierre": "pierre_score",
        "status": "linkedin_connection_status",
        "account": "linkedin_account",
    }
    sort_col = sort_map.get(request.args.get("sort", ""), "linkedin_score")
    order = "ASC" if request.args.get("order") == "asc" else "DESC"

    params.extend([limit, offset])

    conn = get_db()
    leads = query_db(
        conn,
        f"""SELECT id, prenom, nom, entreprise, poste, linkedin_account, linkedin_score,
                   pierre_score, pierre_classification,
                   linkedin_connection_status, linkedin_url
            FROM contacts
            {where}
            ORDER BY {sort_col} {order} NULLS LAST
            LIMIT ? OFFSET ?""",
        params,
    )
    total = query_db(
        conn, f"SELECT COUNT(*) as cnt FROM contacts {where}", params[:-2], one=True
    )
    conn.close()
    return success({"leads": [dict(r) for r in leads], "total": total["cnt"]})


@linkedin_prospection_bp.route("/leads/<int:lead_id>")
def get_lead(lead_id):
    """Lead detail with message history and signal matches."""
    conn = get_db()
    lead = query_db(
        conn,
        """SELECT id, prenom, nom, entreprise, poste, linkedin_account, linkedin_score,
                  linkedin_score_details, pierre_score, pierre_classification,
                  linkedin_connection_status, linkedin_url,
                  linkedin_last_message_at, linkedin_message_count,
                  airtable_id, email
           FROM contacts WHERE id = ?""",
        (lead_id,),
        one=True,
    )
    if not lead:
        conn.close()
        return error("Lead not found", 404)

    messages = query_db(
        conn,
        """SELECT id, type, content, status, created_at, sent_at
           FROM linkedin_messages
           WHERE contact_id = ?
           ORDER BY created_at DESC""",
        (lead_id,),
    )

    signals = query_db(
        conn,
        """SELECT s.title, s.signal_date, s.source, sm.match_type, sm.relevance_score
           FROM signal_matches sm
           JOIN signals s ON s.id = sm.signal_id
           WHERE sm.contact_id = ?
           ORDER BY s.signal_date DESC
           LIMIT 10""",
        (lead_id,),
    )
    conn.close()

    return success({
        "lead": dict(lead),
        "messages": [dict(m) for m in messages],
        "signals": [dict(s) for s in signals],
    })


# ── Signals ────────────────────────────────────────────────────────────

@linkedin_prospection_bp.route("/signals")
def list_signals():
    """Recent signals with optional days filter."""
    days = request.args.get("days", 30, type=int)
    limit = request.args.get("limit", 50, type=int)

    conn = get_db()
    signals = query_db(
        conn,
        """SELECT id, title, company, project_name, capacity_mw,
                  signal_type, signal_date, source, country
           FROM signals
           WHERE signal_date >= date('now', ? || ' days')
           ORDER BY signal_date DESC
           LIMIT ?""",
        (f"-{days}", limit),
    )
    total = query_db(
        conn,
        "SELECT COUNT(*) as cnt FROM signals WHERE signal_date >= date('now', ? || ' days')",
        (f"-{days}",),
        one=True,
    )
    conn.close()
    return success({"signals": [dict(s) for s in signals], "total": total["cnt"]})


# ── Messages ───────────────────────────────────────────────────────────

@linkedin_prospection_bp.route("/messages/queue")
def message_queue():
    """Messages pending approval."""
    status = request.args.get("status", "draft")
    limit = request.args.get("limit", 50, type=int)

    conn = get_db()
    messages = query_db(
        conn,
        """SELECT m.id, m.contact_id, m.account, m.type, m.content, m.status, m.created_at,
                  (c.prenom || ' ' || c.nom) as contact_name, c.entreprise as contact_company
           FROM linkedin_messages m
           JOIN contacts c ON c.id = m.contact_id
           WHERE m.status = ?
           ORDER BY m.created_at DESC
           LIMIT ?""",
        (status, limit),
    )
    conn.close()
    return success({"messages": [dict(m) for m in messages]})


@linkedin_prospection_bp.route("/messages/<int:msg_id>/approve", methods=["POST"])
def approve_message(msg_id):
    """Approve a draft message."""
    conn = get_db()
    execute_db(
        conn,
        "UPDATE linkedin_messages SET status = 'approved' WHERE id = ? AND status = 'draft'",
        (msg_id,),
    )
    changed = query_db(conn, "SELECT changes() as n", one=True)["n"]
    conn.close()
    if not changed:
        return error("Message not found or not in draft status", 404)
    return success({"message": f"Message #{msg_id} approved"})


@linkedin_prospection_bp.route("/messages/<int:msg_id>/reject", methods=["POST"])
def reject_message(msg_id):
    """Reject a draft message."""
    conn = get_db()
    execute_db(
        conn,
        "UPDATE linkedin_messages SET status = 'rejected' WHERE id = ? AND status = 'draft'",
        (msg_id,),
    )
    changed = query_db(conn, "SELECT changes() as n", one=True)["n"]
    conn.close()
    if not changed:
        return error("Message not found or not in draft status", 404)
    return success({"message": f"Message #{msg_id} rejected"})


# ── Content ────────────────────────────────────────────────────────────

@linkedin_prospection_bp.route("/content/queue")
def content_queue():
    """Content drafts and scheduled items."""
    status = request.args.get("status", "draft")
    limit = request.args.get("limit", 50, type=int)

    conn = get_db()
    content = query_db(
        conn,
        """SELECT id, account, type, content, status, created_at, published_at
           FROM linkedin_content
           WHERE status = ?
           ORDER BY created_at DESC
           LIMIT ?""",
        (status, limit),
    )
    conn.close()
    return success({"content": [dict(c) for c in content]})


@linkedin_prospection_bp.route("/content/<int:content_id>/publish", methods=["POST"])
def publish_content(content_id):
    """Mark content as published."""
    conn = get_db()
    execute_db(
        conn,
        """UPDATE linkedin_content SET status = 'published', published_at = datetime('now')
           WHERE id = ? AND status IN ('draft', 'scheduled')""",
        (content_id,),
    )
    changed = query_db(conn, "SELECT changes() as n", one=True)["n"]
    conn.close()
    if not changed:
        return error("Content not found or already published", 404)
    return success({"message": f"Content #{content_id} published"})


# ── Dashboard ──────────────────────────────────────────────────────────

@linkedin_prospection_bp.route("/dashboard")
def dashboard():
    """Pipeline metrics overview."""
    conn = get_db()

    scores = query_db(
        conn,
        """SELECT
             SUM(CASE WHEN linkedin_score >= 70 THEN 1 ELSE 0 END) as hot,
             SUM(CASE WHEN linkedin_score >= 40 AND linkedin_score < 70 THEN 1 ELSE 0 END) as warm,
             SUM(CASE WHEN linkedin_score < 40 THEN 1 ELSE 0 END) as cold,
             COUNT(*) as total
           FROM contacts WHERE linkedin_score IS NOT NULL""",
        one=True,
    )

    pierre_scores = query_db(
        conn,
        """SELECT
             SUM(CASE WHEN pierre_score >= 7 THEN 1 ELSE 0 END) as hot,
             SUM(CASE WHEN pierre_score >= 4 AND pierre_score < 7 THEN 1 ELSE 0 END) as warm,
             SUM(CASE WHEN pierre_score < 4 THEN 1 ELSE 0 END) as cold,
             COUNT(*) as total
           FROM contacts WHERE pierre_score IS NOT NULL""",
        one=True,
    )

    pipeline = query_db(
        conn,
        """SELECT linkedin_connection_status as stage, COUNT(*) as cnt
           FROM contacts
           WHERE linkedin_score IS NOT NULL
           GROUP BY linkedin_connection_status""",
    )

    messages = query_db(
        conn,
        """SELECT status, COUNT(*) as cnt
           FROM linkedin_messages GROUP BY status""",
    )

    content = query_db(
        conn,
        """SELECT status, COUNT(*) as cnt
           FROM linkedin_content GROUP BY status""",
    )

    signals_7d = query_db(
        conn,
        "SELECT COUNT(*) as cnt FROM signals WHERE signal_date >= date('now', '-7 days')",
        one=True,
    )

    airtable = query_db(
        conn,
        "SELECT COUNT(*) as cnt FROM contacts WHERE airtable_id IS NOT NULL",
        one=True,
    )

    top_leads = query_db(
        conn,
        """SELECT id, prenom, nom, entreprise, linkedin_score, pierre_score,
                  pierre_classification, linkedin_connection_status
           FROM contacts
           WHERE linkedin_score IS NOT NULL
           ORDER BY linkedin_score DESC
           LIMIT 10""",
    )

    conn.close()

    return success({
        "scores": {
            "hot": scores["hot"] or 0,
            "warm": scores["warm"] or 0,
            "cold": scores["cold"] or 0,
            "total": scores["total"] or 0,
        },
        "pierre_scores": {
            "hot": pierre_scores["hot"] or 0,
            "warm": pierre_scores["warm"] or 0,
            "cold": pierre_scores["cold"] or 0,
            "total": pierre_scores["total"] or 0,
        },
        "pipeline": {r["stage"] or "none": r["cnt"] for r in pipeline},
        "messages": {r["status"]: r["cnt"] for r in messages},
        "content": {r["status"]: r["cnt"] for r in content},
        "signals_7d": signals_7d["cnt"],
        "airtable_synced": airtable["cnt"],
        "top_leads": [dict(r) for r in top_leads],
    })


@linkedin_prospection_bp.route("/pipeline-stats")
def pipeline_stats():
    """Live counts for each stage of the prospection pipeline."""
    conn = get_db()

    def scalar(sql, params=()):
        row = query_db(conn, sql, params, one=True)
        if not row:
            return 0
        try:
            return row["c"]
        except (KeyError, IndexError):
            return list(row.values())[0] if hasattr(row, "values") else row[0]

    stats = {
        "scraping_sources": scalar("SELECT COUNT(*) AS c FROM scraping_sources"),
        "pb_runs": scalar("SELECT COUNT(*) AS c FROM phantombuster_runs"),
        "contacts_total": scalar("SELECT COUNT(*) AS c FROM contacts"),
        "contacts_offshore": scalar(
            "SELECT COUNT(*) AS c FROM contacts WHERE linkedin_account = 'en-offshore'"
        ),
        "contacts_fr_ai": scalar(
            "SELECT COUNT(*) AS c FROM contacts WHERE linkedin_account = 'fr-ai'"
        ),
        "tier1_scored": scalar(
            "SELECT COUNT(*) AS c FROM contacts WHERE linkedin_score IS NOT NULL"
        ),
        "tier1_warm": scalar(
            "SELECT COUNT(*) AS c FROM contacts "
            "WHERE linkedin_score >= 40 AND linkedin_score < 70"
        ),
        "tier1_cold": scalar(
            "SELECT COUNT(*) AS c FROM contacts WHERE linkedin_score < 40"
        ),
        "signals": scalar("SELECT COUNT(*) AS c FROM signals"),
        "signal_matches": scalar("SELECT COUNT(*) AS c FROM signal_matches"),
        "enriched": scalar(
            "SELECT COUNT(*) AS c FROM contacts WHERE linkedin_connections IS NOT NULL"
        ),
        "tier2_scored": scalar(
            "SELECT COUNT(*) AS c FROM contacts WHERE pierre_score IS NOT NULL"
        ),
        "tier2_hot": scalar(
            "SELECT COUNT(*) AS c FROM contacts WHERE pierre_classification = 'HOT'"
        ),
        "tier2_warm": scalar(
            "SELECT COUNT(*) AS c FROM contacts WHERE pierre_classification = 'WARM'"
        ),
        "tier2_cold": scalar(
            "SELECT COUNT(*) AS c FROM contacts WHERE pierre_classification = 'COLD'"
        ),
        "icebreakers": scalar(
            "SELECT COUNT(*) AS c FROM contacts "
            "WHERE icebreaker_message IS NOT NULL AND icebreaker_message != ''"
        ),
        "msg_draft": scalar(
            "SELECT COUNT(*) AS c FROM linkedin_messages WHERE status = 'draft'"
        ),
        "msg_approved": scalar(
            "SELECT COUNT(*) AS c FROM linkedin_messages WHERE status = 'approved'"
        ),
        "msg_sent": scalar(
            "SELECT COUNT(*) AS c FROM linkedin_messages WHERE status = 'sent'"
        ),
        "connected": scalar(
            "SELECT COUNT(*) AS c FROM contacts "
            "WHERE linkedin_connection_status = 'connected'"
        ),
        "replied": scalar(
            "SELECT COUNT(*) AS c FROM contacts "
            "WHERE linkedin_connection_status = 'replied'"
        ),
        "meeting": scalar(
            "SELECT COUNT(*) AS c FROM contacts "
            "WHERE linkedin_connection_status = 'meeting'"
        ),
    }
    conn.close()
    return success({"stats": stats, "db_path": str(CRM_DB_PATH)})


# ── Icebreakers (UNION 2 sources : ancien Pierre + nouveau linkedin_messages) ────

@linkedin_prospection_bp.route("/icebreakers")
def list_icebreakers():
    """List HOT contacts with icebreaker messages (deux pipelines fusionnes)."""
    conn = get_db()
    # Source 1 : ancien pipeline (contacts.icebreaker_message, scoring Pierre)
    old_rows = query_db(
        conn,
        """SELECT id, prenom, nom, entreprise, poste, linkedin_url,
                  pierre_score, pierre_classification, icebreaker_message,
                  icebreaker_generated_at
           FROM contacts
           WHERE pierre_classification = 'HOT'
             AND icebreaker_message IS NOT NULL
             AND icebreaker_message != ''""",
    )
    contacts_list = []
    for r in old_rows:
        c = dict(r)
        c["source"] = "pierre"
        c["status"] = "ready"
        contacts_list.append(c)

    # Source 2 : nouveau pipeline (linkedin_messages, scoring linkedin_score)
    new_rows = query_db(
        conn,
        """SELECT lm.id AS msg_id, lm.contact_id, lm.content AS icebreaker_message,
                  lm.status, lm.type AS msg_type, lm.created_at AS msg_created_at,
                  c.prenom, c.nom, c.entreprise, c.poste, c.linkedin_url,
                  c.linkedin_score, c.pierre_score, c.pierre_classification
           FROM linkedin_messages lm
           JOIN contacts c ON c.id = lm.contact_id
           WHERE lm.type = 'connection'
             AND lm.content IS NOT NULL
             AND lm.content != ''""",
    )
    for r in new_rows:
        m = dict(r)
        contacts_list.append({
            "id": m["contact_id"],
            "msg_id": m["msg_id"],
            "prenom": m["prenom"],
            "nom": m["nom"],
            "entreprise": m["entreprise"],
            "poste": m["poste"],
            "linkedin_url": m["linkedin_url"],
            "pierre_score": m.get("pierre_score"),
            "pierre_classification": m.get("pierre_classification"),
            "linkedin_score": m.get("linkedin_score"),
            "icebreaker_message": m["icebreaker_message"],
            "icebreaker_generated_at": (m.get("msg_created_at") or "")[:10],
            "status": m.get("status") or "draft",
            "source": "linkedin_messages",
        })

    def _sort_key(c):
        d = (c.get("icebreaker_generated_at") or "0000-00-00")[:10]
        score = c.get("pierre_score") or c.get("linkedin_score") or 0
        return (d, score)
    contacts_list.sort(key=_sort_key, reverse=True)

    batch_counts = {}
    for c in contacts_list:
        d = (c.get("icebreaker_generated_at") or "")[:10] or "unknown"
        batch_counts[d] = batch_counts.get(d, 0) + 1
    batches = sorted(
        [{"date": d, "count": n} for d, n in batch_counts.items()],
        key=lambda x: x["date"],
        reverse=True,
    )

    conn.close()
    return success({
        "contacts": contacts_list,
        "total": len(contacts_list),
        "batches": batches,
    })


# ── Scraping Sources ─────────────────────────────────────────────────────

@linkedin_prospection_bp.route("/sources", methods=["GET"])
def list_sources():
    """List all scraping sources."""
    account = request.args.get("account")
    conn = get_db()

    if account:
        sources = query_db(
            conn,
            "SELECT * FROM scraping_sources WHERE account = ? ORDER BY created_at DESC",
            (account,),
        )
    else:
        sources = query_db(
            conn, "SELECT * FROM scraping_sources ORDER BY created_at DESC"
        )
    conn.close()
    return success({"sources": [dict(s) for s in sources]})


@linkedin_prospection_bp.route("/sources", methods=["POST"])
def create_source():
    """Create a new scraping source."""
    data = request.get_json()
    if not data:
        return error("JSON body required", 400)

    required = ["name", "source_type", "url", "account"]
    for field in required:
        if not data.get(field):
            return error(f"Field '{field}' is required", 400)

    valid_types = ("search_url", "post_url", "sn_list", "post_likers", "profile_scraper")
    if data["source_type"] not in valid_types:
        return error(f"source_type must be one of: {valid_types}", 400)

    conn = get_db()
    execute_db(
        conn,
        """INSERT INTO scraping_sources (name, source_type, url, account, phantom_id,
                category, filters, max_results)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            data["name"],
            data["source_type"],
            data["url"],
            data["account"],
            data.get("phantom_id"),
            data.get("category", "offshore_wind"),
            json.dumps(data.get("filters")) if data.get("filters") else None,
            data.get("max_results", 100),
        ),
    )
    source_id = query_db(conn, "SELECT last_insert_rowid() as id", one=True)["id"]
    conn.close()
    return success({"id": source_id, "message": "Source created"})


@linkedin_prospection_bp.route("/sources/<int:source_id>", methods=["DELETE"])
def delete_source(source_id):
    """Delete a scraping source."""
    conn = get_db()
    execute_db(conn, "DELETE FROM scraping_sources WHERE id = ?", (source_id,))
    changed = query_db(conn, "SELECT changes() as n", one=True)["n"]
    conn.close()
    if not changed:
        return error("Source not found", 404)
    return success({"message": f"Source #{source_id} deleted"})


# ── Phantom Runs ─────────────────────────────────────────────────────────

@linkedin_prospection_bp.route("/runs", methods=["GET"])
def list_runs():
    """List phantom runs with optional filters."""
    limit = request.args.get("limit", 20, type=int)
    status_filter = request.args.get("status")

    conn = get_db()
    if status_filter:
        runs = query_db(
            conn,
            """SELECT * FROM phantombuster_runs
               WHERE status = ?
               ORDER BY launched_at DESC LIMIT ?""",
            (status_filter, limit),
        )
    else:
        runs = query_db(
            conn,
            "SELECT * FROM phantombuster_runs ORDER BY launched_at DESC LIMIT ?",
            (limit,),
        )
    conn.close()
    return success({"runs": [dict(r) for r in runs]})


@linkedin_prospection_bp.route("/launch", methods=["POST"])
def launch_scrape():
    """Launch a Phantombuster phantom from a source."""
    data = request.get_json()
    if not data:
        return error("JSON body required", 400)

    conn = get_db()

    if data.get("source_id"):
        source = query_db(
            conn,
            "SELECT * FROM scraping_sources WHERE id = ?",
            (data["source_id"],),
            one=True,
        )
        if not source:
            conn.close()
            return error("Source not found", 404)
        if not source["phantom_id"]:
            conn.close()
            return error("Source has no phantom_id configured", 400)

        phantom_id = source["phantom_id"]
        phantom_type = _source_type_to_phantom_type(source["source_type"])
        account = source["account"]
        input_summary = f"{source['name']}: {source['url'][:80]}"
    else:
        phantom_id = data.get("phantom_id")
        phantom_type = data.get("phantom_type", "search_export")
        account = data.get("account", "en-offshore")
        input_summary = data.get("input_summary", "manual launch")

        if not phantom_id:
            conn.close()
            return error("phantom_id or source_id required", 400)

    result = launch_phantom(phantom_id)
    if "error" in result:
        conn.close()
        return error(result["error"], 502)

    execute_db(
        conn,
        """INSERT INTO phantombuster_runs (phantom_id, phantom_type, account, status,
                container_id, input_summary)
           VALUES (?, ?, ?, 'launched', ?, ?)""",
        (phantom_id, phantom_type, account, result.get("containerId"), input_summary),
    )
    run_id = query_db(conn, "SELECT last_insert_rowid() as id", one=True)["id"]

    if data.get("source_id"):
        execute_db(
            conn,
            """UPDATE scraping_sources
               SET last_run_at = datetime('now'), runs_count = runs_count + 1
               WHERE id = ?""",
            (data["source_id"],),
        )

    conn.close()
    return success({"run_id": run_id, "containerId": result.get("containerId"), "status": "launched"})


@linkedin_prospection_bp.route("/runs/<int:run_id>/status", methods=["GET"])
def check_run_status(run_id):
    """Check status of a phantom run."""
    conn = get_db()
    run = query_db(
        conn, "SELECT * FROM phantombuster_runs WHERE id = ?", (run_id,), one=True
    )
    if not run:
        conn.close()
        return error("Run not found", 404)

    if run["status"] in ("finished", "error"):
        conn.close()
        return success(dict(run))

    status = get_agent_status(run["phantom_id"])
    if "error" in status:
        conn.close()
        return success({**dict(run), "live_error": status["error"]})

    last_status = status.get("lastEndStatus")
    if last_status == "finished":
        execute_db(
            conn,
            """UPDATE phantombuster_runs
               SET status = 'finished', finished_at = datetime('now')
               WHERE id = ?""",
            (run_id,),
        )
    elif last_status == "error":
        execute_db(
            conn,
            """UPDATE phantombuster_runs
               SET status = 'error', finished_at = datetime('now'),
                   error_message = ?
               WHERE id = ?""",
            (status.get("lastEndMessage", "Unknown error"), run_id),
        )

    conn.close()
    updated_run = {**dict(run), "status": last_status or run["status"]}
    return success(updated_run)


@linkedin_prospection_bp.route("/runs/<int:run_id>/results", methods=["GET"])
def get_run_results(run_id):
    """Fetch results from a completed phantom run."""
    conn = get_db()
    run = query_db(
        conn, "SELECT * FROM phantombuster_runs WHERE id = ?", (run_id,), one=True
    )
    conn.close()

    if not run:
        return error("Run not found", 404)

    results = fetch_result_object(run["phantom_id"])
    if isinstance(results, dict) and "error" in results:
        return error(results["error"], 502)

    phantom_type = run["phantom_type"]
    if phantom_type == "search_export":
        parsed = parse_search_results(results)
    elif phantom_type in ("commenters", "post_likers"):
        parsed = parse_commenters_results(results)
    elif phantom_type == "profile_scraper":
        parsed = parse_profile_results(results)
    else:
        parsed = results

    return success({
        "run_id": run_id,
        "raw_count": len(results) if isinstance(results, list) else 0,
        "parsed_count": len(parsed),
        "results": parsed,
    })


@linkedin_prospection_bp.route("/runs/<int:run_id>/import", methods=["POST"])
def import_run_results(run_id):
    """Import results from a phantom run into contacts table."""
    conn = get_db()
    run = query_db(
        conn, "SELECT * FROM phantombuster_runs WHERE id = ?", (run_id,), one=True
    )
    if not run:
        conn.close()
        return error("Run not found", 404)

    results = fetch_result_object(run["phantom_id"])
    if isinstance(results, dict) and "error" in results:
        conn.close()
        return error(results["error"], 502)

    phantom_type = run["phantom_type"]
    if phantom_type == "search_export":
        parsed = parse_search_results(results)
    elif phantom_type in ("commenters", "post_likers"):
        parsed = parse_commenters_results(results)
    elif phantom_type == "profile_scraper":
        parsed = parse_profile_results(results)
    else:
        conn.close()
        return error(f"Unsupported phantom_type for import: {phantom_type}", 400)

    imported = 0
    skipped = 0
    for contact in parsed:
        linkedin_url = contact.get("linkedin_url", "").strip()
        if not linkedin_url or not contact.get("nom"):
            skipped += 1
            continue

        existing = query_db(
            conn,
            "SELECT id FROM contacts WHERE linkedin_url = ?",
            (linkedin_url,),
            one=True,
        )
        if existing:
            skipped += 1
            continue

        execute_db(
            conn,
            """INSERT INTO contacts (prenom, nom, linkedin_url, entreprise, poste,
                    linkedin_account, source, linkedin_connections, category)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                contact.get("prenom", ""),
                contact["nom"],
                linkedin_url,
                contact.get("entreprise", ""),
                contact.get("poste", ""),
                run["account"],
                contact.get("source", f"phantombuster_{phantom_type}"),
                contact.get("linkedin_connections"),
                "offshore_wind",
            ),
        )
        imported += 1

    execute_db(
        conn,
        """UPDATE phantombuster_runs
           SET results_count = ?, contacts_imported = ?
           WHERE id = ?""",
        (len(parsed), imported, run_id),
    )

    conn.close()
    return success({
        "imported": imported,
        "skipped": skipped,
        "total_parsed": len(parsed),
    })


@linkedin_prospection_bp.route("/enrich", methods=["POST"])
def enrich_contacts():
    """Enrich existing contacts with profile scraper results."""
    data = request.get_json()
    if not data or not data.get("run_id"):
        return error("run_id required", 400)

    conn = get_db()
    run = query_db(
        conn,
        "SELECT * FROM phantombuster_runs WHERE id = ? AND phantom_type = 'profile_scraper'",
        (data["run_id"],),
        one=True,
    )
    if not run:
        conn.close()
        return error("Profile scraper run not found", 404)

    results = fetch_result_object(run["phantom_id"])
    if isinstance(results, dict) and "error" in results:
        conn.close()
        return error(results["error"], 502)

    enriched_data = parse_profile_results(results)
    updated = 0
    not_found = 0

    for profile in enriched_data:
        linkedin_url = profile.get("linkedin_url", "").strip()
        if not linkedin_url:
            continue

        existing = query_db(
            conn,
            "SELECT id FROM contacts WHERE linkedin_url = ?",
            (linkedin_url,),
            one=True,
        )
        if not existing:
            not_found += 1
            continue

        updates = []
        params = []
        if profile.get("email"):
            updates.append("email = ?")
            params.append(profile["email"])
        if profile.get("telephone"):
            updates.append("telephone = ?")
            params.append(profile["telephone"])
        if profile.get("entreprise"):
            updates.append("entreprise = ?")
            params.append(profile["entreprise"])
        if profile.get("poste"):
            updates.append("poste = ?")
            params.append(profile["poste"])
        if profile.get("linkedin_connections"):
            updates.append("linkedin_connections = ?")
            params.append(profile["linkedin_connections"])
        if profile.get("about"):
            updates.append("pb_raw_data = ?")
            params.append(json.dumps(profile))

        updates.append("pb_enriched_at = datetime('now')")

        if updates:
            params.append(existing["id"])
            execute_db(
                conn,
                f"UPDATE contacts SET {', '.join(updates)} WHERE id = ?",
                params,
            )
            updated += 1

    conn.close()
    return success({"updated": updated, "not_found": not_found, "total": len(enriched_data)})


# ── Helpers ──────────────────────────────────────────────────────────────

def _source_type_to_phantom_type(source_type):
    """Map source_type to phantom_type."""
    mapping = {
        "search_url": "search_export",
        "post_url": "commenters",
        "sn_list": "search_export",
        "post_likers": "commenters",
        "profile_scraper": "profile_scraper",
    }
    return mapping.get(source_type, "search_export")
