'use strict';
const collections = ['camps', 'inventory', 'needs', 'dispatches', 'donations', 'volunteers'];
let data = {}, role = 'Admin', filters = {}, editor = null, loading = false;
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = value => Number(value || 0).toLocaleString('en-PK', {maximumFractionDigits:2});
const pct = need => need.required_quantity ? 100 * need.fulfilled_quantity / need.required_quantity : 0;
const sum = (list, key) => list.reduce((n, row) => n + row[key], 0);
const find = (table, id) => data[table].find(row => row.id === Number(id)) || {};
const admin = () => role === 'Admin';
const pageInfo = () => {const [page='dashboard', id] = location.hash.slice(1).split('/'); return {page,id:Number(id)};};
const nav = [['dashboard','01','Overview'],['camps','02','Relief camps'],['inventory','03','Warehouse'],['dispatches','04','Dispatches'],['donations','05','Donations'],['volunteers','06','Volunteers']];
const badge = value => `<span class="badge ${['Active','Delivered','Available'].includes(value)?'green':['High','Low Stock'].includes(value)?'red':['Full','Pending','Medium'].includes(value)?'amber':['In Transit','Low'].includes(value)?'blue':''}">${esc(value)}</span>`;
const action = (label, act, table, id='', extra='') => `<button class="button small ${extra}" data-action="${act}" data-table="${table}" data-id="${id}">${label}</button>`;
const newButton = (label, table, id='') => admin() || table==='needs' ? action(`＋ ${label}`,'new',table,id) : '';
const empty = label => `<div class="empty"><div class="empty-marker">NO RECORDS TO SHOW</div><strong>${esc(label)}</strong>${filters.search||filters.filter?'Try a broader search or reset your filters.<br><button class="button secondary" data-action="clear-filters">Reset filters</button>':'Records will appear here as your team adds them.'}</div>`;
const heading = (title, description, button='') => `<div class="page-heading"><div><div class="eyebrow">SINDH FLOOD RESPONSE</div><h1>${title}</h1><p class="subtitle">${description}</p></div>${button}</div>`;
const progress = value => `<div class="mini-progress"><div class="track"><div class="fill" style="width:${Math.min(100,Math.max(0,value))}%"></div></div><span>${value.toFixed(0)}%</span></div>`;
const table = (heads, body) => `<div class="panel"><div class="table-wrap"><table><thead><tr>${heads.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div></div>`;
const toolbar = (placeholder, options=[], label='Filter') => `<div class="toolbar"><label class="toolbar-label">Search<input class="search" id="search" aria-label="Search records" placeholder="${placeholder}" value="${esc(filters.search||'')}"></label>${options.length?`<label class="toolbar-label">${label}<select id="filter" aria-label="${label}"><option value="">All ${label.toLowerCase()}</option>${options.map(o=>`<option ${filters.filter===o?'selected':''}>${esc(o)}</option>`).join('')}</select></label>`:''}${filters.search||filters.filter?'<button class="button secondary" data-action="clear-filters">Reset filters</button>':''}</div>`;
const matches = (value, status) => String(value).toLowerCase().includes((filters.search||'').toLowerCase()) && (!filters.filter || status===filters.filter);

