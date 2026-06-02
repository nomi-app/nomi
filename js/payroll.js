// ════════════════════════════════
// PAYROLL ENGINE — Motor de cálculo de remuneraciones
// ════════════════════════════════
// Cálculo canónico de liquidaciones de sueldo en Chile.
// Vigente al ship: mayo 2026. Sin dependencias externas.
//
// El motor NO toca el DOM. Recibe datos, devuelve un objeto desglosado.
// Las pantallas del Hito 3.C/3.D consumen ese objeto. La previsualización
// de la ficha del trabajador (workers.js) se refactoriza en 3.E para
// delegar acá y eliminar la duplicación.
//
// API pública:
//   ensurePayrollParams(biz)
//   liquidar({ worker, biz, periodo, sueldoBase?, comisiones?, otros... })
//   liquidarDesdeLiquido({ worker, biz, liquidoObjetivo, ... })
//   PAYROLL_DEFAULTS  — valores vigentes para nuevos negocios
//
// Convención de unidades:
//   - Topes imponibles se almacenan en UF (estructuralmente correcto).
//     El motor multiplica por UF del mes para obtener pesos.
//   - Tabla de impuesto único se almacena en UTM (estable en el tiempo).
//     El motor multiplica por UTM del mes para obtener pesos.
//   - El usuario solo actualiza UF (mensual) y UTM (mensual). Topes y
//     tabla cambian con frecuencia anual o legal.
// ════════════════════════════════


// ── DEFAULTS VIGENTES (mayo 2026) ──
// Verificables en sii.cl, spensiones.cl, dt.gob.cl.
// El usuario actualiza estos valores desde Configuración cuando cambien.

var PAYROLL_DEFAULTS = {
  imm:        539000,   // IMM desde 1 enero 2026 — Ley N° 21.751
  uf:         39500,    // UF aproximada al ship. Cambia diariamente — el usuario actualiza
  utm:        70588,    // UTM mayo 2026 — SII
  topeUF:     90.0,     // Tope imponible AFP/salud — Superintendencia de Pensiones (vigente desde febrero 2026)
  topeCesUF:  135.2,    // Tope imponible seguro de cesantía
  jornadaCompleta: 42,  // Horas semanales de jornada completa legal. Ley 21.561: 44 (2024), 42 (abr 2026), 40 (abr 2028). Base del cálculo proporcional del mínimo (art. 44 CT). Editable en Configuración.

  // Cesantía: parte trabajador (%). El empleador paga aparte (3% en plazo fijo, 2.4% en indefinido).
  cesantia: {
    indefinido: 0.6,
    fijo:       0.0,    // En plazo fijo el trabajador NO paga cesantía (sólo el empleador 3%)
  },

  // AFP: tasa total deducida del trabajador (10% obligatorio + comisión particular).
  // Valores referenciales al ship — verificar en spensiones.cl.
  afpRates: {
    Habitat:   10.58,
    Capital:   10.44,
    Modelo:    10.58,
    Provida:   10.77,
    Cuprum:    10.58,
    PlanVital: 10.57,
  },

  // Retención SII para boletas de honorarios. Ley 21.133 escalonada.
  // 2025: 14.5% · 2026: 15.25% · 2027: 16% · 2028: 17% (meta final).
  honorariosRetencion: 15.25,

  // Tabla impuesto único de segunda categoría — Art. 43 LIR.
  // Estructura estable expresada en UTM. El motor convierte a pesos con UTM del mes.
  // Fórmula: impuesto = max(0, baseTributable × factor − rebajaUTM × utm)
  impuestoTablaUTM: [
    { desdeUTM:   0.0, hastaUTM:  13.5, factor: 0,     rebajaUTM:  0     },
    { desdeUTM:  13.5, hastaUTM:  30.0, factor: 0.04,  rebajaUTM:  0.54  },
    { desdeUTM:  30.0, hastaUTM:  50.0, factor: 0.08,  rebajaUTM:  1.74  },
    { desdeUTM:  50.0, hastaUTM:  70.0, factor: 0.135, rebajaUTM:  4.49  },
    { desdeUTM:  70.0, hastaUTM:  90.0, factor: 0.23,  rebajaUTM: 11.14  },
    { desdeUTM:  90.0, hastaUTM: 120.0, factor: 0.304, rebajaUTM: 17.80  },
    { desdeUTM: 120.0, hastaUTM: 310.0, factor: 0.35,  rebajaUTM: 23.32  },
    { desdeUTM: 310.0, hastaUTM: Infinity, factor: 0.4, rebajaUTM: 38.82 },
  ],
};


// ════════════════════════════════
// MIGRACIÓN LAZY
// ════════════════════════════════
// Añade los campos nuevos que no existen aún en biz.params.
// NO toca lo que el usuario haya editado. Llamada implícita desde liquidar().

function ensurePayrollParams(biz){
  if(!biz || !biz.params) return;
  var p = biz.params;
  if(p.utm == null)               p.utm = PAYROLL_DEFAULTS.utm;
  if(p.topeUF == null)            p.topeUF = PAYROLL_DEFAULTS.topeUF;
  if(p.topeCesUF == null)         p.topeCesUF = PAYROLL_DEFAULTS.topeCesUF;
  if(p.jornadaCompleta == null)   p.jornadaCompleta = PAYROLL_DEFAULTS.jornadaCompleta;
  if(p.honorariosRetencion == null) p.honorariosRetencion = PAYROLL_DEFAULTS.honorariosRetencion;
  if(!p.impuestoTablaUTM)         p.impuestoTablaUTM = JSON.parse(JSON.stringify(PAYROLL_DEFAULTS.impuestoTablaUTM));

  // Migrar campos de cada trabajador
  if(biz.workers && biz.workers.length){
    biz.workers.forEach(function(w){
      if(!w.salarioModo)         w.salarioModo = 'anclado';
      if(!w.cesantiaModo)        w.cesantiaModo = 'legal';
      if(!w.gratBaseModo)        w.gratBaseModo = 'base_mas_comisiones';
      if(!Array.isArray(w.haberesRecurrentes)) w.haberesRecurrentes = [];

      // 3.D Paso 2 — honorarios: tipo de acuerdo y quién retiene
      if(w.contrato === 'honorarios'){
        if(!w.honorariosAcuerdo)      w.honorariosAcuerdo      = 'bruto';
        if(!w.honorariosQuienRetiene) w.honorariosQuienRetiene = 'trabajador';
      }
    });
  }
}


