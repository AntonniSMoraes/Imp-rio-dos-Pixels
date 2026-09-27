'use strict';
const DomainAutonomy = (() => {
  const lords=()=>alive().filter(p=>p.id!==state.king&&p.social>=2&&p.tiles?.length&&!Peerage.consort(p)&&!p.capturedBy);
  function visible(p){
    if(p.away)return false;
    if(p.id===state.king||p.liege===state.king)return !Peerage.consort(p)||p.unionHead===state.king;
    const owner=AnnualEconomy.owner(p);
    return !owner||owner.id===state.king;
  }
  function adjacent(a,b){return (a.tiles||[]).some(i=>(TerritoryGeometry.get(i)?.neighbors||[]).some(n=>(b.tiles||[]).includes(n)));}
  function eligible(lord,p){return p.id!==state.king&&p.id!==lord.id&&adult(p)&&!onMission(p)&&!Peerage.consort(p)&&!isRoyalFamilyMember(p)&&!p.retired&&p.social<lord.social&&(!p.tiles?.length||adjacent(lord,p));}
  function economy(){
    for(const lord of lords()){
      const population=alive().filter(p=>AnnualEconomy.owner(p)?.id===lord.id);
      const workers=population.filter(p=>adult(p)&&!onMission(p));
      const purse=lord.treasury||{}, stock={food:purse.food||0,wood:purse.wood||0,iron:purse.iron||0};
      const targets={food:Math.max(12,population.length*.45*16),wood:28,iron:16};
      for(const p of workers){
        if(p.social===1&&stock.food>=targets.food&&state.day%4===0){p.job='train';continue;}
        const job=['food','wood','iron'].sort((a,b)=>(stock[a]/targets[a])-(stock[b]/targets[b]))[0];
        p.job=job;p.jobMode='auto';stock[job]+=(job==='food'?7.5:job==='wood'?7:4)*getYield(p,job);
      }
      lord.order='balance';
    }
  }
  function recruit(){
    if(state.day%12||state.lastDomainRecruitDay===state.day)return;
    state.lastDomainRecruitDay=state.day;
    for(const lord of lords().sort((a,b)=>b.social-a.social)){
      if(direct(lord).length>=(LORD_CAP[lord.social]||0))continue;
      const candidate=adults().filter(p=>eligible(lord,p)&&p.liege===state.king&&p.social>0&&p.houseHead===p.id&&!(byId(state.king)?.manualHeir&&byId(state.king).heir===p.id)).sort((a,b)=>b.social-a.social||b.level-a.level)[0];
      if(candidate){candidate.liege=lord.id;candidate.feudalGrantor=lord.id;log(lord.name+' acolheu '+candidate.name+' como vassalo de sua casa.');continue;}
      const local=adults().find(p=>p.social===0&&AnnualEconomy.owner(p)?.id===lord.id&&eligible(lord,p)&&(!p.unionHead||!byId(p.unionHead)?.alive));
      if(local){local.social=1;local.liege=lord.id;local.houseHead=local.id;local.feudalGrantor=lord.id;local.promotedAt=state.promotionSequence++;log(lord.name+' alistou '+local.name+' nas fileiras de seu domínio.');continue;}
      if(alive().length>=capacity()||(lord.treasury?.gold||0)<10||(lord.treasury?.food||0)<10)continue;
      const p=makePerson({age:18+rand(18)});p.liege=lord.id;p.houseHead=p.id;p.social=1;p.feudalGrantor=lord.id;p.promotedAt=state.promotionSequence++;p.job='food';p.source={type:'adult',day:state.day};
      p.race=lord.race;p.ancestry={...lord.ancestry};if(typeof ensureRaceData==='function')ensureRaceData(p);
      lord.treasury.gold-=10;lord.treasury.food-=10;state.people.push(p);
      log(lord.name+' recrutou um soldado nos territórios de sua casa.');
    }
  }
  function tick(){recruit();economy();}
  return {tick,economy,recruit,adjacent,eligible,visible};
})();
