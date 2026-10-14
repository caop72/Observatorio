/**************************************************************
 * OEP - Módulo Jefe de OPT (Carga Diaria) — Modelo v10
 * Bloque 2: Parte del Personal matricial
 **************************************************************/

const API_URL = 'https://script.google.com/macros/s/AKfycbzn4bcq0uYlNnunsv8ePtzIzaHI606CjgXunrOVClZ29pYhXP5CcFPAUck7O0V31CeJOQ/exec';

let USUARIO = null;
let TOKEN = null;
let ULTIMO = null;
let CATALOGOS = {};
let modalAgregarBS = null;
let categoriaActual = '';
let selectActualId = '';

const TIPOS = ['directivos','empleados','obreros','contratados'];
const SITUACIONES = ['presentes','reposo','comision','permiso','suspendido'];

// ============================================================
// API
// ============================================================
async function api(accion, datos) {
  const r = await fetch(API_URL, {
    method: 'POST',
    body: JSON.stringify(Object.assign({ accion }, datos || {})),
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }
  });
  return await r.json();
}

// ============================================================
// ARRANQUE
// ============================================================
window.addEventListener('DOMContentLoaded', async () => {
  USUARIO = JSON.parse(localStorage.getItem('oep_usuario') || 'null');
  if (!USUARIO || !USUARIO.token) { location.href = 'index.html'; return; }
  TOKEN = USUARIO.token;

  document.getElementById('nav-usuario').textContent =
    (USUARIO.nombres || '') + ' ' + (USUARIO.apellidos || '') + ' — ' + (USUARIO.cargo || '');

  const hoy = new Date();
  document.getElementById('fecha-hoy').textContent =
    hoy.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const rCat = await api('obtenerCatalogos');
  if (rCat.ok) {
    CATALOGOS = rCat.catalogos || {};
    llenarDropdown('abierta', CATALOGOS.SI_NO || []);
    llenarDropdown('estatus-legal', CATALOGOS.ESTATUS_LEGAL || []);
    llenarDropdown('observacion', CATALOGOS.OBSERVACIONES || []);
  }

  modalAgregarBS = new bootstrap.Modal(document.getElementById('modalAgregar'));

  const idOpt = USUARIO.opt || '';
  if (idOpt) {
    const r = await api('obtenerUltimoReporte', { idOpt });
    if (r.ok && r.ultimo) {
      ULTIMO = r.ultimo;
      precargarUltimo(r.ultimo);
      document.getElementById('banner-precarga').classList.remove('d-none');
      document.getElementById('banner-fecha').textContent = formatearFecha(r.ultimo.fecha);
    }
  }

  calcularTotalRRHH();
});

function llenarDropdown(idSelect, valores) {
  const sel = document.getElementById(idSelect);
  if (!sel) return;
  const valorActual = sel.value;
  sel.innerHTML = '<option value="">Seleccione...</option>';
  valores.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = v;
    sel.appendChild(opt);
  });
  if (valorActual) sel.value = valorActual;
}

// ============================================================
// MODAL AGREGAR
// ============================================================
function abrirModalAgregar(categoria, selectId) {
  categoriaActual = categoria;
  selectActualId = selectId;
  document.getElementById('modal-categoria-txt').textContent = categoria;
  document.getElementById('modal-valor').value = '';
  document.getElementById('modal-msg').textContent = '';
  modalAgregarBS.show();
  setTimeout(() => document.getElementById('modal-valor').focus(), 300);
}

async function guardarNuevoValor() {
  const valor = document.getElementById('modal-valor').value.trim();
  const msg = document.getElementById('modal-msg');
  msg.style.color = '#c0392b';
  if (!valor) { msg.textContent = 'Escribe un valor'; return; }

  msg.textContent = 'Guardando...';

  try {
    const r = await api('agregarValorCatalogo', {
      token: TOKEN,
      categoria: categoriaActual,
      valor: valor
    });
    if (!r.ok) { msg.textContent = r.error || 'Error'; return; }

    const rCat = await api('obtenerCatalogos');
    if (rCat.ok) {
      CATALOGOS = rCat.catalogos || {};
      const lista = categoriaActual === 'OBSERVACIONES' ? (CATALOGOS.OBSERVACIONES || []) :
                    categoriaActual === 'ESTATUS_LEGAL' ? (CATALOGOS.ESTATUS_LEGAL || []) :
                    categoriaActual === 'SI_NO' ? (CATALOGOS.SI_NO || []) : [];
      llenarDropdown(selectActualId, lista);
      document.getElementById(selectActualId).value = valor;
    }

    msg.style.color = '#27ae60';
    msg.textContent = '✅ Agregado';
    setTimeout(() => modalAgregarBS.hide(), 800);
  } catch (e) {
    msg.textContent = 'Error: ' + e.message;
  }
}

// ============================================================
// FORM
// ============================================================
function toggleCausa() {
  const est = document.getElementById('estatus').value;
  const bloque = document.getElementById('bloque-causa');
  bloque.style.display = (est === 'INOPERATIVA' || est === 'CIERRE_TECNICO') ? '' : 'none';
}

