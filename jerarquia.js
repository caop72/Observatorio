/**************************************************************
 * OEP - Panel Jerárquico de Escudriñamiento (Fase J.5 v2)
 **************************************************************/

const API_URL = 'https://script.google.com/macros/s/AKfycbzn4bcq0uYlNnunsv8ePtzIzaHI606CjgXunrOVClZ29pYhXP5CcFPAUck7O0V31CeJOQ/exec';

let TOKEN = '';
let USUARIO = null;
let ARBOL = [];
let REGION_SEL = null;
let ESTADO_SEL = null;

// ============================================================
// INICIALIZACIÓN
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  TOKEN = localStorage.getItem('oep_token') || localStorage.getItem('token') || '';
  const userRaw = localStorage.getItem('oep_usuario') || localStorage.getItem('usuario');
  USUARIO = userRaw ? JSON.parse(userRaw) : null;

  if (!TOKEN) {
    window.location.href = 'index.html';
    return;
  }

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
// CARGA DEL ÁRBOL
// ============================================================
async function cargarArbol() {
  const col1 = document.getElementById('columna1');
  col1.innerHTML = '<div class="text-center text-muted py-4">Cargando...</div>';

  try {
    const data = await apiGet({ accion: 'obtenerArbolJerarquico', token: TOKEN });
    if (!data.ok) {
      col1.innerHTML = '<div class="alert alert-danger m-3">' + (data.error || 'Error') + '</div>';
      return;
    }
    ARBOL = data.arbol || [];
    configurarTitulos(data.cargo);
    renderColumna1();
  } catch (e) {
    col1.innerHTML = '<div class="alert alert-danger m-3">Error de red: ' + e.message + '</div>';
  }
}

function configurarTitulos(cargo) {
  if (cargo === 'Gerente de Estado') {
    document.getElementById('tituloCol1').textContent = 'OPTs';
    document.getElementById('columna1').parentElement.parentElement.className = 'col-md-12';
    document.getElementById('columna2').parentElement.parentElement.style.display = 'none';
    document.getElementById('columna3').parentElement.parentElement.style.display = 'none';
  } else if (cargo === 'Gerente de Región') {
    document.getElementById('tituloCol1').textContent = 'Estados';
    document.getElementById('tituloCol2').textContent = 'OPTs';
    document.getElementById('columna3').parentElement.parentElement.style.display = 'none';
  } else if (cargo === 'Jefe de OPT') {
    document.getElementById('tituloCol1').textContent = 'Mi OPT';
    document.getElementById('columna1').parentElement.parentElement.className = 'col-md-12';
    document.getElementById('columna2').parentElement.parentElement.style.display = 'none';
    document.getElementById('columna3').parentElement.parentElement.style.display = 'none';
  }
  // CNC / Despacho / Observatorio / Presidencia: 3 columnas por defecto
}

// ============================================================
// RENDER COLUMNA 1
// ============================================================
function renderColumna1() {
  const col1 = document.getElementById('columna1');
  const cargo = USUARIO ? USUARIO.cargo : '';

  // Caso Gerente de Estado: mostrar OPTs directo (columna 1 = OPTs)
  if (cargo === 'Gerente de Estado') {
    const estado = ARBOL[0] && ARBOL[0].estados[0];
    if (!estado || !estado.opts.length) {
      col1.innerHTML = '<div class="text-center text-muted py-4 small">Sin OPTs registradas.</div>';
      return;
    }
    col1.innerHTML = estado.opts.map(o => renderFilaOpt(o)).join('');
    return;
  }

  // Caso Jefe de OPT: mostrar su OPT
  if (cargo === 'Jefe de OPT') {
    const estado = ARBOL[0] && ARBOL[0].estados[0];
    if (!estado || !estado.opts.length) {
      col1.innerHTML = '<div class="text-center text-muted py-4 small">Sin datos.</div>';
      return;
    }
    col1.innerHTML = estado.opts.map(o => renderFilaOpt(o)).join('');
    return;
  }

  // Caso Gerente de Región: mostrar Estados directo
  if (cargo === 'Gerente de Región') {
    const region = ARBOL[0];
    if (!region || !region.estados.length) {
      col1.innerHTML = '<div class="text-center text-muted py-4 small">Sin estados.</div>';
      return;
    }
    col1.innerHTML = region.estados.map(e => renderFilaEstado(e, region.nombre)).join('');
    return;
  }

  // Caso global (Observatorio, CNC, Despacho, Presidencia): mostrar Regiones
  if (!ARBOL.length) {
    col1.innerHTML = '<div class="text-center text-muted py-4 small">Sin regiones registradas.</div>';
    return;
  }
  col1.innerHTML = ARBOL.map(r => renderFilaRegion(r)).join('');
}

// ============================================================
// FILAS
// ============================================================
function renderFilaRegion(region) {
  return `
    <div class="fila-ente d-flex align-items-center justify-content-between px-3 py-2 border-bottom"
         data-region="${escapeAttr(region.nombre)}">
      <div class="d-flex align-items-center gap-2 flex-grow-1">
        <span class="nombre-ente">${escapeHtml(region.nombre)}</span>
        <span class="puntos-dotted"></span>
        ${renderIndicador(region.color)}
        ${renderContadorInactivas(region.inactivas)}
      </div>
      <button class="btn btn-sm btn-outline-primary lupa"
              onclick="seleccionarRegion('${escapeAttr(region.nombre)}')"
              title="Ver Estados">🔍</button>
    </div>
  `;
}

