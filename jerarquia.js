/**************************************************************
 * OEP - Panel Jerárquico (v4 — 3 columnas de indicadores)
 **************************************************************/

const API_URL = 'https://script.google.com/macros/s/AKfycbzn4bcq0uYlNnunsv8ePtzIzaHI606CjgXunrOVClZ29pYhXP5CcFPAUck7O0V31CeJOQ/exec';

let TOKEN = '';
let USUARIO = null;
let ARBOL = [];
let NIVEL = 0;
let REGION_SEL = null;
let ESTADO_SEL = null;

document.addEventListener('DOMContentLoaded', () => {
  let U = null;
  try { U = JSON.parse(localStorage.getItem('oep_usuario') || 'null'); } catch(e) {}
  if (!U || !U.token) { window.location.href = 'index.html'; return; }
  USUARIO = U;
  TOKEN = U.token;

  document.getElementById('infoCargo').textContent =
    (USUARIO.nombres || '') + ' — ' + (USUARIO.cargo || '');

  cargarArbol();
});

function cerrarSesion() {
  const t = TOKEN;
  localStorage.removeItem('oep_usuario');
  if (t) {
    fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify({ accion: 'logout', token: t }),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    }).finally(() => { window.location.href = 'index.html'; });
  } else {
    window.location.href = 'index.html';
  }
}

async function apiGet(params) {
  const url = new URL(API_URL);
  Object.keys(params).forEach(k => url.searchParams.set(k, params[k]));
  const res = await fetch(url.toString());
  return await res.json();
}

async function cargarArbol() {
  document.getElementById('contenedorLista').innerHTML =
    '<div class="text-center text-muted py-4">Cargando...</div>';
  try {
    const data = await apiGet({ accion: 'obtenerArbolJerarquico', token: TOKEN });
    if (!data.ok) {
      document.getElementById('contenedorLista').innerHTML =
        '<div class="alert alert-danger m-3">' + (data.error || 'Error') + '</div>';
      return;
    }
    ARBOL = data.arbol || [];
    NIVEL = 0;
    renderNivel();
  } catch (e) {
    document.getElementById('contenedorLista').innerHTML =
      '<div class="alert alert-danger m-3">Error de red: ' + e.message + '</div>';
  }
}

function renderNivel() {
  const cargo = USUARIO ? USUARIO.cargo : '';
  const titulo = document.getElementById('tituloNivel');
  const barra = document.getElementById('barraNavegacion');

  if (NIVEL === 0) {
    titulo.textContent = (cargo === 'Gerente de Estado') ? 'OPTs' :
                         (cargo === 'Gerente de Región') ? 'Estados' :
                         (cargo === 'Jefe de OPT') ? 'Mi OPT' : 'Regiones';
    barra.style.display = 'none';
    renderListaNivel0(cargo);
    return;
  }
  if (NIVEL === 1) {
    titulo.textContent = 'Estados de ' + REGION_SEL;
    barra.style.display = 'flex';
    actualizarMigas();
    renderListaEstados();
    return;
  }
  if (NIVEL === 2) {
    titulo.textContent = 'OPTs de ' + ESTADO_SEL;
    barra.style.display = 'flex';
    actualizarMigas();
    renderListaOpts();
    return;
  }
}

