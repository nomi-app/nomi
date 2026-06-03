// ════════════════════════════════════════════════════════════
// SALARIO-UI — Modo de salario en la ficha (Hito 3.C-bis Parte 2)
// ════════════════════════════════════════════════════════════
// Selector de 3 opciones excluyentes (anclado / fijo / bajo_minimo),
// modales informativos con marco legal, y notas visibles en ficha y tarjeta.
//
// Depende de payroll.js: pisoLegal, notaSueldo, bajoMinimo.
// Estado del selector en la ficha:
var _salarioModoSel = 'anclado';

// ── Textos de los modales (aprobados) ──
// El [X] de jornada se reemplaza en vivo por el valor configurado.
function _jornadaCompletaActual(){
  var b = (typeof getBiz === 'function') ? getBiz() : null;
  return (b && b.params && b.params.jornadaCompleta) || 42;
}

var SALARIO_MODOS = {
  anclado: {
    label: 'Anclado al mínimo',
    breve: 'Sigue el ingreso mínimo legal. Sube cuando el mínimo lo supera; nunca baja.',
    titulo: 'Anclado al mínimo',
    cuerpo: function(){
      var jc = _jornadaCompletaActual();
      return '<p>El sueldo de este trabajador queda vinculado al ingreso mínimo legal vigente que tengas configurado en Nomi, conforme al artículo 44 del Código del Trabajo.</p>' +
        '<p style="margin-top:12px"><strong>Cómo se comporta:</strong></p>' +
        '<ul style="margin:6px 0 0 18px;padding:0">' +
          '<li style="margin-bottom:6px">Si el ingreso mínimo sube y supera el sueldo actual, Nomi lo ajusta automáticamente al nuevo mínimo.</li>' +
          '<li style="margin-bottom:6px">El sueldo nunca baja: el sueldo pactado no puede reducirse unilateralmente (principio de irrenunciabilidad de derechos laborales, artículo 5° del Código del Trabajo; el contrato sólo se modifica por mutuo acuerdo).</li>' +
          '<li style="margin-bottom:6px">Puedes subirlo manualmente por encima del mínimo cuando quieras; seguirá protegido por el piso mínimo hacia adelante.</li>' +
        '</ul>' +
        '<p style="margin-top:12px"><strong>Jornada parcial:</strong> el artículo 44 dispone que el mínimo se calcule en proporción a las horas pactadas. Con una jornada completa de ' + jc + ' horas semanales configurada en Nomi, un trabajador de 30 horas tendría un mínimo de mínimo × 30 / ' + jc + '.</p>' +
        '<p style="margin-top:12px">Así el sueldo se mantiene siempre dentro de la legalidad sin que revises trabajador por trabajador cada vez que cambie el mínimo.</p>';
    },
  },
  fijo: {
    label: 'Sueldo fijo pactado',
    breve: 'Monto fijo acordado. No cambia salvo que lo edites manualmente.',
    titulo: 'Sueldo fijo pactado',
    cuerpo: function(){
      return '<p>Este es el monto que acordaste con el trabajador y queda fijo: Nomi no lo modifica automáticamente bajo ninguna circunstancia. Sólo cambia si tú lo editas manualmente en esta ficha.</p>' +
        '<p style="margin-top:12px"><strong>Sobre el sueldo mínimo:</strong> el artículo 44 del Código del Trabajo establece que el sueldo mensual no puede ser inferior al ingreso mínimo legal vigente. Si en el futuro el mínimo sube por encima de este monto, Nomi no ajustará el sueldo automáticamente, pero te mostrará un aviso en la ficha indicando que quedó bajo el mínimo vigente. La decisión de actualizarlo es tuya.</p>' +
        '<p style="margin-top:12px">Si prefieres que este sueldo suba solo cuando el mínimo lo supere, usa "Anclado al mínimo". Si el monto es intencionalmente inferior al mínimo legal, usa "Bajo el mínimo (declarado)".</p>';
    },
  },
  bajo_minimo: {
    label: 'Bajo el mínimo (declarado)',
    breve: '⚠ Sueldo inferior al mínimo legal. Configurado manualmente por el responsable.',
    titulo: 'Sueldo bajo el mínimo legal',
    cuerpo: function(){
      return '<p>Has declarado que este trabajador percibe un sueldo inferior al ingreso mínimo legal vigente en Chile.</p>' +
        '<p style="margin-top:12px"><strong>Qué implica:</strong></p>' +
        '<ul style="margin:6px 0 0 18px;padding:0">' +
          '<li style="margin-bottom:6px">Nomi no modificará este monto ni lo ajustará cuando cambie el mínimo. Queda exactamente como lo configures.</li>' +
          '<li style="margin-bottom:6px">La advertencia será visible en la ficha y en la tarjeta del trabajador, para tu control interno. No aparecerá en las liquidaciones, que se mantienen como un documento de cálculo limpio.</li>' +
        '</ul>' +
        '<p style="margin-top:12px"><strong>Marco legal:</strong> el artículo 44 del Código del Trabajo establece que el sueldo no puede ser inferior al ingreso mínimo mensual (proporcional en jornadas parciales). Pagar bajo ese mínimo puede infringir la normativa laboral y exponer al negocio a multas o reclamos.</p>' +
        '<p style="margin-top:12px"><strong>Responsabilidad:</strong> esta configuración es una decisión exclusiva del responsable del negocio. Nomi es una herramienta de cálculo y registro; no asesora ni valida la legalidad de los acuerdos salariales. Ante cualquier duda, consulta con un contador o asesor laboral.</p>';
    },
  },
};