// ════════════════════════════════
// HELPERS
// ════════════════════════════════

function _round(n){ return Math.round(n); }

function _resolverGratMode(worker, biz){
  var w = (worker && worker.gratificacion) || 'heredar';
  if(w === 'heredar') return (biz && biz.grat) || 'sin_gratificacion';
  return w;
}

function _gratEtiqueta(modo){
  switch(modo){
    case 'mensual':           return 'Mensual anticipada (art. 50)';
    case 'anual':             return 'Anual (no aplica este mes)';
    case 'incluida':          return 'Incluida en sueldo base';
    case 'sin_gratificacion': return 'No aplica';
    default:                  return modo || '—';
  }
}

function _cesRate(contrato, cesRates){
  if(contrato === 'indefinido') return cesRates.indefinido || 0;
  if(contrato === 'plazo_fijo') return cesRates.fijo || 0;
  return 0;
}

function _nowPeriodo(){
  var d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}


// ════════════════════════════════
// SUELDO MÍNIMO — piso legal y modos de salario (art. 44 CT)
// ════════════════════════════════
// Modos (worker.salarioModo):
//   'anclado'     — sigue el piso legal: effective = max(pactado, piso). Default.
//                   Sube cuando el mínimo lo supera, nunca baja (art. 5 CT, irrenunciabilidad).
//   'fijo'        — monto fijo. No se normaliza. Si queda bajo el piso, se avisa pero no se toca.
//   'bajo_minimo' — declarado bajo el mínimo por el dueño. No se toca. Aviso permanente.

// Piso legal mensual para el trabajador, según jornada.
// Jornada completa: IMM. Jornada parcial: IMM × horas / jornadaCompleta (art. 44 inc. 3).
function pisoLegal(worker, biz){
  var p = (biz && biz.params) || {};
  var imm = p.imm || PAYROLL_DEFAULTS.imm;
  var jc  = p.jornadaCompleta || PAYROLL_DEFAULTS.jornadaCompleta;
  if(worker && worker.jornada === 'parcial' && worker.horasSemanales){
    var ratio = worker.horasSemanales / jc;
    if(ratio > 1) ratio = 1; // nunca exceder el IMM completo
    return Math.round(imm * ratio);
  }
  return imm;
}

// Sueldo base efectivo que usa el motor. Aplica la regla del modo de salario.
function sueldoBaseEfectivo(worker, biz){
  var pactado = worker.sueldoBase || 0;
  // Honorarios: piso legal no aplica. El art. 44 CT rige a trabajadores
  // dependientes; los honorarios son 2da categoría (LIR), fuera del CT.
  if(worker && worker.contrato === 'honorarios') return pactado;
  var modo = worker.salarioModo || 'anclado';
  if(modo === 'anclado'){
    return Math.max(pactado, pisoLegal(worker, biz));
  }
  // 'fijo' y 'bajo_minimo' usan el monto pactado tal cual
  return pactado;
}

// ¿El sueldo del trabajador está bajo el piso legal?
// Honorarios: no aplica (régimen 2da categoría, fuera del art. 44 CT).
function bajoMinimo(worker, biz){
  if(worker && worker.contrato === 'honorarios') return false;
  return (worker.sueldoBase || 0) < pisoLegal(worker, biz);
}

// Nota de advertencia para mostrar en ficha y tarjeta (NUNCA en la liquidación).
// Devuelve null si no hay nada que advertir.
function notaSueldo(worker, biz){
  var modo = worker.salarioModo || 'anclado';
  if(modo === 'bajo_minimo'){
    return { tipo: 'bajo_minimo', texto: 'Sueldo inferior al mínimo legal. Configurado manualmente por el responsable.' };
  }
  if(modo === 'fijo' && bajoMinimo(worker, biz)){
    return { tipo: 'fijo_bajo', texto: 'Este sueldo fijo quedó bajo el mínimo vigente tras el último reajuste.' };
  }
  return null;
}

// Aplica las reglas del mínimo a todos los trabajadores al cambiar IMM o jornada.
// Sólo normaliza los 'anclado' que quedaron bajo el piso (hacia arriba, nunca baja).
// Devuelve un reporte de cambios para informar al dueño.
function aplicarReglasIMM(biz){
  if(!biz || !biz.workers) return { normalizados: [] };
  var normalizados = [];
  biz.workers.forEach(function(w){
    // Honorarios: nunca se normalizan al IMM (régimen 2da categoría, fuera del art. 44 CT).
    if(w.contrato === 'honorarios') return;
    if((w.salarioModo || 'anclado') !== 'anclado') return; // fijo y bajo_minimo no se tocan
    var piso = pisoLegal(w, biz);
    var actual = w.sueldoBase || 0;
    if(actual < piso){
      normalizados.push({ nombre: w.nombre, de: actual, a: piso });
      w.sueldoBase = piso;
    }
  });
  return { normalizados: normalizados };
}


