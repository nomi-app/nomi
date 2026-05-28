// ════════════════════════════════
// WORKERS MODULE
// ════════════════════════════════
let editingWorkerId = null;
let sueldoMode = 'bruto';

function openWorkerForm(workerId = null){
  editingWorkerId = workerId;
  const biz = getBiz();
  if(!biz) return;

  // Set today as default start date
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('wf-inicio').value = today;

  // Populate AFP selector with rates from biz params
  const afpSel = document.getElementById('wf-afp');
  afpSel.innerHTML = '<option value="" disabled selected>Selecciona AFP…</option>';
  const rates = biz.params.afpRates || {};
  Object.entries(rates).forEach(([name, rate]) => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = `${name} (${rate}%)`;
    afpSel.appendChild(opt);
  });

  // Set cesantía display default
  updateCesantiaDisplay();

  if(workerId){
    // Edit mode — populate form
    const w = biz.workers.find(w => w.id === workerId);
    if(!w) return;
    document.getElementById('wd-eyebrow').textContent = 'Editar trabajador';
    document.getElementById('wd-title').textContent = w.nombre;
    document.getElementById('wd-save-btn').textContent = 'Guardar cambios';
    document.getElementById('wf-nombre').value = w.nombre;
    document.getElementById('wf-rut').value = w.rut || '';
    document.getElementById('wf-wa').value = w.whatsapp || '';
    document.getElementById('wf-email').value = w.email || '';
    document.getElementById('wf-cargo').value = w.cargo;
    document.getElementById('wf-inicio').value = w.inicio;
    document.getElementById('wf-contrato').value = w.contrato;
    document.getElementById('wf-jornada').value = w.jornada;
    document.getElementById('wf-horas').value = w.horasSemanales || '';
    document.getElementById('wf-sueldo').value = w.sueldoBase || '';
    document.getElementById('wf-afp').value = w.afp || Object.keys(rates)[0];
    document.getElementById('wf-salud').value = w.salud;
    document.getElementById('wf-isapre-nombre').value = w.isapreNombre || '';
    document.getElementById('wf-isapre-moneda').value = w.isapreMoneda || 'pesos';
    document.getElementById('wf-isapre-monto').value = w.isapreMonto || '';
    document.getElementById('wf-grat').value = w.gratificacion || 'heredar';
    document.getElementById('wf-rol').value = w.rol || 'sin_comisiones';
    renderSalarioModoSelector(w.salarioModo || 'anclado');
    renderCesantiaModoSelector(w.cesantiaModo || 'legal');
    renderGratBaseSelector(w.gratBaseModo || 'base_mas_comisiones');
    renderHaberesRecurrentes(w.haberesRecurrentes || []);
    if((w.salarioModo || 'anclado') === 'anclado' && typeof pisoLegal === 'function'){
      var pisoActual = pisoLegal(w, biz);
      if((w.sueldoBase || 0) < pisoActual){
        document.getElementById('wf-sueldo').value = pisoActual;
      }
    }
    renderFichaNota(w);
    document.getElementById('wf-template').value = w.template || 't1';
    setSueldoMode('bruto');
    onContratoChange();
    onJornadaChange();
    onSaludChange();
    onRolChange();
    onIsapreMonedaChange();
    // Validate RUT display
    if(w.rut) validateWorkerRut(w.rut);
  } else {
    // New mode
    document.getElementById('wd-eyebrow').textContent = 'Nuevo trabajador';
    document.getElementById('wd-title').textContent = 'Datos del trabajador';
    document.getElementById('wd-save-btn').textContent = 'Guardar trabajador';
    clearWorkerForm();
  }

  // Show/hide comisiones section
  const hasCom = biz.modules?.comisiones;
  document.getElementById('wf-com-section').style.display = hasCom ? 'block' : 'none';
  document.querySelector('#wf-com-section + .wd-sep')?.remove();

  document.getElementById('w-panel').style.display = 'block';
  setTimeout(() => document.getElementById('wf-nombre').focus(), 100);
}

