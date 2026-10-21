const allowedCategories = ['Programming','Design','Writing','Tutoring'];
const allowedPayments = ['Paid','SkillSwap','Free'];
const allowedTypes = ['Offering','Requesting'];
export const isoDay = () => new Date().toISOString().slice(0,10);
export function effectiveStatus(gig, today=isoDay()) {
  return gig.status === 'Open' && gig.deadline < today ? 'Expired' : gig.status;
}
export function must(ok, message, status=400) {
  if (!ok) { const err=new Error(message); err.status=status; throw err; }
}
export function validateGig(body) {
  must(typeof body.title==='string' && body.title.trim().length>=4,'Title must be at least 4 characters');
  must(typeof body.description==='string' && body.description.trim().length>=12,'Description must be at least 12 characters');
  must(allowedCategories.includes(body.category),'Choose a valid category');
  must(allowedTypes.includes(body.type),'Choose Offering or Requesting');
  must(allowedPayments.includes(body.payment_type),'Choose a valid payment type');
  must(/^\d{4}-\d{2}-\d{2}$/.test(body.deadline) && !Number.isNaN(Date.parse(body.deadline)),'Enter a valid deadline');
  must(body.deadline>=isoDay(),'Deadline cannot be in the past');
  const budget = body.payment_type==='Paid'?Number(body.budget):null;
  must(body.payment_type!=='Paid' || (Number.isFinite(budget)&&budget>0),'Paid gigs need a positive budget');
  return {
    title:body.title.trim(),description:body.description.trim(),category:body.category,
    type:body.type,payment_type:body.payment_type,budget,deadline:body.deadline
  };
}
export function canApply(gig, applicantId, apps, today=isoDay()) {
  must(gig.user_id!==applicantId,'You cannot apply to your own gig',403);
  must(effectiveStatus(gig,today)==='Open','This gig is not accepting applications');
  must(!apps.some(a=>a.gig_id===gig.id&&a.applicant_id===applicantId),'You have already applied to this gig',409);
}
export function canReview(gig, reviewerId, revieweeId, apps, reviews) {
  must(gig.status==='Completed','Reviews are available after completion only');
  const accepted=apps.find(a=>a.gig_id===gig.id&&a.status==='Accepted');
  must(Boolean(accepted),'Completed gig must have an accepted applicant');
  const owner=gig.user_id, worker=accepted.applicant_id;
  must((reviewerId===owner&&revieweeId===worker)||(reviewerId===worker&&revieweeId===owner),'Only participants can review each other',403);
  must(!reviews.some(r=>r.gig_id===gig.id&&r.reviewer_id===reviewerId),'You already reviewed this gig',409);
}
export function profileStats(userId,gigs,apps,reviews) {
  const posted=gigs.filter(g=>g.user_id===userId).length;
  const completed=gigs.filter(g=>g.status==='Completed'&&(g.user_id===userId||apps.some(a=>a.gig_id===g.id&&a.applicant_id===userId&&a.status==='Accepted'))).length;
  const received=reviews.filter(r=>r.reviewee_id===userId);
  const rating=received.length?received.reduce((s,r)=>s+r.rating,0)/received.length:null;
  return {posted,completed,rating,rating_count:received.length};
}