var SALARIO_ORDEN = ['anclado', 'fijo', 'bajo_minimo'];

// ── Render del selector dentro del contenedor #wf-salmodo ──
function renderSalarioModoSelector(modo){
  _salarioModoSel = modo || 'anclado';
  var cont = document.getElementById('wf-salmodo');
  if(!cont) return;

  var html = '<label class="label">Tratamiento del sueldo</label>';
  html += '<div class="salmodo-group">';
  SALARIO_ORDEN.forEach(function(key){
    var m = SALARIO_MODOS[key];
    var active = key === _salarioModoSel;
    html +=
      '<div class="salmodo-opt' + (active ? ' active' : '') + '" data-modo="' + key + '" onclick="selectSalarioModo(\'' + key + '\')">' +
        '<div class="salmodo-opt-head">' +
          '<span class="salmodo-radio"></span>' +
          '<span class="salmodo-label">' + m.label + '</span>' +
          '<span class="salmodo-info" onclick="event.stopPropagation();openSalarioInfo(\'' + key + '\')" title="Más información">i</span>' +
        '</div>' +
        '<div class="salmodo-breve' + (key === 'bajo_minimo' ? ' warn' : '') + '">' + m.breve + '</div>' +
      '</div>';
  });
  html += '</div>';
  cont.innerHTML = html;
}

function selectSalarioModo(modo){
  _salarioModoSel = modo;
  renderSalarioModoSelector(modo);
}

function getSalarioModoSel(){
  return _salarioModoSel || 'anclado';
}

// ── Modal informativo (i) ──
function openSalarioInfo(key){
  var m = SALARIO_MODOS[key];
  if(!m){ m = INFO_MODALES[key]; }
  if(!m) return;
  document.getElementById('salinfo-title').textContent = m.titulo;
  document.getElementById('salinfo-body').innerHTML = m.cuerpo();
  document.getElementById('salinfo-overlay').style.display = 'flex';
}
function closeSalarioInfo(){
  document.getElementById('salinfo-overlay').style.display = 'none';
}

// ── Nota para la tarjeta del trabajador (lista de Trabajadores y de Remuneraciones) ──
// Devuelve HTML de la nota, o '' si no hay nada que advertir.
function salarioNotaHTML(worker, biz){
  if(typeof notaSueldo !== 'function') return '';
  var nota = notaSueldo(worker, biz);
  if(!nota) return '';
  return '<div class="salmodo-card-note">⚠ ' + nota.texto + '</div>';
}


