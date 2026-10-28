const periods=new Set([30,90,180,365]);

/** Explicit catalogue policy only: no RUB conversion or default selling price. */
export function validateStarsPlans(plans=[]){
 if(!Array.isArray(plans))throw new Error('Invalid Stars plans');
 const seen=new Set(),sorted=plans.map(plan=>{
  if(!plan||!periods.has(plan.days)||!Number.isSafeInteger(plan.stars)||plan.stars<1||plan.stars>1_000_000||seen.has(plan.days))throw new Error('Invalid Stars plan');
  seen.add(plan.days);return Object.freeze({days:plan.days,stars:plan.stars});
 }).sort((a,b)=>a.days-b.days);
 for(let i=1;i<sorted.length;i++){
  const shorter=sorted[i-1],longer=sorted[i];
  if(BigInt(longer.stars)*BigInt(shorter.days)>=BigInt(shorter.stars)*BigInt(longer.days))throw new Error('Longer Stars plans must cost less per day');
 }
 return Object.freeze(sorted);
}

function decimal(numerator,denominator,digits){
 const scale=10n**BigInt(digits),rounded=(numerator*scale+denominator/2n)/denominator;
 const fraction=String(rounded%scale).padStart(digits,'0').replace(/0+$/,'');
 return String(rounded/scale)+(fraction?','+fraction:'');
}

/** Comparison values are per30 days; invoices still charge the exact whole term. */
export function describeStarsPlans(plans=[]){
 const sorted=validateStarsPlans(plans),base=sorted.find(plan=>plan.days===30);
 return sorted.map(plan=>{
  const numerator=BigInt(plan.stars)*30n,denominator=BigInt(plan.days);
  const per30Days=(numerator%denominator?'≈ ':'')+decimal(numerator,denominator,2);
  let savings=null;
  if(base&&plan.days>30){
   const whole=BigInt(base.stars)*denominator,discount=(whole-numerator)*100n;
   savings=discount*10n<whole?'<0,1%':(discount*10n%whole?'≈ ':'')+decimal(discount,whole,1)+'%';
  }
  return {...plan,per30Days,savings};
 });
}
