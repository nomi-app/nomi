// ════════════════════════════════════════════════════════════
// LIQUIDACION-UI — Calculadora de liquidación (Hito 3.D Parte 1 + Pase A)
// ════════════════════════════════════════════════════════════
// Panel deslizable que se abre al hacer click en una tarjeta de la
// Pantalla 4.1 (Lista del Mes). Permite editar haberes, calcula
// descuentos en vivo y permite guardar/eliminar la liquidación.
//
// Cambios Pase A:
//   • No imponibles: sólo Colación + Movilización + filas dinámicas "Otros"
//   • Botón guardar dinámico: "Guardar y liquidar" (nuevo) / "Guardar cambios" (edición)
//   • Edición: ventana de confirmación antes de sobrescribir
//   • Cierre automático del panel al guardar exitosamente

// ── Estado de la calculadora ──
var _liqWorker   = null;   // trabajador actual
var _liqPeriodo  = null;   // 'YYYY-MM'
var _liqDirty    = false;  // hay cambios sin guardar
var _liqResult   = null;   // último resultado calculado de liquidar()
var _liqExistia  = false;  // ¿ya había liquidación guardada al abrir?
var _liqOtros    = [];     // filas dinámicas: [{label,monto}]

// ════════════════════════════════
// APERTURA Y CIERRE
// ════════════════════════════════

function openLiquidacion(workerId, periodo){
  var biz = getBiz();
  if(!biz) return;
  var w = biz.workers.find(function(x){ return x.id === workerId; });
  if(!w){ toast('Trabajador no encontrado'); return; }

  _liqWorker  = w;
  _liqPeriodo = periodo;
  _liqDirty   = false;
  _liqOtros   = [];

  var existente = (typeof getPayroll === 'function') ? getPayroll(periodo, w.id) : null;
  _liqExistia = !!existente;

  // Prellenar / restaurar inputs
  if(existente){
    document.getElementById('lq-sueldo').value      = existente.haberes.sueldoBase;
    document.getElementById('lq-comisiones').value  = existente.haberes.comisiones || '';
    document.getElementById('lq-otros-imp').value   = existente.haberes.otrosImponibles || '';
    var bd = existente.haberes.noImponiblesBreakdown || {};
    document.getElementById('lq-ni-colacion').value     = bd.colacion || '';
    document.getElementById('lq-ni-movilizacion').value = bd.movilizacion || '';
    // Restaurar filas dinámicas (formato nuevo: array; soporta formato viejo)
    if(Array.isArray(bd.otros)){
      _liqOtros = bd.otros.slice();
    } else if(bd.otros){
      // Migración de formato viejo (bd.otros era número, bd.otros_label el texto)
      _liqOtros = [{ label: bd.otros_label || 'Otros', monto: bd.otros }];
    }
  } else {
    document.getElementById('lq-sueldo').value     = sueldoBaseEfectivo(w, biz);
    document.getElementById('lq-comisiones').value = '';
    document.getElementById('lq-otros-imp').value  = '';
    document.getElementById('lq-ni-colacion').value     = '';
    document.getElementById('lq-ni-movilizacion').value = '';
    // Prellenar haberes recurrentes del trabajador
    if(Array.isArray(w.haberesRecurrentes) && w.haberesRecurrentes.length){
      _liqOtros = w.haberesRecurrentes
        .filter(function(r){ return r && r.label && (parseFloat(r.monto) || 0) > 0; })
        .map(function(r){ return { label: r.label, monto: parseFloat(r.monto) || 0 }; });
    }
  }

  // Header
  document.getElementById('lq-eyebrow').textContent = 'Liquidación · ' + _remPeriodoLabel(periodo);
  document.getElementById('lq-title').textContent = w.nombre;

  // Honorarios: simplificar UI (versión final llegará en Pase C; por ahora oculta lo que no aplica)
  var esHon = w.contrato === 'honorarios';
  document.getElementById('lq-section-grat').style.display       = esHon ? 'none' : '';
  document.getElementById('lq-section-comisiones').style.display = esHon ? 'none' : '';
  document.getElementById('lq-section-otros-imp').style.display  = esHon ? 'none' : '';
  document.getElementById('lq-section-no-imp').style.display     = esHon ? 'none' : '';
  document.getElementById('lq-titulo-bruto').textContent = esHon ? 'Monto bruto de honorarios' : 'Sueldo base';

  // Botón eliminar visible sólo si ya existía
  document.getElementById('lq-delete-btn').style.display = _liqExistia ? '' : 'none';

  // Texto del botón guardar según contexto
  _actualizarBotonGuardar();

  // Render dinámico de filas y cálculo
  renderOtrosRows();
  recalcLiquidacion();

  document.getElementById('lq-panel').style.display = 'block';
}

