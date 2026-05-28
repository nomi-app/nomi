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
