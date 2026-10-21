import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {canApply,canReview,effectiveStatus,isoDay,must,profileStats,validateGig} from './rules.js';
const here=path.dirname(fileURLToPath(import.meta.url));
const dbPath=process.env.DB_PATH || path.join(here,'db.json');
const seedPath=path.join(here,'seed.json');
if(!fs.existsSync(dbPath)) fs.copyFileSync(seedPath,dbPath);
const read=()=>JSON.parse(fs.readFileSync(dbPath,'utf8'));
const save=(data)=>{const temp=dbPath+'.tmp';fs.writeFileSync(temp,JSON.stringify(data,null,2));fs.renameSync(temp,dbPath);};
const app=express(); app.use(express.json({limit:'64kb'}));
app.use((req,res,next)=>{res.set('Cache-Control','no-store');next();});
const uid=req=>String(req.get('x-user-id')||'u1');
const auth=(req,db)=>{const id=uid(req);must(db.users.some(u=>u.id===id),'Select a valid demo user',401);return id;};
const find=(items,id,what='Record')=>{const x=items.find(item=>item.id===id);must(Boolean(x),`${what} not found`,404);return x;};
const newId=(prefix)=>prefix+Math.random().toString(36).slice(2,9);
const guard=fn=>(req,res,next)=>{try{fn(req,res);}catch(err){next(err);}};
app.get('/api/health',(_,res)=>res.json({status:'ok',name:'Campus SkillSwap'}));
app.get('/api/users',guard((req,res)=>{const d=read();res.json(d.users.map(u=>({...u,...profileStats(u.id,d.gigs,d.applications,d.reviews)})));}));
app.get('/api/gigs',guard((req,res)=>{const d=read();let gigs=d.gigs.map(g=>({...g,status:effectiveStatus(g)}));const {category,type,payment_type,status,q,user_id}=req.query;
if(category)gigs=gigs.filter(g=>g.category===category);if(type)gigs=gigs.filter(g=>g.type===type);if(payment_type)gigs=gigs.filter(g=>g.payment_type===payment_type);if(status)gigs=gigs.filter(g=>g.status===status);if(user_id)gigs=gigs.filter(g=>g.user_id===user_id);
if(q)gigs=gigs.filter(g=>(g.title+' '+g.description).toLowerCase().includes(String(q).toLowerCase()));
res.json(gigs.sort((a,b)=>b.created_at.localeCompare(a.created_at)));}));
app.get('/api/applications',guard((req,res)=>{const d=read();let a=d.applications;if(req.query.gig_id)a=a.filter(v=>v.gig_id===req.query.gig_id);if(req.query.applicant_id)a=a.filter(v=>v.applicant_id===req.query.applicant_id);res.json(a);}));
app.get('/api/reviews',guard((req,res)=>{const d=read();let a=d.reviews;if(req.query.gig_id)a=a.filter(v=>v.gig_id===req.query.gig_id);if(req.query.reviewee_id)a=a.filter(v=>v.reviewee_id===req.query.reviewee_id);res.json(a);}));
app.post('/api/gigs',guard((req,res)=>{const d=read(),me=auth(req,d),fields=validateGig(req.body);const gig={id:newId('g'),user_id:me,...fields,status:'Open',accepted_applicant_id:null,created_at:new Date().toISOString()};d.gigs.push(gig);save(d);res.status(201).json(gig);}));
app.patch('/api/gigs/:id',guard((req,res)=>{const d=read(),me=auth(req,d),gig=find(d.gigs,req.params.id,'Gig');must(gig.user_id===me,'Only the gig owner can edit it',403);
if(req.body.action==='complete'){must(gig.status==='In Progress','Only an in-progress gig can be completed');must(Boolean(gig.accepted_applicant_id),'An accepted applicant is required');gig.status='Completed';}
else if(req.body.action==='cancel'){must(['Open'].includes(effectiveStatus(gig)),'Only open gigs can be cancelled');gig.status='Cancelled';}
else {must(effectiveStatus(gig)==='Open','Only open gigs can be edited');Object.assign(gig,validateGig({...gig,...req.body}));}
save(d);res.json({...gig,status:effectiveStatus(gig)});}));
app.post('/api/applications',guard((req,res)=>{const d=read(),me=auth(req,d),gig=find(d.gigs,String(req.body.gig_id||''),'Gig');canApply(gig,me,d.applications);must(typeof req.body.message==='string'&&req.body.message.trim().length>=5,'Application message must be at least 5 characters');
const a={id:newId('a'),gig_id:gig.id,applicant_id:me,message:req.body.message.trim(),status:'Pending',created_at:new Date().toISOString()};d.applications.push(a);save(d);res.status(201).json(a);}));
app.patch('/api/applications/:id',guard((req,res)=>{const d=read(),me=auth(req,d),a=find(d.applications,req.params.id,'Application'),gig=find(d.gigs,a.gig_id,'Gig');must(gig.user_id===me,'Only gig owner can manage applicants',403);must(effectiveStatus(gig)==='Open','Gig must be open to decide applications');must(a.status==='Pending','Application already decided');must(['accept','reject'].includes(req.body.action),'Choose accept or reject');
if(req.body.action==='accept'){a.status='Accepted';gig.status='In Progress';gig.accepted_applicant_id=a.applicant_id;d.applications.filter(x=>x.gig_id===gig.id&&x.id!==a.id&&x.status==='Pending').forEach(x=>x.status='Rejected');}
else a.status='Rejected';save(d);res.json(a);}));
app.post('/api/reviews',guard((req,res)=>{const d=read(),me=auth(req,d),gig=find(d.gigs,String(req.body.gig_id||''),'Gig'),reviewee=String(req.body.reviewee_id||'');must(d.users.some(u=>u.id===reviewee),'Review recipient not found');canReview(gig,me,reviewee,d.applications,d.reviews);const rating=Number(req.body.rating);must(Number.isInteger(rating)&&rating>=1&&rating<=5,'Rating must be between 1 and 5');must(typeof req.body.comment==='string'&&req.body.comment.trim().length>=3,'Comment must have at least 3 characters');const r={id:newId('r'),gig_id:gig.id,reviewer_id:me,reviewee_id:reviewee,rating,comment:req.body.comment.trim(),created_at:new Date().toISOString()};d.reviews.push(r);save(d);res.status(201).json(r);}));
app.use('/api',(req,res)=>res.status(404).json({error:'API route not found'}));
const dist=path.join(here,'../dist');if(fs.existsSync(dist)){app.use(express.static(dist));app.get('*',(req,res)=>res.sendFile(path.join(dist,'index.html')));}
app.use((err,req,res,next)=>{if(err instanceof SyntaxError && 'body' in err)return res.status(400).json({error:'Invalid JSON'});console.error(err.status?err.message:err);res.status(err.status||500).json({error:err.status?err.message:'Unexpected server error'});});
const port=Number(process.env.PORT||3001);app.listen(port,'0.0.0.0',()=>console.log(`SkillSwap running on http://localhost:${port}`));
