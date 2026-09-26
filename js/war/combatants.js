'use strict';
// Shared individual combat rules for attacks, defenses and independent factions.
const WarCombat = (() => {
  const fit = p => p?.alive && !p.capturedBy && p.hp > 1 && p.age >= 18;
  const stat = (p,k) => Math.max(1,Number(p.attrs?.[k]) || 8);
  function strength(p) {
    return (stat(p,'força') + stat(p,'magia')*.8 + stat(p,'agilidade')*.5) * (1+Math.max(0,p.level-5)*.07) * Math.max(.15,p.hp/100) * (typeof Conscription !== 'undefined'?Conscription.size(p):1);
  }
  function train(p,xp=8) {
    p.xp=(p.xp||0)+xp;
    while(p.xp>=100){p.xp-=100;p.level++;for(const k of Object.keys(p.attrs))p.attrs[k]*=1.035;}
  }
  function round(left,right) {
    const turns=[...left.map(p=>({p,targets:right,friends:left})),...right.map(p=>({p,targets:left,friends:right}))]
      .sort((a,b)=>stat(b.p,'agilidade')-stat(a.p,'agilidade') || a.p.id.localeCompare(b.p.id));
    for(const {p,targets,friends} of turns){
      if(!fit(p))continue;
      const available=targets.filter(fit);if(!available.length)continue;
      const target=available[Math.floor(Math.random()*available.length)];
      if(['Clérigo','Santo'].includes(p.vocation)){const wounded=friends.filter(x=>x.alive&&!x.capturedBy).sort((a,b)=>a.hp-b.hp)[0];if(wounded)wounded.hp=Math.min(100,wounded.hp+Math.sqrt(stat(p,'magia'))*2);}
      const armor=(8+Math.sqrt(stat(target,'vigor'))*2)*(target.vocation==='Paladino'?1.3:1);
      const damage=Math.max(2,strength(p)/armor*9*(.85+Math.random()*.3)*(p.vocation==='Mago'?1.15:p.vocation==='Berserker'?1+(100-p.hp)/150:['Clérigo','Santo'].includes(p.vocation)?.5:1));
      const remaining=typeof Conscription !== 'undefined'?Conscription.absorb(target,damage):damage;
      target.hp=Math.max(0,target.hp-remaining);train(p,5);
      if(typeof Conscription !== 'undefined')Conscription.fought(p);
      if(target.hp===0){
        // A small share survive the lethal blow, unconscious, until the outcome.
        if(Math.random()<.25)target.hp=1;
        else if(state.people.includes(target))death(target,'em combate territorial');
        else {target.alive=false;target.deathDay=state.day;}
      }
    }
    return !left.some(fit)?'right':!right.some(fit)?'left':null;
  }
  function capture(losers,winner) {
    for(const p of losers.filter(p=>p.alive&&!p.capturedBy)){
      p.capturedBy=winner;p.persuasion=0;p.capturedDay=state.day;p.job='idle';
      p.hp=Math.max(1,p.hp);
      if(p.conscripts){p.conscripts.captured=(p.conscripts.captured||0)+p.conscripts.count;p.conscripts.count=0;p.conscripts.wounds=0;p.conscripts.merit=0;p.conscripts.recommended=false;}
    }
  }
  return {fit,strength,train,round,capture};
})();