// ════════════════════════════════
// COMPONENTES DE CÁLCULO
// ════════════════════════════════

// Gratificación según modalidad y sueldo bruto.
// Sólo la mensual anticipada se incluye en la liquidación del mes.
function calcGratificacion(brutoMonto, modo, imm){
  if(modo === 'mensual'){
    return Math.min(brutoMonto * 0.25, (4.75 * imm) / 12);
  }
  return 0;
}

// AFP: tasa% sobre imponible (la tasa ya incluye comisión particular).
function calcAfp(imponible, afpRatePct){
  return imponible * (afpRatePct / 100);
}

// Fonasa: 7% del imponible.
function calcSaludFonasa(imponible){
  return imponible * 0.07;
}

// Isapre: máximo entre 7% del imponible y precio del plan convertido a pesos.
// Si el plan está en UF, se convierte con UF del mes.
function calcSaludIsapre(imponible, worker, ufDelMes){
  var sieteporciento = imponible * 0.07;
  var planEnPesos;
  if(worker.isapreMoneda === 'uf'){
    planEnPesos = (worker.isapreMonto || 0) * (ufDelMes || 0);
  } else {
    planEnPesos = worker.isapreMonto || 0;
  }
  return Math.max(sieteporciento, planEnPesos);
}

// Seguro de cesantía — parte trabajador. Tope imponible mayor que AFP/salud.
function calcCesantia(imponibleCes, contrato, cesRates){
  return imponibleCes * (_cesRate(contrato, cesRates) / 100);
}

// Impuesto único de segunda categoría — Art. 43 LIR.
// Recibe base tributable en pesos, UTM en pesos, tabla con tramos en UTM.
// Devuelve { monto, tramo, factor, rebaja, baseEnUTM }.
function calcImpuestoUnico(baseTributable, utm, tablaUTM){
  if(baseTributable <= 0 || !utm || utm <= 0){
    return { monto: 0, tramo: -1, factor: 0, rebaja: 0, baseEnUTM: 0 };
  }
  var baseEnUTM = baseTributable / utm;
  for(var i = 0; i < tablaUTM.length; i++){
    var t = tablaUTM[i];
    // Tramo: desdeUTM < baseEnUTM <= hastaUTM
    if(baseEnUTM > t.desdeUTM && baseEnUTM <= t.hastaUTM){
      var rebajaPesos = t.rebajaUTM * utm;
      var impuesto = Math.max(0, baseTributable * t.factor - rebajaPesos);
      return {
        monto: impuesto,
        tramo: i,
        factor: t.factor,
        rebaja: rebajaPesos,
        baseEnUTM: baseEnUTM,
      };
    }
  }
  return { monto: 0, tramo: -1, factor: 0, rebaja: 0, baseEnUTM: baseEnUTM };
}


// ════════════════════════════════
// LIQUIDAR — bruto → líquido
// ════════════════════════════════
// opts = {
//   worker, biz, periodo,
//   sueldoBase?,         // override del sueldo base del trabajador
//   comisiones?,         // 0 por defecto (autopobla desde Hito 4)
//   otrosImponibles?,    // 0 por defecto
//   otrosNoImponibles?,  // 0 por defecto
// }

