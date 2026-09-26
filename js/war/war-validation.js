'use strict';
function validateWarfare(save) {
  const war=save.warfare;if(war===undefined)return;
  const integer=(n,min=0,max=512)=>Number.isInteger(n)&&n>=min&&n<=max;
  const land=i=>integer(i,0,511),text=s=>typeof s==='string'&&s.length<=500;
  if(!war||war.version!==1||!Array.isArray(war.realms)||war.realms.length>8||!Array.isArray(war.armies)||war.armies.length>128||!integer(war.nextId,1,1e9)||!Array.isArray(war.reports)||war.reports.length>40)throw Error('warfare');
  const occupied=new Set([...(save.royalLands||[]),...save.people.filter(p=>p.alive&&p.social>=2).flatMap(p=>p.tiles||[])]),realms=new Set();
  for(const r of war.realms){
    if(!r||typeof r.id!=='string'||!/^realm-\d+$/.test(r.id)||realms.has(r.id)||!text(r.name)||!/^#[a-fA-F0-9]{6}$/.test(r.color)||typeof r.atWar!=='boolean'||!Array.isArray(r.tiles)||r.tiles.length>512||!r.garrisons||typeof r.garrisons!=='object')throw Error('realm');
    realms.add(r.id);
    for(const i of r.tiles){if(!land(i)||occupied.has(i)||!Number.isFinite(r.garrisons[i])||r.garrisons[i]<0||r.garrisons[i]>1e9)throw Error('realm territory');occupied.add(i);}
    if(r.tiles.length?!r.tiles.includes(r.capital):r.capital!==null)throw Error('realm capital');
  }
  const ids=new Set(),deployed=new Set(),people=new Set(save.people.map(p=>p.id));
  for(const a of war.armies){
    if(!a||!integer(a.id,1,war.nextId-1)||ids.has(a.id)||!people.has(a.commander)||!realms.has(a.realm)||!land(a.target)||!Array.isArray(a.path)||!a.path.length||a.path.length>512||a.path.some(i=>!land(i))||!integer(a.step,0,a.path.length-1)||!['march','battle','return','done'].includes(a.status)||!integer(a.round,0,10)||!Number.isFinite(a.enemy)||a.enemy<0||a.enemy>1e9||!Array.isArray(a.men)||a.men.length<2||a.men.length>12||new Set(a.men).size!==a.men.length||!a.men.includes(a.commander)||a.men.some(id=>!people.has(id)))throw Error('army');
    ids.add(a.id);if(a.status!=='done')for(const id of a.men){if(deployed.has(id)||save.battle?.active&&save.battle.party.includes(id))throw Error('duplicate deployment');deployed.add(id);}
  }

  if(war.societyVersion!==undefined){
    if(war.societyVersion!==1||!Array.isArray(war.people)||war.people.length>10000||!Array.isArray(war.habitats)||war.habitats.length>512||!Array.isArray(war.raids)||war.raids.length>32||!war.intel||typeof war.intel!=='object')throw Error('world societies');
    const external=new Set();
    for(const p of war.people){
      if(!p||typeof p.id!=='string'||!/^[a-zA-Z0-9-]+$/.test(p.id)||people.has(p.id)||external.has(p.id)||!text(p.name)||!text(p.family)||!land(p.location)||typeof p.alive!=='boolean'||!['M','F'].includes(p.sex)||typeof p.race!=='string'||!Number.isFinite(p.age)||p.age<18||!integer(p.level,5,100000)||!integer(p.rank,0,4)||!Number.isFinite(p.hp)||p.hp<0||p.hp>100||!Number.isFinite(p.xp)||p.xp<0||!p.attrs||!['força','vigor','magia','agilidade'].every(k=>Number.isFinite(p.attrs[k])&&p.attrs[k]>0)||p.realm&&!realms.has(p.realm)||p.capturedBy&&p.capturedBy!=='crown'&&!realms.has(p.capturedBy)||p.persuasion!==undefined&&(!Number.isFinite(p.persuasion)||p.persuasion<0||p.persuasion>100))throw Error('world person');
      external.add(p.id);
    }
    const raiders=new Set(),defenders=new Set();
    for(const r of war.raids){if(!r||!realms.has(r.realm)||!land(r.target)||!land(r.origin)||!['march','battle','done'].includes(r.status)||!integer(r.round,0,10)||!Array.isArray(r.men)||r.men.length<2||r.men.length>12)throw Error('raid');for(const id of r.men){if(!external.has(id)||raiders.has(id))throw Error('raid troops');raiders.add(id);}if(r.defenders!==undefined){if(!Array.isArray(r.defenders)||r.defenders.length>512)throw Error('raid defenders');for(const id of r.defenders){if(!people.has(id)&&!external.has(id)||defenders.has(id)||deployed.has(id))throw Error('duplicate defense');defenders.add(id);}}}
    for(const id of defenders)if(raiders.has(id))throw Error('defender on raid');
    for(const h of war.habitats)if(!h||!land(h.tile)||!['lamia','harpy','kobold'].includes(h.race))throw Error('habitat');
    for(const [id,v] of Object.entries(war.intel))if(!realms.has(id)||!v||typeof v.pending!=='boolean'||!Number.isFinite(v.ready)||!Number.isFinite(v.until))throw Error('intelligence');
    for(const r of war.realms)if(!Number.isFinite(r.relation)||r.relation < -100||r.relation>100||r.ally!==undefined&&typeof r.ally!=='boolean')throw Error('diplomacy');
    for(const p of save.people)if(p.capturedBy&&!realms.has(p.capturedBy))throw Error('captivity');
  }
  for(const r of war.reports)if(!r||!Number.isFinite(r.day)||r.day<0||!text(r.text))throw Error('war report');
}
