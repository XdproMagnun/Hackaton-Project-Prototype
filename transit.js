'use strict';
// El catálogo de transporte es independiente del PBF: reimportarlo no borra las rutas.
(() => {
  let catalog;
  let transit;
  let selected = 'campus-3';
  let visible = true;
  let general = true;
  let stopsVisible = true;
  let vehicles = [];
  let vehicleMarkers = [];
  const simulationStarted = Date.now();
  let simulationPaths = [];
  let markers = [];
  let popup;
  const chip = document.querySelector('#transit-chip');
  const mobile = () => window.matchMedia('(max-width: 650px)').matches;
  const element = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  const stops = () => transit.features.filter(f => f.properties.routeId === selected && f.properties.kind === 'stop');
  const route = () => catalog.routes.find(item => item.id === selected);
  function button(text, action, className = 'primary wide') {
    const node = element('button', text, className);
    node.type = 'button'; node.addEventListener('click', action);
    return node;
  }
  function showStop(feature) {
    if (!map) return notify('El mapa no está disponible.');
    visible = true; draw();
    if (mobile()) showPanel('general');
    if (popup) popup.remove();
    const content = element('div');
    content.append(element('strong', `${catalog.routes.find(r=>r.id===feature.properties.routeId).name} · ${feature.properties.name}`), element('small', feature.properties.note));
    popup = new maplibregl.Popup({offset: 20}).setLngLat(feature.geometry.coordinates).setDOMContent(content).addTo(map);
    map.flyTo({center: feature.geometry.coordinates, zoom: 16, padding: mobile() ? {top:100,bottom:80,left:30,right:30} : {top:80,bottom:60,left:390,right:60}});
  }
  function draw() {
    const checkbox = document.querySelector('#route-detail input[type="checkbox"]');
    if (checkbox) checkbox.checked = visible;
    markers.forEach(marker => marker.remove()); markers = [];
    if (!catalog) return;
    const available = general || route().status === 'reference';
    const show = visible && available;
    chip.hidden = general || !show;
    chip.textContent = `${route().name} · aproximada ↗`;
    chip.setAttribute('aria-label', `Ver detalles de ${route().name}`);
    document.body.style.setProperty('--transit-color',route().color);
    document.body.classList.toggle('transit-active', true);
    document.querySelector('#transit-scope').textContent = general ? 'Todas las rutas disponibles' : route().name;
    document.querySelector('#routes-visible').checked = visible;
    document.querySelector('#stops-visible').checked = stopsVisible;
    drawVehicles();
    if (!map) return;
    if (!map.isStyleLoaded()) { map.once('idle',draw); return; }
    if(map.getLayer('local-stops')) map.setLayoutProperty('local-stops','visibility',stopsVisible && document.querySelector('#local-visible').checked ? 'visible' : 'none');
    if (!map.getSource('amor-transit')) {
      map.addSource('amor-transit', {type:'geojson',data:transit});
      map.addLayer({id:'amor-route-halo',type:'line',source:'amor-transit',filter:['==',['get','kind'],'route'],paint:{'line-color':'#ffffff','line-width':7,'line-opacity':0.85}});
      map.addLayer({id:'amor-route',type:'line',source:'amor-transit',filter:['==',['get','kind'],'route'],paint:{'line-color':'#8b23c9','line-width':4,'line-dasharray':[2,1]}});
    }
    ['amor-route-halo','amor-route'].forEach(id => {
      map.setFilter(id,['all',['==',['get','kind'],'route'],['in',['get','routeId'],['literal',general ? catalog.routes.filter(r=>r.status==='reference').map(r=>r.id) : [selected]]]]);
      map.setLayoutProperty(id,'visibility',show?'visible':'none');
    });
    map.setPaintProperty('amor-route','line-color',['match',['get','routeId'],...catalog.routes.flatMap(r=>[r.id,r.color]),'#125b46']);
    if (!stopsVisible) return;
    const groups=[];
    transit.features.filter(f=>f.properties.kind==='stop' && (general || f.properties.routeId===selected)).forEach(feature=>{
      const point=map.project(feature.geometry.coordinates);
      const group=groups.find(g=>Math.hypot(g.point.x-point.x,g.point.y-point.y)<48);
      if(group)group.features.push(feature);else groups.push({point,features:[feature]});
    });
    groups.forEach(group => {
      const feature=group.features[0];
      const owner = catalog.routes.find(r=>r.id===feature.properties.routeId);
      const clustered=group.features.length>1;
      const control = button(clustered?`${group.features.length}＋`:String(feature.properties.number), event => {
        event.stopPropagation();
        if(!clustered)return showStop(feature);
        if(popup)popup.remove();
        const content=element('div');content.append(element('strong',`${group.features.length} paradas cercanas`));
        group.features.forEach(f=>content.append(button(`${catalog.routes.find(r=>r.id===f.properties.routeId).name} · ${f.properties.name}`,()=>showStop(f),'cluster-stop')));
        popup=new maplibregl.Popup({offset:24}).setLngLat(feature.geometry.coordinates).setDOMContent(content).addTo(map);
      }, 'transit-marker');
      control.style.setProperty('--transit-color',owner.color);
      control.setAttribute('aria-label', clustered?`${group.features.length} paradas cercanas, abrir lista`:`${owner.name}, ${feature.properties.name}, ${feature.properties.accuracy==='source-coordinate'?'coordenada de My Maps':'ubicación aproximada'}`);
      const marker = new maplibregl.Marker({element:control}).setLngLat(feature.geometry.coordinates).addTo(map);
      markers.push(marker);
    });
  }
  function fitRoute() {
    if (!map) return notify('El mapa no está disponible.');
    visible = true; draw();
    const bounds = new maplibregl.LngLatBounds();
    transit.features.filter(f => general || f.properties.routeId === selected).forEach(feature => {
      if(feature.geometry.type === 'Point') bounds.extend(feature.geometry.coordinates);
      else feature.geometry.coordinates.forEach(coordinate => bounds.extend(coordinate));
    });
    if (bounds.isEmpty()) return;
    if (mobile()) showPanel('general');
    map.fitBounds(bounds,{padding:mobile()?{top:75,bottom:190,left:28,right:58}:{top:170,bottom:85,left:general?45:395,right:80},maxZoom:14,duration:600});
  }
  function choose(id) {
    selected = id; visible = true; general = false;
    if (popup) popup.remove();
    document.querySelector('#stop-route').value = selected;
    render(); draw();
  }
  function renderStops() {
    const list = document.querySelector('#transit-stop-list'); list.replaceChildren();
    const pending = route().status === 'pending';
    document.querySelector('#stop-disclaimer').textContent = pending ? 'Aún no se han añadido las paradas de esta ruta.' : route().id==='costera' ? 'Puntos 1–3: coordenadas del My Maps compartido. Otros 26: estimados desde la captura y ajustados al PBF.' : `${stops().length} marcadores de tu captura. Posiciones aproximadas; números de referencia, no orden de paso. Puede haber otras paradas.`;
    if (pending) { list.append(element('p','Comparte el mapa o las ubicaciones para integrar esta ruta.','info-box')); return; }
    stops().forEach(feature => {
      const node = button('',()=>showStop(feature),'transit-stop');
      node.append(element('span',String(feature.properties.number),'stop-number'),element('span',feature.properties.name),element('small',feature.properties.accuracy==='source-coordinate'?'My Maps ✓':'Aproximada ↗'));
      list.append(node);
    });
  }
  function render() {
    const list = document.querySelector('#route-list'); list.replaceChildren();
    catalog.routes.forEach(item => {
      const node = button('',()=>choose(item.id),'route-card');
      node.style.setProperty('--route-color',item.color);
      node.setAttribute('aria-pressed',String(item.id===selected));
      node.append(element('strong',item.name),element('small',item.status==='pending'?'Pendiente de datos':`${item.stopCount} paradas de referencia`));
      list.append(node);
    });
    const detail = document.querySelector('#route-detail'); detail.replaceChildren();
    const item = route();
    detail.append(element('h2',item.name),element('p',item.description));
    if(item.status==='pending') {
      detail.append(element('p','Recorrido y paradas pendientes. Todavía no se dibuja esta ruta.','info-box'));
      renderStops(); return;
    }
    detail.append(element('p',item.note,'info-box'));
    detail.append(button('Ver recorrido completo',fitRoute));
    detail.append(button(`Ver ${item.stopCount} paradas`,()=>{ document.querySelector('#stop-route').value=selected; showPanel('stops'); },'text-button route-action'));
    const visibility = element('label',null,'layer-option');
    const checkbox = document.createElement('input'); checkbox.type='checkbox'; checkbox.checked=visible;
    checkbox.addEventListener('change',()=>{visible=checkbox.checked;draw();});
    visibility.append(checkbox,document.createTextNode('Mostrar esta ruta en el mapa')); detail.append(visibility);
    const streets = element('details'); streets.append(element('summary','Calles indicadas en el cartel'));
    const streetList = element('ul'); item.streets.forEach(street => streetList.append(element('li',street))); streets.append(streetList); detail.append(streets);
    const sources = element('details'); sources.append(element('summary','Imágenes de referencia'));
    item.sources.forEach(source => {const link=element('a',source.title);link.href=source.url;link.target='_blank';link.rel='noopener';sources.append(link);}); detail.append(sources);
    renderStops();
  }
  document.querySelector('#stop-route').addEventListener('change',event=>choose(event.target.value));
  document.querySelector('#routes-visible').addEventListener('change',event=>{visible=event.target.checked;draw();});
  document.querySelector('#stops-visible').addEventListener('change',event=>{stopsVisible=event.target.checked;if(popup)popup.remove();draw();});
  document.querySelector('#local-visible').addEventListener('change',draw);
  document.querySelector('nav [data-panel="general"]').addEventListener('click',()=>{
    general=true; if(popup)popup.remove(); draw();
    if(transit) { const previous=visible;fitRoute();visible=previous;draw(); }
  });
  document.querySelector('#home').addEventListener('click',()=>{general=true;draw();});
  document.querySelector('nav [data-panel="routes"]').addEventListener('click',()=>{if(catalog)choose(selected);});
  document.querySelector('nav [data-panel="stops"]').addEventListener('click',()=>{if(catalog)choose(selected);});
  function drawVehicles() {
    vehicleMarkers.forEach(marker=>marker.remove()); vehicleMarkers=[];
    if(!map) return;
    const active = vehicles.filter(v=>v.active===true && Date.now()-Date.parse(v.updatedAt)<=120000 && Date.parse(v.updatedAt)<=Date.now()+30000);
    active.filter(v=>general || v.routeId===selected).forEach(v=>{
      const owner=catalog.routes.find(r=>r.id===v.routeId);
      const control=button('🚌',()=>{
        const content=element('div');content.append(element('strong',`Camión ${v.id}${v.simulated?' · SIMULACIÓN':''}`),element('small',owner?.name || 'Ruta sin identificar'));
        new maplibregl.Popup().setLngLat([v.longitude,v.latitude]).setDOMContent(content).addTo(map);
      },'vehicle-marker');
      control.style.background=owner?.color || '#125b46';
      control.setAttribute('aria-label',`Camión ${v.simulated?'simulado':'activo'} ${v.id} · ${owner?.name || 'Ruta sin identificar'}`);
      vehicleMarkers.push(new maplibregl.Marker({element:control}).setLngLat([v.longitude,v.latitude]).addTo(map));
    });
    if(config.simulateVehicles || config.vehiclesUrl) document.querySelector('#vehicle-status').textContent=`${config.simulateVehicles?'SIMULACIÓN · ':''}${active.filter(v=>general || v.routeId===selected).length} camiones · ${general?'todas las rutas':route().name}${config.simulateVehicles?' · sin GPS real':''}`;
  }
  function simulate() {
    vehicles=simulationPaths.flatMap(path=>[0,1].map(index=>{
      const progress=((Date.now()-simulationStarted)/1000/180+index/2)%1;
      const distance=progress*path.length;
      const segment=path.segments.find(s=>distance<=s.end) || path.segments.at(-1);
      const t=(distance-segment.start)/(segment.end-segment.start);
      return {id:`${path.id}-${index+1}`,routeId:path.id,active:true,simulated:true,updatedAt:new Date().toISOString(),longitude:segment.a[0]+(segment.b[0]-segment.a[0])*t,latitude:segment.a[1]+(segment.b[1]-segment.a[1])*t};
    }));
    drawVehicles();
  }
  function startSimulation() {
    simulationPaths=catalog.routes.filter(r=>r.status==='reference').map(r=>{
      const segments=[];let length=0;
      transit.features.filter(f=>f.properties.routeId===r.id && f.properties.kind==='route').forEach(f=>{
        f.geometry.coordinates.slice(1).forEach((b,i)=>{
          const a=f.geometry.coordinates[i],size=Math.hypot((b[0]-a[0])*Math.cos(a[1]*Math.PI/180),b[1]-a[1]);
          if(size>0){segments.push({a,b,start:length,end:length+size});length+=size;}
        });
      });
      return {id:r.id,segments,length};
    }).filter(p=>p.length>0);
    simulate();setInterval(simulate,1000);
  }
  async function refreshVehicles() {
    if(!config.vehiclesUrl) return;
    try {
      const data=await fetchJSON(config.vehiclesUrl);
      if(!Array.isArray(data.vehicles)) throw new Error('Formato inválido');
      vehicles=data.vehicles.filter(v=>v.id!=null && Number.isFinite(v.longitude) && Number.isFinite(v.latitude) && Math.abs(v.longitude)<=180 && Math.abs(v.latitude)<=85 && Number.isFinite(Date.parse(v.updatedAt)));
      drawVehicles();
    } catch {
      vehicles=[];drawVehicles();
      document.querySelector('#vehicle-status').textContent='Camiones en vivo: conexión no disponible';
    }
  }
  chip.addEventListener('click',()=>showPanel('routes'));
  Promise.all([fetchJSON('data/routes.json'),fetchJSON('data/transit.geojson')]).then(([data,geo])=>{
    catalog=data; transit=geo; render();
    if(map) {map.on('style.load',draw);map.on('moveend',draw);}
    draw();
    if(config.simulateVehicles) startSimulation();
    else {refreshVehicles();if(config.vehiclesUrl) setInterval(refreshVehicles,15000);}
  }).catch(()=>{
    document.querySelector('#route-list').textContent='No se pudieron cargar las rutas. Recarga la página desde el servidor local.';
    document.querySelector('#transit-stop-list').textContent='Paradas no disponibles.';
  });
})();
