'use strict';
// Government is a persisted tree of individual title holders, independent of genealogy.
let peopleTab = 'all', pendingLand = null;
let collapsedLords = new Set();
let collapsedFamilies = new Set();
let collapsedHouseDetails = new Set();
let jobFilter = 'all';
let familySortMode = 'social';
let editBorderMode = false;
let selectedBorderNoble = null;

const byId = function(id) { return state ? state.people.find(function(p) { return p.id === id; }) : null; };
const adult = function(p) { return p && p.alive && p.level >= 5 && isAdultAge(p); };
const headOf = function(p) { return byId(p.houseHead) || p; };
const isHead = function(p) { return Boolean(p && !byId(p.unionHead)?.alive && (p.id === state?.king || p.houseHead === p.id)); };
const partners = function(p) { return (p.partners || []).map(function(x) { return byId(x.id); }).filter(function(p) { return p?.alive; }); };

function isRoyalFamilyMember(p) {
  if (!p || !state) return false;
  if (p.id === state.king) return true;
  const king = byId(state.king);
  return partners(king).some(function(x) { return x.id === p.id; });
}

function getSpousePartner(p) {
  if (!p || !p.partners) return null;
  const rel = p.partners.find(function(r) { return r.role === 'consorte'; });
  return rel ? byId(rel.id) : null;
}

function getEffectiveTier(p) {
  if (!p || !state) return 0;
  if (p.id === state.king) return 8;
  let tier = p.social;
  if (p.unionHead && byId(p.unionHead)?.alive) {
    const chief = byId(p.unionHead);
    const mainConsort = getSpousePartner(chief);
    if (mainConsort && mainConsort.id === p.id && chief.social >= 3 && chief.social > tier && !chief.retired) {
      tier = chief.social;
    }
  }
  return tier;
}

function title(p) {
  if (!p || !state) return '';
  if (p.id === state.king) return p.sex === 'F' ? 'Rainha' : 'Rei';
  if (p.retired) return 'Nobre Aposentado';

  if (p.unionHead && byId(p.unionHead)?.alive) {
    const chief = byId(p.unionHead);
    const rel = (chief.partners || []).find(function(r) { return r.id === p.id; });
    const isConsort = rel && rel.role === 'consorte';
    const isConcubine = rel && rel.role === 'concubino(a)';

    if (chief.social >= 3 || chief.retired) {
      if (chief.retired) {
        if (isConsort) return 'Consorte de Nobre Aposentado';
        if (isConcubine) return p.sex === 'F' ? 'Concubina de Nobre Aposentado' : 'Concubino de Nobre Aposentado';
      } else {
        if (isConsort) {
          const tier = getEffectiveTier(p);
          return p.sex === 'F' ? (FEMALE_TITLES[tier] || 'Plebeia') : (MALE_TITLES[tier] || 'Plebeu');
        }
        if (isConcubine) {
          const chiefRole = chief.sex === 'F' ? 'Matriarca' : 'Patriarca';
          return (p.sex === 'F' ? 'Concubina do ' : 'Concubino do ') + chiefRole + ' ' + esc(chief.name);
        }
      }
    }
  }

  if (p.social > 0) {
    const tier = getEffectiveTier(p);
    return p.sex === 'F' ? (FEMALE_TITLES[tier] || 'Plebeia') : (MALE_TITLES[tier] || 'Plebeu');
  }

  const chief = headOf(p);
  if (chief && (chief.social >= 3 || chief.retired) && chief.id !== p.id && (!p.partners || p.partners.length === 0)) {
    if (chief.retired) return 'Nobre ' + esc(chief.family);
    const landType = LAND_NAME[chief.social] || 'Baronato';
    if (chief.heir === p.id) {
      return (p.sex === 'F' ? 'Herdeira ' : 'Herdeiro ') + landType + ' ' + esc(chief.family);
    }
    return 'Nobre ' + esc(chief.family);
  }

  return p.sex === 'F' ? 'Plebeia' : 'Plebeu';
}

function getRoyalDomainName() {
  const count = (state?.royalLands || []).length;
  if (count >= 128) return 'Ducado da Capital';
  if (count >= 32) return 'Marquesado da Capital';
  if (count >= 16) return 'Condado da Capital';
  if (count >= 8) return 'Viscondado da Capital';
  if (count >= 4) return 'Baronato da Capital';
  return 'Capital';
}

function promotionCost(tier) {
  return [0, 20, 80, 180, 360, 720, 1400, 2800][tier] || 0;
}

function ensurePerson(p) {
  const isKing = state?.king ? p.id === state.king : true;
  const currentDay = state?.day || 1;

  p.partners = p.partners || (p.spouse ? [{ id: p.spouse, role: 'consorte', day: currentDay }] : []);
  p.liege = p.liege || null;
  p.promotedAt = p.promotedAt || 0;
  p.order = p.order || 'idle';
  p.territory = p.territory !== undefined ? p.territory : null;
  p.tiles = p.tiles || (p.territory !== null ? [p.territory] : []);
  p.traits = p.traits || [];
  p.heir = p.heir || null;
  p.retired = p.retired || false;
  p.lastRaid = p.lastRaid || -12;
  p.genes.texture = p.genes.texture !== undefined ? p.genes.texture : (p.genes.style === 1 ? 1 : 0);
  p.hairstyle = p.hairstyle !== undefined ? p.hairstyle : p.genes.style;
  delete p.origins.style;
  p.appearance = p.appearance || { face: rand(4), build: rand(3) };
  p.source = p.source || { type: isKing ? 'founder' : 'legacy', day: currentDay };
  p.treasury = p.treasury || { wood: 0, iron: 0, food: 0, gold: 0 };
  if (p.barbarian && !p.parents.length && p.source.type === 'birth') p.source = { type: 'adult', day: currentDay };
  if (adult(p) && !p.adultTraitsSet) {
    if (Math.random() < 0.14) p.traits.push('sexy');
    if (Math.random() < 0.2) p.traits.push('pragmático');
    if (Math.random() < 0.2) p.traits.push('romântico');
    p.adultTraitsSet = true;
  }
}

function updateHouseholdLeadership(a, b) {
  if (!a || !b || !state) return;
  let superior = a;
  let inferior = b;
  if (b.id === state.king || b.social > a.social) {
    superior = b;
    inferior = a;
  }
  inferior.unionHead = superior.id;
  inferior.houseHead = superior.id;
  for (const p of state.people) {
    if (p.houseHead === inferior.id && p.id !== superior.id && !byId(p.unionHead)?.alive && p.social < 2) {
      p.houseHead = superior.id;
    }
  }
}

function promoteSuccessorConcubine(head) {
  if (!head || !head.partners) return;
  const currentConsort = head.partners.find(function(r) { return r.role === 'consorte' && byId(r.id)?.alive; });
  if (!currentConsort) {
    const candidates = head.partners.filter(function(r) { return byId(r.id)?.alive; });
    candidates.sort(function(x, y) { return (x.day || 0) - (y.day || 0); });
    const nextConsort = candidates[0];
    if (nextConsort) {
      nextConsort.role = 'consorte';
      const person = byId(nextConsort.id);
      if (person) {
        const rev = person.partners.find(function(r) { return r.id === head.id; });
        if (rev) rev.role = 'consorte';
        person.spouse = head.id;
        head.spouse = person.id;
        log(person.name + ' foi elevado(a) a consorte titular da Casa ' + head.family + '.');
      }
    }
  }
}

function upgradeKingdom() {
  if (!state) return;
  const old = !state.feudalVersion;
  if (old) {
    try { localStorage.setItem(KEY + '-antes-do-conselho', JSON.stringify(state)); } catch(e) {}
  }
  state.feudalVersion = 1;
  state.proposals = state.proposals || [];
  state.proposalHistory = state.proposalHistory || {};
  state.autoEconomy = state.autoEconomy !== undefined ? state.autoEconomy : true;
  state.fertilityCursor = state.fertilityCursor || 0;
  state.promotionSequence = state.promotionSequence || 1;
  
  const startSeat = state.capitalIndex ?? ((REGIONS[state.region]?.seat !== undefined) ? REGIONS[state.region].seat : 240);
  state.royalLands = state.royalLands || [startSeat];

  for (const p of [...state.people, ...state.guests]) {
    ensurePerson(p);
    if (old && p.id === state.king) p.social = 8;
  }
  for (const p of state.people) {
    if (!p.houseHead) {
      const relatives = state.people.filter(function(x) { return x.family === p.family && x.alive; });
      relatives.sort(function(a, b) { return (b.social - a.social) || (b.age - a.age); });
      p.houseHead = (relatives.find(adult) || relatives[0] || p).id;
    }
  }
  for (const p of state.people) {
    if (p.id === state.king) {
      p.social = 8;
      p.houseHead = p.id;
      p.liege = null;
    } else if (p.social > 0 && (!byId(p.liege)?.alive || byId(p.liege).social <= p.social)) {
      p.liege = state.king;
    }
  }
  Warfare.ensure();
  repairRelationships();
  pruneProposals();
  attachWaitingVassals();
}

