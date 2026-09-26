import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import '../../js/territory/provinces.js';
export const geometry=globalThis.TerritoryGeometry;
export function setupWorld(){
 let serial=0;const random=Object.create(Math);random.random=()=>.5;
 const makePerson=({age=24,rank=0,sex='M'}={})=>({id:'npc-'+(++serial),name:'Pessoa '+serial,family:'Teste',alive:true,age,rank,sex,social:0,level:5,xp:0,hp:100,attrs:{força:8,magia:6,vigor:8,agilidade:7},parents:[],partners:[],race:'human',traits:[],tiles:[],job:'idle',loyalty:100});
 const state={day:1,region:'central',king:'king',royalLands:[240],people:[{...makePerson(),id:'king',name:'Rei',social:8,attrs:{força:100,magia:100,vigor:100,agilidade:100}},{...makePerson(),id:'soldier',name:'Guarda',social:1,attrs:{força:100,magia:100,vigor:100,agilidade:100}}],buildings:{barracks:1},gold:500,food:500};
 const c=vm.createContext({Math:random,state,makePerson,rand:n=>Math.floor(n*.5),pick:a=>a[Math.floor(a.length*.5)],RACES:Object.fromEntries(['human','elf','darkElf','beastfolk','lamia','harpy','kobold'].map(r=>[r,{name:r,traits:[]} ])),ACTIVE_RACES:['human','elf','darkElf','beastfolk','lamia','harpy','kobold'],ancestryFromRace:r=>({[r]:1}),capacity:()=>10000,TerritoryGeometry:geometry,alive:()=>state.people.filter(p=>p.alive),adult:p=>p?.alive&&p.age>=18,byId:id=>state.people.find(p=>p.id===id),domainPeople:()=>state.people,personalLands:p=>p.tiles,log(){},power:()=>100,death:p=>{p.alive=false;},getTileBiome:i=>{const [x,z]=geometry.get(i).center;const h=geometry.height(x,z);if(h<0)return 'lago';if(h>5.7)return 'mina';return Math.sin(x*.175+z*.125)+Math.cos(x*.075-z*.2)>.45?'floresta':'planicie';}});
 for(const f of ['combatants','world-societies','frontier-ai','warfare','war-validation'])vm.runInContext(readFileSync(new URL('../../js/war/'+f+'.js',import.meta.url),'utf8'),c);
 vm.runInContext('globalThis.Societies=WorldSocieties;globalThis.Combat=WarCombat;globalThis.AI=FrontierAI;',c);
 c.onMission=p=>!!p.capturedBy||c.Warfare.deployed(p.id)||Boolean(state.battle?.active&&state.battle.party.includes(p.id));c.Warfare.ensure();return c;
}
