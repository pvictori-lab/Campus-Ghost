// Compose James's shortest-path function into a route with reportable checkpoints.
// All nodes/edges remain the supplied map's; lengths are drawing units, not meters.
export function buildNavigationPlan(building,start,destination,findRoute){
  let route=findRoute(start,destination)||[];
  if(!route.length)return {route:[],stops:[]};
  const byId=new Map(building.nodes.map(node=>[node.id,node]));
  const cost=path=>path.slice(1).reduce((sum,id,index)=>{const a=byId.get(path[index]),b=byId.get(id);return sum+Math.hypot(a.x-b.x,a.y-b.y);},0);
  // When there is no intermediate QR marker, prefer the smallest simple detour
  // through one adjacent checkpoint. Never add a dead-end there-and-back detour.
  if(route.length>2&&!route.slice(1,-1).some(id=>byId.get(id)?.qrCodeId)){
    const options=building.nodes.filter(node=>node.qrCodeId&&node.id!==start&&node.id!==destination&&building.edges.some(([a,b])=>(a===node.id&&route.includes(b))||(b===node.id&&route.includes(a))))
      .map(node=>{const first=findRoute(start,node.id),last=findRoute(node.id,destination);if(!first||!last)return null;const path=first.concat(last.slice(1));return new Set(path).size===path.length?path:null;})
      .filter(Boolean).sort((a,b)=>cost(a)-cost(b)||a.join(',').localeCompare(b.join(',')));
    if(options.length)route=options[0];
  }
  const stops=route.filter((id,index)=>index===0||index===route.length-1||byId.get(id)?.qrCodeId);
  return {route,stops};
}
