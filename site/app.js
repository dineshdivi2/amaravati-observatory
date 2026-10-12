const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fetchJSON = async (file) => { const res = await fetch(`./data/${file}.json`); if (!res.ok) throw new Error(`${file}: ${res.status}`); return res.json(); };
const dates = ['12 Oct 2026', '12 Apr 2027', '12 Oct 2027', '12 Oct 2028', 'Long-term vision'];
const statuses = {
  construction_reported: 'Construction reported', procurement_evidence: 'Procurement evidence',
  handover_reported: 'Handover reported', partial_opening_reported: 'Partial opening reported',
  tendering_reported: 'Tendering reported', dpr_consultancy_listing: 'DPR consultancy listed',
  construction_evidence: 'Construction evidence', mou_announced: 'MoU announced',
  program_and_planning_evidence: 'Program / planning evidence', rfp_listed: 'RFP listed',
  consultancy_listing: 'Consultancy listed', plot_procurement_listed: 'Plot procurement listed',
  official_inspection_reported: 'Official inspection', land_pooling_reported: 'Land pooling reported'
};
const categories = {government:'Government', housing:'Housing', transport:'Mobility', regional_transport:'Regional mobility',
  technology:'Technology', education:'Education', resilience:'Water & resilience', utilities:'Utilities',
  public_realm:'Public realm', commercial:'Commerce', culture:'Culture', sports:'Sports'};
