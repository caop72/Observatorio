/**************************************************************
 * OEP - Módulo de Validación (Fase 7) v2
 **************************************************************/

const API_URL = 'https://script.google.com/macros/s/AKfycbzn4bcq0uYlNnunsv8ePtzIzaHI606CjgXunrOVClZ29pYhXP5CcFPAUck7O0V31CeJOQ/exec';

let REPORTES = [];
let USUARIO = null;
let ROL = '';

async function api(accion, datos) {
  const r = await fetch(API_URL, {
    method: 'POST',
    body: JSON.stringify(Object.assign({ accion }, datos || {})),
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }
  });
  return await r.json();
}

window.addEventListener('DOMContentLoaded', async () => {
  USUARIO = JSON.parse(localStorage.getItem('oep_usuario') || 'null');
  if (!USUARIO || !USUARIO.token) { location.href = 'index.html'; return; }
  ROL = USUARIO.cargo || '';

  document.getElementById('nav-usuario').textContent =
    (USUARIO.nombres || '') + ' ' + (USUARIO.apellidos || '') + ' — ' + ROL;
  document.getElementById('rol-usuario').textContent = ROL;

  await cargarReportes();
});

async function cargarReportes() {
  const token = USUARIO.token;
  const spinner = document.getElementById('spinner');
  const lista = document.getElementById('lista-reportes');
  spinner.style.display = '';
  lista.innerHTML = '';

  const r = await api('listarReportesParaValidar', { token });
  spinner.style.display = 'none';

  if (!r.ok) {
    lista.innerHTML = '<div class="alert alert-danger">' + r.error + '</div>';
    return;
  }

  REPORTES = r.reportes || [];

  if (REPORTES.length === 0) {
    lista.innerHTML = '<div class="alert alert-info">No hay reportes pendientes para tu rol.</div>';
    return;
  }

  REPORTES.forEach(rep => {
    const card = document.createElement('div');
    card.className = 'card mb-3 shadow-sm';
    card.innerHTML = `
      <div class="card-body">
        <div class="d-flex justify-content-between">
          <div>
            <h5 class="mb-1">${rep.idReporte} — ${rep.idOpt}</h5>
            <p class="mb-1"><small>Estado OPT: <strong>${rep.estadoOPT}</strong> | Fecha: ${rep.fecha} ${rep.hora}</small></p>
            <p class="mb-1"><small>Semáforo: <span class="badge bg-info text-dark">${rep.semaforo}</span> | Estado actual: <strong>${rep.estado}</strong></small></p>
            <p class="mb-0"><small>Commit: <em>${rep.commit}</em></small></p>
          </div>
          <div class="text-end">
            <button class="btn btn-sm btn-outline-primary mb-1" onclick="verDetalle('${rep.idReporte}')">👁 Ver</button>
          </div>
        </div>
      </div>
    `;
    lista.appendChild(card);
  });
}

