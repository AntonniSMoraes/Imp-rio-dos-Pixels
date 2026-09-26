'use strict';

// Domain accounts own their production. Only the annual surplus is taxable.
const AnnualEconomy = (() => {
  const resources = ['wood', 'iron', 'food', 'gold'];
  const empty = () => ({wood:0, iron:0, food:0, gold:0});
  function account(p) {
    p.treasury ||= empty();
    for (const key of resources) p.treasury[key] ||= 0;
    p.annualOpening ||= {...p.treasury};
    return p.treasury;
  }
  function owner(p) {
    const king = state.people.find(x => x.id === state.king);
    const seen = new Set();
    while (p && !seen.has(p.id)) {
      seen.add(p.id);
      if (p.id === state.king) return king;
      const head = state.people.find(x => x.id === p.unionHead && x.alive);
      if (head) { p = head; continue; }
      if (p.social >= 2 && p.tiles?.length) return p;
      const household = state.people.find(x=>x.alive && x.id===p.houseHead && x.id!==p.id && x.social>=2);
      p = household || state.people.find(x => x.alive && x.id === p.liege);
    }
    return king;
  }
  function surplus(p, population = 0) {
    const purse = account(p), rate = Math.max(0, Math.min(1, state.royalTaxRate ?? .25));
    return Object.fromEntries(resources.map(key => [key, Math.min(
      Math.max(0, purse[key] - (p.annualOpening[key] || 0)) * rate,
      Math.max(0, purse[key] - (key === 'food' ? population * .45 * 12 : 0))
    )]));
  }
  function foreign() {
    for (const realm of state.warfare?.realms || []) {
      account(realm); realm.villageAccounts ||= {};
      for (const tile of realm.tiles) {
        const village = realm.villageAccounts[tile] ||= {};
        account(village);
        const purse = tile === realm.capital ? realm.treasury : village.treasury;
        const residents = (state.warfare.people || []).filter(p => p.alive && !p.capturedBy && p.realm === realm.id && p.location === tile);
        const available = residents.filter(p => p.age >= 18 && !(state.warfare.raids || []).some(r => r.status !== 'done' && (r.men.includes(p.id) || r.defenders?.includes(p.id))));
        available.forEach((p, index) => {
          const job = ['food','wood','iron'][index % 3];
          purse[job] += (typeof Dragons !== 'undefined' ? Dragons.modifier(tile) : 1) * (job === 'food' ? 7.5 : job === 'wood' ? 7 : 4) * (1 + (p.attrs?.vigor || 8) / 30);
          purse.gold += .35;
        });
        purse.food = Math.max(0, purse.food - residents.length * .45);
        if (tile !== realm.capital && state.day % 48 === 0) {
          const tax = surplus(village, residents.length);
          for (const key of resources) { purse[key] -= tax[key]; realm.treasury[key] += tax[key]; }
          village.annualOpening = {...purse}; village.lastTribute = tax;
        }
      }
    }
  }
  function tick() {
    const paid = empty();
    if (!state || state.lastAnnualEconomyDay === state.day) return paid;
    state.lastAnnualEconomyDay = state.day;
    const residents = alive(), census = new Map();
    for (const p of residents) { const id = owner(p)?.id; census.set(id, (census.get(id) || 0) + 1); }
    const lords = residents.filter(p => p.id !== state.king && p.social >= 2 && !p.unionHead && p.tiles?.length).sort((a,b) => a.social-b.social);
    lords.forEach(account);
    const region = REGIONS[state.region] || REGIONS.north;
    const base = {wood:7*(region.modifiers?.wood || 1), iron:4*(region.modifiers?.iron || 1), food:(7.5 + state.buildings.hunt*1.2)*(region.modifiers?.food || 1)};
    for (const p of adults()) {
      const lord = owner(p), purse = !lord || lord.id === state.king ? state : account(lord);
      if (!p.capturedBy) purse.gold += .35;
      if (!onMission(p) && base[p.job]) purse[p.job] += base[p.job] * getYield(p,p.job) * (typeof Dragons !== 'undefined' ? Dragons.modifier(lord?.id===state.king ? state.capitalIndex??REGIONS[state.region]?.seat : lord?.territory??lord?.tiles?.[0]) : 1);
    }
    for (const lord of lords) lord.treasury.food = Math.max(0, lord.treasury.food - (census.get(lord.id) || 0)*.45);
    if (state.day % 48 === 0) {
      for (const lord of lords) {
        const tax = surplus(lord,census.get(lord.id) || 0), parent = getDirectLiege(lord);
        const beneficiary = parent ? owner(parent) : null;
        const purse = !beneficiary || beneficiary.id === state.king ? state : account(beneficiary);
        for (const key of resources) { lord.treasury[key] -= tax[key]; purse[key] += tax[key]; if (purse === state) paid[key] += tax[key]; }
        lord.lastTribute = {day:state.day,...tax};
      }
      lords.forEach(p => { p.annualOpening = {...p.treasury}; });
      state.lastAnnualTribute = {day:state.day,...paid};
      log('Tributos anuais recebidos pela Coroa: ' + resources.map(k => Math.floor(paid[k])+' '+({wood:'madeira',iron:'ferro',food:'alimento',gold:'ouro'}[k])).join(', ') + '.');
    }
    foreign();
    return paid;
  }
  function summary(p) {
    const purse = p.id === state.king ? state : account(p);
    const tax = p.id === state.king ? state.lastAnnualTribute : surplus(p,alive().filter(x=>owner(x)?.id===p.id).length);
    return '<h4>Economia do domínio</h4><p>Reserva: '+resources.map(k=>Math.floor(purse[k] || 0)+' '+({wood:'madeira',iron:'ferro',food:'alimento',gold:'ouro'}[k])).join(' · ')+'</p><p>Próximo fechamento anual: '+(48-state.day%48)+' dias. '+(p.id===state.king?'Último tributo recebido':'Tributo previsto sobre o excedente')+': '+resources.map(k=>Math.floor(tax?.[k] || 0)+' '+({wood:'madeira',iron:'ferro',food:'alimento',gold:'ouro'}[k])).join(' · ')+'.</p>';
  }
  return {tick, owner, surplus, summary};
})();
