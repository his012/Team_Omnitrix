"""KisanMandi recovery build: Python HTTP mock API + SQLite, fictional demo data."""
from __future__ import annotations

import argparse
import hashlib
import hmac
import os
import sqlite3
from contextlib import contextmanager
from datetime import date, timedelta, timezone, datetime
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Request, Response, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

BASE_DIR = Path(__file__).resolve().parent
DB_DEFAULT = BASE_DIR / 'kisanmandi.db'
PUBLIC_DEMO = os.getenv('KISAN_PUBLIC_DEMO') == '1'
if PUBLIC_DEMO and not os.getenv('KISAN_SESSION_SECRET'):
    raise RuntimeError('Set a strong KISAN_SESSION_SECRET before hosting a public demo')
DEMO_SECRET = os.getenv('KISAN_SESSION_SECRET') or 'local-hackathon-demo-only-change-in-production'
PKT = timezone(timedelta(hours=5))  # Pakistan has no daylight-saving changes
TODAY = lambda: datetime.now(PKT).date()


def connection(db_path: Path):
    con = sqlite3.connect(db_path, timeout=15)
    con.row_factory = sqlite3.Row
    con.execute('PRAGMA foreign_keys=ON')
    return con


@contextmanager
def db_session(db_path):
    con = connection(db_path)
    try:
        yield con
        con.commit()
    except Exception:
        con.rollback()
        raise
    finally:
        con.close()


def rows(con, sql, params=()):
    return [dict(r) for r in con.execute(sql, params).fetchall()]


def record(con, sql, params=()):
    r = con.execute(sql, params).fetchone()
    return dict(r) if r else None


def seed_database(db_path: Path):
    db_path.parent.mkdir(parents=True, exist_ok=True)
    with db_session(db_path) as con:
        con.executescript('''
            CREATE TABLE IF NOT EXISTS users (
              id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
              phone TEXT NOT NULL, district TEXT NOT NULL,
              role TEXT NOT NULL CHECK(role IN ('Farmer','Buyer')),
              is_demo INTEGER NOT NULL DEFAULT 0);
            CREATE TABLE IF NOT EXISTS crops (
              id INTEGER PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS markets (
              id INTEGER PRIMARY KEY, name TEXT NOT NULL, district TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS prices (
              id INTEGER PRIMARY KEY AUTOINCREMENT, crop_id INTEGER NOT NULL REFERENCES crops(id),
              market_id INTEGER NOT NULL REFERENCES markets(id), date TEXT NOT NULL,
              price REAL NOT NULL CHECK(price > 0), UNIQUE(crop_id, market_id, date));
            CREATE TABLE IF NOT EXISTS listings (
              id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id),
              crop_id INTEGER NOT NULL REFERENCES crops(id), quantity REAL NOT NULL CHECK(quantity>0),
              asking_price REAL NOT NULL CHECK(asking_price>0), district TEXT NOT NULL,
              grade TEXT NOT NULL CHECK(grade IN ('A','B','C')),
              available_from TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active'
              CHECK(status IN ('active','sold')), contact_phone TEXT NOT NULL,
              created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
            CREATE TABLE IF NOT EXISTS alerts (
              id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id),
              crop_id INTEGER NOT NULL REFERENCES crops(id), market_id INTEGER NOT NULL REFERENCES markets(id),
              condition TEXT NOT NULL CHECK(condition IN ('Above','Below')),
              target_price REAL NOT NULL CHECK(target_price>0),
              active_status INTEGER NOT NULL DEFAULT 1);
        ''')
        if con.execute('SELECT COUNT(*) FROM crops').fetchone()[0]:
            sync_demo_price_dates(con)
            return
        crops = [(1,'Wheat','Grains',2950),(2,'Rice','Grains',5200),
                 (3,'Cotton','Fiber',7600),(4,'Sugarcane','Cash crops',540),
                 (5,'Tomato','Vegetables',1700),(6,'Onion','Vegetables',2400),
                 (7,'Mango','Fruits',4100),(8,'Red Chilies','Spices',6800)]
        markets = [(1,'Hyderabad Mandi','Hyderabad'),
                   (2,'Mirpurkhas Mandi','Mirpurkhas'),
                   (3,'Sukkur Mandi','Sukkur')]
        con.executemany('INSERT INTO crops(id,name,category) VALUES(?,?,?)', [c[:3] for c in crops])
        con.executemany('INSERT INTO markets(id,name,district) VALUES(?,?,?)', markets)
        users = [('Ali Raza','+920000001011','Hyderabad','Farmer',1),
                 ('Sana Baloch','+920000001012','Mirpurkhas','Farmer',1),
                 ('Hamza Memon','+920000001013','Sukkur','Farmer',1),
                 ('Ayesha Khan','+920000001014','Hyderabad','Buyer',1),
                 ('Danish Soomro','+920000001015','Mirpurkhas','Buyer',1),
                 ('Nida Shaikh','+920000001016','Sukkur','Farmer',1)]
        con.executemany('INSERT INTO users(name,phone,district,role,is_demo) VALUES(?,?,?,?,?)',users)
        anchor = TODAY()
        # 8 crops x 3 markets x 14 consecutive dates = 336 exactly.
        for crop_id, name, category, base in crops:
            for market_id, _, _ in markets:
                for day_idx in range(14):
                    day = anchor-timedelta(days=13-day_idx)
                    fluctuation = ((day_idx*7+crop_id*3+market_id*5)%13 - 6)/100
                    market_mod = [0,-0.035,0.065][market_id-1]
                    price = round(base*(1+fluctuation+market_mod))
                    con.execute('INSERT INTO prices(crop_id,market_id,date,price) VALUES(?,?,?,?)',
                                (crop_id,market_id,day.isoformat(),price))
        for i in range(12):
            uid = [1,2,3,6][i%4]
            crop_id = (i%8)+1
            base = crops[crop_id-1][3]
            con.execute('''INSERT INTO listings(user_id,crop_id,quantity,asking_price,district,grade,available_from,status,contact_phone,created_at)
                           VALUES(?,?,?,?,?,?,?,?,?,?)''',
                        (uid,crop_id,12+i*4,round(base*(0.95+(i%5)*.025)),
                         ['Hyderabad','Mirpurkhas','Sukkur'][i%3],['A','B','C'][i%3],
                         (anchor+timedelta(days=i%4)).isoformat(),
                         'sold' if i in (3,8) else 'active', users[uid-1][1],
                         (anchor-timedelta(days=12-i)).isoformat()+' 09:00:00'))
        recent = {(r['crop_id'],r['market_id']):r['price'] for r in rows(con,'SELECT crop_id,market_id,price FROM prices WHERE date=?',(anchor.isoformat(),))}
        alerts = [(1,1,1,'Above',recent[(1,1)],1),
                  (1,2,2,'Below',recent[(2,2)],1),
                  (1,3,3,'Above',recent[(3,3)]+2000,1),
                  (2,4,1,'Below',recent[(4,1)]-90,1),
                  (3,5,2,'Above',recent[(5,2)]-50,0)]
        con.executemany('INSERT INTO alerts(user_id,crop_id,market_id,condition,target_price,active_status) VALUES(?,?,?,?,?,?)',alerts)



