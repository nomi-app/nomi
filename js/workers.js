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
    setIsapreNombre(w.isapreNombre);
    document.getElementById('wf-isapre-moneda').value = w.isapreMoneda || 'pesos';
    document.getElementById('wf-isapre-monto').value = w.isapreMonto || '';
    document.getElementById('wf-grat').value = w.gratificacion || 'heredar';
    document.getElementById('wf-rol').value = w.rol || 'sin_comisiones';
    renderSalarioModoSelector(w.salarioModo || 'anclado');
    renderCesantiaModoSelector(w.cesantiaModo || 'legal');
    renderGratBaseSelector(w.gratBaseModo || 'base_mas_comisiones');
    renderHaberesRecurrentes(w.haberesRecurrentes || []);
    // Honorarios
    if(w.contrato === 'honorarios'){
      var honMod = document.getElementById('wf-hon-modalidad');
      if(honMod) honMod.value = w.honorariosModalidad || 'mensual';
      var honTarifa = document.getElementById('wf-hon-tarifa');
      if(honTarifa) honTarifa.value = w.honorariosTarifaDiaria || '';
      var honMensual = document.getElementById('wf-hon-mensual-monto');
      if(honMensual) honMensual.value = w.sueldoBase || '';
      renderHonAcuerdoSelector(w.honorariosAcuerdo      || 'bruto');
      renderHonRetencionSelector(w.honorariosQuienRetiene || 'trabajador');
      onHonModalidadChange();
      updateHonPreview();
    }
    // Aplicar visibilidad de secciones según el contrato cargado.
    // Setear .value por JS no dispara 'change', así que llamamos a mano.
    onContratoChange();
    if((w.salarioModo || 'anclado') === 'anclado' && typeof pisoLegal === 'function'){
      var pisoActual = pisoLegal(w, biz);
      if((w.sueldoBase || 0) < pisoActual){
        document.getElementById('wf-sueldo').value = pisoActual;
      }
    }
    renderFichaNota(w);
    document.getElementById('wf-template').value = w.template || 't1';
    setSueldoMode('bruto');
    _actualizarOpcionJornadaCompleta();
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
   'wf-isapre-monto','wf-isapre-otra-nombre',
   'wf-hon-mensual-monto','wf-hon-tarifa'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.value = '';
  });
  setIsapreNombre('');   // resetea el dropdown y oculta el campo "otra"
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
  renderHonAcuerdoSelector('bruto');
  renderHonRetencionSelector('trabajador');
  document.getElementById('wf-template').value = 't1';
  document.getElementById('wf-isapre-moneda').value = 'pesos';
  var honModEl = document.getElementById('wf-hon-modalidad');
  if(honModEl) honModEl.value = 'mensual';
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
  if(typeof onHonModalidadChange === 'function') onHonModalidadChange();
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
  var val   = document.getElementById('wf-contrato').value;
  var isHon = val === 'honorarios';

  // Refrescar el texto dinámico de "Completa" según biz.params.jornadaCompleta
  _actualizarOpcionJornadaCompleta();

  // Previsión
  document.getElementById('wf-prev-section').style.display = isHon ? 'none' : 'block';
  document.getElementById('wf-prev-nota').style.display    = isHon ? 'block' : 'none';

  // Gratificación — ocultar para honorarios (incluido su separador previo)
  var gratSection = document.getElementById('wf-grat-section');
  var sepGrat     = document.getElementById('wf-sep-grat');
  if(gratSection) gratSection.style.display = isHon ? 'none' : 'block';
  if(sepGrat)     sepGrat.style.display     = isHon ? 'none' : 'block';

  // Selector de salario (anclado/fijo/bajo_minimo) — ocultar para honorarios
  var salModo = document.getElementById('wf-salmodo');
  if(salModo) salModo.style.display = isHon ? 'none' : 'block';

  // Switch bruto/liquido — ocultar para honorarios (tienen su propio bloque)
  var swBruto    = document.getElementById('sw-bruto');
  var swLiq      = document.getElementById('sw-liquido');
  var swBrutoBtn = document.getElementById('sw-bruto-btn');
  var swLiqBtn   = document.getElementById('sw-liquido-btn');
  if(isHon){
    if(swBruto)    swBruto.style.display    = 'none';
    if(swLiq)      swLiq.style.display      = 'none';
    if(swBrutoBtn) swBrutoBtn.style.display = 'none';
    if(swLiqBtn)   swLiqBtn.style.display   = 'none';
  } else {
    if(swBrutoBtn) swBrutoBtn.style.display = '';
    if(swLiqBtn)   swLiqBtn.style.display   = '';
    setSueldoMode(sueldoMode || 'bruto');
  }

  // Bloque honorarios (modalidad mensual/diario)
  var honBloque = document.getElementById('wf-hon-bloque');
  if(honBloque) honBloque.style.display = isHon ? 'block' : 'none';

  // Jornada: oculta completamente para honorarios. El campo "horas semanales"
  // y la cotización legal también deben ocultarse. Internamente la guardamos
  // como 'no_aplica' al guardar.
  var jornadaField = document.getElementById('wf-jornada-field');
  var horasField   = document.getElementById('wf-horas-field');
  if(jornadaField) jornadaField.style.display = isHon ? 'none' : '';
  if(isHon && horasField) horasField.classList.add('hidden');
  if(!isHon && horasField) horasField.classList.remove('hidden');

  // Cotización legal de cesantía y selector de tratamiento — ocultos en honorarios.
  // El régimen 2da categoría no contempla seguro de cesantía.
  var cesField  = document.getElementById('wf-ces-field');
  var cesModo   = document.getElementById('wf-cesmodo');
  if(cesField) cesField.style.display = isHon ? 'none' : '';
  if(cesModo)  cesModo.style.display  = isHon ? 'none' : '';

  // Helper: oculta también el separador horizontal previo a un elemento.
  // Sin esto, los wd-sep quedan flotando sobre secciones invisibles.
  function _toggleSepBefore(id, hide){
    var el  = document.getElementById(id);
    if(!el) return;
    var sep = el.previousElementSibling;
    if(sep && sep.classList && sep.classList.contains('wd-sep')){
      sep.style.display = hide ? 'none' : '';
    }
  }

  // Haberes adicionales recurrentes — no aplican (en honorarios no hay imponibles).
  var haberesSec = document.getElementById('wf-haberes-rec-section');
  if(haberesSec) haberesSec.style.display = isHon ? 'none' : '';
  _toggleSepBefore('wf-haberes-rec-section', isHon);

  // Rol de comisiones — ocultar en honorarios (mezclar honorarios con comisiones
  // bordea simulación de relación laboral; preferimos no ofrecer la combinación).
  var comSec = document.getElementById('wf-com-section');
  if(comSec) comSec.style.display = isHon ? 'none' : '';
  _toggleSepBefore('wf-com-section', isHon);

  // Label del campo de sueldo
  _actualizarLabelSueldo(isHon);

  updateCesantiaDisplay();
}

