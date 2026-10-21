/* KisanMandi -- zero-build, mobile-first client. All records fetched and mutated via HTTP API. */
'use strict';
const $=sel=>document.querySelector(sel);
const escapeHtml=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const money=(n,d=0)=>'Rs '+Number(n||0).toLocaleString('en-PK',{minimumFractionDigits:d,maximumFractionDigits:d});
const number=n=>Number(n||0).toLocaleString('en-PK');
const cropEmoji={'Wheat':'🌾','Rice':'🍚','Cotton':'☁️','Sugarcane':'🎋','Tomato':'🍅','Onion':'🧅','Mango':'🥭','Red Chilies':'🌶️'};
const glyph={home:'<path d="M3 10L12 3l9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V10Z"/><path d="M9 21v-7h6v7"/>',prices:'<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',marketplace:'<path d="M3 9h18l-2 12H5L3 9Z"/><path d="m1 9 3-6h16l3 6"/><path d="M9 21v-8h6v8"/>',alerts:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 10h18c0-3-3-3-3-10"/><path d="M10 21h4"/>',listings:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',profit:'<circle cx="12" cy="12" r="9"/><path d="M15 8H9a2 2 0 1 0 0 4h6a2 2 0 1 1 0 4H9M12 6v12"/>'};
const svgIcon=(type)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${glyph[type]||glyph.prices}</svg>`;
const storedTheme=(()=>{try{return localStorage.getItem('kisan-theme')==='dark'?'dark':'light'}catch{return 'light'}})();
const storedFaves=(()=>{try{return JSON.parse(localStorage.getItem('kisan-faves')||'[]').filter(Number.isInteger)}catch{return []}})();
const s={view:'home',me:null,users:[],crops:[],markets:[],prices:[],listings:[],alerts:[],health:null,marketId:1,cropId:1,
  priceSearch:'',category:'All',listingCrop:'',listingDistrict:'',listingGrade:'',listingSort:'newest',myStatus:'all',
  profitQty:20,profitCost:1900,profitDelta:0,onboardRole:'Farmer',theme:storedTheme,favorites:new Set(storedFaves),favoriteOnly:false,priceSort:'name',opportunityQty:20,opportunityCosts:{}};

async function api(endpoint,options={}){
  const res=await fetch('/api/'+endpoint,{...options,headers:{'Content-Type':'application/json',...(options.headers||{})},credentials:'same-origin'});
  let data;try{data=await res.json();}catch{throw new Error('Could not read server response');}
  if(!res.ok)throw new Error(typeof data.detail==='string'?data.detail:`Request failed (${res.status})`);
  return data;
}
const json=(method,data)=>({method,body:JSON.stringify(data)});
const meFarmer=()=>s.me&&s.me.role==='Farmer';
const latestDay=()=>s.health?.date||s.prices.reduce((a,p)=>p.date>a?p.date:a,'');
const prevDay=()=>{let d=new Date(latestDay()+'T00:00:00');d.setDate(d.getDate()-1);return d.toISOString().slice(0,10);};
const getPrice=(crop,market,day=latestDay())=>s.prices.find(p=>p.crop_id==crop&&p.market_id==market&&p.date===day)?.price??null;
const getCrop=id=>s.crops.find(c=>c.id==id);
const getMarket=id=>s.markets.find(m=>m.id==id);
const displayCrop=id=>getCrop(id)?.name||'Unknown crop';
const getAvg=crop=>{const x=s.markets.map(m=>getPrice(crop,m.id)).filter(v=>v!==null);return x.length?x.reduce((a,b)=>a+b,0)/x.length:null};
function priceBand(ask,crop){const avg=getAvg(crop);if(avg===null)return {label:'No rate',kind:'gray'};const rel=(ask-avg)/avg;return rel < -.05?{label:'Below market',kind:'green'}:rel > .05?{label:'Above market',kind:'red'}:{label:'At market',kind:'gold'};}
const tag=(value,kind='green')=>`<span class="tag tag-${kind}">${escapeHtml(value)}</span>`;
const selectOptions=(data,current,id='id',label='name',allText)=>`${allText!==undefined?`<option value="">${escapeHtml(allText)}</option>`:''}${data.map(x=>`<option value="${escapeHtml(x[id])}" ${String(current)===String(x[id])?'selected':''}>${escapeHtml(x[label])}</option>`).join('')}`;
const districtOptions=(selected,all=false)=>`${all?'<option value="">All districts</option>':''}${['Hyderabad','Mirpurkhas','Sukkur','Other'].map(x=>`<option ${x===selected?'selected':''}>${x}</option>`).join('')}`;
const titleCase=s=>s?String(s)[0].toUpperCase()+String(s).slice(1):'';

function applyTheme(){document.documentElement.dataset.theme=s.theme;const btn=$('#themeButton');if(btn){btn.innerHTML=s.theme==='dark'?'☀':'☾';btn.setAttribute('aria-label',s.theme==='dark'?'Switch to light theme':'Switch to dark theme');btn.title=s.theme==='dark'?'Use light theme':'Use dark theme';}const meta=document.querySelector('meta[name=theme-color]');if(meta)meta.setAttribute('content',s.theme==='dark'?'#111f18':'#f7f9f5');}
function toggleTheme(){s.theme=s.theme==='dark'?'light':'dark';try{localStorage.setItem('kisan-theme',s.theme)}catch{}applyTheme();toast(s.theme==='dark'?'Dark mode enabled':'Light mode enabled');}
function toggleFavorite(id){if(s.favorites.has(id))s.favorites.delete(id);else s.favorites.add(id);try{localStorage.setItem('kisan-faves',JSON.stringify([...s.favorites]))}catch{}render();toast(s.favorites.has(id)?'Added to your watchlist':'Removed from watchlist');}
async function init(){applyTheme();
 try{
  [s.crops,s.markets,s.users,s.me,s.health,s.prices,s.listings]=await Promise.all([
    api('crops'),api('markets'),api('users'),api('me'),api('health'),api('prices'),api('listings')]);
  s.marketId=s.markets[0]?.id||1;s.cropId=s.crops.find(c=>c.name==='Wheat')?.id||s.crops[0]?.id||1;
  if(meFarmer())s.alerts=await api('alerts');
  render();if(!s.me)showOnboarding();
 }catch(err){$('#content').innerHTML=`<div class="empty-state"><div class="empty-emoji">⚠️</div><h3>Could not connect to local API</h3><p>${escapeHtml(err.message)}</p><p>Start the server using <code>python app.py --port 8001</code> and refresh.</p></div>`;}
}
async function refreshAll(showToast=true){
 try{
  const [health,prices,listings,me]=await Promise.all([api('health'),api('prices'),api('listings'),api('me')]);
  s.health=health;s.prices=prices;s.listings=listings;s.me=me;
  s.alerts=meFarmer()?await api('alerts'):[];
  render();if(showToast)toast('Data refreshed from local HTTP API');
 }catch(err){toast(err.message,true);}
}
function navItems(){const base=[['home','Home'],['prices','Prices'],['marketplace','Marketplace']];return meFarmer()?[...base,['alerts','Alerts'],['listings','My Listings'],['profit','Profit Calculator']]:base;}
function renderShell(){
 const nm=s.me?.name||'Guest',initials=nm.split(' ').slice(0,2).map(t=>t[0]).join('').toUpperCase();
 const label={home:'Overview',prices:'Price Discovery',marketplace:'Marketplace',alerts:'Price Alerts',listings:'My Listings',profit:'Profit Calculator'}[s.view];
 $('#pageTitle').textContent=s.view==='home'?`Good ${new Date().getHours()<12?'morning':'day'}, ${nm.split(' ')[0]}`:label;
 $('#breadcrumb').textContent=label.toUpperCase();$('#avatar').textContent=initials;
 $('#profileName').innerHTML=`${escapeHtml(nm)}<small id="profileRole">${escapeHtml(s.me?.role||'Choose profile')}</small>`;
 $('#todayLabel').textContent=new Date(latestDay()+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
 const triggered=s.alerts.filter(x=>x.triggered).length;
 const navHtml=(mobile=false)=>navItems().map(([id,text])=>`<button class="${mobile?'bottom-link':'nav-link'} ${s.view===id?'active':''}" data-action="nav" data-view="${id}" title="${text}" aria-label="${text}" ${s.view===id?'aria-current="page"':''}>${svgIcon(id)}<span class="nav-text">${text}</span>${id==='alerts'&&triggered?`<span class="nav-count">${triggered}</span>`:''}</button>`).join('');
 $('#nav').innerHTML=navHtml();$('#bottomNav').innerHTML=navHtml(true);
}
function render(){const gs=$('#globalSearch');if(gs&&gs.value!==s.priceSearch)gs.value=s.priceSearch;if(!s.me&&['alerts','listings','profit'].includes(s.view))s.view='home';if(s.me?.role==='Buyer'&&['alerts','listings','profit'].includes(s.view))s.view='home';renderShell();
 $('#content').innerHTML=({home:renderHome,prices:renderPrices,marketplace:renderMarketplace,alerts:renderAlerts,listings:renderMyListings,profit:renderProfit}[s.view]||renderPrices)();
 if(s.view==='profit')updateProfitOutput();
}
function setView(view){if(!navItems().some(n=>n[0]===view))return toast('This feature is available to farmers',true);s.view=view;render();window.scrollTo({top:0,behavior:'smooth'});}
function changeTag(p,prev){if(prev===null||prev===0)return tag('New','gray');const diff=p-prev,percent=100*diff/prev;return `<span class="${diff>=0?'change-up':'change-down'}">${diff>=0?'↗':'↘'} ${diff>0?'+':''}${percent.toFixed(1)}%</span>`;}
const photoSlug={'Wheat':'wheat','Rice':'rice','Cotton':'cotton','Sugarcane':'sugarcane','Tomato':'tomato','Onion':'onion','Mango':'mango','Red Chilies':'red-chilies'};
const cropPhoto=name=>'/static/assets/crops/'+(photoSlug[name]||'wheat')+'.webp';
const cropTone=name=>photoSlug[name]||'wheat';
function miniSpark(cropId,marketId){
 const d=s.prices.filter(p=>p.crop_id===cropId&&p.market_id===marketId).sort((a,b)=>a.date.localeCompare(b.date));
 if(d.length<2)return '';
 const vals=d.map(p=>p.price),min=Math.min(...vals),max=Math.max(...vals),range=Math.max(1,max-min);
 const pts=vals.map((v,i)=>`${(i/(vals.length-1)*100).toFixed(1)},${(36-(v-min)/range*28).toFixed(1)}`).join(' ');
 const good=vals.at(-1)>=vals[0];
 return `<svg class="spark-svg ${good?'up':'down'}" viewBox="0 0 100 42" preserveAspectRatio="none" role="img" aria-label="14-day crop trend"><polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
function cropShowcase(c){
 const p=getPrice(c.id,s.marketId),old=getPrice(c.id,s.marketId,prevDay()),diff=old&&p!==null?(100*(p-old)/old):null;
 const trend=diff===null?'No change data':`${diff>=0?'↗ +':'↘ '}${diff.toFixed(1)}%`;
 return `<article class="showcase-card tone-${cropTone(c.name)} ${s.cropId===c.id?'is-picked':''}" data-action="choose-crop" data-id="${c.id}" tabindex="0" role="button" aria-label="Explore ${escapeHtml(c.name)} rates and trend" title="Explore ${escapeHtml(c.name)} rates and trend">
   <div class="showcase-photo"><img src="${cropPhoto(c.name)}" loading="lazy" alt="Photographic visual of ${escapeHtml(c.name)}"><span class="showcase-tip">VIEW TRENDS <span>↗</span></span><button type="button" class="crop-bookmark ${s.favorites.has(c.id)?'saved':''}" data-action="favorite" data-id="${c.id}" title="${s.favorites.has(c.id)?'Remove from':'Add to'} crop watchlist" aria-label="${s.favorites.has(c.id)?'Remove ':'Save '}${escapeHtml(c.name)} ${s.favorites.has(c.id)?'from':'to'} watchlist" aria-pressed="${s.favorites.has(c.id)}">${s.favorites.has(c.id)?'★':'☆'}</button></div>
   <div class="showcase-info"><div class="crop-name-row"><strong>${escapeHtml(c.name)}</strong><span class="crop-arrow">↗</span></div><span class="crop-price">${p===null?'—':money(p)} <small>/ 40kg</small></span><div class="showcase-bottom"><span class="crop-delta ${diff!==null&&diff<0?'negative':'positive'}">${trend}</span>${miniSpark(c.id,s.marketId)}</div></div>
 </article>`;
}
function renderHome(){
 const active=s.listings.filter(l=>l.status==='active');
 const prices=s.crops.map(c=>getPrice(c.id,s.marketId)).filter(v=>v!==null);
 const avg=prices.length?prices.reduce((a,b)=>a+b,0)/prices.length:0;
 const rising=s.crops.filter(c=>{const p=getPrice(c.id,s.marketId),prev=getPrice(c.id,s.marketId,prevDay());return p!==null&&prev!==null&&p>prev}).length;
 const current=getCrop(s.cropId)||s.crops[0],market=getMarket(s.marketId);
 const listed=active.slice(0,4);
 return `<div class="home-dashboard">
  <section class="home-hero"><div class="home-hero-wash"></div><div class="home-hero-content">
    <div class="hero-kicker"><span class="pulse-dot"></span> EMPOWERING SINDH'S FARMERS</div>
    <h1>Track mandi prices.<br><span>Sell faster. Grow together.</span></h1>
    <p>Compare crops across regional mandis, connect with buyers and plan your next harvest with confidence.</p>
    <div class="hero-buttons"><button class="btn hero-yellow" data-action="nav" data-view="prices">Explore Crop Prices <span>→</span></button><button class="btn hero-outline" data-action="nav" data-view="marketplace">Visit Marketplace ↗</button></div>
  </div><div class="hero-weather"><span class="weather-leaf">✺</span><div><small>MARKET SNAPSHOT</small><strong>${escapeHtml(market?.name||'Sindh')}</strong><span>${escapeHtml(latestDay())} · Demo rates</span></div></div></section>
  <div class="home-stats">
    ${stat('🌿','Tracked Crops',s.crops.length,'Across '+new Set(s.crops.map(c=>c.category)).size+' categories')}
    ${stat('▥','Regional Markets',s.markets.length,'Sindh mandi locations','gold')}
    ${stat('↗','Rising Today',rising,'Above yesterday','blue')}
    ${stat('◎','Available Listings',active.length,'Fresh produce offers','pink')}
    ${stat('Rs','Avg. Mandi Rate',money(avg),'Per 40kg · '+escapeHtml(market?.name||''),'gold')}
  </div>
  <section class="home-block crops-block"><div class="home-section-header"><div><span class="section-overline">FIELD TO MARKET</span><h2>Popular crops <span>today</span></h2><p>Discover rates, movement and 14-day history across Sindh</p></div><div class="home-actions"><label class="filter-label">Market <select id="marketSelect" class="select" aria-label="Choose market">${selectOptions(s.markets,s.marketId)}</select></label><button class="fav-filter ${s.favoriteOnly?'selected':''}" data-action="filter-favorites" aria-pressed="${s.favoriteOnly}" title="Show saved crops">★ My Watchlist <b>${s.favorites.size}</b></button><button class="link-action" data-action="nav" data-view="prices">View all crop prices <span>→</span></button></div></div>
  <div class="showcase-grid">${s.crops.filter(c=>!s.favoriteOnly||s.favorites.has(c.id)).map(cropShowcase).join('')||'<div class="watchlist-empty">No saved crops yet · tap ☆ on any crop to add it here.</div>'}</div></section>
  <div class="home-insights">
    <section class="white-card insight-chart"><div class="insight-top"><div><span class="section-overline">PRICE INTELLIGENCE</span><h3>14-day price trend <span>— ${escapeHtml(current.name)}</span></h3><p>${escapeHtml(market?.name||'Regional market')} · Rs per 40kg</p></div><select class="select" id="homeCropSelect" aria-label="Chart crop">${selectOptions(s.crops,s.cropId)}</select></div>${chart(s.cropId,s.marketId)}${chartStats(s.cropId,s.marketId)}</section>
    <section class="white-card insight-market"><div class="insight-top"><div><span class="section-overline">MARKET COMPARISON</span><h3>Where to sell ${escapeHtml(current.name)}</h3><p>Compare current fictional mandi rates</p></div><span class="green-icon">⌁</span></div>${marketComparison(s.cropId)}<p class="compare-footnote">Rates exclude freight and handling costs</p><button class="btn btn-primary opportunity-open" data-action="opportunity">✦ Market Opportunity Finder →</button></section>
  </div>
  <section class="home-block recent-block"><div class="home-section-header"><div><span class="section-overline">HARVESTS NEAR YOU</span><h2>Fresh from the marketplace</h2><p>Available produce shared by farmers in Sindh</p></div><button class="link-action" data-action="nav" data-view="marketplace">Explore marketplace <span>→</span></button></div>
   <div class="home-listing-grid">${listed.map(l=>`<button class="mini-listing" data-action="detail" data-id="${l.id}"><div class="mini-listing-photo"><img loading="lazy" src="${cropPhoto(l.crop_name)}" alt="${escapeHtml(l.crop_name)} produce"><span class="mini-status">Available</span></div><div class="mini-listing-content"><strong>${escapeHtml(l.crop_name)}</strong><span>${escapeHtml(l.district)} · ${escapeHtml(l.farmer_name)}</span><b>${money(l.asking_price)} <small>/ 40kg</small></b></div></button>`).join('')||'<p>Listings will appear here when farmers post produce.</p>'}</div>
  </section>
  <div class="demo-trust"><span>ⓘ</span> This dashboard demonstrates the product using fictional crop prices and demo contacts; a production deployment requires a verified live mandi data feed.</div>
 </div>`;
}

function renderPrices(){
 const market=getMarket(s.marketId),rows=s.crops.filter(c=>(s.category==='All'||c.category===s.category)&&c.name.toLowerCase().includes(s.priceSearch.toLowerCase()));
 rows.sort((a,b)=>s.priceSort==='high'?getPrice(b.id,s.marketId)-getPrice(a.id,s.marketId):s.priceSort==='low'?getPrice(a.id,s.marketId)-getPrice(b.id,s.marketId):s.priceSort==='rise'?((getPrice(b.id,s.marketId)-getPrice(b.id,s.marketId,prevDay()))-(getPrice(a.id,s.marketId)-getPrice(a.id,s.marketId,prevDay()))):a.name.localeCompare(b.name));
 const categories=['All',...new Set(s.crops.map(c=>c.category))];
 const marketPrices=s.crops.map(c=>getPrice(c.id,s.marketId)).filter(x=>x!==null);
 const mean=marketPrices.length?marketPrices.reduce((a,b)=>a+b,0)/marketPrices.length:0;
 const arrowCount=s.crops.filter(c=>getPrice(c.id,s.marketId)>getPrice(c.id,s.marketId,prevDay())).length;
 return `<section class="hero"><div class="hero-copy"><span class="hero-pill">✦ YOUR AGRICULTURAL ADVANTAGE</span><h1>Grow smarter. Sell better. <em>Prosper together.</em></h1><p>Daily crop insights, fair market comparisons and a direct connection between Sindh's farmers and buyers.</p><button class="btn btn-gold" data-action="nav" data-view="marketplace">Explore marketplace <span>→</span></button></div><img class="hero-art" src="/static/hero.svg" alt="Illustration of Sindh farm produce"></section>
 <div class="stat-grid">
  ${stat('🌱','Tracked Crops',s.crops.length,'Across 5 categories')}
  ${stat('🏛️','Regional Markets',s.markets.length,'Sindh districts','gold')}
  ${stat('📈','Rising Today',arrowCount,'Crops above yesterday','blue')}
  ${stat('💰','Avg. Mandi Rate',money(mean),'Per 40kg (maund)','pink')}
 </div>
 <div class="top-line"><div><div class="eyebrow">MARKET INTELLIGENCE</div><h2 class="section-title">Today's crop prices</h2><div class="description">Prices shown for ${escapeHtml(market?.name||'your market')} · ${escapeHtml(latestDay())}</div></div><div class="toolbar"><label class="filter-label">Market <select id="marketSelect" class="select">${selectOptions(s.markets,s.marketId)}</select></label><button class="btn btn-outline" data-action="download-prices">↓ Download CSV</button><button class="btn btn-outline" data-action="refresh">↻ Refresh</button></div></div>
 <div class="two-col"><section class="white-card"><div class="card-heading"><h3>Crop price watchlist</h3>${tag('HTTP API data','green')}</div><div class="toolbar labeled-filters" style="margin-bottom:13px"><label class="filter-label">Search crops <input type="search" id="cropSearch" class="field" value="${escapeHtml(s.priceSearch)}" placeholder="Search by crop name" aria-label="Search crops"></label><label class="filter-label">Category <select class="select" id="cropCategory" aria-label="Crop category">${categories.map(c=>`<option ${c===s.category?'selected':''}>${escapeHtml(c)}</option>`).join('')}</select></label><label class="filter-label">Sort by <select class="select" id="priceSort"><option value="name" ${s.priceSort==='name'?'selected':''}>Crop name</option><option value="high" ${s.priceSort==='high'?'selected':''}>Highest price</option><option value="low" ${s.priceSort==='low'?'selected':''}>Lowest price</option><option value="rise" ${s.priceSort==='rise'?'selected':''}>Biggest increase</option></select></label></div>
 <div style="overflow-x:auto"><table class="crop-table"><thead><tr><th>Crop</th><th>Today / 40kg</th><th>Yesterday</th><th>Change</th></tr></thead><tbody>${rows.map(c=>{const current=getPrice(c.id,s.marketId),prev=getPrice(c.id,s.marketId,prevDay());return `<tr class="${s.cropId===c.id?'selected-row':''}" data-action="choose-crop" data-id="${c.id}"><td><div class="crop-cell"><div class="crop-emoji"><img loading="lazy" src="${cropPhoto(c.name)}" alt=""></div><div><strong>${escapeHtml(c.name)}</strong><small>${escapeHtml(c.category)}</small></div></div></td><td class="price">${current===null?'—':money(current)}</td><td>${prev===null?'—':money(prev)}</td><td>${current===null?'—':changeTag(current,prev)}</td></tr>`}).join('')||'<tr><td colspan="4">No crops match.</td></tr>'}</tbody></table></div>
 </section><div style="display:grid;gap:17px;align-content:start"><section class="white-card"><div class="card-heading"><div><div class="micro-title">LAST 14 DAYS</div><h3>${escapeHtml(displayCrop(s.cropId))} price trend</h3></div>${tag('14 days','gold')}</div>${chart(s.cropId,s.marketId)}${chartStats(s.cropId,s.marketId)}</section><section class="white-card"><div class="card-heading"><div><div class="micro-title">WHERE TO SELL</div><h3>Compare mandi prices</h3></div></div>${marketComparison(s.cropId)}<div class="nudge" style="margin-top:11px">Higher quoted rates may give better returns before transport and handling costs.</div><button class="btn btn-primary opportunity-open" data-action="opportunity">✦ Compare net earnings</button></section></div></div>
 ${meFarmer()?`<section class="white-card" style="margin-top:19px;display:flex;align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap"><div><div class="eyebrow">PLAN YOUR NEXT MOVE</div><h3 style="margin:7px 0">What would your next harvest earn?</h3><div class="description">Try our interactive profit and scenario calculator.</div></div><button class="btn btn-primary" data-action="nav" data-view="profit">Open profit calculator →</button></section>`:''}`;
}
function stat(emoji,label,value,hint,kind=''){return `<div class="stat-card"><div class="stat-icon ${kind}">${emoji}</div><div class="stat-info"><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong><span>${escapeHtml(hint)}</span></div></div>`;}
function chart(crop,market){const data=s.prices.filter(p=>p.crop_id===crop&&p.market_id===market).sort((a,b)=>a.date.localeCompare(b.date));
 if(!data.length)return '<div class="empty-state">No history yet.</div>';
 const w=500,h=200,pad=28,min=Math.min(...data.map(x=>x.price))*.96,max=Math.max(...data.map(x=>x.price))*1.04;
 const xx=i=>pad+i*(w-pad*2)/Math.max(1,data.length-1), yy=v=>h-pad-(v-min)/(max-min||1)*(h-pad*2);
 const pts=data.map((d,i)=>[xx(i),yy(d.price)]);const line=pts.map(([x,y],i)=>`${i===0?'M':'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
 const area=line+` L${pts[pts.length-1][0]},${h-pad} L${pts[0][0]},${h-pad} Z`;
 return `<div class="chart-wrap"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="14-day price line chart for ${escapeHtml(displayCrop(crop))}">
 <defs><linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8dc79c" stop-opacity=".42"/><stop offset="1" stop-color="#8dc79c" stop-opacity=".015"/></linearGradient></defs>
 ${[0,.33,.66,1].map(fr=>`<line x1="${pad}" y1="${pad+fr*(h-pad*2)}" x2="${w-pad}" y2="${pad+fr*(h-pad*2)}" stroke="#edf1e9" stroke-dasharray="4 6"/>`).join('')}
 <path d="${area}" fill="url(#chartFill)"/><path d="${line}" fill="none" stroke="#4c9a66" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/>
 ${pts.map(([x,y],i)=>i===pts.length-1?`<circle cx="${x}" cy="${y}" r="6" fill="#3c8a55" stroke="white" stroke-width="3"/>`:'').join('')}
 <text x="${pad}" y="${h-3}" fill="#9daa9e" font-size="11">${escapeHtml(data[0].date.slice(5))}</text><text x="${w-pad}" y="${h-3}" text-anchor="end" fill="#9daa9e" font-size="11">${escapeHtml(data.at(-1).date.slice(5))}</text></svg></div>`;
}
function chartStats(crop,market){const nums=s.prices.filter(p=>p.crop_id===crop&&p.market_id===market).map(p=>p.price);if(!nums.length)return '';
 return `<div class="chart-summary"><div><small>Lowest</small><strong>${money(Math.min(...nums))}</strong></div><div><small>Average</small><strong>${money(nums.reduce((a,b)=>a+b,0)/nums.length)}</strong></div><div><small>Highest</small><strong>${money(Math.max(...nums))}</strong></div></div>`;
}
function marketComparison(crop){const arr=s.markets.map(m=>({...m,price:getPrice(crop,m.id)})).sort((a,b)=>(b.price||0)-(a.price||0));return arr.map((m,i)=>`<div class="market-row"><div style="display:flex;align-items:center;gap:10px"><span class="market-rank">0${i+1}</span><div><b>${escapeHtml(m.name)}</b><small>${escapeHtml(m.district)} district</small></div></div><div style="text-align:right"><strong>${m.price===null?'—':money(m.price)}</strong><div>${i===0?tag('Best to sell','green'):''}</div></div></div>`).join('');}
function renderMarketplace(){
 const options=s.listings.filter(l=>l.status==='active').filter(l=>(!s.listingCrop||l.crop_id==s.listingCrop)&&(!s.listingDistrict||l.district===s.listingDistrict)&&(!s.listingGrade||l.grade===s.listingGrade)).sort((a,b)=>s.listingSort==='price'?a.asking_price-b.asking_price:b.id-a.id);
 return `<div class="top-line"><div><div class="eyebrow">CONNECTED AGRICULTURE</div><h2 class="section-title">The produce marketplace</h2><p class="description">Explore harvests directly from Sindh's farmers, without the middlemen.</p></div>${meFarmer()?'<button class="btn btn-primary" data-action="new-listing">＋ Post produce</button>':''}</div>
 <section class="white-card" style="margin-bottom:20px"><div class="toolbar labeled-filters"><label class="filter-label">Crop <select class="select" id="listingCropFilter">${selectOptions(s.crops,s.listingCrop,'id','name','All crops')}</select></label><label class="filter-label">District <select class="select" id="listingDistrictFilter">${districtOptions(s.listingDistrict,true)}</select></label><label class="filter-label">Quality grade <select class="select" id="listingGradeFilter"><option value="">All grades</option>${['A','B','C'].map(g=>`<option value="${g}" ${s.listingGrade===g?'selected':''}>Grade ${g}</option>`).join('')}</select></label><label class="filter-label">Sort listings <select class="select" id="listingSort"><option value="newest" ${s.listingSort==='newest'?'selected':''}>Newest first</option><option value="price" ${s.listingSort==='price'?'selected':''}>Price: low to high</option></select></label><button class="btn btn-light reset-filters" data-action="reset-listing-filters">Reset filters</button></div></section>
 <div class="top-line"><div class="micro-title">AVAILABLE HARVESTS · ${options.length} LISTINGS</div>${tag("Market comparison uses today's 3-market average","gray")}</div>
 ${options.length?`<div class="listing-grid">${options.map(l=>listingCard(l)).join('')}</div>`:empty('🌱','No produce matched your filters','Try another crop, district or grade.')}`;
}
function listingCard(l,owned=false){let band=priceBand(l.asking_price,l.crop_id);return `<article class="listing-card"><div class="listing-art"><img class="listing-photo" loading="lazy" src="${cropPhoto(l.crop_name)}" alt="${escapeHtml(l.crop_name)} produce"><div class="grade">${tag('GRADE '+l.grade,'gold')}</div></div><div class="listing-body"><div class="listing-top"><div><h3>${escapeHtml(l.crop_name)}</h3><p>📍 ${escapeHtml(l.district)} · ${escapeHtml(l.farmer_name)}</p></div>${l.status==='sold'?tag('SOLD','gray'):''}</div><div class="listing-price">${money(l.asking_price)} <small>/ 40kg</small></div><div style="margin-top:9px">${tag(band.label,band.kind)}</div><div class="listing-meta"><span>Quantity <b>${number(l.quantity)} maunds</b></span><span>Available <b>${escapeHtml(l.available_from.slice(5))}</b></span></div><div class="listing-actions"><button class="btn btn-outline btn-sm" data-action="detail" data-id="${l.id}">View details ↗</button>${owned&&l.status==='active'?`<button class="btn btn-light btn-sm" data-action="edit-listing" data-id="${l.id}">Edit</button>`:''}</div></div></article>`;}
function empty(icon,title,desc){return `<div class="empty-state"><div class="empty-emoji">${icon}</div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(desc)}</p></div>`;}
function renderMyListings(){const mine=s.listings.filter(l=>l.user_id===s.me?.id).filter(l=>s.myStatus==='all'||l.status===s.myStatus).sort((a,b)=>b.id-a.id);
 return `<div class="top-line"><div><div class="eyebrow">FARMER'S WORKSPACE</div><h2 class="section-title">Your produce listings</h2><div class="description">Only you can edit, sell, or remove your listings.</div></div><button class="btn btn-primary" data-action="new-listing">＋ Create listing</button></div>
 <div class="top-line"><div class="pill-tabs">${['all','active','sold'].map(x=>`<button data-action="my-status" data-id="${x}" class="${s.myStatus===x?'active':''}">${titleCase(x)}</button>`).join('')}</div><span class="description">${mine.length} results</span></div>
 ${mine.length?`<div class="listing-grid">${mine.map(l=>`<div>${listingCard(l,true)}<div class="toolbar" style="margin:8px 4px 18px">${l.status==='active'?`<button class="btn btn-light btn-sm" data-action="mark-sold" data-id="${l.id}">✓ Mark Sold</button>`:''}<button class="btn btn-red btn-sm" data-action="delete-listing" data-id="${l.id}">Delete</button></div></div>`).join('')}</div>`:empty('🧺','No listings here','Post produce to make your harvest discoverable.')}`;
}
function renderAlerts(){const arr=s.alerts;return `<div class="top-line"><div><div class="eyebrow">STAY AHEAD OF PRICES</div><h2 class="section-title">Your price alerts</h2><div class="description">Alerts are evaluated against today's latest price every time you refresh.</div></div><button class="btn btn-primary" data-action="new-alert">＋ Create alert</button></div>
 <div class="stat-grid">${stat('🔔','Total Alerts',arr.length,'Configured rules')}${stat('🎯','Triggered Now',arr.filter(a=>a.triggered).length,'Targets reached','gold')}${stat('✓','Active Alerts',arr.filter(a=>a.active_status).length,'Currently monitored','blue')}${stat('🪴','Crops Watched',new Set(arr.map(a=>a.crop_id)).size,'Unique crops','pink')}</div>
 ${arr.length?`<div class="alerts-list">${arr.map(a=>`<div class="alert-row"><div class="alert-left"><span class="alert-mark"><img src="${cropPhoto(a.crop_name)}" alt=""></span><div><strong>${escapeHtml(a.crop_name)} · ${escapeHtml(a.market_name)}</strong><small>${escapeHtml(a.condition)} ${money(a.target_price)} · Latest ${money(a.latest_price)}</small><div style="margin-top:7px">${a.triggered?tag('● Target reached','green'):a.active_status?tag('Watching','gold'):tag('Paused','gray')}</div></div></div><div class="alert-actions"><label class="toggle" aria-label="${a.active_status?'Pause':'Activate'} ${escapeHtml(a.crop_name)} alert"><input type="checkbox" data-alert-toggle="${a.id}" ${a.active_status?'checked':''}><span class="toggle-slider"></span></label><button class="btn btn-light btn-sm" data-action="edit-alert" data-id="${a.id}">Edit</button><button class="btn btn-red btn-sm" data-action="delete-alert" data-id="${a.id}">×</button></div></div>`).join('')}</div>`:empty('🔔','No price alerts yet','Choose a crop, market and price target to start.')}`;
}
function renderProfit(){return `<div class="top-line"><div><div class="eyebrow">HARVEST PLANNING</div><h2 class="section-title">Profit & scenario calculator</h2><p class="description">Estimate revenue and costs at current mandi rates—or shift prices to see what changes.</p></div>${tag('Based on fictional mandi prices','gold')}</div>
 <div class="calc-layout"><div class="white-card"><div class="card-heading"><h3>Configure your estimate</h3>${tag('Interactive','green')}</div><div class="form-grid">
 ${group('Select crop',`<select class="select" id="profitCrop">${selectOptions(s.crops,s.cropId)}</select>`)}
 ${group('Select market',`<select class="select" id="profitMarket">${selectOptions(s.markets,s.marketId)}</select>`)}
 ${group('Quantity (40kg units)',`<input id="profitQty" class="field" type="number" min="0.01" step="0.1" value="${s.profitQty}">`)}
 ${group('Production cost / 40kg (Rs)',`<input id="profitCost" class="field" type="number" min="0" step="1" value="${s.profitCost}">`)}
 </div><div class="what-if"><div class="card-heading"><h3>What-if price adjustment</h3><span id="deltaTag">${s.profitDelta>0?'+':''}${s.profitDelta}%</span></div><input id="profitDelta" class="range" type="range" min="-20" max="20" step="1" value="${s.profitDelta}" aria-label="Price change percent"><div class="range-labels"><span>-20% lower</span><span>Current mandi price</span><span>+20% higher</span></div></div>
 <div style="background:#f6faf2;border-radius:11px;padding:13px;margin-top:21px;font-size:11px;color:#6b8a70">ⓘ All values are estimates based on fictional seeded data. Actual income varies by quality, fees, transport and harvest conditions.</div></div>
 <div id="profitOutput"></div></div>`;}
function updateProfitOutput(){const p=getPrice(s.cropId,s.marketId),q=Number(s.profitQty),cost=Number(s.profitCost),d=Number(s.profitDelta);
 const valid=p!==null&&Number.isFinite(q)&&q>0&&Number.isFinite(cost)&&cost>=0;
 const adjusted=valid?p*(1+d/100):0,revenue=adjusted*q,total=cost*q,profit=revenue-total,margin=revenue?profit/revenue*100:0;
 const el=$('#profitOutput');if(!el)return;
 el.innerHTML=`<div class="calc-results"><div><span class="calc-label">PROJECTED NET ${profit>=0?'PROFIT':'LOSS'}</span><div class="calc-amount">${valid?money(profit):'—'}</div><span class="tag ${profit>=0?'tag-green':'tag-red'}">${valid?(profit>=0?'↗ Positive return':'↘ Negative return'):'Enter valid numbers'}</span></div><div style="padding-top:5px"><div class="calc-label">Adjusted mandi selling rate</div><h2 style="font-size:28px;letter-spacing:-1px;margin:3px 0">${valid?money(adjusted,2):'—'} <small style="font-size:12px;color:#bdd6c2">/ 40kg</small></h2><small style="color:#accbb5">Base rate: ${money(p)} ${d>0?'· +':d<0?'· ': '· '}${d}% scenario</small></div><div class="calc-breakdown"><div><span>Projected revenue</span><strong>${valid?money(revenue):'—'}</strong></div><div><span>Total production cost</span><strong>${valid?money(total):'—'}</strong></div><div><span>Profit margin</span><strong class="gold-accent">${valid?margin.toFixed(1)+'%':'—'}</strong></div><div><span>Quantity</span><strong>${valid?number(q)+' maunds':'—'}</strong></div></div></div>`;
 const t=$('#deltaTag');if(t)t.textContent=`${d>0?'+':''}${d}%`;
}
function group(label,control,full=false){
 const match=control.match(/\bid="([^"]+)"/)||control.match(/\bname="([^"]+)"/);const id=match?match[1].replace(/[^a-zA-Z0-9_-]/g,'-'):'field-'+label.toLowerCase().replace(/[^a-z0-9]+/g,'-');
 if(!/\bid="/.test(control))control=control.replace(/<(input|select|textarea)\b/,'<$1 id="'+id+'"');
 return `<div class="form-group ${full?'full':''}"><label for="${escapeHtml(id)}">${escapeHtml(label)}</label>${control}</div>`;
}
function showModal(title,body,wide=false,locked=false){$('#modalRoot').innerHTML=`<div class="modal-backdrop" ${locked?'data-locked="1"':''}><div class="modal ${wide?'wide':''}" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}"><div class="modal-top"><h3>${escapeHtml(title)}</h3>${locked?'':`<button type="button" class="close" data-action="close-modal" aria-label="Close">×</button>`}</div>${body}</div></div>`;}
function closeModal(){if(s.me)$('#modalRoot').innerHTML='';}
function toast(msg,error=false){const root=$('#toastRoot');root.innerHTML=`<div class="toast ${error?'error':''}">${escapeHtml(msg)}</div>`;clearTimeout(toast.timer);toast.timer=setTimeout(()=>root.innerHTML='',3400);}
function showOnboarding(){const selected=s.onboardRole;
 const f=`<div class="onboard-intro"><div class="onboard-logo">🌱</div><h2>Welcome to KisanMandi</h2><p>Discover crop prices, connect with buyers, and grow your agricultural business.</p></div>
 <div class="onboard-switch"><button type="button" data-action="onboard-role" data-role="Farmer" class="${selected==='Farmer'?'selected':''}"><span style="font-size:24px">🌾</span><strong>I'm a Farmer</strong><span class="nudge">Sell produce & set alerts</span></button><button type="button" data-action="onboard-role" data-role="Buyer" class="${selected==='Buyer'?'selected':''}"><span style="font-size:24px">🛒</span><strong>I'm a Buyer</strong><span class="nudge">Browse & compare</span></button></div>
 <form id="onboardForm"><div class="form-grid">${group('Full name',`<input class="field" name="name" placeholder="Your name" required maxlength="90">`)}${group('Phone',`<input class="field" name="phone" placeholder="+92..." required>`)}${group('District',`<select class="select" name="district">${districtOptions('Hyderabad')}</select>`)}</div><input type="hidden" name="role" value="${selected}"><div class="form-error" id="onboardError"></div><button class="btn btn-primary" style="width:100%;margin-top:17px" type="submit">Continue as ${selected} →</button></form>
 <div class="demo-profiles"><h4>OR EXPLORE USING FICTIONAL DEMO PROFILES</h4><button class="btn btn-outline btn-sm" data-action="demo-login" data-id="1">🌾 Try as Farmer</button><button class="btn btn-outline btn-sm" data-action="demo-login" data-id="4">🛒 Try as Buyer</button></div>`;
 showModal('Get started',f,false,true);
}
function showListingForm(existing=null){const isEdit=!!existing;
 const crops=selectOptions(s.crops,existing?.crop_id||s.cropId);
 const value=(key,otherwise='')=>escapeHtml(existing?.[key]??otherwise);
 const today=latestDay();
 showModal(isEdit?'Edit produce listing':'Post your harvest',`<p class="description">${isEdit?'Update the details of your listing.':'Tell buyers what you have and when it will be available.'}</p>
 <form id="listingForm" data-id="${existing?.id||''}"><div class="form-grid">
 ${group('Crop',`<select name="crop_id" class="select" required>${crops}</select>`)}
 ${group('Grade',`<select name="grade" class="select"><option ${value('grade','A')==='A'?'selected':''}>A</option><option ${value('grade')==='B'?'selected':''}>B</option><option ${value('grade')==='C'?'selected':''}>C</option></select>`)}
 ${group('Quantity (40kg units)',`<input class="field" name="quantity" type="number" min="0.01" step="0.01" value="${value('quantity','20')}" required>`)}
 ${group('Asking price per 40kg (Rs)',`<input class="field" name="asking_price" type="number" min="0.01" step="0.01" value="${value('asking_price','3000')}" required>`)}
 ${group('District',`<select name="district" class="select">${districtOptions(value('district',s.me.district))}</select>`)}
 ${group('Available from',`<input class="field" name="available_from" type="date" min="${today}" value="${value('available_from',today)}" required>`)}
 ${group('Contact phone',`<input class="field" name="contact_phone" value="${value('contact_phone',s.me.phone)}" required>`,true)}
 </div><div id="formError" class="form-error"></div><div class="button-row"><button type="button" class="btn btn-outline" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="submit">${isEdit?'Save changes':'Publish listing'} →</button></div></form>`,true);
}
function showAlertForm(existing=null){showModal(existing?'Edit price alert':'Create a price alert',`<p class="description">You will see an in-app alert when the mandi rate reaches your chosen threshold.</p>
 <form id="alertForm" data-id="${existing?.id||''}"><div class="form-grid">
 ${group('Crop',`<select name="crop_id" class="select">${selectOptions(s.crops,existing?.crop_id||s.cropId)}</select>`)}
 ${group('Market',`<select name="market_id" class="select">${selectOptions(s.markets,existing?.market_id||s.marketId)}</select>`)}
 ${group('Notify when price goes',`<select name="condition" class="select"><option ${existing?.condition!=='Below'?'selected':''}>Above</option><option ${existing?.condition==='Below'?'selected':''}>Below</option></select>`)}
 ${group('Target price per 40kg (Rs)',`<input name="target_price" class="field" type="number" min="0.01" step="0.01" value="${existing?.target_price??'3000'}" required>`)}
 </div><div class="form-error" id="formError"></div><div class="button-row"><button type="button" class="btn btn-outline" data-action="close-modal">Cancel</button><button type="submit" class="btn btn-primary">Save alert →</button></div></form>`);}
function showListingDetail(l){const band=priceBand(l.asking_price,l.crop_id);const phone=String(l.contact_phone||'');const digits=phone.replace(/\D/g,'');
 const isDemo=phone.startsWith('+920000');
 showModal(`${l.crop_name} · Produce details`,`<div class="detail-hero"><img src="${cropPhoto(l.crop_name)}" alt="${escapeHtml(l.crop_name)} produce"></div><div style="margin:17px 0 7px;display:flex;justify-content:space-between;align-items:center;gap:8px"><h2 style="font-size:25px;margin:0">${money(l.asking_price)} <small class="nudge">/ 40kg</small></h2>${tag(band.label,band.kind)}</div>
 <div class="detail-grid"><div><small>Farmer</small><strong>${escapeHtml(l.farmer_name)}</strong></div><div><small>District</small><strong>${escapeHtml(l.district)}</strong></div><div><small>Available quantity</small><strong>${number(l.quantity)} maunds</strong></div><div><small>Crop grade</small><strong>Grade ${escapeHtml(l.grade)}</strong></div><div><small>Available from</small><strong>${escapeHtml(l.available_from)}</strong></div><div><small>Contact</small><strong>${escapeHtml(phone)}</strong></div></div>
 ${isDemo?'<p class="nudge" style="margin-top:16px">Demo profile: this contact number is fictional and cannot receive real calls or messages.</p>':''}
 <div class="button-row"><a class="btn btn-outline" href="tel:${escapeHtml(digits)}">☎ Call farmer</a><a class="btn btn-primary" href="https://wa.me/${escapeHtml(digits)}?text=${encodeURIComponent('Hello, I am interested in your '+l.crop_name+' listing on KisanMandi.')}" rel="noopener noreferrer" target="_blank">✉ WhatsApp</a></div>`);}
async function transact(path,options,ok){try{await api(path,options);closeModal();await refreshAll(false);toast(ok);}catch(err){const el=$('#formError')||$('#onboardError');if(el){el.textContent=err.message;el.style.display='block';}else toast(err.message,true);}}


function exportPricesCSV(){
 const rows=[['Crop','Category','Market','District','Date','Price per 40kg PKR','Yesterday PKR','Change PKR','Change %']];
 for(const c of s.crops){const p=getPrice(c.id,s.marketId),old=getPrice(c.id,s.marketId,prevDay());if(p===null)continue;const m=getMarket(s.marketId);rows.push([c.name,c.category,m?.name||'',m?.district||'',latestDay(),p,old??'',old===null?'':p-old,old?(100*(p-old)/old).toFixed(2):'']);}
 const csv='\uFEFF'+rows.map(row=>row.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');
 const link=document.createElement('a');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));link.href=url;link.download='KisanMandi-'+(getMarket(s.marketId)?.district||'prices')+'-'+latestDay()+'.csv';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),500);toast('CSV downloaded: '+getMarket(s.marketId)?.name);
}
function showOpportunity(){
 const body=`<p class="description">Compare your estimated net selling revenue across Sindh markets; enter <b>your own</b> transport cost per 40kg for each route.</p>
 <div class="opportunity-controls">${group('Your crop',`<select class="select" id="oppCrop">${selectOptions(s.crops,s.cropId)}</select>`)}${group('Harvest quantity (40kg units)',`<input id="oppQty" class="field" type="number" min="0.01" step="0.1" value="${escapeHtml(s.opportunityQty)}">`)}</div>
 <div class="opportunity-routes">${s.markets.map(m=>group('Transport cost to '+m.name+' (Rs / 40kg)',`<input class="field opp-cost" type="number" id="oppCost${m.id}" min="0" step="1" value="${escapeHtml(s.opportunityCosts[m.id]??0)}" aria-label="Transport cost per 40kg to ${escapeHtml(m.name)}">`)).join('')}</div><div id="oppResult" aria-live="polite"></div>
 <div class="opportunity-hint">ⓘ Illustrative seeded mandi rates only · no transport cost or travel distance is assumed · values are estimates, not guaranteed profits.</div>`;
 showModal('✦ Market Opportunity Finder',body,true);updateOpportunity();
}
function updateOpportunity(){
 const result=$('#oppResult');if(!result)return;const crop=Number($('#oppCrop').value),qty=Number($('#oppQty').value);s.cropId=crop;s.opportunityQty=$('#oppQty').value;
 const valid=Number.isFinite(qty)&&qty>0&&qty<1000000;
 const data=s.markets.map(m=>{const raw=$('#oppCost'+m.id)?.value;const cost=Number(raw);s.opportunityCosts[m.id]=raw;const price=getPrice(crop,m.id);return {...m,price,cost,net:price===null?null:price-cost,total:(price-cost)*qty};});
 if(!valid||data.some(m=>!Number.isFinite(m.cost)||m.cost<0)){result.innerHTML='<div class="opp-error" role="alert">Enter a valid positive harvest quantity and non-negative transport costs for every market.</div>';return;}
 data.sort((a,b)=>(b.total??-Infinity)-(a.total??-Infinity));const best=data.find(r=>r.price!==null);result.innerHTML=`<div class="opp-winner">🏆 Best estimated net return: <strong>${escapeHtml(best?.name||'Unavailable')} — ${best?money(best.total):'—'}</strong></div><div class="opp-table-wrap"><table class="crop-table opp-table"><thead><tr><th>Market</th><th>Mandi rate</th><th>Freight/40kg</th><th>Net rate/40kg</th><th>Net harvest revenue</th></tr></thead><tbody>${data.map((m,i)=>`<tr><td><strong>${escapeHtml(m.name)}</strong>${i===0?' <span class="tag tag-green">Best</span>':''}</td><td>${money(m.price)}</td><td>${money(m.cost)}</td><td>${money(m.net)}</td><td><b>${money(m.total)}</b></td></tr>`).join('')}</tbody></table></div><button type="button" class="btn btn-outline" data-action="use-best-market" data-id="${best?.id||s.marketId}">View ${escapeHtml(best?.name||'market')} price details →</button>`;
}

