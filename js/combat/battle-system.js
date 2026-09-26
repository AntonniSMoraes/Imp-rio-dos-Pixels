"use strict";

function power(person) {
  return (
    (person.attrs.força + person.attrs.magia * 0.8 + person.attrs.agilidade * 0.5) *
    (1 + (person.level - 5) * 0.07) *
    (1 + person.social * 0.08) *
    (person.hp / 100)
  );
}

function startBattle() {
  if (!state || state.battle?.active || selection.length !== 4 || !state.buildings.barracks) return;
  const party = selection.map((id) => state.people.find((person) => person.id === id));
  if (party.some((person) => !person?.alive || onMission(person) || person.level < 5 || person.hp < 30))
    return toast("Escolha quatro adultos com pelo menos 30% de vida.");
  if (state.food < 15) return toast("A patrulha precisa de 15 alimentos.");
  state.food -= 15;
  state.battle = {
    active: true,
    party: [...selection],
    enemyHP: 200 + state.wins * 60,
    maxHP: 200 + state.wins * 60,
    round: 0,
    logs: ["A patrulha avança sobre a alcateia."],
    won: false,
  };
  log("Quatro cidadãos partiram para o Vale dos Lobos.");
  save();
  render();
}

function battleRound() {
  const battle=state?.battle;if(!battle?.active)return;
  const party=battle.party.map(id=>state.people.find(p=>p.id===id)).filter(p=>p?.alive&&!p.capturedBy);
  if(!party.length){battle.active=false;return;}
  if(!battle.enemies){
    const strength=7+state.wins*1.5;
    battle.enemies=Array.from({length:4},(_,i)=>({id:'wolf-'+state.day+'-'+i,name:'Lobo gélido',age:18,alive:true,hp:Math.min(100,battle.enemyHP/battle.maxHP*100),level:5+Math.floor(state.wins/2),xp:0,attrs:{força:strength*(.8+Math.random()*.4),vigor:strength,magia:1,agilidade:strength*(.9+Math.random()*.3)}}));
    battle.maxHP=400;
  }
  const result=WarCombat.round(party,battle.enemies);battle.round++;
  battle.enemyHP=battle.enemies.filter(p=>p.alive).reduce((n,p)=>n+p.hp,0);
  battle.logs.unshift('Rodada '+battle.round+': '+party.filter(WarCombat.fit).length+' aliados e '+battle.enemies.filter(WarCombat.fit).length+' lobos em condições de lutar.');
  if(result==='left'){
    battle.active=false;battle.won=true;state.wins++;state.gold+=45;state.food+=30;state.iron+=12;
    party.filter(p=>p.alive).forEach(p=>WarCombat.train(p,50));log('Vitória! +45 ouro, +30 alimento e +12 ferro.');
  }else if(result==='right'||battle.round>=20){battle.active=false;log('A expedição foi derrotada ou precisou recuar.');}
  battle.logs=battle.logs.slice(0,25);
}