const originalMake = makePerson;
makePerson = function(opts) {
  const p = originalMake(opts);
  p.genes.texture = rand(4);
  p.hairstyle = rand(4);
  ensurePerson(p);
  return p;
};

const originalInitial = initial;
initial = function(...args) {
  const s = originalInitial(...args);
  const regionKey = args[0] || 'north';
  s.people[0].social = 8;
  s.people[0].houseHead = s.people[0].id;
  s.people[0].source = { type: 'founder', day: 1 };
  s.royalLands = [(REGIONS[regionKey]?.seat !== undefined) ? REGIONS[regionKey].seat : 240];
  return s;
};

inheritGenes = function(a, b) {
  const genes = { style: rand(4) };
  const origins = {};
  for (const k of ['hair', 'skin', 'eyes', 'freckles', 'brow', 'texture']) {
    const parent = Math.random() < 0.5 ? a : b;
    genes[k] = parent.genes[k] !== undefined ? parent.genes[k] : 0;
    origins[k] = parent.id;
  }
  return { genes: genes, origins: origins };
};

const originalChild = childOf;
childOf = function(a, b) {
  const p = originalChild(a, b);
  p.hairstyle = rand(4);
  const headParent = a.social >= b.social ? headOf(a) : headOf(b);
  p.houseHead = headParent.id;
  p.source = { type: 'birth', day: state?.day || 1 };
  p.traits = [];
  if ((a.traits.includes('elitista') || b.traits.includes('elitista')) ? Math.random() < 0.8 : (headOf(a).social >= 2 || headOf(b).social >= 2) && Math.random() < 0.25) {
    p.traits.push('elitista');
  }
  
  if (headParent && headParent.social >= 3) {
    evaluateHeirReplacement(headParent, p);
  }
  return p;
};

const originalRecruitGroup = recruitmentGroup;
recruitmentGroup = function(n) {
  const group = originalRecruitGroup(n);
  const familyGroup = group.some(function(p) { return p.spouse || p.partners?.length || p.parents.length; });
  const batch = crypto.randomUUID();
  for (const p of group) {
    ensurePerson(p);
    if (p.spouse && !p.partners.some(function(r) { return r.id === p.spouse; })) {
      p.partners.push({ id: p.spouse, role: 'consorte', day: state?.day || 1 });
    }
    p.source = { type: familyGroup ? 'family' : (p.level < 5 ? 'orphan' : 'adult'), day: state?.day || 1, batch: batch };
  }
  const families = [...new Set(group.map(function(p) { return p.family; }))];
  for (const name of families) {
    const members = group.filter(function(p) { return p.family === name; });
    const sorted = members.filter(adult).sort(function(a, b) { return b.age - a.age; });
    const head = sorted[0] || members[0];
    members.forEach(function(p) {
      p.houseHead = head.id;
      if (p.spouse && p.id !== head.id) p.unionHead = head.id;
    });
  }
  return group;
};

function direct(p) {
  return alive().filter(function(x) { return x.liege === p.id && x.social > 0; }).sort(function(a, b) { return a.promotedAt - b.promotedAt; });
}

function descendants(p, seen) {
  seen = seen || new Set();
  if (seen.has(p.id)) return [];
  seen.add(p.id);
  return direct(p).flatMap(function(x) { return [x, ...descendants(x, seen)]; });
}

function domainPeople(p) {
  const heads = new Set([p.id, ...descendants(p).map(function(x) { return x.id; })]);
  return alive().filter(function(x) { return heads.has(x.id) || heads.has(x.houseHead) || heads.has(x.liege); });
}

function processAutonomousLordsRecruitment() {
  if (!state) return;
  const lords = alive().filter(p => p.social === 2 || p.social === 3);
  for (const lord of lords) {
    const currentSubordinates = direct(lord);
    const maxAllowed = LORD_CAP[lord.social] || 4;
    const needed = maxAllowed - currentSubordinates.length;
    if (needed <= 0) continue;

    if (lord.social === 2) {
      const preferredSex = lord.sex;
      const pool = adults().filter(function(x) {
        return x.id !== state.king && x.id !== lord.id && x.social === 0 && (!x.liege || x.liege === state.king) && !byId(x.unionHead)?.alive && !onMission(x) && !isRoyalFamilyMember(x);
      });
      if (!pool.length) continue;

      pool.sort(function(a, b) {
        const aPref = a.sex === preferredSex ? 1 : 0;
        const bPref = b.sex === preferredSex ? 1 : 0;
        if (bPref !== aPref) return bPref - aPref;
        return b.age - a.age;
      });

      const chosen = pool.slice(0, needed);
      for (const v of chosen) {
        v.social = 1;
        v.liege = lord.id;
        v.promotedAt = state.promotionSequence++;
        v.houseHead = v.id;
        for (const f of alive()) {
          if ((v.parents.includes(f.id) || f.parents.includes(v.id) || partners(v).includes(f)) && f.social === 0) f.houseHead = v.id;
        }
        log('Fileiras: ' + title(lord) + ' ' + lord.name + ' recrutou ' + v.name + ' como seu soldado.');
      }
    } else if (lord.social === 3) {
      let pool = adults().filter(function(x) {
        return x.id !== state.king && x.id !== lord.id && x.social === 1 && (!x.liege || x.liege === state.king) && !byId(x.unionHead)?.alive && !onMission(x) && !isRoyalFamilyMember(x);
      });
      if (pool.length < needed) {
        const plebs = adults().filter(function(x) {
          return x.id !== state.king && x.id !== lord.id && x.social === 0 && (!x.liege || x.liege === state.king) && !byId(x.unionHead)?.alive && !onMission(x) && !isRoyalFamilyMember(x) && !pool.includes(x);
        });
        pool = [...pool, ...plebs];
      }
      if (!pool.length) continue;

      pool.sort(function(a, b) { return (b.rank - a.rank) || (b.age - a.age); });
      const chosen = pool.slice(0, needed);
      for (const v of chosen) {
        v.social = 2;
        v.liege = lord.id;
        v.promotedAt = state.promotionSequence++;
        log('Fileiras: ' + title(lord) + ' ' + lord.name + ' investiu ' + v.name + ' como Cavaleiro subordinado.');
      }
    }
  }
}

function attachWaitingVassals() {
  if (!state) return;
  for (let t = 2; t <= 7; t++) {
    const waiting = alive().filter(function(p) { return p.social === t && p.id !== state.king; }).sort(function(a, b) { return a.promotedAt - b.promotedAt; });
    for (const lord of waiting) {
      const candidates = alive().filter(function(x) { return x.social === t - 1 && !x.feudalGrantor && (x.liege === state.king || !byId(x.liege)?.alive) && x.id !== lord.id; }).sort(function(a, b) { return a.promotedAt - b.promotedAt; });
      for (const p of candidates) {
        if (direct(lord).length >= LORD_CAP[t]) break;
        p.liege = lord.id;
        log(p.name + ' tornou-se vassalo de ' + lord.name + '.');
      }
    }
  }
}

function grantPromotion(p, tiles) {
  if (!adult(p) || p.id === state.king || p.social >= 7) return false;
  const next = p.social + 1;
  const cost = promotionCost(next);
  if (state.gold < cost) return false;
  if (next >= 2 && (!tiles || tiles.length < LAND_SIZE[next])) return false;
  state.gold -= cost;

  p.social = next;
  p.promotedAt = state.promotionSequence++;
  p.retired = false;
  p.order = 'idle';
  p.tiles = next >= 2 ? tiles : [];
  p.territory = next >= 2 ? tiles[0] : null;

  if (byId(p.liege)?.social <= p.social) p.liege = state.king;
  if (!p.liege) p.liege = state.king;

  for (const r of p.partners) {
    const spouse = byId(r.id);
    if (spouse?.alive) updateHouseholdLeadership(p, spouse);
  }
  if (!byId(p.unionHead)?.alive) {
    p.houseHead = p.id;
    p.unionHead = null;
  }

  for (const member of alive()) {
    if (isHead(p) && (p.parents.includes(member.id) || member.parents.includes(p.id) || partners(p).includes(member)) && member.social < 2 && member.id !== state.king) {
      member.houseHead = p.id;
    }
  }

  log('Decreto real: ' + p.name + ' recebeu o título de ' + title(p) + ' por ' + cost + ' ouro.');

  if (next === 2) {
    const preferredSex = p.sex;
    const pool = adults().filter(function(x) {
      return x.id !== state.king && x.id !== p.id && x.social === 0 && (!x.liege || x.liege === state.king) && !byId(x.unionHead)?.alive && !onMission(x) && !isRoyalFamilyMember(x);
    });

    pool.sort(function(a, b) {
      const aPref = a.sex === preferredSex ? 1 : 0;
      const bPref = b.sex === preferredSex ? 1 : 0;
      if (bPref !== aPref) return bPref - aPref;
      return b.age - a.age;
    });

    const chosen = pool.slice(0, 4);
    for (const v of chosen) {
      v.social = 1;
      v.liege = lord.id;
      v.promotedAt = state.promotionSequence++;
      v.houseHead = v.id;
      for (const f of alive()) {
        if ((v.parents.includes(f.id) || f.parents.includes(v.id) || partners(v).includes(f)) && f.social === 0) f.houseHead = v.id;
      }
    }
    if (chosen.length) {
      log('Investidura: ' + p.name + ' recrutou ' + chosen.length + ' soldados (' + chosen.map(function(s) { return s.name; }).join(', ') + ') sob seu comando.');
    }
  }

  if (next === 3) {
    let pool = adults().filter(function(x) {
      return x.id !== state.king && x.id !== p.id && x.social === 1 && !byId(x.unionHead)?.alive && !onMission(x) && !isRoyalFamilyMember(x);
    });
    if (pool.length < 4) {
      const plebs = adults().filter(function(x) {
        return x.id !== state.king && x.id !== p.id && x.social === 0 && (!x.liege || x.liege === state.king) && !byId(x.unionHead)?.alive && !onMission(x) && !isRoyalFamilyMember(x) && !pool.includes(x);
      });
      pool = [...pool, ...plebs];
    }

    pool.sort(function(a, b) { return (b.rank - a.rank) || (b.age - a.age); });
    const chosenKnights = pool.slice(0, 4);
    for (const k of chosenKnights) {
      k.social = 2;
      k.liege = p.id;
      k.promotedAt = state.promotionSequence++;
    }
    if (chosenKnights.length) {
      log('Corte Feudal: ' + title(p) + ' ' + p.name + ' investiu ' + chosenKnights.length + ' Cavaleiros (' + chosenKnights.map(function(k) { return k.name; }).join(', ') + ') no comando do seu baronato.');
    }
  }

  attachWaitingVassals();
  return true;
}