def sync_demo_price_dates(con):
    """Keep the fictional 14-day price window current without touching listings/alerts."""
    today = TODAY()
    last_str = con.execute('SELECT MAX(date) FROM prices').fetchone()[0]
    if last_str and last_str >= today.isoformat():
        return
    beginning = today - timedelta(days=13)
    first_missing = max(beginning, date.fromisoformat(last_str) + timedelta(days=1)) if last_str else beginning
    base_prices = {1:2950, 2:5200, 3:7600, 4:540, 5:1700, 6:2400, 7:4100, 8:6800}
    crop_ids = [r['id'] for r in rows(con, 'SELECT id FROM crops')]
    market_ids = [r['id'] for r in rows(con, 'SELECT id FROM markets')]
    for delta in range((today - first_missing).days + 1):
        day = first_missing + timedelta(days=delta)
        for cid in crop_ids:
            for mid in market_ids:
                prior = con.execute('SELECT price FROM prices WHERE crop_id=? AND market_id=? ORDER BY date DESC LIMIT 1', (cid, mid)).fetchone()
                base = prior[0] if prior else base_prices.get(cid, 1000)
                fluctuation = ((day.toordinal() + cid*3 + mid*5) % 9 - 4) / 200
                price = max(1, round(base * (1 + fluctuation)))
                con.execute('INSERT OR IGNORE INTO prices(crop_id,market_id,date,price) VALUES(?,?,?,?)', (cid, mid, day.isoformat(), price))
    con.execute('DELETE FROM prices WHERE date < ?', (beginning.isoformat(),))


def text_field(value: Any, label: str, max_len=90):
    s = str(value or '').strip()
    if not s or len(s) > max_len:
        raise HTTPException(422, f'{label} must be 1–{max_len} characters')
    return s


