/**************************************************************
 * OEP - Módulo Jefe de OPT (Carga Diaria) — Modelo nuevo v4
 **************************************************************/

const API_URL = 'https://script.google.com/macros/s/AKfycbzn4bcq0uYlNnunsv8ePtzIzaHI606CjgXunrOVClZ29pYhXP5CcFPAUck7O0V31CeJOQ/exec';

let USUARIO = null;
let TOKEN = null;
let ULTIMO = null;
let CATALOGOS = {};
let modalAgregarBS = null;
let categoriaActual = '';
let selectActualId = '';

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

  // Cargar catálogos
  const rCat = await api('obtenerCatalogos');
  if (rCat.ok) {
    CATALOGOS = rCat.catalogos || {};
    llenarDropdown('abierta', CATALOGOS.SI_NO || []);
    llenarDropdown('estatus-legal', CATALOGOS.ESTATUS_LEGAL || []);
    llenarDropdown('observacion', CATALOGOS.OBSERVACIONES || []);
  }

  modalAgregarBS = new bootstrap.Modal(document.getElementById('modalAgregar'));

  // Pre-cargar último reporte
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
  // Restaurar selección previa si existe
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

    // Recargar catálogos y dropdown
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
  document.getElementById('personal-activo').value = v.personal_activo || '';
  document.getElementById('personal-vacante').value = v.personal_vacante || '';
  document.getElementById('novedad-vehiculos').value = v.novedad_vehiculos || '';
  document.getElementById('novedad-infraestructura').value = v.novedad_infraestructura || '';
  document.getElementById('novedad-conectividad').value = v.novedad_conectividad || '';
  document.getElementById('observaciones').value = v.observaciones || '';
  toggleCausa();
}

function restaurarAnterior() {
  if (!ULTIMO) return;
  precargarUltimo(ULTIMO);
}

// ============================================================
// ENVÍO
// ============================================================
function recogerDatos() {
  return {
    estatus: document.getElementById('estatus').value,
    abierta: document.getElementById('abierta').value,
    estatus_legal: document.getElementById('estatus-legal').value,
    observacion: document.getElementById('observacion').value,
    causa: document.getElementById('causa').value.trim(),
    personal_activo: document.getElementById('personal-activo').value,
    personal_vacante: document.getElementById('personal-vacante').value,
    novedad_vehiculos: document.getElementById('novedad-vehiculos').value.trim(),
    novedad_infraestructura: document.getElementById('novedad-infraestructura').value.trim(),
    novedad_conectividad: document.getElementById('novedad-conectividad').value.trim(),
    observaciones: document.getElementById('observaciones').value.trim()
  };
}

function validar(d) {
  if (!d.estatus) return 'Selecciona el Estatus operativo';
  if (!d.abierta) return 'Selecciona si está abierta al público';
  if (!d.estatus_legal) return 'Selecciona el Estatus legal';
  if (!d.observacion) return 'Selecciona una Observación';
  if ((d.estatus === 'INOPERATIVA' || d.estatus === 'CIERRE_TECNICO') && !d.causa)
    return 'La causa es obligatoria para Inoperativa o Cierre Técnico';
  if (d.personal_activo === '') return 'Indica el personal activo';
  if (d.personal_vacante === '') return 'Indica el personal vacante';
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
