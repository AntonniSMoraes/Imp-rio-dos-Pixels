'use strict';
document.addEventListener('click',event=>{
  const b=event.target.closest('button');if(!b||!state)return;
  let ok;
  if(b.dataset.dowry)ok=MarriageCouncil.settle(state.marriageNegotiations?.find(n=>n.key===b.dataset.dowry));
  else if(b.dataset.aidAccept)ok=VassalAid.respond(Number(b.dataset.aidAccept),true);
  else if(b.dataset.aidRefuse)ok=VassalAid.respond(Number(b.dataset.aidRefuse),false);
  else return;
  toast(ok?'Decisão registrada.':'Não foi possível concluir: confira recursos, título solicitado e elegibilidade.');
  if(ok){save();render();refreshPersonModal();}
});

function validateCourt(save){
  const people=new Set(save.people.map(p=>p.id)),realms=new Set(save.warfare?.realms.map(r=>r.id)||[]);
  const day=n=>Number.isSafeInteger(n)&&n>=0;
  if(save.marriageNegotiations!==undefined){
    if(!Array.isArray(save.marriageNegotiations)||save.marriageNegotiations.length>10000)throw Error('marriage negotiations');
    const keys=new Set();
    for(const n of save.marriageNegotiations){
      if(!n||!people.has(n.a)||!people.has(n.b)||n.a===n.b||n.key!==[n.a,n.b].sort().join(':')||keys.has(n.key)||!day(n.day)||n.day>save.day||!day(n.insistence)||!['refused','married'].includes(n.status)||!Array.isArray(n.rejected)||n.rejected.length<1||n.rejected.length>2||new Set(n.rejected.map(r=>r.id)).size!==n.rejected.length)throw Error('marriage negotiation');
      keys.add(n.key);
      for(const r of n.rejected){if(![n.a,n.b].includes(r.id))throw Error('marriage refusal');const d=r.demand;if(d!==null&&(!d||!['gold','food','title'].includes(d.type)||(d.type==='title'?(!people.has(d.relative)||d.tier!==2):(!Number.isFinite(d.amount)||d.amount<=0||d.amount>100000))))throw Error('dowry');}
    }
  }
  if(save.aidRequests!==undefined){
    if(!Array.isArray(save.aidRequests)||save.aidRequests.length>10000||!day(save.aidSequence)||save.aidSequence<1)throw Error('aid requests');
    const ids=new Set(),pending=new Set();
    for(const r of save.aidRequests){if(!r||!day(r.id)||r.id<1||r.id>=save.aidSequence||ids.has(r.id)||!people.has(r.person)||!people.has(r.recipient)||!['wood','iron','food','gold'].includes(r.resource)||!Number.isFinite(r.amount)||r.amount<=0||r.amount>100000||!day(r.day)||r.day>save.day||!day(r.deadline)||r.deadline<r.day||!['pending','fulfilled','refused','cancelled','resolved'].includes(r.status))throw Error('aid request');ids.add(r.id);if(r.status==='pending'){if(pending.has(r.person))throw Error('duplicate aid request');pending.add(r.person);}}
  }
  for(const p of save.people){
    if(p.away!==undefined&&typeof p.away!=='boolean')throw Error('away');
    if(p.away&&(p.id===save.king||!p.defection||!day(p.defection.day)||p.defection.day>save.day||!realms.has(p.defection.realm)||typeof p.defection.reason!=='string'||p.defection.reason.length>500||p.tiles?.length||p.social!==0))throw Error('defection');
    if(p.nextAidDay!==undefined&&!day(p.nextAidDay))throw Error('aid cooldown');
  }
}