function promotionDialog(id, preselectedTiles) {
  const p = byId(id);
  if (!adult(p) || p.social >= 7 || p.id === state.king) return toast('Este personagem não pode receber outra promoção.');
  
  if (p.unionHead && byId(p.unionHead)?.alive) {
    const chief = byId(p.unionHead);
    if (chief.social >= 3) {
      return toast('Consortes de nobres (Barão ou superior) herdam o título e não recebem promoção individual.');
    }
  }

  const t = p.social + 1;
  const targetSize = LAND_SIZE[t] || 1;
  const clusters = t >= 2 ? getAvailableConnectedClusters(targetSize, p) : [];
  
  let modalBody = '<p>' + esc(p.name) + ' · custo ' + promotionCost(t) + ' ouro' + (t === 2 ? ' (promoverá até 4 soldados imediatamente)' : t === 3 ? ' (promoverá até 4 cavaleiros imediatamente)' : '') + '.</p>';
  if (t >= 2) {
    if (!clusters.length && !preselectedTiles) {
      modalBody += '<p class="bad">Atenção: A Coroa não possui vilas conectadas livres suficientes para este feudo (A Capital Real está protegida). Compre mais vilas no mapa mundi antes de promover!</p>';
    } else {
      modalBody += '<button data-land-pick="' + p.id + '" class="full" style="margin-bottom:12px;">🗺️ Escolher território no mapa</button>';
      modalBody += '<label>Território de comando (' + targetSize + ' vilas conectadas):</label><select id="promotion-land-cluster">';
      
      if (preselectedTiles && preselectedTiles.length === targetSize) {
        modalBody += '<option value="' + preselectedTiles.join(',') + '" selected>★ Seleção Feita no Mapa (' + preselectedTiles.length + ' vilas)</option>';
      }
      
      modalBody += clusters.map(function(cluster, idx) {
        const isMatch = preselectedTiles && preselectedTiles.join(',') === cluster.join(',');
        return '<option value="' + cluster.join(',') + '" ' + (isMatch ? 'selected' : '') + '>Opção ' + (idx + 1) + ' · ' + cluster.length + ' vilas conectadas (Início: Vila ' + (cluster[0] + 1) + ')</option>';
      }).join('');
      modalBody += '</select><p class="hint">Suas terras atuais foram aproveitadas e conectadas para a expansão do feudo.</p>';
    }
  }
  modalBody += '<button class="primary" data-grant="' + p.id + '" ' + (state.gold < promotionCost(t) || (t >= 2 && !clusters.length && !preselectedTiles) ? 'disabled' : '') + '>Conceder título</button>';
  modal('Decreto: ' + SOCIAL[t], modalBody);
  
  drawMap();
}

function setOrder(p, order) {
  if (!ORDERS[order] || p.social < 2) return;
  if (p.liege !== state.king && p.id !== state.king) return toast('Dê ordens ao senhor direto desta casa.');
  p.order = order;
  for (const v of descendants(p)) {
    if (v.social >= 2) v.order = order;
  }
  log('Ordem real à Casa ' + p.family + ': ' + ORDERS[order] + '.');
  save();
  render();
}

function effectiveLord(p) {
  if (!state) return null;
  let h = headOf(p);
  if (h.id === state.king) return null;
  if (h.social === 0) return null;
  const seen = new Set();
  while (h.liege && h.liege !== state.king && !seen.has(h.id)) {
    seen.add(h.id);
    const parent = byId(h.liege);
    if (!parent?.alive) break;
    h = parent;
  }
  return h.social >= 2 ? h : null;
}

function acceptance(a, b) {
  let chance = 0.62 + (b.rank - a.rank) * 0.065;
  const low = headOf(b).social < headOf(a).social;
  if (a.traits.includes('elitista') && low) chance -= 0.65;
  if (b.traits.includes('sexy')) chance += 0.46;
  if (a.traits.includes('romântico') && b.traits.includes('sexy')) chance += 0.12;
  if (a.traits.includes('pragmático')) chance += (b.rank - a.rank) * 0.045;
  return clamp(chance, 0.04, 0.95);
}

function canUnion(a, b) {
  if (!adult(a) || !adult(b) || !isHead(a) || a.id === b.id || a.sex === b.sex || related(a, b) || partners(a).includes(b) || partners(b).length > 0) return false;
  const rankA = Math.max(getEffectiveTier(a), getEffectiveTier(headOf(a)));
  const rankB = Math.max(getEffectiveTier(b), getEffectiveTier(headOf(b)));
  if (rankA < rankB && (rankB - rankA) > 1) return false;
  return true;
}

marriageCandidates = function(p) { return adults().filter(function(x) { return canUnion(p, x); }); };
hasSpouse = function(p) { return partners(p).length > 0; };

function pruneProposals() {
  if (!state) return;
  const king = byId(state.king);
  state.proposals = (state.proposals || []).filter(function(x) {
    const target = byId(x.person);
    if (!target) return false;
    const recipient = x.recipient ? byId(x.recipient) : king;
    const recipientTier = getEffectiveTier(recipient);
    const targetTier = getEffectiveTier(target);
    if (recipientTier >= 8 && targetTier <= 1) return false;
    return canUnion(recipient, target);
  });
}

function absorbHouse(a, b) {
  updateHouseholdLeadership(a, b);
}

function unite(a, b) {
  if (!canUnion(a, b)) return false;
  const roleChosen = partners(a).length === 0 ? 'consorte' : 'concubino(a)';
  a.partners.push({ id: b.id, role: roleChosen, day: state.day });
  b.partners.push({ id: a.id, role: roleChosen, day: state.day });
  if (roleChosen === 'consorte') {
    a.spouse = b.id;
    b.spouse = a.id;
  }
  absorbHouse(a, b);
  pruneProposals();
  log('Casamento celebrado: ' + a.name + ' e ' + b.name + ' (' + roleChosen + ').');
  return true;
}

function repairRelationships() {
  if (!state) return;
  if (state.relationshipVersion === 2) {
    for (const p of alive()) {
      if (!p.unionHead && p.houseHead !== p.id && partners(p).some(function(x) { return x.id === p.houseHead; })) p.unionHead = p.houseHead;
      if (byId(p.unionHead)?.alive) p.houseHead = byId(p.unionHead).houseHead || p.unionHead;
      else p.unionHead = null;
    }
    return;
  }
  try { localStorage.setItem(KEY + '-antes-correcao-familias', JSON.stringify(state)); } catch(e) {}
  const edges = [];
  const seen = new Set();
  for (const p of alive()) {
    for (const r of p.partners) {
      const q = byId(r.id);
      if (!q?.alive) continue;
      const key = [p.id, q.id].sort().join(':');
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ a: p, b: q, role: r.role, priority: (p.spouse === q.id && q.spouse === p.id ? 10 : 0) + (p.id === state.king || q.id === state.king ? 100 : 0) });
    }
  }
  state.relationshipHistory = state.relationshipHistory || [];
  for (const p of state.people) {
    p.unionHead = null;
    p.partners = p.partners.filter(function(r) { return !byId(r.id)?.alive; });
    p.spouse = p.partners[0]?.id || null;
  }
  for (const e of edges.sort(function(a, b) { return b.priority - a.priority; })) {
    let a = e.a;
    let b = e.b;
    if (a.unionHead || b.unionHead || a.sex === b.sex || !adult(a) || !adult(b) || related(a, b)) {
      state.relationshipHistory.push({ a: a.id, b: b.id, day: state.day, reason: 'vínculo anterior incompatível' });
      continue;
    }
    if (b.id === state.king || (!partners(a).length && (partners(b).length || a.houseHead === b.id || b.social > a.social))) {
      const temp = a; a = b; b = temp;
    }
    if (partners(b).length) {
      state.relationshipHistory.push({ a: a.id, b: b.id, day: state.day, reason: 'união sobreposta' });
      continue;
    }
    a.houseHead = a.id;
    a.partners.push({ id: b.id, role: e.role, day: state.day });
    b.partners.push({ id: a.id, role: e.role, day: state.day });
    if (e.role === 'consorte') {
      a.spouse = b.id;
      b.spouse = a.id;
    }
    absorbHouse(a, b);
  }
  state.relationshipVersion = 2;
  if (state.relationshipHistory.length) log('Conselho: vínculos familiares antigos conciliados; descendentes preservados.');
}

