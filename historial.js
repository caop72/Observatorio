/**************************************************************
 * OEP - Historial de mis acciones
 **************************************************************/

const API_URL = 'https://script.google.com/macros/s/AKfycbzn4bcq0uYlNnunsv8ePtzIzaHI606CjgXunrOVClZ29pYhXP5CcFPAUck7O0V31CeJOQ/exec';

async function api(accion, datos) {
  const r = await fetch(API_URL, {
    method: 'POST',
    body: JSON.stringify(Object.assign({ accion }, datos || {})),
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }
  });
  return await r.json();
}

window.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('oep_token');
  const usuario = JSON.parse(localStorage.getItem('oep_usuario') || 'null');

  if (!token || !usuario) {
    location.href = 'index.html';
    return;
  }

  document.getElementById('nav-usuario').textContent =
    usuario.nombres + ' ' + usuario.apellidos + ' — ' + usuario.cargo;

  cargarHistorial();
});

async function cargarHistorial() {
  const token = localStorage.getItem('oep_token');
  const spinner = document.getElementById('spinner');
  const lista = document.getElementById('lista-acciones');
  spinner.style.display = '';
  lista.innerHTML = '';

  const r = await api('listarMisAcciones', { token });
  spinner.style.display = 'none';

  if (!r.ok) {
    lista.innerHTML = '<div class="alert alert-danger">' + r.error + '</div>';
    return;
  }

  if (!r.acciones || r.acciones.length === 0) {
    lista.innerHTML = '<div class="alert alert-info">Aún no has realizado acciones.</div>';
    return;
  }

  let html = '<div class="card"><div class="table-responsive"><table class="table table-striped mb-0">';
  html += '<thead class="table-dark"><tr>';
  html += '<th>Fecha</th><th>Reporte</th><th>OPT</th><th>Rol</th><th>Acción</th><th>Comentario</th><th>Estado</th>';
  html += '</tr></thead><tbody>';

  r.acciones.forEach(a => {
    const fecha = a.fecha || '';
    const hora = a.hora || '';
    const fechaStr = fecha + (hora ? ' ' + hora.substring(0, 5) : '');
    const accion = a.accion || '';
    const badgeColor = accion.includes('ENVIÓ') ? 'bg-info' :
                       accion === 'VALIDA' ? 'bg-success' :
                       accion === 'BLOQUEA' ? 'bg-danger' : 'bg-secondary';

    html += `<tr>
      <td>${fechaStr}</td>
      <td><strong>${a.idReporte || ''}</strong></td>
      <td>${a.nombreOpt || ''}</td>
      <td>${a.rol || ''}</td>
      <td><span class="badge ${badgeColor}">${accion}</span></td>
      <td><small>${a.comentario || '-'}</small></td>
      <td><small>${a.estadoFinal || ''}</small></td>
    </tr>`;
  });

  html += '</tbody></table></div></div>';
  lista.innerHTML = html;
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
