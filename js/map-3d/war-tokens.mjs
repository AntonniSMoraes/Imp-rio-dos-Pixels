import * as THREE from 'three';
import { settlementSite } from './settlements.mjs';
import { worldPoint, heightAt } from './world-data.mjs';
export function buildWarTokens(world) {
  const group=new THREE.Group();
  if(world.people?.length)return group; // Individual clickable tokens replace anonymous army counters.
  for(const army of world.armies||[]){
    const index=army.path[army.step],p=settlementSite([index])||worldPoint(index),battle=army.status==='battle';
    const add=(count,color,side)=>{
      for(let i=0;i<Math.min(12,count);i++){
        const x=p.x+side*(battle?.35+(army.round%2)*.15:1)+(i%3)*.23,z=p.z+Math.floor(i/3)*.25;
        const pixel=new THREE.Mesh(new THREE.BoxGeometry(.19,.32,.19),new THREE.MeshBasicMaterial({color}));
        pixel.position.set(x,Math.max(.2,heightAt(x,z))+.5,z);pixel.userData.tile=index;group.add(pixel);
      }
    };
    add(army.count,army.hostile?'#fa5454':'#ffe095',-1);
    if(battle)add(Math.ceil(army.enemy),'#fa5454',1);
  }
  return group;
}