function _actualizarBotonGuardar(){
  var btn = document.getElementById('lq-save-btn');
  if(!btn) return;
  btn.textContent = _liqExistia ? 'Guardar cambios' : 'Guardar y liquidar';
}

function closeLiquidacion(force){
  if(_liqDirty && !force){
    showConfirmModal(
      'Cambios sin guardar',
      'Has modificado la liquidación pero no la has guardado. ¿Quieres cerrar y descartar los cambios?',
      function(){
        closeConfirmModal();
        closeLiquidacion(true);
      }
    );
    var ab = document.getElementById('confirm-action-btn');
    if(ab){ ab.textContent = 'Descartar y cerrar'; ab.style.background = 'var(--danger)'; ab.style.borderColor = 'var(--danger)'; }
    return;
  }
  document.getElementById('lq-panel').style.display = 'none';
  _liqWorker = null; _liqPeriodo = null; _liqDirty = false; _liqResult = null; _liqOtros = [];
  var ab2 = document.getElementById('confirm-action-btn');
  if(ab2){ ab2.textContent = 'Eliminar'; ab2.style.background = 'var(--danger)'; ab2.style.borderColor = 'var(--danger)'; }
}


// ════════════════════════════════
// FILAS DINÁMICAS DE "OTROS"
// ════════════════════════════════

function renderOtrosRows(){
  var cont = document.getElementById('lq-otros-rows');
  if(!cont) return;
  var html = '';
  _liqOtros.forEach(function(row, idx){
    html +=
      '<div class="lq-otros-row" data-idx="' + idx + '">' +
        '<input class="input" type="text" placeholder="Etiqueta" value="' + esc(row.label || '') + '" oninput="liqUpdateOtroLabel(' + idx + ', this.value)" style="font-size:12px;flex:1"/>' +
        '<div style="position:relative;flex:0 0 130px">' +
          '<span class="lq-noimp-peso">$</span>' +
          '<input class="input" type="number" placeholder="0" value="' + (row.monto || '') + '" oninput="liqUpdateOtroMonto(' + idx + ', this.value)"/>' +
        '</div>' +
        '<button class="btn btn-ghost btn-icon btn-sm" onclick="liqEliminarOtro(' + idx + ')" title="Eliminar" style="color:var(--danger);flex-shrink:0">✕</button>' +
      '</div>';
  });
  cont.innerHTML = html;
}

function liqAgregarOtro(){
  _liqOtros.push({ label: '', monto: 0 });
  renderOtrosRows();
  liqMarkDirty();
}

function liqEliminarOtro(idx){
  _liqOtros.splice(idx, 1);
  renderOtrosRows();
  liqMarkDirty();
}

function liqUpdateOtroLabel(idx, val){
  if(_liqOtros[idx]) _liqOtros[idx].label = val;
  liqMarkDirty();
}

function liqUpdateOtroMonto(idx, val){
  if(_liqOtros[idx]) _liqOtros[idx].monto = parseFloat(val) || 0;
  liqMarkDirty();
}


// ════════════════════════════════
// CÁLCULO EN VIVO
// ════════════════════════════════

