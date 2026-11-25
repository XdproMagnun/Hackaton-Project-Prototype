'use strict';
// El catálogo de transporte es independiente del PBF: reimportarlo no borra las rutas.
(() => {
  let catalog;
  let transit;
  let selected = '';
  let visible = true;
  let general = true;
  let stopsVisible = true;
  let vehicles = [];
  let vehicleMarkers = new Map();
  let vehicleAnimationFrame = 0;
  let vehiclesBusy = false;
  let markers = [];
  let popup;
  let userLocation;
  const chip = document.querySelector('#transit-chip');
  const nearestStopChip = document.querySelector('#nearest-stop-chip');
  const nearestStopResults = document.querySelector('#nearest-stop-results');
  const nearestStopNote = document.querySelector('#nearest-stop-note');
  const mobile = () => window.matchMedia('(max-width: 650px)').matches;
  const element = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  const stops = () => transit.features.filter(f => f.properties.routeId === selected && f.properties.kind === 'stop');
  const route = () => catalog.routes.find(item => item.id === selected) || catalog.routes[0];
  function button(text, action, className = 'primary wide') {
    const node = element('button', text, className);
    node.type = 'button'; node.addEventListener('click', action);
    return node;
  }
  function showStop(feature) {
    if (!map) return notify('El mapa no está disponible.');
    selected = feature.properties.routeId;
    general = false;
    document.querySelector('#stop-route').value = selected;
    render();
    visible = true; draw();
    if (mobile()) showPanel('general');
    if (popup) popup.remove();
    const content = element('div');
    content.append(element('strong', `${catalog.routes.find(r=>r.id===feature.properties.routeId).name} · ${feature.properties.name}`), element('small', feature.properties.note));
    popup = new maplibregl.Popup({offset: 20}).setLngLat(feature.geometry.coordinates).setDOMContent(content).addTo(map);
    map.flyTo({center: feature.geometry.coordinates, zoom: 16, padding: mobile() ? {top:100,bottom:80,left:30,right:30} : {top:80,bottom:60,left:390,right:60}});
  }
  function distanceMeters(from, to) {
    const radians = degrees => degrees * Math.PI / 180;
    const latitudeDelta = radians(to[1] - from[1]);
    const longitudeDelta = radians(to[0] - from[0]);
    const a = Math.sin(latitudeDelta / 2) ** 2
      + Math.cos(radians(from[1])) * Math.cos(radians(to[1])) * Math.sin(longitudeDelta / 2) ** 2;
    return 6371008.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  function updateNearestStop() {
    if (!userLocation || !catalog || !transit) return;
    const userCoordinates = [userLocation.longitude, userLocation.latitude];
    const nearestByRoute = catalog.routes.map(owner => {
      const closest = transit.features
        .filter(feature => feature.properties.kind === 'stop'
          && feature.geometry.type === 'Point'
          && feature.properties.routeId === owner.id)
        .map(feature => ({feature, distance: distanceMeters(userCoordinates, feature.geometry.coordinates)}))
        .sort((a, b) => a.distance - b.distance)[0] || null;
      return {owner, closest};
    }).sort((a, b) => (a.closest?.distance ?? Infinity) - (b.closest?.distance ?? Infinity));
    if (!nearestByRoute.some(item => item.closest)) {
      nearestStopChip.hidden = true;
      return;
    }
    nearestStopResults.replaceChildren();
    nearestByRoute.forEach(({owner, closest}) => {
      const row = element('button', null, 'nearest-stop-option');
      row.type = 'button';
      row.style.setProperty('--route-color', owner.color);
      if (!closest) {
        row.disabled = true;
        row.setAttribute('aria-label', `${owner.name}: sin paradas georreferenciadas`);
        const details = element('span');
        details.append(element('strong', owner.name), element('small', 'Sin paradas georreferenciadas'));
        row.append(details);
        nearestStopResults.append(row);
        return;
      }
      const properties = closest.feature.properties;
      const formattedDistance = closest.distance < 1000
        ? `${Math.round(closest.distance)} m`
        : `${(closest.distance / 1000).toFixed(1)} km`;
      const accuracy = properties.accuracy === 'source-coordinate' ? 'coordenada de referencia' : 'posición aproximada';
      const details = element('span');
      details.append(element('strong', owner.name), element('small', `${properties.name || `Parada ${properties.number}`} · ${accuracy}`));
      row.append(details, element('small', formattedDistance));
      row.setAttribute('aria-label', `${owner.name}: ${properties.name || `Parada ${properties.number}`}, a ${formattedDistance} en línea recta; ${accuracy}. Mostrar en el mapa.`);
      row.addEventListener('click', () => showStop(closest.feature));
      nearestStopResults.append(row);
    });
    const gpsAccuracy = Number.isFinite(userLocation.accuracy) ? `GPS ±${Math.round(userLocation.accuracy)} m` : 'GPS activo';
    nearestStopNote.textContent = `${gpsAccuracy} · distancias en línea recta`;
    nearestStopChip.hidden = false;
  }
  window.addEventListener('ubicarmen:user-location', event => {
    userLocation = event.detail;
    updateNearestStop();
  });
  window.addEventListener('ubicarmen:user-location-cleared', () => {
    userLocation = null;
    nearestStopChip.hidden = true;
  });
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
    window.syncLayerIcons?.();
    updateNearestStop();
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
      if (!clustered) control.prepend(appIcon('stop'));
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
    document.querySelector('#stop-disclaimer').textContent = pending ? 'Aún no se han añadido las paradas de esta ruta.' : route().id==='costera' ? 'Puntos 1–3: coordenadas del My Maps compartido. Otros 26: estimados desde la captura y ajustados al PBF.' : route().id==='laguna-terminos' ? 'El cartel muestra el recorrido, pero no incluye paradas georreferenciadas. La ruta y los camiones simulados están disponibles.' : `${stops().length} marcadores de tu captura. Posiciones aproximadas; números de referencia, no orden de paso. Puede haber otras paradas.`;
    if (pending) { list.append(element('p','Comparte el mapa o las ubicaciones para integrar esta ruta.','info-box')); return; }
    if (!stops().length) { list.append(element('p','Todavía no hay paradas georreferenciadas en la fuente de esta ruta.','info-box')); return; }
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
      if (window.uiPrefs.favorites.includes(item.id)) { const badge = element('span', 'Favorita', 'favorite-tag'); badge.prepend(appIcon('heart')); node.append(badge); }
      list.append(node);
    });
    const detail = document.querySelector('#route-detail'); detail.replaceChildren();
    const item = route();
    detail.append(element('h2',item.name),element('p',item.description));
    const favorite = button('', () => {
      const saved = window.uiPrefs.favorites.includes(item.id);
      window.uiPrefs.favorites = saved ? window.uiPrefs.favorites.filter(id => id !== item.id) : [...window.uiPrefs.favorites, item.id];
      const persisted = window.UbiAccount ? window.UbiAccount.saveFavorite(item.id, !saved) : window.saveUiPrefs();
      render();
      if (persisted) notify(saved ? 'Ruta retirada de favoritos.' : 'Ruta guardada en favoritos.', 'optional');
    }, 'favorite-button');
    const saved = window.uiPrefs.favorites.includes(item.id);
    favorite.setAttribute('aria-pressed', String(saved));
    favorite.append(appIcon(saved ? 'heart' : 'heart-off'), document.createTextNode(saved ? 'Ruta favorita' : 'Guardar favorita'));
    detail.append(favorite);
    if(item.status==='pending') {
      detail.append(element('p','Recorrido y paradas pendientes. Todavía no se dibuja esta ruta.','info-box'));
      renderStops(); return;
    }
    const routeNote = element('p', item.note, 'info-box');
    routeNote.prepend(appIcon('warning'), document.createTextNode(' '));
    detail.append(routeNote);
    detail.append(button('Ver recorrido completo',fitRoute));
    detail.append(button(item.stopCount ? `Ver ${item.stopCount} paradas` : 'Ver paradas',()=>{ document.querySelector('#stop-route').value=selected; showPanel('stops'); },'text-button route-action'));
    const visibility = element('label',null,'layer-option');
    const checkbox = document.createElement('input'); checkbox.type='checkbox'; checkbox.checked=visible;
    checkbox.addEventListener('change',()=>{visible=checkbox.checked;draw();});
    visibility.append(checkbox,document.createTextNode('Mostrar esta ruta en el mapa')); detail.append(visibility);
    const streets = element('details'); streets.append(element('summary','Calles indicadas en el cartel'));
    const streetList = element('ul'); item.streets.forEach(street => streetList.append(element('li',street))); streets.append(streetList); detail.append(streets);
    const sources = element('details'); sources.append(element('summary','Imágenes de referencia'));
    item.sources.forEach(source => {const link=element('a',source.title);link.href=source.url;link.target='_blank';link.rel='noopener';if (/^assets\/.*\.png$/.test(source.url)) {const preview=document.createElement('img');preview.src=source.url;preview.alt=source.title;preview.loading='lazy';preview.className='reference-preview';link.prepend(preview);}sources.append(link);}); detail.append(sources);
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
  function animateVehicleMarkers() {
    vehicleAnimationFrame = 0;
    const now = performance.now();
    let moving = false;
    vehicleMarkers.forEach(entry => {
      if (entry.animationStarted === null || entry.animationStarted === undefined) return;
      const progress = Math.min((now - entry.animationStarted) / entry.animationDuration, 1);
      const eased = progress * (2 - progress);
      const position = [
        entry.animationFrom[0] + (entry.target[0] - entry.animationFrom[0]) * eased,
        entry.animationFrom[1] + (entry.target[1] - entry.animationFrom[1]) * eased
      ];
      entry.marker.setLngLat(position);
      if (progress === 1) entry.animationStarted = null;
      else moving = true;
    });
    if (moving) vehicleAnimationFrame = requestAnimationFrame(animateVehicleMarkers);
  }
  function drawVehicles() {
    if(!map) return;
    const active = vehicles.filter(v=>v.active===true && Date.now()-Date.parse(v.updatedAt)<=120000 && Date.parse(v.updatedAt)<=Date.now()+30000);
    const shown = active.filter(v=>general || v.routeId===selected);
    const visibleIds = new Set(shown.map(vehicle => String(vehicle.id)));
    shown.forEach(v=>{
      const owner=catalog.routes.find(r=>r.id===v.routeId);
      const id=String(v.id);
      const coordinates=[v.longitude,v.latitude];
      let entry=vehicleMarkers.get(id);
      if(!entry){
        entry={vehicle:v,target:coordinates,animationStarted:null};
        entry.control=button('',()=>{
          const vehicle=entry.vehicle;
          const vehicleOwner=catalog.routes.find(r=>r.id===vehicle.routeId);
          const content=element('div');content.append(element('strong',`Camión ${vehicle.id}${vehicle.simulated?' · SIMULACIÓN':''}`),element('small',vehicleOwner?.name || 'Ruta sin identificar'));
          new maplibregl.Popup().setLngLat([vehicle.longitude,vehicle.latitude]).setDOMContent(content).addTo(map);
        },'vehicle-marker');
        entry.control.append(appIcon('bus'));
        entry.marker=new maplibregl.Marker({element:entry.control}).setLngLat(coordinates).addTo(map);
        vehicleMarkers.set(id,entry);
      } else if (v.simulated && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        const changed = !entry.target || entry.target[0] !== coordinates[0] || entry.target[1] !== coordinates[1];
        if (changed) {
          entry.animationFrom=entry.marker.getLngLat().toArray();
          entry.target=coordinates;
          entry.animationStarted=performance.now();
          entry.animationDuration=1000;
          if (!vehicleAnimationFrame) vehicleAnimationFrame=requestAnimationFrame(animateVehicleMarkers);
        }
      } else {
        entry.target=coordinates;
        entry.animationStarted=null;
        entry.marker.setLngLat(coordinates);
      }
      entry.vehicle=v;
      entry.control.style.background=owner?.color || '#125b46';
      entry.control.setAttribute('aria-label',`Camión ${v.simulated?'simulado':'activo'} ${v.id} · ${owner?.name || 'Ruta sin identificar'}`);
    });
    vehicleMarkers.forEach((entry,id)=>{if(!visibleIds.has(id)){entry.marker.remove();vehicleMarkers.delete(id);}});
    const simulated=UbiData.lastVehicleOrigin==='simulation';
    if(config.simulateVehicles || config.vehiclesUrl || UbiData.hasFirebase()) document.querySelector('#vehicle-status').textContent=`${simulated?'SIMULACIÓN · ':''}${active.filter(v=>general || v.routeId===selected).length} camiones · ${general?'todas las rutas':route().name}${simulated?' · sin GPS real':''}`;
  }
  async function simulate() {
    if(vehiclesBusy) return;
    vehiclesBusy=true;
    try { vehicles=await UbiData.getVehicles(); drawVehicles(); }
    finally { vehiclesBusy=false; }
  }
  function startSimulation() {
    simulate();setInterval(simulate,5000);
  }
  async function refreshVehicles() {
    if(!config.vehiclesUrl && !UbiData.hasFirebase()) return;
    vehicles=await UbiData.getVehicles();
    drawVehicles();
    if(UbiData.lastVehicleOrigin==='simulation') document.querySelector('#vehicle-status').textContent='Camiones en vivo: conexión no disponible · mostrando simulación';
  }
  chip.addEventListener('click',()=>showPanel('routes'));
  window.addEventListener('ubicarmen:account',()=>{if(catalog)render();});
  Promise.all([UbiData.getRoutes(),UbiData.getTransit()]).then(([data,geo])=>{
    catalog=data; transit=geo;
    // El catalogo puede cambiar de fuente: la ruta elegida tiene que existir en el actual.
    if(!catalog.routes.some(item=>item.id===selected)) selected=catalog.routes[0].id;
    const select=document.querySelector('#stop-route');
    select.replaceChildren(...catalog.routes.map(item=>{const option=document.createElement('option');option.value=item.id;option.textContent=item.name;return option;}));
    select.value=selected;
    render();
    if(map) {map.on('style.load',draw);map.on('moveend',draw);}
    draw();
    if(config.simulateVehicles) startSimulation();
    else {refreshVehicles();if(config.vehiclesUrl || UbiData.hasFirebase()) setInterval(refreshVehicles,15000);}
  }).catch(()=>{
    document.querySelector('#route-list').textContent='No se pudieron cargar las rutas. Recarga la página desde el servidor local.';
    document.querySelector('#transit-stop-list').textContent='Paradas no disponibles.';
  });
})();
