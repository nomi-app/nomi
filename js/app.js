// ════════════════════════════════
// ONBOARDING STATE
// ════════════════════════════════
let obStep = 1;
let mods = { comisiones:true, vacaciones:false };

function goOb(n){
  document.getElementById(`ob${obStep}`).classList.add('hidden');
  obStep = n;
  document.getElementById(`ob${obStep}`).classList.remove('hidden');
}

// ════════════════════════════════
// APP
// ════════════════════════════════
function initApp(){
  document.getElementById('app').classList.add('on');
  if(!db.activeBizId && db.businesses.length)
    db.activeBizId = db.businesses[0].id;
  renderAll();
  go('inicio');
}

function getBiz(){ return db.businesses.find(b=>b.id===db.activeBizId)||null; }

function renderAll(){
  renderBizDrop();
  renderSidebar();
  renderDash();
  renderCfg();
  renderWorkerList();
}

// ── BIZ DROPDOWN ──
function renderBizDrop(){
  const biz = getBiz();
  document.getElementById('bizName').textContent = biz ? biz.name : '—';
  const list = document.getElementById('bizList');
  list.innerHTML = '';
  db.businesses.forEach(b => {
    const d = document.createElement('div');
    d.className = 'biz-drop-item' + (b.id===db.activeBizId?' active':'');
    d.innerHTML = `<span class="biz-drop-check">${b.id===db.activeBizId?'✓':''}</span>${esc(b.name)}`;
    d.onclick = () => switchBiz(b.id);
    list.appendChild(d);
  });
}

function toggleBizDrop(){
  const drop = document.getElementById('bizDrop');
  const btn  = document.getElementById('bizBtn');
  const open = drop.classList.contains('open');
  drop.classList.toggle('open',!open);
  btn.classList.toggle('open',!open);
  if(!open){
    setTimeout(()=>document.addEventListener('click', closeBizDrop, {once:true,capture:true}),0);
  }
}
function closeBizDrop(e){
  const drop=document.getElementById('bizDrop');
  const btn=document.getElementById('bizBtn');
  if(!drop.contains(e.target)&&!btn.contains(e.target)){
    drop.classList.remove('open'); btn.classList.remove('open');
  }
}
function switchBiz(id){
  db.activeBizId=id; save(db);
  document.getElementById('bizDrop').classList.remove('open');
  document.getElementById('bizBtn').classList.remove('open');
  renderAll(); go('inicio');
}
function startNewBiz(){
  document.getElementById('bizDrop').classList.remove('open');
  document.getElementById('bizBtn').classList.remove('open');
  // Reset onboarding
  document.getElementById('ob-name').value='';
  document.getElementById('ob-rut').value='';
  document.getElementById('ob-rubro').value='';
  document.getElementById('ob-name').classList.remove('error');
  document.getElementById('ob-name-err').classList.remove('show');
  document.getElementById('ob-rut').classList.remove('error');
  document.getElementById('ob-rut-err').classList.remove('show');
  document.getElementById('ob-rut-ok').style.display='none';
  mods = {comisiones:true,vacaciones:false};
  document.getElementById('mod-comisiones').classList.add('on');
  document.getElementById('mod-vacaciones').classList.remove('on');
  document.getElementById('afp-accordion').classList.remove('open');
  obStep=1;
  document.getElementById('ob1').classList.remove('hidden');
  document.getElementById('ob2').classList.add('hidden');
  document.getElementById('ob3').classList.add('hidden');
  document.getElementById('app').classList.remove('on');
  document.getElementById('onboarding').classList.remove('gone');
}

// ── SIDEBAR ──
function renderSidebar(){
  const biz = getBiz();
  const hasCom = biz?.modules?.comisiones;
  const hasVac = biz?.modules?.vacaciones;
  document.getElementById('nav-comisiones').classList.toggle('hidden',!hasCom);
  document.getElementById('nav-vacaciones').classList.toggle('hidden',!hasVac);
  document.getElementById('kpi-com-card').classList.toggle('hidden',!hasCom);
  document.getElementById('pend-com').classList.toggle('hidden',!hasCom);
  document.getElementById('stat-ventas').classList.toggle('hidden',!hasCom);
  document.getElementById('stat-com').classList.toggle('hidden',!hasCom);
}