// ════════════════════════════════════════════════════════════
// PASE B — SELECTORES DE CESANTÍA Y GRATIFICACIÓN
// ════════════════════════════════════════════════════════════

var _cesantiaModoSel = 'legal';
var _gratBaseSel     = 'base_mas_comisiones';

// Modales informativos para cesantía y gratificación
var INFO_MODALES = {
  cesantia_legal: {
    titulo: 'Seguro de cesantía según la ley',
    cuerpo: function(){
      return '<p>Aplica el descuento del Seguro de Cesantía según lo establecido en la <strong>Ley N° 19.728</strong>.</p>' +
        '<p style="margin-top:12px"><strong>Porcentajes vigentes:</strong></p>' +
        '<ul style="margin:6px 0 0 18px;padding:0">' +
          '<li style="margin-bottom:6px"><strong>Contrato indefinido:</strong> trabajador 0,6% · empleador 2,4% (total 3%).</li>' +
          '<li style="margin-bottom:6px"><strong>Plazo fijo:</strong> empleador 3% · trabajador no aporta.</li>' +
          '<li style="margin-bottom:6px"><strong>Honorarios:</strong> no aplica (no hay relación laboral dependiente).</li>' +
        '</ul>' +
        '<p style="margin-top:12px">El descuento del trabajador se calcula sobre el sueldo imponible, con un tope mayor al de AFP y salud (135,2 UF). El monto va a la cuenta individual y al fondo solidario del trabajador.</p>';
    },
  },
  cesantia_no_descuenta: {
    titulo: 'Sin descuento de seguro de cesantía',
    cuerpo: function(){
      return '<p>Has declarado que a este trabajador no se le descuenta el seguro de cesantía, contrario a lo dispuesto por la ley.</p>' +
        '<p style="margin-top:12px"><strong>Qué implica:</strong></p>' +
        '<ul style="margin:6px 0 0 18px;padding:0">' +
          '<li style="margin-bottom:6px">Nomi no aplicará el descuento de cesantía en las liquidaciones de este trabajador.</li>' +
          '<li style="margin-bottom:6px">La advertencia será visible en la ficha y en la tarjeta del trabajador, para tu control interno. No aparecerá en las liquidaciones.</li>' +
        '</ul>' +
        '<p style="margin-top:12px"><strong>Marco legal:</strong> la <strong>Ley N° 19.728</strong> establece el Seguro Obligatorio de Cesantía. Para contratos indefinidos, el trabajador aporta 0,6% del imponible y el empleador 2,4%. No cumplir con la cotización puede acarrear multas, reclamos administrativos y demandas laborales.</p>' +
        '<p style="margin-top:12px"><strong>Responsabilidad:</strong> esta configuración es una decisión exclusiva del responsable del negocio. Nomi es una herramienta de cálculo y registro; no asesora ni valida la legalidad de los acuerdos. Ante cualquier duda, consulta con un contador o asesor laboral.</p>';
    },
  },
  grat_base_mas_comisiones: {
    titulo: 'Gratificación sobre base ampliada',
    cuerpo: function(){
      return '<p>La gratificación mensual se calcula sobre el <strong>sueldo base + comisiones + otros haberes imponibles</strong> del mes.</p>' +
        '<p style="margin-top:12px"><strong>Fórmula:</strong> 25% de (sueldo base + comisiones + otros imponibles), con tope legal de 4,75 IMM anuales / 12 al mes (art. 50 del Código del Trabajo).</p>' +
        '<p style="margin-top:12px">Es la modalidad <strong>más beneficiosa</strong> para el trabajador y la más defendible legalmente. Se usa habitualmente cuando el contrato no especifica lo contrario o cuando se pacta explícitamente esta base.</p>' +
        '<p style="margin-top:12px">Si el contrato establece que la gratificación se calcula sólo sobre el sueldo base, usa la opción "Sólo sueldo base".</p>';
    },
  },
  grat_solo_base: {
    titulo: 'Gratificación sólo sobre sueldo base',
    cuerpo: function(){
      return '<p>La gratificación mensual se calcula <strong>únicamente sobre el sueldo base</strong>, sin considerar comisiones ni otros haberes imponibles.</p>' +
        '<p style="margin-top:12px"><strong>Fórmula:</strong> 25% del sueldo base, con tope legal de 4,75 IMM anuales / 12 al mes (art. 50 del Código del Trabajo).</p>' +
        '<p style="margin-top:12px">Es <strong>menos beneficiosa</strong> para el trabajador que la base ampliada. Sólo debería usarse cuando el contrato de trabajo así lo establece explícitamente.</p>' +
        '<p style="margin-top:12px"><strong>Verifica</strong> que esta modalidad esté pactada en el contrato individual del trabajador antes de aplicarla.</p>';
    },
  },

  // ── 3.D Paso 2 — Honorarios: acuerdo y retención ──
  hon_acuerdo_bruto: {
    titulo: 'Acuerdo en bruto',
    cuerpo: function(){
      return '<p>El monto que acordaste con el trabajador es el <strong>valor de la boleta</strong> que él va a emitir en el SII. Es la forma más habitual de pactar honorarios.</p>' +
        '<p style="margin-top:12px"><strong>Qué significa en la práctica:</strong></p>' +
        '<ul style="margin:6px 0 0 18px;padding:0">' +
          '<li style="margin-bottom:6px">Si el trabajador retiene su propia boleta, la empresa le paga el monto bruto completo y el trabajador descuenta y declara la retención en su PPM mensual.</li>' +
          '<li style="margin-bottom:6px">Si la empresa retiene, le paga al trabajador el bruto menos la retención y la empresa entera ese impuesto al SII.</li>' +
        '</ul>' +
        '<p style="margin-top:12px">El monto líquido que termina recibiendo el trabajador depende de quién retenga. Nomi calcula ambos lados.</p>' +
        '<p style="margin-top:12px">Si en cambio pactaste un monto líquido fijo en mano para el trabajador y necesitas que Nomi calcule la boleta hacia atrás, usa <strong>"Acuerdo en líquido"</strong>.</p>';
    },
  },
  hon_acuerdo_liquido: {
    titulo: 'Acuerdo en líquido',
    cuerpo: function(){
      var tasa = _honTasaActual();
      return '<p>El monto que acordaste es lo que el trabajador queda con en mano <strong>después de cumplir con la retención del SII</strong>. Nomi calcula automáticamente cuánto debe emitirse en la boleta para llegar a ese líquido.</p>' +
        '<p style="margin-top:12px"><strong>Fórmula:</strong> boleta = líquido / (1 − ' + tasa + '%). Para un líquido pactado de $100.000 con la tasa actual del ' + tasa + '%, la boleta debe ser de $' + Math.round(100000 / (1 - tasa/100)).toLocaleString('es-CL') + '.</p>' +
        '<p style="margin-top:12px">Funciona igual que el cálculo bruto↔líquido que ya usas en trabajadores dependientes: tú pactas en líquido, Nomi resuelve el bruto necesario.</p>' +
        '<p style="margin-top:12px"><strong>Importante:</strong> la tasa de retención sube anualmente según la Ley 21.133 (15,25% en 2026 → 17% en 2028). Cuando cambie, actualízala en Configuración y todos los cálculos se ajustan solos.</p>';
    },
  },
  hon_retiene_trabajador: {
    titulo: 'Retiene el trabajador',
    cuerpo: function(){
      var tasa = _honTasaActual();
      return '<p>El trabajador retiene su propia boleta y declara la retención al SII por su cuenta. Es la opción que se marca como <em>"el emisor declarará el PPM"</em> en sii.cl al emitir la boleta.</p>' +
        '<p style="margin-top:12px"><strong>Cómo funciona:</strong></p>' +
        '<ul style="margin:6px 0 0 18px;padding:0">' +
          '<li style="margin-bottom:6px">La empresa le paga al trabajador el monto completo de la boleta.</li>' +
          '<li style="margin-bottom:6px">El trabajador declara y paga la retención del ' + tasa + '% mediante PPM en su propio Formulario 29, hasta el día 12 del mes siguiente.</li>' +
          '<li style="margin-bottom:6px">La empresa no tiene obligación tributaria mensual por esta boleta.</li>' +
        '</ul>' +
        '<p style="margin-top:12px"><strong>Marco legal:</strong> artículo 74 N°2 de la Ley sobre Impuesto a la Renta. Aplica cuando el receptor de la boleta no está obligado a retener (típicamente personas naturales que no llevan contabilidad) o cuando se acuerda explícitamente que el emisor declarará.</p>';
    },
  },
  hon_retiene_empleador: {
    titulo: 'Retiene la empresa',
    cuerpo: function(){
      var tasa = _honTasaActual();
      return '<p>La empresa retiene el ' + tasa + '% del valor de la boleta y entera esa retención directamente al SII. Es la opción que se marca como <em>"el receptor actuará reteniendo"</em> en sii.cl.</p>' +
        '<p style="margin-top:12px"><strong>Cómo funciona:</strong></p>' +
        '<ul style="margin:6px 0 0 18px;padding:0">' +
          '<li style="margin-bottom:6px">La empresa paga al trabajador el monto de la boleta menos la retención del ' + tasa + '%.</li>' +
          '<li style="margin-bottom:6px">La empresa declara y paga esa retención en el <strong>Formulario 29 línea 61 (código 151)</strong>, hasta el día 12 del mes siguiente (20 si declara por internet).</li>' +
          '<li style="margin-bottom:6px">El trabajador no tiene obligación tributaria mensual por esta boleta; recibe el líquido directo.</li>' +
        '</ul>' +
        '<p style="margin-top:12px"><strong>Marco legal:</strong> artículo 74 N°2 de la Ley sobre Impuesto a la Renta. Es la opción obligatoria cuando el receptor es una empresa con contabilidad (sociedades, personas jurídicas en general).</p>';
    },
  },
};

