/** Static client runtime/template smoke test; does NOT replace real browser QA. */
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync(__dirname+'/../static/app.js','utf8');
const fixture=JSON.parse(fs.readFileSync(__dirname+'/fixture.json','utf8'));
const dom=new Map();
const doc={documentElement:{dataset:{}},querySelector:sel=>{if(!dom.has(sel))dom.set(sel,{innerHTML:'',textContent:'',value:'',dataset:{},setAttribute:()=>{},textContent:'',addEventListener:()=>{},focus:()=>{},setSelectionRange:()=>{}});return dom.get(sel)},addEventListener:()=>{}};
const ctx={document:doc,localStorage:{getItem:()=>null,setItem:()=>{}},window:{scrollTo:()=>{}},fetch:async u=>({ok:true,json:async()=>fixture[u.replace('/api/','')]}),console,Date,Math,Number,String,Array,Set,Object,JSON,Promise,encodeURIComponent,clearTimeout,setTimeout};
vm.createContext(ctx);vm.runInContext(source+';globalThis.__test={s,render,updateProfitOutput}',ctx);
setTimeout(()=>{
 const {s,render,updateProfitOutput}=ctx.__test;
 assert(dom.get('#content').innerHTML.includes('home-hero'));assert(dom.get('#nav').innerHTML.includes('nav-text'));assert(dom.get('#content').innerHTML.includes('crop-bookmark'));assert(dom.get('#content').innerHTML.includes('Market Opportunity Finder'));assert(doc.documentElement.dataset.theme==='light');
 s.view='prices';render();assert(dom.get('#content').innerHTML.toLowerCase().includes('crop price watchlist'));assert(dom.get('#content').innerHTML.includes('Download CSV'));assert(dom.get('#content').innerHTML.includes('Sort by'));assert(dom.get('#content').innerHTML.includes('Compare net earnings'));
 for(const [name,text] of [['marketplace','produce marketplace'],['alerts','Your price alerts'],['listings','Your produce listings'],['profit','Profit & scenario calculator']]){
  s.view=name;render();assert(dom.get('#content').innerHTML.toLowerCase().includes(text.toLowerCase()),name);
 }
 assert(dom.get('#profitOutput').innerHTML.includes('PROJECTED NET'));
 console.log('Client runtime/template smoke: six views rendered, nav labels, watchlist, opportunity tool, CSV, form labels and profit output verified');
},200);
