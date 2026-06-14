"""
Patrimoine API Routes - CRUD for patrimoine accounts, balances, and analysis
"""

from flask import Blueprint, request
from shared_lib.flask_helpers import success, error as api_error
import logging

logger = logging.getLogger(__name__)

patrimoine_bp = Blueprint('patrimoine', __name__)

_service = None


def init_patrimoine_routes(service):
    global _service
    _service = service


# --- Full table ---

@patrimoine_bp.route('/api/patrimoine/table')
def get_full_table():
    """Get full patrimoine table with all snapshots"""
    try:
        data = _service.get_full_table()
        return success(**data)
    except Exception as e:
        logger.error(f"Error getting patrimoine table: {e}")
        return api_error(500, str(e))


@patrimoine_bp.route('/api/patrimoine/summary')
def get_summary():
    """Get quick patrimoine summary"""
    try:
        data = _service.get_summary()
        return success(**data)
    except Exception as e:
        logger.error(f"Error getting patrimoine summary: {e}")
        return api_error(500, str(e))


# --- Categories ---

@patrimoine_bp.route('/api/patrimoine/categories')
def get_categories():
    try:
        cats = _service.get_categories()
        return success(categories=cats)
    except Exception as e:
        logger.error(f"Error getting categories: {e}")
        return api_error(500, str(e))


# --- Accounts ---

@patrimoine_bp.route('/api/patrimoine/accounts')
def get_accounts():
    try:
        category_id = request.args.get('category_id', type=int)
        accounts = _service.get_accounts(category_id)
        return success(accounts=accounts, count=len(accounts))
    except Exception as e:
        logger.error(f"Error getting accounts: {e}")
        return api_error(500, str(e))


@patrimoine_bp.route('/api/patrimoine/accounts', methods=['POST'])
def create_account():
    try:
        data = request.get_json()
        if not data or not data.get('name') or not data.get('category_id'):
            return api_error(400, 'name and category_id are required')
        account_id = _service.create_account(data)
        return success(id=account_id, message='Account created', status_code=201)
    except Exception as e:
        logger.error(f"Error creating account: {e}")
        return api_error(500, str(e))


@patrimoine_bp.route('/api/patrimoine/accounts/<int:account_id>', methods=['PUT'])
def update_account(account_id):
    try:
        data = request.get_json()
        if not data:
            return api_error(400, 'No JSON body')
        updated = _service.update_account(account_id, data)
        if not updated:
            return api_error(404, f'Account {account_id} not found')
        return success(message='Account updated')
    except Exception as e:
        logger.error(f"Error updating account: {e}")
        return api_error(500, str(e))


@patrimoine_bp.route('/api/patrimoine/accounts/<int:account_id>', methods=['DELETE'])
def delete_account(account_id):
    try:
        _service.delete_account(account_id)
        return success(message='Account deleted')
    except Exception as e:
        logger.error(f"Error deleting account: {e}")
        return api_error(500, str(e))


# --- Snapshots ---

@patrimoine_bp.route('/api/patrimoine/snapshots')
def get_snapshots():
    try:
        snapshots = _service.get_snapshots()
        return success(snapshots=snapshots, count=len(snapshots))
    except Exception as e:
        logger.error(f"Error getting snapshots: {e}")
        return api_error(500, str(e))


@patrimoine_bp.route('/api/patrimoine/snapshots', methods=['POST'])
def create_snapshot():
    try:
        data = request.get_json()
        if not data or not data.get('snapshot_date'):
            return api_error(400, 'snapshot_date is required')
        snap_id = _service.create_snapshot(data)
        return success(id=snap_id, message='Snapshot created', status_code=201)
    except Exception as e:
        logger.error(f"Error creating snapshot: {e}")
        return api_error(500, str(e))


@patrimoine_bp.route('/api/patrimoine/snapshots/<int:snapshot_id>', methods=['DELETE'])
def delete_snapshot(snapshot_id):
    try:
        _service.delete_snapshot(snapshot_id)
        return success(message='Snapshot deleted')
    except Exception as e:
        logger.error(f"Error deleting snapshot: {e}")
        return api_error(500, str(e))


# --- Balances ---

@patrimoine_bp.route('/api/patrimoine/balances')
def get_balances():
    try:
        snapshot_id = request.args.get('snapshot_id', type=int)
        balances = _service.get_balances(snapshot_id)
        return success(balances=balances, count=len(balances))
    except Exception as e:
        logger.error(f"Error getting balances: {e}")
        return api_error(500, str(e))


@patrimoine_bp.route('/api/patrimoine/balances', methods=['POST'])
def upsert_balance():
    try:
        data = request.get_json()
        if not data:
            return api_error(400, 'No JSON body')
        for field in ('account_id', 'snapshot_id', 'amount'):
            if field not in data:
                return api_error(400, f'{field} is required')
        _service.upsert_balance(data)
        return success(message='Balance saved')
    except Exception as e:
        logger.error(f"Error saving balance: {e}")
        return api_error(500, str(e))


@patrimoine_bp.route('/api/patrimoine/balances/batch', methods=['POST'])
def batch_upsert_balances():
    """Update multiple balances at once"""
    try:
        data = request.get_json()
        if not data or 'balances' not in data:
            return api_error(400, 'balances array is required')
        count = 0
        for bal in data['balances']:
            for field in ('account_id', 'snapshot_id', 'amount'):
                if field not in bal:
                    return api_error(400, f'{field} is required in each balance')
            _service.upsert_balance(bal)
            count += 1
        return success(message=f'{count} balances saved', count=count)
    except Exception as e:
        logger.error(f"Error batch saving balances: {e}")
        return api_error(500, str(e))


# --- Analysis ---

@patrimoine_bp.route('/api/patrimoine/analysis')
def get_analysis():
    try:
        data = _service.get_analysis()
        return success(comparisons=data, count=len(data))
    except Exception as e:
        logger.error(f"Error getting analysis: {e}")
        return api_error(500, str(e))
