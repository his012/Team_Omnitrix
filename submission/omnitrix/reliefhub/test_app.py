"""Business-rule and HTTP API regression tests; uses isolated temporary databases."""
import concurrent.futures
import sqlite3
import tempfile
import unittest
from pathlib import Path

from app import create_app
from seed import main as seed


class ReliefHubTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name) / 'test.db'
        seed(self.path)
        self.app = create_app(self.path)
        self.app.config.update(TESTING=True, SECRET_KEY='test-only')
        self.client = self.app.test_client()
        self.client.post('/api/session', json={'role': 'Admin'})

    def tearDown(self):
        self.temp.cleanup()

    def get(self, table, ident=None):
        return self.client.get('/api/'+table+(f'/{ident}' if ident else '')).get_json()

    def create(self, table, body):
        response = self.client.post('/api/'+table, json=body)
        self.assertEqual(response.status_code, 201, response.get_json())
        return response.get_json()

    def update(self, table, ident, body, expected=200):
        response = self.client.put(f'/api/{table}/{ident}', json=body)
        self.assertEqual(response.status_code, expected, response.get_json())
        return response.get_json()

    def test_seed_counts_and_invariants(self):
        counts = dict(camps=8, inventory=12, needs=20, dispatches=10, donations=10, volunteers=15)
        for table, count in counts.items():
            self.assertEqual(len(self.get(table)), count)
        self.assertGreaterEqual(len({c['district'] for c in self.get('camps')}), 4)
        self.assertTrue(any(c['status'] == 'Full' for c in self.get('camps')))
        self.assertTrue(any(c['status'] == 'Closed' for c in self.get('camps')))
        self.assertGreaterEqual(sum(i['stock'] <= i['reorder_level'] for i in self.get('inventory')), 2)
        self.assertGreaterEqual(sum(n['priority'] == 'High' and n['fulfilled_quantity']/n['required_quantity'] < .4 for n in self.get('needs')), 3)
        for d in self.get('dispatches'):
            self.assertEqual(d['camp_id'], self.get('needs', d['need_id'])['camp_id'])
        for n in self.get('needs'):
            self.assertGreaterEqual(n['open_quantity'], 0)

    def test_pages_and_assets(self):
        for path in ('/', '/static/app.js', '/static/styles.css'):
            with self.client.get(path) as response:
                self.assertEqual(response.status_code, 200)

    def test_camp_crud_and_full_status(self):
        c = self.create('camps', dict(name='Test shelter', district='Dadu', capacity=20, current_families=20, status='Active'))
        self.assertEqual(c['status'], 'Full')
        self.assertEqual(self.update('camps', c['id'], dict(current_families=19))['status'], 'Active')
        self.update('camps', c['id'], dict(capacity=0), 400)
        self.update('camps', c['id'], dict(name='   '), 400)
        self.update('camps', c['id'], dict(current_families=21), 400)
        self.assertEqual(self.update('camps', c['id'], dict(status='Closed'))['status'], 'Closed')
        self.assertEqual(self.client.delete(f'/api/camps/{c["id"]}', json={}).status_code, 200)
        self.assertEqual(self.client.get(f'/api/camps/{c["id"]}').status_code, 404)

    def test_inventory_and_needs_crud(self):
        item = self.create('inventory', dict(name='Soap', category='Hygiene', unit='bar', stock=20, reorder_level=5))
        need = self.create('needs', dict(camp_id=1, inventory_item_id=item['id'], required_quantity=10, priority='High'))
        self.update('inventory', item['id'], dict(stock=30))
        self.update('needs', need['id'], dict(required_quantity=20, priority='Medium'))
        self.assertEqual(self.client.delete(f'/api/inventory/{item["id"]}', json={}).status_code, 409)
        self.update('inventory', item['id'], dict(unit='box'), 409)
        self.assertEqual(self.client.delete(f'/api/needs/{need["id"]}', json={}).status_code, 200)
        self.assertEqual(self.client.delete(f'/api/inventory/{item["id"]}', json={}).status_code, 200)

    def test_reservation_delivery_and_terminal_states(self):
        stock = self.get('inventory', 1)['stock']
        fulfilled = self.get('needs', 1)['fulfilled_quantity']
        d = self.create('dispatches', dict(camp_id=1, need_id=1, quantity=100))
        self.assertEqual(self.get('inventory', 1)['stock'], stock-100)
        self.assertEqual(self.get('needs', 1)['fulfilled_quantity'], fulfilled)
        self.update('dispatches', d['id'], dict(status='In Transit'))
        self.update('dispatches', d['id'], dict(status='Delivered'))
        self.update('dispatches', d['id'], dict(status='Delivered'))
        self.assertEqual(self.get('needs', 1)['fulfilled_quantity'], fulfilled+100)
        self.assertEqual(self.get('inventory', 1)['stock'], stock-100)
        self.update('dispatches', d['id'], dict(status='Cancelled'), 409)
        self.update('dispatches', d['id'], dict(status='Pending'), 409)

    def test_cancel_restores_once(self):
        stock = self.get('inventory', 9)['stock']
        self.update('dispatches', 7, dict(status='Cancelled'))
        self.update('dispatches', 7, dict(status='Cancelled'))
        self.assertEqual(self.get('inventory', 9)['stock'], stock+40)
        self.update('dispatches', 7, dict(status='Delivered'), 409)
        self.update('dispatches', 7, dict(status='In Transit'), 409)

    def test_overdispatch_and_need_edits_rejected(self):
        for body in (dict(camp_id=1, need_id=1, quantity=151), dict(camp_id=3, need_id=7, quantity=81), dict(camp_id=2, need_id=1, quantity=1), dict(camp_id=1, need_id=1, quantity=-1)):
            self.assertEqual(self.client.post('/api/dispatches', json=body).status_code, 400)
        self.update('needs', 1, dict(required_quantity=1849), 400)
        self.assertEqual(self.get('inventory', 1)['stock'], 5000)
        self.assertEqual(len(self.get('dispatches')), 10)

    def test_concurrent_requests_cannot_overreserve(self):
        def reserve():
            with self.app.test_client() as client:
                client.post('/api/session', json={'role':'Admin'})
                return client.post('/api/dispatches', json=dict(camp_id=1, need_id=1, quantity=100)).status_code
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            result = list(pool.map(lambda _: reserve(), range(2)))
        self.assertEqual(sorted(result), [201, 400])
        self.assertEqual(self.get('inventory', 1)['stock'], 4900)

    def test_donation_stock_and_fraction_validation(self):
        before = self.get('inventory', 1)['stock']
        self.create('donations', dict(type='In-Kind', amount_or_quantity=25, item_id=1, donor_name='Local community'))
        self.assertEqual(self.get('inventory', 1)['stock'], before+25)
        self.create('donations', dict(type='Cash', amount_or_quantity=500.50, category='Medical fund', donor_name='Anonymous'))
        self.assertEqual(self.get('inventory', 1)['stock'], before+25)
        for quantity in (0, -1, 1.5, 'NaN', 'Infinity'):
            response = self.client.post('/api/donations', json=dict(type='In-Kind', amount_or_quantity=quantity, item_id=1, donor_name='Test'))
            self.assertEqual(response.status_code, 400)
        self.assertEqual(len(self.get('donations')), 12)

    def test_volunteer_single_assignment_and_closed_camps(self):
        response = self.client.post('/api/volunteers', json=dict(name='Test', skill='Medical', camp_id=8))
        self.assertEqual(response.status_code, 400)
        v = self.create('volunteers', dict(name='Test', skill='Medical', camp_id=1))
        self.update('volunteers', v['id'], dict(camp_id=2), 409)
        self.update('volunteers', v['id'], dict(camp_id=None))
        self.update('volunteers', v['id'], dict(camp_id=8), 400)
        self.update('volunteers', v['id'], dict(camp_id=2))
        self.update('camps', 2, dict(status='Closed'), 409)

    def test_roles_enforced_in_api(self):
        anonymous = self.app.test_client()
        self.assertEqual(anonymous.post('/api/inventory', json={}).status_code, 401)
        self.client.post('/api/session', json={'role':'Field Volunteer'})
        self.assertEqual(self.client.post('/api/dispatches', json={}).status_code, 403)
        self.assertEqual(self.client.post('/api/donations', json={}).status_code, 403)
        self.update('camps', 1, dict(name='Changed'), 403)
        self.update('camps', 1, dict(current_families=151))
        self.update('needs', 1, dict(priority='Medium'))
        self.assertEqual(self.client.delete('/api/needs/1', json={}).status_code, 403)

    def test_invalid_input_and_missing_records(self):
        self.assertEqual(self.client.post('/api/session', json=[]).status_code, 400)
        self.assertEqual(self.client.post('/api/camps', json=[]).status_code, 400)
        self.assertEqual(self.client.post('/api/camps', data={'name':'test'}).status_code, 415)
        self.assertEqual(self.client.get('/api/missing').status_code, 404)
        self.assertEqual(self.client.get('/api/camps/999').status_code, 404)
        self.assertEqual(self.client.post('/api/needs', json=dict(camp_id=1, inventory_item_id=999, required_quantity=1, priority='High')).status_code, 404)

    def test_persistence_and_seed_safety(self):
        self.update('inventory', 1, dict(stock=5100))
        other = create_app(self.path).test_client()
        self.assertEqual(other.get('/api/inventory/1').get_json()['stock'], 5100)
        with self.assertRaises(SystemExit):
            seed(self.path)
        conn = sqlite3.connect(self.path)
        self.assertEqual(conn.execute('PRAGMA integrity_check').fetchone()[0], 'ok')
        conn.close()


if __name__ == '__main__':
    unittest.main(verbosity=2)
