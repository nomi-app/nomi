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
};


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