function precargarUltimo(ult) {
  const v = ult.valores || {};
  document.getElementById('estatus').value = v.estatus || '';
  document.getElementById('abierta').value = v.abierta || '';
  document.getElementById('estatus-legal').value = v.estatus_legal || '';
  document.getElementById('observacion').value = v.observacion || '';
  document.getElementById('causa').value = v.causa || '';

  TIPOS.forEach(t => {
    SITUACIONES.forEach(s => {
      const el = document.getElementById(s + '-' + t);
      if (el) el.value = v[s + '_' + t] || 0;
    });
    const vac = document.getElementById('vacantes-' + t);
    if (vac) vac.value = v['vacantes_' + t] || 0;
  });

  document.getElementById('novedad-vehiculos').value = v.novedad_vehiculos || '';
  document.getElementById('novedad-infraestructura').value = v.novedad_infraestructura || '';
  document.getElementById('novedad-conectividad').value = v.novedad_conectividad || '';
  document.getElementById('observaciones').value = v.observaciones || '';
  toggleCausa();
  calcularTotalRRHH();
}

function restaurarAnterior() {
  if (!ULTIMO) return;
  precargarUltimo(ULTIMO);
}

// ============================================================
// CÁLCULOS EN VIVO
// ============================================================
function num_(id) {
  const el = document.getElementById(id);
  if (!el) return 0;
  return parseInt(el.value, 10) || 0;
}

function calcularTotalRRHH() {
  const totalesSituacion = {};
  SITUACIONES.forEach(s => totalesSituacion[s] = 0);

  let granTotalActivos = 0;
  let granTotalVacantes = 0;

  TIPOS.forEach(t => {
    let activosTipo = 0;
    SITUACIONES.forEach(s => {
      const v = num_(s + '-' + t);
      activosTipo += v;
      totalesSituacion[s] += v;
    });
    const vacantesTipo = num_('vacantes-' + t);
    const totalTipo = activosTipo + vacantesTipo;

    document.getElementById('activos-' + t).textContent = activosTipo;
    document.getElementById('total-' + t).textContent = totalTipo;

    granTotalActivos += activosTipo;
    granTotalVacantes += vacantesTipo;
  });

  // Totales al pie
  SITUACIONES.forEach(s => {
    const el = document.getElementById('tot-' + s);
    if (el) el.textContent = totalesSituacion[s];
  });
  document.getElementById('tot-activos').textContent = granTotalActivos;
  document.getElementById('tot-vacantes').textContent = granTotalVacantes;
  document.getElementById('tot-total').textContent = granTotalActivos + granTotalVacantes;

  // Bloque resumen
  document.getElementById('total-activos').textContent = granTotalActivos;
  document.getElementById('total-vacantes').textContent = granTotalVacantes;
  document.getElementById('total-rrhh').textContent = granTotalActivos + granTotalVacantes;
}

// ============================================================
// ENVÍO
// ============================================================
function recogerDatos() {
  const d = {
    estatus: document.getElementById('estatus').value,
    abierta: document.getElementById('abierta').value,
    estatus_legal: document.getElementById('estatus-legal').value,
    observacion: document.getElementById('observacion').value,
    causa: document.getElementById('causa').value.trim(),
    novedad_vehiculos: document.getElementById('novedad-vehiculos').value.trim(),
    novedad_infraestructura: document.getElementById('novedad-infraestructura').value.trim(),
    novedad_conectividad: document.getElementById('novedad-conectividad').value.trim(),
    observaciones: document.getElementById('observaciones').value.trim()
  };
  TIPOS.forEach(t => {
    SITUACIONES.forEach(s => {
      d[s + '_' + t] = num_(s + '-' + t);
    });
    d['vacantes_' + t] = num_('vacantes-' + t);
    d['activos_' + t] = num_('activos-' + t).toString ? document.getElementById('activos-' + t).textContent : 0;
    d['total_' + t] = document.getElementById('total-' + t).textContent;
  });
  return d;
}

function validar(d) {
  if (!d.estatus) return 'Selecciona el Estatus operativo';
  if (!d.abierta) return 'Selecciona si está abierta al público';
  if (!d.estatus_legal) return 'Selecciona el Estatus legal';
  if (!d.observacion) return 'Selecciona una Observación';
  if ((d.estatus === 'INOPERATIVA' || d.estatus === 'CIERRE_TECNICO') && !d.causa)
    return 'La causa es obligatoria para Inoperativa o Cierre Técnico';
  return null;
}

async function enviarSinNovedades() {
  if (!ULTIMO) {
    alert('No hay reporte anterior para reutilizar');
    return;
  }
  precargarUltimo(ULTIMO);
  document.getElementById('observaciones').value = 'Sin novedades respecto al reporte anterior';
  await enviarReporte();
}

async function enviarReporte() {
  const msg = document.getElementById('msg');
  msg.style.color = '#c0392b';
  msg.textContent = '';

  const d = recogerDatos();
  const err = validar(d);
  if (err) { msg.textContent = err; return; }

  msg.textContent = 'Enviando...';

  try {
    const r = await api('guardarReporte', {
      token: TOKEN,
      idOpt: USUARIO.opt || '',
      valores: d,
      commit: d.causa || 'Sin novedades'
    });

    if (!r.ok) { msg.textContent = r.error; return; }

    msg.style.color = '#27ae60';
    msg.textContent = '✅ Reporte enviado: ' + r.idReporte + ' — Semáforo: ' + r.semaforo;
  } catch (e) {
    msg.textContent = 'Error: ' + e.message;
  }
}

// ============================================================
// UTIL
// ============================================================
function formatearFecha(f) {
  if (!f) return '';
  try {
    const d = new Date(f);
    if (isNaN(d.getTime())) return String(f);
    return d.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch(e) { return String(f); }
}

async function cerrarSesion() {
  try {
    if (TOKEN) await api('logout', { token: TOKEN });
  } catch (e) {}
  localStorage.clear();
  sessionStorage.clear();
  location.href = 'index.html';
}
