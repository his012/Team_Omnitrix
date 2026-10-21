"""HTTP-level integration tests. Run: python -m unittest discover -s tests -v"""
import unittest
from datetime import date, timedelta
from pathlib import Path
from tempfile import TemporaryDirectory
from fastapi.testclient import TestClient
from app import create_app


class KisanMandiTests(unittest.TestCase):
    def setUp(self):
        self.temp=TemporaryDirectory()
        self.db=Path(self.temp.name)/'test.db'
        self.client=TestClient(create_app(self.db))
        self.today=self.client.get('/api/health').json()['date']

    def tearDown(self):
        self.client.close();self.temp.cleanup()

    def login(self,uid=1):
        r=self.client.post('/api/session',json={'user_id':uid})
        self.assertEqual(r.status_code,200)
        return r.json()

    def listing(self,**overrides):
        data={'crop_id':1,'quantity':15,'asking_price':3000,'district':'Hyderabad',
              'grade':'A','available_from':self.today,'contact_phone':'+920000001011'}
        data.update(overrides)
        return data

    def test_seed_counts_and_health(self):
        h=self.client.get('/api/health').json()
        self.assertTrue(h['ok'])
        self.assertEqual(h['counts'],{'users':6,'crops':8,'markets':3,'prices':336,'listings':12,'alerts':5})

    def test_every_crop_market_has_fourteen_consecutive_days(self):
        prices=self.client.get('/api/prices').json()
        self.assertEqual(len(prices),336)
        for c in range(1,9):
            for m in range(1,4):
                data=[p['date'] for p in prices if p['crop_id']==c and p['market_id']==m]
                self.assertEqual(len(data),14)
                self.assertEqual(sorted(data),[(date.fromisoformat(self.today)-timedelta(days=i)).isoformat() for i in range(13,-1,-1)])

    def test_prices_filter_by_market_crop_and_date(self):
        r=self.client.get('/api/prices',params={'crop_id':1,'market_id':2,'date':self.today})
        self.assertEqual(len(r.json()),1)
        self.assertGreater(r.json()[0]['price'],0)

    def test_root_and_static_assets_available(self):
        for p in ['/','/static/styles.css','/static/app.js','/static/hero.svg']:
            self.assertEqual(self.client.get(p).status_code,200,p)

    def test_farmers_and_buyers_have_correct_roles(self):
        self.assertEqual(self.login(1)['role'],'Farmer')
        self.assertEqual(self.login(4)['role'],'Buyer')

    def test_auth_is_needed_to_create_listing(self):
        self.assertEqual(self.client.post('/api/listings',json=self.listing()).status_code,401)

    def test_buyers_cannot_create_listings_or_alerts(self):
        self.login(4)
        self.assertEqual(self.client.post('/api/listings',json=self.listing()).status_code,403)
        self.assertEqual(self.client.post('/api/alerts',json={'crop_id':1,'market_id':1,'condition':'Above','target_price':2000,'active_status':True}).status_code,403)
        self.assertEqual(self.client.get('/api/alerts').status_code,403)

    def test_post_listing_edit_sold_delete(self):
        self.login(1)
        created=self.client.post('/api/listings',json=self.listing())
        self.assertEqual(created.status_code,201,created.text)
        lid=created.json()['id']
        self.assertEqual(self.client.patch(f'/api/listings/{lid}',json={'asking_price':3600}).json()['asking_price'],3600)
        self.assertEqual(self.client.patch(f'/api/listings/{lid}',json={'status':'sold'}).json()['status'],'sold')
        self.assertEqual(self.client.patch(f'/api/listings/{lid}',json={'status':'active'}).status_code,422)
        self.assertEqual(self.client.delete(f'/api/listings/{lid}').status_code,200)
        self.assertEqual(self.client.get(f'/api/listings/{lid}').status_code,404)

    def test_quantity_and_asking_price_positive(self):
        self.login(1)
        for field,val in [('quantity',0),('quantity',-1),('asking_price',0),('asking_price',-100)]:
            self.assertEqual(self.client.post('/api/listings',json=self.listing(**{field:val})).status_code,422)

    def test_grade_and_crop_validation(self):
        self.login(1)
        for bad in [{'grade':'D'},{'crop_id':999}]:
            self.assertEqual(self.client.post('/api/listings',json=self.listing(**bad)).status_code,422)

    def test_available_from_cannot_be_in_past(self):
        self.login(1)
        yesterday=(date.fromisoformat(self.today)-timedelta(days=1)).isoformat()
        self.assertEqual(self.client.post('/api/listings',json=self.listing(available_from=yesterday)).status_code,422)

    def test_cannot_edit_or_delete_another_farmers_listing(self):
        self.login(1)
        my_id=self.client.post('/api/listings',json=self.listing()).json()['id']
        self.login(2)
        self.assertEqual(self.client.patch(f'/api/listings/{my_id}',json={'asking_price':1}).status_code,403)
        self.assertEqual(self.client.delete(f'/api/listings/{my_id}').status_code,403)
        self.assertEqual(self.client.get(f'/api/listings/{my_id}').json()['asking_price'],3000)

    def test_owner_cannot_be_changed_by_patch(self):
        self.login(1)
        lid=self.client.post('/api/listings',json=self.listing()).json()['id']
        self.assertEqual(self.client.patch(f'/api/listings/{lid}',json={'user_id':3}).status_code,422)

    def test_alert_above_equality_is_triggered(self):
        self.login(1)
        price=self.client.get('/api/prices',params={'crop_id':1,'market_id':1,'date':self.today}).json()[0]['price']
        r=self.client.post('/api/alerts',json={'crop_id':1,'market_id':1,'condition':'Above','target_price':price,'active_status':True})
        self.assertEqual(r.status_code,201)
        a=next(a for a in self.client.get('/api/alerts').json() if a['id']==r.json()['id'])
        self.assertTrue(a['triggered'])

    def test_alert_below_equality_is_triggered(self):
        self.login(1)
        price=self.client.get('/api/prices',params={'crop_id':1,'market_id':1,'date':self.today}).json()[0]['price']
        r=self.client.post('/api/alerts',json={'crop_id':1,'market_id':1,'condition':'Below','target_price':price,'active_status':True})
        a=next(a for a in self.client.get('/api/alerts').json() if a['id']==r.json()['id'])
        self.assertTrue(a['triggered'])

    def test_alert_pause_edit_delete(self):
        self.login(1)
        new=self.client.post('/api/alerts',json={'crop_id':1,'market_id':1,'condition':'Above','target_price':1,'active_status':True}).json()['id']
        self.assertTrue(next(a for a in self.client.get('/api/alerts').json() if a['id']==new)['triggered'])
        self.assertEqual(self.client.patch(f'/api/alerts/{new}',json={'active_status':False}).status_code,200)
        self.assertFalse(next(a for a in self.client.get('/api/alerts').json() if a['id']==new)['triggered'])
        self.assertEqual(self.client.delete(f'/api/alerts/{new}').status_code,200)
        self.assertNotIn(new,[a['id'] for a in self.client.get('/api/alerts').json()])

    def test_alert_cross_owner_mutation_rejected(self):
        self.login(1)
        aid=self.client.get('/api/alerts').json()[0]['id']
        self.login(2)
        self.assertEqual(self.client.patch(f'/api/alerts/{aid}',json={'active_status':False}).status_code,403)
        self.assertEqual(self.client.delete(f'/api/alerts/{aid}').status_code,403)

    def test_create_user_first_launch_and_persistence(self):
        r=self.client.post('/api/users',json={'name':'Test Farmer','phone':'+920000000888','district':'Hyderabad','role':'Farmer'})
        self.assertEqual(r.status_code,201)
        self.assertEqual(self.client.get('/api/me').json()['name'],'Test Farmer')
        other=TestClient(create_app(self.db))
        self.assertEqual(other.get('/api/health').json()['counts']['users'],7)
        other.close()

    def test_unsafe_user_fields_are_not_mutable_in_listings(self):
        self.login(1)
        self.assertEqual(self.client.post('/api/listings',json=self.listing(user_id=2)).json()['user_id'],1)

    def test_marketplace_filters_and_sort(self):
        r=self.client.get('/api/listings',params={'status':'active','district':'Hyderabad','sort':'price'})
        data=r.json()
        self.assertTrue(all(x['status']=='active' and x['district']=='Hyderabad' for x in data))
        self.assertEqual([x['asking_price'] for x in data],sorted(x['asking_price'] for x in data))


if __name__=='__main__':unittest.main()
