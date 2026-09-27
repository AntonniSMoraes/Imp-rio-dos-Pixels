'use strict';
// Versioned, pre-colored pieces. Unsupported colors retain the racial renderer.
globalThis.CampaignAppearance = (() => {
  const skinFor = gene => ({0:'ivory',2:'brown'}[gene] || null);
  const hairFor = gene => ({1:'brown',2:'blond'}[gene] || null);
  function ensure(p) {
    if(!p.paperDoll)p.paperDoll={version:1,skin:skinFor(p.genes?.skin),hair:hairFor(p.genes?.hair)};
    return p.paperDoll;
  }
  function inherit(child,parents) {
    const value={version:1};
    for(const key of ['skin','hair']) {
      const parent=parents.find(p=>p.id===child.origins?.[key]);
      value[key]=parent?ensure(parent)[key]:(key==='skin'?skinFor(child.genes?.skin):hairFor(child.genes?.hair));
    }
    child.paperDoll=value;return value;
  }
  function validate(value) {
    if(!value||value.version!==1||![null,'ivory','brown'].includes(value.skin)||![null,'blond','brown'].includes(value.hair))throw Error('paper doll identity');
  }
  function appearance(p) {
    const ancestry=typeof normalizedAncestry==='function'?normalizedAncestry(p):(p.ancestry||{[p.race||'human']:1});
    if(p.age<18||p.level<5||ancestry.human!==1)return null;
    const identity=ensure(p);validate(identity);
    if(!identity.skin||!identity.hair)return null;
    return {version:1,seed:p.id,race:'human',ageGroup:'adult',body:p.sex==='F'?'female':'male',skin:identity.skin,hair:((p.hairstyle??p.genes.style)>=2?'long-':'short-')+identity.hair,outfit:p.social>=2?'noble':'commoner'};
  }
  return {ensure,inherit,validate,appearance};
})();
