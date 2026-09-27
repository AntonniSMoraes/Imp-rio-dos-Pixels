'use strict';
// Historical snapshots: names and house membership must not change after succession.
globalThis.FamilyChronicle = (() => {
  const labels = {birth:'Nascimento', union:'União', death:'Falecimento', succession:'Sucessão', conquest:'Conquista', loss:'Perda territorial', foundation:'Fundação de nação', defection:'Deserção', claim:'Reivindicação', conflict:'Guerra de reivindicação'};
  function ensure() {
    if (!state) return null;
    return state.familyChronicle ||= {version:1, since:state.day, nextId:1, events:[]};
  }
  function snapshot(people) {
    return [...new Map(people.filter(Boolean).map(p => [p.id, {
      id:p.id, name:(p.name + ' ' + p.family).trim(), house:p.houseHead || p.id,
      family:p.family
    }])).values()];
  }
  function record(type, people, text, details = {}) {
    const book = ensure();
    if (!book || !Object.hasOwn(labels,type)) return;
    book.events.push({id:book.nextId++, day:state.day, type, people:snapshot(people), text, ...details});
  }
  function validate(save) {
    const b = save.familyChronicle;
    if (b === undefined) return;
    const validText = (s,n) => typeof s === 'string' && s.length <= n;
    if (!b || b.version !== 1 || !Number.isInteger(b.since) || b.since < 0 || b.since > save.day || !Number.isSafeInteger(b.nextId) || !Array.isArray(b.events)) throw Error('family chronicle');
    let last = 0, day = b.since;
    for (const e of b.events) {
      if (!e || !Number.isSafeInteger(e.id) || e.id <= last || !Number.isInteger(e.day) || e.day < day || e.day > save.day || !Object.hasOwn(labels,e.type) || !validText(e.text,2000) || !Array.isArray(e.people) || e.people.length > 20 || e.people.some(p => !p || !validText(p.id,100) || !validText(p.house,100) || !validText(p.name,201) || !validText(p.family,100)) || (e.tile !== undefined && (!Number.isInteger(e.tile) || e.tile < 0 || e.tile > 511))) throw Error('family chronicle event');
      last = e.id; day = e.day;
    }
    if (b.nextId <= last) throw Error('family chronicle sequence');
  }
  function events(scope = 'all', id = '', type = 'all') {
    const list = state?.familyChronicle?.events || [];
    const houses = new Set([id]);
    // A successor continues the same historical house, even with a new head ID.
    if (scope === 'house') {
      let changed = true;
      while (changed) {
        changed = false;
        for (const e of list) if (e.type === 'succession' && e.people.some(p => houses.has(p.id))) {
          for (const p of e.people) if (!houses.has(p.id)) { houses.add(p.id); changed = true; }
        }
      }
    }
    return list.filter(e => (type === 'all' || e.type === type) && (scope === 'all' || e.people.some(p => scope === 'person' ? p.id === id : houses.has(p.house) || houses.has(p.id)))).slice().reverse();
  }
  function button(scope,id,label,page=0,type='all') {
    return '<button data-family-chronicle="'+scope+'" data-id="'+esc(id)+'" data-page="'+page+'" data-kind="'+type+'">'+esc(label)+'</button>';
  }
  function open(scope='all',id='',page=0,type='all') {
    const list=events(scope,id,type), pages=Math.max(1,Math.ceil(list.length/30));
    page=Math.max(0,Math.min(pages-1,Number(page)||0));
    const person=state.people.find(p=>p.id===id);
    let html='<p class="hint">Registro de acontecimentos a partir do dia '+(state.familyChronicle?.since ?? state.day)+'. Acontecimentos anteriores não são reconstruídos.</p><div class="subtabs">'+button('all','','Todas as casas')+button(scope,id,'Todos os eventos',0);
    for (const [kind,label] of Object.entries(labels)) html+=button(scope,id,label,0,kind);
    html+='</div><div class="chronicles family-chronicles">';
    html+=list.slice(page*30,page*30+30).map(e=>{
      const d=calendarDate(e.day);
      return '<p><time>Dia '+d.day+' · Ano '+d.year+' · '+labels[e.type]+'</time>'+esc(e.text)+'<span class="chronicle-people">'+e.people.map(p=>state.people.some(x=>x.id===p.id)?'<button data-person="'+esc(p.id)+'">'+esc(p.name)+'</button>':esc(p.name)).join(' · ')+'</span></p>';
    }).join('') || '<p class="empty">Nenhum acontecimento registrado nesta seleção.</p>';
    html+='</div><div class="subtabs">';
    if(page>0)html+=button(scope,id,'Mais recentes',page-1,type);
    html+='<span>Página '+(page+1)+' de '+pages+' · '+list.length+' acontecimentos</span>';
    if(page+1<pages)html+=button(scope,id,'Mais antigos',page+1,type);
    modal('Crônica familiar'+(person?' · '+esc(scope==='house'?'Casa '+person.family:person.name):''),html+'</div>');
  }
  return {ensure,record,validate,events,button,open,snapshot};
})();