// ── NAVIGATION ──
function go(page){
  // If navigating away from config with unsaved changes, restore silently
  if(page !== 'config' && _paramsDirty){
    var biz = getBiz();
    if(biz && _paramsSnapshot){
      biz.params = JSON.parse(_paramsSnapshot);
    }
    _paramsDirty = false;
    var badge      = document.getElementById('cfg-unsaved-badge');
    var saveBtn    = document.getElementById('cfg-save-btn');
    var discardBtn = document.getElementById('cfg-discard-btn');
    if(badge)      badge.style.display = 'none';
    if(saveBtn){   saveBtn.disabled = true; saveBtn.style.opacity = '.4'; saveBtn.style.cursor = 'not-allowed'; }
    if(discardBtn) discardBtn.style.display = 'none';
    // Update the DOM inputs so they show the restored values when user returns
    renderCfg();
  }
  // If navigating TO config, always refresh from saved data
  if(page === 'config'){
    renderCfg();
  }
  // If navigating TO remuneraciones, render the month list
  if(page === 'remuneraciones'){
    renderRemuneraciones();
  }
  document.querySelectorAll('.page').forEach(function(p){ p.classList.remove('active'); });
  document.querySelectorAll('.nav-item').forEach(function(n){ n.classList.remove('active'); });
  var pageEl = document.getElementById('page-' + page);
  var navEl  = document.querySelector('[data-page="' + page + '"]');
  if(pageEl) pageEl.classList.add('active');
  if(navEl)  navEl.classList.add('active');
}

// ── DASHBOARD ──
function renderDash(){
  const biz = getBiz();
  if(!biz) return;
  const now = new Date();
  const months=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const h = now.getHours();
  const greet = h<12?'Buenos días':h<19?'Buenas tardes':'Buenas noches';
  document.getElementById('dash-month').textContent = `${months[now.getMonth()]} ${now.getFullYear()}`;
  document.getElementById('dash-greeting').textContent = greet;
  document.getElementById('dash-biz').textContent = biz.name;
  document.getElementById('kpi-workers').textContent = biz.workers?.length ?? 0;
}

// ════════════════════════════════
// PARAMS — dirty tracking
// ════════════════════════════════
var _paramsDirty    = false;
var _paramsSnapshot = null;

function snapshotParams(){
  var biz = getBiz();
  if(biz) _paramsSnapshot = JSON.stringify(biz.params);
}

function markParamsDirty(){
  if(_paramsDirty) return;
  _paramsDirty = true;
  var badge  = document.getElementById('cfg-unsaved-badge');
  var saveBtn  = document.getElementById('cfg-save-btn');
  var discardBtn = document.getElementById('cfg-discard-btn');
  if(badge)    badge.style.display = 'inline';
  if(saveBtn){ saveBtn.disabled = false; saveBtn.style.opacity = '1'; saveBtn.style.cursor = 'pointer'; }
  if(discardBtn) discardBtn.style.display = 'inline-flex';
}

function resetParamsDirty(){
  _paramsDirty = false;
  var badge    = document.getElementById('cfg-unsaved-badge');
  var saveBtn  = document.getElementById('cfg-save-btn');
  var discardBtn = document.getElementById('cfg-discard-btn');
  if(badge)    badge.style.display = 'none';
  if(saveBtn){ saveBtn.disabled = true; saveBtn.style.opacity = '.4'; saveBtn.style.cursor = 'not-allowed'; }
  if(discardBtn) discardBtn.style.display = 'none';
}

function discardParams(){
  var biz = getBiz();
  if(!biz || !_paramsSnapshot) return;
  biz.params = JSON.parse(_paramsSnapshot);
  renderCfg();
  toast('Cambios descartados');
}