function liquidar(opts){
  if(!opts || !opts.worker || !opts.biz){
    throw new Error('liquidar: worker y biz son requeridos');
  }
  var worker = opts.worker;
  var biz    = opts.biz;
  ensurePayrollParams(biz);

  var p = biz.params || {};
  var imm        = p.imm        || PAYROLL_DEFAULTS.imm;
  var utm        = p.utm        || PAYROLL_DEFAULTS.utm;
  var uf         = p.uf         || PAYROLL_DEFAULTS.uf;
  var topeUF     = p.topeUF     != null ? p.topeUF     : PAYROLL_DEFAULTS.topeUF;
  var topeCesUF  = p.topeCesUF  != null ? p.topeCesUF  : PAYROLL_DEFAULTS.topeCesUF;
  var impTabla   = p.impuestoTablaUTM || PAYROLL_DEFAULTS.impuestoTablaUTM;
  var cesRates   = p.cesantia   || PAYROLL_DEFAULTS.cesantia;
  var afpRate    = (p.afpRates && p.afpRates[worker.afp]) || 0;
  var honRetRate = p.honorariosRetencion != null ? p.honorariosRetencion : PAYROLL_DEFAULTS.honorariosRetencion;

  var sueldoBase        = opts.sueldoBase != null ? opts.sueldoBase : sueldoBaseEfectivo(worker, biz);
  var comisiones        = opts.comisiones || 0;
  var otrosImponibles   = opts.otrosImponibles || 0;
  var otrosNoImponibles = opts.otrosNoImponibles || 0;
  var periodo           = opts.periodo || _nowPeriodo();

  var esHonorarios = worker.contrato === 'honorarios';

  // ── HONORARIOS: 4 escenarios (acuerdo × quién retiene) ──
  // Eje 1 — Acuerdo:       'bruto'      | 'liquido'
  // Eje 2 — Quién retiene: 'trabajador' | 'empleador'
  //
  //   A: bruto    + trabajador retiene → trabajador declara PPM en F29
  //   B: bruto    + empleador retiene  → empleador declara en F29 línea 61 (cód. 151)
  //   C: líquido  + trabajador retiene → boleta inversa: montoBase / (1 − tasa)
  //   D: líquido  + empleador retiene  → misma boleta que C, distinto destino de la plata
  //
  // En C y D la boleta tiene el mismo monto. El "líquido" es lo que el trabajador
  // queda con después de cumplir su obligación con el SII. La diferencia es de
  // dónde sale cada peso:
  //   C: empresa paga $boleta al trabajador, trabajador paga al SII por su cuenta
  //   D: empresa paga $base al trabajador y $retención al SII directamente
  //   Costo total empresa: C = D = $boleta.

  if(esHonorarios){
    var montoBase    = sueldoBase + comisiones + otrosImponibles + otrosNoImponibles;
    var acuerdo      = worker.honorariosAcuerdo      || 'bruto';
    var quienRetiene = worker.honorariosQuienRetiene || 'trabajador';
    var tasa         = honRetRate / 100;

    // Monto de la boleta (cálculo inverso si acuerdo = líquido)
    var montoBoleta, retencionTotal;
    if(acuerdo === 'bruto'){
      montoBoleta    = montoBase;
      retencionTotal = montoBoleta * tasa;
    } else {
      // 'liquido' — boleta = base / (1 − tasa) para que el trabajador quede con base
      montoBoleta    = montoBase / (1 - tasa);
      retencionTotal = montoBoleta * tasa;
    }

    // Distribución de pagos según quién retiene
    var pagoTrabajador, pagoSII;
    if(quienRetiene === 'empleador'){
      pagoTrabajador = montoBoleta - retencionTotal;
      pagoSII        = retencionTotal;
    } else {
      pagoTrabajador = montoBoleta;
      pagoSII        = 0;
    }

    // Líquido final del trabajador (después de cumplir con el SII)
    var liquidoFinal = (acuerdo === 'liquido') ? montoBase : (montoBoleta - retencionTotal);

    // Identificación del escenario A/B/C/D
    var escenario =
      (acuerdo === 'bruto'   && quienRetiene === 'trabajador') ? 'A' :
      (acuerdo === 'bruto'   && quienRetiene === 'empleador')  ? 'B' :
      (acuerdo === 'liquido' && quienRetiene === 'trabajador') ? 'C' : 'D';

    // Referencia técnica SII según quién retiene
    var refSII = (quienRetiene === 'empleador')
      ? 'F29 línea 61 (cód. 151) — lo declara la empresa'
      : 'PPM en F29 — lo declara el trabajador';

    // Pasos narrativos
    var pasosHon = [];
    pasosHon.push({
      titulo:  'Monto acordado (' + (acuerdo === 'bruto' ? 'bruto' : 'líquido en mano') + ')',
      monto:   _round(montoBase),
      detalle: (acuerdo === 'bruto')
        ? 'Valor pactado de la boleta'
        : 'Valor que el trabajador debe quedar con después de cumplir con el SII',
    });
    if(acuerdo === 'liquido'){
      pasosHon.push({
        titulo:  'Monto de la boleta a emitir',
        monto:   _round(montoBoleta),
        detalle: 'Calculada como $' + _round(montoBase).toLocaleString('es-CL') + ' / (1 − ' + honRetRate + '%) para cerrar al líquido pactado',
      });
    }
    pasosHon.push({
      titulo:  'Retención SII (' + honRetRate + '%)',
      monto:   -_round(retencionTotal),
      detalle: refSII + ' · Ley 21.133',
    });
    pasosHon.push({
      titulo:  'Pago al trabajador',
      monto:   _round(pagoTrabajador),
      detalle: 'Sale de la caja de la empresa',
    });
    if(pagoSII > 0){
      pasosHon.push({
        titulo:  'Pago al SII',
        monto:   _round(pagoSII),
        detalle: 'Sale de la caja de la empresa · ' + refSII,
      });
    } else {
      pasosHon.push({
        titulo:  'Pago al SII',
        monto:   0,
        detalle: 'A cargo del trabajador en su PPM mensual',
      });
    }
    pasosHon.push({
      titulo:  'LÍQUIDO QUE RECIBE EL TRABAJADOR',
      monto:   _round(liquidoFinal),
      esTotal: true,
    });

    return {
      periodo: periodo,
      workerId: worker.id,
      fechaCalculo: new Date().toISOString(),
      esHonorarios: true,
      snapshot: _snapshotSnap(worker, biz, p, sueldoBase, afpRate),
      haberes: {
        sueldoBase:            _round(sueldoBase),
        gratificacion:         0,
        gratificacionEtiqueta: 'No aplica (honorarios)',
        comisiones:            _round(comisiones),
        otrosImponibles:       _round(otrosImponibles),
        otrosNoImponibles:     _round(otrosNoImponibles),
        totalHaberes:          _round(montoBase),
      },
      imponible: { bruto: _round(montoBase), topePesos: 0, topeAplicado: false, imponibleFinal: 0, imponibleCes: 0 },
      descuentos: {
        afp:           { monto: 0, tasa: 0, base: 0, aplica: false },
        salud:         { monto: 0, info: { tipo: 'no_aplica', descripcion: 'No aplica (honorarios)' }, base: 0, aplica: false },
        cesantia:      { monto: 0, tasa: 0, base: 0, aplica: false },
        impuestoUnico: { monto: 0, tramo: -1, factor: 0, rebaja: 0, baseTributable: 0, baseEnUTM: 0, aplica: false },
        honorariosRetencion: {
          // 3.D Paso 2 — campos nuevos
          tasa:           honRetRate,
          acuerdo:        acuerdo,
          quienRetiene:   quienRetiene,
          escenario:      escenario,
          montoBase:      _round(montoBase),
          montoBoleta:    _round(montoBoleta),
          pagoTrabajador: _round(pagoTrabajador),
          pagoSII:        _round(pagoSII),
          // Compatibilidad con UI anterior (Pase C)
          monto:          _round(retencionTotal),
          base:           _round(montoBoleta),
          aplica:         true,
        },
        totalDescuentos: _round(retencionTotal),
      },
      liquido: _round(liquidoFinal),
      pasos: pasosHon,
    };
  }

  // ── DEPENDIENTES: flujo completo ──

  // 1. Gratificación
  var gratMode = _resolverGratMode(worker, biz);
  var gratBaseMode = worker.gratBaseModo || 'base_mas_comisiones';
  var baseGrat = (gratBaseMode === 'solo_base')
    ? sueldoBase
    : (sueldoBase + comisiones + otrosImponibles);
  var gratificacion = calcGratificacion(baseGrat, gratMode, imm);

  // 2. Imponible
  var imponibleSinTope = sueldoBase + gratificacion + comisiones + otrosImponibles;
  var topePesos        = topeUF    * uf;
  var topeCesPesos     = topeCesUF * uf;
  var topeAplicado     = imponibleSinTope > topePesos;
  var imponible        = Math.min(imponibleSinTope, topePesos);
  var imponibleCes     = Math.min(imponibleSinTope, topeCesPesos);

  // 3. AFP
  var descAfp = calcAfp(imponible, afpRate);

  // 4. Salud
  var descSalud = 0;
  var saludInfo = { tipo: 'no_aplica', descripcion: '—' };
  if(worker.salud === 'fonasa'){
    descSalud = calcSaludFonasa(imponible);
    saludInfo = { tipo: 'fonasa', descripcion: 'Fonasa (7% del imponible)' };
  } else if(worker.salud === 'isapre'){
    descSalud = calcSaludIsapre(imponible, worker, uf);
    var planEnPesos = worker.isapreMoneda === 'uf'
      ? (worker.isapreMonto || 0) * uf
      : (worker.isapreMonto || 0);
    var sieteporc = imponible * 0.07;
    saludInfo = {
      tipo: 'isapre',
      nombre: worker.isapreNombre || '',
      moneda: worker.isapreMoneda || 'pesos',
      montoPlan: worker.isapreMonto || 0,
      planEnPesos: planEnPesos,
      sieteporciento: sieteporc,
      descripcion: planEnPesos > sieteporc
        ? 'Isapre — precio del plan (' + (worker.isapreMoneda === 'uf' ? worker.isapreMonto + ' UF' : '$' + (worker.isapreMonto || 0).toLocaleString('es-CL')) + ')'
        : 'Isapre — 7% del imponible (plan inferior al mínimo legal)',
    };
  }

  // 5. Cesantía
  var cesantiaModo = worker.cesantiaModo || 'legal';
  var descCes = (cesantiaModo === 'no_descuenta')
    ? 0
    : calcCesantia(imponibleCes, worker.contrato, cesRates);

  // 6. Impuesto único
  var baseTributable = imponible - descAfp - descSalud - descCes;
  var impInfo = calcImpuestoUnico(baseTributable, utm, impTabla);
  var descImp = impInfo.monto;

  // 7. Totales
  var totalHaberes    = sueldoBase + gratificacion + comisiones + otrosImponibles + otrosNoImponibles;
  var totalDescuentos = descAfp + descSalud + descCes + descImp;
  var liquido         = totalHaberes - totalDescuentos;

  return {
    periodo: periodo,
    workerId: worker.id,
    fechaCalculo: new Date().toISOString(),
    esHonorarios: false,

    snapshot: _snapshotSnap(worker, biz, p, sueldoBase, afpRate),

    haberes: {
      sueldoBase:           _round(sueldoBase),
      gratificacion:        _round(gratificacion),
      gratificacionEtiqueta: _gratEtiqueta(gratMode),
      gratificacionModo:    gratMode,
      comisiones:           _round(comisiones),
      otrosImponibles:      _round(otrosImponibles),
      otrosNoImponibles:    _round(otrosNoImponibles),
      totalHaberes:         _round(totalHaberes),
    },

    imponible: {
      bruto:           _round(imponibleSinTope),
      topePesos:       _round(topePesos),
      topeCesPesos:    _round(topeCesPesos),
      topeAplicado:    topeAplicado,
      imponibleFinal:  _round(imponible),
      imponibleCes:    _round(imponibleCes),
    },

    descuentos: {
      afp: {
        monto:  _round(descAfp),
        tasa:   afpRate,
        nombre: worker.afp || '',
        base:   _round(imponible),
        aplica: afpRate > 0,
      },
      salud: {
        monto:  _round(descSalud),
        info:   saludInfo,
        base:   _round(imponible),
        aplica: !!worker.salud,
      },
      cesantia: {
        monto:    _round(descCes),
        tasa:     _cesRate(worker.contrato, cesRates),
        base:     _round(imponibleCes),
        contrato: worker.contrato,
        aplica:   worker.contrato === 'indefinido' || worker.contrato === 'plazo_fijo',
      },
      impuestoUnico: {
        monto:          _round(descImp),
        tramo:          impInfo.tramo,
        factor:         impInfo.factor,
        rebaja:         _round(impInfo.rebaja),
        baseTributable: _round(baseTributable),
        baseEnUTM:      impInfo.baseEnUTM,
        aplica:         descImp > 0,
      },
      totalDescuentos: _round(totalDescuentos),
    },

    liquido: _round(liquido),

    // Desglose narrativo — alimenta el modal "Desglose completo" en 3.D
    // (diferenciador "transparencia total del cálculo")
    pasos: _construirPasos({
      sueldoBase: sueldoBase, gratificacion: gratificacion, gratMode: gratMode, imm: imm,
      gratBaseMode: gratBaseMode, baseGrat: baseGrat,
      comisiones: comisiones, otrosImponibles: otrosImponibles, otrosNoImponibles: otrosNoImponibles,
      imponibleSinTope: imponibleSinTope, topePesos: topePesos, imponible: imponible, topeAplicado: topeAplicado,
      descAfp: descAfp, afpRate: afpRate, afpNombre: worker.afp,
      descSalud: descSalud, saludInfo: saludInfo,
      descCes: descCes, cesRate: _cesRate(worker.contrato, cesRates), contrato: worker.contrato,
      cesantiaModo: cesantiaModo,
      baseTributable: baseTributable, descImp: descImp, impInfo: impInfo,
      liquido: liquido,
    }),
  };
}


