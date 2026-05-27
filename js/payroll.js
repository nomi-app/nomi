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
  if(p.honorariosRetencion == null) p.honorariosRetencion = PAYROLL_DEFAULTS.honorariosRetencion;
  if(!p.impuestoTablaUTM)         p.impuestoTablaUTM = JSON.parse(JSON.stringify(PAYROLL_DEFAULTS.impuestoTablaUTM));
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

  var sueldoBase        = opts.sueldoBase != null ? opts.sueldoBase : (worker.sueldoBase || 0);
  var comisiones        = opts.comisiones || 0;
  var otrosImponibles   = opts.otrosImponibles || 0;
  var otrosNoImponibles = opts.otrosNoImponibles || 0;
  var periodo           = opts.periodo || _nowPeriodo();

  var esHonorarios = worker.contrato === 'honorarios';

  // ── HONORARIOS: flujo simplificado ──
  if(esHonorarios){
    var brutoHon = sueldoBase + comisiones + otrosImponibles + otrosNoImponibles;
    var retencion = brutoHon * (honRetRate / 100);
    var liquidoHon = brutoHon - retencion;
    return {
      periodo: periodo,
      workerId: worker.id,
      fechaCalculo: new Date().toISOString(),
      esHonorarios: true,
      snapshot: _snapshotSnap(worker, biz, p, sueldoBase, afpRate),
      haberes: {
        sueldoBase: _round(sueldoBase),
        gratificacion: 0,
        gratificacionEtiqueta: 'No aplica (honorarios)',
        comisiones: _round(comisiones),
        otrosImponibles: _round(otrosImponibles),
        otrosNoImponibles: _round(otrosNoImponibles),
        totalHaberes: _round(brutoHon),
      },
      imponible: { bruto: _round(brutoHon), topePesos: 0, topeAplicado: false, imponibleFinal: 0, imponibleCes: 0 },
      descuentos: {
        afp:           { monto: 0, tasa: 0, base: 0, aplica: false },
        salud:         { monto: 0, info: { tipo: 'no_aplica', descripcion: 'No aplica (honorarios)' }, base: 0, aplica: false },
        cesantia:      { monto: 0, tasa: 0, base: 0, aplica: false },
        impuestoUnico: { monto: 0, tramo: -1, factor: 0, rebaja: 0, baseTributable: 0, baseEnUTM: 0, aplica: false },
        honorariosRetencion: { monto: _round(retencion), tasa: honRetRate, base: _round(brutoHon), aplica: true },
        totalDescuentos: _round(retencion),
      },
      liquido: _round(liquidoHon),
      pasos: [
        { titulo: 'Monto bruto de honorarios', monto: _round(brutoHon), detalle: 'Suma de haberes' },
        { titulo: 'Retención SII (boleta)',    monto: -_round(retencion), detalle: honRetRate + '% sobre bruto — Ley 21.133' },
        { titulo: 'LÍQUIDO A PAGAR',           monto: _round(liquidoHon), esTotal: true },
      ],
    };
  }

  // ── DEPENDIENTES: flujo completo ──

  // 1. Gratificación
  var gratMode = _resolverGratMode(worker, biz);
  var gratificacion = calcGratificacion(sueldoBase, gratMode, imm);

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
  var descCes = calcCesantia(imponibleCes, worker.contrato, cesRates);

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
      comisiones: comisiones, otrosImponibles: otrosImponibles, otrosNoImponibles: otrosNoImponibles,
      imponibleSinTope: imponibleSinTope, topePesos: topePesos, imponible: imponible, topeAplicado: topeAplicado,
      descAfp: descAfp, afpRate: afpRate, afpNombre: worker.afp,
      descSalud: descSalud, saludInfo: saludInfo,
      descCes: descCes, cesRate: _cesRate(worker.contrato, cesRates), contrato: worker.contrato,
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
    pasos.push({
      titulo: 'Gratificación mensual',
      monto: _round(c.gratificacion),
      detalle: 'Mínimo entre 25% del sueldo y tope legal de 4,75 IMM / 12 = ' + fmt(4.75 * c.imm / 12),
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
    if(c.cesRate > 0){
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


// ════════════════════════════════
// AUTO-MIGRACIÓN AL CARGAR
// ════════════════════════════════
// Asegura que todos los negocios existentes tengan los campos nuevos.
// Se ejecuta una sola vez al cargar la app. Si no había cambios, no toca nada.

(function _migrateAllOnLoad(){
  if(typeof db === 'undefined' || !db || !db.businesses) return;
  var dirty = false;
  db.businesses.forEach(function(b){
    var before = JSON.stringify(b.params);
    ensurePayrollParams(b);
    if(JSON.stringify(b.params) !== before) dirty = true;
  });
  if(dirty && typeof save === 'function') save(db);
})();
