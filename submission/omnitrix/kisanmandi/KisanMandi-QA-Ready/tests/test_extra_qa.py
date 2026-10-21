"""QA regressions: signed sessions, rolling demo prices and persistent writes."""
import sqlite3
from contextlib import closing
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from datetime import date, timedelta
from fastapi.testclient import TestClient
from app import create_app, seed_database

class AdditionalQATests(unittest.TestCase):
    def setUp(self):
        self.tmp = TemporaryDirectory()
        self.path = Path(self.tmp.name) / 'qa.db'
        self.client = TestClient(create_app(self.path))

    def tearDown(self):
        self.client.close()
        self.tmp.cleanup()

    def test_invalid_cookie_cannot_edit_others(self):
        self.client.cookies.set('km_session', '1.forged')
        response = self.client.patch('/api/listings/1', json={'asking_price': 1})
        self.assertEqual(response.status_code, 401)

    def test_auth_cookie_is_httponly_samesite(self):
        response = self.client.post('/api/session', json={'user_id': 1})
        cookie = response.headers.get('set-cookie', '').lower()
        self.assertIn('httponly', cookie)
        self.assertIn('samesite=lax', cookie)

    def test_day_rollover_keeps_336_recent_records(self):
        original = self.client.get('/api/health').json()['date']
        with closing(sqlite3.connect(self.path)) as con:
            old_dates = [r[0] for r in con.execute('SELECT DISTINCT date FROM prices ORDER BY date')]
            # Shift the entire fictional 14-day window one day into the past.
            for d in old_dates:
                earlier = (date.fromisoformat(d) - timedelta(days=1)).isoformat()
                con.execute('UPDATE prices SET date=? WHERE date=?', (earlier, d))
            con.commit()
        # HTTP health/prices reads should roll it forward without touching user data.
        health = self.client.get('/api/health').json()
        self.assertEqual(health['counts']['prices'], 336)
        self.assertEqual(len(self.client.get('/api/prices', params={'date': original}).json()), 24)
        self.assertEqual(len({r['date'] for r in self.client.get('/api/prices').json()}), 14)

    def test_restarting_database_keeps_user_alert_and_listing(self):
        self.client.post('/api/session', json={'user_id': 1})
        dt = self.client.get('/api/health').json()['date']
        created = self.client.post('/api/listings', json={
            'crop_id': 5, 'quantity': 10, 'asking_price': 2500,
            'district': 'Hyderabad', 'grade': 'A',
            'available_from': dt, 'contact_phone': '+920000001011'
        })
        self.assertEqual(created.status_code, 201)
        lid = created.json()['id']
        with TestClient(create_app(self.path)) as second:
            item = second.get(f'/api/listings/{lid}')
            self.assertEqual(item.status_code, 200)
            self.assertEqual(item.json()['asking_price'], 2500)

    def test_all_local_produce_photos_are_served(self):
        for name in ['tomato', 'onion', 'mango', 'red-chilies', 'sugarcane', 'wheat', 'rice', 'cotton']:
            self.assertEqual(self.client.get(f'/static/assets/crops/{name}.webp').status_code, 200, name)
        self.assertEqual(self.client.get('/static/assets/farm-hero.webp').status_code, 200)

if __name__ == '__main__':
    unittest.main()