// Helper interno usado por los modales de honorarios
function _honTasaActual(){
  var b = (typeof getBiz === 'function') ? getBiz() : null;
  return (b && b.params && b.params.honorariosRetencion != null) ? b.params.honorariosRetencion : 15.25;
}


// ── Selector de cesantía ──
function renderCesantiaModoSelector(modo){
  _cesantiaModoSel = modo || 'legal';
  var cont = document.getElementById('wf-cesmodo');
  if(!cont) return;
  var opts = [
    { key: 'legal',         label: 'Según la ley vigente',           breve: 'Descuenta cesantía conforme a la Ley 19.728.',                   info: 'cesantia_legal' },
    { key: 'no_descuenta',  label: 'No se descuenta (declarado)',    breve: '⚠ El seguro de cesantía no se descuenta. Configurado manualmente por el responsable.', info: 'cesantia_no_descuenta', warn: true },
  ];
  cont.innerHTML = '<label class="label">Seguro de cesantía</label>' + _renderModoOpts(opts, _cesantiaModoSel, 'selectCesantiaModo');
}
function selectCesantiaModo(key){
  _cesantiaModoSel = key;
  renderCesantiaModoSelector(key);
}
function getCesantiaModoSel(){ return _cesantiaModoSel || 'legal'; }


// ── Selector de base de gratificación ──
function renderGratBaseSelector(modo){
  _gratBaseSel = modo || 'base_mas_comisiones';
  var cont = document.getElementById('wf-gratbase');
  if(!cont) return;
  var opts = [
    { key: 'base_mas_comisiones', label: 'Sueldo base + comisiones + otros imponibles', breve: 'Más beneficiosa para el trabajador. Base habitual.', info: 'grat_base_mas_comisiones' },
    { key: 'solo_base',           label: 'Sólo sueldo base',                            breve: 'Sólo si el contrato lo establece explícitamente.',   info: 'grat_solo_base' },
  ];
  cont.innerHTML = '<label class="label">Base de cálculo de gratificación</label>' + _renderModoOpts(opts, _gratBaseSel, 'selectGratBase');
}
function selectGratBase(key){
  _gratBaseSel = key;
  renderGratBaseSelector(key);
}
function getGratBaseSel(){ return _gratBaseSel || 'base_mas_comisiones'; }