function clearWorkerForm(){
  ['wf-nombre','wf-rut','wf-wa','wf-email','wf-cargo','wf-horas','wf-sueldo','wf-liquido',
   'wf-isapre-nombre','wf-isapre-monto'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.value = '';
  });
  document.getElementById('wf-contrato').value = '';
  document.getElementById('wf-jornada').value = '';
  document.getElementById('wf-salud').value = '';
  document.getElementById('wf-afp').value = '';
  document.getElementById('wf-grat').value = 'heredar';
  document.getElementById('wf-rol').value = 'sin_comisiones';
  renderSalarioModoSelector('anclado');
  renderCesantiaModoSelector('legal');
  renderGratBaseSelector('base_mas_comisiones');
  renderHaberesRecurrentes([]);
  document.getElementById('wf-template').value = 't1';
  document.getElementById('wf-isapre-moneda').value = 'pesos';
  // Clear errors
  document.querySelectorAll('.error-msg').forEach(e => e.classList.remove('show'));
  document.querySelectorAll('.input.error').forEach(e => e.classList.remove('error'));
  document.getElementById('wf-rut-ok').style.display = 'none';
  document.getElementById('imm-warn').style.display = 'none';
  document.getElementById('liq-result').style.display = 'none';
  setSueldoMode('bruto');
  onContratoChange();
  onJornadaChange();
  onSaludChange();
  onRolChange();
  onIsapreMonedaChange();
}

function closeWorkerPanel(){
  document.getElementById('w-panel').style.display = 'none';
  editingWorkerId = null;
}

// ── RUT validation for worker form ──
document.getElementById('wf-rut').addEventListener('input', function(){
  if(this.value.length >= 2){
    const clean = rutClean(this.value);
    this.value = rutFormat(this.value);
  }
  validateWorkerRut(this.value);
});

function validateWorkerRut(val){
  const inp = document.getElementById('wf-rut');
  const err = document.getElementById('wf-rut-err');
  const ok  = document.getElementById('wf-rut-ok');
  const clean = rutClean(val);
  if(clean.length === 0){
    inp.classList.remove('error'); err.classList.remove('show'); ok.style.display='none';
  } else if(clean.length >= 8){
    if(rutValidate(val)){
      inp.classList.remove('error'); err.classList.remove('show'); ok.style.display='block';
    } else {
      inp.classList.add('error'); err.classList.add('show'); ok.style.display='none';
    }
  } else {
    inp.classList.remove('error'); err.classList.remove('show'); ok.style.display='none';
  }
}

// ── Contrato / jornada / salud / rol changes ──
function onContratoChange(){
  const val = document.getElementById('wf-contrato').value;
  const isHon = val === 'honorarios';
  document.getElementById('wf-prev-section').style.display = isHon ? 'none' : 'block';
  document.getElementById('wf-prev-nota').style.display = isHon ? 'block' : 'none';
  document.getElementById('wf-sep-grat').style.display = 'block';
  updateCesantiaDisplay();
}

function onJornadaChange(){
  const val = document.getElementById('wf-jornada').value;
  document.getElementById('wf-horas-field').classList.toggle('hidden', val !== 'parcial');
  checkIMM();
}

function onSaludChange(){
  const val = document.getElementById('wf-salud').value;
  document.getElementById('wf-isapre-fields').style.display = val === 'isapre' ? 'block' : 'none';
}

function onIsapreMonedaChange(){
  const val = document.getElementById('wf-isapre-moneda').value;
  const sign = document.getElementById('wf-isapre-sign');
  const label = document.getElementById('wf-isapre-monto-label');
  sign.textContent = val === 'uf' ? 'UF' : '$';
  label.textContent = val === 'uf' ? 'Monto del plan (UF)' : 'Monto del plan ($)';
}

function onRolChange(){
  const val = document.getElementById('wf-rol').value;
  const showTemplate = val === 'vendedor' || val === 'supervisor_dual';
  document.getElementById('wf-template-field').style.display = showTemplate ? 'block' : 'none';
}