document.addEventListener('click',async ev=>{const el=ev.target.closest('[data-action]');if(!el)return;
 const act=el.dataset.action,id=Number(el.dataset.id);const listing=()=>s.listings.find(x=>x.id===id),alert=()=>s.alerts.find(x=>x.id===id);
 try{
  if(act==='nav')setView(el.dataset.view);
  if(act==='favorite'){ev.stopPropagation();toggleFavorite(id);}
  if(act==='filter-favorites'){s.favoriteOnly=!s.favoriteOnly;render();}
  if(act==='download-prices')exportPricesCSV();
  if(act==='opportunity')showOpportunity();
  if(act==='use-best-market'){s.marketId=id;closeModal();setView('prices');}
  if(act==='reset-listing-filters'){s.listingCrop='';s.listingDistrict='';s.listingGrade='';s.listingSort='newest';render();}
  if(act==='refresh')await refreshAll();
  if(act==='choose-crop'){s.cropId=id;render();}
  if(act==='new-listing')showListingForm();
  if(act==='edit-listing'&&listing())showListingForm(listing());
  if(act==='detail'&&listing())showListingDetail(listing());
  if(act==='new-alert')showAlertForm();
  if(act==='edit-alert'&&alert())showAlertForm(alert());
  if(act==='my-status'){s.myStatus=el.dataset.id;render();}
  if(act==='mark-sold'&&listing()&&confirm('Mark this listing as sold?'))await transact('listings/'+id,json('PATCH',{status:'sold'}),'Listing marked as sold');
  if(act==='delete-listing'&&listing()&&confirm('Permanently delete this listing?'))await transact('listings/'+id,{method:'DELETE'},'Listing deleted');
  if(act==='delete-alert'&&alert()&&confirm('Delete this alert?'))await transact('alerts/'+id,{method:'DELETE'},'Alert deleted');
  if(act==='close-modal')closeModal();
  if(act==='onboard-role'){s.onboardRole=el.dataset.role;showOnboarding();}
  if(act==='demo-login'){s.me=await api('session',json('POST',{user_id:id}));closeModal();await refreshAll(false);toast(`Welcome, ${s.me.name}!`);}
 }catch(err){toast(err.message,true);}
});
document.addEventListener('submit',async ev=>{const form=ev.target;if(!['onboardForm','listingForm','alertForm'].includes(form.id))return;ev.preventDefault();
 const o=Object.fromEntries(new FormData(form).entries());
 if(form.id==='onboardForm'){
   try{s.me=await api('users',json('POST',o));closeModal();await refreshAll(false);toast('Profile created! Welcome to KisanMandi.');}
   catch(err){const e=$('#onboardError');e.textContent=err.message;e.style.display='block';}
 }
 if(form.id==='listingForm'){
   o.crop_id=Number(o.crop_id);o.quantity=Number(o.quantity);o.asking_price=Number(o.asking_price);
   const isEdit=!!form.dataset.id;await transact(isEdit?'listings/'+form.dataset.id:'listings',json(isEdit?'PATCH':'POST',o),isEdit?'Listing updated':'Your produce is now listed!');
 }
 if(form.id==='alertForm'){
   o.crop_id=Number(o.crop_id);o.market_id=Number(o.market_id);o.target_price=Number(o.target_price);
   if(!form.dataset.id)o.active_status=true;
   const isEdit=!!form.dataset.id;await transact(isEdit?'alerts/'+form.dataset.id:'alerts',json(isEdit?'PATCH':'POST',o),isEdit?'Alert updated':'Price alert created');
 }
});
document.addEventListener('change',async ev=>{
 const e=ev.target,id=e.id;
 if(id==='marketSelect'){s.marketId=Number(e.value);render();}
 if(id==='cropCategory'){s.category=e.value;render();}
 if(id==='priceSort'){s.priceSort=e.value;render();}
 // oppQty and freight inputs update on input; rebuilding results on blur can swallow the click on 'View best market'.
 if(id==='oppCrop')updateOpportunity();
 if(id==='listingCropFilter'){s.listingCrop=e.value;render();}
 if(id==='listingDistrictFilter'){s.listingDistrict=e.value;render();}
 if(id==='listingGradeFilter'){s.listingGrade=e.value;render();}
 if(id==='listingSort'){s.listingSort=e.value;render();}
 if(e.dataset.alertToggle){try{await api('alerts/'+e.dataset.alertToggle,json('PATCH',{active_status:e.checked}));await refreshAll(false);}catch(err){toast(err.message,true);e.checked=!e.checked;}}
 if(id==='profitCrop'){s.cropId=Number(e.value);updateProfitOutput();}
 if(id==='profitMarket'){s.marketId=Number(e.value);updateProfitOutput();}
});
document.addEventListener('input',ev=>{const e=ev.target;
 if(e.id==='cropSearch'){s.priceSearch=e.value;const pos=e.selectionStart;render();const inp=$('#cropSearch');inp.focus();inp.setSelectionRange(pos,pos);}
 if(e.id==='profitQty'){s.profitQty=e.value;updateProfitOutput();}
 if(e.id==='oppQty'||e.id?.startsWith('oppCost'))updateOpportunity();
 if(e.id==='profitCost'){s.profitCost=e.value;updateProfitOutput();}
 if(e.id==='profitDelta'){s.profitDelta=Number(e.value);updateProfitOutput();}
});
$('#refreshButton').addEventListener('click',()=>refreshAll());
$('#themeButton').addEventListener('click',toggleTheme);
document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('.showcase-card')){e.preventDefault();s.cropId=Number(e.target.dataset.id);render();}});
$('#profileButton').addEventListener('click',()=>{if(confirm('Switch to another demo profile?')){s.me=null;api('logout',json('POST',{})).then(()=>{s.view='home';render();showOnboarding();}).catch(err=>toast(err.message,true));}});
$('#switchProfile').addEventListener('click',()=>$('#profileButton').click());
$('#mobileMenu').addEventListener('click',()=>toast('Use the bottom navigation to switch tabs.'));
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&s.me)closeModal();});
let touchY=0;document.addEventListener('touchstart',e=>{if(window.scrollY<10)touchY=e.touches[0].clientY;else touchY=0;},{passive:true});
document.addEventListener('touchend',e=>{if(touchY>0&&e.changedTouches[0].clientY-touchY>90&&!$('#modalRoot').innerHTML)refreshAll();touchY=0;},{passive:true});
init();

const globalSearch=document.querySelector('#globalSearch');
if(globalSearch)globalSearch.addEventListener('input',e=>{s.priceSearch=e.target.value;const term=e.target.value;if(term.trim()&&s.view!=='prices')s.view='prices';render();const inp=$('#globalSearch');inp.value=term;inp.focus();inp.setSelectionRange(term.length,term.length);});
document.addEventListener('change',e=>{if(e.target.id==='homeCropSelect'){s.cropId=Number(e.target.value);render();}});