marry = function(aId, bId) {
  const a = byId(aId);
  const b = byId(bId);
  if (!canUnion(a, b)) return toast('Casamento indisponível: verifique maioridade, chefia familiar ou diferença social.');
  
  const targetHead = headOf(b);
  const proposerHead = headOf(a);
  let acceptChance = 1.0;
  if (targetHead.social <= 1 && proposerHead.social >= 3) {
    let baseChance = 0.5;
    if (b.traits && b.traits.includes('pragmático')) baseChance += 0.25;
    if (b.traits && b.traits.includes('romântico')) baseChance += 0.15;
    if (proposerHead.social - targetHead.social >= 3) baseChance -= 0.2;
    acceptChance = clamp(baseChance, 0.15, 0.90);
  }

  if (Math.random() < acceptChance && ((a.id === state.king || Math.random() < acceptance(a, b)) && (b.id === state.king || Math.random() < acceptance(b, a)))) {
    unite(a, b);
    toast('O casamento foi celebrado.');
  } else {
    log('A proposta de casamento entre ' + a.name + ' e ' + b.name + ' foi recusada.');
    toast('A proposta foi recusada pela família.');
  }
  save();
  render();
  refreshPersonModal();
};

function politicalCycle() {
  if (!state) return;
  pruneProposals();
  if (state.day % 12) return;
  const candidates = adults().filter(function(p) { return p.age >= 18 && !p.retired; });
  let proposals = 0;
  const availableHeads = candidates.filter(function(p) { return isHead(p) && p.social >= 2; }).sort(function() { return Math.random() - 0.5; });
  for (const a of availableHeads) {
    if (proposals >= 2) break;
    const bs = candidates.filter(function(b) {
      return canUnion(a, b) && (!state.proposalHistory[[a.id, b.id].sort().join(':')] || state.day - state.proposalHistory[[a.id, b.id].sort().join(':')] > 64);
    }).sort(function(x, y) {
      const scoreX = x.rank + (x.traits.includes('sexy') ? 3 : 0) + (x.id === headOf(a).liege ? 5 : 0);
      const scoreY = y.rank + (y.traits.includes('sexy') ? 3 : 0) + (y.id === headOf(a).liege ? 5 : 0);
      return scoreY - scoreX;
    });
    const b = bs[0];
    if (!b) continue;
    
    if (b.social <= 1 && a.social >= 3) continue;

    const key = [a.id, b.id].sort().join(':');
    state.proposalHistory[key] = state.day;
    proposals++;
    
    let acceptChance = 1.0;
    if (b.social <= 1 && a.social >= 3) {
      let baseChance = 0.5;
      if (b.traits && b.traits.includes('pragmático')) baseChance += 0.25;
      if (b.traits && b.traits.includes('romântico')) baseChance += 0.15;
      if (a.social - b.social >= 3) baseChance -= 0.2;
      acceptChance = clamp(baseChance, 0.15, 0.90);
    }

    if (a.id === state.king || b.id === state.king) {
      const other = a.id === state.king ? b : a;
      const target = a.id === state.king ? a : b;
      if (getEffectiveTier(other) <= 1) continue;
      if (!canUnion(target, other)) continue;
      if (!state.proposals.some(function(x) { return x.person === other.id; })) {
        state.proposals.push({ id: crypto.randomUUID(), person: other.id, recipient: state.king, day: state.day, role: partners(byId(state.king)).length ? 'concubino(a)' : 'consorte' });
        log('A Casa ' + headOf(other).family + ' propõe casamento de ' + other.name + ' com a Coroa.');
      }
      continue;
    }
    if (Math.random() < acceptChance && (Math.random() < acceptance(a, b) && Math.random() < acceptance(b, a))) unite(a, b);
    else log('Negociação entre ' + a.family + ' e ' + b.family + ': proposta de casamento recusada.');
  }
}

function chooseHeir(p) {
  const designated = manualHeirOf(p);
  if (designated) return designated;
  const eligible = alive().filter(function(x) {
    return x.parents.includes(p.id) && !byId(x.unionHead)?.alive && x.social < p.social;
  });
  if (!eligible.length) return null;

  eligible.sort(function(a, b) {
    if (b.rank !== a.rank) return b.rank - a.rank;
    const aMale = a.sex === 'M' ? 1 : 0;
    const bMale = b.sex === 'M' ? 1 : 0;
    if (bMale !== aMale) return bMale - aMale;
    return b.age - a.age;
  });
  return eligible[0];
}

function evaluateHeirReplacement(patriarch, newCandidate) {
  if (!patriarch || patriarch.social < 2 || manualHeirOf(patriarch)) return;
  patriarch.manualHeir = false;
  const currentHeirId = patriarch.heir;
  const bestHeir = chooseHeir(patriarch);
  if (!bestHeir) return;

  if (currentHeirId && currentHeirId !== bestHeir.id) {
    const formerHeir = byId(currentHeirId);
    if (formerHeir && formerHeir.alive) {
      if (Math.random() < 0.35) {
        const survivalChances = [0.20, 0.45, 0.70, 0.88, 0.98];
        const surviveRate = survivalChances[bestHeir.rank] !== undefined ? survivalChances[bestHeir.rank] : 0.5;
        
        if (Math.random() >= surviveRate) {
          death(bestHeir, 'em um atentado misterioso tramado na sucessão da Casa ' + patriarch.family);
          patriarch.heir = formerHeir.id;
          log('Complô sangrento: ' + bestHeir.name + ' foi assassinado! ' + formerHeir.name + ' retoma o posto de herdeiro.');
          return;
        } else {
          log('Tentativa frustrada: ' + bestHeir.name + ' sobreviveu a um complô de assassinato na Casa ' + patriarch.family + '!');
        }
      }
    }
  }
  patriarch.heir = bestHeir.id;
}

function succession(p) {
  if (p.social < 2) return false;
  const nominated = byId(p.heir);
  const heir = nominated?.alive && adult(nominated) && nominated.social < p.social && bloodDescendant(nominated,p) ? nominated : chooseHeir(p);
  if (!heir) return false;
  const old = p.social;
  heir.social = old;
  heir.liege = p.liege;
  heir.territory = p.territory;
  heir.tiles = [...new Set([...(heir.tiles || []), ...(p.tiles || [])])];
  heir.treasury = heir.treasury || {wood:0,iron:0,food:0,gold:0};
  for (const resource of ['wood','iron','food','gold']) { heir.treasury[resource] = (heir.treasury[resource] || 0) + (p.treasury?.[resource] || 0); }
  p.treasury = {wood:0,iron:0,food:0,gold:0};
  heir.order = p.order;
  heir.promotedAt = p.promotedAt;
  heir.houseHead = heir.id;
  heir.unionHead = null;
  if (p.feudalGrantor) heir.feudalGrantor = p.feudalGrantor;
  p.social = 0;
  p.retired = true;
  p.liege = null;
  p.territory = null;
  p.tiles = [];
  for (const f of state.people) {
    if (f.houseHead === p.id && !byId(f.unionHead)?.alive && f.id !== p.id) {
      f.houseHead = heir.id;
    }
    if (f.liege === p.id) f.liege = heir.id;
  }
  if (state.king === p.id) {
    state.king = heir.id;
    heir.social = 8;
  }
  const excess = direct(heir).slice(LORD_CAP[heir.social] !== undefined ? LORD_CAP[heir.social] : 0);
  for (const v of excess) v.liege = heir.liege || state.king;
  log(heir.name + ' sucedeu ' + p.name + ' no título de ' + title(heir) + '. ' + p.name + ' agora é um Nobre Aposentado.');
  return true;
}

const oldDeath = death;
death = function(p, reason) {
  const wasKing = state.king === p.id;
  const tier = p.social;
  const liege = p.liege;
  if (tier >= 2) succession(p);
  oldDeath(p, reason);
  if (wasKing && byId(state.king)) byId(state.king).social = 8;
  for (const v of direct(p)) v.liege = byId(liege)?.alive ? liege : state.king;
  for (const partner of partners(p)) promoteSuccessorConcubine(partner);
  const household = alive().filter(function(x) { return x.houseHead === p.id; });
  if (household.length) {
    const sorted = household.filter(adult).sort(function(a, b) { return b.age - a.age; });
    const caretaker = sorted[0] || household[0];
    household.forEach(function(x) { x.houseHead = caretaker.id; });
  }
};

