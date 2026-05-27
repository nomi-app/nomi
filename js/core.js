// ════════════════════════════════
// UTILITIES
// ════════════════════════════════
function esc(s){
  return String(s||'')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

var _toastTimer;
function toast(msg){
  var el = document.getElementById('toast');
  if(!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(function(){ el.classList.remove('show'); }, 2600);
}

// ════════════════════════════════
// STORAGE
// ════════════════════════════════
const KEY = 'nomi_v1';
function load(){ try{ return JSON.parse(localStorage.getItem(KEY))||null; }catch(e){ return null; } }
function save(db){ localStorage.setItem(KEY, JSON.stringify(db)); }
function fresh(){ return { version:1, businesses:[], activeBizId:null }; }

let db = load() || fresh();

// ════════════════════════════════
// THEME
// ════════════════════════════════
let theme = localStorage.getItem('nomi_theme') || 'light';
function applyTheme(){
  document.documentElement.setAttribute('data-theme', theme);
  document.getElementById('themeBtn').textContent = theme==='light' ? '☀' : '☾';
}
function toggleTheme(){
  theme = theme==='light' ? 'dark' : 'light';
  localStorage.setItem('nomi_theme', theme);
  applyTheme();
}
applyTheme();

// ════════════════════════════════
// CONFIRM MODAL
// ════════════════════════════════
let _confirmCb = null;

function showConfirmModal(title, body, onConfirm){
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-body').textContent  = body;
  _confirmCb = onConfirm;
  const ov = document.getElementById('confirm-overlay');
  ov.style.display = 'flex';
  ov.onclick = function(e){ if(e.target === ov) closeConfirmModal(); };
}

function closeConfirmModal(){
  document.getElementById('confirm-overlay').style.display = 'none';
  _confirmCb = null;
}

document.getElementById('confirm-action-btn').onclick = function(){
  var cb = _confirmCb;   // save BEFORE closing
  closeConfirmModal();
  if(cb) cb();
};

// ════════════════════════════════