// Snapshot mínimo de parámetros usados — para preservar la liquidación si después cambian los datos.
function _snapshotSnap(worker, biz, p, sueldoBase, afpRate){
  return {
    sueldoBaseUsado: sueldoBase,
    contrato:        worker.contrato,
    jornada:         worker.jornada,
    horasSemanales:  worker.horasSemanales,
    afp:             worker.afp,
    afpRate:         afpRate,
    salud:           worker.salud,
    isapreNombre:    worker.isapreNombre,
    isapreMoneda:    worker.isapreMoneda,
    isapreMonto:     worker.isapreMonto,
    gratModoNegocio: biz.grat,
    gratModoTrabajador: worker.gratificacion,
    imm:             p.imm,
    uf:              p.uf,
    utm:             p.utm,
    topeUF:          p.topeUF,
    topeCesUF:       p.topeCesUF,
  };
}


function _construirPasos(c){
  var pasos = [];
  var fmt = function(n){ return '$' + Math.round(n).toLocaleString('es-CL'); };

  pasos.push({ titulo: 'Sueldo base', monto: _round(c.sueldoBase), detalle: 'Monto pactado en contrato' });

  if(c.gratMode === 'mensual' && c.gratificacion > 0){
    var baseDetalle = c.gratBaseMode === 'solo_base'
      ? 'Calculada sobre sueldo base (' + fmt(c.sueldoBase) + ')'
      : 'Calculada sobre base + comisiones + otros imponibles (' + fmt(c.baseGrat) + ')';
    pasos.push({
      titulo: 'Gratificación mensual',
      monto: _round(c.gratificacion),
      detalle: baseDetalle + '. Mínimo entre 25% y tope legal de 4,75 IMM / 12 = ' + fmt(4.75 * c.imm / 12),
    });
  } else if(c.gratMode === 'anual'){
    pasos.push({ titulo: 'Gratificación', monto: 0, detalle: 'Modalidad anual — se paga al cierre del ejercicio' });
  } else if(c.gratMode === 'incluida'){
    pasos.push({ titulo: 'Gratificación', monto: 0, detalle: 'Incluida en el sueldo base (sin línea separada)' });
  } else {
    pasos.push({ titulo: 'Gratificación', monto: 0, detalle: 'No aplica' });
  }

  if(c.comisiones > 0)        pasos.push({ titulo: 'Comisiones',                 monto: _round(c.comisiones),        detalle: 'Comisiones por venta del período' });
  if(c.otrosImponibles > 0)   pasos.push({ titulo: 'Otros haberes imponibles',   monto: _round(c.otrosImponibles)   });
  if(c.otrosNoImponibles > 0) pasos.push({ titulo: 'Otros haberes no imponibles', monto: _round(c.otrosNoImponibles), detalle: 'No tributan ni cotizan (colación, movilización)' });

  pasos.push({
    titulo: 'Sueldo imponible',
    monto: _round(c.imponible),
    detalle: c.topeAplicado
      ? 'Aplicado tope previsional de ' + fmt(c.topePesos)
      : 'Sin tope aplicado',
  });

  if(c.afpRate > 0){
    pasos.push({
      titulo:  'AFP ' + (c.afpNombre || '—'),
      monto:   -_round(c.descAfp),
      detalle: c.afpRate + '% del imponible',
    });
  }

  if(c.saludInfo && c.saludInfo.tipo !== 'no_aplica'){
    pasos.push({
      titulo:  c.saludInfo.tipo === 'fonasa' ? 'Fonasa' : ('Isapre ' + (c.saludInfo.nombre || '')),
      monto:   -_round(c.descSalud),
      detalle: c.saludInfo.descripcion,
    });
  }

  if(c.contrato === 'indefinido' || c.contrato === 'plazo_fijo'){
    if(c.cesantiaModo === 'no_descuenta'){
      pasos.push({
        titulo: 'Seguro de cesantía',
        monto: 0,
        detalle: 'No se descuenta (declarado por el responsable)',
      });
    } else if(c.cesRate > 0){
      pasos.push({
        titulo:  'Seguro de cesantía',
        monto:   -_round(c.descCes),
        detalle: c.cesRate + '% sobre imponible (parte trabajador, contrato ' + c.contrato + ')',
      });
    } else {
      pasos.push({
        titulo: 'Seguro de cesantía',
        monto: 0,
        detalle: 'No aplica al trabajador en contrato ' + c.contrato + ' (lo paga el empleador)',
      });
    }
  }

  pasos.push({
    titulo: 'Base tributable',
    monto: _round(c.baseTributable),
    detalle: 'Imponible − cotizaciones previsionales',
  });

  if(c.descImp > 0){
    pasos.push({
      titulo:  'Impuesto único de segunda categoría',
      monto:   -_round(c.descImp),
      detalle: 'Base ' + c.impInfo.baseEnUTM.toFixed(2) + ' UTM · factor ' + (c.impInfo.factor * 100).toFixed(2) + '% · rebaja ' + fmt(c.impInfo.rebaja),
    });
  } else {
    pasos.push({
      titulo: 'Impuesto único de segunda categoría',
      monto: 0,
      detalle: 'Exento — base tributable bajo 13,5 UTM',
    });
  }

  pasos.push({ titulo: 'LÍQUIDO A PAGAR', monto: _round(c.liquido), esTotal: true });

  return pasos;
}