let projects = [], sources = [], selectedTime = 0, compare = false, selectedProject = null, filter = 'all';
let sceneAPI = null, toastTimer, previousFocus;
let panelOpen = false;
function toast(message) { $('#toast').textContent = message; $('#toast').classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 4200); }
function niceDate(date) { return date ? new Date(`${date}T12:00:00`).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}) : 'Date not established'; }
function stageHTML(project) { return `<span class="stage-badge ${project.status==='handover_reported'||project.status==='partial_opening_reported'?'complete':''}"><i></i>${escapeHTML(statuses[project.status] || project.status)}</span>`; }
function filteredProjects() {
  const query = $('#project-search').value.toLowerCase().trim();
  return projects.filter(p => {
    const matches = filter === 'all' || (filter === 'transport' ? ['transport','regional_transport'].includes(p.category) : filter === 'other' ? !['government','housing','transport','regional_transport'].includes(p.category) : p.category === filter);
    return matches && `${p.name} ${p.category} ${p.summary}`.toLowerCase().includes(query);
  });
}
function renderList() {
  const list = filteredProjects();
  $('#project-list').innerHTML = list.length ? list.map(p => `<button class="project-row" data-project="${escapeHTML(p.id)}" aria-label="Read evidence for ${escapeHTML(p.name)}"><span class="project-name"><span class="row-number">${String(projects.indexOf(p)+1).padStart(2,'0')}</span><span><b>${escapeHTML(p.name)}</b><small>${escapeHTML(categories[p.category] || p.category)}</small></span></span><span class="project-date">${escapeHTML(niceDate(p.evidence_date))}</span>${stageHTML(p)}<span class="row-arrow">↗</span></button>`).join('') : '<p class="empty-results">No projects match this search. Try a different name or category.</p>';
  $('#result-count').textContent = `${list.length} ${list.length === 1 ? 'project' : 'projects'}`;
  $$('.project-row').forEach(button => button.addEventListener('click', () => openProject(button.dataset.project)));
}
function openProject(id, focus = true) {
  const project = projects.find(p => p.id === id); if (!project) return;
  selectedProject = id; previousFocus = document.activeElement;
  const projectSources = project.sources.map(ref => sources.find(s => s.id === ref)).filter(Boolean);
  const mapped = sceneAPI?.hasProject(id);
  $('#panel-content').innerHTML = `<div class="eyebrow">${escapeHTML(categories[project.category] || project.category)} / EVIDENCE FILE</div><h2>${escapeHTML(project.name)}</h2><div class="panel-stage">${stageHTML(project)}<span class="project-date">${escapeHTML(niceDate(project.evidence_date))}</span></div><p>${escapeHTML(project.summary)}</p><span class="detail-label">WHAT THE MODEL KNOWS</span><div class="detail-measurements"><div><b>Not measured</b><small>Physical completion</small></div><div><b>Illustrative only</b><small>3D building height</small></div></div>${project.announced_target ? `<span class="detail-label">ANNOUNCED TARGET</span><div class="target-date">${escapeHTML(niceDate(project.announced_target.date))}</div><p class="panel-context">Reported government target. Delivery has not been confirmed.</p>` : ''}<span class="detail-label">STILL TO VERIFY</span><p>${escapeHTML(project.remaining_verification)}</p><span class="detail-label">FOLLOW THE SOURCES</span>${projectSources.map(s=>`<a class="source-link" href="${escapeHTML(s.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(s.title)} ↗<span>${escapeHTML(s.kind.replaceAll('_',' '))}${s.published_on ? ' · '+escapeHTML(niceDate(s.published_on)) : ''}</span></a>`).join('')}<p class="panel-context">Evidence checked 12 October 2026. This panel keeps its factual status when you change the future scenario.</p>${mapped ? `<button class="panel-map-button" id="focus-project">Locate in the 3D study ↗</button>` : `<p class="panel-context">No verified site geometry is attached to this project group. It is listed without a fabricated map pin.</p>`}`;
  $('#project-panel').hidden = false; panelOpen = true;
  $('#project-panel').scrollTop = 0;
  $('#focus-project')?.addEventListener('click', () => { closePanel(); enterExplore(); sceneAPI?.focus(id); });
  sceneAPI?.select(id);
  if (focus) $('#close-panel').focus({preventScroll:true});
}
function closePanel() { $('#project-panel').hidden = true; panelOpen = false; previousFocus?.focus?.({preventScroll:true}); }
function setTime(index) {
  selectedTime = index;
  $$('.time-stops button').forEach(b => { const selected = Number(b.dataset.time) === index; b.classList.toggle('selected',selected); b.setAttribute('aria-pressed', String(selected)); });
  $('#selected-date').textContent = dates[index];
  $('#scene-mode').textContent = index === 0 ? 'TODAY · PLANNING MODEL' : `${['','6 MONTHS','1 YEAR','2 YEARS','MASTERPLAN'][index]} · ILLUSTRATIVE SCENARIO`;
  $('#scene-disclaimer').textContent = index === 0 ? 'Mapped parcels. Illustrative buildings and heights.' : 'Possible urban form. No completion or occupancy prediction.';
  sceneAPI?.setTime(index);
  updateComparisonLabels();
}
function updateComparisonLabels() {
  $('.compare-marker')?.remove();
  if (compare) { const marker = document.createElement('div'); marker.className = 'compare-marker'; marker.innerHTML = `<span>TODAY · PARCEL STUDY</span><span>${escapeHTML(dates[selectedTime])} · SCENARIO</span>`; $('#city').append(marker); }
}
function enterExplore() {
  $('#city').classList.add('exploring'); $('#close-explore').hidden = false;
  $('#view-title').textContent = 'Explore the government complex';
  $('#view-subtitle').textContent = 'Select a landmark to follow its evidence';
  $('#city').scrollIntoView({behavior:reducedMotion?'instant':'smooth'});
  sceneAPI?.resize();
}
function openNotes() { previousFocus = document.activeElement; $('#notes-dialog').showModal(); }
$('#explore-button').addEventListener('click',enterExplore);
$('#close-explore').addEventListener('click',()=>{ $('#city').classList.remove('exploring'); $('#close-explore').hidden=true; $('#view-title').textContent='The government spine'; $('#view-subtitle').textContent='An architectural massing study'; sceneAPI?.reset(); sceneAPI?.resize(); });
$('#close-panel').addEventListener('click',closePanel);
$('#close-notes').addEventListener('click',()=>$('#notes-dialog').close());
$('#notes-dialog').addEventListener('close',()=>previousFocus?.focus?.());
['about-button','data-button','method-button'].forEach(id=>$('#'+id).addEventListener('click',openNotes));
$('#notes-dialog').addEventListener('click',event=>{if(event.target === $('#notes-dialog')) { const rect=event.target.getBoundingClientRect(); if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom) event.target.close(); }});
$('#project-search').addEventListener('input',renderList);
$$('.filter-buttons button').forEach(button=>button.addEventListener('click',()=>{filter=button.dataset.filter;$$('.filter-buttons button').forEach(b=>b.classList.toggle('selected',b===button));renderList();}));
$$('.time-stops button').forEach(button=>button.addEventListener('click',()=>setTime(Number(button.dataset.time))));
$('#compare-button').addEventListener('click',()=>{compare=!compare;if(compare&&selectedTime===0)setTime(1);$('#compare-button').setAttribute('aria-pressed',String(compare));sceneAPI?.setCompare(compare);if(compare){enterExplore();sceneAPI?.focus('secretariat');$('#view-title').textContent='Compare the skyline study';$('#view-subtitle').textContent='One camera. Two visual treatments.';}updateComparisonLabels();});
$$('.layer-buttons button').forEach(button=>button.addEventListener('click',()=>{const show=button.getAttribute('aria-pressed')!=='true';button.setAttribute('aria-pressed',String(show));button.classList.toggle('on',show);sceneAPI?.setLayer(button.dataset.layer,show);}));
$('#reset-view').addEventListener('click',()=>sceneAPI?.reset());
$('#tour-button').addEventListener('click',()=>{const running=$('#tour-button').getAttribute('aria-pressed')!=='true';$('#tour-button').setAttribute('aria-pressed',String(running));$('#tour-button').setAttribute('aria-label',running?'Stop slow camera orbit':'Start slow camera orbit');$('#tour-button').textContent=running?'Ⅱ':'▷';sceneAPI?.tour(running);});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape' && panelOpen) closePanel();
  if(event.key==='Tab' && panelOpen) { const elements=[...$('#project-panel').querySelectorAll('button,a[href]')].filter(e=>!e.hidden);const first=elements[0],last=elements.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();} }
});