function autonomousLordManagement() {
  if (!state) return;
  const lords = alive().filter(p => p.social >= 2 && p.id !== state.king);
  for (const lord of lords) {
    const domainWorkers = alive().filter(p => p.id !== lord.id && (headOf(p).id === lord.id || p.liege === lord.id) && adult(p) && !onMission(p) && p.jobMode !== 'manual');
    if (!domainWorkers.length) continue;

    const order = lord.order || 'balance';
    if (order === 'wood' || order === 'iron' || order === 'food') {
      domainWorkers.forEach(w => w.job = order);
    } else if (order === 'balance') {
      domainWorkers.forEach((w, idx) => {
        w.job = ['food', 'wood', 'iron'][idx % 3];
      });
    } else if (order === 'raid') {
      domainWorkers.forEach((w, idx) => {
        w.job = idx === 0 ? 'train' : 'food';
      });
    }
  }
}

function governmentCycle() {
  if (!state) return;
  for (const p of alive()) {
    ensurePerson(p);
    if (p.social >= 3) {
      const best = chooseHeir(p);
      if (best && (!p.heir || p.heir !== best.id)) {
        evaluateHeirReplacement(p, best);
      }
      if (p.age >= 60 && p.id !== state.king && p.heir && adult(byId(p.heir))) {
        succession(p);
      }
    }
  }
  processAutonomousLordsRecruitment();
  attachWaitingVassals();
  autonomousLordManagement();

  if (!state.battle?.active && state.buildings.barracks) {
    const lords = direct(byId(state.king)).filter(function(p) {
      return p.social >= 2 && p.order === 'raid' && state.day - p.lastRaid >= 12;
    }).sort(function(a, b) { return a.lastRaid - b.lastRaid; });
    for (const lord of lords) {
      const pool = domainPeople(lord).filter(function(p) {
        return p.id !== lord.id && p.social >= 1 && adult(p) && p.hp >= 65 && !onMission(p) && !isRoyalFamilyMember(p);
      }).sort(function(a, b) { return power(b) - power(a); });
      if (pool.length < 4) continue;
      if (state.food < 15) continue;
      const previous = selection;
      selection = pool.slice(0, 4).map(function(p) { return p.id; });
      startBattle();
      selection = previous;
      if (state.battle?.active) {
        state.battle.commander = lord.id;
        lord.lastRaid = state.day;
        log(lord.name + ' designou ' + pool.slice(0, 4).map(function(p) { return p.name; }).join(', ') + ' para uma raid.');
      }
      break;
    }
  }
}

const oldReveal = reveal;
reveal = function(p) {
  if (!isAdultAge(p) || p.level >= 5) return;
  oldReveal(p);
  ensurePerson(p);
  p.hairstyle = rand(4);
  if (headOf(p).social >= 2 && !p.traits.includes('elitista') && Math.random() < 0.25) p.traits.push('elitista');
};

power = function(p) {
  return (p.attrs.força + p.attrs.magia * 0.8 + p.attrs.agilidade * 0.5) * (1 + (p.level - 5) * 0.07) * (p.hp / 100);
};

function personLink(p) {
  return '<button class="family-node" data-person="' + p.id + '">' + portrait(p, 'mini-portrait') + '<span><b>' + esc(p.name) + ' ' + esc(p.family) + '</b><small>' + title(p) + ' · ' + (p.level < 5 ? 'Criança' : RANKS[p.rank]) + (!p.alive ? ' · †' : '') + (p.debut ? ' · DEBUT' : '') + '</small></span></button>';
}

function genealogy(p, seen, depth, house) {
  seen = seen || new Set();
  depth = depth || 0;
  house = house || p.houseHead;
  if (seen.has(p.id) || depth > 12) return '';
  seen.add(p.id);
  const spouses = partners(p).filter(function(x) { return !seen.has(x.id); });
  spouses.forEach(function(x) { seen.add(x.id); });
  const parentIds = new Set([p.id, ...spouses.map(function(x) { return x.id; })]);
  const children = state.people.filter(function(x) {
    return !seen.has(x.id) && x.parents.some(function(id) { return parentIds.has(id); });
  });
  let html = '<li><div class="couple-row">' + personLink(p) + spouses.map(personLink).join('') + '</div>';
  if (children.length) {
    html += '<ul>' + children.map(function(x) { return genealogy(x, seen, depth + 1, house); }).join('') + '</ul>';
  }
  html += '</li>';
  return html;
}

function peopleCard(p) {
  let jobStatusDesc = p.alive ? JOBS[p.job] : ('Memorial † ' + (p.deathReason ? '(' + p.deathReason + ')' : ''));
  if (p.alive && isRoyalFamilyMember(p)) {
    jobStatusDesc = 'Corte Real';
  }
  
  let spouseBadgeHtml = '';
  const activePartners = partners(p);
  if (p.alive && activePartners.length > 0) {
    const mainConsort = activePartners[0];
    const spouseImgUrl = artURL(mainConsort, true);
    spouseBadgeHtml += '<div class="citizen-spouse-badge" title="Cônjuge: ' + esc(mainConsort.name) + '"><img src="' + spouseImgUrl + '" alt="Cônjuge"></div>';
    if (activePartners.length > 1) {
      const extraCount = activePartners.length - 1;
      spouseBadgeHtml += '<div class="citizen-concubine-count">+' + extraCount + '</div>';
    }
  }

  return '<button class="citizen-card ' + (!p.alive ? 'memorial-card' : '') + '" data-person="' + p.id + '">' + portrait(p) + '<div class="citizen-info"><h2>' + esc(p.name) + ' ' + esc(p.family) + '</h2><p>' + sexLabel(p) + ' · ' + stage(p) + ' · ' + Math.floor(p.age) + ' anos · ' + raceLabel(p) + '</p><span class="rank rank-' + p.rank + '">' + (p.level < 5 ? 'Rank oculto' : RANKS[p.rank]) + '</span> ' + (p.debut ? '<span class="badge">DEBUT</span>' : '') + '<span class="citizen-class">' + title(p) + ' · ' + (p.vocation || 'Em formação') + '</span><small style="' + (!p.alive ? 'color:#e69b91;font-weight:600;' : '') + '">' + jobStatusDesc + '</small></div>' + spouseBadgeHtml + '</button>';
}

