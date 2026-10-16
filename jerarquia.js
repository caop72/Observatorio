/**************************************************************
 * OEP - Panel Jerárquico (v7)
 * Columnas: Reporte | Estatus | Legalidad
 **************************************************************/

const API_URL = 'https://script.google.com/macros/s/AKfycbzn4bcq0uYlNnunsv8ePtzIzaHI606CjgXunrOVClZ29pYhXP5CcFPAUck7O0V31CeJOQ/exec';

let TOKEN = '';
let USUARIO = null;
let ARBOL = [];
let NIVEL = 0;
let REGION_SEL = null;
let ESTADO_SEL = null;

// ============================================================
// ARRANQUE
// ============================================================
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

// ============================================================
// CERRAR SESIÓN
// ============================================================
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
// RENDER PRINCIPAL
// ============================================================
function renderNivel() {
  actualizarContadoresLeyenda();

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

// ============================================================
// FILAS (bloques de contadores)
// ============================================================
function renderBloqueReporte(c) {
  return `
    <span class="semaforo-punto contador-blanco" title="${c.reporte.enPlazo} en plazo">${c.reporte.enPlazo}</span>
    <span class="semaforo-punto contador-verde" title="${c.reporte.sinNovedad} sin novedad">${c.reporte.sinNovedad}</span>
    <span class="semaforo-punto contador-amarillo" title="${c.reporte.objetado} objetado">${c.reporte.objetado}</span>
    <span class="semaforo-punto contador-rojo" title="${c.reporte.sinReportar} sin reportar">${c.reporte.sinReportar}</span>
  `;
}

function renderBloqueEstatus(c) {
  return `
    <span class="semaforo-punto contador-verde" title="${c.estatus.operativa} operativas">${c.estatus.operativa}</span>
    <span class="semaforo-punto contador-naranja" title="${c.estatus.inoperativa} inoperativas">${c.estatus.inoperativa}</span>
    <span class="semaforo-punto contador-rojo" title="${c.estatus.porCierreTecnico} por cierre técnico">${c.estatus.porCierreTecnico}</span>
  `;
}

function renderBloqueLegalidad(c) {
  return `
    <span class="semaforo-punto contador-verde" title="${c.legalidad.propia} propias">${c.legalidad.propia}</span>
    <span class="semaforo-punto contador-naranja" title="${c.legalidad.arrendada} arrendadas">${c.legalidad.arrendada}</span>
    <span class="semaforo-punto contador-amarillo" title="${c.legalidad.comodato} comodato">${c.legalidad.comodato}</span>
  `;
}

function renderFilaRegion(region) {
  const c = region.contadores || {
    reporte:   { enPlazo: 0, sinNovedad: 0, objetado: 0, sinReportar: 0 },
    estatus:   { operativa: 0, inoperativa: 0, porCierreTecnico: 0 },
    legalidad: { propia: 0, arrendada: 0, comodato: 0 }
  };
  return `
    <div class="fila-ente d-flex align-items-center px-3 py-3 border-bottom"
         onclick="entrarRegion('${escapeAttr(region.nombre)}')" style="cursor:pointer;">
      <div class="flex-grow-1">
        <span class="nombre-ente">${escapeHtml(region.nombre)}</span>
        <span class="text-primary fs-5 ms-2">›</span>
      </div>
      <div style="width:200px;" class="text-center d-flex justify-content-center gap-1">
        ${renderBloqueReporte(c)}
      </div>
      <div style="width:200px;" class="text-center d-flex justify-content-center gap-1">
        ${renderBloqueEstatus(c)}
      </div>
      <div style="width:200px;" class="text-center d-flex justify-content-center gap-1">
        ${renderBloqueLegalidad(c)}
      </div>
    </div>
  `;
}

function renderFilaEstado(estado) {
  const c = estado.contadores || {
    reporte:   { enPlazo: 0, sinNovedad: 0, objetado: 0, sinReportar: 0 },
    estatus:   { operativa: 0, inoperativa: 0, porCierreTecnico: 0 },
    legalidad: { propia: 0, arrendada: 0, comodato: 0 }
  };
  return `
    <div class="fila-ente d-flex align-items-center px-3 py-3 border-bottom"
         onclick="entrarEstado('${escapeAttr(estado.nombre)}')" style="cursor:pointer;">
      <div class="flex-grow-1">
        <span class="nombre-ente">${escapeHtml(estado.nombre)}</span>
        <span class="text-primary fs-5 ms-2">›</span>
      </div>
      <div style="width:200px;" class="text-center d-flex justify-content-center gap-1">
        ${renderBloqueReporte(c)}
      </div>
      <div style="width:200px;" class="text-center d-flex justify-content-center gap-1">
        ${renderBloqueEstatus(c)}
      </div>
      <div style="width:200px;" class="text-center d-flex justify-content-center gap-1">
        ${renderBloqueLegalidad(c)}
      </div>
    </div>
  `;
}

function renderFilaOpt(opt) {
  const inactivaTag = !opt.activa ? ' <small class="badge bg-warning text-dark">INACTIVA</small>' : '';
  return `
    <div class="fila-ente d-flex align-items-center px-3 py-3 border-bottom"
         onclick="abrirHistorialOpt('${escapeAttr(opt.id)}','${escapeAttr(opt.nombre)}')" style="cursor:pointer;">
      <div class="flex-grow-1">
        <span class="nombre-ente">${escapeHtml(opt.nombre)} <small class="text-muted">(${escapeHtml(opt.id)})</small></span>${inactivaTag}
      </div>
      <div style="width:80px;" class="text-center">${renderIndicador(opt.color)}</div>
      <div style="width:80px;" class="text-center">${renderIndicador(opt.colorEstatus || 'blanco')}</div>
      <div style="width:80px;" class="text-center">${renderIndicador(opt.colorLegalidad || 'blanco')}</div>
      <div style="width:20px;" class="text-end text-primary fs-6">›</div>
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
  if (NIVEL === 2) { NIVEL = 1; ESTADO_SEL = null; }
  else if (NIVEL === 1) { NIVEL = 0; REGION_SEL = null; }
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

function tituloColor(color) {
  const map = {
    verde: 'OK / Sin novedad',
    amarillo: 'Atención (por reparar / comodato)',
    rojo: 'Alarmante (sin reportar / cierre técnico)',
    blanco: 'Sin dato / En plazo',
    naranja: 'Inoperativa / Arrendada'
  };
  return map[color] || color;
}

// ============================================================
// CONTADORES DE LEYENDA (según nivel actual)
// ============================================================
function actualizarContadoresLeyenda() {
  const c = {
    reporte:   { enPlazo: 0, sinNovedad: 0, objetado: 0, sinReportar: 0 },
    estatus:   { operativa: 0, inoperativa: 0, porCierreTecnico: 0 },
    legalidad: { propia: 0, arrendada: 0, comodato: 0 }
  };

  let estadosVisibles = [];

  if (NIVEL === 0) {
    ARBOL.forEach(r => (r.estados || []).forEach(e => estadosVisibles.push(e)));
  } else if (NIVEL === 1) {
    const region = ARBOL.find(r => r.nombre === REGION_SEL);
    if (region) (region.estados || []).forEach(e => estadosVisibles.push(e));
  } else if (NIVEL === 2) {
    const region = ARBOL.find(r => r.nombre === REGION_SEL);
    if (region) {
      const estado = region.estados.find(e => e.nombre === ESTADO_SEL);
      if (estado) estadosVisibles.push(estado);
    }
  }

  let totalOpts = 0;

  estadosVisibles.forEach(e => {
    if (!e.contadores) return;
    c.reporte.enPlazo     += e.contadores.reporte.enPlazo;
    c.reporte.sinNovedad  += e.contadores.reporte.sinNovedad;
    c.reporte.objetado    += e.contadores.reporte.objetado;
    c.reporte.sinReportar += e.contadores.reporte.sinReportar;

    c.estatus.operativa        += e.contadores.estatus.operativa;
    c.estatus.inoperativa      += e.contadores.estatus.inoperativa;
    c.estatus.porCierreTecnico += e.contadores.estatus.porCierreTecnico;

    c.legalidad.propia    += e.contadores.legalidad.propia;
    c.legalidad.arrendada += e.contadores.legalidad.arrendada;
    c.legalidad.comodato  += e.contadores.legalidad.comodato;

    totalOpts += (e.opts || []).length;
  });

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('cnt-rep-enplazo',       c.reporte.enPlazo);
  set('cnt-rep-sinnovedad',    c.reporte.sinNovedad);
  set('cnt-rep-objetado',      c.reporte.objetado);
  set('cnt-rep-sinreportar',   c.reporte.sinReportar);
  set('cnt-est-operativa',     c.estatus.operativa);
  set('cnt-est-inoperativa',   c.estatus.inoperativa);
  set('cnt-est-porcierre',     c.estatus.porCierreTecnico);
  set('cnt-leg-propia',        c.legalidad.propia);
  set('cnt-leg-arrendada',     c.legalidad.arrendada);
  set('cnt-leg-comodato',      c.legalidad.comodato);
  set('total-opts',            totalOpts);
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
            <th>Rol</th><th>Acción</th><th>Comentario</th><th>Documentos</th>
          </tr>
        </thead><tbody>
  `;
  acciones.forEach(a => {
    const tieneReporte = a.idReporte && String(a.idReporte).trim() !== '';
    const botones = tieneReporte
      ? `<button class="btn btn-sm btn-outline-primary me-1" title="Ver reporte"
                 onclick="verReporteDesdeHistorial('${escapeAttr(a.idReporte)}')">👁</button>
         <button class="btn btn-sm btn-outline-danger" title="Descargar PDF"
                 onclick="descargarPdfDesdeHistorial('${escapeAttr(a.idReporte)}')">📄</button>`
      : '<span class="text-muted small">—</span>';

    html += `
      <tr>
        <td>${formatearFecha(a.fecha)}</td>
        <td>${formatearHora(a.hora)}</td>
        <td><code>${escapeHtml(a.idReporte || '')}</code></td>
        <td>${escapeHtml(a.usuario || '')}</td>
        <td><span class="badge bg-secondary">${escapeHtml(a.rol || '')}</span></td>
        <td>${escapeHtml(a.accion || '')}</td>
        <td>${escapeHtml(a.comentario || '')}</td>
        <td class="text-nowrap">${botones}</td>
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

// ============================================================
// VER REPORTE DESDE HISTORIAL
// ============================================================
async function verReporteDesdeHistorial(idReporte) {
  const modal = new bootstrap.Modal(document.getElementById('modalHistorial'));
  // Reutilizamos el modal de historial cambiando su contenido
  document.getElementById('modalTitulo').textContent = 'Reporte — ' + idReporte;
  document.getElementById('contenidoHistorial').innerHTML =
    '<div class="text-center text-muted py-4">Cargando...</div>';

  try {
    const r = await apiGet({ accion: 'obtenerReporteCompleto', idReporte: idReporte });
    if (!r.ok) {
      document.getElementById('contenidoHistorial').innerHTML =
        '<div class="alert alert-danger">' + (r.error || 'Error') + '</div>';
      return;
    }

    const rep = r.reporte || {};
    const opt = r.opt || {};
    const v = r.valores || {};

    let html = '';

    // Datos de la OPT
    html += '<h6 class="border-bottom pb-1">Datos de la OPT</h6>';
    html += '<table class="table table-sm">';
    html += `<tr><td><strong>ID</strong></td><td>${escapeHtml(opt.id || rep.idOpt)}</td></tr>`;
    html += `<tr><td><strong>Nombre</strong></td><td>${escapeHtml(opt.nombre || '')}</td></tr>`;
    html += `<tr><td><strong>Estado</strong></td><td>${escapeHtml(opt.estado || '')}</td></tr>`;
    html += `<tr><td><strong>Estatus operativo</strong></td><td>${escapeHtml(opt.estatusOperativo || '')}</td></tr>`;
    html += `<tr><td><strong>Abierta</strong></td><td>${escapeHtml(opt.abierta || '')}</td></tr>`;
    html += `<tr><td><strong>Observaciones OPT</strong></td><td>${escapeHtml(opt.observaciones || '')}</td></tr>`;
    html += '</table>';

    // Reporte del día
    html += '<h6 class="border-bottom pb-1 mt-3">Reporte del día</h6>';
    html += '<table class="table table-sm">';
    html += `<tr><td><strong>Fecha</strong></td><td>${rep.fecha} ${rep.hora}</td></tr>`;
    html += `<tr><td><strong>Jefe de OPT</strong></td><td>${escapeHtml(r.nombreJefe || '')}</td></tr>`;
    html += `<tr><td><strong>Estatus</strong></td><td>${escapeHtml(v.estatus || '')}</td></tr>`;
    html += `<tr><td><strong>¿Abierta?</strong></td><td>${escapeHtml(v.abierta || '')}</td></tr>`;
    html += `<tr><td><strong>Estatus legal</strong></td><td>${escapeHtml(v.estatus_legal || '')}</td></tr>`;
    html += `<tr><td><strong>Observación</strong></td><td>${escapeHtml(v.observacion || '')}</td></tr>`;
    if (v.causa) html += `<tr><td><strong>Causa</strong></td><td>${escapeHtml(v.causa)}</td></tr>`;
    html += '</table>';

    // Parte del personal
    html += '<h6 class="border-bottom pb-1 mt-3">Parte del Personal</h6>';
    html += '<table class="table table-sm table-bordered text-center">';
    html += '<thead class="table-light"><tr><th>Tipo</th><th>Presentes</th><th>Reposo</th><th>Comisión</th><th>Permiso</th><th>Suspendido</th><th>Activos</th><th>Vacantes</th><th>Total</th></tr></thead><tbody>';
    ['directivos','empleados','obreros','contratados'].forEach(t => {
      const pres = parseInt(v['presentes_'+t],10)||0;
      const rep_ = parseInt(v['reposo_'+t],10)||0;
      const com  = parseInt(v['comision_'+t],10)||0;
      const per  = parseInt(v['permiso_'+t],10)||0;
      const sus  = parseInt(v['suspendido_'+t],10)||0;
      const act  = pres + rep_ + com + per + sus;
      const vac  = parseInt(v['vacantes_'+t],10)||0;
      html += `<tr><td><strong>${t.charAt(0).toUpperCase()+t.slice(1)}</strong></td>
               <td>${pres}</td><td>${rep_}</td><td>${com}</td><td>${per}</td><td>${sus}</td>
               <td class="bg-light"><strong>${act}</strong></td>
               <td>${vac}</td><td><strong>${act+vac}</strong></td></tr>`;
    });
    html += '</tbody></table>';

    // Novedades
    if (v.novedad_vehiculos || v.novedad_infraestructura || v.novedad_conectividad || v.observaciones) {
      html += '<h6 class="border-bottom pb-1 mt-3">Novedades</h6>';
      html += '<table class="table table-sm">';
      if (v.novedad_vehiculos)       html += `<tr><td><strong>Vehículos</strong></td><td>${escapeHtml(v.novedad_vehiculos)}</td></tr>`;
      if (v.novedad_infraestructura) html += `<tr><td><strong>Infraestructura</strong></td><td>${escapeHtml(v.novedad_infraestructura)}</td></tr>`;
      if (v.novedad_conectividad)    html += `<tr><td><strong>Conectividad</strong></td><td>${escapeHtml(v.novedad_conectividad)}</td></tr>`;
      if (v.observaciones)           html += `<tr><td><strong>Observaciones</strong></td><td>${escapeHtml(v.observaciones)}</td></tr>`;
      html += '</table>';
    }

    // Validaciones
    if (r.validaciones && r.validaciones.length > 0) {
      html += '<h6 class="border-bottom pb-1 mt-3">Historial de validaciones</h6>';
      html += '<ul class="list-group">';
      r.validaciones.forEach(val => {
        html += `<li class="list-group-item"><small><strong>${escapeHtml(val.nivel)}</strong> — ${escapeHtml(val.accion)} — ${escapeHtml(val.comentario || '(sin comentario)')}</small></li>`;
      });
      html += '</ul>';
    }

    // Botón descargar PDF al pie
    html += `
      <div class="mt-3 text-end">
        <button class="btn btn-danger" onclick="descargarPdfDesdeHistorial('${escapeAttr(idReporte)}')">
          📄 Descargar PDF
        </button>
      </div>
    `;

    document.getElementById('contenidoHistorial').innerHTML = html;
    modal.show();
  } catch (e) {
    document.getElementById('contenidoHistorial').innerHTML =
      '<div class="alert alert-danger">Error: ' + e.message + '</div>';
  }
}

// ============================================================
// DESCARGAR PDF DESDE HISTORIAL
// ============================================================
async function descargarPdfDesdeHistorial(idReporte) {
  try {
    const r = await apiGet({ accion: 'generarPdfReporte', token: TOKEN, idReporte: idReporte });
    if (!r.ok) {
      alert('Error: ' + (r.error || 'No se pudo generar el PDF'));
      return;
    }
    window.open(r.pdfUrl, '_blank');
  } catch (e) {
    alert('Error: ' + e.message);
  }
}