def phone_field(value):
    p = ''.join(ch for ch in str(value or '') if ch.isdigit() or ch=='+')
    if not (9 <= len(p.lstrip('+')) <= 15):
        raise HTTPException(422,'Enter a phone number containing 9–15 digits')
    return p


def positive(value, label):
    try:
        num = float(value)
        if not (num > 0) or not __import__('math').isfinite(num): raise ValueError()
    except (TypeError,ValueError):
        raise HTTPException(422,f'{label} must be greater than zero')
    return round(num,2)


def valid_date(value):
    try: d = date.fromisoformat(str(value))
    except ValueError: raise HTTPException(422,'Use YYYY-MM-DD date')
    if d < TODAY(): raise HTTPException(422,'Available-from date cannot be in the past')
    return d.isoformat()


def require_ref(con, table, identity):
    try: i = int(identity)
    except (ValueError,TypeError): raise HTTPException(422,f'Invalid {table} id')
    if not record(con,f'SELECT id FROM {table} WHERE id=?',(i,)):
        raise HTTPException(422,f'Unknown {table} id')
    return i


def sign_session(uid):
    payload = str(uid)
    sig = hmac.new(DEMO_SECRET.encode(),payload.encode(),hashlib.sha256).hexdigest()
    return payload+'.'+sig


def session_uid(request: Request):
    token = request.cookies.get('km_session','')
    try:
        raw,sig = token.split('.',1)
        expected = hmac.new(DEMO_SECRET.encode(),raw.encode(),hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig,expected): return None
        return int(raw)
    except (TypeError,ValueError): return None


def actor(request, con, farmer=False):
    uid=session_uid(request)
    user=record(con,'SELECT * FROM users WHERE id=?',(uid,)) if uid else None
    if not user: raise HTTPException(401,'Choose or create a profile to continue')
    if farmer and user['role']!='Farmer': raise HTTPException(403,'Only farmers can manage this content')
    return user


def set_session(response: Response, user_id):
    response.set_cookie('km_session',sign_session(user_id),httponly=True,samesite='lax',secure=PUBLIC_DEMO,max_age=60*60*24*30,path='/')


def listing_values(data, con, *, old=None):
    result = {}
    for key in ('crop_id','quantity','asking_price','district','grade','available_from','contact_phone'):
        val = data.get(key,old.get(key) if old else None)
        if key=='crop_id': result[key]=require_ref(con,'crops',val)
        elif key in ('quantity','asking_price'): result[key]=positive(val,key)
        elif key=='district': result[key]=text_field(val,'District',55)
        elif key=='grade':
            if val not in ('A','B','C'): raise HTTPException(422,'Grade must be A, B or C')
            result[key]=val
        elif key=='available_from': result[key]=valid_date(val)
        elif key=='contact_phone': result[key]=phone_field(val)
    return result


def alert_values(data, con, old=None):
    result={}
    for key in ('crop_id','market_id','condition','target_price','active_status'):
        val=data.get(key,old.get(key) if old else None)
        if key in ('crop_id','market_id'): result[key]=require_ref(con,'crops' if key=='crop_id' else 'markets',val)
        elif key=='condition':
            if val not in ('Above','Below'): raise HTTPException(422,'Condition must be Above or Below')
            result[key]=val
        elif key=='target_price': result[key]=positive(val,'Target price')
        elif key=='active_status':
            if val not in (True,False,0,1):raise HTTPException(422,'Active must be true or false')
            result[key]=int(bool(val))
    return result


