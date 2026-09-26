'use strict';

const Peerage = (() => {
  let draft = null;
  function consort(p) {
    const head = byId(p?.unionHead);
    return Boolean(head?.alive && head.social >= 2 && head.partners?.some(r=>r.id===p.id && r.role==='consorte'));
  }
  function reconcile() {
    for (const p of alive()) {
      const head = byId(p.unionHead);
      if (!head?.alive) continue;
      if (!head.partners?.some(r=>r.id===p.id && r.role==='consorte')) {
        if (p.social >= 2) { p.unionHead=null; p.houseHead=p.id; }
        continue;
      }
      if (head.social < 2) continue;
      head.tiles=[...new Set([...(head.tiles||[]),...(p.tiles||[])])];
      if(head.id===state.king)state.royalLands=[...new Set([...(state.royalLands||[]),...head.tiles])];
      const purse=head.id===state.king?state:(head.treasury ||= {wood:0,iron:0,food:0,gold:0});
      if(p.annualOpening && head.id!==state.king)head.annualOpening ||= {...purse};
      for (const key of ['wood','iron','food','gold']) {
        purse[key]=(purse[key]||0)+(p.treasury?.[key]||0);
        if(p.annualOpening && head.id!==state.king)head.annualOpening[key]=(head.annualOpening[key]||0)+(p.annualOpening[key]||0);
      }
      p.treasury={wood:0,iron:0,food:0,gold:0};delete p.annualOpening;
      p.tiles=[];p.territory=null;p.liege=null;p.houseHead=head.id;
      for (const member of alive()) if (member.id!==head.id && member.id!==p.id && member.liege===p.id) member.liege=head.id;
    }
  }
  function grant(p, tiles, tier=p?.social+1, fee={}) {
    if (!p || !adult(p) || consort(p) || p.id===state.king || !Number.isInteger(tier) || tier<=p.social || tier>7) return false;
    const king=byId(state.king), available=new Set([...personalLands(king),...(p.tiles||[])]);
    const seat=state.capitalIndex??REGIONS[state.region]?.seat??240;
    if (tier>=2 && (!Array.isArray(tiles) || tiles.length<(LAND_SIZE[tier]||1) || new Set(tiles).size!==tiles.length || tiles.some(i=>!available.has(i)||i===seat||TerritoryGeometry.get(i)?.price===null) || !areTilesConnected(tiles) || (p.tiles||[]).some(i=>!tiles.includes(i)))) return false;
    const charges=Object.fromEntries(['wood','iron','food','gold'].map(k=>[k,Number(fee[k]||0)]));
    if (Object.values(charges).some(n=>!Number.isFinite(n)||n<0)) return false;
    if (Object.entries(charges).some(([k,n])=>(p.treasury?.[k]||0)<n)) return false;
    for (const [k,n] of Object.entries(charges)) { if(n) p.treasury[k]-=n; state[k]=(state[k]||0)+n; }
    p.social=tier;p.promotedAt=state.promotionSequence++;p.retired=false;p.order='balance';
    p.tiles=tier>=2?[...tiles]:p.tiles||[];p.territory=p.tiles[0]??null;
    p.liege=state.king;p.feudalGrantor=state.king;p.houseHead=p.id;p.unionHead=null;
    for(const r of p.partners||[]){const other=byId(r.id);if(other?.alive)updateHouseholdLeadership(p,other);}
    reconcile();
    log('Decreto real: '+p.name+' recebeu o título de '+SOCIAL[tier]+'.');
    return true;
  }
  function request(p, tier, tiles, fee) {
    if (!p || consort(p) || !adult(p) || !Number.isInteger(tier) || tier<=p.social || tier>7) return false;
    if(Object.values(fee).some(n=>!Number.isFinite(n)||n<0))return false;
    p.promotionRequest={tier,tiles,fee,day:state.day};return true;
  }
  function tick() {
    if(state.lastPeerageDay===state.day)return;
    state.lastPeerageDay=state.day;
    for(const p of adults()) {
      const offer=p.promotionRequest;
      if(offer && (offer.tier<=p.social || consort(p) || p.id===state.king || grant(p,offer.tiles,offer.tier,offer.fee)))delete p.promotionRequest;
      if(p.social!==1 || p.job!=='train' || onMission(p) || consort(p))continue;
      p.knighthoodTraining=(p.knighthoodTraining||0)+1;
      if(p.knighthoodTraining<48)continue;
      p.knighthoodTraining=0;
      if(Math.random()<.05){p.social=2;p.houseHead=p.id;p.unionHead=null;p.tiles||=[];p.promotedAt=state.promotionSequence++;log(p.name+' concluiu sua formação e foi armado(a) cavaleiro(a), ainda sem feudo.');}
    }
  }
  function readDraft(id) {
    const raw=document.querySelector('#promotion-land-cluster')?.value;
    return {id,tier:Number(document.querySelector('#peerage-tier')?.value || byId(id).social+1),tiles:raw?raw.split(',').map(Number):[],fee:Object.fromEntries(['wood','iron','food','gold'].map(k=>[k,Number(document.querySelector('#peerage-fee-'+k)?.value||0)]))};
  }
  function startMap(id) {
    draft=readDraft(id);if(draft.tier<2)return;
    draft.before=[...draft.tiles];draft.tiles=[...(byId(id).tiles||[])];
    pendingLand=id;editBorderMode=false;modalPerson=null;document.querySelector('#modal').close();view='map';render();
    toast('Clique nas terras da Coroa para selecionar ou retirar. Depois confirme a seleção.');
  }
  function chooseMapTile(index) {
    const p=byId(pendingLand);if(!p?.alive||!draft){pendingLand=null;return;}
    if((p.tiles||[]).includes(index))return toast('As terras atuais do personagem serão mantidas.');
    const seat=state.capitalIndex??REGIONS[state.region]?.seat??240;
    if(index===seat||!personalLands(byId(state.king)).includes(index)||TerritoryGeometry.get(index)?.price===null)return toast('Selecione terras próprias da Coroa, sem a capital ou feudos alheios.');
    if(draft.tiles.includes(index))draft.tiles=draft.tiles.filter(i=>i!==index);
    else draft.tiles.push(index);
    render();
  }
  function finishMap(cancel=false) {
    if(!draft)return;
    if(!cancel&&(draft.tiles.length<(LAND_SIZE[draft.tier]||1)||!areTilesConnected(draft.tiles)))return toast('Selecione pelo menos '+LAND_SIZE[draft.tier]+' vilas conectadas.');
    pendingLand=null;const tiles=cancel?draft.before:draft.tiles;
    render();dialog(draft.id,tiles,draft.tier,draft.fee);
  }
  function mapSelection(){return pendingLand&&draft?draft.tiles.join(','):null;}
  function mapLabel(){return draft?draft.tiles.length+' / '+(LAND_SIZE[draft.tier]||1)+' vilas · '+SOCIAL[draft.tier]:'';}
  function dialog(id, preselectedTiles, tier, fee={}) {
    const p=byId(id);if(!p || !adult(p)||consort(p)||p.id===state.king||p.social>=7)return toast('Este personagem não pode receber promoção individual.');
    tier=Number(tier||p.social+1);
    const clusters=tier>=2?getAvailableConnectedClusters(LAND_SIZE[tier]||1,p):[];
    let html='<div class="peerage-form"><p>Concessão gratuita ou cobrança ao candidato. A Coroa não paga pela promoção. Terras continuam obrigatórias para títulos territoriais.</p><div class="peerage-territory-row"><label>Título<select id="peerage-tier" data-peerage-tier="'+id+'">';
    for(let t=p.social+1;t<=7;t++)html+='<option value="'+t+'" '+(tier===t?'selected':'')+'>'+SOCIAL[t]+'</option>';
    html+='</select></label><div class="peerage-lands">';
    if(tier>=2){html+='<label>Terras<select id="promotion-land-cluster">';
      if(preselectedTiles?.length)html+='<option value="'+preselectedTiles.join(',')+'">Seleção do mapa · '+preselectedTiles.length+' vilas</option>';
      html+=clusters.map(c=>'<option value="'+c.join(',')+'">Vilas '+c.map(i=>i+1).join(', ')+'</option>').join('')+'</select></label><button data-land-pick="'+id+'">Selecionar terras no mapa</button>';
    }else html+='<p>Este título não exige terras.</p>';
    html+='</div></div>';
    if(tier>=2&&!clusters.length&&!preselectedTiles?.length)html+='<p>Amplie as terras disponíveis para este título.</p>';
    html+='<div class="peerage-resources">';
    for(const [k,label] of Object.entries({wood:'Madeira',iron:'Ferro',food:'Alimento',gold:'Ouro'}))html+='<label class="peerage-resource"><span>'+label+' cobrado</span><input id="peerage-fee-'+k+'" type="number" min="0" value="'+(Number.isFinite(fee[k])?fee[k]:0)+'"></label>';
    html+='</div>';
    if(p.promotionRequest)html+='<p>Pedido de '+SOCIAL[p.promotionRequest.tier]+' aguardando recursos e terras disponíveis.</p>';
    html+='<div class="peerage-actions"><button data-peerage-grant="'+id+'">Conceder agora</button><button data-peerage-request="'+id+'">Aguardar arrecadação do candidato</button>';
    if(p.promotionRequest)html+='<button data-peerage-cancel="'+id+'">Cancelar pedido</button>';
    modal('Concessão de título',html+'</div></div>');
  }
  document.addEventListener('change',e=>{if(e.target.dataset.peerageTier){const data=readDraft(e.target.dataset.peerageTier);dialog(data.id,null,data.tier,data.fee);}});
  document.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b||!state)return;
    if(b.dataset.peerageMapConfirm)return finishMap();
    if(b.dataset.peerageMapCancel)return finishMap(true);
    if(b.dataset.peerageCancel){delete byId(b.dataset.peerageCancel).promotionRequest;save();dialog(b.dataset.peerageCancel);return;}
    const id=b.dataset.peerageGrant||b.dataset.peerageRequest;if(!id)return;
    const tier=Number(document.querySelector('#peerage-tier').value), raw=document.querySelector('#promotion-land-cluster')?.value;
    const tiles=raw?raw.split(',').map(Number):[];
    const fee=Object.fromEntries(['wood','iron','food','gold'].map(k=>[k,Number(document.querySelector('#peerage-fee-'+k).value)]));
    const ok=b.dataset.peerageGrant?grant(byId(id),tiles,tier,fee):request(byId(id),tier,tiles,fee);
    if(ok){save();render();document.querySelector('#modal').close();}toast(ok?'Decreto registrado.':'Verifique elegibilidade, terras e recursos do candidato.');
  });
  return {consort,reconcile,grant,request,tick,dialog,startMap,chooseMapTile,finishMap,mapSelection,mapLabel};
})();
