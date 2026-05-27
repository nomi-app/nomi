// ════════════════════════════════
// RUT VALIDATION (Módulo 11)
// ════════════════════════════════
function rutClean(raw){
  return raw.replace(/[\.\-\s]/g,'').toUpperCase();
}
function rutFormat(raw){
  const clean = rutClean(raw);
  if(clean.length < 2) return raw;
  const body = clean.slice(0,-1);
  const dv   = clean.slice(-1);
  // Add dots every 3 digits from right
  const bodyFmt = body.replace(/\B(?=(\d{3})+(?!\d))/g,'.');
  return `${bodyFmt}-${dv}`;
}
function rutValidate(raw){
  const clean = rutClean(raw);
  if(clean.length < 2) return false;
  const body = clean.slice(0,-1);
  const dv   = clean.slice(-1);
  if(!/^\d+$/.test(body)) return false;
  // Módulo 11
  const digits = body.split('').reverse();
  const series = [2,3,4,5,6,7];
  let sum = 0;
  digits.forEach((d,i) => { sum += parseInt(d) * series[i % series.length]; });
  const rem = 11 - (sum % 11);
  let expected;
  if(rem === 11) expected = '0';
  else if(rem === 10) expected = 'K';
  else expected = String(rem);
  return dv === expected;
}

// RUT input live formatting and validation
document.getElementById('ob-rut').addEventListener('input', function(){
  const raw = this.value;
  const clean = rutClean(raw);
  // Only format if there's enough content to avoid disrupting typing
  if(clean.length >= 2){
    const cursorAtEnd = this.selectionStart === this.value.length;
    this.value = rutFormat(raw);
    if(cursorAtEnd) this.selectionStart = this.selectionEnd = this.value.length;
  }
  const errEl  = document.getElementById('ob-rut-err');
  const okEl   = document.getElementById('ob-rut-ok');
  if(clean.length === 0){
    // Empty — optional, no feedback
    this.classList.remove('error');
    errEl.classList.remove('show');
    okEl.style.display='none';
  } else if(clean.length >= 8){
    // Long enough to validate
    if(rutValidate(raw)){
      this.classList.remove('error');
      errEl.classList.remove('show');
      okEl.style.display='block';
    } else {
      this.classList.add('error');
      errEl.classList.add('show');
      okEl.style.display='none';
    }
  } else {
    // Still typing — no error yet
    this.classList.remove('error');
    errEl.classList.remove('show');
    okEl.style.display='none';
  }
});

function ob_step1(){
  const name = document.getElementById('ob-name').value.trim();
  const nameErr = document.getElementById('ob-name-err');
  const rutVal  = document.getElementById('ob-rut').value.trim();
  const rutErr  = document.getElementById('ob-rut-err');

  // Validate name
  if(!name){
    document.getElementById('ob-name').classList.add('error');
    nameErr.classList.add('show');
    document.getElementById('ob-name').focus();
    return;
  }
  document.getElementById('ob-name').classList.remove('error');
  nameErr.classList.remove('show');

  // Validate RUT only if something was entered
  const rutCleanVal = rutClean(rutVal);
  if(rutCleanVal.length > 0 && !rutValidate(rutVal)){
    document.getElementById('ob-rut').classList.add('error');
    rutErr.classList.add('show');
    document.getElementById('ob-rut').focus();
    return;
  }
  rutErr.classList.remove('show');

  goOb(2);
}

document.getElementById('ob-name').addEventListener('input', function(){
  this.classList.remove('error');
  document.getElementById('ob-name-err').classList.remove('show');
});
document.getElementById('ob-name').addEventListener('keydown', e => {
  if(e.key === 'Enter') ob_step1();
});

function toggleMod(el){
  const mod = el.dataset.mod;
  mods[mod] = !mods[mod];
  el.classList.toggle('on', mods[mod]);
}

function toggleAfp(){
  const acc = document.getElementById('afp-accordion');
  acc.classList.toggle('open');
}