function updateCesantiaDisplay(){
  const biz = getBiz();
  const contrato = document.getElementById('wf-contrato').value;
  const rates = biz?.params?.cesantia || { indefinido:0.6, fijo:3.0 };
  const rate = contrato === 'indefinido' ? rates.indefinido :
               contrato === 'plazo_fijo' ? rates.fijo : 0;
  const el = document.getElementById('wf-ces-display');
  if(el){
    el.value = contrato === 'honorarios' ? 'No aplica' : `${rate}% (trabajador)`;
  }
}

// ── Sueldo mode toggle ──
function setSueldoMode(mode){
  sueldoMode = mode;
  const isLiq = mode === 'liquido';
  document.getElementById('sw-bruto').style.display = isLiq ? 'none' : 'block';
  document.getElementById('sw-liquido').style.display = isLiq ? 'block' : 'none';
  document.getElementById('sw-bruto-btn').style.cssText = isLiq
    ? 'background:var(--bg2);color:var(--text);border-color:var(--border)'
    : 'background:var(--accent);color:#fff;border-color:var(--accent)';
  document.getElementById('sw-liquido-btn').style.cssText = isLiq
    ? 'background:var(--accent);color:#fff;border-color:var(--accent)'
    : 'background:var(--bg2);color:var(--text);border-color:var(--border)';
}

// ── IMM check ──
function checkIMM(){
  const biz = getBiz();
  if(!biz) return;
  const imm = biz.params?.imm || 500000;
  const sueldo = parseFloat(document.getElementById('wf-sueldo').value) || 0;
  const jornada = document.getElementById('wf-jornada').value;
  const horas = parseFloat(document.getElementById('wf-horas').value) || 45;
  const immProporcional = jornada === 'parcial' ? Math.round(imm * horas / 45) : imm;
  const warnEl = document.getElementById('imm-warn');
  document.getElementById('imm-val').textContent = '$' + immProporcional.toLocaleString('es-CL');
  warnEl.style.display = (sueldo > 0 && sueldo < immProporcional) ? 'block' : 'none';
}

// ── Calc desde líquido ──
function calcDesdeliquido(){
  const biz = getBiz();
  if(!biz) return;
  const liquido = parseFloat(document.getElementById('wf-liquido').value) || 0;
  const resEl = document.getElementById('liq-result');
  const warnEl = document.getElementById('liq-warn');
  if(liquido <= 0){ resEl.style.display='none'; warnEl.style.display='none'; return; }

  // Get current AFP rate
  const afpName = document.getElementById('wf-afp').value;
  const afpRate = (biz.params.afpRates?.[afpName] || 10.58) / 100;
  const salud = document.getElementById('wf-salud').value;
  const saludRate = 0.07; // Fonasa base; isapre handled separately
  const contrato = document.getElementById('wf-contrato').value;
  const cesRates = biz.params.cesantia || { indefinido:0.6, fijo:3.0 };
  const cesRate = (contrato === 'indefinido' ? cesRates.indefinido : contrato === 'plazo_fijo' ? cesRates.fijo : 0) / 100;
  const gratModo = document.getElementById('wf-grat').value === 'heredar'
    ? biz.grat : document.getElementById('wf-grat').value;
  const imm = biz.params?.imm || 500000;

  // Iterative approximation: find bruto such that bruto - descuentos = liquido
  // Descuentos = AFP + Salud + Cesantía (sobre imponible = bruto + grat)
  // Gratificación mensual = min(bruto*0.25, imm*4.75/12)
  let bruto = liquido * 1.25; // initial estimate
  for(let i = 0; i < 20; i++){
    let grat = 0;
    if(gratModo === 'mensual'){
      grat = Math.min(bruto * 0.25, Math.round(imm * 4.75 / 12));
    }
    const imponible = bruto + grat;
    const descAfp = imponible * afpRate;
    const descSalud = salud === 'fonasa' ? imponible * saludRate : 0;
    const descCes = imponible * cesRate;
    const totalDesc = descAfp + descSalud + descCes;
    const calc = bruto + (gratModo === 'mensual' ? grat : 0) - totalDesc;
    const diff = liquido - calc;
    bruto += diff * 0.8;
    if(Math.abs(diff) < 1) break;
  }
  bruto = Math.round(bruto);
  let grat = 0;
  if(gratModo === 'mensual') grat = Math.min(bruto * 0.25, Math.round(imm * 4.75 / 12));
  const imponible = bruto + grat;
  const descAfp = Math.round(imponible * afpRate);
  const descSalud = salud === 'fonasa' ? Math.round(imponible * saludRate) : 0;
  const descCes = Math.round(imponible * cesRate);
  const neto = bruto + grat - descAfp - descSalud - descCes;

  const fmt = n => '$' + Math.round(n).toLocaleString('es-CL');
  document.getElementById('liq-bruto').textContent = fmt(bruto);
  document.getElementById('liq-grat').textContent = grat > 0 ? fmt(grat) : 'No incluida';
  document.getElementById('liq-afp').textContent = '-' + fmt(descAfp);
  document.getElementById('liq-salud').textContent = descSalud > 0 ? '-' + fmt(descSalud) : 'Isapre (manual)';
  document.getElementById('liq-ces').textContent = cesRate > 0 ? '-' + fmt(descCes) : 'No aplica';
  document.getElementById('liq-neto').textContent = fmt(neto);
  resEl.style.display = 'block';

  // IMM warning
  const imm_prop = bruto;
  warnEl.style.display = (bruto < imm) ? 'block' : 'none';
  if(bruto < imm) warnEl.textContent = `⚠ El bruto resultante ($${bruto.toLocaleString('es-CL')}) está bajo el IMM de $${imm.toLocaleString('es-CL')}.`;
}

