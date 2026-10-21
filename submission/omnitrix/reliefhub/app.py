"""Local ReliefHub mock HTTP API. All mutations are SQLite transactions."""
import os
import secrets
import sqlite3
from pathlib import Path

from flask import Flask, g, jsonify, request, session
from werkzeug.exceptions import HTTPException

ROOT = Path(__file__).resolve().parent
COLLECTIONS = ('camps', 'inventory', 'needs', 'dispatches', 'donations', 'volunteers')
SKILLS = ('Medical', 'Logistics', 'Cooking', 'Driving', 'Counselling')


def create_app(database=None):
    app = Flask(__name__, static_folder='static')
    app.config.update(SECRET_KEY=os.environ.get('RELIEFHUB_SECRET') or secrets.token_hex(32),
                      DATABASE=str(database or ROOT / 'reliefhub.db'),
                      SESSION_COOKIE_HTTPONLY=True, SESSION_COOKIE_SAMESITE='Strict')

    def db():
        if 'db' not in g:
            g.db = sqlite3.connect(app.config['DATABASE'], timeout=15)
            g.db.row_factory = sqlite3.Row
            g.db.execute('PRAGMA foreign_keys=ON')
        return g.db

    @app.teardown_appcontext
    def close(_error):
        conn = g.pop('db', None)
        if conn:
            conn.close()

    def rows(sql, args=()):
        return [dict(r) for r in db().execute(sql, args).fetchall()]

    def fail(message, status=400):
        from werkzeug.exceptions import abort
        abort(status, description=message)

    def record(table, ident):
        result = rows(f'SELECT * FROM {table} WHERE id=?', (ident,))
        if not result:
            fail('Record not found.', 404)
        return result[0]

    def text(data, key):
        value = data.get(key)
        if not isinstance(value, str) or not value.strip() or len(value.strip()) > 120:
            fail(f'{key.replace("_", " ").title()} is required (maximum 120 characters).')
        return value.strip()

    def number(data, key, minimum=0, integer=True):
        import math
        try:
            raw = data[key]
            if isinstance(raw, bool):
                raise ValueError()
            value = float(raw)
            if not math.isfinite(value) or value < minimum or value > 1_000_000_000:
                raise ValueError()
            if integer and not value.is_integer():
                raise ValueError()
            return int(value) if integer else round(value, 2)
        except (KeyError, TypeError, ValueError, OverflowError):
            fail(f'{key.replace("_", " ").title()} must be a valid {"whole number" if integer else "number"} of at least {minimum}.')

    def choice(data, key, options):
        value = data.get(key)
        if value not in options:
            fail(f'Choose a valid {key}.')
        return value

    def reserved(need_id):
        return rows("SELECT COALESCE(SUM(quantity),0) AS n FROM dispatches WHERE need_id=? AND status IN ('Pending','In Transit')", (need_id,))[0]['n']

    def save(table, data, ident=None):
        if ident is None:
            cur = db().execute(f'INSERT INTO {table} ({",".join(data)}) VALUES ({",".join("?" for _ in data)})', tuple(data.values()))
            ident = cur.lastrowid
        else:
            db().execute(f'UPDATE {table} SET {",".join(k+"=?" for k in data)} WHERE id=?', (*data.values(), ident))
        return record(table, ident)

    @app.errorhandler(HTTPException)
    def http_error(error):
        if 'db' in g:
            g.db.rollback()
        return jsonify(error=error.description), error.code

    @app.errorhandler(sqlite3.IntegrityError)
    def integrity_error(_error):
        db().rollback()
        return jsonify(error='This record is still linked to other records, or its values are invalid.'), 409

    @app.before_request
    def permissions():
        if request.path.startswith('/api/') and request.method != 'GET':
            # Same-origin JSON requests prevent cross-site form submissions.
            if not request.is_json:
                fail('Send application/json.', 415)
            if request.path == '/api/session':
                return
            role = session.get('role')
            if not role:
                fail('Choose a demo role first.', 401)
            if role != 'Admin':
                allowed = (request.path.startswith('/api/needs') and request.method in ('POST', 'PUT')) or (request.path.startswith('/api/camps/') and request.method == 'PUT')
                if not allowed:
                    fail('Only a Relief Coordinator can perform this action.', 403)

    @app.route('/api/session', methods=['GET', 'POST'])
    def role_session():
        if request.method == 'POST':
            data = request.get_json()
            if not isinstance(data, dict):
                fail('Expected a JSON object.')
            session['role'] = choice(data, 'role', ('Admin', 'Field Volunteer'))
        return jsonify(role=session.get('role'))

    @app.get('/')
    def index():
        return app.send_static_file('index.html')

    @app.get('/api/<table>')
    def collection(table):
        if table not in COLLECTIONS:
            fail('Collection not found.', 404)
        result = rows(f'SELECT * FROM {table} ORDER BY id')
        if table == 'needs':
            for need in result:
                need['reserved_quantity'] = reserved(need['id'])
                need['open_quantity'] = need['required_quantity'] - need['fulfilled_quantity'] - need['reserved_quantity']
        return jsonify(result)

    @app.get('/api/<table>/<int:ident>')
    def get_record(table, ident):
        if table not in COLLECTIONS:
            fail('Collection not found.', 404)
        return jsonify(record(table, ident))

    @app.route('/api/<table>', methods=['POST'])
    @app.route('/api/<table>/<int:ident>', methods=['PUT', 'DELETE'])
    def mutate(table, ident=None):
        if table not in COLLECTIONS:
            fail('Collection not found.', 404)
        data = request.get_json()
        if not isinstance(data, dict):
            fail('Expected a JSON object.')
        # Acquire the write lock BEFORE checking available stock and reservations.
        db().execute('BEGIN IMMEDIATE')
        old = record(table, ident) if ident is not None else None
        if request.method == 'DELETE':
            if table not in ('camps', 'inventory', 'needs', 'volunteers'):
                fail('Keep donation and dispatch history; cancel an undelivered dispatch instead.', 409)
            if table == 'camps' and (rows('SELECT id FROM needs WHERE camp_id=?', (ident,)) or rows('SELECT id FROM volunteers WHERE camp_id=?', (ident,))):
                fail('Remove camp needs and unassign volunteers before deleting this camp.', 409)
            db().execute(f'DELETE FROM {table} WHERE id=?', (ident,))
            db().commit()
            return jsonify(ok=True)

        merged = {**(old or {}), **data}
        if table == 'camps':
            if session['role'] == 'Field Volunteer':
                if set(data) - {'current_families'}:
                    fail('Field volunteers may update family counts only.', 403)
            capacity = number(merged, 'capacity', 1)
            families = number(merged, 'current_families')
            if families > capacity:
                fail('Families cannot exceed camp capacity.')
            status = choice(merged, 'status', ('Active', 'Full', 'Closed'))
            status = 'Closed' if status == 'Closed' else ('Full' if families == capacity else 'Active')
            if status == 'Closed':
                if rows('SELECT id FROM volunteers WHERE camp_id=?', (ident,)):
                    fail('Unassign volunteers before closing this camp.', 409)
                if rows("SELECT id FROM dispatches WHERE camp_id=? AND status IN ('Pending','In Transit')", (ident,)):
                    fail('Complete or cancel outstanding dispatches before closing this camp.', 409)
            clean = dict(name=text(merged, 'name'), district=text(merged, 'district'), capacity=capacity, current_families=families, status=status)
        elif table == 'inventory':
            clean = {key: text(merged, key) for key in ('name', 'category', 'unit')}
            clean.update(stock=number(merged, 'stock'), reorder_level=number(merged, 'reorder_level'))
            if old and old['unit'] != clean['unit'] and (rows('SELECT id FROM needs WHERE inventory_item_id=?', (ident,)) or rows('SELECT id FROM donations WHERE item_id=?', (ident,))):
                fail('Cannot change units while this item has needs or donation history.', 409)
        elif table == 'needs':
            camp_id = number(merged, 'camp_id', 1)
            item_id = number(merged, 'inventory_item_id', 1)
            camp = record('camps', camp_id)
            record('inventory', item_id)
            if camp['status'] == 'Closed':
                fail('Reopen this camp before changing its needs.')
            if old and (old['camp_id'] != camp_id or old['inventory_item_id'] != item_id):
                fail('A need cannot be moved to a different camp or inventory item.')
            required = number(merged, 'required_quantity', 1)
            fulfilled = old['fulfilled_quantity'] if old else 0
            if required < fulfilled + (reserved(ident) if old else 0):
                fail('Required quantity cannot be below fulfilled plus reserved quantity.')
            clean = dict(camp_id=camp_id, inventory_item_id=item_id, required_quantity=required, priority=choice(merged, 'priority', ('High', 'Medium', 'Low')), fulfilled_quantity=fulfilled)
        elif table == 'dispatches':
            if old:
                if set(data) != {'status'}:
                    fail('Only dispatch status can be changed.')
                status = choice(data, 'status', ('Pending', 'In Transit', 'Delivered', 'Cancelled'))
                transitions = {'Pending': ('In Transit', 'Delivered', 'Cancelled'), 'In Transit': ('Delivered', 'Cancelled'), 'Delivered': (), 'Cancelled': ()}
                if status != old['status']:
                    if status not in transitions[old['status']]:
                        fail('This dispatch transition is not allowed.', 409)
                    need = record('needs', old['need_id'])
                    if status == 'Delivered':
                        db().execute('UPDATE needs SET fulfilled_quantity=fulfilled_quantity+? WHERE id=?', (old['quantity'], need['id']))
                    if status == 'Cancelled':
                        db().execute('UPDATE inventory SET stock=stock+? WHERE id=?', (old['quantity'], need['inventory_item_id']))
                clean = dict(status=status)
            else:
                need = record('needs', number(data, 'need_id', 1))
                camp = record('camps', number(data, 'camp_id', 1))
                if camp['id'] != need['camp_id'] or camp['status'] == 'Closed':
                    fail('Select an open camp and one of its needs.')
                item = record('inventory', need['inventory_item_id'])
                quantity = number(data, 'quantity', 1)
                remaining = need['required_quantity'] - need['fulfilled_quantity'] - reserved(need['id'])
                if quantity > item['stock']:
                    fail(f'Only {item["stock"]} {item["unit"]} available in the warehouse.')
                if quantity > remaining:
                    fail(f'Only {remaining} {item["unit"]} remain unreserved for this need.')
                clean = dict(camp_id=camp['id'], need_id=need['id'], quantity=quantity, status='Pending')
                db().execute('UPDATE inventory SET stock=stock-? WHERE id=?', (quantity, item['id']))
        elif table == 'donations':
            if old:
                fail('Donation records are immutable to preserve stock history.', 409)
            kind = choice(data, 'type', ('Cash', 'In-Kind'))
            amount = number(data, 'amount_or_quantity', 1 if kind == 'In-Kind' else 0.01, integer=kind == 'In-Kind')
            item = record('inventory', number(data, 'item_id', 1)) if kind == 'In-Kind' else None
            clean = dict(type=kind, amount_or_quantity=amount, item_id=item['id'] if item else None, category=item['category'] if item else text(data, 'category'), donor_name=text(data, 'donor_name'))
            if item:
                db().execute('UPDATE inventory SET stock=stock+? WHERE id=?', (amount, item['id']))
        else:
            camp_id = merged.get('camp_id')
            if camp_id not in (None, ''):
                camp_id = number(merged, 'camp_id', 1)
                if record('camps', camp_id)['status'] == 'Closed':
                    fail('Volunteers cannot be assigned to a Closed camp.')
                if old and old['camp_id'] and old['camp_id'] != camp_id:
                    fail('Unassign this volunteer before assigning another camp.', 409)
            else:
                camp_id = None
            clean = dict(name=text(merged, 'name'), skill=choice(merged, 'skill', SKILLS), camp_id=camp_id)

        result = save(table, clean, ident)
        db().commit()
        return jsonify(result), 200 if old else 201

    return app


if __name__ == '__main__':
    import argparse
    from seed import main as seed
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=5050)
    args = parser.parse_args()
    if not (ROOT / 'reliefhub.db').exists():
        seed()
    create_app().run(host='127.0.0.1', port=args.port, debug=False)

def _vercel_app():
    if os.environ.get("VERCEL"):
        import tempfile
        import uuid
        from seed import main as seed_database

        demo_db = Path(tempfile.gettempdir()) / f"reliefhub-{uuid.uuid4().hex}.db"
        seed_database(str(demo_db))
        return create_app(database=str(demo_db))

    return create_app()

app = _vercel_app()