function finishOb(){
  const name  = document.getElementById('ob-name').value.trim();
  const rut   = document.getElementById('ob-rut').value.trim();
  const rubro = document.getElementById('ob-rubro').value;
  const grat  = document.getElementById('ob-grat').value;
  const imm   = parseFloat(document.getElementById('ob-imm').value)||500000;
  const tope  = parseFloat(document.getElementById('ob-tope').value)||2971285;
  const uf    = parseFloat(document.getElementById('ob-uf').value)||37500;
  const afpRates = {
    Habitat:  parseFloat(document.getElementById('afp-habitat').value)||10.58,
    Capital:  parseFloat(document.getElementById('afp-capital').value)||10.44,
    Modelo:   parseFloat(document.getElementById('afp-modelo').value)||10.58,
    Provida:  parseFloat(document.getElementById('afp-provida').value)||10.77,
    Cuprum:   parseFloat(document.getElementById('afp-cuprum').value)||10.58,
    PlanVital:parseFloat(document.getElementById('afp-planvital').value)||10.57,
  };
  const cesantia = {
    indefinido: parseFloat(document.getElementById('ces-indef').value)||0.6,
    fijo:       parseFloat(document.getElementById('ces-fijo').value)||3.0,
  };

  const biz = {
    id: Date.now().toString(),
    name, rut, rubro, grat,
    modules: {...mods},
    params: { imm, tope, uf, afpRates, cesantia },
    workers: [],
    createdAt: new Date().toISOString(),
  };

  db.businesses.push(biz);
  db.activeBizId = biz.id;
  save(db);

  document.getElementById('onboarding').classList.add('gone');
  initApp();
}

function handleRestore(){
  const inp = document.createElement('input');
  inp.type='file'; inp.accept='.json';
  inp.onchange = e => {
    const file = e.target.files[0];
    if(!file) return;
    const r = new FileReader();
    r.onload = ev => {
      try{
        const imp = JSON.parse(ev.target.result);
        if(!imp.businesses) throw new Error();
        db = imp; save(db);
        document.getElementById('onboarding').classList.add('gone');
        initApp();
        toast('Datos restaurados');
      }catch{ toast('Archivo no válido'); }
    };
    r.readAsText(file);
  };
  inp.click();
}

// ════════════════════════════════
// PIN SYSTEM
// ════════════════════════════════
var _pinBuf  = '';
var _pinMode = null;
var _pinTemp = '';
var _pinCb   = null;

async function sha256(s){
  var buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(function(b){ return b.toString(16).padStart(2,'0'); }).join('');
}

function hasPIN(){
  var biz = getBiz();
  return !!(biz && biz.pinHash);
}

function _openPin(mode, subtitle, cb){
  _pinBuf  = '';
  _pinTemp = '';
  _pinMode = mode;
  _pinCb   = cb || null;
  var titles = { verify:'Ingresa tu PIN', set_new:'Crear PIN', confirm_new:'Confirmar PIN' };
  var icons  = { verify:'🔒', set_new:'🔑', confirm_new:'🔑' };
  document.getElementById('pin-title').textContent    = titles[mode] || 'PIN';
  document.getElementById('pin-icon').textContent     = icons[mode]  || '🔒';
  document.getElementById('pin-subtitle').textContent = subtitle;
  document.getElementById('pin-error').style.display  = 'none';
  renderPinDots();
  document.getElementById('pin-overlay').style.display = 'flex';
}

function closePinModal(){
  document.getElementById('pin-overlay').style.display = 'none';
  _pinBuf = ''; _pinMode = null; _pinCb = null; _pinTemp = '';
}

function renderPinDots(){
  document.querySelectorAll('.pin-dot').forEach(function(d, i){
    d.classList.toggle('filled', i < _pinBuf.length);
    d.classList.remove('error');
  });
}

function pinKey(digit){
  if(_pinBuf.length >= 4) return;
  _pinBuf += digit;
  renderPinDots();
  if(_pinBuf.length === 4) setTimeout(processPIN, 100);
}

function pinClear(){
  if(!_pinBuf.length) return;
  _pinBuf = _pinBuf.slice(0, -1);
  renderPinDots();
}

function pinShakeError(msg){
  document.querySelectorAll('.pin-dot').forEach(function(d){
    d.classList.add('error');
    setTimeout(function(){ d.classList.remove('error'); }, 400);
  });
  var el = document.getElementById('pin-error');
  el.textContent = msg || 'PIN incorrecto.';
  el.style.display = 'block';
  _pinBuf = '';
  setTimeout(renderPinDots, 400);
}

