import test from 'node:test';
import assert from 'node:assert/strict';
import {canApply,canReview,effectiveStatus,profileStats,validateGig} from '../server/rules.js';
const gig={id:'g1',user_id:'u1',status:'Open',deadline:'2099-12-31'};
test('expired opens become Expired but completed remains Completed',()=>{
assert.equal(effectiveStatus({...gig,deadline:'2020-01-01'},'2026-10-21'),'Expired');
assert.equal(effectiveStatus({...gig,status:'Completed',deadline:'2020-01-01'},'2026-10-21'),'Completed');
});
test('apply rejects own gig, duplicate application, and closed gig',()=>{
assert.throws(()=>canApply(gig,'u1',[]),/own gig/);
assert.throws(()=>canApply(gig,'u2',[{gig_id:'g1',applicant_id:'u2'}]),/already applied/);
assert.throws(()=>canApply({...gig,status:'In Progress'},'u2',[]),/not accepting/);
assert.doesNotThrow(()=>canApply(gig,'u2',[]));
});
test('gig input validation includes paid budgets and deadlines',()=>{
const valid={title:'Tutor Python',description:'Support with beginner Python assignments',category:'Tutoring',type:'Offering',payment_type:'Paid',budget:1000,deadline:'2099-01-01'};
assert.equal(validateGig(valid).budget,1000);
assert.throws(()=>validateGig({...valid,budget:0}),/positive budget/);
assert.throws(()=>validateGig({...valid,deadline:'2020-01-01'}),/past/);
assert.equal(validateGig({...valid,payment_type:'Free'}).budget,null);
});
test('reviews require completed gig, matching participants, no duplicates',()=>{
const g={...gig,status:'Completed'};
const apps=[{gig_id:'g1',applicant_id:'u2',status:'Accepted'}];
assert.doesNotThrow(()=>canReview(g,'u1','u2',apps,[]));
assert.throws(()=>canReview(g,'u3','u2',apps,[]),/Only participants/);
assert.throws(()=>canReview(g,'u1','u2',apps,[{gig_id:'g1',reviewer_id:'u1'}]),/already reviewed/);
});
test('profile ratings are calculated from review records',()=>{
const stats=profileStats('u1',[{id:'g1',user_id:'u1',status:'Completed'}],[],[{reviewee_id:'u1',rating:4},{reviewee_id:'u1',rating:5}]);
assert.equal(stats.posted,1);assert.equal(stats.completed,1);assert.equal(stats.rating,4.5);
});
