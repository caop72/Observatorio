const API_URL = 'https://script.google.com/macros/s/AKfycbzn4bcq0uYlNnunsv8ePtzIzaHI606CjgXunrOVClZ29pYhXP5CcFPAUck7O0V31CeJOQ/exec';

let USUARIO = null;

document.addEventListener('DOMContentLoaded', async () => {
  USUARIO = JSON.parse(localStorage.getItem('oep_usuario') || 'null');
  if (!USUARIO || !USUARIO.token) { location.href = 'index.html'; return; }
  document.getElementById('nav-usuario').textContent =
    (USUARIO.nombres || '') + ' ' + (USUARIO.apellidos || '') + ' — ' + (USUARIO.cargo || '');

  cargarEstadisticas();
  cargarMisOPT();
});

async function apiPost(accion, datos) {
  const r = await fetch(API_URL, {
    method: 'POST',
    body: JSON.stringify(Object.assign({ accion }, datos || {})),
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }
  });
  return await r.json();
}

async function cargarEstadisticas() {
  const r = await apiPost('obtenerEstadisticasV2', { token: USUARIO.token });
  if (!r.ok) { alert('Error: ' + r.error); return; }

  document.getElementById('kpi-total').textContent = r.totalOpts;

  // Reporte (torta)
  new Chart(document.getElementById('chart-reporte'), {
    type: 'doughnut',
    data: {
      labels: ['En plazo', 'Sin novedad', 'Objetado', 'Sin reportar'],
      datasets: [{
        data: [r.porReporte.blanco, r.porReporte.verde, r.porReporte.amarillo, r.porReporte.rojo],
        backgroundColor: ['#e9ecef', '#28a745', '#ffc107', '#dc3545']
      }]
    }
  });

  // Estatus (torta)
  new Chart(document.getElementById('chart-estatus'), {
    type: 'doughnut',
    data: {
      labels: ['Operativa', 'Inoperativa', 'Por Cierre Técnico'],
      datasets: [{
        data: [r.porEstatus.verde, r.porEstatus.naranja, r.porEstatus.rojo],
        backgroundColor: ['#28a745', '#fd7e14', '#dc3545']
      }]
    }
  });

  // Legalidad (torta)
  new Chart(document.getElementById('chart-legalidad'), {
    type: 'doughnut',
    data: {
      labels: ['Propia', 'Arrendada', 'Comodato'],
      datasets: [{
        data: [r.porLegalidad.verde, r.porLegalidad.naranja, r.porLegalidad.amarillo],
        backgroundColor: ['#28a745', '#fd7e14', '#ffc107']
      }]
    }
  });

  // Región (barras)
  const regiones = Object.keys(r.porRegion).sort();
  new Chart(document.getElementById('chart-region'), {
    type: 'bar',
    data: {
      labels: regiones,
      datasets: [{
        label: 'OPTs',
        data: regiones.map(k => r.porRegion[k]),
        backgroundColor: '#1a3d7c'
      }]
    },
    options: { scales: { y: { beginAtZero: true } }, plugins: { legend: { display: false } } }
  });

  // Días (línea)
  new Chart(document.getElementById('chart-dias'), {
    type: 'line',
    data: {
      labels: r.porDia.fechas,
      datasets: [{
        label: 'Reportes',
        data: r.porDia.valores,
        borderColor: '#1a3d7c',
        backgroundColor: 'rgba(26,61,124,0.1)',
        tension: 0.2,
        fill: true
      }]
    },
    options: { scales: { y: { beginAtZero: true } }, plugins: { legend: { display: false } } }
  });
}

function cerrarSesion() {
  localStorage.removeItem('oep_usuario');
  location.href = 'index.html';
}