peopleView = function() {
  let jobOptions = '<option value="all" ' + (jobFilter === 'all' ? 'selected' : '') + '>Todas as ocupações</option>';
  for (const entry of Object.entries(JOBS)) {
    jobOptions += '<option value="' + entry[0] + '" ' + (jobFilter === entry[0] ? 'selected' : '') + '>' + entry[1] + '</option>';
  }

  const toolbar = '<div class="view-tools"><div class="subtabs">' + 
    [['all', 'Todos'], ['families', 'Famílias'], ['immigrants', 'Imigrantes']].map(function(pair) { 
      return '<button data-people-tab="' + pair[0] + '" class="' + (peopleTab === pair[0] ? 'primary' : '') + '">' + pair[1] + '</button>'; 
    }).join('') + 
    '</div><div style="display:flex;gap:8px;align-items:center;">' +
    (peopleTab === 'families' ? '<button data-toggle-sort="true" class="secondary">Classificar: ' + (familySortMode === 'social' ? 'Por Hierarquia' : 'Por Nome') + '</button>' : '') +
    '<select id="filter-by-job">' + jobOptions + '</select>' +
    '<button data-action="recruit-info">⚑ Recrutar</button></div></div>';

  if (peopleTab === 'all') {
    let list = state.people.slice();
    if (jobFilter !== 'all') {
      list = list.filter(function(p) { return p.job === jobFilter; });
    }
    
    const living = list.filter(function(p) { return p.alive; });
    const deceased = list.filter(function(p) { return !p.alive; });

    const sortFn = function(a, b) {
      const tierA = getEffectiveTier(a);
      const tierB = getEffectiveTier(b);
      return (tierB - tierA) || (b.rank - a.rank) || (b.age - a.age);
    };

    living.sort(sortFn);
    deceased.sort(sortFn);

    let html = toolbar + '<p class="hint">Exibindo ' + living.length + ' moradores vivos organizados por hierarquia, raridade e idade.</p><div class="people-grid">' + (living.map(peopleCard).join('') || '<p class="hint">Nenhum cidadão vivo encontrado nesta ocupação.</p>') + '</div>';

    if (deceased.length > 0) {
      html += '<div style="margin-top:28px;border-top:2px solid #3e5769;padding-top:14px;"><h2 style="margin-bottom:12px;color:#e69b91;">Memorial dos Falecidos (' + deceased.length + ')</h2><div class="people-grid">' + deceased.map(peopleCard).join('') + '</div></div>';
    }

    return html;
  }

  if (peopleTab === 'families') {
    const rawHeadIds = [...new Set(state.people.map(function(p) {
      return p.houseHead;
    }))];

    let familiesData = rawHeadIds.map(function(id) {
      const chief = byId(id);
      if (!chief) return null;
      let members = state.people.filter(function(p) {
        return p.houseHead === id;
      });
      let highestTier = getEffectiveTier(chief);
      let highestRank = chief.rank;
      let oldestAge = chief.age;
      for (let i = 0; i < members.length; i++) {
        const m = members[i];
        const mTier = getEffectiveTier(m);
        if (mTier > highestTier) highestTier = mTier;
        if (m.rank > highestRank) highestRank = m.rank;
        if (m.age > oldestAge) oldestAge = m.age;
      }
      return {
        chief: chief,
        members: members,
        effectiveRank: highestTier,
        maxRank: highestRank,
        maxAge: oldestAge
      };
    }).filter(Boolean);

    if (familySortMode === 'social') {
      familiesData.sort(function(a, b) {
        return (b.effectiveRank - a.effectiveRank) || (b.maxRank - a.maxRank) || (b.maxAge - a.maxAge) || a.chief.family.localeCompare(b.chief.family);
      });
    } else {
      familiesData.sort(function(a, b) {
        return a.chief.family.localeCompare(b.chief.family);
      });
    }

    let familiesHtml = familiesData.map(function(fam) {
      let filteredMembers = fam.members;
      if (jobFilter !== 'all') {
        filteredMembers = filteredMembers.filter(function(p) { return p.job === jobFilter; });
        if (!filteredMembers.length) return '';
      }
      const seen = new Set();
      const isOpen = !collapsedFamilies.has(fam.chief.id);
      return '<details class="family-tree" ' + (isOpen ? 'open' : '') + ' data-family-id="' + fam.chief.id + '"><summary>Casa ' + esc(fam.chief.family) + ' — ' + title(fam.chief) + ' ' + esc(fam.chief.name) + ' · ' + fam.members.length + ' membros</summary><ul>' + genealogy(fam.chief, seen, 0, fam.chief.id) + '</ul></details>';
    }).join('');

    return toolbar + (familiesHtml || '<p class="hint">Nenhuma família com membros nesta ocupação.</p>');
  }

  let immigrantList = state.people.slice();
  if (jobFilter !== 'all') {
    immigrantList = immigrantList.filter(function(p) { return p.job === jobFilter; });
  }

  return toolbar + [['adult', 'Chegaram adultos'], ['family', 'Chegaram com suas famílias'], ['orphan', 'Chegaram como crianças órfãs'], ['legacy', 'Campanha anterior · origem não registrada']].map(function(pair) {
    const groupMembers = immigrantList.filter(function(p) { return p.source.type === pair[0]; });
    return '<section class="immigrant-group"><h2>' + pair[1] + '</h2><div class="people-grid">' + (groupMembers.map(peopleCard).join('') || '<p class="hint">Nenhum registro nesta categoria.</p>') + '</div></section>';
  }).join('');
};

function commandControl(p) {
  if (isRoyalFamilyMember(p)) return '';
  if (p.social < 2) return '';
  const lordCount = direct(p).length;
  const maxCap = LORD_CAP[p.social] === Infinity ? '∞' : LORD_CAP[p.social];
  let selectHtml = '';
  if (p.liege === state.king || p.id === state.king) {
    selectHtml = '<select data-order="' + p.id + '" aria-label="Ordem à Casa ' + esc(p.family) + '">' + Object.entries(ORDERS).map(function(entry) {
      return '<option value="' + entry[0] + '" ' + (p.order === entry[0] ? 'selected' : '') + '>' + entry[1] + '</option>';
    }).join('') + '</select>';
  } else {
    const parentLord = effectiveLord(p);
    const inheritedOrder = parentLord ? parentLord.order : 'idle';
    selectHtml = '<small>Ordem herdada: ' + ORDERS[inheritedOrder] + '</small>';
  }
  return '<div class="command-control"><span>' + LAND_NAME[p.social] + ' · ' + (p.tiles || []).length + ' vilas · ' + lordCount + '/' + maxCap + ' vassalos</span>' + selectHtml + '</div>';
}

function vassalTree(p, seen) {
  seen = seen || new Set();
  if (!p || seen.has(p.id)) return '';
  seen.add(p.id);
  const myHousehold = alive().filter(function(x) { return x.id !== p.id && x.houseHead === p.id; });
  const consort = getSpousePartner(p);
  const concubines = p.partners.filter(function(r) { return r.role === 'concubino(a)' && byId(r.id)?.alive; }).map(function(r) { return byId(r.id); });
  const otherHousehold = myHousehold.filter(function(x) {
    return x.id !== (consort ? consort.id : null) && !concubines.some(function(c) { return c.id === x.id; });
  });
  const subHouses = direct(p).filter(function(v) { return v.houseHead !== p.id; });
  const isCollapsed = collapsedLords.has(p.id);
  const isDetailsCollapsed = collapsedHouseDetails.has(p.id);

  let card = '<li><div class="vassal-card"><div class="lord-head" style="display:flex;justify-content:space-between;align-items:center;">';
  card += '<b>Casa ' + esc(p.family) + ' — ' + title(p) + ' ' + esc(p.name) + '</b>';
  card += '<div style="display:flex;gap:6px;">';
  if (concubines.length > 0 || otherHousehold.length > 0) {
    card += '<button data-toggle-house-details="' + p.id + '" style="padding:2px 8px;font-size:11px;background:#2d4758;">' + (isDetailsCollapsed ? 'Exibir Casa' : 'Ocultar Casa') + '</button>';
  }
  if (subHouses.length > 0) {
    card += '<button data-toggle-lord="' + p.id + '" style="padding:2px 8px;font-size:11px;">' + (isCollapsed ? '[+] Subordinados' : '[−] Subordinados') + '</button>';
  }
  card += '</div></div>' + commandControl(p) + (p.social >= 2 ? '<button data-feudal-dialog="' + p.id + '">Administrar domínio</button>' : '');
  
  card += '<div class="couple-row" style="margin-top:8px;">' + personLink(p);
  if (consort) {
    card += '<div class="relative">' + personLink(consort) + '<small style="color:var(--gold);">Consorte</small></div>';
  }
  if (!isDetailsCollapsed) {
    for (const c of concubines) {
      card += '<div class="relative">' + personLink(c) + '<small class="muted">Concubina(o)</small></div>';
    }
  }
  card += '</div>';

  if (!isDetailsCollapsed && otherHousehold.length) {
    card += '<div style="margin-top:8px;padding-top:6px;border-top:1px dashed var(--line);"><small class="muted" style="display:block;margin-bottom:4px;">Família / Descendentes na Casa:</small><div class="couple-row">' + otherHousehold.map(personLink).join('') + '</div></div>';
  }

  const heirObj = p.heir ? byId(p.heir) : null;
  card += '<small style="display:block;margin-top:6px;">' + domainPeople(p).length + ' pessoas no domínio' + (heirObj ? ' · Herdeiro: ' + esc(heirObj.name) : '') + '</small></div>';
  if (subHouses.length && !isCollapsed) {
    card += '<ul>' + subHouses.map(function(x) { return vassalTree(x, seen); }).join('') + '</ul>';
  }
  card += '</li>';
  return card;
}

function hierarchyView() {
  if (!state) return '';
  const commoners = adults().filter(function(p) { return p.social === 0 && !isRoyalFamilyMember(p); });
  let body = '<div class="view-tools"><p class="hint">A Coroa e os nobres podem conceder títulos inferiores e terras próprias a descendentes fora da sucessão principal.</p><button data-action="kingdom-rules">Regras desta versão</button></div>';
  body += '<ul class="vassal-tree">' + vassalTree(byId(state.king)) + '</ul>';
  body += '<section class="panel"><div class="panel-title"><h2>Aldeões sem título</h2></div><div class="panel-body people-grid">';
  if (commoners.length) {
    body += commoners.map(function(p) { return '<div>' + personLink(p) + '<button data-promote="' + p.id + '">Soldado · 20 ouro</button></div>'; }).join('');
  } else {
    body += '<p class="hint">Não há candidatos.</p>';
  }
  body += '</div></section>';
  return body;
}

function proposalsView() {
  if (!state) return '';
  pruneProposals();
  let body = '<section class="panel"><div class="panel-title"><h2>Propostas de Casamento à Coroa</h2></div><div class="panel-body">';
  const items = (state.proposals || []).map(function(x) {
    const p = byId(x.person);
    if (!p || !p.alive) return '';
    return '<div class="proposal-card">' + personLink(p) + '<p>' + esc(x.role) + ' · potencial ' + RANKS[p.rank] + ' · ' + (p.traits.map(esc).join(', ') || 'sem traços especiais') + '</p><button data-accept-proposal="' + x.id + '" class="primary">Aceitar Casamento</button> <button data-reject-proposal="' + x.id + '">Recusar</button></div>';
  }).filter(Boolean);
  body += (items.length ? items.join('') : '<p class="hint">Nenhuma proposta aguardando decisão.</p>') + '</div></section>';
  return body;
}