function saveParams(){
  var biz = getBiz();
  if(!biz) return;
  var imm      = parseFloat(document.getElementById('cfg-imm').value);
  var topeUF   = parseFloat(document.getElementById('cfg-tope-uf').value);
  var topeCesUF= parseFloat(document.getElementById('cfg-tope-ces-uf').value);
  var uf       = parseFloat(document.getElementById('cfg-uf').value);
  var jc       = parseFloat(document.getElementById('cfg-jornada').value);
  var ci       = parseFloat(document.getElementById('cfg-ces-indef').value);
  var cf       = parseFloat(document.getElementById('cfg-ces-fijo').value);
  if(imm)       biz.params.imm       = imm;
  if(topeUF)    biz.params.topeUF    = topeUF;
  if(topeCesUF) biz.params.topeCesUF = topeCesUF;
  if(uf)        biz.params.uf        = uf;
  if(jc)        biz.params.jornadaCompleta = jc;
  biz.params.cesantia = { indefinido: ci || 0.6, fijo: cf || 3.0 };
  var honRet = parseFloat(document.getElementById('cfg-hon-ret').value);
  if(!isNaN(honRet) && honRet > 0) biz.params.honorariosRetencion = honRet;
  var rates = biz.params.afpRates || {};
  Object.keys(rates).forEach(function(name){
    var el = document.getElementById('cfg-afp-' + name.toLowerCase());
    if(el){ var v = parseFloat(el.value); if(v) rates[name] = v; }
  });
  biz.params.afpRates = rates;
  save(db);
  refreshAfpSelector();
  snapshotParams();
  resetParamsDirty();
// Aplicar reglas del mínimo a los trabajadores anclados
  if(typeof aplicarReglasIMM === 'function'){
    var rep = aplicarReglasIMM(biz);
    save(db);
    if(rep.normalizados.length > 0){
      var nombres = rep.normalizados.map(function(x){ return x.nombre; }).join(', ');
      showConfirmModal(
        'Sueldos normalizados al nuevo mínimo',
        'Se ajustaron ' + rep.normalizados.length + ' trabajador(es) anclados al mínimo que quedaban bajo el nuevo valor: ' + nombres + '.',
        function(){ closeConfirmModal(); }
      );
      var ab = document.getElementById('confirm-action-btn');
      if(ab) ab.textContent = 'Entendido';
    } else {
      toast('Parámetros guardados correctamente');
    }
  } else {
    toast('Parámetros guardados correctamente');
  }
}

// ── CONFIG render ──
function renderCfg(){
  var biz = getBiz();
  if(!biz) return;
  var p = biz.params || {};
  document.getElementById('cfg-sub').textContent = biz.name;
  document.getElementById('cfg-imm').value   = p.imm   || 500000;
  document.getElementById('cfg-tope-uf').value     = p.topeUF    != null ? p.topeUF    : 90.0;
  document.getElementById('cfg-tope-ces-uf').value = p.topeCesUF != null ? p.topeCesUF : 135.2;
  document.getElementById('cfg-uf').value    = p.uf    || 37500;
  document.getElementById('cfg-jornada').value = p.jornadaCompleta || 42;
  document.getElementById('cfg-ces-indef').value = p.cesantia ? p.cesantia.indefinido : 0.6;
  document.getElementById('cfg-ces-fijo').value  = p.cesantia ? p.cesantia.fijo       : 3.0;
  document.getElementById('cfg-hon-ret').value   = p.honorariosRetencion != null ? p.honorariosRetencion : 15.25;

  var grid = document.getElementById('cfg-afp-grid');
  grid.innerHTML = '';
  var rates = p.afpRates || {};
  Object.entries(rates).forEach(function(entry){
    var name = entry[0]; var rate = entry[1];
    var id = 'cfg-afp-' + name.toLowerCase();
    var div = document.createElement('div');
    div.className = 'field';
    div.style.margin = '0';
    div.innerHTML =
      '<label class="label">' + name + '</label>' +
      '<div style="display:flex;align-items:center;gap:6px">' +
        '<input class="input" type="number" step="0.01" id="' + id + '" value="' + rate + '" oninput="markParamsDirty()" style="flex:1"/>' +
        '<span style="font-size:12px;color:var(--text3)">%</span>' +
      '</div>';
    grid.appendChild(div);
  });

  resetParamsDirty();
  snapshotParams();
  renderCfgPinRow();
  _cfgRefrescarTopeEq();
}

// Helper: recalcula y muestra el equivalente en pesos de los dos topes
// usando la UF actual del input. Se llama al renderizar config y cada vez
// que el usuario tipea en cualquiera de los tres campos (UF, tope, tope-ces).
function _cfgRefrescarTopeEq(){
  var ufEl       = document.getElementById('cfg-uf');
  var topeEl     = document.getElementById('cfg-tope-uf');
  var topeCesEl  = document.getElementById('cfg-tope-ces-uf');
  var eqTope     = document.getElementById('cfg-tope-eq');
  var eqTopeCes  = document.getElementById('cfg-tope-ces-eq');
  if(!ufEl || !topeEl || !topeCesEl || !eqTope || !eqTopeCes) return;
  var uf         = parseFloat(ufEl.value)      || 0;
  var tope       = parseFloat(topeEl.value)    || 0;
  var topeCes    = parseFloat(topeCesEl.value) || 0;
  eqTope.textContent    = '$' + Math.round(tope    * uf).toLocaleString('es-CL');
  eqTopeCes.textContent = '$' + Math.round(topeCes * uf).toLocaleString('es-CL');
}