function renderFilaEstado(estado, regionNombre) {
  return `
    <div class="fila-ente d-flex align-items-center justify-content-between px-3 py-2 border-bottom"
         data-estado="${escapeAttr(estado.nombre)}">
      <div class="d-flex align-items-center gap-2 flex-grow-1">
        <span class="nombre-ente">${escapeHtml(estado.nombre)}</span>
        <span class="puntos-dotted"></span>
        ${renderIndicador(estado.color)}
        ${renderContadorInactivas(estado.inactivas)}
      </div>
      <button class="btn btn-sm btn-outline-primary lupa"
              onclick="seleccionarEstado('${escapeAttr(regionNombre)}','${escapeAttr(estado.nombre)}')"
              title="Ver OPTs">🔍</button>
    </div>
  `;
}

function renderFilaOpt(opt) {
  return `
    <div class="fila-ente d-flex align-items-center justify-content-between px-3 py-2 border-bottom"
         data-opt="${escapeAttr(opt.id)}" style="cursor:pointer;"
         onclick="abrirHistorialOpt('${escapeAttr(opt.id)}','${escapeAttr(opt.nombre)}')">
      <div class="d-flex align-items-center gap-2 flex-grow-1">
        <span class="nombre-ente">${escapeHtml(opt.nombre)} <small class="text-muted">(${escapeHtml(opt.id)})</small></span>
        <span class="puntos-dotted"></span>
        ${renderIndicador(opt.color)}
      </div>
      <span class="badge bg-light text-dark small">Ver historial</span>
    </div>
  `;
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
// SELECCIÓN / NAVEGACIÓN
// ============================================================
function seleccionarRegion(nombreRegion) {
  REGION_SEL = nombreRegion;
  ESTADO_SEL = null;

  // Marcar fila seleccionada
  document.querySelectorAll('#columna1 .fila-ente').forEach(el => el.classList.remove('activa'));
  const fila = document.querySelector(`#columna1 .fila-ente[data-region="${cssEscape(nombreRegion)}"]`);
  if (fila) fila.classList.add('activa');

  const region = ARBOL.find(r => r.nombre === nombreRegion);
  if (!region) return;

  const col2 = document.getElementById('columna2');
  if (!region.estados.length) {
    col2.innerHTML = '<div class="text-center text-muted py-4 small">Sin estados.</div>';
    return;
  }
  col2.innerHTML = region.estados.map(e => renderFilaEstado(e, region.nombre)).join('');

  document.getElementById('columna3').innerHTML =
    '<div class="text-center text-muted py-4 small">Selecciona un estado</div>';
}

function seleccionarEstado(nombreRegion, nombreEstado) {
  ESTADO_SEL = nombreEstado;

  document.querySelectorAll('#columna2 .fila-ente').forEach(el => el.classList.remove('activa'));
  const fila = document.querySelector(`#columna2 .fila-ente[data-estado="${cssEscape(nombreEstado)}"]`);
  if (fila) fila.classList.add('activa');

  const region = ARBOL.find(r => r.nombre === nombreRegion);
  if (!region) return;
  const estado = region.estados.find(e => e.nombre === nombreEstado);
  if (!estado) return;

  const col3 = document.getElementById('columna3');
  if (!estado.opts.length) {
    col3.innerHTML = '<div class="text-center text-muted py-4 small">Sin OPTs.</div>';
    return;
  }
  col3.innerHTML = estado.opts.map(o => renderFilaOpt(o)).join('');
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
            <th>Fecha</th>
            <th>Hora</th>
            <th>Reporte</th>
            <th>Usuario</th>
            <th>Rol</th>
            <th>Acción</th>
            <th>Comentario</th>
          </tr>
        </thead>
        <tbody>
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
      </tr>
    `;
  });
  html += '</tbody></table></div>';
  cont.innerHTML = html;
}

// ============================================================
// UTILIDADES
// ============================================================
function formatearFecha(f) {
  if (!f) return '';
  if (typeof f === 'string' && f.indexOf('T') !== -1) {
    const d = new Date(f);
    if (!isNaN(d)) {
      return String(d.getDate()).padStart(2, '0') + '/' +
             String(d.getMonth() + 1).padStart(2, '0') + '/' +
             d.getFullYear();
    }
  }
  if (typeof f === 'string' && f.length >= 10) {
    const p = f.substring(0, 10).split('-');
    return p[2] + '/' + p[1] + '/' + p[0];
  }
  return String(f);
}

function formatearHora(h) {
  if (!h) return '';
  if (typeof h === 'string' && h.indexOf('T') !== -1) {
    const d = new Date(h);
    if (!isNaN(d)) {
      return String(d.getHours()).padStart(2, '0') + ':' +
             String(d.getMinutes()).padStart(2, '0');
    }
  }
  return String(h).substring(0, 5);
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(s) {
  return String(s == null ? '' : s).replace(/'/g, "\\'");
}

function cssEscape(s) {
  return String(s == null ? '' : s).replace(/"/g, '\\"');
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
