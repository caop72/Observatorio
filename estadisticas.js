const API_URL = 'https://script.google.com/macros/s/AKfycbzn4bcq0uYlNnunsv8ePtzIzaHI606CjgXunrOVClZ29pYhXP5CcFPAUck7O0V31CeJOQ/exec';

let USUARIO = null;
let DATOS_MIS_OPT = null;
let chartDinamico = null;

document.addEventListener('DOMContentLoaded', async () => {
  USUARIO = JSON.parse(localStorage.getItem('oep_usuario') || 'null');
  if (!USUARIO || !USUARIO.token) { location.href = 'index.html'; return; }
  document.getElementById('nav-usuario').textContent = (USUARIO.nombres || '') + ' ' + (USUARIO.apellidos || '') + ' — ' + (USUARIO.cargo || '');

  cargarEstadisticas(); // Carga los gráficos de arriba (los viejos)
  
  // Pedimos la data del nuevo dashboard
  const r = await apiPost('obtenerDashboardMisOPT', { token: USUARIO.token });
  if (r.ok) {
    DATOS_MIS_OPT = r;
    cambiarGrafico('poblacion_afectada'); // Cargamos el primero por defecto
  } else {
    alert("Error cargando Mis OPT: " + r.error);
  }
});

async function apiPost(accion, datos) {
  const r = await fetch(API_URL, {
    method: 'POST',
    body: JSON.stringify(Object.assign({ accion }, datos || {})),
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }
  });
  return await r.json();
}

// ==========================================
// LÓGICA DEL SELECTOR DE GRÁFICOS
// ==========================================
async function cambiarGrafico(tipo) {
  if (!DATOS_MIS_OPT) return;

  // 1. Limpiar el gráfico anterior si existe
  if (chartDinamico) { chartDinamico.destroy(); }
  
  // Limpiar tablas anteriores si el gráfico de población las inyectó
  const tablaAnterior = document.querySelector('#din-canvas-container table');
  if (tablaAnterior) tablaAnterior.remove();

  const ctx = document.getElementById('chart-dinamico').getContext('2d');
  const d = DATOS_MIS_OPT;
  
  let titulo = "";
  let subtitulo = "";

  // 2. Configurar el gráfico según la selección
  if (tipo === 'poblacion_afectada') {
    titulo = "Población Afectada por Inoperatividad";
    subtitulo = "Ciudadanos sin servicio postal por fallas técnicas o cierres.";
    chartDinamico = new Chart(ctx, {
      type: 'bar',
      data: { labels: d.poblacion_afectada.por_estado.map(x => x.estado), datasets: [{ label: 'Afectados', data: d.poblacion_afectada.por_estado.map(x => x.poblacion), backgroundColor: '#dc3545' }] },
      options: { indexAxis: 'y', plugins: { legend: { display: false } } }
    });
  } 
  else if (tipo === 'top10') {
    titulo = "Top 10 Estados por cantidad de OPT";
    subtitulo = "Estados con mayor presencia de infraestructura postal.";
    chartDinamico = new Chart(ctx, {
      type: 'bar',
      data: { labels: d.top_10_estados_por_opt.map(x => x.estado), datasets: [{ label: 'Cantidad', data: d.top_10_estados_por_opt.map(x => x.cantidad), backgroundColor: '#6f42c1' }] },
      options: { plugins: { legend: { display: false } } }
    });
  } 
  else if (tipo === 'poblacion_total') {
    titulo = "Población Total Atendida por Estado";
    subtitulo = "Basado en el Censo 2011 cruzado con las OPT registradas.";
    chartDinamico = new Chart(ctx, {
      type: 'bar',
      data: { labels: d.poblacion_total.por_estado.map(x => x.estado), datasets: [{ label: 'Población', data: d.poblacion_total.por_estado.map(x => x.poblacion), backgroundColor: '#0d6efd' }] },
      options: { indexAxis: 'y', plugins: { legend: { display: false } } }
    });
    
    // Inyectar la tabla debajo del gráfico
    let htmlTabla = '<table class="table table-sm table-hover mt-3" style="font-size: 0.85rem;"><thead class="table-light"><tr><th>Estado</th><th class="text-end">Población Atendida</th></tr></thead><tbody>';
    d.poblacion_total.por_estado.forEach(row => { htmlTabla += `<tr><td>${row.estado}</td><td class="text-end">${row.poblacion.toLocaleString('es-VE')}</td></tr>`; });
    htmlTabla += '</tbody></table>';
    document.getElementById('din-canvas-container').insertAdjacentHTML('beforeend', htmlTabla);
  }
  else if (tipo === 'activas') {
    titulo = "Activas vs Inactivas";
    subtitulo = "Estado administrativo de las oficinas postales.";
    chartDinamico = new Chart(ctx, {
      type: 'doughnut',
      data: { labels: ['Activas', 'Inactivas'], datasets: [{ data: [d.activas_inactivas.activas, d.activas_inactivas.inactivas], backgroundColor: ['#198754', '#6c757d'] }] },
      options: { plugins: { legend: { position: 'bottom' } } }
    });
  }
  else if (tipo === 'cobertura') {
    titulo = "Cobertura Parroquial";
    subtitulo = "Parroquias que cuentan con al menos una OPT.";
    chartDinamico = new Chart(ctx, {
      type: 'doughnut',
      data: { labels: ['Con OPT', 'Sin OPT'], datasets: [{ data: [d.cobertura_poblacional.parroquias_con_opt, d.cobertura_poblacional.parroquias_sin_opt], backgroundColor: ['#0dcaf0', '#e9ecef'] }] },
      options: { plugins: { legend: { position: 'bottom' } } }
    });
  }
  else if (tipo === 'operativas') {
    titulo = "Estatus de Operatividad";
    subtitulo = "Condición técnica actual de las OPT.";
    const labels = Object.keys(d.estatus);
    chartDinamico = new Chart(ctx, {
      type: 'bar',
      data: { labels: labels, datasets: [{ label: 'Cantidad', data: labels.map(k => d.estatus[k]), backgroundColor: ['#198754', '#dc3545', '#ffc107', '#6c757d'] }] },
      options: { plugins: { legend: { display: false } } }
    });
  }

  // 3. Actualizar los títulos
  document.getElementById('din-titulo').textContent = titulo;
  document.getElementById('din-subtitulo').textContent = subtitulo;

  // 4. Pedir los textos fijos del backend
  document.getElementById('din-resumen').textContent = "Cargando análisis...";
  document.getElementById('din-acciones').textContent = "Cargando análisis...";
  document.getElementById('din-observaciones').textContent = "Cargando análisis...";

  const rTex = await apiPost('obtenerAnalisisIA', { token: USUARIO.token, tipoGrafico: tipo });
  if (rTex.ok && rTex.textos) {
    document.getElementById('din-resumen').textContent = rTex.textos.resumen;
    document.getElementById('din-acciones').innerText = rTex.textos.acciones;
    document.getElementById('din-observaciones').textContent = rTex.textos.observaciones;
  }
}

