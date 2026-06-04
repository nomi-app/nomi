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

  // ── Adaptar UI según tipo de contrato ──
  var esHon = w.contrato === 'honorarios';
  var honMod = esHon ? (w.honorariosModalidad || 'mensual') : null;

  // Header: rebrandear para honorarios
  if(esHon){
    document.getElementById('lq-eyebrow').textContent = 'Pago de honorarios \u00b7 ' + _remPeriodoLabel(periodo);
  }

  // Nota legal interna (sólo honorarios)
  var notaHon = document.getElementById('lq-hon-nota');
  if(notaHon) notaHon.style.display = esHon ? 'block' : 'none';

  // Bloque días trabajados (sólo honorarios diarios)
  var secDias = document.getElementById('lq-section-dias');
  if(secDias) secDias.style.display = (esHon && honMod === 'diario') ? 'block' : 'none';

  // En honorarios diario el bruto no se ingresa: se calcula desde tarifa × días.
  // Ocultamos el campo lq-sueldo para que no haya dos lugares donde ingresar el mismo dato.
  var sueldoField = document.getElementById('lq-sueldo').closest('.field');
  if(sueldoField) sueldoField.style.display = (esHon && honMod === 'diario') ? 'none' : '';

  // Poblar tarifa diaria y etiquetas según el tipo de acuerdo
  if(esHon && honMod === 'diario'){
    var tarifaLabel = document.getElementById('lq-hon-tarifa-label');
    if(tarifaLabel){
      var tarifa = w.honorariosTarifaDiaria || 0;
      tarifaLabel.textContent = '$' + Math.round(tarifa).toLocaleString('es-CL');
    }
    // Etiquetas dinámicas: "bruto" o "líquido" según el acuerdo
    var acDia   = w.honorariosAcuerdo || 'bruto';
    var esLiqDia = acDia === 'liquido';
    var tarTit = document.getElementById('lq-hon-tarifa-titulo');
    var totTit = document.getElementById('lq-hon-total-titulo');
    if(tarTit) tarTit.textContent = esLiqDia ? 'Tarifa diaria pactada (líquido)' : 'Tarifa diaria pactada (bruto)';
    if(totTit) totTit.textContent = esLiqDia ? 'Líquido del mes'                  : 'Bruto del mes';
    // Si hay liquidación existente, restaurar días; si no, resetear a 0
    var diasInp = document.getElementById('lq-hon-dias');
    if(diasInp){
      diasInp.value = (existente && existente.haberes && existente.haberes.diasTrabajados)
        ? existente.haberes.diasTrabajados
        : '';
    }
  }

  // Secciones que se muestran/ocultan según dependiente/honorarios
  document.getElementById('lq-section-grat').style.display       = esHon ? 'none' : '';
  document.getElementById('lq-section-comisiones').style.display = esHon ? 'none' : '';
  document.getElementById('lq-section-otros-imp').style.display  = esHon ? 'none' : '';
  document.getElementById('lq-section-no-imp').style.display     = esHon ? 'none' : '';

  // Etiqueta del campo principal:
  //   - dependientes:        "Sueldo base"
  //   - honorarios bruto:    "Monto bruto del mes"
  //   - honorarios líquido:  "Monto líquido del mes"
  // (En diario el campo está oculto, así que esto sólo afecta a mensual.)
  var tituloBruto = document.getElementById('lq-titulo-bruto');
  if(tituloBruto){
    if(!esHon){
      tituloBruto.textContent = 'Sueldo base';
    } else {
      var acMes = w.honorariosAcuerdo || 'bruto';
      tituloBruto.textContent = acMes === 'liquido' ? 'Monto líquido del mes' : 'Monto bruto del mes';
    }
  }

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
  var esHon = _liqWorker && _liqWorker.contrato === 'honorarios';
  if(_liqExistia){
    btn.textContent = 'Guardar cambios';
  } else if(esHon){
    btn.textContent = 'Validar pago';
  } else {
    btn.textContent = 'Guardar y liquidar';
  }
}

