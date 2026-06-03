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

// ── Helpers de lenguaje natural ──
// Unen listas con coma y "y" final, como una persona escribiría:
//   ['Ana']                        → 'Ana'
//   ['Ana', 'Beto']                → 'Ana y Beto'
//   ['Ana', 'Beto', 'Carla']       → 'Ana, Beto y Carla'
function _listarNombres(arr){
  if(!arr || !arr.length) return '';
  if(arr.length === 1) return arr[0];
  if(arr.length === 2) return arr[0] + ' y ' + arr[1];
  return arr.slice(0, -1).join(', ') + ' y ' + arr[arr.length - 1];
}

// Variante para [{nombre, motivo}]:
//   [{nombre:'Ana', motivo:'sin AFP'}]                      → 'Ana (sin AFP)'
//   [{nombre:'Ana', motivo:'sin AFP'}, {nombre:'Beto', ...}] → 'Ana (sin AFP) y Beto (...)'
function _listarDetalle(arr){
  if(!arr || !arr.length) return '';
  var items = arr.map(function(f){ return f.nombre + ' (' + f.motivo + ')'; });
  return _listarNombres(items);
}

// Concordancia de "trabajador(es)" según número.
function _palabraTrabajador(n){ return n === 1 ? 'trabajador' : 'trabajadores'; }
function _palabraLiquidacion(n){ return n === 1 ? 'liquidación' : 'liquidaciones'; }

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

    var esHon = w.contrato === 'honorarios';
    var modHon = esHon ? (w.honorariosModalidad || 'mensual') : null;

    // Etiqueta y monto referencial para tarjetas pendientes
    var pendienteMonto, pendienteLabel;
    if(esHon && modHon === 'diario'){
      // Honorarios diario sin liquidación todavía: no sabemos los días.
      // Mostramos la tarifa diaria como referencia (con la etiqueta correcta
      // según el acuerdo: bruto = "tarifa bruta", líquido = "tarifa líquida").
      pendienteMonto = w.honorariosTarifaDiaria || 0;
      pendienteLabel = (w.honorariosAcuerdo === 'liquido')
        ? 'tarifa diaria (líquido)'
        : 'tarifa diaria';
    } else if(esHon){
      // Honorarios mensual: liquidar() en modo "ligero" para obtener el monto
      // de la boleta (que en escenarios C/D es la inversa del monto pactado).
      var refMonto = w.sueldoBase || 0;
      var refLabel = 'monto referencial';
      try {
        var liqRef = liquidar({ worker: w, biz: biz });
        if(liqRef && liqRef.descuentos && liqRef.descuentos.honorariosRetencion){
          refMonto = liqRef.descuentos.honorariosRetencion.montoBoleta || refMonto;
          refLabel = 'boleta a emitir';
        }
      } catch(e){ /* fallback a sueldoBase */ }
      pendienteMonto = refMonto;
      pendienteLabel = refLabel;
    } else {
      pendienteMonto = w.sueldoBase;
      pendienteLabel = 'sueldo base';
    }

    var montoLinea = liquidada
      ? '<div class="rem-card-amount">' + _remMoney(item.liquidacion.liquido) + '</div>' +
        '<div class="rem-card-amount-label">' + (esHon ? 'líquido del trabajador' : 'líquido') + '</div>'
      : '<div class="rem-card-amount pending">' + _remMoney(pendienteMonto) + '</div>' +
        '<div class="rem-card-amount-label">' + pendienteLabel + '</div>';

    // Meta line: en honorarios omitimos AFP (no aplica)
    var metaLinea = esHon
      ? esc(w.cargo || '') + (w.cargo ? ' · ' : '') + 'Honorarios'
      : esc(w.cargo || '') + (w.cargo ? ' · ' : '') + 'AFP ' + esc(w.afp || '—');

    // Nota de la tarjeta: en honorarios la nota informativa del escenario;
    // en dependientes la advertencia de salario si corresponde.
    var notaCard = esHon
      ? ((typeof honorariosNotaHTML === 'function') ? honorariosNotaHTML(w) : '')
      : ((typeof salarioNotaHTML === 'function') ? salarioNotaHTML(w, biz) : '');

    html +=
      '<div class="rem-card" data-wid="' + w.id + '" data-status="' + item.status + '">' +
        '<div class="w-avatar">' + iniciales + '</div>' +
        '<div class="rem-card-info">' +
          '<div class="w-name">' + esc(w.nombre) + '</div>' +
          '<div class="w-meta">' + metaLinea + '</div>' +
          notaCard +
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
// remAbrirTrabajador vive en liquidacion-ui.js (Hito 3.D Pase A).
// La versión placeholder que vivía aquí fue retirada en el barrido del Paso 2.