function usarBrutoSugerido(){
  const brutoEl = document.getElementById('liq-bruto');
  const val = brutoEl.textContent.replace(/[$.\s]/g,'').replace(',','.');
  const num = parseFloat(val.replace(/\./g,''));
  if(num > 0){
    setSueldoMode('bruto');
    document.getElementById('wf-sueldo').value = num;
    checkIMM();
  }
}

// ── SAVE WORKER ──
function saveWorker(){
  const biz = getBiz();
  if(!biz) return;

  // Validate
  let valid = true;
  const nombre   = document.getElementById('wf-nombre').value.trim();
  const cargo    = document.getElementById('wf-cargo').value.trim();
  const inicio   = document.getElementById('wf-inicio').value;
  const sueldo   = parseFloat(document.getElementById('wf-sueldo').value);
  const rut      = document.getElementById('wf-rut').value.trim();
  const contrato = document.getElementById('wf-contrato').value;
  const jornada  = document.getElementById('wf-jornada').value;
  const afp      = document.getElementById('wf-afp').value;
  const salud    = document.getElementById('wf-salud').value;
  const isHon    = contrato === 'honorarios';

  if(!nombre){
    document.getElementById('wf-nombre').classList.add('error');
    document.getElementById('wf-nombre-err').classList.add('show');
    valid = false;
  }
  if(!cargo){
    document.getElementById('wf-cargo').classList.add('error');
    document.getElementById('wf-cargo-err').classList.add('show');
    valid = false;
  }
  if(!inicio){
    document.getElementById('wf-inicio').classList.add('error');
    document.getElementById('wf-inicio-err').classList.add('show');
    valid = false;
  }
  if(!contrato){
    document.getElementById('wf-contrato').classList.add('error');
    document.getElementById('wf-contrato-err').classList.add('show');
    valid = false;
  }
  if(!jornada){
    document.getElementById('wf-jornada').classList.add('error');
    document.getElementById('wf-jornada-err').classList.add('show');
    valid = false;
  }
  if(!sueldo || sueldo <= 0){
    document.getElementById('wf-sueldo').classList.add('error');
    document.getElementById('wf-sueldo-err').classList.add('show');
    valid = false;
  }
  if(!isHon && !afp){
    document.getElementById('wf-afp').classList.add('error');
    document.getElementById('wf-afp-err').classList.add('show');
    valid = false;
  }
  if(!isHon && !salud){
    document.getElementById('wf-salud').classList.add('error');
    document.getElementById('wf-salud-err').classList.add('show');
    valid = false;
  }
  if(rut && !rutValidate(rut)){
    document.getElementById('wf-rut').classList.add('error');
    document.getElementById('wf-rut-err').classList.add('show');
    valid = false;
  }

  if(!valid){
    document.querySelector('#w-drawer .input.error')?.scrollIntoView({behavior:'smooth',block:'center'});
    return;
  }

  // Build worker object, then PIN-protect the actual save
  const worker = {
    id: editingWorkerId || Date.now().toString(),
    nombre,
    rut,
    cargo,
    inicio,
    whatsapp: document.getElementById('wf-wa').value.trim(),
    email:    document.getElementById('wf-email').value.trim(),
    contrato,
    jornada,
    horasSemanales: parseFloat(document.getElementById('wf-horas').value) || 45,
    sueldoBase: (function(){
      var modo = getSalarioModoSel();
      if(modo === 'anclado' && typeof pisoLegal === 'function'){
        var pisoW = pisoLegal({ jornada: jornada, horasSemanales: parseFloat(document.getElementById('wf-horas').value) || 45 }, getBiz());
        return Math.max(sueldo, pisoW);
      }
      return sueldo;
    })(),
    salarioModo: getSalarioModoSel(),
    cesantiaModo: getCesantiaModoSel(),
    gratBaseModo: getGratBaseSel(),
    haberesRecurrentes: getHaberesRecurrentes(),
    afp:   isHon ? null : afp,
    salud: isHon ? null : salud,
    isapreNombre: document.getElementById('wf-isapre-nombre').value.trim(),
    isapreMoneda: document.getElementById('wf-isapre-moneda').value,
    isapreMonto:  parseFloat(document.getElementById('wf-isapre-monto').value) || 0,
    gratificacion: document.getElementById('wf-grat').value,
    rol:      document.getElementById('wf-rol').value,
    template: document.getElementById('wf-template').value,
    createdAt: editingWorkerId
      ? (biz.workers.find(w=>w.id===editingWorkerId)?.createdAt || new Date().toISOString())
      : new Date().toISOString(),
  };

  withPIN(function(){
    const b = getBiz();
    if(!b) return;
    const wasEditing = !!editingWorkerId;
    if(editingWorkerId){
      b.workers = b.workers.map(function(w){ return w.id === editingWorkerId ? worker : w; });
    } else {
      b.workers.push(worker);
    }
    save(db);
    closeWorkerPanel();
    renderWorkerList();
    renderDash();
    toast(wasEditing ? 'Cambios guardados correctamente' : 'Trabajador agregado correctamente');
  });
}