function closeLiquidacion(force){
  if(_liqDirty && !force){
    showConfirmModal(
      'Cambios sin guardar',
      'Has modificado la liquidación pero no la has guardado. ¿Quieres cerrar y descartar los cambios?',
      function(){
        closeConfirmModal();
        closeLiquidacion(true);
      },
      'danger',
      'Descartar y cerrar'
    );
    return;
  }
  document.getElementById('lq-panel').style.display = 'none';
  _liqWorker = null; _liqPeriodo = null; _liqDirty = false; _liqResult = null; _liqOtros = [];
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
  var comisiones = parseFloat(document.getElementById('lq-comisiones').value) || 0;
  var otrosImp   = parseFloat(document.getElementById('lq-otros-imp').value) || 0;
  var noImp      = _readNoImp();

  // Honorarios diario: el motor calcula bruto = tarifa × días internamente.
  // No leemos lq-sueldo (está oculto). Pasamos sólo diasTrabajados.
  var esHonDiario = _liqWorker.contrato === 'honorarios'
                    && (_liqWorker.honorariosModalidad || 'mensual') === 'diario';
  var opts = {
    worker: _liqWorker, biz: biz, periodo: _liqPeriodo,
    comisiones: comisiones,
    otrosImponibles: otrosImp,
    otrosNoImponibles: noImp.total,
  };
  if(esHonDiario){
    var diasInp = document.getElementById('lq-hon-dias');
    opts.diasTrabajados = diasInp ? (parseFloat(diasInp.value) || 0) : 0;
  } else {
    opts.sueldoBase = parseFloat(document.getElementById('lq-sueldo').value) || 0;
  }

  var r = liquidar(opts);
  r.haberes.noImponiblesBreakdown = noImp.breakdown;
  // (El motor ya persiste diasTrabajados, tarifaDiaria y modalidad en r.haberes desde Bloque 1.2)

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
    dhtml += _liqHonorariosHTML(r);
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
  if(!esHon){
    dhtml += '<div class="lq-row lq-total-row"><span>Total descuentos</span><span class="lq-amount">' + _money(r.descuentos.totalDescuentos) + '</span></div>';
  }
  dEl.innerHTML = dhtml;

  document.getElementById('lq-liquido-monto').textContent = _money(r.liquido);

  // Label del bloque líquido: en honorarios se llama distinto
  var liqLbl = document.querySelector('.lq-liquido-label');
  if(liqLbl){
    liqLbl.textContent = esHon ? 'Líquido del trabajador' : 'Líquido a pagar';
  }

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

// Cuando el usuario cambia los días trabajados (honorarios diario),
// actualiza automáticamente el monto bruto y recalcula.
function liqHonDiasChange(){
  if(!_liqWorker || _liqWorker.contrato !== 'honorarios') return;
  var honMod = _liqWorker.honorariosModalidad || 'mensual';
  if(honMod !== 'diario') return;
  var dias   = parseFloat(document.getElementById('lq-hon-dias').value) || 0;
  var tarifa = _liqWorker.honorariosTarifaDiaria || 0;
  var bruto  = dias * tarifa;
  var brutoCalcEl = document.getElementById('lq-hon-bruto-calc');
  if(brutoCalcEl) brutoCalcEl.textContent = '$' + Math.round(bruto).toLocaleString('es-CL');
  // Nota: ya no escribimos en lq-sueldo. El motor recibe diasTrabajados
  // directamente desde recalcLiquidacion y calcula tarifa × días internamente.
  liqMarkDirty();
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
  // Honorarios diario: requiere días > 0 para guardar
  if(_liqWorker.contrato === 'honorarios'
     && (_liqWorker.honorariosModalidad || 'mensual') === 'diario'
     && (!_liqResult.haberes.diasTrabajados || _liqResult.haberes.diasTrabajados <= 0)){
    toast('Ingresa los días trabajados antes de guardar');
    var diasInp = document.getElementById('lq-hon-dias');
    if(diasInp) diasInp.focus();
    return;
  }
  if(_liqExistia){
    // Editando: pedir confirmación primero. Después savePayroll pedirá PIN (si hay).
    showConfirmModal(
      'Editar liquidación creada',
      'Estás modificando una liquidación ya generada para ' + _liqWorker.nombre + ' en ' + _remPeriodoLabel(_liqPeriodo) + '. ¿Confirmas los cambios?',
      function(){
        closeConfirmModal();
        _ejecutarGuardado();
      },
      'primary',
      'Confirmar cambios'
    );
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
    },
    'danger',
    'Eliminar'
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


// ════════════════════════════════════════════════════════════
// 3.D Paso 2C — Bloque de descuentos para honorarios
// ════════════════════════════════════════════════════════════
// Construye el HTML completo del bloque de descuentos cuando contrato = honorarios.
// Incluye:
//   1. Las tres líneas de pago (Boleta / Pago al trabajador / Pago al SII)
//   2. Línea de tasa y escenario
//   3. Nota narrativa explicando el escenario
//   4. Alerta de verificación contra el SII (sólo escenarios B y D)

function _liqHonorariosHTML(r){
  var h = r.descuentos.honorariosRetencion;
  var esc_  = (typeof esc === 'function') ? esc : function(s){ return s; };

  // Etiqueta de la tasa: "(15,25% — Ley 21.133)" formateando con coma decimal
  var tasaTxt = String(h.tasa).replace('.', ',');

  // ── Tres líneas siempre visibles ──
  var html = '';
  html +=
    '<div class="lq-row">' +
      '<span>Monto de la boleta</span>' +
      '<span class="lq-amount">' + _money(h.montoBoleta) + '</span>' +
    '</div>';
  html +=
    '<div class="lq-row">' +
      '<span>Pago al trabajador</span>' +
      '<span class="lq-amount" style="color:var(--success)">' + _money(h.pagoTrabajador) + '</span>' +
    '</div>';
  html +=
    '<div class="lq-row">' +
      '<span>Pago al SII</span>' +
      '<span class="lq-amount' + (h.pagoSII > 0 ? ' lq-neg' : '') + '">' + _money(h.pagoSII) + '</span>' +
    '</div>';

  // ── Línea de tasa y escenario ──
  html +=
    '<div class="lq-row lq-sub">' +
      '<span>Retención SII (Ley 21.133)</span>' +
      '<span>' + tasaTxt + '% · ' + _money(h.monto) + '</span>' +
    '</div>';

  // ── Nota narrativa por escenario ──
  html += '<div style="margin-top:10px;padding:10px 12px;background:var(--bg2);border-left:3px solid var(--accent);border-radius:4px;font-size:11px;line-height:1.55;color:var(--text2)">';
  html += _liqHonNotaEscenario(h);
  html += '</div>';

  // ── Alerta de verificación contra el SII (sólo B y D: empresa retiene) ──
  if(h.quienRetiene === 'empleador'){
    html += '<div style="margin-top:10px;padding:10px 12px;background:rgba(212,150,40,.08);border:1px solid rgba(212,150,40,.25);border-radius:4px;font-size:11px;line-height:1.55;color:var(--text2)">';
    html += '<div style="font-weight:600;color:var(--gold);margin-bottom:4px">⚠ Obligación tributaria mensual</div>';
    html += 'La empresa debe declarar la retención de <strong>' + _money(h.pagoSII) + '</strong> en el ';
    html += '<strong>Formulario 29 línea 61 (código 151)</strong>, hasta el día 12 del mes siguiente ';
    html += '(20 si se declara por internet). Verifica también que la boleta de honorarios emitida en sii.cl ';
    html += 'tenga marcada la opción <em>"el receptor actuará reteniendo"</em>.';
    html += '</div>';
  } else {
    // Trabajador retiene (A y C): nota informativa, sin alerta
    html += '<div style="margin-top:10px;padding:10px 12px;background:var(--bg2);border:1px solid var(--border);border-radius:4px;font-size:11px;line-height:1.55;color:var(--text3)">';
    html += '<strong style="color:var(--text2)">ℹ Sin obligación tributaria para la empresa.</strong> ';
    html += 'El trabajador declara y paga la retención de <strong>' + _money(h.monto) + '</strong> ';
    html += 'mediante PPM en su propio Formulario 29. Verifica que la boleta emitida en sii.cl ';
    html += 'tenga marcada la opción <em>"el emisor declarará el PPM"</em>.';
    html += '</div>';
  }

  return html;
}

// Texto narrativo según escenario A/B/C/D
function _liqHonNotaEscenario(h){
  var esc_ = (typeof esc === 'function') ? esc : function(s){ return s; };
  switch(h.escenario){
    case 'A':
      // bruto + trabajador retiene
      return '<strong style="color:var(--text)">Acuerdo en bruto, retiene el trabajador.</strong> ' +
             'Pactaste el valor de la boleta. La empresa le paga al trabajador el monto completo (' + _money(h.pagoTrabajador) + ') ' +
             'y el trabajador declara la retención en su PPM mensual. Líquido final del trabajador: ' + _money(h.pagoTrabajador - h.monto) + '.';
    case 'B':
      // bruto + empleador retiene
      return '<strong style="color:var(--text)">Acuerdo en bruto, retiene la empresa.</strong> ' +
             'Pactaste el valor de la boleta. La empresa retiene del pago y le entrega al trabajador el líquido (' + _money(h.pagoTrabajador) + '). ' +
             'La empresa entera la retención (' + _money(h.pagoSII) + ') al SII por su cuenta.';
    case 'C':
      // líquido + trabajador retiene
      return '<strong style="color:var(--text)">Acuerdo en líquido, retiene el trabajador.</strong> ' +
             'Pactaste lo que el trabajador queda con después del SII. La empresa le paga el monto completo de la boleta (' + _money(h.pagoTrabajador) + ') ' +
             'y el trabajador paga la retención (' + _money(h.monto) + ') vía PPM. Líquido final: ' + _money(h.montoBase) + '. ' +
             '<br><span style="color:var(--text3)">El pago de caja al trabajador es más alto que el líquido pactado: él lo necesita para cubrir su retención.</span>';
    case 'D':
      // líquido + empleador retiene
      return '<strong style="color:var(--text)">Acuerdo en líquido, retiene la empresa.</strong> ' +
             'Pactaste lo que el trabajador recibe en mano. La empresa le paga directamente el líquido (' + _money(h.pagoTrabajador) + ') ' +
             'y entera la retención (' + _money(h.pagoSII) + ') al SII por su cuenta. ' +
             '<br><span style="color:var(--text3)">Costo total para la empresa idéntico al Escenario C: ' + _money(h.montoBoleta) + '.</span>';
    default:
      return '';
  }
}