// Actualiza el texto de la opción "Completa" del selector de jornada
// con las horas vigentes en biz.params.jornadaCompleta.
// Marco legal: Ley 21.561 establece la transición 45h → 42h (abr 2026) → 40h (abr 2028).
function _actualizarOpcionJornadaCompleta(){
  var opt = document.getElementById('wf-jornada-opt-completa');
  if(!opt) return;
  var biz = (typeof getBiz === 'function') ? getBiz() : null;
  var jc  = (biz && biz.params && biz.params.jornadaCompleta) || 42;
  opt.textContent = 'Completa (' + jc + 'h/sem)';
}

function _actualizarLabelSueldo(isHon){
  var inp = document.getElementById('wf-sueldo');
  if(!inp) return;
  var field = inp.closest('.field');
  if(!field) return;
  var lbl = field.querySelector('.label');
  if(!lbl) return;
  if(isHon){
    // En honorarios el input wf-sueldo está oculto; ocultamos también su contenedor
    // para evitar el label flotando arriba del bloque honorarios. El bloque
    // honorarios tiene su propio label interno coherente con el acuerdo elegido.
    field.style.display = 'none';
  } else {
    field.style.display = '';
    lbl.innerHTML = 'Sueldo base <span style="color:var(--danger)">*</span>';
  }
}