async function verDetalle(idReporte) {
  const modal = document.createElement('div');
  modal.className = 'modal fade show d-block';
  modal.style.background = 'rgba(0,0,0,0.5)';
  modal.innerHTML = `
    <div class="modal-dialog modal-xl modal-dialog-scrollable">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Reporte ${idReporte}</h5>
          <button class="btn-close" onclick="this.closest('.modal').remove()"></button>
        </div>
        <div class="modal-body" id="modal-body">
          <p>Cargando...</p>
        </div>
        <div class="modal-footer" id="modal-footer"></div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const r = await api('obtenerReporteCompleto', { idReporte });
  const body = modal.querySelector('#modal-body');
  const footer = modal.querySelector('#modal-footer');

  if (!r.ok) {
    body.innerHTML = '<div class="alert alert-danger">' + r.error + '</div>';
    return;
  }

  const rep = r.reporte;
  const opt = r.opt || {};
  const v = r.valores || {};

  let html = '';

  // === DATOS DE LA OPT ===
  html += '<h6 class="border-bottom pb-1">Datos de la OPT</h6>';
  html += '<table class="table table-sm">';
  html += `<tr><td><strong>ID</strong></td><td>${opt.id || rep.idOpt}</td></tr>`;
  html += `<tr><td><strong>Nombre</strong></td><td>${opt.nombre || ''}</td></tr>`;
  html += `<tr><td><strong>Estado</strong></td><td>${opt.estado || ''}</td></tr>`;
  html += `<tr><td><strong>Estatus operativo</strong></td><td>${opt.estatusOperativo || ''}</td></tr>`;
  html += `<tr><td><strong>Abierta</strong></td><td>${opt.abierta || ''}</td></tr>`;
  html += `<tr><td><strong>Observaciones OPT</strong></td><td>${opt.observaciones || ''}</td></tr>`;
  html += '</table>';

  // === DATOS DEL REPORTE ===
  html += '<h6 class="border-bottom pb-1 mt-3">Reporte del día</h6>';
  html += '<table class="table table-sm">';
  html += `<tr><td><strong>Fecha</strong></td><td>${rep.fecha} ${rep.hora}</td></tr>`;
  html += `<tr><td><strong>Jefe de OPT</strong></td><td>${r.nombreJefe || ''}</td></tr>`;
  html += `<tr><td><strong>Estatus</strong></td><td>${v.estatus || ''}</td></tr>`;
  html += `<tr><td><strong>¿Abierta?</strong></td><td>${v.abierta || ''}</td></tr>`;
  html += `<tr><td><strong>Estatus legal</strong></td><td>${v.estatus_legal || ''}</td></tr>`;
  html += `<tr><td><strong>Observación</strong></td><td>${v.observacion || ''}</td></tr>`;
  if (v.causa) html += `<tr><td><strong>Causa</strong></td><td>${v.causa}</td></tr>`;
  html += '</table>';

  // === PARTE DEL PERSONAL ===
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

  // === NOVEDADES ===
  if (v.novedad_vehiculos || v.novedad_infraestructura || v.novedad_conectividad || v.observaciones) {
    html += '<h6 class="border-bottom pb-1 mt-3">Novedades</h6>';
    html += '<table class="table table-sm">';
    if (v.novedad_vehiculos)       html += `<tr><td><strong>Vehículos</strong></td><td>${v.novedad_vehiculos}</td></tr>`;
    if (v.novedad_infraestructura) html += `<tr><td><strong>Infraestructura</strong></td><td>${v.novedad_infraestructura}</td></tr>`;
    if (v.novedad_conectividad)    html += `<tr><td><strong>Conectividad</strong></td><td>${v.novedad_conectividad}</td></tr>`;
    if (v.observaciones)           html += `<tr><td><strong>Observaciones</strong></td><td>${v.observaciones}</td></tr>`;
    html += '</table>';
  }

  // === HISTORIAL DE VALIDACIONES ===
  if (r.validaciones.length > 0) {
    html += '<h6 class="border-bottom pb-1 mt-3">Historial de validaciones</h6>';
    html += '<ul class="list-group">';
    r.validaciones.forEach(val => {
      html += `<li class="list-group-item"><small><strong>${val.nivel}</strong> — ${val.accion} — ${val.comentario || '(sin comentario)'}</small></li>`;
    });
    html += '</ul>';
  }

  body.innerHTML = html;

  // === BOTONES DE ACCIÓN ===
  // Observatorio NO valida
  if (ROL === 'Observatorio') {
    footer.innerHTML = `
      <div class="w-100 text-center">
        <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cerrar</button>
        <p class="text-muted small mt-2 mb-0">Observatorio puede visualizar y auditar, pero no validar.</p>
      </div>
    `;
  } else {
    footer.innerHTML = `
      <div class="w-100">
        <textarea id="comentario-val" class="form-control mb-2" rows="2" placeholder="Comentario (obligatorio para Gerente/CNC)"></textarea>
        <div class="d-flex gap-2">
          <button class="btn btn-success flex-grow-1" onclick="accionValidar('${idReporte}','VALIDA', this)">✅ Validar</button>
          <button class="btn btn-danger flex-grow-1" onclick="accionValidar('${idReporte}','BLOQUEA', this)">🚫 Bloquear</button>
          <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cerrar</button>
        </div>
      </div>
    `;
  }
}

async function accionValidar(idReporte, accion, boton) {
  const modal = boton.closest('.modal');
  const token = USUARIO.token;
  const comentario = modal.querySelector('#comentario-val').value.trim();

  const botones = modal.querySelectorAll('button');
  botones.forEach(b => b.disabled = true);
  boton.textContent = '⏳ Procesando...';

  const r = await api('accionValidar', { token, idReporte, tipoAccion: accion, comentario });

  if (!r.ok) {
    alert('Error: ' + r.error);
    botones.forEach(b => b.disabled = false);
    boton.textContent = accion === 'VALIDA' ? '✅ Validar' : '🚫 Bloquear';
    return;
  }

  alert('✅ Acción registrada. Nuevo estado: ' + r.nuevoEstado);
  modal.remove();
  cargarReportes();
}

async function cerrarSesion() {
  try {
    if (USUARIO && USUARIO.token) await api('logout', { token: USUARIO.token });
  } catch (e) {}
  localStorage.clear();
  sessionStorage.clear();
  location.href = 'index.html';
}
