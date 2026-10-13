/**************************************************************
 * OEP - Panel Jerárquico de Escudriñamiento (Fase J.5 v3)
 * Navegación secuencial: una pantalla a la vez
 **************************************************************/

const API_URL = 'https://script.google.com/macros/s/AKfycbzn4bcq0uYlNnunsv8ePtzIzaHI606CjgXunrOVClZ29pYhXP5CcFPAUck7O0V31CeJOQ/exec';

let TOKEN = '';
let USUARIO = null;
let ARBOL = [];
let NIVEL = 0;                    // 0=Regiones, 1=Estados, 2=OPTs
let REGION_SEL = null;
let ESTADO_SEL = null;

// ============================================================
// INICIALIZACIÓN
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  TOKEN = localStorage.getItem('oep_token') || localStorage.getItem('token') || '';
  const userRaw = localStorage.getItem('oep_usuario') || localStorage.getItem('usuario');
  USUARIO = userRaw ? JSON.parse(userRaw) : null;

  if (!TOKEN) { window.location.href = 'index.html'; return; }

  if (USUARIO) {
    document.getElementById('infoCargo').textContent =
      (USUARIO.nombres || '') + ' — ' + (USUARIO.cargo || '');
  }

  document.getElementById('btnSalir').addEventListener('click', cerrarSesion);
  cargarArbol();
});

// ============================================================
// API
// ============================================================
async function apiGet(params) {
  const url = new URL(API_URL);
  Object.keys(params).forEach(k => url.searchParams.set(k, params[k]));
  const res = await fetch(url.toString());
  return await res.json();
}

// ============================================================
// CARGA INICIAL
// ============================================================
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

// ============================================================
// RENDER PRINCIPAL (según NIVEL)
// ============================================================
function renderNivel() {
  const cargo = USUARIO ? USUARIO.cargo : '';
  const cont = document.getElementById('contenedorLista');
  const titulo = document.getElementById('tituloNivel');
  const barra = document.getElementById('barraNavegacion');

  // ---- NIVEL 0 ----
  if (NIVEL === 0) {
    titulo.textContent = (cargo === 'Gerente de Estado') ? 'OPTs' :
                         (cargo === 'Gerente de Región') ? 'Estados' :
                         (cargo === 'Jefe de OPT') ? 'Mi OPT' : 'Regiones';

    // Ajustar nivel de inicio según rol
    if (cargo === 'Gerente de Región') {
      // Ya muestra Estados directo
    } else if (cargo === 'Gerente de Estado' || cargo === 'Jefe de OPT') {
      // Muestra OPTs directo
    }

    barra.style.display = 'none';
    renderListaNivel0(cargo);
    return;
  }

  // ---- NIVEL 1 (Estados) ----
  if (NIVEL === 1) {
    titulo.textContent = 'Estados de ' + REGION_SEL;
    barra.style.display = '';
    actualizarMigas();
    renderListaEstados();
    return;
  }

  // ---- NIVEL 2 (OPTs) ----
  if (NIVEL === 2) {
    titulo.textContent = 'OPTs de ' + ESTADO_SEL;
    barra.style.display = '';
    actualizarMigas();
    renderListaOpts();
    return;
  }
}

function renderListaNivel0(cargo) {
  const cont = document.getElementById('contenedorLista');

  // Jefe de OPT: buscar su OPT dentro del árbol
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
    cont.innerHTML = renderFilaOpt(optEncontrada);
    return;
  }

  // Gerente de Estado: mostrar sus OPTs (buscando el estado del usuario)
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
    cont.innerHTML = opts.map(renderFilaOpt).join('');
    return;
  }

  // Gerente de Región: mostrar Estados directamente
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

  // CNC / Despacho / Observatorio / Presidencia: mostrar Regiones
  if (!ARBOL.length) {
    cont.innerHTML = '<div class="text-center text-muted py-4 small">Sin regiones.</div>';
    return;
  }
  cont.innerHTML = ARBOL.map(renderFilaRegion).join('');
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
  cont.innerHTML = estado.opts.map(o => renderFilaOpt(o)).join('');
}

