import {loadAtlas,renderCharacter,renderPortrait} from './renderer.mjs';
const cache=new Map();let atlas;
globalThis.CampaignPaperDoll={ready:person=>Boolean(atlas&&CampaignAppearance.appearance(person)),url(person,portrait=false){
  if(!atlas)return null;
  const appearance=CampaignAppearance.appearance(person);if(!appearance)return null;
  const key=JSON.stringify([appearance,portrait]);if(cache.has(key))return cache.get(key);
  const body=document.createElement('canvas');renderCharacter(body,atlas,appearance);
  let canvas=body;
  if(portrait){canvas=document.createElement('canvas');renderPortrait(canvas,body,appearance);}
  const url=canvas.toDataURL('image/png');if(cache.size>=350)cache.clear();cache.set(key,url);return url;
}};
try {
  atlas=await loadAtlas();
  if(typeof render==='function'&&typeof state!=='undefined'&&state){render();if(typeof refreshPersonModal==='function')refreshPersonModal();}
}catch(error){console.warn('Paper doll indisponível; mantendo a arte racial.',error);}