// ════════════════════════════════
// LIQUIDAR DESDE LÍQUIDO — iterativo
// ════════════════════════════════
// Resuelve el sueldo bruto necesario para alcanzar un líquido pactado.
// El problema no tiene solución cerrada por la no-linealidad de los tramos
// del impuesto único. Aproximación de Newton amortiguada — converge en
// 5-15 iteraciones en la práctica.

function liquidarDesdeLiquido(opts){
  if(!opts || !opts.liquidoObjetivo || opts.liquidoObjetivo <= 0) return null;
  var objetivo = opts.liquidoObjetivo;

  var bruto = objetivo * 1.30;  // semilla inicial razonable
  var liq;
  var iter = 0;
  var maxIter = 30;

  for(; iter < maxIter; iter++){
    liq = liquidar(Object.assign({}, opts, { sueldoBase: bruto }));
    var diff = objetivo - liq.liquido;
    if(Math.abs(diff) < 1) break;
    // Factor 0.85 amortigua oscilaciones cerca de los cambios de tramo del impuesto
    bruto += diff * 0.85;
    if(bruto < 0){ bruto = objetivo; break; }
  }

  bruto = Math.round(bruto);
  liq = liquidar(Object.assign({}, opts, { sueldoBase: bruto }));
  liq.brutoCalculado  = bruto;
  liq.liquidoObjetivo = objetivo;
  liq.diferencia      = liq.liquido - objetivo;
  liq.iteraciones     = iter + 1;
  return liq;
}


