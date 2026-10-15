// Ajuste visual a la red vial local; no calcula sentidos ni navegación legal.
// Los tramos del cartel se encadenan en una sola línea: cada tramo arranca en el
// nodo donde terminó el anterior, así el recorrido no queda cortado. Además se
// eliminan los puntos consecutivos repetidos y los retrocesos exactos (salir y
// volver por el mismo trazo), que dibujaban la ruta encima de sí misma.
module.exports = function alignRoads(osm, sections, patterns = {}) {
  const nodes = new Map();
  const distance = (a, b) => Math.hypot((a[0] - b[0]) * .947, a[1] - b[1]);
  const node = c => {
    const key = c.join(',');
    if (!nodes.has(key)) nodes.set(key, {key, c, edges: [], names: new Set()});
    return nodes.get(key);
  };
  for (const f of osm.features) {
    if (f.geometry.type !== 'LineString' || !/^(primary|secondary|tertiary|residential|unclassified|living_street)(?:_link)?$/.test(f.properties.highway || '')) continue;
    const coords = f.geometry.coordinates;
    for (let i = 1; i < coords.length; i++) {
      const a = coords[i - 1], b = coords[i], count = Math.max(1, Math.ceil(distance(a, b) / .00018));
      let previous = node(a);
      for (let j = 1; j <= count; j++) {
        const next = node(j === count ? b : [a[0] + (b[0] - a[0]) * j / count, a[1] + (b[1] - a[1]) * j / count]);
        const cost = distance(previous.c, next.c);
        previous.names.add(f.properties.name || '');
        next.names.add(f.properties.name || '');
        previous.edges.push({node: next, cost});
        next.edges.push({node: previous, cost});
        previous = next;
      }
    }
  }
  const all = [...nodes.values()];
  // Ancla cada punto del cartel a la calle que le corresponde; si esa calle no
  // aparece en el extracto se usa la red completa para no romper el trazado.
  const nearest = (point, pattern) => {
    let candidates = pattern ? all.filter(n => [...n.names].some(name => pattern.test(name))) : all;
    if (!candidates.length) candidates = all;
    return candidates.reduce((best, n) => distance(point, n.c) < distance(point, best.c) ? n : best);
  };
  function path(start, end) {
    const costs = new Map([[start.key, 0]]), parents = new Map(), queue = [{node: start, cost: 0}], done = new Set();
    while (queue.length) {
      queue.sort((a, b) => b.cost - a.cost); const current = queue.pop();
      if (done.has(current.node.key)) continue;
      if (current.node === end) break;
      done.add(current.node.key);
      for (const edge of current.node.edges) {
        const cost = current.cost + edge.cost;
        if (cost < (costs.get(edge.node.key) ?? Infinity)) { costs.set(edge.node.key, cost); parents.set(edge.node.key, current.node); queue.push({node: edge.node, cost}); }
      }
    }
    if (!costs.has(end.key)) throw new Error('Tramo Costera desconectado de la red vial');
    const result = [end.c]; let current = end;
    while (current !== start) { current = parents.get(current.key); result.push(current.c); }
    return result.reverse();
  }
  function tidy(coordinates) {
    const out = coordinates.filter((p, i) => i === 0 || p[0] !== coordinates[i - 1][0] || p[1] !== coordinates[i - 1][1]);
    let changed = true;
    while (changed) {
      changed = false;
      const seen = new Map();
      for (let i = 0; i < out.length; i++) {
        const key = out[i].join(',');
        if (seen.has(key)) {
          const start = seen.get(key);
          let backtrack = i > start + 1;
          for (let k = 0; backtrack && k <= (i - start) / 2; k++) {
            const a = out[start + k], b = out[i - k];
            if (a[0] !== b[0] || a[1] !== b[1]) backtrack = false;
          }
          if (backtrack) { out.splice(start, i - start); changed = true; break; }
        }
        seen.set(key, i);
      }
    }
    return out;
  }
  let junction = null;
  for (const f of sections) {
    const targets = f.geometry.coordinates.map(point => nearest(point, patterns[f.properties.name]));
    if (junction) targets[0] = junction;
    const coordinates = [];
    for (let i = 1; i < targets.length; i++) {
      const leg = path(targets[i - 1], targets[i]);
      coordinates.push(...(coordinates.length ? leg.slice(1) : leg));
    }
    f.geometry.coordinates = tidy(coordinates);
    junction = node(f.geometry.coordinates.at(-1));
    f.properties.alignment = 'local-osm-roads';
  }
  return sections;
};
