// Small original pixel faces; generated as SVG so labels stay crisp at map scale.
export const raceNames={human:'Humano',elf:'Elfo',darkElf:'Elfo negro',beastfolk:'Homem-fera',wolf:'Homem-fera',cat:'Homem-fera',bunny:'Homem-fera',lamia:'Lâmia',harpy:'Harpia',kobold:'Kobold'};
export function raceIcon(race){
 const palettes={human:['#e9bd91','#6b4534'],elf:['#eed6b7','#dbca76'],darkElf:['#a395b9','#e1ddf2'],beastfolk:['#929394','#414851'],wolf:['#929394','#414851'],cat:['#be997a','#76543e'],bunny:['#eee3d9','#ac9195'],lamia:['#89b975','#345a42'],harpy:['#d2ad7c','#774b57'],kobold:['#b87553','#743e32']};
 const [skin,hair]=palettes[race]||palettes.human;
 let special='';
 if(['elf','darkElf'].includes(race))special='<path d="M1 5h3v4H2zM12 5h3l-1 4h-2z" fill="'+skin+'"/>';
 if(['beastfolk','wolf','cat','bunny'].includes(race))special='<path d="M3 1h3v4H3zM10 1h3v4h-3z" fill="'+hair+'"/><path d="M6 10h4v3H6z" fill="#ede7da"/><path d="M7 10h2v1H7z" fill="#252738"/>';
 if(race==='harpy')special='<path d="M6 9h4l-2 4z" fill="#eac252"/><path d="M1 2h3v5H2zM12 2h3l-1 5h-2z" fill="'+hair+'"/>';
 if(race==='kobold')special='<path d="M1 4h3v5H1zM12 4h3v5h-3z" fill="'+skin+'"/><path d="M5 9h6v4H5z" fill="#dcac79"/>';
 if(race==='lamia')special='<path d="M5 10h1v2H5zM10 10h1v2h-1z" fill="white"/>';
 return 'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges"><rect width="16" height="16" rx="3" fill="#162832"/><path d="M4 3h8v10H4zM6 13h4v2H6z" fill="'+skin+'"/><path d="M3 2h10v4H3z" fill="'+hair+'"/>'+special+'<path d="M5 7h2v2H5zM9 7h2v2H9z" fill="#263445"/></svg>');
}
