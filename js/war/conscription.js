'use strict';
const Conscription = (() => {
  const count=p=>p?.alive&&!p.capturedBy?Math.max(0,p.conscripts?.count||0):0;
  const size=p=>1+count(p);
  function knight(p){
    const seen=new Set();let lord=byId(p.liege);
    while(lord&&!seen.has(lord.id)){seen.add(lord.id);if(lord.social===2&&lord.tiles?.length&&!lord.capturedBy&&!Peerage.consort(lord))return lord;lord=byId(lord.liege);}
    return null;
  }
  function absorb(p,damage){
    const c=p.conscripts;if(!count(p))return damage;
    let pool=c.count*100-(c.wounds||0),taken=Math.min(pool,damage);pool-=taken;
    const survivors=Math.ceil(pool/100);c.losses=(c.losses||0)+c.count-survivors;c.count=survivors;c.wounds=survivors*100-pool;
    if(!survivors){c.merit=0;c.recommended=false;}
    return damage-taken;
  }
  function fought(p){if(count(p)){p.conscripts.merit=(p.conscripts.merit||0)+1;if(p.conscripts.merit>=24)p.conscripts.recommended=true;}}
  function promote(id,toCrown=false){
    const soldier=byId(id),c=soldier?.conscripts,lord=soldier&&knight(soldier);
    if(!c?.recommended||!count(soldier)||onMission(soldier)||!lord||alive().length>=capacity()||(!toCrown&&direct(lord).length>=(LORD_CAP[2]||4)))return false;
    const p=makePerson({age:22});p.attrs={...soldier.attrs};p.race=soldier.race;p.ancestry={...soldier.ancestry};p.social=1;p.liege=toCrown?state.king:lord.id;p.houseHead=p.id;p.feudalGrantor=p.liege;p.promotedAt=state.promotionSequence++;p.source={type:'adult',day:state.day};p.job='train';
    state.people.push(p);c.count--;c.wounds=0;c.merit=0;c.recommended=false;
    log(p.name+' destacou-se entre os conscritos e foi promovido(a) a soldado '+(toCrown?'da Coroa.':'da casa de '+lord.name+'.'));return true;
  }
  function tick(){
    if(state.lastConscriptionDay===state.day)return;state.lastConscriptionDay=state.day;
    for(const p of state.people)if(p.conscripts&&(!p.alive||p.social!==1)){p.conscripts.count=0;p.conscripts.wounds=0;}
    for(const p of alive().filter(p=>p.social===1)){
      const lord=knight(p);if(!lord||p.capturedBy){if(p.conscripts){p.conscripts.count=0;p.conscripts.wounds=0;}continue;}
      const c=p.conscripts||={count:0,wounds:0,losses:0,merit:0,recommended:false},purse=lord.treasury;
      if(c.count){const food=c.count*.12,gold=c.count*.02;if((purse.food||0)>=food&&(purse.gold||0)>=gold){purse.food-=food;purse.gold-=gold;}else if(state.day%4===0){c.count--;c.wounds=0;log('Falta de mantimentos: um conscrito deixou as fileiras de '+p.name+'.');}}
      if(!onMission(p)&&state.day%4===0&&c.count<10&&(purse.gold||0)>=2&&(purse.food||0)>=3){purse.gold-=2;purse.food-=3;c.count++;}
      if(c.recommended&&!onMission(p))promote(p.id);
    }
  }
  function recommendations(){return alive().filter(p=>p.conscripts?.recommended&&count(p)).map(p=>'<p>'+esc(p.name)+' recomenda um conscrito por serviço destacado. <button data-conscript-promote="'+p.id+'">Acolher como soldado da Coroa</button></p>').join('');}
  document.addEventListener('click',e=>{const b=e.target.closest('[data-conscript-promote]');if(!b)return;const ok=promote(b.dataset.conscriptPromote,true);toast(ok?'Soldado acolhido pela Coroa.':'Aguarde o retorno das tropas e verifique as moradias.');if(ok){save();render();}});
  return {count,size,absorb,fought,tick,knight,promote,recommendations};
})();