const oldDynasty = dynastyView;
dynastyView = function() {
  if (!state) return '';
  const women = alive().filter(function(p) { return p.sex === 'F'; });
  let body = '<section class="panel"><div class="panel-body">' + feudalControls(byId(state.king)) + '</div></section><div class="subtabs"><button data-view="hierarchy">Hierarquia de vassalos</button><button data-action="kingdom-rules">Regras</button></div>' + proposalsView();
  body += '<section class="panel section-space"><div class="panel-title"><h2>Nascimentos · diagnóstico por família</h2></div><div class="panel-body">';
  if (women.length) {
    body += women.map(function(p) { return '<div class="kv"><button data-person="' + p.id + '">' + esc(p.name) + ' ' + esc(p.family) + '</button><span>' + breedingStatus(p) + '</span></div>'; }).join('');
  } else {
    body += '<p class="hint">Ainda não há mulheres na vila.</p>';
  }
  body += '<p class="hint">Concepção não é garantida: tentativas a cada 4 dias, seguidas por gestação e recuperação racial. Gestações iniciadas chegam ao parto mesmo se faltar espaço ou alimento. Consulte os prazos na ficha de cada mulher.</p></div></section>';
  return body;
};

familyControls = function(p) {
  if (!state) return '';
  const children = state.people.filter(function(x) { return x.parents.includes(p.id); });
  const candidates = marriageCandidates(p);
  const nextRole = partners(p).length === 0 ? 'consorte' : 'concubina(o)';
  const heirObj = p.heir ? byId(p.heir) : null;
  const heirName = heirObj ? heirObj.name : 'aguardando descendente';

  let html = '<section class="family-section">';
  html += '<h3>Casa ' + esc(headOf(p).family) + '</h3>';
  html += '<div class="kv"><span>Chefia</span><button data-person="' + headOf(p).id + '">' + esc(headOf(p).name) + ' (' + title(headOf(p)) + ')</button></div>';
  html += '<p class="hint">' + (isHead(p) ? 'Chefe de família: o cônjuge com maior prestígio lidera a casa.' : 'Consortes e membros da casa não iniciam casamentos.') + '</p>';
  html += partners(p).map(function(x) {
    const rel = p.partners.find(function(r) { return r.id === x.id; });
    return '<div class="relative">' + personLink(x) + '<small>' + esc(rel ? rel.role : '') + '</small></div>';
  }).join('');

  if (adult(p) && isHead(p) && candidates.length) {
    html += '<label class="field-label">Propor Casamento (Automático: ' + nextRole + ')</label>';
    html += '<select id="spouse-' + p.id + '">' + candidates.map(function(x) { return '<option value="' + x.id + '">' + esc(x.name) + ' · ' + RANKS[x.rank] + ' · ' + title(x) + '</option>'; }).join('') + '</select>';
    html += '<button class="primary full" data-marry="' + p.id + '">Celebrar casamento</button>';
  } else if (adult(p) && isHead(p)) {
    html += '<p class="hint">Sem candidatos de união elegíveis (diferença social excessiva ou parentesco).</p>';
  }

  html += '<h4>Traços</h4><p>' + (p.traits.filter(function(t) { return t !== 'sexy' || adult(p); }).map(function(t) { return '<span class="tag">' + esc(t) + '</span>'; }).join(' ') || 'Nenhum traço especial') + '</p>';
  if (p.sex === 'F') html += '<p class="hint">' + breedingStatus(p) + '</p><p class="hint">' + reproductionRules(p) + '</p>';
  if (children.length) html += '<h4>Descendentes</h4>' + children.map(personLink).join('');
  if (p.social >= 2 && !isRoyalFamilyMember(p)) {
    html += '<h4>Comando</h4>' + commandControl(p);
    if (p.social >= 3) {
      html += '<p class="hint">Herdeiro escolhido pela casa: ' + esc(heirName) + '.</p>';
      if (p.age >= 60 && chooseHeir(p)) html += '<button data-retire="' + p.id + '">Abdicar em favor do herdeiro</button>';
    }
  }
  html += feudalControls(p);
  html += '<h4>Aparência pessoal</h4><p class="hint">Textura herdada: ' + TEXTURES[p.genes.texture] + '. Penteados não são herdados. A arte adulta utiliza o figurino do rank.</p></section>';
  return html;
};

const oldTraitRows = traitRows;
traitRows = function(p) {
  const base = oldTraitRows(p).replace(/<div class="trait"><span>Tipo<\/span>[\s\S]*?<\/div>/, '');
  const textureOrigin = byId(p.origins?.texture);
  const textureHtml = '<div class="trait"><span>Textura do cabelo</span><b>' + TEXTURES[p.genes.texture] + '</b>' + (textureOrigin ? '<small>de ' + esc(textureOrigin.name) + '</small>' : '') + '</div>';
  return base + textureHtml;
};

function morton(n) {
  let x = 0;
  let y = 0;
  for (let b = 0; b < 5; b++) {
    x |= ((n >> (2 * b)) & 1) << b;
    if (b < 4) y |= ((n >> (2 * b + 1)) & 1) << b;
  }
  return { x: x, y: y };
}

function regionPanel(index) {
  if (!state) return '';
  const isRoyal = (state.royalLands || []).includes(index);
  const owner = alive().find(function(p) {
    return p.social >= 2 && p.id !== state.king && (p.tiles || [p.territory]).includes(index);
  });
  const province = TerritoryGeometry.get(index);
  const price = province.price;
  const enemy = Warfare.owner(index);
  const biome = getTileBiome(index);
  const biomeLabels = { floresta: '🌲 Bosques Densos', lago: '🌊 Oceano Costeiro', mina: '⛰️ Cordilheira Mineral', planicie: '🌾 Planície Fértil' };
  
  let html = '<div class="inspector-head"><span class="eyebrow">TERRITÓRIO</span><h2>Vila ' + (index + 1) + '</h2></div><div class="inspector-scroll">';
  html += '<div class="kv"><span>Relevo / Bioma</span><b>' + (biomeLabels[biome] || 'Planície') + '</b></div>';

  html += '<div class="kv"><span>Área terrestre</span><b>' + province.landArea.toFixed(1) + ' km²</b></div>';
  html += '<div class="kv"><span>Posse direta</span><b>' + (owner ? 'Casa ' + esc(owner.family) + ' · ' + title(owner) : isRoyal ? 'Coroa' : enemy ? esc(enemy.name) : 'Terra livre') + '</b></div>';
  if (enemy) {
    html += '<p>Território de outro reino · guarnição: ' + Math.ceil(enemy.garrisons[index] || 12) + '.</p>';
    html += enemy.atWar ? '<button data-war-muster="' + index + '">Mobilizar para conquistar</button>' : '<button data-war-declare="' + enemy.id + '">Declarar guerra</button>';
  } else if (isRoyal || owner) {
    html += '<p class="description" style="color:var(--gold);margin-top:10px;"><b>' + (owner ? 'Feudo vassalo · gestão da Casa ' + esc(owner.family) : 'Domínio direto da Coroa') + '</b></p>';
  } else {
    html += '<p class="description" style="margin-top:10px;">Terra livre fora da posse da Coroa.</p>';
    html += '<button class="primary full" data-buy-land="' + index + '" ' + (price === null || state.gold < price ? 'disabled' : '') + '>' + (price === null ? 'Sem terras anexáveis' : 'Anexar ao Reino · ' + price + ' ouro') + '</button>';
  }

  if (owner) {
    html += '<div style="margin-top:14px;"><h4>Feudo Concedido:</h4>' + personLink(owner) + commandControl(owner) + '</div>';
  } else if (isRoyal) {
    html += index === (state.capitalIndex ?? REGIONS[state.region]?.seat ?? 240)
      ? '<p class="hint">Capital do reino · protegida contra concessões de terras.</p>'
      : '<p class="hint">Domínio direto da Coroa.</p><button class="full" data-move-capital="' + index + '" ' + (price === null ? 'disabled' : '') + '>Transferir capital para cá</button><p class="hint">Transfere a sede sem custo, mantendo moradores, construções e posses.</p>';
  }

  html += '<button data-view="hierarchy" class="full" style="margin-top:12px;">Administrar títulos</button></div>';
  return html;
}

function kingdomRules() {
  modal('Regras do conselho', '<p>Soldado 20 · Cavaleiro 80 · Barão 180 · Visconde 360 · Conde 720 · Marquês 1.400 · Duque 2.800 ouros. A patente de soldado não concede bônus de combate.</p><p>As vilas de novos feudos devem obrigatoriamente fazer parte das terras da Coroa.</p><p>A Coroa compra províncias livres por preços proporcionais à área terrestre e ajustados pelo relevo. Feudos usam províncias vizinhas pelos contornos do atlas.</p><p>O sistema tributário cobra taxas feudais em cascata que sobem pelos suseranos até o cofre da Capital.</p>');
}

