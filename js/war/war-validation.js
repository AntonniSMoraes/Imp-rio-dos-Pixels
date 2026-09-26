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
    for(const i of r.tiles){if(!land(i)||occupied.has(i)||!Number.isFinite(r.garrisons[i])||r.garrisons[i]<0||r.garrisons[i]>1000)throw Error('realm territory');occupied.add(i);}
    if(r.tiles.length?!r.tiles.includes(r.capital):r.capital!==null)throw Error('realm capital');
  }
  const ids=new Set(),deployed=new Set(),people=new Set(save.people.map(p=>p.id));
  for(const a of war.armies){
    if(!a||!integer(a.id,1,war.nextId-1)||ids.has(a.id)||!people.has(a.commander)||!realms.has(a.realm)||!land(a.target)||!Array.isArray(a.path)||!a.path.length||a.path.length>512||a.path.some(i=>!land(i))||!integer(a.step,0,a.path.length-1)||!['march','battle','return','done'].includes(a.status)||!integer(a.round,0,10)||!Number.isFinite(a.enemy)||a.enemy<0||a.enemy>1000||!Array.isArray(a.men)||a.men.length<2||a.men.length>12||new Set(a.men).size!==a.men.length||!a.men.includes(a.commander)||a.men.some(id=>!people.has(id)))throw Error('army');
    ids.add(a.id);if(a.status!=='done')for(const id of a.men){if(deployed.has(id)||save.battle?.active&&save.battle.party.includes(id))throw Error('duplicate deployment');deployed.add(id);}
  }
  for(const r of war.reports)if(!r||!Number.isFinite(r.day)||r.day<0||!text(r.text))throw Error('war report');
}