async function processPIN(){
  var biz = getBiz();
  if(!biz || !_pinMode) return;

  if(_pinMode === 'verify'){
    var h = await sha256(_pinBuf);
    if(h === biz.pinHash){
      var savedCb = _pinCb;
      closePinModal();
      if(savedCb) savedCb();
    } else {
      pinShakeError('PIN incorrecto. Intenta nuevamente.');
    }

  } else if(_pinMode === 'set_new'){
    _pinTemp = _pinBuf;
    _pinBuf  = '';
    _pinMode = 'confirm_new';
    document.getElementById('pin-title').textContent    = 'Confirmar PIN';
    document.getElementById('pin-subtitle').textContent = 'Ingresa el mismo PIN nuevamente';
    document.getElementById('pin-error').style.display  = 'none';
    renderPinDots();

  } else if(_pinMode === 'confirm_new'){
    if(_pinBuf === _pinTemp){
      var h2 = await sha256(_pinBuf);
      biz.pinHash = h2;
      save(db);
      closePinModal();
      renderCfgPinRow();
      toast('PIN configurado correctamente');
    } else {
      _pinTemp = '';
      _pinBuf  = '';
      _pinMode = 'set_new';
      document.getElementById('pin-title').textContent    = 'Crear PIN';
      document.getElementById('pin-subtitle').textContent = 'Elige un PIN de 4 dígitos';
      pinShakeError('Los PINs no coinciden. Vuelve a intentarlo.');
    }
  }
}

// Keyboard support
document.addEventListener('keydown', function(e){
  if(document.getElementById('pin-overlay').style.display !== 'flex') return;
  if(e.key >= '0' && e.key <= '9') pinKey(e.key);
  if(e.key === 'Backspace') pinClear();
  if(e.key === 'Escape') closePinModal();
});

// withPIN(action): if PIN is set, verify then run action; else run directly
function withPIN(action){
  if(!hasPIN()){
    action();
  } else {
    _openPin('verify', 'Ingresa tu PIN para confirmar esta acción', action);
  }
}

// Setup/change PIN from config
function openPinSetup(){
  if(hasPIN()){
    _openPin('verify', 'Ingresa tu PIN actual para cambiarlo', function(){
      _openPin('set_new', 'Elige tu nuevo PIN de 4 dígitos', null);
    });
  } else {
    _openPin('set_new', 'Elige un PIN de 4 dígitos para proteger acciones sensibles', null);
  }
}

function renderCfgPinRow(){
  var has = hasPIN();
  var lbl = document.getElementById('cfg-pin-label');
  var dsc = document.getElementById('cfg-pin-desc');
  if(lbl) lbl.textContent = has ? 'Cambiar PIN' : 'Configurar PIN';
  if(dsc) dsc.textContent = has ? 'PIN activo · Toca para cambiarlo' : 'Protege acciones sensibles con un PIN de 4 dígitos';
}

// ════════════════════════════════
// PROTECTED ACTIONS
// ════════════════════════════════

// Delete business: confirm → PIN → execute
function requestPinForDelete(){
  showConfirmModal(
    'Eliminar este negocio',
    'Se eliminarán todos los datos: trabajadores, configuración y parámetros legales. Esta acción es irreversible.',
    function(){
      withPIN(function(){
        db.businesses = db.businesses.filter(function(b){ return b.id !== db.activeBizId; });
        db.activeBizId = db.businesses.length ? db.businesses[0].id : null;
        save(db);
        if(db.businesses.length === 0){ startNewBiz(); }
        else { renderAll(); go('inicio'); }
      });
    }
  );
}

// Delete worker: confirm → PIN → execute
function delWorker(id){
  var biz = getBiz();
  if(!biz) return;
  var w = biz.workers.find(function(x){ return x.id === id; });
  if(!w) return;
  showConfirmModal(
    'Eliminar a ' + w.nombre,
    'Se eliminarán todos los datos de este trabajador, incluyendo su ficha, configuración previsional y rol de comisiones. Esta acción es irreversible.',
    function(){
      withPIN(function(){
        var b = getBiz();
        if(!b) return;
        b.workers = b.workers.filter(function(x){ return x.id !== id; });
        save(db);
        renderWorkerList();
        renderDash();
        toast('Trabajador eliminado');
      });
    }
  );
}

// Save params: PIN → execute (no confirm needed, user already clicked save)
function requestPinForParams(){
  withPIN(saveParams);
}