function renderListaNivel0(cargo) {
  const cont = document.getElementById('contenedorLista');

  if (cargo === 'Jefe de OPT') {
    const optUsuario = USUARIO.opt || '';
    let optEncontrada = null;
    ARBOL.forEach(r => r.estados.forEach(e => e.opts.forEach(o => {
      if (o.id === optUsuario) optEncontrada = o;
    })));
    if (!optEncontrada) {
      cont.innerHTML = '<div class="text-center text-muted py-4 small">No se encontró tu OPT.</div>';
      return;
    }
    cont.innerHTML = renderCabeceraOpts() + renderFilaOpt(optEncontrada);
    return;
  }
  if (cargo === 'Gerente de Estado') {
    const estadoUsuario = USUARIO.estado || '';
    let opts = [];
    ARBOL.forEach(r => r.estados.forEach(e => {
      if (e.nombre === estadoUsuario) opts = e.opts;
    }));
    if (!opts.length) {
      cont.innerHTML = '<div class="text-center text-muted py-4 small">Sin OPTs.</div>';
      return;
    }
    cont.innerHTML = renderCabeceraOpts() + opts.map(renderFilaOpt).join('');
    return;
  }
  if (cargo === 'Gerente de Región') {
    const region = ARBOL[0];
    if (!region || !region.estados.length) {
      cont.innerHTML = '<div class="text-center text-muted py-4 small">Sin estados.</div>';
      return;
    }
    REGION_SEL = region.nombre;
    cont.innerHTML = region.estados.map(e => renderFilaEstado(e)).join('');
    return;
  }
  if (!ARBOL.length) {
    cont.innerHTML = '<div class="text-center text-muted py-4 small">Sin regiones.</div>';
    return;
  }
  cont.innerHTML = ARBOL.map(renderFilaRegion).join('');
}

function renderCabeceraOpts() {
  return `
    <div class="fila-ente d-flex align-items-center px-3 py-2 border-bottom bg-light fw-bold small text-muted">
      <div class="flex-grow-1">OPT</div>
      <div style="width:80px;" class="text-center">Reporte</div>
      <div style="width:80px;" class="text-center">Estatus</div>
      <div style="width:80px;" class="text-center">Legalidad</div>
      <div style="width:20px;"></div>
    </div>
  `;
}

function renderListaEstados() {
  const cont = document.getElementById('contenedorLista');
  const region = ARBOL.find(r => r.nombre === REGION_SEL);
  if (!region || !region.estados.length) {
    cont.innerHTML = '<div class="text-center text-muted py-4 small">Sin estados.</div>';
    return;
  }
  cont.innerHTML = region.estados.map(e => renderFilaEstado(e)).join('');
}

function renderListaOpts() {
  const cont = document.getElementById('contenedorLista');
  const region = ARBOL.find(r => r.nombre === REGION_SEL);
  if (!region) return;
  const estado = region.estados.find(e => e.nombre === ESTADO_SEL);
  if (!estado || !estado.opts.length) {
    cont.innerHTML = '<div class="text-center text-muted py-4 small">Sin OPTs.</div>';
    return;
  }
  cont.innerHTML = renderCabeceraOpts() + estado.opts.map(o => renderFilaOpt(o)).join('');
}

function renderFilaRegion(region) {
  return `
    <div class="fila-ente d-flex align-items-center justify-content-between px-3 py-3 border-bottom"
         onclick="entrarRegion('${escapeAttr(region.nombre)}')" style="cursor:pointer;">
      <div class="d-flex align-items-center gap-2 flex-grow-1">
        <span class="nombre-ente">${escapeHtml(region.nombre)}</span>
        <span class="puntos-dotted"></span>
        ${renderIndicador(region.color)}
        ${renderContadorInactivas(region.inactivas)}
      </div>
      <span class="text-primary fs-5">›</span>
    </div>
  `;
}

function renderFilaEstado(estado) {
  return `
    <div class="fila-ente d-flex align-items-center justify-content-between px-3 py-3 border-bottom"
         onclick="entrarEstado('${escapeAttr(estado.nombre)}')" style="cursor:pointer;">
      <div class="d-flex align-items-center gap-2 flex-grow-1">
        <span class="nombre-ente">${escapeHtml(estado.nombre)}</span>
        <span class="puntos-dotted"></span>
        ${renderIndicador(estado.color)}
        ${renderContadorInactivas(estado.inactivas)}
      </div>
      <span class="text-primary fs-5">›</span>
    </div>
  `;
}

function renderFilaOpt(opt) {
  const inactivaTag = !opt.activa ? ' <small class="badge bg-warning text-dark">INACTIVA</small>' : '';
  return `
    <div class="fila-ente d-flex align-items-center px-3 py-3 border-bottom"
         onclick