// Renderizado genérico de un grupo de opciones (reutilizable)
function _renderModoOpts(opts, current, onSelectName){
  var html = '<div class="salmodo-group">';
  opts.forEach(function(m){
    var active = m.key === current;
    html +=
      '<div class="salmodo-opt' + (active ? ' active' : '') + '" data-modo="' + m.key + '" onclick="' + onSelectName + '(\'' + m.key + '\')">' +
        '<div class="salmodo-opt-head">' +
          '<span class="salmodo-radio"></span>' +
          '<span class="salmodo-label">' + m.label + '</span>' +
          '<span class="salmodo-info" onclick="event.stopPropagation();openSalarioInfo(\'' + m.info + '\')" title="Más información">i</span>' +
        '</div>' +
        '<div class="salmodo-breve' + (m.warn ? ' warn' : '') + '">' + m.breve + '</div>' +
      '</div>';
  });
  html += '</div>';
  return html;
}


// ── HABERES RECURRENTES ──
// Estado en memoria del editor; se persiste en worker.haberesRecurrentes al guardar.
var _haberesRecurrentes = [];

function renderHaberesRecurrentes(arr){
  _haberesRecurrentes = Array.isArray(arr) ? arr.slice() : [];
  _drawHaberesRecurrentes();
}

function _drawHaberesRecurrentes(){
  var cont = document.getElementById('wf-haberes-rec-rows');
  if(!cont) return;
  var html = '';
  _haberesRecurrentes.forEach(function(row, idx){
    html +=
      '<div class="lq-otros-row" data-idx="' + idx + '">' +
        '<input class="input" type="text" placeholder="Etiqueta" value="' + esc(row.label || '') + '" oninput="hrecUpdateLabel(' + idx + ', this.value)" style="font-size:12px;flex:1"/>' +
        '<div style="position:relative;flex:0 0 130px">' +
          '<span class="lq-noimp-peso">$</span>' +
          '<input class="input" type="number" placeholder="0" value="' + (row.monto || '') + '" oninput="hrecUpdateMonto(' + idx + ', this.value)"/>' +
        '</div>' +
        '<button class="btn btn-ghost btn-icon btn-sm" onclick="hrecEliminar(' + idx + ')" title="Eliminar" style="color:var(--danger);flex-shrink:0">✕</button>' +
      '</div>';
  });
  cont.innerHTML = html;
}