async function makeScene(data) {
  const THREE = await import('three');
  const {OrbitControls} = await import('./vendor/OrbitControls.js');
  const host = $('#world');
  const renderer = new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));
  renderer.setClearColor(0x263c39,0);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.3;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
  host.append(renderer.domElement);
  const scene=new THREE.Scene();scene.fog=new THREE.FogExp2(0x294039,.0008);
  const camera=new THREE.PerspectiveCamera(38,1,1,3500);
  const home=new THREE.Vector3(205,195,310);camera.position.copy(home);
  const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,0,0);controls.enableDamping=true;controls.dampingFactor=.065;controls.minDistance=65;controls.maxDistance=1000;controls.maxPolarAngle=Math.PI*.455;controls.minPolarAngle=.18;controls.enablePan=true;controls.autoRotateSpeed=.25;
  scene.add(new THREE.HemisphereLight(0xe7efdc,0x172e26,2.8));
  const sun=new THREE.DirectionalLight(0xffe0a6,3.7);sun.position.set(-220,320,-160);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-500;sun.shadow.camera.right=500;sun.shadow.camera.top=500;sun.shadow.camera.bottom=-500;sun.shadow.camera.near=1;sun.shadow.camera.far=1100;sun.shadow.normalBias=.12;sun.shadow.bias=-.00015;scene.add(sun);
  const fill=new THREE.DirectionalLight(0xbedad4,1.1);fill.position.set(200,100,300);scene.add(fill);
  const layers=Object.fromEntries(['landmarks','roads','water','footprints','parcels'].map(k=>{const group=new THREE.Group();scene.add(group);return[k,group];}));
  const landscape=new THREE.Group();scene.add(landscape);
  const future=new THREE.Group();layers.landmarks.add(future);future.visible=false;
  const pickables=[];const landmarks=[];
  let rng=101;const rand=()=>{rng=(rng*1664525+1013904223)>>>0;return rng/4294967296;};
  const point=([lon,lat])=>new THREE.Vector2((lon-80.49)*106740/10,-(lat-16.53)*111320/10);
  const material=(color,more={})=>new THREE.MeshStandardMaterial({color,roughness:.84,metalness:.04,...more});
  const stone=material(0xe4d6b5),concrete=material(0xbdbba5),dark=material(0x314640),gold=material(0xd7b678,{metalness:.35,roughness:.48}),glass=material(0x59857d,{metalness:.25,roughness:.23});
  const boxGeo=new THREE.BoxGeometry(1,1,1);
  function box(parent,x,y,z,w,h,d,mat=stone){const mesh=new THREE.Mesh(boxGeo,mat);mesh.position.set(x,y,z);mesh.scale.set(w,h,d);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
  function shape(poly){const rings=poly.map(r=>r.map(point));const s=new THREE.Shape(rings[0]);for(const ring of rings.slice(1))s.holes.push(new THREE.Path(ring));return s;}
  function eachPolygon(geo,fn){if(geo.type==='Polygon')fn(geo.coordinates);if(geo.type==='MultiPolygon')geo.coordinates.forEach(fn);}
  function polygonMesh(poly,mat,height=.1,y=.03){const g=new THREE.ExtrudeGeometry(shape(poly),{depth:height,bevelEnabled:false,curveSegments:1});g.rotateX(Math.PI/2);const mesh=new THREE.Mesh(g,mat);mesh.position.y=y+height;mesh.receiveShadow=true;return mesh;}
  function outline(poly,color,parent,y=.5){for(const ring of poly){const pts=ring.map(c=>{const p=point(c);return new THREE.Vector3(p.x,y,p.y);});parent.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color,transparent:true,opacity:.6})));}}
  const ground=box(landscape,0,-1.2,0,2400,2,2400,material(0x435247));ground.receiveShadow=true;
  // Procedural fields are scenic context, not classified satellite land cover.
  const fieldMats=[0x56634b,0x626746,0x3d5540,0x4e6044,0x71724e,0x536551].map(c=>material(c));
  for(let i=0;i<340;i++){const x=(rand()-.5)*2000,z=(rand()-.5)*2000;if(Math.abs(x)<80&&Math.abs(z)<370)continue;const m=box(landscape,x,-.15,z,20+rand()*100,.2,20+rand()*80,fieldMats[i%fieldMats.length]);m.castShadow=false;}
  const boundaryMat=material(0x5d7054,{transparent:true,opacity:.5});
  for(const f of data.boundary.features)eachPolygon(f.geometry,poly=>{landscape.add(polygonMesh(poly,boundaryMat,.05,.01));outline(poly,0x9aaa74,landscape,.15);});
  const landMats=[material(0x7c8968),material(0x68775b),material(0x516d53),material(0x899075)];
  data.government.features.forEach((f,i)=>eachPolygon(f.geometry,poly=>layers.parcels.add(polygonMesh(poly,landMats[i%4],.05,.2))));
  const parcelMat=material(0xa6a589,{transparent:true,opacity:.8});
  data.parcels.features.forEach(f=>eachPolygon(f.geometry,poly=>{layers.parcels.add(polygonMesh(poly,parcelMat,.08,.35));outline(poly,0xd5c495,layers.parcels,.6);}));
  const waterMat=material(0x386e70,{roughness:.28,metalness:.25});
  data.water.features.forEach(f=>eachPolygon(f.geometry,poly=>layers.water.add(polygonMesh(poly,waterMat,.12,.3))));
  // Road ribbons use the downloaded centreline coordinates; width is a display treatment.
  const roadMat=material(0xb0b9a0);
  for(const feature of data.roads.features){const lines=feature.geometry.type==='MultiLineString'?feature.geometry.coordinates:[feature.geometry.coordinates];for(const line of lines){for(let i=1;i<line.length;i++){const a=point(line[i-1]),b=point(line[i]);const distance=a.distanceTo(b);if(distance<.01)continue;const ribbon=box(layers.roads,(a.x+b.x)/2,.55,(a.y+b.y)/2,.85,.09,distance,roadMat);ribbon.rotation.y=Math.atan2(b.x-a.x,b.y-a.y);ribbon.castShadow=false;}}}
  const footprintMat=material(0xc8c2a3);data.footprints.features.forEach(f=>eachPolygon(f.geometry,poly=>{const mesh=polygonMesh(poly,footprintMat,.7,.45);mesh.castShadow=true;layers.footprints.add(mesh);}));
  const stemGeo=new THREE.CylinderGeometry(.15,.24,1.3,5);const crownGeo=new THREE.IcosahedronGeometry(.85,0);const treeCount=1500;
  const stems=new THREE.InstancedMesh(stemGeo,material(0x6e6650),treeCount),crowns=new THREE.InstancedMesh(crownGeo,material(0x365d3f),treeCount);const dummy=new THREE.Object3D();
  for(let i=0;i<treeCount;i++){const x=i<1000?(rand()<.5?-1:1)*(48+rand()*45):(rand()-.5)*700;const z=(rand()-.5)*760;const size=.6+rand()*.8;dummy.position.set(x,1,z);dummy.scale.setScalar(size);dummy.updateMatrix();stems.setMatrixAt(i,dummy.matrix);dummy.position.y=2*size;dummy.updateMatrix();crowns.setMatrixAt(i,dummy.matrix);}
  crowns.castShadow=true;landscape.add(stems,crowns);
  function centre(feature){let minx=Infinity,minz=Infinity,maxx=-Infinity,maxz=-Infinity;eachPolygon(feature.geometry,poly=>poly[0].forEach(c=>{const p=point(c);minx=Math.min(minx,p.x);maxx=Math.max(maxx,p.x);minz=Math.min(minz,p.y);maxz=Math.max(maxz,p.y);}));return{x:(minx+maxx)/2,z:(minz+maxz)/2,w:maxx-minx,d:maxz-minz};}
  const findParcel=(name)=>data.parcels.features.find(f=>f.properties.Attribute===name);
  function register(id,name,position,height,group,index){const label=document.createElement('button');label.className='landmark-label';label.innerHTML=`<span class="label-index">${index}</span>${name}`;label.setAttribute('aria-label',`Read project evidence: ${name}`);label.addEventListener('click',()=>openProject(id));$('#labels').append(label);const anchor=new THREE.Vector3(position.x,height+7,position.z);landmarks.push({id,name,anchor,centre:new THREE.Vector3(position.x,0,position.z),label,group});group.traverse(o=>{if(o.isMesh){o.userData.project=id;pickables.push(o);}});}
  const towerParcel=centre(findParcel('SEC-HOD'));
  const towers=new THREE.Group();towers.position.set(towerParcel.x,0,towerParcel.z);layers.landmarks.add(towers);
  const towerSpecs=[[-8,-10,22],[8,-10,18],[-8,8,17],[8,8,20],[0,27,27]];
  for(const [x,z,h] of towerSpecs){box(towers,x,.95,z,8,1.2,8,concrete);box(towers,x,h/2+1.6,z,5.5,h,5.5,glass);box(towers,x,h+2,z,6.2,.8,6.2,stone);
    for(let j=0;j<Math.floor(h/1.2);j++)box(towers,x,2+j*1.2,z,5.75,.16,5.75,stone);
    for(const sx of [-2.65,2.65])for(const sz of [-2.65,2.65])box(towers,x+sx,h/2+1.6,z+sz,.26,h,.26,gold);
    const volume=box(future,towerParcel.x+x,h*.65+2,towerParcel.z+z,7,h*1.3,7,material(0xe3c181,{transparent:true,opacity:.12,depthWrite:false}));volume.userData.proxy=true;
    const edges=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(7,h*1.3,7)),new THREE.LineBasicMaterial({color:0xf4cf87,transparent:true,opacity:.75}));edges.position.copy(volume.position);future.add(edges);
  }
  register('secretariat','SECRETARIAT',towerParcel,30,towers,'01');
  const assemblyParcel=centre(findParcel('Assembly'));
  const assembly=new THREE.Group();assembly.position.set(assemblyParcel.x,0,assemblyParcel.z);layers.landmarks.add(assembly);
  const circular=(parent,r1,r2,height,y,mat)=>{const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,height,48),mat);mesh.position.y=y;mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;};
  circular(assembly,12,13,1,1.1,stone);circular(assembly,10,11,2,2.4,stone);circular(assembly,9,10,2,4.2,glass);circular(assembly,9.8,9.8,.7,5.6,stone);
  const spire=new THREE.Mesh(new THREE.ConeGeometry(1.8,24,8),gold);spire.position.y=17.3;spire.castShadow=true;assembly.add(spire);
  for(let i=0;i<24;i++){const angle=i/24*Math.PI*2;box(assembly,Math.cos(angle)*9.3,3.7,Math.sin(angle)*9.3,.45,3.3,.45,stone);}
  const ring=new THREE.Mesh(new THREE.TorusGeometry(15,.18,6,80),gold);ring.rotation.x=Math.PI/2;ring.position.y=.9;assembly.add(ring);
  register('assembly','ASSEMBLY',assemblyParcel,30,assembly,'02');
  const courtParcel=centre(findParcel('Judicial Complex'));
  const court=new THREE.Group();court.position.set(courtParcel.x,0,courtParcel.z);layers.landmarks.add(court);
  box(court,0,1,0,27,1,20,stone);box(court,0,4.2,0,23,5.5,15,glass);box(court,0,7.6,0,27,1.2,20,stone);box(court,0,9,0,18,1.7,12,stone);
  for(let i=-5;i<=5;i++)box(court,i*2,4.3,7.7,.5,5,.5,stone);
  const dome=new THREE.Mesh(new THREE.SphereGeometry(6,32,16,0,Math.PI*2,0,Math.PI/2),stone);dome.position.y=9.8;court.add(dome);
  register('highcourt','HIGH COURT',courtParcel,16,court,'03');
  function housing(name,id,label,index){const p=centre(findParcel(name));const group=new THREE.Group();group.position.set(p.x,0,p.z);layers.landmarks.add(group);for(let i=0;i<6;i++){const x=(i%3-1)*8,z=(Math.floor(i/3)-.5)*13;box(group,x,5.7,z,5,10,6,concrete);for(let j=0;j<7;j++)box(group,x,1.5+j*1.3,z,5.2,.15,6.2,stone);}register(id,label,p,12,group,index);}
  housing('MLA / MLC Housing','mlahousing','MLA / MLC HOUSING','04');housing('GO Apartments Type 1 and 2','officerhousing','OFFICER HOUSING','05');
  // These low urban-context masses are explicitly fictional planning illustrations.
  const cityVision=new THREE.Group();future.add(cityVision);
  for(let i=0;i<85;i++){const x=(rand()<.5?-1:1)*(100+rand()*140),z=(rand()-.5)*600,h=2+rand()*10;const mesh=box(cityVision,x,h/2+.6,z,4+rand()*5,h,5+rand()*7,material(0xbda987,{transparent:true,opacity:.5}));mesh.castShadow=false;}
  // Batch stationary context geometry by material; landmarks remain individually selectable.
  function batch(group){
    const buckets=new Map();
    for(const mesh of [...group.children]){if(!mesh.isMesh||mesh.isInstancedMesh||Array.isArray(mesh.material))continue;const bucket=buckets.get(mesh.material)||[];bucket.push(mesh);buckets.set(mesh.material,bucket);}
    for(const [mat,meshes] of buckets){if(meshes.length<2)continue;const positions=[],normals=[];let cast=false,receive=false;
      for(const mesh of meshes){mesh.updateMatrix();const geometry=(mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone()).applyMatrix4(mesh.matrix);positions.push(geometry.attributes.position.array);normals.push(geometry.attributes.normal.array);cast ||= mesh.castShadow;receive ||= mesh.receiveShadow;geometry.dispose();group.remove(mesh);}
      const concat=arrays=>{const result=new Float32Array(arrays.reduce((sum,a)=>sum+a.length,0));let offset=0;for(const a of arrays){result.set(a,offset);offset+=a.length;}return result;};
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(concat(positions),3));geometry.setAttribute('normal',new THREE.BufferAttribute(concat(normals),3));const mesh=new THREE.Mesh(geometry,mat);mesh.castShadow=cast;mesh.receiveShadow=receive;group.add(mesh);
    }
  }
  [landscape,layers.parcels,layers.roads,layers.water,layers.footprints].forEach(batch);
  const selectableRing=new THREE.Mesh(new THREE.TorusGeometry(19,.2,5,80),new THREE.MeshBasicMaterial({color:0xf0cf8a}));selectableRing.rotation.x=Math.PI/2;selectableRing.position.y=.9;layers.landmarks.add(selectableRing);selectableRing.visible=false;
  const pointer=new THREE.Vector2(),raycaster=new THREE.Raycaster();let down=null;
  renderer.domElement.addEventListener('pointerdown',event=>{down={x:event.clientX,y:event.clientY};});
  renderer.domElement.addEventListener('pointerup',event=>{if(!down||Math.hypot(event.clientX-down.x,event.clientY-down.y)>5)return;const rect=renderer.domElement.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObjects(pickables,false).find(h=>layers.landmarks.visible);if(hit)openProject(hit.object.userData.project);});
  let desiredTarget=null,desiredCamera=null,frame=0,onScreen=true;
  new IntersectionObserver(entries=>{onScreen=entries[0].isIntersecting;},{rootMargin:'100px'}).observe($('#city'));
  function resize(){const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}
  new ResizeObserver(resize).observe(host);resize();
  function render(){frame=requestAnimationFrame(render);if(document.hidden||!onScreen)return;
    if(desiredTarget){const factor=reducedMotion?1:.075;controls.target.lerp(desiredTarget,factor);camera.position.lerp(desiredCamera,factor);if(controls.target.distanceTo(desiredTarget)<.1&&camera.position.distanceTo(desiredCamera)<.1){desiredTarget=null;desiredCamera=null;}}
    controls.update();
    const w=host.clientWidth,h=host.clientHeight;
    if(compare){const stageRect=$('#city').getBoundingClientRect(),hostRect=host.getBoundingClientRect();const split=Math.max(0,Math.min(w,stageRect.left+stageRect.width/2-hostRect.left));renderer.setScissorTest(true);future.visible=false;renderer.setScissor(0,0,split,h);renderer.render(scene,camera);future.visible=selectedTime>0;renderer.setScissor(split,0,w-split,h);renderer.render(scene,camera);renderer.setScissorTest(false);}else{future.visible=selectedTime>0;renderer.render(scene,camera);}
    for(const landmark of landmarks){const p=landmark.anchor.clone().project(camera);const x=(p.x*.5+.5)*w,y=(-p.y*.5+.5)*h;const overlapsIntro=!$('#city').classList.contains('exploring')&&(innerWidth<=760?y+host.offsetTop<475:x<w*.33);const visible=layers.landmarks.visible&&!overlapsIntro&&p.z<1&&p.x>-.95&&p.x<.95&&p.y>-.8&&p.y<.65&&(innerWidth>760||x>70&&x<w-70);landmark.label.hidden=!visible;landmark.label.style.left=`${x}px`;landmark.label.style.top=`${y}px`;}
  }
  render();
  renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();$('#fallback').hidden=false;$('#labels').hidden=true;toast('3D rendering paused. Project evidence remains available below.');});
  window.addEventListener('pagehide',()=>{cancelAnimationFrame(frame);controls.dispose();renderer.dispose();},{once:true});
  return {
    resize,hasProject:id=>landmarks.some(l=>l.id===id),
    reset(){desiredTarget=new THREE.Vector3(0,0,0);desiredCamera=home.clone();controls.autoRotate=false;$('#tour-button').setAttribute('aria-pressed','false');$('#tour-button').setAttribute('aria-label','Start slow camera orbit');$('#tour-button').textContent='▷';},
    setTime(index){future.visible=index>0;cityVision.visible=index===4;future.traverse(object=>{if(object.isMesh&&object.userData.proxy)object.material.opacity=[0,.08,.12,.17,.2][index];});},
    setCompare(value){compare=value;},
    setLayer(name,visible){layers[name].visible=visible;},
    tour(value){controls.autoRotate=value;},
    focus(id){const l=landmarks.find(l=>l.id===id);if(!l)return;desiredTarget=l.centre.clone();desiredCamera=l.centre.clone().add(new THREE.Vector3(72,92,115));},
    select(id){const l=landmarks.find(l=>l.id===id);selectableRing.visible=!!l;if(l){selectableRing.position.x=l.centre.x;selectableRing.position.z=l.centre.z;}landmarks.forEach(l=>l.label.classList.toggle('selected',l.id===id));},
  };
}

async function init(){
  try{const registry=await fetchJSON('projects');projects=registry.projects;sources=await fetchJSON('sources');renderList();}catch(error){$('#project-list').innerHTML='<p class="empty-results">Project data could not load. Run the supplied local server and reload this page.</p>';console.error(error);toast('Project data failed to load.');}
  try{const names=['parcels','government','boundary','water','roads','footprints'];const values=await Promise.all(names.map(fetchJSON));sceneAPI=await makeScene(Object.fromEntries(names.map((n,i)=>[n,values[i]])));$('#loading').hidden=true;}catch(error){console.error('3D view unavailable:',error);$('#loading').hidden=true;$('#fallback').hidden=false;$('#labels').hidden=true;$('#tour-button').disabled=true;$('#reset-view').disabled=true;}
}
init();