function _readNoImp(){
  var breakdown = {};
  var total = 0;
  var col = parseFloat(document.getElementById('lq-ni-colacion').value) || 0;
  var mov = parseFloat(document.getElementById('lq-ni-movilizacion').value) || 0;
  if(col > 0){ breakdown.colacion = col; total += col; }
  if(mov > 0){ breakdown.movilizacion = mov; total += mov; }
  var otrosArr = [];
  _liqOtros.forEach(function(row){
    var monto = parseFloat(row.monto) || 0;
    if(monto > 0){
      otrosArr.push({ label: row.label || 'Otros', monto: monto });
      total += monto;
    }
  });
  if(otrosArr.length) breakdown.otros = otrosArr;
  return { total: total, breakdown: breakdown };
}

function recalcLiquidacion(){
  if(!_liqWorker) return;
  var biz = getBiz();
  var sueldoBase = parseFloat(document.getElementById('lq-sueldo').value) || 0;
  var comisiones = parseFloat(document.getElementById('lq-comisiones').value) || 0;
  var otrosImp   = parseFloat(document.getElementById('lq-otros-imp').value) || 0;
  var noImp      = _readNoImp();

  var r = liquidar({
    worker: _liqWorker, biz: biz, periodo: _liqPeriodo,
    sueldoBase: sueldoBase, comisiones: comisiones,
    otrosImponibles: otrosImp, otrosNoImponibles: noImp.total,
  });
  r.haberes.noImponiblesBreakdown = noImp.breakdown;

  _liqResult = r;
  _renderLiquidacionResult(r);
}

function _money(n){ return '$' + Math.round(n || 0).toLocaleString('es-CL'); }

function _renderLiquidacionResult(r){
  var esHon = r.esHonorarios;

  if(!esHon){
    document.getElementById('lq-grat-monto').textContent = _money(r.haberes.gratificacion);
    document.getElementById('lq-grat-label').textContent = r.haberes.gratificacionEtiqueta;
  }
  document.getElementById('lq-total-haberes').textContent = _money(r.haberes.totalHaberes);

  var dEl = document.getElementById('lq-descuentos-body');
  var dhtml = '';
  if(esHon){
    dhtml +=
      '<div class="lq-row">' +
        '<span>Retención SII (Ley 21.133)</span>' +
        '<span class="lq-amount lq-neg">' + _money(r.descuentos.honorariosRetencion.monto) + '</span>' +
      '</div>' +
      '<div class="lq-row lq-sub">' +
        '<span>Tasa</span>' +
        '<span>' + r.descuentos.honorariosRetencion.tasa + '%</span>' +
      '</div>';
  } else {
    if(r.descuentos.afp.aplica){
      dhtml += '<div class="lq-row"><span>AFP ' + (r.descuentos.afp.nombre || '') + ' (' + r.descuentos.afp.tasa + '%)</span><span class="lq-amount lq-neg">' + _money(r.descuentos.afp.monto) + '</span></div>';
    }
    if(r.descuentos.salud.aplica){
      dhtml += '<div class="lq-row"><span>' + esc(r.descuentos.salud.info.descripcion) + '</span><span class="lq-amount lq-neg">' + _money(r.descuentos.salud.monto) + '</span></div>';
    }
    if(r.descuentos.cesantia.aplica && r.descuentos.cesantia.monto > 0){
      dhtml += '<div class="lq-row"><span>Seguro de cesantía (' + r.descuentos.cesantia.tasa + '%)</span><span class="lq-amount lq-neg">' + _money(r.descuentos.cesantia.monto) + '</span></div>';
    }
    if(r.descuentos.impuestoUnico.aplica){
      dhtml += '<div class="lq-row"><span>Impuesto único 2ª categoría</span><span class="lq-amount lq-neg">' + _money(r.descuentos.impuestoUnico.monto) + '</span></div>';
    } else if(!esHon){
      dhtml += '<div class="lq-row lq-sub"><span>Impuesto único 2ª categoría</span><span>Exento</span></div>';
    }
  }
  dhtml += '<div class="lq-row lq-total-row"><span>Total descuentos</span><span class="lq-amount">' + _money(r.descuentos.totalDescuentos) + '</span></div>';
  dEl.innerHTML = dhtml;

  document.getElementById('lq-liquido-monto').textContent = _money(r.liquido);

  if(!esHon && r.imponible.topeAplicado){
    document.getElementById('lq-tope-aviso').style.display = '';
    document.getElementById('lq-tope-monto').textContent = _money(r.imponible.topePesos);
  } else {
    document.getElementById('lq-tope-aviso').style.display = 'none';
  }
}