function onHonModalidadChange(){
  var val = document.getElementById('wf-hon-modalidad') ?
    document.getElementById('wf-hon-modalidad').value : 'mensual';
  var diarioField  = document.getElementById('wf-hon-diario-field');
  var mensualField = document.getElementById('wf-hon-mensual-field');
  if(diarioField)  diarioField.style.display  = val === 'diario'  ? 'block' : 'none';
  if(mensualField) mensualField.style.display = val === 'mensual' ? 'block' : 'none';
  if(typeof updateHonPreview === 'function') updateHonPreview();
}

function onHonMensualMontoChange(){
  // El handler ya no sincroniza con wf-sueldo. Después del fix de saveWorker
  // (que ahora lee wf-hon-mensual-monto directamente para honorarios),
  // ese sync era redundante y mantenía dos fuentes de verdad.
  if(typeof updateHonPreview === 'function') updateHonPreview();
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

// ── Isapres: dropdown con migración de texto libre antiguo ──
// Las 7 isapres abiertas vigentes en Chile (traspaso Hito 3 §2.13).
// El valor 'otra' habilita un input libre debajo, para isapres cerradas
// (Banco Estado, Chuquicamata, Cruz del Norte, etc.) o nombres atípicos.
var ISAPRES_ABIERTAS = ['Banmédica','Colmena','Consalud','Cruz Blanca','Nueva Masvida','Vida Tres','Esencial'];

// Setea el campo isapre desde un nombre guardado. Tres caminos:
//   - Vacío: limpia todo, oculta el campo libre.
//   - Nombre en la lista oficial: selecciona esa opción del dropdown.
//   - Nombre fuera de la lista (custom: texto libre antiguo, isapre cerrada,
//     nombre tipeado en "Otra"): agrega una opción temporal al dropdown con
//     ese nombre y la selecciona. Visualmente queda como una más; el campo
//     libre permanece oculto. Las opciones temporales se reconstruyen al
//     reabrir el formulario (no se acumulan entre sesiones).
function setIsapreNombre(nombre){
  var sel       = document.getElementById('wf-isapre-nombre');
  var otraField = document.getElementById('wf-isapre-otra-field');
  var otraInput = document.getElementById('wf-isapre-otra-nombre');
  if(!sel || !otraField || !otraInput) return;
  // Limpiar opciones temporales de aperturas anteriores (importante para
  // que no se acumulen al cambiar entre trabajadores).
  _limpiarIsapreCustom();
  var n = (nombre || '').trim();
  if(!n){
    sel.value = '';
    otraField.style.display = 'none';
    otraInput.value = '';
  } else if(ISAPRES_ABIERTAS.indexOf(n) !== -1){
    sel.value = n;
    otraField.style.display = 'none';
    otraInput.value = '';
  } else {
    // Custom — agregar como opción temporal antes de "Otra (especificar)"
    var opt = document.createElement('option');
    opt.value = n;
    opt.textContent = n;
    opt.setAttribute('data-custom', 'true');
    var otraOpt = sel.querySelector('option[value="otra"]');
    if(otraOpt){
      sel.insertBefore(opt, otraOpt);
    } else {
      sel.appendChild(opt);
    }
    sel.value = n;
    otraField.style.display = 'none';
    otraInput.value = '';
  }
}

// Quita del select las opciones marcadas con data-custom="true".
// Se llama desde setIsapreNombre antes de aplicar un nombre nuevo.
function _limpiarIsapreCustom(){
  var sel = document.getElementById('wf-isapre-nombre');
  if(!sel) return;
  var customs = sel.querySelectorAll('option[data-custom="true"]');
  for(var i = 0; i < customs.length; i++){
    customs[i].parentNode.removeChild(customs[i]);
  }
}

// Devuelve el nombre de isapre actual del formulario:
//   - Si el select tiene una isapre conocida, devuelve ese nombre.
//   - Si está en "otra", devuelve el texto del input libre.
//   - Si no hay nada seleccionado, devuelve ''.
function getIsapreNombreActual(){
  var sel = document.getElementById('wf-isapre-nombre');
  if(!sel) return '';
  if(sel.value === 'otra'){
    var inp = document.getElementById('wf-isapre-otra-nombre');
    return inp ? inp.value.trim() : '';
  }
  return sel.value;
}

// Handler del onchange del select de isapre.
function onIsapreNombreChange(){
  var sel       = document.getElementById('wf-isapre-nombre');
  var otraField = document.getElementById('wf-isapre-otra-field');
  var otraInput = document.getElementById('wf-isapre-otra-nombre');
  if(!sel || !otraField) return;
  if(sel.value === 'otra'){
    otraField.style.display = 'block';
    if(otraInput) otraInput.focus();
  } else {
    otraField.style.display = 'none';
    if(otraInput) otraInput.value = '';
  }
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
  var jc = (biz.params && biz.params.jornadaCompleta) || 42;
  var horas = parseFloat(document.getElementById('wf-horas').value) || jc;
  var immProporcional = jornada === 'parcial' ? Math.round(imm * horas / jc) : imm;
  const warnEl = document.getElementById('imm-warn');
  document.getElementById('imm-val').textContent = '$' + immProporcional.toLocaleString('es-CL');
  warnEl.style.display = (sueldo > 0 && sueldo < immProporcional) ? 'block' : 'none';
}

// ── Calc desde líquido — usa el motor canónico liquidarDesdeLiquido() ──
function calcDesdeliquido(){
  var biz = getBiz();
  if(!biz) return;
  var liquido = parseFloat(document.getElementById('wf-liquido').value) || 0;
  var resEl   = document.getElementById('liq-result');
  var warnEl  = document.getElementById('liq-warn');
  if(liquido <= 0){ resEl.style.display='none'; warnEl.style.display='none'; return; }

  // Construir un worker temporal con los valores del formulario en este momento.
  // Así el cálculo es coherente con AFP, salud, jornada y modos elegidos ahora.
  var workerTemp = {
    id:              '__preview__',
    nombre:          'Preview',
    contrato:        document.getElementById('wf-contrato').value || 'indefinido',
    jornada:         document.getElementById('wf-jornada').value  || 'completa',
    horasSemanales:  parseFloat(document.getElementById('wf-horas').value) || biz.params.jornadaCompleta || 42,
    afp:             document.getElementById('wf-afp').value,
    salud:           document.getElementById('wf-salud').value,
    isapreNombre:    getIsapreNombreActual(),
    isapreMoneda:    document.getElementById('wf-isapre-moneda').value || 'pesos',
    isapreMonto:     parseFloat(document.getElementById('wf-isapre-monto').value) || 0,
    gratificacion:   document.getElementById('wf-grat').value || 'heredar',
    salarioModo:     'fijo',   // para el cálculo inverso usamos 'fijo' (no queremos que pise el mínimo)
    cesantiaModo:    getCesantiaModoSel ? getCesantiaModoSel() : 'legal',
    gratBaseModo:    getGratBaseSel    ? getGratBaseSel()     : 'base_mas_comisiones',
  };

  var resultado = liquidarDesdeLiquido({
    worker:         workerTemp,
    biz:            biz,
    liquidoObjetivo: liquido,
  });

  if(!resultado){
    resEl.style.display = 'none';
    warnEl.style.display = 'none';
    return;
  }

  var fmt = function(n){ return '$' + Math.round(n).toLocaleString('es-CL'); };
  var bruto       = resultado.brutoCalculado;
  var h           = resultado.haberes;
  var d           = resultado.descuentos;
  var grat        = h.gratificacion || 0;
  var descAfp     = d.afp.monto     || 0;
  var descSalud   = d.salud.monto   || 0;
  var descCes     = d.cesantia.monto|| 0;
  var descImp     = d.impuestoUnico.monto || 0;
  var liquidoReal = resultado.liquido;

  document.getElementById('liq-bruto').textContent  = fmt(bruto);
  document.getElementById('liq-grat').textContent   = grat > 0 ? fmt(grat) : 'No incluida';
  document.getElementById('liq-afp').textContent    = descAfp  > 0 ? '-' + fmt(descAfp)  : 'No aplica';
  document.getElementById('liq-salud').textContent  = descSalud > 0
    ? '-' + fmt(descSalud)
    : (workerTemp.salud === 'isapre' ? 'Isapre — ingresa plan' : 'No aplica');
  document.getElementById('liq-ces').textContent    = descCes  > 0 ? '-' + fmt(descCes)  : 'No aplica';
  document.getElementById('liq-neto').textContent   = fmt(liquidoReal);

  // Línea de impuesto único si aplica (el HTML original no tiene este row; lo mostramos en cesantía si no hay)
  // (en el HTML sólo hay 4 filas: bruto, grat, afp, salud, cesantia, neto — mantenemos compatibilidad)

  resEl.style.display = 'block';

  // Advertencia IMM
  var imm = (biz.params && biz.params.imm) || 500000;
  warnEl.style.display = (bruto > 0 && bruto < imm) ? 'block' : 'none';
  if(bruto > 0 && bruto < imm){
    warnEl.textContent = '\u26a0 El bruto resultante (' + fmt(bruto) + ') est\xe1 bajo el IMM de ' + fmt(imm) + '.';
  }
}

function usarBrutoSugerido(){
  var brutoEl = document.getElementById('liq-bruto');
  // Extraer número del texto formateado en pesos chilenos (e.g. "$1.234.567")
  var raw = brutoEl.textContent.replace(/\$/g,'').replace(/\./g,'').replace(/,/g,'.').trim();
  var num = parseFloat(raw);
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
  if(!isHon && !jornada){
    document.getElementById('wf-jornada').classList.add('error');
    document.getElementById('wf-jornada-err').classList.add('show');
    valid = false;
  }
  // Validación de monto: depende del tipo de contrato porque cada uno usa
  // un input distinto. Para honorarios el campo wf-sueldo está oculto y no
  // se llena directamente — el monto vive en wf-hon-mensual-monto (mensual)
  // o wf-hon-tarifa (diario).
  if(isHon){
    var honMod = document.getElementById('wf-hon-modalidad') ? document.getElementById('wf-hon-modalidad').value : 'mensual';
    if(honMod === 'diario'){
      var tarifa = parseFloat(document.getElementById('wf-hon-tarifa').value);
      if(!tarifa || tarifa <= 0){
        document.getElementById('wf-hon-tarifa').classList.add('error');
        toast('Ingresa la tarifa diaria');
        valid = false;
      }
    } else {
      var montoMes = parseFloat(document.getElementById('wf-hon-mensual-monto').value);
      if(!montoMes || montoMes <= 0){
        document.getElementById('wf-hon-mensual-monto').classList.add('error');
        toast('Ingresa el monto mensual de honorarios');
        valid = false;
      }
    }
  } else {
    // Dependientes: el campo visible es wf-sueldo.
    if(!sueldo || sueldo <= 0){
      document.getElementById('wf-sueldo').classList.add('error');
      document.getElementById('wf-sueldo-err').classList.add('show');
      valid = false;
    }
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
  var honorariosModalidad = isHon
    ? (document.getElementById('wf-hon-modalidad') ? document.getElementById('wf-hon-modalidad').value : 'mensual')
    : null;
  var honorariosTarifaDiaria = (isHon && honorariosModalidad === 'diario')
    ? (parseFloat(document.getElementById('wf-hon-tarifa').value) || 0)
    : null;
  var honorariosAcuerdo      = isHon ? getHonAcuerdoSel()    : null;
  var honorariosQuienRetiene = isHon ? getHonRetencionSel() : null;

  const worker = {
    id: editingWorkerId || Date.now().toString(),
    nombre,
    rut,
    cargo,
    inicio,
    whatsapp: document.getElementById('wf-wa').value.trim(),
    email:    document.getElementById('wf-email').value.trim(),
    contrato,
    jornada: isHon ? 'no_aplica' : jornada,
    horasSemanales: isHon ? null : (parseFloat(document.getElementById('wf-horas').value) || (biz.params && biz.params.jornadaCompleta) || 42),
    honorariosModalidad:     honorariosModalidad,
    honorariosTarifaDiaria:  honorariosTarifaDiaria,
    honorariosAcuerdo:       honorariosAcuerdo,
    honorariosQuienRetiene:  honorariosQuienRetiene,
    sueldoBase: (function(){
      // Honorarios mensual: monto independiente, viene de wf-hon-mensual-monto.
      //   No se aplica piso legal (régimen 2da categoría, fuera del art. 44 CT).
      // Honorarios diario: el sueldoBase no aplica; el cálculo usa tarifaDiaria × días.
      //   Forzamos 0 para evitar arrastrar valores residuales del input wf-sueldo.
      if(isHon){
        if(honorariosModalidad === 'diario') return 0;
        return parseFloat(document.getElementById('wf-hon-mensual-monto').value) || 0;
      }
      var modo = getSalarioModoSel();
      if(modo === 'anclado' && typeof pisoLegal === 'function'){
        var pisoW = pisoLegal({ jornada: jornada, horasSemanales: parseFloat(document.getElementById('wf-horas').value) || 45 }, getBiz());
        return Math.max(sueldo, pisoW);
      }
      return sueldo;
    })(),
    salarioModo:        isHon ? null : getSalarioModoSel(),
    cesantiaModo:       isHon ? null : getCesantiaModoSel(),
    gratBaseModo:       isHon ? null : getGratBaseSel(),
    haberesRecurrentes: isHon ? []   : getHaberesRecurrentes(),
    afp:                isHon ? null : afp,
    salud:              isHon ? null : salud,
    isapreNombre:       isHon ? '' : getIsapreNombreActual(),
    isapreMoneda:       isHon ? null : document.getElementById('wf-isapre-moneda').value,
    isapreMonto:        isHon ? 0 : (parseFloat(document.getElementById('wf-isapre-monto').value) || 0),
    gratificacion:      isHon ? null : document.getElementById('wf-grat').value,
    rol:                isHon ? 'sin_comisiones' : document.getElementById('wf-rol').value,
    template:           isHon ? null : document.getElementById('wf-template').value,
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

    var esHon    = w.contrato === 'honorarios';
    var notaCard = '';
    if(esHon){
      notaCard = (typeof honorariosNotaHTML === 'function') ? honorariosNotaHTML(w) : '';
    } else {
      notaCard = (typeof salarioNotaHTML === 'function') ? salarioNotaHTML(w, biz) : '';
    }
    // En honorarios omitimos AFP/Isapre/Fonasa (no aplican) y mostramos solo cargo + Honorarios.
    // En dependientes mostramos la línea completa.
    var metaLinea = esHon
      ? (esc(w.cargo) + ' · ' + contratoLabel)
      : (esc(w.cargo) + ' · AFP ' + esc(w.afp || '—') + ' · ' + saludLabel + ' · ' + contratoLabel);
    card.innerHTML =
      '<div class="w-avatar">' + initials + '</div>' +
      '<div class="w-info" style="pointer-events:none">' +
        '<div class="w-name">' + esc(w.nombre) + '</div>' +
        '<div class="w-meta">' + metaLinea + '</div>' +
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