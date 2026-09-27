function rgb(hex) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}
function blend(a, b, t) {
  return a.map((v, i) => Math.round(v + (b[i] - v) * t));
}
function pixelHSV(r, g, b) {
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d + 6) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return [h, max ? d / max : 0, max / 255];
}

// Normalize against the actual source complexion, not a universal pale reference.
// Additive shading retains facial contrast instead of darkening dark atlases twice.
function recolorComplexion(tile, destination, palette) {
  if(!tile.skin.length)return;
  const channels=[0,1,2].map(k=>tile.skin.map(i=>tile.data[i+k]).sort((a,b)=>a-b));
  const reference=channels.map(values=>values[Math.floor(values.length/2)]);
  const mid=rgb(palette[1]);
  for(const i of tile.skin) {
    const pixel=i/4,x=pixel%tile.w,y=Math.floor(pixel/tile.w);
    for(let k=0;k<3;k++) {
      let sum=0,count=0;
      for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const nx=x+dx,ny=y+dy;
        if(nx<0||nx>=tile.w||ny<0||ny>=tile.h)continue;
        const j=(ny*tile.w+nx)*4;
        if(!tile.data[j+3])continue;
        sum+=tile.data[j+k];count++;
      }
      // Small, bounded detail enhancement avoids halos along the silhouette.
      const detail=count?Math.max(-9,Math.min(9,(tile.data[i+k]-sum/count)*.35)):0;
      destination[i+k]=Math.max(0,Math.min(250,Math.round(mid[k]+(tile.data[i+k]-reference[k])*1.15+detail)));
    }
  }
}