// Liquidar todos los pendientes del mes.
// Flujo:
//   1. Clasificamos quiénes se pueden liquidar y quiénes no (sin tocar nada).
//   2. Mostramos un modal de confirmación con el detalle.
//   3. Sólo si el usuario confirma, ejecutamos las liquidaciones.
function remLiquidarTodos(){
  var biz = getBiz();
  if(!biz) return;
  var status = getMonthStatus(_remPeriodo);
  if(!status || status.cerrada) return;

  var pendientes = status.items.filter(function(i){ return i.status === 'pendiente'; });
  if(pendientes.length === 0){ toast('No hay pendientes'); return; }

  // ── Paso 1: clasificación (sin efectos) ──
  var liquidables = [];
  var preFallidos = [];
  pendientes.forEach(function(item){
    var w = item.worker;
    var esDependiente = w.contrato !== 'honorarios';
    var esHonDiario   = w.contrato === 'honorarios' && (w.honorariosModalidad || 'mensual') === 'diario';

    if(esHonDiario){
      preFallidos.push({ nombre: w.nombre, motivo: 'requiere ingresar días manualmente' });
      return;
    }
    if(!w.sueldoBase || w.sueldoBase <= 0){
      preFallidos.push({ nombre: w.nombre, motivo: 'sin sueldo base' });
      return;
    }
    if(esDependiente && !w.afp){
      preFallidos.push({ nombre: w.nombre, motivo: 'falta AFP' });
      return;
    }
    if(esDependiente && !w.salud){
      preFallidos.push({ nombre: w.nombre, motivo: 'falta previsión de salud' });
      return;
    }
    liquidables.push(w);
  });

  // ── Caso A: nadie se puede liquidar ──
  if(liquidables.length === 0){
    var cuerpoNada;
    if(preFallidos.length === 1){
      // Personalizamos cuando es uno solo: queda mucho más natural.
      var f = preFallidos[0];
      cuerpoNada = f.nombre + ' no puede procesarse automáticamente: ' + f.motivo + '. Ábrelo desde la lista para liquidarlo manualmente.';
    } else {
      cuerpoNada = 'Ninguno de los pendientes puede procesarse automáticamente: ' + _listarDetalle(preFallidos) + '. Abre cada uno desde la lista para liquidarlo manualmente.';
    }
    showConfirmModal('Nada para liquidar en lote', cuerpoNada, function(){ closeConfirmModal(); });
    var abNada = document.getElementById('confirm-action-btn');
    if(abNada){ abNada.textContent = 'Entendido'; abNada.style.background = 'var(--accent)'; abNada.style.borderColor = 'var(--accent)'; }
    return;
  }

  // ── Caso B: hay liquidables. Pedir confirmación previa con el detalle ──
  var n = liquidables.length;
  var nombresOk = _listarNombres(liquidables.map(function(w){ return w.nombre; }));
  var verbo = n === 1 ? 'Se generará' : 'Se generarán';
  var cuerpo = verbo + ' ' + n + ' ' + _palabraLiquidacion(n) + ' para ' + nombresOk + '.';
  if(preFallidos.length > 0){
    cuerpo += ' Quedará' + (preFallidos.length === 1 ? '' : 'n') + ' fuera por datos incompletos: ' + _listarDetalle(preFallidos) + '.';
  }
  cuerpo += ' Podrás revisar y editar cada liquidación después.';

  showConfirmModal('Liquidar pendientes', cuerpo, function(){
    _remEjecutarLiquidarTodos(liquidables, preFallidos);
  });
  var ab = document.getElementById('confirm-action-btn');
  if(ab){
    ab.textContent = 'Generar liquidaciones';
    ab.style.background = 'var(--accent)';
    ab.style.borderColor = 'var(--accent)';
  }
}

// Ejecutor real del batch — sólo se llama cuando el usuario confirma.
function _remEjecutarLiquidarTodos(liquidables, preFallidos){
  var biz = getBiz();
  if(!biz) return;
  var liquidados = 0;
  var erroresCalc = [];

  liquidables.forEach(function(w){
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
      erroresCalc.push({ nombre: w.nombre, motivo: 'error de cálculo' });
    }
  });

  save(db);
  renderRemuneraciones();

  var totalFallidos = preFallidos.concat(erroresCalc);
  if(totalFallidos.length === 0){
    var verboOk = liquidados === 1 ? 'Se liquidó a' : 'Se liquidaron';
    toast(verboOk + ' ' + liquidados + ' ' + _palabraTrabajador(liquidados));
    return;
  }
  // Hubo casos no procesados (preFallidos o erroresCalc) — informar.
  var total = liquidados + totalFallidos.length;
  var verboMix = liquidados === 1 ? 'Se liquidó a' : 'Se liquidaron';
  var fraseFallidos = totalFallidos.length === 1
    ? 'Quedó pendiente: ' + _listarDetalle(totalFallidos)
    : 'Quedaron pendientes: ' + _listarDetalle(totalFallidos);
  showConfirmModal(
    'Resumen de la liquidación',
    verboMix + ' ' + liquidados + ' de ' + total + ' ' + _palabraTrabajador(total) + '. ' +
    fraseFallidos + '.',
    function(){ closeConfirmModal(); }
  );
  var ab2 = document.getElementById('confirm-action-btn');
  if(ab2){ ab2.textContent = 'Entendido'; ab2.style.background = 'var(--accent)'; ab2.style.borderColor = 'var(--accent)'; }
}

function remCerrar(){
  closeMonth(_remPeriodo, function(){ renderRemuneraciones(); });
}

function remReabrir(){
  reopenMonth(_remPeriodo, function(){ renderRemuneraciones(); });
}