// Función original para los gráficos de arriba (no la tocamos)
async function cargarEstadisticas() {
  const r = await apiPost('obtenerEstadisticasV2', { token: USUARIO.token });
  if (!r.ok) return;

  document.getElementById('kpi-total').textContent = r.totalOpts;

  new Chart(document.getElementById('chart-reporte'), {
    type: 'doughnut',
    data: { labels: ['En plazo', 'Sin novedad', 'Objetado', 'Sin reportar'], datasets: [{ data: [r.porReporte.blanco, r.porReporte.verde, r.porReporte.amarillo, r.porReporte.rojo], backgroundColor: ['#e9ecef', '#28a745', '#ffc107', '#dc3545'] }] }
  });

  new Chart(document.getElementById('chart-estatus'), {
    type: 'doughnut',
    data: { labels: ['Operativa', 'Inoperativa', 'Por Cierre Técnico'], datasets: [{ data: [r.porEstatus.verde, r.porEstatus.naranja, r.porEstatus.rojo], backgroundColor: ['#28a745', '#fd7e14', '#dc3545'] }] }
  });

  new Chart(document.getElementById('chart-legalidad'), {
    type: 'doughnut',
    data: { labels: ['Propia', 'Arrendada', 'Comodato'], datasets: [{ data: [r.porLegalidad.verde, r.porLegalidad.naranja, r.porLegalidad.amarillo], backgroundColor: ['#28a745', '#fd7e14', '#ffc107'] }] }
  });

  const regiones = Object.keys(r.porRegion).sort();
  new Chart(document.getElementById('chart-region'), {
    type: 'bar',
    data: { labels: regiones, datasets: [{ label: 'OPTs', data: regiones.map(k => r.porRegion[k]), backgroundColor: '#1a3d7c' }] },
    options: { scales: { y: { beginAtZero: true } }, plugins: { legend: { display: false } } }
  });

  new Chart(document.getElementById('chart-dias'), {
    type: 'line',
    data: { labels: r.porDia.fechas, datasets: [{ label: 'Reportes', data: r.porDia.valores, borderColor: '#1a3d7c', backgroundColor: 'rgba(26,61,124,0.1)', tension: 0.2, fill: true }] },
    options: { scales: { y: { beginAtZero: true } }, plugins: { legend: { display: false } } }
  });
}

function cerrarSesion() {
  localStorage.removeItem('oep_usuario');
  location.href = 'index.html';
}
