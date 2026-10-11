/**************************************************************
 * OEP - Estadísticas
 **************************************************************/

const API_URL = 'https://script.google.com/macros/s/AKfycbzn4bcq0uYlNnunsv8ePtzIzaHI606CjgXunrOVClZ29pYhXP5CcFPAUck7O0V31CeJOQ/exec';

let USUARIO = null;
let DATOS = null;
let chartTorta, chartBarras, chartLinea;

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
  USUARIO = JSON.parse(localStorage.getItem('oep_usuario') || 'null');

  if (!token || !USUARIO) {
    location.href = 'index.html';
    return;
  }

  document.getElementById('nav-usuario').textContent =
    USUARIO.nombres + ' ' + USUARIO.apellidos + ' — ' + USUARIO.cargo;

  cargarEstadisticas();
});

function limpiarFiltros() {
  document.getElementById('f-desde').value = '';
  document.getElementById('f-hasta').value = '';
  document.getElementById('f-semaforo').value = '';
  document.getElementById('f-estado').value = '';
  cargarEstadisticas();
}

async function cargarEstadisticas() {
  const token = localStorage.getItem('oep_token');
  const filtros = {
    token,
    desde: document.getElementById('f-desde').value || null,
    hasta: document.getElementById('f-hasta').value || null,
    semaforo: document.getElementById('f-semaforo').value || null,
    estado: document.getElementById('f-estado').value.trim() || null
  };

  const r = await api('obtenerEstadisticas', filtros);
  if (!r.ok) {
    alert('Error: ' + r.error);
    return;
  }

  DATOS = r;

  // KPIs
  document.getElementById('kpi-total').textContent = r.total;
  document.getElementById('kpi-dias').textContent = r.porDia.fechas.length;
  document.getElementById('kpi-agrupaciones').textContent = Object.keys(r.agrupacion).length;

  let semaforoDom = '-';
  let max = 0;
  Object.keys(r.semaforo).forEach(k => {
    if (r.semaforo[k] > max) { max = r.semaforo[k]; semaforoDom = k; }
  });
  document.getElementById('kpi-semaforo').textContent = semaforoDom;

  // Título de barras según rol
  const esGlobal = ['CNC','Despacho','Observatorio','Presidencia'].includes(USUARIO.cargo);
  document.getElementById('titulo-barras').textContent = esGlobal ? 'Reportes por Estado' : 'Reportes por OPT';

  renderGraficoTorta(r.semaforo);
  renderGraficoBarras(r.agrupacion);
  renderGraficoLinea(r.porDia);
  renderTabla(r.reportes);
}

function renderGraficoTorta(datos) {
  if (chartTorta) chartTorta.destroy();
  const colores = { AMARILLO: '#ffc107', AZUL: '#0d6efd', ROJO: '#dc3545', CIERRE: '#6c757d', GRIS: '#adb5bd' };
  const labels = Object.keys(datos).filter(k => datos[k] > 0);
  const valores = labels.map(k => datos[k]);
  const coloresLabels = labels.map(k => colores[k]);

  chartTorta = new Chart(document.getElementById('chart-torta'), {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{ data: valores, backgroundColor: coloresLabels }]
    },
    options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
  });
}

function renderGraficoBarras(datos) {
  if (chartBarras) chartBarras.destroy();
  const labels = Object.keys(datos).sort((a,b) => datos[b] - datos[a]).slice(0, 15);
  const valores = labels.map(k => datos[k]);

  chartBarras = new Chart(document.getElementById('chart-barras'), {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Reportes',
        data: valores,
        backgroundColor: '#1a3d7c'
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
    }
  });
}

function renderGraficoLinea(datos) {
  if (chartLinea) chartLinea.destroy();

  chartLinea = new Chart(document.getElementById('chart-linea'), {
    type: 'line',
    data: {
      labels: datos.fechas,
      datasets: [{
        label: 'Reportes por día',
        data: datos.valores,
        borderColor: '#1a3d7c',
        backgroundColor: 'rgba(26, 61, 124, 0.1)',
        tension: 0.3,
        fill: true
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
    }
  });
}

function renderTabla(reportes) {
  const tbody = document.querySelector('#tabla-reportes tbody');
  tbody.innerHTML = '';

  if (reportes.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Sin reportes para los filtros aplicados.</td></tr>';
    return;
  }

  reportes.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.fecha}</td>
      <td><strong>${r.idReporte}</strong></td>
      <td>${r.nombreOpt}</td>
      <td>${r.estado || '-'}</td>
      <td><span class="badge bg-secondary">${r.semaforo}</span></td>
      <td><small>${r.estadoReporte}</small></td>
    `;
    tbody.appendChild(tr);
  });
}

function exportarCSV() {
  if (!DATOS || !DATOS.reportes || DATOS.reportes.length === 0) {
    alert('No hay datos para exportar');
    return;
  }

  const headers = ['Fecha', 'ID Reporte', 'OPT', 'Estado', 'Region', 'Semaforo', 'Estado Reporte'];
  const filas = DATOS.reportes.map(r => [
    r.fecha, r.idReporte, r.nombreOpt, r.estado, r.region, r.semaforo, r.estadoReporte
  ]);

  let csv = headers.join(';') + '\n';
  filas.forEach(f => {
    csv += f.map(v => '"' + String(v || '').replace(/"/g, '""') + '"').join(';') + '\n';
  });

  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'OEP_estadisticas_' + new Date().toISOString().substring(0,10) + '.csv';
  link.click();
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