def create_app(db_path: str | Path = DB_DEFAULT):
    path=Path(db_path)
    seed_database(path)
    app=FastAPI(title='KisanMandi Demo API',description='Fictional local data; six HTTP mock API collections')
    app.mount('/static',StaticFiles(directory=BASE_DIR/'static'),name='static')

    @app.get('/')
    def index(): return FileResponse(BASE_DIR/'static'/'index.html')

    @app.get('/api/health')
    def health():
        with db_session(path) as con:
            sync_demo_price_dates(con)
            return {'ok':True,'demo':True,'date':TODAY().isoformat(),
                    'counts':{t:con.execute(f'SELECT COUNT(*) FROM {t}').fetchone()[0]
                              for t in ['users','crops','markets','prices','listings','alerts']}}

    @app.get('/api/me')
    def me(request:Request):
        with db_session(path) as con:
            uid=session_uid(request)
            return record(con,'SELECT * FROM users WHERE id=?',(uid,)) if uid else None

    @app.post('/api/session')
    async def start_demo(request:Request,response:Response):
        data=await request.json()
        with db_session(path) as con:
            u=record(con,'SELECT * FROM users WHERE id=? AND is_demo=1',(data.get('user_id'),))
            if not u: raise HTTPException(404,'Demo profile not found')
            set_session(response,u['id'])
            return u

    @app.post('/api/logout')
    def logout(response:Response):
        response.delete_cookie('km_session',path='/')
        return {'ok':True}

    @app.get('/api/users')
    def get_users():
        with db_session(path) as con:
            return rows(con,'SELECT * FROM users WHERE is_demo=1 ORDER BY id')

    @app.post('/api/users',status_code=201)
    async def add_user(request:Request,response:Response):
        data=await request.json()
        role=data.get('role')
        if role not in ('Farmer','Buyer'):raise HTTPException(422,'Role must be Farmer or Buyer')
        vals=(text_field(data.get('name'),'Name'), phone_field(data.get('phone')),
              text_field(data.get('district'),'District',55),role)
        with db_session(path) as con:
            cur=con.execute('INSERT INTO users(name,phone,district,role) VALUES(?,?,?,?)',vals)
            user=record(con,'SELECT * FROM users WHERE id=?',(cur.lastrowid,))
            set_session(response,user['id'])
            return user

    @app.get('/api/crops')
    def get_crops():
        with db_session(path) as con: return rows(con,'SELECT * FROM crops ORDER BY name')

    @app.get('/api/markets')
    def get_markets():
        with db_session(path) as con: return rows(con,'SELECT * FROM markets ORDER BY id')

    @app.get('/api/prices')
    def get_prices(crop_id:int|None=None,market_id:int|None=None,date:str|None=None,
                   start:str|None=None,end:str|None=None):
        q='SELECT * FROM prices WHERE 1=1'; params=[]
        for key,val in [('crop_id',crop_id),('market_id',market_id),('date',date)]:
            if val is not None:q+=f' AND {key}=?';params.append(val)
        if start:q+=' AND date>=?';params.append(start)
        if end:q+=' AND date<=?';params.append(end)
        q+=' ORDER BY date ASC, crop_id ASC, market_id ASC'
        with db_session(path) as con:
            sync_demo_price_dates(con)
            return rows(con,q,params)

    LISTING_QUERY='''SELECT l.*,c.name AS crop_name,c.category,
          u.name AS farmer_name FROM listings l JOIN crops c ON c.id=l.crop_id
          JOIN users u ON u.id=l.user_id WHERE 1=1'''

    @app.get('/api/listings')
    def get_listings(status:str|None=None,crop_id:int|None=None,district:str|None=None,
                     grade:str|None=None,user_id:int|None=None,sort:str='newest'):
        q=LISTING_QUERY;params=[]
        for key,val in [('status',status),('crop_id',crop_id),('district',district),('grade',grade),('user_id',user_id)]:
            if val is not None: q+=f' AND l.{key}=?';params.append(val)
        q+=' ORDER BY l.asking_price ASC,l.id DESC' if sort=='price' else ' ORDER BY l.created_at DESC,l.id DESC'
        with db_session(path) as con: return rows(con,q,params)

    @app.get('/api/listings/{listing_id}')
    def get_listing(listing_id:int):
        with db_session(path) as con:
            x=record(con,LISTING_QUERY+' AND l.id=?',(listing_id,))
            if not x: raise HTTPException(404,'Listing not found')
            return x

    @app.post('/api/listings',status_code=201)
    async def post_listing(request:Request):
        data=await request.json()
        with db_session(path) as con:
            u=actor(request,con,farmer=True)
            vals=listing_values(data,con)
            cur=con.execute('''INSERT INTO listings(user_id,crop_id,quantity,asking_price,district,grade,available_from,contact_phone)
                VALUES(?,?,?,?,?,?,?,?)''',
                (u['id'],)*(1)+tuple(vals[k] for k in ('crop_id','quantity','asking_price','district','grade','available_from','contact_phone')))
            return record(con,LISTING_QUERY+' AND l.id=?',(cur.lastrowid,))

    @app.patch('/api/listings/{listing_id}')
    async def patch_listing(listing_id:int,request:Request):
        data=await request.json()
        with db_session(path) as con:
            u=actor(request,con,farmer=True)
            old=record(con,'SELECT * FROM listings WHERE id=?',(listing_id,))
            if not old:raise HTTPException(404,'Listing not found')
            if old['user_id']!=u['id']:raise HTTPException(403,'You can edit only your own listings')
            if old['status']=='sold' and data.get('status')!='sold':
                raise HTTPException(422,'Sold listings cannot be reactivated')
            if set(data)-set(('crop_id','quantity','asking_price','district','grade','available_from','contact_phone','status')):
                raise HTTPException(422,'Unknown listing field')
            if 'status' in data and data['status']!='sold':raise HTTPException(422,'Only Sold transition is supported')
            if any(k!='status' for k in data):
                vals=listing_values(data,con,old=old)
                con.execute('''UPDATE listings SET crop_id=?,quantity=?,asking_price=?,district=?,grade=?,available_from=?,contact_phone=?
                    WHERE id=?''',tuple(vals[k] for k in ('crop_id','quantity','asking_price','district','grade','available_from','contact_phone'))+(listing_id,))
            if data.get('status')=='sold':con.execute("UPDATE listings SET status='sold' WHERE id=?",(listing_id,))
            return record(con,LISTING_QUERY+' AND l.id=?',(listing_id,))

    @app.delete('/api/listings/{listing_id}')
    def delete_listing(listing_id:int,request:Request):
        with db_session(path) as con:
            u=actor(request,con,farmer=True)
            old=record(con,'SELECT * FROM listings WHERE id=?',(listing_id,))
            if not old:raise HTTPException(404,'Listing not found')
            if old['user_id']!=u['id']:raise HTTPException(403,'You can delete only your own listings')
            con.execute('DELETE FROM listings WHERE id=?',(listing_id,))
            return {'ok':True}

    ALERT_QUERY='''SELECT a.*,c.name AS crop_name,m.name AS market_name,
        (SELECT p.price FROM prices p WHERE p.crop_id=a.crop_id AND p.market_id=a.market_id ORDER BY p.date DESC LIMIT 1) AS latest_price
        FROM alerts a JOIN crops c ON c.id=a.crop_id JOIN markets m ON m.id=a.market_id WHERE a.user_id=?'''

    @app.get('/api/alerts')
    def get_alerts(request:Request):
        with db_session(path) as con:
            u=actor(request,con,farmer=True)
            items=rows(con,ALERT_QUERY+' ORDER BY a.id DESC',(u['id'],))
            for a in items:
                a['triggered']=bool(a['active_status'] and a['latest_price'] is not None and
                   ((a['condition']=='Above' and a['latest_price']>=a['target_price']) or
                    (a['condition']=='Below' and a['latest_price']<=a['target_price'])))
            return items

    @app.post('/api/alerts',status_code=201)
    async def post_alert(request:Request):
        data=await request.json()
        with db_session(path) as con:
            u=actor(request,con,farmer=True); v=alert_values(data,con)
            cur=con.execute('INSERT INTO alerts(user_id,crop_id,market_id,condition,target_price,active_status) VALUES(?,?,?,?,?,?)',
                 (u['id'],)*(1)+tuple(v[k] for k in ('crop_id','market_id','condition','target_price','active_status')))
            return {'id':cur.lastrowid,'ok':True}

    @app.patch('/api/alerts/{alert_id}')
    async def patch_alert(alert_id:int,request:Request):
        data=await request.json()
        with db_session(path) as con:
            u=actor(request,con,farmer=True)
            old=record(con,'SELECT * FROM alerts WHERE id=?',(alert_id,))
            if not old:raise HTTPException(404,'Alert not found')
            if old['user_id']!=u['id']:raise HTTPException(403,'You can edit only your own alerts')
            if set(data)-set(('crop_id','market_id','condition','target_price','active_status')):
                raise HTTPException(422,'Unknown alert field')
            v=alert_values(data,con,old)
            con.execute('UPDATE alerts SET crop_id=?,market_id=?,condition=?,target_price=?,active_status=? WHERE id=?',
                 tuple(v[k] for k in ('crop_id','market_id','condition','target_price','active_status'))+(alert_id,))
            return {'ok':True}

    @app.delete('/api/alerts/{alert_id}')
    def delete_alert(alert_id:int,request:Request):
        with db_session(path) as con:
            u=actor(request,con,farmer=True)
            old=record(con,'SELECT * FROM alerts WHERE id=?',(alert_id,))
            if not old:raise HTTPException(404,'Alert not found')
            if old['user_id']!=u['id']:raise HTTPException(403,'You can delete only your own alerts')
            con.execute('DELETE FROM alerts WHERE id=?',(alert_id,))
            return {'ok':True}

    return app


app=create_app(Path(os.getenv('KISAN_DB',str(DB_DEFAULT))))

if __name__=='__main__':
    import uvicorn
    parser=argparse.ArgumentParser()
    parser.add_argument('--port',type=int,default=8001)
    parser.add_argument('--host',default='127.0.0.1')
    a=parser.parse_args()
    uvicorn.run(app,host=a.host,port=a.port,log_level='info')