// ── REFRESH AFP SELECTOR ──
function refreshAfpSelector(){
  const biz = getBiz();
  if(!biz) return;
  const sel = document.getElementById('wf-afp');
  const cur = sel.value;
  sel.innerHTML = '<option value="" disabled>Selecciona AFP…</option>';
  const rates = biz.params.afpRates || {};
  Object.entries(rates).forEach(([name, rate]) => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = `${name} (${rate}%)`;
    if(name === cur) opt.selected = true;
    sel.appendChild(opt);
  });
}

// ── DELETE WORKER — fixed with event delegation ──
function deleteWorker(id){
  const biz = getBiz();
  if(!biz) return;
  const w = biz.workers.find(w => w.id === id);
  if(!w) return;
  if(!confirm(`¿Eliminar a ${w.nombre}? Esta acción no se puede deshacer.`)) return;
  biz.workers = biz.workers.filter(w => w.id !== id);
  save(db);
  renderWorkerList();
  renderDash();
  toast('Trabajador eliminado');
}

// ── RENDER WORKER LIST ──
function renderWorkerList(){
  const biz = getBiz();
  const workers = biz ? biz.workers || [] : [];
  const empty = document.getElementById('w-empty');
  const list  = document.getElementById('w-list');
  const sub   = document.getElementById('w-count-sub');
  const n = workers.length;

  sub.textContent = n === 0 ? 'Sin trabajadores registrados'
    : n + ' trabajador' + (n !== 1 ? 'es' : '') + ' registrado' + (n !== 1 ? 's' : '');

  if(n === 0){
    empty.style.display = 'flex';
    list.style.display  = 'none';
    return;
  }
  empty.style.display = 'none';
  list.style.display  = 'flex';
  list.innerHTML = '';

  workers.forEach(function(w){
    var initials = w.nombre.split(' ').slice(0,2).map(function(x){ return x[0]; }).join('').toUpperCase();
    var rolMap = { vendedor:'Vendedor', supervisor:'Supervisor', supervisor_dual:'Supervisor dual', sin_comisiones:'' };
    var rolLabel = rolMap[w.rol] || '';
    var ctMap = { indefinido:'Indefinido', plazo_fijo:'Plazo fijo', honorarios:'Honorarios' };
    var contratoLabel = ctMap[w.contrato] || '';
    var saludLabel = w.salud === 'fonasa' ? 'Fonasa' : (w.isapreNombre || 'Isapre');
    var badge = rolLabel ? '<span class="badge badge-accent" style="font-size:10px">' + rolLabel + '</span>' : '';

    var card = document.createElement('div');
    card.className = 'w-card';

    // Use data attribute to store the worker id for editing
    card.setAttribute('data-wid', w.id);

    var notaCard = (typeof salarioNotaHTML === 'function') ? salarioNotaHTML(w, biz) : '';
    card.innerHTML =
      '<div class="w-avatar">' + initials + '</div>' +
      '<div class="w-info" style="pointer-events:none">' +
        '<div class="w-name">' + esc(w.nombre) + '</div>' +
        '<div class="w-meta">' + esc(w.cargo) + ' · AFP ' + esc(w.afp || '—') + ' · ' + saludLabel + ' · ' + contratoLabel + '</div>' +
        notaCard +
      '</div>' +
      '<div style="display:flex;gap:6px;align-items:center;flex-shrink:0">' +
        badge +
        '<button class="btn btn-ghost btn-icon btn-sm w-del-btn" style="color:var(--danger);font-size:15px;line-height:1" title="Eliminar trabajador" data-wid="' + w.id + '">&#x2715;</button>' +
      '</div>';

    list.appendChild(card);
  });

  // Single delegated listener on the list container
  list.onclick = function(e){
    var delBtn = e.target.closest('.w-del-btn');
    if(delBtn){
      e.stopPropagation();
      delWorker(delBtn.getAttribute('data-wid'));
      return;
    }
    var card = e.target.closest('.w-card');
    if(card){
      openWorkerForm(card.getAttribute('data-wid'));
    }
  };
}

