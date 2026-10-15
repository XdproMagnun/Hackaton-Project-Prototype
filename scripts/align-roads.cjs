// Ajuste visual a la red vial local; no calcula sentidos ni navegación legal.
module.exports = function alignRoads(osm, sections) {
  const nodes=new Map();
  const distance=(a,b)=>Math.hypot((a[0]-b[0])*.947,a[1]-b[1]);
  const node=c=>{const key=c.join(',');if(!nodes.has(key))nodes.set(key,{key,c,edges:[],names:new Set()});return nodes.get(key);};
  for(const f of osm.features) {
    if(f.geometry.type!=='LineString'||! /^(primary|secondary|tertiary|residential|unclassified|living_street)(?:_link)?$/.test(f.properties.highway||''))continue;
    const coords=f.geometry.coordinates;
    for(let i=1;i<coords.length;i++) {
      const a=coords[i-1],b=coords[i],count=Math.max(1,Math.ceil(distance(a,b)/.00018));let previous=node(a);
      for(let j=1;j<=count;j++) {
        const next=node(j===count?b:[a[0]+(b[0]-a[0])*j/count,a[1]+(b[1]-a[1])*j/count]);
        const cost=distance(previous.c,next.c);
        previous.names.add(f.properties.name||'');next.names.add(f.properties.name||'');
        previous.edges.push({node:next,cost});next.edges.push({node:previous,cost});previous=next;
      }
    }
  }
  const all=[...nodes.values()];
  const nearest=(p,pattern)=>{
    const candidates=pattern?all.filter(n=>[...n.names].some(name=>pattern.test(name))):all;
    return candidates.reduce((best,n)=>distance(p,n.c)<distance(p,best.c)?n:best);
  };
  function path(start,end) {
    const costs=new Map([[start.key,0]]),parents=new Map(),queue=[{node:start,cost:0}],done=new Set();
    while(queue.length) {
      queue.sort((a,b)=>b.cost-a.cost);const current=queue.pop();
      if(done.has(current.node.key))continue;
      if(current.node===end)break;done.add(current.node.key);
      for(const edge of current.node.edges){const cost=current.cost+edge.cost;if(cost<(costs.get(edge.node.key)??Infinity)){costs.set(edge.node.key,cost);parents.set(edge.node.key,current.node);queue.push({node:edge.node,cost});}}
    }
    if(!costs.has(end.key))throw new Error('Tramo Costera desconectado de la red vial');
    const result=[end.c];let current=end;
    while(current!==start){current=parents.get(current.key);result.push(current.c);}return result.reverse();
  }
  for(const f of sections){
    const pattern=f.properties.name.startsWith('Malecón')?/Malecón Costero|Paseo del Mar/:f.properties.name.startsWith('Amado')?/Amado Nervo|Avenida Nardos|Constelación Pléyades|Paseo del Mar/:null;
    const targets=f.geometry.coordinates.map(p=>nearest(p,pattern)),coordinates=[];
    for(let i=1;i<targets.length;i++){const leg=path(targets[i-1],targets[i]);coordinates.push(...(coordinates.length?leg.slice(1):leg));}
    f.geometry.coordinates=coordinates;f.properties.alignment='local-osm-roads';
  }
  return sections;
};
