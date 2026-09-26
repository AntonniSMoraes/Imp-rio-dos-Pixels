'use strict';

// Dragons are world events, never selectable characters or recruitable races.
const Dragons = (() => {
  function tick() {
    if(state.lastDragonDay===state.day)return;
    state.lastDragonDay=state.day;
    if(!state.dragons){
      const land=TerritoryGeometry.all().provinces.filter(p=>p.price!==null&&getTileBiome(p.index)==='mina');
      state.dragons=land.length?[{id:1,tile:land[Math.floor(land.length*.7)].index,arrived:state.day,leave:state.day+36,brood:false,warning:null}]:[];
      state.nextDragonId=2;
    }
    for(const dragon of [...state.dragons]) {
      if(dragon.warning!==null && state.day>=dragon.warning) {
        const lord=alive().find(p=>p.id!==state.king&&(p.tiles||[]).includes(dragon.tile));
        const realm=Warfare.owner(dragon.tile);
        const purse=lord?.treasury || (realm?.capital===dragon.tile?realm.treasury:realm?.villageAccounts?.[dragon.tile]?.treasury) || (dragon.tile===(state.capitalIndex??REGIONS[state.region]?.seat)?state:null);
        if(purse)for(const key of ['wood','iron','food','gold'])purse[key]=Math.max(0,(purse[key]||0)*.5);
        state.dragonRuins ||= {};state.dragonRuins[dragon.tile]=state.day+48;
        dragon.warning=null;
        log('O dragão devastou a Vila '+(dragon.tile+1)+'. Parte dos estoques locais foi perdida; a produção ficará reduzida por um ano.');
      }
      if(state.day>=dragon.leave){
        const neighbors=TerritoryGeometry.get(dragon.tile)?.neighbors.filter(i=>TerritoryGeometry.get(i).price!==null)||[];
        if(neighbors.length)dragon.tile=neighbors[Math.floor(Math.random()*neighbors.length)];
        dragon.arrived=state.day;dragon.leave=state.day+24+Math.floor(Math.random()*25);dragon.brood=false;dragon.warning=null;
      }
      if(!dragon.brood && state.day-dragon.arrived>=16){
        dragon.brood=true;
        if(Math.random()<.02){dragon.warning=state.day+4;log('Alerta: um dragão está agitado na Vila '+(dragon.tile+1)+'. Há quatro dias para retirar trabalhadores ou transferir a capital.');}
        else if(state.dragons.length<4 && Math.random()<.08){state.dragons.push({id:state.nextDragonId++,tile:dragon.tile,arrived:state.day,leave:state.day+48,brood:true,warning:null});log('Um filhote de dragão surgiu na Vila '+(dragon.tile+1)+'.');}
      }
    }
    for(const [tile,until] of Object.entries(state.dragonRuins||{}))if(until<=state.day)delete state.dragonRuins[tile];
  }
  const modifier = tile => state.dragonRuins?.[tile]>state.day ? .5 : 1;
  return {tick,modifier};
})();
