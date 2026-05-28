// ════════════════════════════════════════════════════════════
// REMUNERACIONES — UI (Hito 3.C: Pantalla 4.1 Lista del Mes)
// ════════════════════════════════════════════════════════════
// Consume las funciones de payroll.js:
//   getMonthStatus, liquidar, savePayroll, getPayroll,
//   closeMonth, reopenMonth
//
// Estado de la pantalla: el mes que se está visualizando.
// Por defecto, el mes actual.

var _remPeriodo = null;  // 'YYYY-MM' actualmente en pantalla

var REM_MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                 'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// Periodo actual del sistema en formato YYYY-MM
function _remPeriodoActual(){
  var d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

// Etiqueta legible: '2026-05' → 'Mayo 2026'
function _remPeriodoLabel(periodo){
  var partes = periodo.split('-');
  var anio = parseInt(partes[0], 10);
  var mes  = parseInt(partes[1], 10) - 1;
  return REM_MESES[mes] + ' ' + anio;
}

// Navegar meses. delta = -1 (anterior) o +1 (siguiente)
function remCambiarMes(delta){
  var partes = _remPeriodo.split('-');
  var anio = parseInt(partes[0], 10);
  var mes  = parseInt(partes[1], 10) - 1;  // 0-indexed
  mes += delta;
  if(mes < 0){ mes = 11; anio--; }
  if(mes > 11){ mes = 0; anio++; }
  _remPeriodo = anio + '-' + String(mes + 1).padStart(2, '0');
  renderRemuneraciones();
}

// Formato moneda chileno (convención del proyecto)
function _remMoney(n){
  return '$' + Math.round(n || 0).toLocaleString('es-CL');
}

// Iniciales para el avatar (mismo patrón que workers.js)
function _remIniciales(nombre){
  return (nombre || '?').split(' ').slice(0, 2).map(function(x){ return x[0]; }).join('').toUpperCase();
}

// ════════════════════════════════
// RENDER PRINCIPAL
// ════════════════════════════════
function renderRemuneraciones(){
  var biz = getBiz();
  if(!biz) return;

  // Inicializar el periodo si es la primera vez
  if(!_remPeriodo) _remPeriodo = _remPeriodoActual();

  var status = getMonthStatus(_remPeriodo);
  var cont = document.getElementById('rem-content');
  if(!cont) return;

  // Etiqueta del mes
  var lblEl = document.getElementById('rem-month-label');
  if(lblEl) lblEl.textContent = _remPeriodoLabel(_remPeriodo);

  // ── Sin trabajadores ──
  if(!status || status.totales.trabajadores === 0){
    cont.innerHTML =
      '<div class="placeholder">' +
        '<div class="placeholder-icon">👥</div>' +
        '<div class="placeholder-title">Sin trabajadores</div>' +
        '<div class="placeholder-sub">Agrega trabajadores para comenzar a generar liquidaciones</div>' +
        '<button class="btn btn-primary btn-sm" onclick="go(\'trabajadores\')">Ir a Trabajadores</button>' +
      '</div>';
    return;
  }

  var html = '';

  // ── Banner de mes cerrado ──
  if(status.cerrada){
    html +=
      '<div class="rem-banner rem-banner-closed">' +
        '<span>🔒 Este mes está cerrado. Las liquidaciones no pueden editarse.</span>' +
        '<button class="btn btn-ghost btn-sm" onclick="remReabrir()">Reabrir mes</button>' +
      '</div>';
  }

  // ── Resumen ──
  html +=
    '<div class="rem-summary">' +
      '<div class="rem-summary-item">' +
        '<div class="rem-summary-value">' + status.totales.trabajadores + '</div>' +
        '<div class="rem-summary-label">Trabajadores</div>' +
      '</div>' +
      '<div class="rem-summary-item">' +
        '<div class="rem-summary-value success">' + status.totales.liquidados + '</div>' +
        '<div class="rem-summary-label">Liquidados</div>' +
      '</div>' +
      '<div class="rem-summary-item">' +
        '<div class="rem-summary-value' + (status.totales.pendientes > 0 ? ' gold' : '') + '">' + status.totales.pendientes + '</div>' +
        '<div class="rem-summary-label">Pendientes</div>' +
      '</div>' +
    '</div>';

  // ── Botón liquidar todos (sólo si hay pendientes y el mes no está cerrado) ──
  if(status.totales.pendientes > 0 && !status.cerrada){
    html +=
      '<button class="btn btn-primary btn-full" style="margin-bottom:16px" onclick="remLiquidarTodos()">' +
        'Liquidar ' + status.totales.pendientes + ' pendiente' + (status.totales.pendientes !== 1 ? 's' : '') +
      '</button>';
  }

  // ── Lista de trabajadores ──
  html += '<div class="rem-list">';
  status.items.forEach(function(item){
    var w = item.worker;
    var liquidada = item.status === 'liquidada';
    var iniciales = _remIniciales(w.nombre);

    var badge = liquidada
      ? '<span class="badge badge-success" style="font-size:10px">Liquidada</span>'
      : '<span class="badge" style="font-size:10px">Pendiente</span>';

    var montoLinea = liquidada
      ? '<div class="rem-card-amount">' + _remMoney(item.liquidacion.liquido) + '</div>' +
        '<div class="rem-card-amount-label">líquido</div>'
      : '<div class="rem-card-amount pending">' + _remMoney(w.sueldoBase) + '</div>' +
        '<div class="rem-card-amount-label">sueldo base</div>';

    html +=
      '<div class="rem-card" data-wid="' + w.id + '" data-status="' + item.status + '">' +
        '<div class="w-avatar">' + iniciales + '</div>' +
        '<div class="rem-card-info">' +
          '<div class="w-name">' + esc(w.nombre) + '</div>' +
          '<div class="w-meta">' + esc(w.cargo || '') + (w.cargo ? ' · ' : '') + 'AFP ' + esc(w.afp || '—') + '</div>' +
          ((typeof salarioNotaHTML === 'function') ? salarioNotaHTML(w, biz) : '') +
        '</div>' +
        '<div class="rem-card-right">' +
          montoLinea +
          badge +
        '</div>' +
      '</div>';
  });
  html += '</div>';

  // ── Botón cerrar mes (sólo si todos liquidados y mes abierto) ──
  if(status.totales.pendientes === 0 && !status.cerrada && status.totales.trabajadores > 0){
    html +=
      '<button class="btn btn-secondary btn-full" style="margin-top:16px" onclick="remCerrar()">' +
        '🔒 Cerrar mes' +
      '</button>';
  }

  cont.innerHTML = html;

  // Listener delegado para click en tarjetas
  var listEl = cont.querySelector('.rem-list');
  if(listEl){
    listEl.onclick = function(e){
      var card = e.target.closest('.rem-card');
      if(!card) return;
      var wid = card.getAttribute('data-wid');
      var st  = card.getAttribute('data-status');
      remAbrirTrabajador(wid, st);
    };
  }
}

// ════════════════════════════════
// ACCIONES
// ════════════════════════════════

// Click en una tarjeta. En 3.C sólo informa; en 3.D abrirá la calculadora.
function remAbrirTrabajador(workerId, status){
  // Placeholder hasta 3.D
  if(status === 'liquidada'){
    var liq = getPayroll(_remPeriodo, workerId);
    if(liq) toast('Liquidación: ' + _remMoney(liq.liquido) + ' líquido');
  } else {
    toast('La calculadora de liquidación llega en el siguiente paso');
  }
}

// Liquidar todos los pendientes del mes.
function remLiquidarTodos(){
  var biz = getBiz();
  if(!biz) return;
  var status = getMonthStatus(_remPeriodo);
  if(!status || status.cerrada) return;

  var pendientes = status.items.filter(function(i){ return i.status === 'pendiente'; });
  if(pendientes.length === 0){ toast('No hay pendientes'); return; }

  var liquidados = 0;
  var fallidos = [];

  pendientes.forEach(function(item){
    var w = item.worker;
    // Validación: necesita sueldo base y, si es dependiente, AFP
    var esDependiente = w.contrato !== 'honorarios';
    if(!w.sueldoBase || w.sueldoBase <= 0){
      fallidos.push({ nombre: w.nombre, motivo: 'sin sueldo base' });
      return;
    }
    if(esDependiente && !w.afp){
      fallidos.push({ nombre: w.nombre, motivo: 'falta AFP' });
      return;
    }
    if(esDependiente && !w.salud){
      fallidos.push({ nombre: w.nombre, motivo: 'falta previsión de salud' });
      return;
    }
    try {
      var liq = liquidar({ worker: w, biz: biz, periodo: _remPeriodo });
      // Guardado directo sin pasar por savePayroll (que pediría PIN si existiera);
      // como son liquidaciones nuevas en lote, las escribimos directo.
      ensurePayrollsStorage(biz);
      if(!biz.payrolls[_remPeriodo]){
        biz.payrolls[_remPeriodo] = { cerrada: false, fechaCerrado: null, workers: {} };
      }
      liq.fechaGuardado = new Date().toISOString();
      biz.payrolls[_remPeriodo].workers[w.id] = liq;
      liquidados++;
    } catch(err){
      fallidos.push({ nombre: w.nombre, motivo: 'error de cálculo' });
    }
  });

  save(db);
  renderRemuneraciones();

  // Resumen al usuario
  if(fallidos.length === 0){
    toast('Se liquidaron ' + liquidados + ' trabajador' + (liquidados !== 1 ? 'es' : ''));
  } else {
    var detalle = fallidos.map(function(f){ return f.nombre + ' (' + f.motivo + ')'; }).join(', ');
    showConfirmModal(
      'Liquidación parcial',
      'Se liquidaron ' + liquidados + ' de ' + pendientes.length + ' trabajadores. ' +
      'Quedaron pendientes por datos incompletos: ' + detalle + '.',
      function(){ closeConfirmModal(); }
    );
    // Ocultar el botón cancelar y dejar sólo "Entendido"
    var actionBtn = document.getElementById('confirm-action-btn');
    if(actionBtn) actionBtn.textContent = 'Entendido';
  }
}

function remCerrar(){
  closeMonth(_remPeriodo, function(){ renderRemuneraciones(); });
}

function remReabrir(){
  reopenMonth(_remPeriodo, function(){ renderRemuneraciones(); });
}