function hrecAgregar(){
  _haberesRecurrentes.push({ label: '', monto: 0 });
  _drawHaberesRecurrentes();
}
function hrecEliminar(idx){
  _haberesRecurrentes.splice(idx, 1);
  _drawHaberesRecurrentes();
}
function hrecUpdateLabel(idx, val){
  if(_haberesRecurrentes[idx]) _haberesRecurrentes[idx].label = val;
}
function hrecUpdateMonto(idx, val){
  if(_haberesRecurrentes[idx]) _haberesRecurrentes[idx].monto = parseFloat(val) || 0;
}
function getHaberesRecurrentes(){
  // Filtrar vacíos
  return _haberesRecurrentes
    .map(function(r){ return { label: (r.label || '').trim(), monto: parseFloat(r.monto) || 0 }; })
    .filter(function(r){ return r.label && r.monto > 0; });
}


// ── Notas adicionales para tarjetas (cesantía no descontada) ──
function cesantiaNotaHTML(worker){
  if((worker.cesantiaModo || 'legal') === 'no_descuenta'){
    return '<div class="salmodo-card-note">⚠ Cesantía no descontada (declarado por el responsable).</div>';
  }
  return '';
}

// ── Nota informativa para tarjetas de honorarios ──
// Muestra el escenario en formato compacto: "Honorarios · bruto · trabajador retiene"
// No es advertencia (no usa ⚠), es identificación del régimen.
function honorariosNotaHTML(worker){
  if(!worker || worker.contrato !== 'honorarios') return '';
  var acuerdo  = worker.honorariosAcuerdo      || 'bruto';
  var retiene  = worker.honorariosQuienRetiene || 'trabajador';
  var acLabel  = acuerdo === 'bruto' ? 'bruto' : 'líquido';
  var reLabel  = retiene === 'empleador' ? 'retiene la empresa' : 'retiene el trabajador';
  var modal    = (worker.honorariosModalidad === 'diario') ? 'diario' : 'mensual';
  return '<div class="hon-nota-card">Honorarios · ' + modal + ' · ' + acLabel + ' · ' + reLabel + '</div>';
}


