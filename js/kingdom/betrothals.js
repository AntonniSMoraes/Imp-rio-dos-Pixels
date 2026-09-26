'use strict';

// Promises reserve partners, but never create a union before both are adults.
const Betrothals = (() => {
  const active = () => (state?.betrothals || []).filter(p => p.status === 'promised');
  const forPerson = id => active().find(p => p.a === id || p.b === id);
  const pairKey = (a,b) => [a,b].sort().join(':');
  const relation = (a,b) => state?.houseRelations?.[pairKey(a,b)] || 0;
  const sponsor = p => (p.parents || []).map(byId).filter(p => p?.alive).sort((a,b) => b.social-a.social)[0] || headOf(p);
  function eligible(a,b) {
    return !!(a?.alive && b?.alive && !a.capturedBy && !b.capturedBy && a.id !== b.id && a.sex !== b.sex && !related(a,b)
      && !partners(a).length && !partners(b).length && !forPerson(a.id) && !forPerson(b.id)
      && (!adult(a) || !adult(b)) && Math.abs(a.age-b.age) <= 5);
  }
  function arrange(aId,bId) {
    const a=byId(aId), b=byId(bId);
    if (!eligible(a,b)) return false;
    const sa=sponsor(a), sb=sponsor(b);
    state.betrothals ||= [];
    state.betrothals.push({id:crypto.randomUUID(),a:a.id,b:b.id,houseA:sa.id,houseB:sb.id,day:state.day,status:'promised'});
    log('Promessa de casamento: '+a.name+' e '+b.name+'. A união aguardará a maioridade de ambos.');
    return true;
  }
  function breakPromise(id, initiator) {
    const p=active().find(p=>p.id===id);
    if (!p || (initiator!==p.houseA && initiator!==p.houseB)) return false;
    p.status='broken';p.ended=state.day;
    const offended=byId(initiator===p.houseA?p.houseB:p.houseA);
    state.houseRelations ||= {};
    const key=pairKey(p.houseA,p.houseB);
    state.houseRelations[key]=Math.max(-100,relation(p.houseA,p.houseB)-25);
    if (offended?.alive && initiator===state.king) offended.loyalty=Math.max(0,(offended.loyalty??100)-15);
    log('Promessa entre '+byId(p.a)?.name+' e '+byId(p.b)?.name+' rompida. Relação entre as famílias: -25.');
    return true;
  }
  function matches(a,b) {
    const p=forPerson(a?.id);
    return !!(p && (p.a===b?.id || p.b===b?.id));
  }
  function complete(a,b) {
    const p=forPerson(a.id);
    if (p && matches(a,b)) {p.status='married';p.ended=state.day;}
  }
  function tick() {
    if (!state) return;
    for (const p of active()) {
      const a=byId(p.a),b=byId(p.b);
      if (!a?.alive || !b?.alive || related(a,b) || partners(a).length || partners(b).length) {
        p.status='cancelled';p.ended=state.day;
        log('Promessa de casamento encerrada por falecimento ou impedimento, sem penalidade.');
      } else if (adult(a) && adult(b) && !a.capturedBy && !b.capturedBy) unite(a,b);
    }
    if (state.day%48) return;
    // The Crown's descendants remain under the player's control.
    const royal=p=>p.id===state.king || bloodDescendant(p,state.king);
    for (const p of active()) {
      if (!royal(byId(p.a)) && !royal(byId(p.b)) && relation(p.houseA,p.houseB)<=-50) breakPromise(p.id,p.houseA);
    }
    const children=alive().filter(p=>!adult(p) && !royal(p) && sponsor(p).social>=2 && !forPerson(p.id));
    for (const a of children) {
      const b=children.filter(b=>eligible(a,b) && sponsor(a).id!==sponsor(b).id && relation(sponsor(a).id,sponsor(b).id)>-25)
        .sort((x,y)=>(y.rank||0)-(x.rank||0) || Math.abs(a.age-x.age)-Math.abs(a.age-y.age))[0];
      if (b && arrange(a.id,b.id)) break;
    }
  }
  return {active,forPerson,relation,sponsor,eligible,arrange,breakPromise,matches,complete,tick};
})();
