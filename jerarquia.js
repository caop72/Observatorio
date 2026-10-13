/**************************************************************
 * OEP - Panel Jerárquico de Escudriñamiento
 **************************************************************/

const API_URL = 'https://script.google.com/macros/s/AKfycbzn4bcq0uYlNnunsv8ePtzIzaHI606CjgXunrOVClZ29pYhXP5CcFPAUck7O0V31CeJOQ/exec';

let TOKEN = '';
let USUARIO = null;
let SEMAFOROS = null;

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

  cargarSemaforos();
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
// SEMÁFOROS
// ============================================================
async function cargarSemaforos() {
  const cont = document.getElementById('contenedorSemaforos');
  cont.innerHTML = '<div class="text-center text-muted py-4">Cargando semáforos...</div>';

  try {
    const data = await apiGet({ accion: 'obtenerSemaforos', token: TOKEN });
    if (!data.ok) {
      cont.innerHTML = '<div class="alert alert-danger">' + (data.error || 'Error') + '</div>';
      return;
    }
    SEMAFOROS = data;
    renderSemaforos(data);
  } catch (e) {
    cont.innerHTML = '<div class="alert alert-danger">Error de red: ' + e.message + '</div>';
  }
}

function renderSemaforos(data) {
  const cont = document.getElementById('contenedorSemaforos');
  if (!data.entes || data.entes.length === 0) {
    cont.innerHTML = '<div class="text-center text-muted py-4">No hay entes para mostrar.</div>';
    return;
  }

  let html = '';
  data.entes.forEach(ente => {
    html += `
      <div class="semaforo-fila d-flex align-items-center justify-content-between mb-3">
        <div class="flex-grow-1">
          <div class="fw-semibold mb-1">${escapeHtml(ente.nombre)}</div>
          <div class="semaforo-puntos">
            ${ente.dias.map(d => renderPunto(d)).join('')}
          </div>
        </div>
        <button class="btn btn-sm btn-outline-primary ms-3"
                onclick="verHistorial('${escapeAttr(ente.tipo)}','${escapeAttr(ente.id)}','${escapeAttr(ente.nombre)}')">
          Ver historial
        </button>
      </div>
      <hr>
    `;
  });
  cont.innerHTML = html;
}

function renderPunto(dia) {
  const fecha = dia.fecha;
  const partes = fecha.split('-');
  const fechaFmt = partes[2] + '/' + partes[1];
  const titulo = `${fecha} — ${dia.reportaron}/${dia.total} OPTs reportaron`;
  return `<span class="semaforo-punto ${dia.color}" title="${titulo}"></span>`;
}

// ============================================================
// HISTORIAL POR ENTE
// ============================================================
async function verHistorial(tipoEnte, idEnte, nombreEnte) {
  const modal = new bootstrap.Modal(document.getElementById('modalHistorial'));
  document.getElementById('modalTitulo').textContent = 'Historial — ' + nombreEnte;
  document.getElementById('contenidoHistorial').innerHTML =
    '<div class="text-center text-muted py-4">Cargando...</div>';
  modal.show();

  try {
    const data = await apiGet({
      accion: 'obtenerHistorialEnte',
      token: TOKEN,
      tipoEnte: tipoEnte,
      idEnte: idEnte
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
  if (acciones.length === 0) {
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