// ════════════════════════════════════════════════════════════
// 3.D Paso 2 — Selectores de honorarios (Acuerdo + Quién retiene)
// ════════════════════════════════════════════════════════════

var _honAcuerdoSel    = 'bruto';
var _honRetencionSel  = 'trabajador';

function renderHonAcuerdoSelector(modo){
  _honAcuerdoSel = modo || 'bruto';
  var cont = document.getElementById('wf-hon-acuerdo');
  if(!cont) return;
  var opts = [
    { key: 'bruto',   label: 'Bruto (valor de la boleta)',  breve: 'Pactas lo que vale la boleta. El líquido depende de quién retiene.', info: 'hon_acuerdo_bruto' },
    { key: 'liquido', label: 'Líquido en mano',              breve: 'Pactas lo que recibe el trabajador. Nomi calcula la boleta hacia atrás.', info: 'hon_acuerdo_liquido' },
  ];
  cont.innerHTML = '<label class="label">Tipo de acuerdo</label>' + _renderModoOpts(opts, _honAcuerdoSel, 'selectHonAcuerdo');
}
function selectHonAcuerdo(key){
  _honAcuerdoSel = key;
  renderHonAcuerdoSelector(key);
  if(typeof updateHonPreview === 'function') updateHonPreview();
}
function getHonAcuerdoSel(){ return _honAcuerdoSel || 'bruto'; }


function renderHonRetencionSelector(modo){
  _honRetencionSel = modo || 'trabajador';
  var cont = document.getElementById('wf-hon-retencion');
  if(!cont) return;
  var tasa = _honTasaActual();
  var opts = [
    { key: 'trabajador', label: 'Retiene el trabajador', breve: 'PPM declarado por el trabajador en su propio F29.',         info: 'hon_retiene_trabajador' },
    { key: 'empleador',  label: 'Retiene la empresa',    breve: 'La empresa declara la retención en F29 línea 61 (cód. 151).', info: 'hon_retiene_empleador' },
  ];
  cont.innerHTML = '<label class="label">Quién retiene el ' + tasa + '%</label>' + _renderModoOpts(opts, _honRetencionSel, 'selectHonRetencion');
}
function selectHonRetencion(key){
  _honRetencionSel = key;
  renderHonRetencionSelector(key);
  if(typeof updateHonPreview === 'function') updateHonPreview();
}
function getHonRetencionSel(){ return _honRetencionSel || 'trabajador'; }