document.addEventListener('click', function(e) {
  const b = e.target.closest('button');
  if (b && b.dataset.toggleBorderEdit) {
    editBorderMode = !editBorderMode;
    selectedBorderNoble = null;
    render();
    toast(editBorderMode ? 'Modo de Edição de Fronteiras ativado. Clique em um feudo.' : 'Modo de Edição desativado.');
    return;
  }
  if (b && b.dataset.toggleSort) {
    familySortMode = familySortMode === 'social' ? 'name' : 'social';
    render();
    return;
  }
  if (b && b.dataset.toggleLord) {
    const id = b.dataset.toggleLord;
    if (collapsedLords.has(id)) collapsedLords.delete(id);
    else collapsedLords.add(id);
    render();
    return;
  }
  if (b && b.dataset.toggleHouseDetails) {
    const id = b.dataset.toggleHouseDetails;
    if (collapsedHouseDetails.has(id)) collapsedHouseDetails.delete(id);
    else collapsedHouseDetails.add(id);
    render();
    return;
  }
  if (b && b.dataset.moveCapital !== undefined) {
    moveCapital(Number(b.dataset.moveCapital));
    return;
  }
  if (b && b.dataset.buyLand) {
    buyLand(Number(b.dataset.buyLand));
    return;
  }
  if (!b) return;
  if (b.dataset.landPick) {
    pendingLand = b.dataset.landPick;
    $('#modal').close();
    view = 'map';
    render();
    toast('Clique no mapa para posicionar ou expandir o feudo.');
  }
  if (b.dataset.peopleTab) {
    peopleTab = b.dataset.peopleTab;
    render();
  }
  if (b.dataset.grant) {
    const p = byId(b.dataset.grant);
    const clusterStr = $('#promotion-land-cluster') ? $('#promotion-land-cluster').value : '';
    const tiles = clusterStr ? clusterStr.split(',').map(Number) : null;
    if (grantPromotion(p, tiles)) {
      save();
      $('#modal').close();
      render();
      toast('Título concedido e terras atribuídas!');
    } else {
      toast('Promoção indisponível: verifique ouro e terras disponíveis.');
    }
  }
  if (b.dataset.acceptProposal) {
    const offer = state.proposals.find(function(x) { return x.id === b.dataset.acceptProposal; });
    const p = byId(offer ? offer.person : null);
    if (p && unite(byId(state.king), p)) {
      state.proposals = state.proposals.filter(function(x) { return x.id !== offer.id; });
      save();
      render();
    } else {
      pruneProposals();
      save();
      render();
      toast('A proposta não é mais válida.');
    }
  }
  if (b.dataset.rejectProposal) {
    state.proposals = state.proposals.filter(function(x) { return x.id !== b.dataset.rejectProposal; });
    save();
    render();
  }
  if (b.dataset.retire) {
    const p = byId(b.dataset.retire);
    if (succession(p)) {
      save();
      render();
      refreshPersonModal();
    }
  }
  if (b.dataset.action === 'kingdom-rules') kingdomRules();
});

document.addEventListener('toggle', function(e) {
  if (e.target.classList.contains('family-tree') && e.target.dataset.familyId) {
    const id = e.target.dataset.familyId;
    if (e.target.open) collapsedFamilies.delete(id);
    else collapsedFamilies.add(id);
  }
}, true);

document.addEventListener('change', function(e) {
  if (e.target.id === 'promotion-land-cluster') {
    drawMap();
    return;
  }
  if (e.target.id === 'filter-by-job') {
    jobFilter = e.target.value;
    render();
    return;
  }
  if (e.target.dataset.order) setOrder(byId(e.target.dataset.order), e.target.value);
  if (e.target.id === 'auto-economy') {
    state.autoEconomy = e.target.checked;
    save();
    render();
  }
  if (e.target.dataset.hairstyle) {
    const p = byId(e.target.dataset.hairstyle);
    p.hairstyle = +e.target.value;
    artCache.clear();
    save();
    render();
    refreshPersonModal();
  }
});

if (!NAV.some(item => item[0] === 'hierarchy')) {
  NAV.push(['hierarchy', '♜', 'Hierarquia']);
}

const baseRender = render;
render = function() {
  if (!state) {
    baseRender();
    return;
  }
  const sc = $('.realm-scroll');
  const ws = $('.workspace');
  const ix = $('.inspector-scroll');
  const positions = [
    sc ? [sc.scrollLeft, sc.scrollTop] : null,
    ws ? [ws.scrollLeft, ws.scrollTop] : null,
    ix ? [ix.scrollLeft, ix.scrollTop] : null
  ];
  
  baseRender();

  pruneProposals();
  const proposalCount = state.proposals ? state.proposals.length : 0;
  const dynastyTabBtn = document.querySelector('button[data-view="dynasty"]');
  if (dynastyTabBtn) {
    let badge = dynastyTabBtn.querySelector('.badge');
    if (proposalCount > 0) {
      if (!badge) {
        badge = document.createElement('em');
        badge.className = 'badge';
        dynastyTabBtn.appendChild(badge);
      }
      badge.textContent = String(proposalCount);
    } else if (badge) {
      badge.remove();
    }
  }

  let chatBox = document.querySelector('#global-chat-panel');
  if (!chatBox) {
    chatBox = document.createElement('details');
    chatBox.id = 'global-chat-panel';
    chatBox.className = 'realm-chat';
    chatBox.open = true;
    chatBox.style.cssText = 'position:fixed;right:15px;bottom:38px;width:320px;z-index:90;background:#142a3deb;border:1px solid #738695;color:#d6e1dd;font-size:12px;box-shadow:0 4px 15px #14232c66;';
    document.body.appendChild(chatBox);
  }
  const chatLogs = (state.logs || []).slice(0, 16).map(function(l) {
    return '<p style="padding:4px 0;border-top:1px solid #415360;margin:0;"><time style="color:#c9b681;margin-right:6px;">D' + l.day + '</time>' + esc(l.text) + '</p>';
  }).join('');
  chatBox.innerHTML = '<summary style="padding:8px;cursor:pointer;color:var(--gold);font-weight:600;">Crônicas do Reino (Logs)</summary><div style="max-height:160px;overflow:auto;padding:0 10px 8px;display:flex;flex-direction:column;">' + chatLogs + '</div>';

  ['.realm-scroll', '.workspace', '.inspector-scroll'].forEach(function(selector, i) {
    const el = $(selector);
    if (el && positions[i]) {
      el.scrollLeft = positions[i][0];
      el.scrollTop = positions[i][1];
    }
  });
};

const automaticSetJob = setJob;
setJob = function(p, job) {
  if (!adult(p) || onMission(p)) return toast('Este cidadão não está disponível.');
  if (isRoyalFamilyMember(p)) return toast('Membros da corte real não realizam trabalhos comuns.');
  if (job === 'auto') {
    p.jobMode = 'auto';
    save();
    render();
    refreshPersonModal();
    return;
  }
  if (!Object.hasOwn(JOBS, job)) return;
  if (job === 'train' && !state?.buildings.barracks) return toast('Construa um quartel primeiro.');
  p.jobMode = 'manual';
  automaticSetJob(p, job);
};

const automaticJobSelect = jobSelect;
jobSelect = function(p) {
  if (!adult(p) || onMission(p)) return automaticJobSelect(p);
  if (isRoyalFamilyMember(p)) return '<span class="muted">Corte Real (Governo)</span>';
  let opts = '<option value="auto" ' + (p.jobMode !== 'manual' ? 'selected' : '') + '>Automático · ' + JOBS[p.job] + '</option>';
  for (const entry of Object.entries(JOBS)) {
    const k = entry[0];
    const n = entry[1];
    const disabled = (k === 'train' && !state.buildings.barracks) ? 'disabled' : '';
    const selected = (p.jobMode === 'manual' && p.job === k) ? 'selected' : '';
    opts += '<option value="' + k + '" ' + selected + ' ' + disabled + '>' + n + ' · manual</option>';
  }
  return '<select data-job="' + p.id + '" aria-label="Trabalho de ' + esc(p.name) + '">' + opts + '</select>';
};

let activeControl = null;
let renderQueued = false;
const stableRender = render;
render = function() {
  if (activeControl) {
    renderQueued = true;
    return;
  }
  renderQueued = false;
  stableRender();
};

function releaseControl() {
  activeControl = null;
  if (renderQueued) render();
}

document.addEventListener('pointerdown', function(e) {
  if (e.target.tagName === 'SELECT') activeControl = e.target;
  else if (activeControl) activeControl = null;
}, true);

document.addEventListener('focusin', function(e) {
  if (e.target.tagName === 'SELECT') activeControl = e.target;
}, true);

document.addEventListener('change', function(e) {
  if (e.target === activeControl) {
    activeControl = null;
    renderQueued = false;
  }
}, true);

document.addEventListener('focusout', function(e) {
  if (e.target === activeControl) activeControl = null;
}, true);

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') releaseControl();
}, true);

if (state) {
  upgradeKingdom();
  save();
  render();
}
if (typeof loadAnimeArt === 'function') loadAnimeArt();
window.addEventListener('beforeunload', save);