function liqMarkDirty(){
  _liqDirty = true;
  recalcLiquidacion();
}


// ════════════════════════════════
// DESGLOSE COMPLETO
// ════════════════════════════════

function openLiquidacionDesglose(){
  if(!_liqResult) return;
  var html = '';
  (_liqResult.pasos || []).forEach(function(p){
    if(p.esTotal){
      html += '<div class="lqd-paso lqd-total"><div class="lqd-titulo">' + esc(p.titulo) + '</div><div class="lqd-monto">' + _money(p.monto) + '</div></div>';
    } else {
      var signo = p.monto < 0 ? 'neg' : (p.monto > 0 ? 'pos' : 'cero');
      html += '<div class="lqd-paso"><div style="flex:1"><div class="lqd-titulo">' + esc(p.titulo) + '</div>' + (p.detalle ? '<div class="lqd-detalle">' + esc(p.detalle) + '</div>' : '') + '</div><div class="lqd-monto lqd-' + signo + '">' + _money(p.monto) + '</div></div>';
    }
  });
  document.getElementById('lqd-body').innerHTML = html;
  document.getElementById('lqd-overlay').style.display = 'flex';
}

function closeLiquidacionDesglose(){
  document.getElementById('lqd-overlay').style.display = 'none';
}


// ════════════════════════════════
// GUARDAR Y ELIMINAR
// ════════════════════════════════

function guardarLiquidacion(){
  if(!_liqResult){ toast('No hay liquidación para guardar'); return; }
  if(_liqExistia){
    // Editando: pedir confirmación primero. Después savePayroll pedirá PIN (si hay).
    showConfirmModal(
      'Editar liquidación creada',
      'Estás modificando una liquidación ya generada para ' + _liqWorker.nombre + ' en ' + _remPeriodoLabel(_liqPeriodo) + '. ¿Confirmas los cambios?',
      function(){
        closeConfirmModal();
        _ejecutarGuardado();
      }
    );
    var ab = document.getElementById('confirm-action-btn');
    if(ab){ ab.textContent = 'Confirmar cambios'; ab.style.background = 'var(--accent)'; ab.style.borderColor = 'var(--accent)'; }
  } else {
    _ejecutarGuardado();
  }
}

function _ejecutarGuardado(){
  savePayroll(_liqResult, function(ok){
    if(ok){
      _liqDirty = false;
      if(typeof renderRemuneraciones === 'function') renderRemuneraciones();
      // Cerrar panel automáticamente al guardar OK (force=true para saltar el chequeo de dirty)
      closeLiquidacion(true);
    }
  });
}

function eliminarLiquidacion(){
  if(!_liqWorker || !_liqPeriodo) return;
  showConfirmModal(
    'Eliminar liquidación',
    'Se eliminará la liquidación de ' + _liqWorker.nombre + ' para ' + _remPeriodoLabel(_liqPeriodo) + '. Esta acción es irreversible.',
    function(){
      closeConfirmModal();
      deletePayroll(_liqPeriodo, _liqWorker.id, function(ok){
        if(ok){
          if(typeof renderRemuneraciones === 'function') renderRemuneraciones();
          closeLiquidacion(true);
        }
      });
    }
  );
}


// ════════════════════════════════
// INTEGRACIÓN CON LA LISTA DEL MES
// ════════════════════════════════

function remAbrirTrabajador(workerId, status){
  if(!_remPeriodo) return;
  openLiquidacion(workerId, _remPeriodo);
}

function liqExportPlaceholder(donde){
  toast(donde + ' disponible en el siguiente hito');
}