// ── Vista previa del cálculo en la ficha ──
// Llama a liquidar() con los datos del form y muestra montoBoleta / pagoTrabajador / pagoSII / líquido.
function updateHonPreview(){
  var box  = document.getElementById('wf-hon-preview');
  var body = document.getElementById('wf-hon-preview-body');
  if(!box || !body) return;

  // Sólo si contrato = honorarios
  var contratoEl = document.getElementById('wf-contrato');
  if(!contratoEl || contratoEl.value !== 'honorarios'){
    box.style.display = 'none';
    return;
  }

  // Determinar el monto base según la modalidad
  var modalidad = document.getElementById('wf-hon-modalidad').value;
  var montoBase;
  if(modalidad === 'mensual'){
    montoBase = parseFloat(document.getElementById('wf-hon-mensual-monto').value) || 0;
  } else {
    // En diario el preview asume 1 día como referencia
    montoBase = parseFloat(document.getElementById('wf-hon-tarifa').value) || 0;
  }
  if(montoBase <= 0){ box.style.display = 'none'; return; }

  var biz = (typeof getBiz === 'function') ? getBiz() : null;
  if(!biz){ box.style.display = 'none'; return; }

  // Worker fantasma: declara modalidad y tarifa explícitas, para que el motor
  // tome la rama correcta. En diario, pasamos diasTrabajados=1 al motor y
  // tarifaDiaria adentro del fantasma → el preview muestra "por día".
  // En mensual, montoBase va como sueldoBase como hasta ahora.
  var workerFantasma = {
    id: 'preview',
    contrato: 'honorarios',
    honorariosModalidad:    modalidad,
    honorariosAcuerdo:      getHonAcuerdoSel(),
    honorariosQuienRetiene: getHonRetencionSel(),
  };
  var opts = { worker: workerFantasma, biz: biz };
  if(modalidad === 'diario'){
    workerFantasma.honorariosTarifaDiaria = montoBase;
    opts.diasTrabajados = 1;
  } else {
    workerFantasma.sueldoBase = montoBase;
  }

  var liq;
  try {
    liq = liquidar(opts);
  } catch(e){
    box.style.display = 'none';
    return;
  }
  var h = liq.descuentos.honorariosRetencion;
  var fmt = function(n){ return '$' + Math.round(n).toLocaleString('es-CL'); };

  var unidad = modalidad === 'diario' ? ' por día' : '';
  var html =
    '<div style="display:flex;justify-content:space-between;padding:4px 0;color:var(--text2)"><span>Monto de la boleta' + unidad + '</span><span style="font-family:var(--mono);color:var(--text)">' + fmt(h.montoBoleta) + '</span></div>' +
    '<div style="display:flex;justify-content:space-between;padding:4px 0;color:var(--text2)"><span>Pago al trabajador' + unidad + '</span><span style="font-family:var(--mono);color:var(--text)">' + fmt(h.pagoTrabajador) + '</span></div>' +
    '<div style="display:flex;justify-content:space-between;padding:4px 0;color:var(--text2)"><span>Pago al SII' + unidad + '</span><span style="font-family:var(--mono);color:var(--text)">' + fmt(h.pagoSII) + '</span></div>' +
    '<div style="height:1px;background:var(--border);margin:6px 0"></div>' +
    '<div style="display:flex;justify-content:space-between;padding:4px 0;font-weight:600"><span>Líquido del trabajador</span><span style="font-family:var(--mono);color:var(--success)">' + fmt(liq.liquido) + '</span></div>' +
    '<div style="margin-top:8px;font-size:10px;color:var(--text3);letter-spacing:.04em">Escenario ' + h.escenario + ' · tasa ' + h.tasa + '%' +
      (modalidad === 'diario' ? ' · referencia para 1 día' : '') +
    '</div>';
  body.innerHTML = html;
  box.style.display = 'block';

  // Sincronizar label y ayuda del input mensual según el tipo de acuerdo
  var lblMes  = document.getElementById('wf-hon-mensual-label');
  var helpMes = document.getElementById('wf-hon-mensual-help');
  if(lblMes && helpMes){
    if(_honAcuerdoSel === 'liquido'){
      lblMes.textContent  = 'Monto líquido mensual en mano ($)';
      helpMes.textContent = 'Lo que el trabajador recibe en mano. Nomi calcula la boleta hacia atrás.';
    } else {
      lblMes.textContent  = 'Monto bruto mensual pactado ($)';
      helpMes.textContent = 'Valor de la boleta. Podrás editarlo al registrar cada pago mensual.';
    }
  }

  // Sincronizar label y ayuda del input diario según el tipo de acuerdo
  var lblDia  = document.getElementById('wf-hon-tarifa-label');
  var helpDia = document.getElementById('wf-hon-tarifa-help');
  if(lblDia && helpDia){
    if(_honAcuerdoSel === 'liquido'){
      lblDia.textContent  = 'Tarifa líquida diaria pactada ($)';
      helpDia.textContent = 'Lo que el trabajador recibe en mano por cada día trabajado. La boleta diaria efectiva es mayor; Nomi la calcula al registrar el pago.';
    } else {
      lblDia.textContent  = 'Tarifa diaria pactada ($)';
      helpDia.textContent = 'Valor de la boleta por cada día trabajado. Al registrar el pago ingresarás los días y el bruto total se calculará automáticamente.';
    }
  }
}
