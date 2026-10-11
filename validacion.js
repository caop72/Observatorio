/**************************************************************
 * OEP - Módulo de Validación (Fase 7)
 **************************************************************/

const API_URL = 'https://script.google.com/macros/s/AKfycbzn4bcq0uYlNnunsv8ePtzIzaHI606CjgXunrOVClZ29pYhXP5CcFPAUck7O0V31CeJOQ/exec';

let REPORTES = [];
let USUARIO = null;

async function api(accion, datos) {
  const r = await fetch(API_URL, {
    method: 'POST',
    body: JSON.stringify(Object.assign({ accion }, datos || {})),
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }
  });
  return await r.json();
}

window.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('oep_token');
  USUARIO = JSON.parse(localStorage.getItem('oep_usuario') || 'null');

  if (!token || !USUARIO) {
    location.href = 'index.html';
    return;
  }

  document.getElementById('nav-usuario').textContent =
    USUARIO.nombres + ' ' + USUARIO.apellidos + ' — ' + USUARIO.cargo;
  document.getElementById('rol-usuario').textContent = USUARIO.cargo;

  await cargarReportes();
});

async function cargarReportes() {
  const token = localStorage.getItem('oep_token');
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
            <p class="mb-1"><small>Semaforo: <span class="badge bg-info text-dark">${rep.semaforo}</span> | Estado actual: <strong>${rep.estado}</strong></small></p>
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
    <div class="modal-dialog modal-lg">
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

  // Detalle de indicadores
  let html = '<h6>Indicadores</h6><table class="table table-sm">';
  r.detalle.forEach(d => {
    let valor = d.texto || '';
    if (!valor && (d.valor1 || d.valor2 || d.valor3 || d.valor4)) {
      valor = [d.valor1, d.valor2, d.valor3, d.valor4].filter(v => v).join(' / ');
    }
    html += `<tr><td><strong>${d.codigo}</strong></td><td>${valor}</td></tr>`;
  });
  html += '</table>';

  // Historial de validaciones
  if (r.validaciones.length > 0) {
    html += '<h6>Historial de validaciones</h6><ul class="list-group">';
    r.validaciones.forEach(v => {
      html += `<li class="list-group-item"><small><strong>${v.nivel}</strong> — ${v.accion} — ${v.comentario || '(sin comentario)'}</small></li>`;
    });
    html += '</ul>';
  }

  body.innerHTML = html;

  // Botones de acción
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

async function accionValidar(idReporte, accion, boton) {
  const modal = boton.closest('.modal');
  const token = localStorage.getItem('oep_token');
  const comentario = modal.querySelector('#comentario-val').value.trim();

  // Deshabilitar TODOS los botones del modal para evitar doble clic
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
  const token = localStorage.getItem('oep_token');
  try {
    if (token) await api('logout', { token });
  } catch (e) {}
  localStorage.clear();
  sessionStorage.clear();
  location.href = 'index.html';
}
