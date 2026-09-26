import * as THREE from 'three';
import {settlementSite,surfaceHeight} from './settlements.mjs';
import {provinces} from './world-data.mjs';
const spots=new Map();
function positions(index){
 if(spots.has(index))return spots.get(index);
 const site=settlementSite([index]),province=provinces.get(index);if(!site||!province)return [];
 const points=[];
 // Prefer ground around the settlement; spread coastal residents along usable land.
 for(let x=province.bounds[0]+.15;x<province.bounds[2];x+=.3)for(let z=province.bounds[1]+.15;z<province.bounds[3];z+=.3){
  if(provinces.contains(province.polygon,x,z)&&surfaceHeight(x,z)>.17&&Math.hypot(x-site.x,z-site.z)>.8)points.push({x,z});
 }
 points.sort((a,b)=>Math.hypot(a.x-site.x,a.z-site.z)-Math.hypot(b.x-site.x,b.z-site.z));
 if(!points.length)points.push({x:site.x,z:site.z});
 spots.set(index,points);return points;
}
export function buildWorldTokens(world){
 const group=new THREE.Group(),counts=new Map();
 for(const p of world.people||[]){
  const points=positions(p.tile);if(!points.length)continue;
  const n=counts.get(p.tile)||0;counts.set(p.tile,n+1);
  const {x,z}=points[n%points.length];
  const pixel=new THREE.Mesh(new THREE.BoxGeometry(.2,.36,.2),new THREE.MeshBasicMaterial({color:p.color}));
  pixel.position.set(x,surfaceHeight(x,z)+.24+Math.floor(n/points.length)*.4,z);pixel.userData.tile=p.tile;pixel.userData.person=p.id;group.add(pixel);
 }
 return group;
}
