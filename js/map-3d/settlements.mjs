import '../territory/provinces.js';
const geometry = globalThis.TerritoryGeometry;
const cache = new Map();
export const SETTLEMENTS = {
  house: { x: .44, z: .36, relief: .65 },
  manor: { x: .8, z: .65, relief: .7 },
  castle: { x: 1.25, z: 1.05, relief: .55 },
  cottage: { x: .16, z: .13, relief: .4 },
  hut: { x: .08, z: .06, relief: .3 },
};
// Interpolate the actual terrain triangles used by PlaneGeometry(128,64,192,96).
export function surfaceHeight(x,z) {
  const step=2/3, col=Math.min(191,Math.max(0,Math.floor((x+64)/step))),row=Math.min(95,Math.max(0,Math.floor((z+32)/step)));
  const ax=-64+col*step,az=-32+row*step,u=(x-ax)/step,v=(z-az)/step;
  const a=geometry.height(ax,az),b=geometry.height(ax+step,az),c=geometry.height(ax,az+step),d=geometry.height(ax+step,az+step);
  return u+v<=1?a+(b-a)*u+(c-a)*v:d+(c-d)*(1-u)+(b-d)*(1-v);
}
export function settlementSite(indices, size = indices.length) {
  const key=size+':'+indices.join(',');if(cache.has(key))return cache.get(key);
  const domain=indices.map(i=>geometry.get(i)).filter(Boolean);
  const origin=domain[0]?.center||[0,0];
  const kinds=size>=8?['castle','manor','house','cottage','hut']:size>=4?['manor','house','cottage','hut']:['house','cottage','hut'];
  let best=null;
  for(const province of domain){
    if(province.landArea<.05)continue;
    for(const kind of kinds){
      const size=SETTLEMENTS[kind],step=kind==='hut'?.09:.18;let score=Infinity;
      for(let x=province.bounds[0]+.09;x<province.bounds[2];x+=step)for(let z=province.bounds[1]+.09;z<province.bounds[3];z+=step){
        const distance=Math.hypot(x-origin[0],z-origin[1]);if(distance>score)continue;
        const samples=[];for(const dx of [-size.x,0,size.x])for(const dz of [-size.z,0,size.z])samples.push([x+dx,z+dz]);
        if(samples.some(([sx,sz])=>!geometry.contains(province.polygon,sx,sz)))continue;
        const heights=samples.map(([sx,sz])=>surfaceHeight(sx,sz)),low=Math.min(...heights),high=Math.max(...heights);
        if(low<.17||high-low>size.relief)continue;
        const candidate=distance+(high-low)*8;
        if(candidate<score){score=candidate;best={x,z,base:high+.015,minHeight:low,kind,province:province.index,relocated:province.index!==indices[0]};}
      }
      if(best)break;
    }
    if(best)break;
  }
  // Never put a building on another owner's land to disguise an ocean-only save.
  cache.set(key,best);return best;
}
export function domainColor(id) {
  let hash=0;for(const c of id)hash=(hash*31+c.charCodeAt(0))>>>0;
  return `hsl(${180+hash%145}, 62%, 62%)`;
}