async function api(path, method='GET', body) {
  const response = await fetch('/api/'+path, {method, headers:body?{'Content-Type':'application/json'}:{}, body:body?JSON.stringify(body):undefined});
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Request failed. Please try again.');
  return result;
}
function toast(message) {$('#toast').textContent=message; $('#toast').classList.add('show'); clearTimeout(toast.timer); toast.timer=setTimeout(()=>$('#toast').classList.remove('show'),4500);}
async function refresh() {
  if (loading) return;
  loading=true; $('#connection').textContent='Syncing…'; $('#content').setAttribute('aria-busy','true'); $('#refresh').disabled=true;
  try {
    const result = await Promise.all(collections.map(name=>api(name)));
    data=Object.fromEntries(collections.map((name,i)=>[name,result[i]]));
    $('#connection').textContent='Synced '+new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}); render();
  } catch(error) {
    $('#connection').textContent='Offline';
    if (!data.camps) $('#content').innerHTML=`<div class="panel error-panel"><h2>Could not connect</h2><p>${esc(error.message)}</p><button class="button" data-action="retry">Try again</button></div>`;
    else toast(error.message);
  } finally { loading=false; $('#content').setAttribute('aria-busy','false'); $('#refresh').disabled=false; }
}
function render() {
  if (!data.camps) return;
  const {page,id}=pageInfo();
  $('#navigation').innerHTML=nav.map(([key,icon,label])=>`<a href="#${key}" class="${page===key?'active':''}" ${page===key?'aria-current="page"':''}><span class="nav-icon" aria-hidden="true">${icon}</span>${label}${key==='camps'?`<span class="nav-count">${data.camps.length}</span>`:''}</a>`).join('');
  $('#breadcrumb').textContent=nav.find(x=>x[0]===page)?.[2]||{terms:'Terms of use',privacy:'Privacy policy',guide:'Workspace guide'}[page]||'Overview';
  const views={dashboard, camps:()=>id?campDetail(id):camps(), inventory, dispatches, donations, volunteers,terms:()=>documentPage('terms'),privacy:()=>documentPage('privacy'),guide:()=>documentPage('guide')};
  $('#content').innerHTML=(views[page]||dashboard)();
  if(page==='dashboard'||!views[page]){const gaps=$('#critical-gaps');if(gaps)$('#content .kpis').after(gaps);}
  document.querySelectorAll('main table').forEach(t=>{const headings=[...t.querySelectorAll('th')].map(h=>h.textContent||'Actions');t.querySelectorAll('tbody tr').forEach(row=>[...row.cells].forEach((cell,i)=>{cell.dataset.label=headings[i];cell.innerHTML=`<div class="cell-value">${cell.innerHTML}</div>`;}));});
  document.title=($('#breadcrumb').textContent)+' | ReliefHub';
}
function dashboard() {
  const open=data.camps.filter(c=>c.status!=='Closed');
  const critical=data.needs.filter(n=>n.priority==='High'&&pct(n)<40).sort((a,b)=>pct(a)-pct(b));
  const fulfilment=data.needs.length?data.needs.reduce((total,need)=>total+pct(need),0)/data.needs.length:0;
  const low=data.inventory.filter(i=>i.stock<=i.reorder_level).length;
  const stats=[['Active camps',open.length,'⌂','Including full camps'],['Families sheltered',sum(open,'current_families'),'♧','Across '+new Set(open.map(c=>c.district)).size+' districts'],['Overall fulfilment',fulfilment.toFixed(1)+'%','◴','Mean of individual need percentages'],['Low-stock items',low,'▤','At or below reorder level'],['Volunteers deployed',data.volunteers.filter(v=>v.camp_id).length,'♡','Supporting communities']];
  // Average individual percentages avoids adding incompatible units (kg, bottles, boxes).
  const categories=[...new Set(data.inventory.map(i=>i.category))];
  return heading('Relief overview','A shared view of relief efforts. Get the right help to the right people.',admin()?action('＋ Create dispatch','new','dispatches'):'')+
    (critical.length?`<div class="banner"><span class="symbol">ATTENTION</span><div><strong>${critical.length} critical needs require your attention.</strong> High-priority needs are below 40% fulfilment.</div><a href="#critical-gaps" data-action="gaps">Review gaps &nbsp; →</a></div>`:'')+
    `<div class="kpis">${stats.map(([label,value,icon,note],i)=>`<div class="kpi"><span class="kpi-label">${label}</span><span class="kpi-icon" aria-hidden="true">${icon}</span><div class="kpi-number">${typeof value==='number'?fmt(value):value}</div><div class="kpi-note ${i===3&&low?'warn':''}">${note}</div></div>`).join('')}</div>`+
    `<div class="dashboard-grid"><section class="panel"><div class="panel-head"><div><h2>Relief coverage</h2><p>Fulfilment by supply category</p></div><span class="badge green">All camps</span></div><div class="chart" role="img" aria-label="Bar chart of average need fulfilment by category">${categories.map(cat=>{const needs=data.needs.filter(n=>find('inventory',n.inventory_item_id).category===cat); const value=needs.length?needs.reduce((s,n)=>s+pct(n),0)/needs.length:0;return `<div class="chart-row"><span>${esc(cat)}</span><div class="track"><div class="fill" style="width:${value}%"></div></div><strong>${value.toFixed(0)}%</strong></div>`;}).join('')}<div class="chart-scale"><span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span></div><div class="legend"><i></i>Average need fulfilment · each need weighted equally</div></div></section><section class="panel"><div class="panel-head"><div><h2>Recent dispatches</h2><p>Following supplies from warehouse to community</p></div><a class="text-link" href="#dispatches">View all →</a></div><div class="dispatch-preview">${data.dispatches.slice(-4).reverse().map(d=>`<div class="dispatch-row"><span class="dispatch-icon">DSP</span><div class="dispatch-copy"><strong>${esc(find('camps',d.camp_id).name)}</strong><small>${fmt(d.quantity)} ${esc(find('inventory',find('needs',d.need_id).inventory_item_id).unit)} · ${esc(find('inventory',find('needs',d.need_id).inventory_item_id).name)}</small></div>${badge(d.status)}</div>`).join('')||empty('No dispatches yet.')}</div></section></div>`+
    `<section class="panel" id="critical-gaps"><div class="panel-head"><div><h2>Critical gaps <span class="badge red">${critical.length} needs</span></h2><p>High-priority needs below 40% fulfilment, most underserved first</p></div><a class="text-link" href="#camps">Explore camps →</a></div>${critical.length?`<div class="table-wrap"><table><thead><tr><th>Relief camp</th><th>Essential supply</th><th>Priority</th><th>Fulfilment</th><th>Remaining</th><th></th></tr></thead><tbody>${critical.map(n=>{const c=find('camps',n.camp_id),i=find('inventory',n.inventory_item_id);return `<tr><td><strong>${esc(c.name)}</strong><small>${esc(c.district)}, Sindh</small></td><td>${esc(i.name)}</td><td>${badge('High')}</td><td>${progress(pct(n))}</td><td>${fmt(n.required_quantity-n.fulfilled_quantity)} ${esc(i.unit)}</td><td><a class="text-link" href="#camps/${c.id}">View camp ↗</a></td></tr>`;}).join('')}</tbody></table></div>`:empty('No critical gaps. Communities are receiving support.')}<div class="panel-foot"><span>Prioritize these needs in your next dispatch.</span><span>Updated from live workspace</span></div></section>`;
}
function camps() {
  const list=data.camps.filter(c=>matches(c.name+' '+c.district,c.status));
  return heading('Relief camps','Find a shelter, review its needs and keep occupancy up to date.',newButton('Add camp','camps'))+toolbar('Camp name or district…',['Active','Full','Closed'],'Statuses')+`<p class="result-note">${list.length} OF ${data.camps.length} CAMPS</p>`+(list.length?table(['Camp / district','Families','Occupancy','Status','Actions'],list.map(c=>`<tr><td><a class="text-link" href="#camps/${c.id}">${esc(c.name)}</a><small>${esc(c.district)}, Sindh</small></td><td>${fmt(c.current_families)} / ${fmt(c.capacity)}</td><td>${progress(100*c.current_families/c.capacity)}</td><td>${badge(c.status)}</td><td><div class="actions"><a class="button small secondary" href="#camps/${c.id}">View needs</a>${action('Edit','edit','camps',c.id,'secondary')}</div></td></tr>`).join('')):empty('No camps found.'));
}
function campDetail(id) {
  const c=find('camps',id); if (!c.id) return empty('Camp not found.');
  const needs=data.needs.filter(n=>n.camp_id===id), vols=data.volunteers.filter(v=>v.camp_id===id);
  return `<a class="back" href="#camps">← All relief camps</a>`+heading(esc(c.name),`${esc(c.district)}, Sindh · ${c.current_families} of ${c.capacity} family spaces occupied`, `<div class="actions">${action('Edit camp','edit','camps',id,'secondary')}${admin()?action('Delete','delete','camps',id,'danger'):''}</div>`)+
    `<div class="summary-strip"><div class="summary-chip"><small>Camp status</small><strong>${badge(c.status)}</strong></div><div class="summary-chip"><small>Needs registered</small><strong>${needs.length}</strong></div><div class="summary-chip"><small>Volunteers deployed</small><strong>${vols.length}</strong></div></div><div class="page-heading"><h2>Camp needs</h2>${c.status!=='Closed'?newButton('Add need','needs',id):''}</div>`+
    (needs.length?table(['Supply','Priority','Fulfilment','Reserved','Unreserved','Actions'],needs.map(n=>{const i=find('inventory',n.inventory_item_id);return `<tr><td><strong>${esc(i.name)}</strong><small>${fmt(n.fulfilled_quantity)} / ${fmt(n.required_quantity)} ${esc(i.unit)}</small></td><td>${badge(n.priority)}</td><td>${progress(pct(n))}</td><td>${fmt(n.reserved_quantity)}</td><td>${fmt(n.open_quantity)}</td><td><div class="actions">${c.status!=='Closed'?action('Edit','edit','needs',n.id,'secondary'):''}${admin()?action('Remove','delete','needs',n.id,'danger'):''}</div></td></tr>`;}).join('')):empty('No needs registered.'))+
    `<div class="page-heading" style="margin-top:28px"><h2>Assigned volunteers</h2><a href="#volunteers" class="text-link">Manage volunteers →</a></div>`+(vols.length?table(['Name','Skill'],vols.map(v=>`<tr><td><strong>${esc(v.name)}</strong></td><td>${esc(v.skill)}</td></tr>`).join('')):empty('No volunteers assigned.'));
}
function inventory() {
  const list=inventoryRows();
  const low=data.inventory.filter(i=>i.stock<=i.reorder_level).length;
  const tabs=[['','All supplies',data.inventory.length],['Low Stock','Low stock',low],['In Stock','In stock',data.inventory.length-low]];
  return heading('Warehouse','Keep essential supplies moving. Available stock is ready to dispatch.',newButton('Add supply','inventory'))+`<div class="inventory-meta"><span><strong>${data.inventory.length}</strong> supply lines</span><span><strong>${new Set(data.inventory.map(i=>i.category)).size}</strong> categories</span><span class="alert"><strong>${low}</strong> require restocking</span></div><div class="stock-tabs" role="group" aria-label="Stock levels">${tabs.map(([value,label,count])=>`<button class="stock-tab" data-action="stock-filter" data-value="${value}" aria-pressed="${(filters.filter||'')===value}">${label}<span>${count}</span></button>`).join('')}</div><div class="toolbar"><label class="toolbar-label">Find supplies<input id="search" class="search" aria-label="Search records" placeholder="Search item or category…" value="${esc(filters.search||'')}"></label><label class="toolbar-label">Sort by<select id="sort" aria-label="Sort inventory"><option value="name" ${filters.sort!=='stock'?'selected':''}>Name A to Z</option><option value="stock" ${filters.sort==='stock'?'selected':''}>Lowest stock first</option></select></label><button class="button secondary" data-action="export">Export CSV</button></div><p class="result-note">${list.length} OF ${data.inventory.length} SUPPLIES SHOWN${filters.search||filters.filter?' / <button class="inline-reset" data-action="clear-filters">Reset filters</button>':''}</p>`+
    (list.length?table(['Supply','Category','Available stock','Reorder level','Status','Actions'],list.map(i=>`<tr><td><strong>${esc(i.name)}</strong><small>${esc(i.unit)}</small></td><td>${esc(i.category)}</td><td><strong>${fmt(i.stock)}</strong> ${esc(i.unit)}</td><td>${fmt(i.reorder_level)}</td><td>${badge(i.stock<=i.reorder_level?'Low Stock':'Available')}</td><td><div class="actions">${admin()?action('Edit','edit','inventory',i.id,'secondary')+action('Delete','delete','inventory',i.id,'danger'):'View only'}</div></td></tr>`).join('')):empty('No supplies found.'))+`<p class="subtitle">Available stock excludes Pending and In Transit reservations. Stock adjustments represent available units.</p>`;
}
function inventoryRows(){return data.inventory.filter(i=>matches(i.name+' '+i.category,i.stock<=i.reorder_level?'Low Stock':'In Stock')).sort((a,b)=>filters.sort==='stock'?a.stock-b.stock||a.name.localeCompare(b.name):a.name.localeCompare(b.name));}
function documentPage(kind){
  const content={
    terms:['Terms of use','Local demonstration workspace',`<h2>Purpose of this app</h2><p>ReliefHub is a hackathon demonstration built by Team Omnitrix. Its starting records are fictional examples, not verified emergency information. Use it to explore camp management and resource coordination.</p><h2>Your records</h2><p>You control the data entered into this local copy. Check quantities, destinations and assignments before using exported information. Back up your local database if you need to keep your changes.</p><h2>Operational limits</h2><p>The role selector simulates permissions and is not a secure login. This demo is not an emergency response service. It does not arrange actual deliveries, accept payments or contact volunteers.</p><h2>Access and availability</h2><p>The app requires its local server to be running. There are no paid services or subscriptions within the application. Production use requires a separate review of identity, access, data handling and hosting.</p>`],
    privacy:['Privacy policy','How this local workspace handles data',`<h2>What is stored</h2><p>Camp details, inventory, needs, dispatches, donor names and volunteer names are stored in the SQLite database on the computer running this app. The browser sends these records to that local server when you view or change them.</p><h2>Cookies and third parties</h2><p>A session cookie remembers the selected demo role. ReliefHub includes no analytics, advertising trackers, third-party fonts or external API integrations. It does not automatically send your records to Team Omnitrix or a cloud service.</p><h2>Retention and access</h2><p>Records remain in the local database until changed or removed. Some linked records are protected from deletion to preserve stock history. Anyone with access to the running demo can select the coordinator role; the role selector does not verify identity.</p><h2>Exports and personal information</h2><p>CSV exports download to your device. Avoid entering sensitive real-world personal information into this demonstration. To remove all local data, stop the server and manage the database file on the host computer. The setup guide explains where it is stored.</p>`],
    guide:['Workspace guide','A practical route through relief coordination',`<h2>Start with the gaps</h2><p>Overview lists High-priority needs below 40% fulfilment. Open a camp from that list to see what is required, already delivered and reserved.</p><h2>Move supplies</h2><ol><li>Check Warehouse for available stock. Use Low stock to identify supplies that need replenishment.</li><li>Create a dispatch by choosing a camp, a need and a quantity. Stock is reserved immediately.</li><li>Mark it In Transit when it leaves, then Delivered when received. Fulfilment increases on delivery.</li><li>Cancel an undelivered dispatch to release its reservation.</li></ol><h2>Receive help</h2><p>Record In-Kind donations to increase inventory. Cash donations are recorded separately in PKR. Assign volunteers to an open camp, and unassign them before moving them elsewhere.</p><h2>Choose a role</h2><p>Relief Coordinators manage all sections. Field Volunteers can view operations, update family counts and add or edit camp needs. Use the sidebar selector to explore both experiences.</p><h2>Refresh and export</h2><p>Refresh pulls the latest records from the local server. Warehouse CSV exports follow your current search, stock filter and sort order.</p>`]
  }[kind];
  return `<article class="document">${heading(content[0],content[1])}${content[2]}<p class="document-note">Team Omnitrix / ReliefHub local demo / <a class="text-link" href="#dashboard">Return to overview</a></p></article>`;
}
function confirmAction(title,description){return new Promise(resolve=>{const modal=$('#confirm-modal');$('#confirm-title').textContent=title;$('#confirm-description').textContent=description;modal.returnValue='cancel';modal.addEventListener('close',()=>resolve(modal.returnValue==='confirm'),{once:true});modal.showModal();});}
function exportInventory(){const columns=['Name','Category','Unit','Available stock','Reorder level','Status'];const csvCell=value=>'"'+String(value).replace(/^[=+@-]/,"'$&").replace(/"/g,'""')+'"';const lines=[columns,...inventoryRows().map(i=>[i.name,i.category,i.unit,i.stock,i.reorder_level,i.stock<=i.reorder_level?'Low Stock':'In Stock'])];const url=URL.createObjectURL(new Blob(['\uFEFF'+lines.map(row=>row.map(csvCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='reliefhub-inventory.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Inventory exported using your current filters.');}
function dispatches() {
  const list=data.dispatches.filter(d=>matches(find('camps',d.camp_id).name+' '+find('inventory',find('needs',d.need_id).inventory_item_id).name,d.status)).reverse();
  return heading('Supply dispatches','Reserve confidently. Track every delivery through to completion.',newButton('Create dispatch','dispatches'))+toolbar('Search camp or supply…',['Pending','In Transit','Delivered','Cancelled'],'Statuses')+
    (list.length?table(['Dispatch','Destination','Supply','Quantity','Status','Actions'],list.map(d=>{const i=find('inventory',find('needs',d.need_id).inventory_item_id);return `<tr><td><strong>DSP-${String(d.id).padStart(3,'0')}</strong></td><td><a class="text-link" href="#camps/${d.camp_id}">${esc(find('camps',d.camp_id).name)}</a></td><td>${esc(i.name)}</td><td>${fmt(d.quantity)} ${esc(i.unit)}</td><td>${badge(d.status)}</td><td><div class="actions">${admin()&&['Pending','In Transit'].includes(d.status)?(d.status==='Pending'?action('In Transit','transit','dispatches',d.id,'secondary'):'')+action('Delivered','deliver','dispatches',d.id)+action('Cancel','cancel','dispatches',d.id,'danger'):'Not available'}</div></td></tr>`;}).join('')):empty('No dispatches found.'));
}
function donations() {
  const cash=sum(data.donations.filter(d=>d.type==='Cash'),'amount_or_quantity');
  const groups={}; for(const d of data.donations){const unit=d.type==='Cash'?'PKR':find('inventory',d.item_id).unit; const key=d.category+' · '+unit; groups[key]=(groups[key]||0)+d.amount_or_quantity;}
  const list=data.donations.filter(d=>matches(d.donor_name+' '+d.category,d.type)).reverse();
  return heading('Community donations','Turn generosity into practical, traceable support.',newButton('Record donation','donations'))+`<div class="summary-strip"><div class="summary-chip"><small>Total cash received</small><strong>PKR ${fmt(cash)}</strong></div><div class="summary-chip"><small>Contributions recorded</small><strong>${data.donations.length}</strong></div></div><div class="donation-groups">${Object.entries(groups).map(([k,v])=>`<span class="badge green">${esc(k)}: ${fmt(v)}</span>`).join('')}</div>`+toolbar('Search donor or category…',['Cash','In-Kind'],'Types')+
    (list.length?table(['Donor','Type','Category','Contribution','Supply'],list.map(d=>`<tr><td><strong>${esc(d.donor_name)}</strong></td><td>${badge(d.type)}</td><td>${esc(d.category)}</td><td>${d.type==='Cash'?'PKR ':''}${fmt(d.amount_or_quantity)} ${d.type==='In-Kind'?esc(find('inventory',d.item_id).unit):''}</td><td>${d.type==='In-Kind'?esc(find('inventory',d.item_id).name):'Not available'}</td></tr>`).join('')):empty('No donations found.'));
}
function volunteers() {
  const list=data.volunteers.filter(v=>matches(v.name+' '+(find('camps',v.camp_id).name||''),v.skill));
  return heading('Volunteer network','Connect skills with the communities that need them.',newButton('Register volunteer','volunteers'))+toolbar('Search volunteer or assigned camp…',['Medical','Logistics','Cooking','Driving','Counselling'],'Skills')+
    (list.length?table(['Volunteer','Skill','Assignment','Status','Actions'],list.map(v=>`<tr><td><strong>${esc(v.name)}</strong></td><td>${esc(v.skill)}</td><td>${v.camp_id?`<a class="text-link" href="#camps/${v.camp_id}">${esc(find('camps',v.camp_id).name)}</a>`:'Not assigned'}</td><td>${badge(v.camp_id?'Deployed':'Available')}</td><td><div class="actions">${admin()?(v.camp_id?action('Unassign','unassign','volunteers',v.id,'secondary'):action('Assign camp','assign','volunteers',v.id))+action('Edit','edit','volunteers',v.id,'secondary'): 'View only'}</div></td></tr>`).join('')):empty('No volunteers found.'));
}

function field(label, key, value='', type='text', options=null, attrs='') {
  const control=options?`<select name="${key}" ${attrs}>${options.map(o=>{const [v,l]=Array.isArray(o)?o:[o,o];return `<option value="${esc(v)}" ${String(v)===String(value)?'selected':''}>${esc(l)}</option>`;}).join('')}</select>`:`<input name="${key}" type="${type}" value="${esc(value)}" ${attrs||'required'} ${type==='text'?'maxlength="120"':''}>`;
  return `<label>${label}${control}</label>`;
}
function openEditor(tableName, id, mode='edit') {
  const isNew=mode==='new', row=isNew?{}:find(tableName,id);
  editor={table:tableName,id:isNew?null:id,mode};
  let html='';
  const campsOptions=data.camps.filter(c=>c.status!=='Closed').map(c=>[c.id,c.name]);
  const itemOptions=data.inventory.map(i=>[i.id,`${i.name} (${i.unit})`]);
  const titles={camps:'camp',inventory:'inventory item',needs:'camp need',dispatches:'dispatch',donations:'donation',volunteers:'volunteer'};
  $('#modal-title').textContent=(mode==='assign'?'Assign':isNew?'Add':'Edit')+' '+titles[tableName];
  if(tableName==='camps') {
    html=(admin()?field('Camp name','name',row.name)+field('District','district',row.district)+field('Capacity (families)','capacity',row.capacity||100,'number',null,'required min="1" step="1"'):'')+field('Current families','current_families',row.current_families||0,'number',null,'required min="0" step="1"')+(admin()?field('Status','status',row.status||'Active','text',['Active','Full','Closed']):'')+'<p class="form-help">Camp status automatically becomes Full at capacity. Closed camps stay closed until reopened.</p>';
  } else if(tableName==='inventory') {
    html=field('Item name','name',row.name)+field('Category','category',row.category||'Food','text',['Food','Water','Medical','Shelter','Hygiene','Other'])+field('Unit','unit',row.unit||'kg')+field('Available stock','stock',row.stock||0,'number',null,'required min="0" step="1"')+field('Reorder level','reorder_level',row.reorder_level||0,'number',null,'required min="0" step="1"');
  } else if(tableName==='needs') {
    editor.camp_id=isNew?id:row.camp_id;
    html=field('Inventory item','inventory_item_id',row.inventory_item_id,'text',itemOptions,isNew?'required':'disabled')+field('Required quantity','required_quantity',row.required_quantity||1,'number',null,'required min="1" step="1"')+field('Priority','priority',row.priority||'High','text',['High','Medium','Low'])+'<p class="form-help">Fulfilment updates when dispatches are delivered. Requirements cannot be reduced below fulfilled and reserved quantities.</p>';
  } else if(tableName==='dispatches') {
    html=field('Destination camp','camp_id',campsOptions[0]?.[0],'text',campsOptions,'required')+field('Camp need','need_id','','text',[],'required')+field('Dispatch quantity','quantity',1,'number',null,'required min="1" step="1"')+'<p class="form-help" id="dispatch-help"></p>';
  } else if(tableName==='donations') {
    html=field('Donor name','donor_name','Anonymous')+field('Contribution type','type','Cash','text',['Cash','In-Kind'])+field('Amount (PKR) / quantity','amount_or_quantity',1,'number',null,'required min="0.01" step="0.01"')+field('Cash category','category','Monetary')+field('In-kind supply','item_id','','text',[['','Select supply'],...itemOptions]);
  } else if(tableName==='volunteers') {
    html=mode==='assign'?field('Assign to camp','camp_id','','text',[['','Choose a camp'],...campsOptions],'required'):field('Full name','name',row.name)+field('Skill','skill',row.skill||'Medical','text',['Medical','Logistics','Cooking','Driving','Counselling'])+(isNew?field('Assignment','camp_id','','text',[['','Unassigned'],...campsOptions]):'');
  }
  $('#form-fields').innerHTML=html; $('#form-error').textContent=''; $('#save').disabled=false;
  if(tableName==='dispatches') updateDispatchNeeds();
  if(tableName==='donations') updateDonationFields();
  $('#modal').showModal();
}
function updateDispatchNeeds() {
  const campId=Number($('#editor [name=camp_id]').value);
  const options=data.needs.filter(n=>n.camp_id===campId&&n.open_quantity>0);
  $('#editor [name=need_id]').innerHTML=options.map(n=>`<option value="${n.id}">${esc(find('inventory',n.inventory_item_id).name)}</option>`).join('');
  updateDispatchHelp();
}
function updateDispatchHelp() {
  const n=find('needs',$('#editor [name=need_id]').value), i=find('inventory',n.inventory_item_id);
  const max=n.id?Math.min(n.open_quantity,i.stock):0;
  $('#dispatch-help').textContent=n.id?`${i.stock} ${i.unit} available · ${n.open_quantity} unreserved for this need. Maximum dispatch: ${max}. Stock is reserved immediately.`:'This camp has no unreserved needs.';
  $('#editor [name=quantity]').max=max; $('#save').disabled=max<=0;
}
function updateDonationFields() {
  const inkind=$('#editor [name=type]').value==='In-Kind';
  const item=$('#editor [name=item_id]'), category=$('#editor [name=category]'), amount=$('#editor [name=amount_or_quantity]');
  item.required=inkind; item.disabled=!inkind; item.closest('label').hidden=!inkind;
  category.disabled=inkind; category.closest('label').hidden=inkind;
  amount.step=inkind?'1':'0.01'; amount.min=inkind?'1':'0.01';
}
$('#editor').addEventListener('change',event=>{
  if(editor.table==='dispatches') {if(event.target.name==='camp_id') updateDispatchNeeds(); if(event.target.name==='need_id') updateDispatchHelp();}
  if(editor.table==='donations'&&event.target.name==='type') updateDonationFields();
});
$('#editor').addEventListener('submit',async event=>{
  event.preventDefault(); const button=$('#save'); if(button.disabled)return; button.disabled=true;
  try {
    const body=Object.fromEntries(new FormData(event.currentTarget));
    if(editor.table==='needs') body.camp_id=editor.camp_id;
    await api(editor.table+(editor.id?'/'+editor.id:''),editor.id?'PUT':'POST',body);
    $('#modal').close(); await refresh(); toast('Changes saved to the workspace.');
  } catch(error){$('#form-error').textContent=error.message;} finally{button.disabled=false;}
});
$('#close-modal').onclick=$('#cancel-modal').onclick=()=>$('#modal').close();
document.addEventListener('click',async event=>{
  const el=event.target.closest('[data-action]'); if(!el)return;
  const {action:act,table:collection,id}=el.dataset;
  if(act==='clear-filters'){filters={};render();return;}
  if(act==='stock-filter'){filters.filter=el.dataset.value;render();return;}
  if(act==='export'){exportInventory();return;}
  if(act==='gaps'){event.preventDefault();$('#critical-gaps').scrollIntoView({behavior:'smooth'});return;}
  if(act==='retry')return refresh();
  if(['new','edit','assign'].includes(act))return openEditor(collection,Number(id),act);
  if(act==='delete'&&!await confirmAction('Delete this record?', 'This removes the record from your workspace. Records linked to existing history cannot be deleted.'))return;
  if(act==='cancel'&&!await confirmAction('Cancel this dispatch?', 'Its reserved stock will return to the warehouse. A cancelled dispatch cannot be reopened.'))return;
  el.disabled=true;
  try {
    if(act==='delete'){await api(collection+'/'+id,'DELETE',{});if(collection==='camps')location.hash='camps';}
    if(act==='unassign')await api('volunteers/'+id,'PUT',{camp_id:null});
    if(['transit','deliver','cancel'].includes(act))await api('dispatches/'+id,'PUT',{status:{transit:'In Transit',deliver:'Delivered',cancel:'Cancelled'}[act]});
    await refresh();toast('Workspace updated.');
  }catch(error){toast(error.message);}finally{el.disabled=false;}
});
document.addEventListener('input',event=>{
  if(event.target.id!=='search')return;
  const position=event.target.selectionStart; filters.search=event.target.value;render();$('#search').focus();$('#search').setSelectionRange(position,position);
});
document.addEventListener('change',event=>{if(event.target.id==='filter'){filters.filter=event.target.value;render();}if(event.target.id==='sort'){filters.sort=event.target.value;render();}});
$('#role').addEventListener('change',async event=>{
  const previous=role;
  try{await api('session','POST',{role:event.target.value});role=event.target.value;$('#modal').close();render();toast(role==='Admin'?'Relief Coordinator workspace':'Field Volunteer: view operations, update family counts and camp needs.');}
  catch(error){event.target.value=previous;toast(error.message);}
});
$('#refresh').onclick=refresh;
$('.skip').onclick=event=>{event.preventDefault();$('#content').focus();$('#content').scrollIntoView();};
window.addEventListener('hashchange',()=>{filters={};render();window.scrollTo(0,0);});
(async()=>{try{const s=await api('session');role=s.role||'Admin';if(!s.role)await api('session','POST',{role});$('#role').value=role;await refresh();}catch(error){$('#connection').textContent='Offline';$('#content').innerHTML=`<div class="panel error-panel"><h2>Connection unavailable</h2><p>${esc(error.message)}</p><button class="button" onclick="location.reload()">Reconnect</button></div>`;}})();