// ════════════════════════════════════════════════════════════
// PERSISTENCIA DE LIQUIDACIONES (Hito 3.B)
// ════════════════════════════════════════════════════════════
// Estructura de almacenamiento dentro del negocio:
//
//   biz.payrolls = {
//     '2026-05': {
//       cerrada:        false,
//       fechaCerrado:   null,
//       workers: {
//         '<workerId>': { ...objeto que devuelve liquidar() },
//         '<workerId>': { ... }
//       }
//     },
//     '2026-04': { ... }
//   }
//
// Reglas:
//   - Guardar liquidación nueva: sin PIN.
//   - Sobrescribir liquidación existente: con PIN (edita historial).
//   - Eliminar liquidación: con PIN.
//   - Cerrar/reabrir mes: con PIN.
//   - Si el mes está cerrado, no se puede guardar ni eliminar
//     hasta reabrirlo.
//
// API pública:
//   savePayroll(liquidacion, onDone?)
//   getPayroll(periodo, workerId)
//   payrollExists(periodo, workerId)
//   listPayrollsByMonth(periodo)
//   listPayrollsByWorker(workerId)
//   getMonthStatus(periodo)        — alimenta Pantalla 4.1
//   deletePayroll(periodo, workerId, onDone?)
//   closeMonth(periodo, onDone?)
//   reopenMonth(periodo, onDone?)
//   ensurePayrollsStorage(biz)


// Migración lazy del almacenamiento.
function ensurePayrollsStorage(biz){
  if(!biz) return;
  if(!biz.payrolls) biz.payrolls = {};
}

// Helper interno: obtiene o crea la entrada del mes.
function _getOrCreateMonth(biz, periodo){
  ensurePayrollsStorage(biz);
  if(!biz.payrolls[periodo]){
    biz.payrolls[periodo] = { cerrada: false, fechaCerrado: null, workers: {} };
  } else {
    // Reparar entradas legacy que no tengan la estructura completa
    if(!biz.payrolls[periodo].workers) biz.payrolls[periodo].workers = {};
    if(typeof biz.payrolls[periodo].cerrada !== 'boolean') biz.payrolls[periodo].cerrada = false;
  }
  return biz.payrolls[periodo];
}

// ¿Existe una liquidación guardada para ese trabajador en ese mes?
function payrollExists(periodo, workerId){
  var b = (typeof getBiz === 'function') ? getBiz() : null;
  return !!(b && b.payrolls && b.payrolls[periodo] && b.payrolls[periodo].workers && b.payrolls[periodo].workers[workerId]);
}

// Devuelve la liquidación guardada o null.
function getPayroll(periodo, workerId){
  var b = (typeof getBiz === 'function') ? getBiz() : null;
  if(!b || !b.payrolls || !b.payrolls[periodo] || !b.payrolls[periodo].workers) return null;
  return b.payrolls[periodo].workers[workerId] || null;
}

// Guarda una liquidación. Si ya existe una para ese trabajador+mes, pide PIN.
// liquidacion debe ser el objeto retornado por liquidar() — viene con
// periodo y workerId adentro.
function savePayroll(liquidacion, onDone){
  var b = (typeof getBiz === 'function') ? getBiz() : null;
  if(!b){ if(typeof toast === 'function') toast('Negocio no encontrado'); return; }
  if(!liquidacion || !liquidacion.periodo || !liquidacion.workerId){
    if(typeof toast === 'function') toast('Liquidación inválida (faltan datos)');
    return;
  }

  var periodo = liquidacion.periodo;
  var workerId = liquidacion.workerId;

  // Si el mes está cerrado, bloquear.
  if(b.payrolls && b.payrolls[periodo] && b.payrolls[periodo].cerrada){
    if(typeof toast === 'function') toast('El mes está cerrado. Reábrelo para editar.');
    return;
  }

  var doWrite = function(){
    var month = _getOrCreateMonth(b, periodo);
    var existed = !!month.workers[workerId];
    liquidacion.fechaGuardado = new Date().toISOString();
    month.workers[workerId] = liquidacion;
    save(db);
    if(typeof toast === 'function') toast(existed ? 'Liquidación actualizada' : 'Liquidación guardada');
    if(onDone) onDone(true);
  };

  // Sobrescribir requiere PIN. Guardar nueva no.
  if(payrollExists(periodo, workerId) && typeof withPIN === 'function'){
    withPIN(doWrite);
  } else {
    doWrite();
  }
}