// ============================================================
// FILAS
// ============================================================
function renderFilaRegion(region) {
  return `
    <div class="fila-ente d-flex align-items-center justify-content-between px-3 py-3 border-bottom"
         onclick="entrarRegion('${escapeAttr(region.nombre)}')"
         style="cursor:pointer;">
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
         onclick="entrarEstado('${escapeAttr(estado.nombre)}')"
         style="cursor:pointer;">
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
  return `
    <div class="fila-ente d-flex align-items-center justify-content-between px-3 py-3 border-bottom"
         onclick="abrirHistorialOpt('${escapeAttr(opt.id)}','${escapeAttr(opt.nombre)}')"
         style="cursor:pointer;">
      <div class="d-flex align-items-center gap-2 flex-grow-1">
        <span class="nombre-ente">${escapeHtml(opt.nombre)} <small class="text-muted">(${escapeHtml(opt.id)})</small></span>
        <span class="puntos-dotted"></span>
        ${renderIndicador(opt.color)}
      </div>
      <span class="text-primary fs-6">›</span>
    </div>
  `;
}

// ============================================================
// NAVEGACIÓN
// ============================================================
function entrarRegion(nombre) {
  REGION_SEL = nombre;
  ESTADO_SEL = null;
  NIVEL = 1;
  renderNivel();
  window.scrollTo(0, 0);
}

function entrarEstado(nombre) {
  ESTADO_SEL = nombre;
  NIVEL = 2;
  renderNivel();
  window.scrollTo(0, 0);
}

function volverNivel() {
  if (NIVEL === 2) {
    NIVEL = 1;
    ESTADO_SEL = null;
  } else if (NIVEL === 1) {
    NIVEL = 0;
    REGION_SEL = null;
  }
  renderNivel();
  window.scrollTo(0, 0);
}

function actualizarMigas() {
  const migas = document.getElementById('migasPan');
  let html = '<li class="breadcrumb-item"><a href="#" class="text-white-50" onclick="volverNivel();return false;">Inicio</a></li>';
  if (NIVEL >= 1 && REGION_SEL) {
    html += '<li class="breadcrumb-item text-white">' + escapeHtml(REGION_SEL) + '</li>';
  }
  if (NIVEL >= 2 && ESTADO_SEL) {
    html += '<li class="breadcrumb-item text-white">' + escapeHtml(ESTADO_SEL) + '</li>';
  }
  migas.innerHTML = html;
}

// ============================================================
// INDICADORES
// ============================================================
function renderIndicador(color) {
  return `<span class="semaforo-punto ${color}" title="${tituloColor(color)}"></span>`;
}

function renderContadorInactivas(n) {
  if (!n || n <= 0) return '';
  return `<span class="semaforo-punto naranja-contador" title="${n} OPTs inactivas">${n}</span>`;
}

function tituloColor(color) {
  const map = {
    verde: 'Sin novedad',
    amarillo: 'Por reparar (objetado)',
    rojo: 'Sin reportar',
    blanco: 'Aún en plazo',
    naranja: 'Inactiva'
  };
  return map[color] || color;
}

// ============================================================
// HISTORIAL DE OPT
// ============================================================
async function abrirHistorialOpt(idOpt, nombreOpt) {
  const modal = new bootstrap.Modal(document.getElementById('modalHistorial'));
  document.getElementById('modalTitulo').textContent = 'Historial — ' + nombreOpt + ' (' + idOpt + ')';
  document.getElementById('contenidoHistorial').innerHTML =
    '<div class="text-center text-muted py-4">Cargando...</div>';
  modal.show();

  try {
    const data = await apiGet({
      accion: 'obtenerHistorialEnte',
      token: TOKEN,
      tipoEnte: 'OPT',
      idEnte: idOpt
    });

    if (!data.ok) {
      document.getElementById('contenidoHistorial').innerHTML =
        '<div class="alert alert-danger">' + (data.error || 'Error') + '</div>';
      return;
    }
    renderHistorial(data.acciones || []);
  } catch (e) {
    document.getElementById('contenidoHistorial').innerHTML =
      '<div class="alert alert-danger">Error: ' + e.message + '</div>';
  }
}

function renderHistorial(acciones) {
  const cont = document.getElementById('contenidoHistorial');
  if (!acciones.length) {
    cont.innerHTML = '<div class="text-center text-muted py-4">No hay acciones registradas.</div>';
    return;
  }
  let html = `
    <div class="table-responsive">
      <table class="table table-sm table-hover">
        <thead class="table-light">
          <tr>
            <th>Fecha</th><th>Hora</th><th>Reporte</th><th>Usuario</th>
            <th>Rol</th><th>Acción</th><th>Comentario</th>
          </tr>
        </thead><tbody>
  `;
  acciones.forEach(a => {
    html += `
      <tr>
        <td>${formatearFecha(a.fecha)}</td>
        <td>${formatearHora(a.hora)}</td>
        <td><code>${escapeHtml(a.idReporte || '')}</code></td>
        <td>${escapeHtml(a.usuario || '')}</td>
        <td><span class="badge bg-secondary">${escapeHtml(a.rol || '')}</span></td>
        <td>${escapeHtml(a.accion || '')}</td>
        <td>${escapeHtml(a.comentario || '')}</td>
      </tr>`;
  });
  html += '</tbody></table></div>';
  cont.innerHTML = html;
}

// ============================================================
// UTILIDADES
// ============================================================
function formatearFecha(f) {
  if (!f) return '';
  if (typeof f === 'string' && f.length >= 10) {
    const p = f.substring(0, 10).split('-');
    return p[2] + '/' + p[1] + '/' + p[0];
  }
  return String(f);
}

function formatearHora(h) {
  if (!h) return '';
  return String(h).substring(0, 5);
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeAttr(s) {
  return String(s == null ? '' : s).replace(/'/g, "\\'");
}

function cerrarSesion() {
  const t = TOKEN;
  localStorage.removeItem('oep_token');
  localStorage.removeItem('token');
  localStorage.removeItem('oep_usuario');
  localStorage.removeItem('usuario');
  apiGet({ accion: 'logout', token: t }).finally(() => {
    window.location.href = 'index.html';
  });
}
