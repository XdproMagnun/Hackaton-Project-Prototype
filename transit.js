'use strict';
// El catálogo de transporte es independiente del PBF: reimportarlo no borra las rutas.
(() => {
  let catalog;
  let transit;
  let selected = 'campus-3';
  let visible = true;
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
    content.append(element('strong', `${route().name} · ${feature.properties.name}`), element('small', feature.properties.note));
    popup = new maplibregl.Popup({offset: 20}).setLngLat(feature.geometry.coordinates).setDOMContent(content).addTo(map);
    map.flyTo({center: feature.geometry.coordinates, zoom: 16, padding: mobile() ? {top:100,bottom:80,left:30,right:30} : {top:80,bottom:60,left:390,right:60}});
  }
  function draw() {
    const checkbox = document.querySelector('#route-detail input[type="checkbox"]');
    if (checkbox) checkbox.checked = visible;
    markers.forEach(marker => marker.remove()); markers = [];
    const available = route().status === 'reference';
    const show = visible && available;
    chip.hidden = !show;
    chip.textContent = `${route().name} · aproximada ↗`;
    chip.setAttribute('aria-label', `Ver detalles de ${route().name}`);
    document.body.style.setProperty('--transit-color',route().color);
    document.body.classList.toggle('transit-active', show);
    if (!map) return;
    if (!map.isStyleLoaded()) { map.once('idle',draw); return; }
    if (!map.getSource('amor-transit')) {
      map.addSource('amor-transit', {type:'geojson',data:transit});
      map.addLayer({id:'amor-route-halo',type:'line',source:'amor-transit',filter:['==',['get','kind'],'route'],paint:{'line-color':'#ffffff','line-width':7,'line-opacity':0.85}});
      map.addLayer({id:'amor-route',type:'line',source:'amor-transit',filter:['==',['get','kind'],'route'],paint:{'line-color':'#8b23c9','line-width':4,'line-dasharray':[2,1]}});
    }
    ['amor-route-halo','amor-route'].forEach(id => {
      map.setFilter(id,['all',['==',['get','kind'],'route'],['==',['get','routeId'],selected]]);
      map.setLayoutProperty(id,'visibility',show?'visible':'none');
    });
    map.setPaintProperty('amor-route','line-color',route().color);
    if (!show) return;
    stops().forEach(feature => {
      const control = button(String(feature.properties.number), event => { event.stopPropagation(); showStop(feature); }, 'transit-marker');
      control.setAttribute('aria-label', `${route().name}, ${feature.properties.name}, ubicación aproximada`);
      const marker = new maplibregl.Marker({element:control}).setLngLat(feature.geometry.coordinates).addTo(map);
      markers.push(marker);
    });
  }
  function fitRoute() {
    if (!map) return notify('El mapa no está disponible.');
    visible = true; draw();
    const bounds = new maplibregl.LngLatBounds();
    transit.features.filter(f => f.properties.routeId === selected).forEach(feature => {
      if(feature.geometry.type === 'Point') bounds.extend(feature.geometry.coordinates);
      else feature.geometry.coordinates.forEach(coordinate => bounds.extend(coordinate));
    });
    if (bounds.isEmpty()) return;
    if (mobile()) showPanel('general');
    map.fitBounds(bounds,{padding:mobile()?{top:110,bottom:85,left:35,right:55}:{top:100,bottom:75,left:395,right:80},maxZoom:14,duration:600});
  }
  function choose(id) {
    selected = id; visible = true;
    if (popup) popup.remove();
    document.querySelector('#stop-route').value = selected;
    render(); draw();
  }
  function renderStops() {
    const list = document.querySelector('#transit-stop-list'); list.replaceChildren();
    const pending = route().status === 'pending';
    document.querySelector('#stop-disclaimer').textContent = pending ? 'Aún no se han añadido las paradas de esta ruta.' : `${stops().length} marcadores de tu captura. Posiciones aproximadas; números de referencia, no orden de paso. Puede haber otras paradas.`;
    if (pending) { list.append(element('p','Comparte el mapa o las ubicaciones para integrar esta ruta.','info-box')); return; }
    stops().forEach(feature => {
      const node = button('',()=>showStop(feature),'transit-stop');
      node.append(element('span',String(feature.properties.number),'stop-number'),element('span',feature.properties.name),element('small','Aproximada ↗'));
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
  chip.addEventListener('click',()=>showPanel('routes'));
  Promise.all([fetchJSON('data/routes.json'),fetchJSON('data/transit.geojson')]).then(([data,geo])=>{
    catalog=data; transit=geo; render();
    if(map) map.on('style.load',draw);
    draw();
  }).catch(()=>{
    document.querySelector('#route-list').textContent='No se pudieron cargar las rutas. Recarga la página desde el servidor local.';
    document.querySelector('#transit-stop-list').textContent='Paradas no disponibles.';
  });
})();