// Elimina una liquidación. Siempre requiere PIN.
function deletePayroll(periodo, workerId, onDone){
  var b = (typeof getBiz === 'function') ? getBiz() : null;
  if(!b) return;
  if(!payrollExists(periodo, workerId)){
    if(typeof toast === 'function') toast('No hay liquidación para eliminar');
    return;
  }
  if(b.payrolls[periodo].cerrada){
    if(typeof toast === 'function') toast('El mes está cerrado. Reábrelo para eliminar.');
    return;
  }
  var doDelete = function(){
    delete b.payrolls[periodo].workers[workerId];
    save(db);
    if(typeof toast === 'function') toast('Liquidación eliminada');
    if(onDone) onDone(true);
  };
  if(typeof withPIN === 'function'){
    withPIN(doDelete);
  } else {
    doDelete();
  }
}

// Lista todas las liquidaciones guardadas para un mes.
// Devuelve: [{ workerId, liquidacion }]
function listPayrollsByMonth(periodo){
  var b = (typeof getBiz === 'function') ? getBiz() : null;
  if(!b || !b.payrolls || !b.payrolls[periodo] || !b.payrolls[periodo].workers) return [];
  var workers = b.payrolls[periodo].workers;
  return Object.keys(workers).map(function(wid){
    return { workerId: wid, liquidacion: workers[wid] };
  });
}

// Lista todas las liquidaciones de un trabajador (todos los meses, más recientes primero).
// Devuelve: [{ periodo, liquidacion }]
function listPayrollsByWorker(workerId){
  var b = (typeof getBiz === 'function') ? getBiz() : null;
  if(!b || !b.payrolls) return [];
  var result = [];
  Object.keys(b.payrolls).sort().reverse().forEach(function(periodo){
    var month = b.payrolls[periodo];
    var liq = month.workers && month.workers[workerId];
    if(liq) result.push({ periodo: periodo, liquidacion: liq });
  });
  return result;
}

// Estado del mes — alimenta la Pantalla 4.1 (Lista del mes).
// Devuelve la lista de TODOS los trabajadores del negocio con su estado
// para el mes pedido, más totales y el estado de cierre.
function getMonthStatus(periodo){
  var b = (typeof getBiz === 'function') ? getBiz() : null;
  if(!b) return null;
  var workers = b.workers || [];
  var monthData = (b.payrolls && b.payrolls[periodo]) || null;
  var cerrada = !!(monthData && monthData.cerrada);

  var items = workers.map(function(w){
    var liq = monthData && monthData.workers && monthData.workers[w.id];
    return {
      worker: w,
      liquidacion: liq || null,
      status: liq ? 'liquidada' : 'pendiente',
    };
  });

  var liquidadosCount = items.filter(function(i){ return i.status === 'liquidada'; }).length;

  return {
    periodo:       periodo,
    cerrada:       cerrada,
    fechaCerrado:  monthData ? monthData.fechaCerrado : null,
    items:         items,
    totales: {
      trabajadores: workers.length,
      liquidados:   liquidadosCount,
      pendientes:   workers.length - liquidadosCount,
    },
  };
}

// Cerrar un mes — todas las liquidaciones del mes quedan protegidas.
function closeMonth(periodo, onDone){
  var b = (typeof getBiz === 'function') ? getBiz() : null;
  if(!b) return;
  var month = _getOrCreateMonth(b, periodo);
  if(month.cerrada){
    if(typeof toast === 'function') toast('El mes ya está cerrado');
    return;
  }
  var doClose = function(){
    month.cerrada = true;
    month.fechaCerrado = new Date().toISOString();
    save(db);
    if(typeof toast === 'function') toast('Mes cerrado');
    if(onDone) onDone(true);
  };
  if(typeof withPIN === 'function'){
    withPIN(doClose);
  } else {
    doClose();
  }
}

// Reabrir un mes cerrado.
function reopenMonth(periodo, onDone){
  var b = (typeof getBiz === 'function') ? getBiz() : null;
  if(!b || !b.payrolls || !b.payrolls[periodo]) return;
  var month = b.payrolls[periodo];
  if(!month.cerrada){
    if(typeof toast === 'function') toast('El mes no está cerrado');
    return;
  }
  var doReopen = function(){
    month.cerrada = false;
    month.fechaCerrado = null;
    save(db);
    if(typeof toast === 'function') toast('Mes reabierto');
    if(onDone) onDone(true);
  };
  if(typeof withPIN === 'function'){
    withPIN(doReopen);
  } else {
    doReopen();
  }
}


// ════════════════════════════════
// AUTO-MIGRACIÓN AL CARGAR
// ════════════════════════════════
// Asegura que todos los negocios existentes tengan los campos nuevos
// (parámetros legales + almacenamiento de liquidaciones).
// Se ejecuta una sola vez al cargar la app. Si no había cambios, no toca nada.

(function _migrateAllOnLoad(){
  if(typeof db === 'undefined' || !db || !db.businesses) return;
  var dirty = false;
  db.businesses.forEach(function(b){
    var before = JSON.stringify(b.params) + '|' + JSON.stringify(!!b.payrolls);
    ensurePayrollParams(b);
    ensurePayrollsStorage(b);
    var after = JSON.stringify(b.params) + '|' + JSON.stringify(!!b.payrolls);
    if(after !== before) dirty = true;
  });
  if(dirty && typeof save === 'function') save(db);
})();