// Input listeners for validation clearing
['wf-nombre','wf-cargo'].forEach(id => {
  document.getElementById(id)?.addEventListener('input', function(){
    this.classList.remove('error');
    this.nextElementSibling?.classList.remove('show');
  });
});
document.getElementById('wf-inicio')?.addEventListener('change', function(){
  this.classList.remove('error');
  document.getElementById('wf-inicio-err').classList.remove('show');
});
document.getElementById('wf-sueldo')?.addEventListener('input', function(){
  this.classList.remove('error');
  document.getElementById('wf-sueldo-err').classList.remove('show');
  checkIMM();
});

(function(){
  if(db.businesses.length>0){
    document.getElementById('onboarding').classList.add('gone');
    initApp();
  }
})();

// Nota de advertencia bajo el selector de salario en la ficha
function renderFichaNota(worker){
  var cont = document.getElementById('wf-salmodo');
  if(!cont) return;
  // Eliminar nota previa si existe
  var prev = document.getElementById('wf-salmodo-nota');
  if(prev) prev.remove();
  if(typeof notaSueldo !== 'function') return;
  var nota = notaSueldo(worker, getBiz());
  if(!nota) return;
  var div = document.createElement('div');
  div.id = 'wf-salmodo-nota';
  div.className = 'salmodo-card-note';
  div.style.marginTop = '8px';
  div.textContent = '⚠ ' + nota.texto;
  cont.appendChild(div);
}