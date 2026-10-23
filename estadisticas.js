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

async function cargarMisOPT() {
  const r = await apiPost('obtenerDashboardMisOPT', { token: USUARIO.token });
  if (!r.ok) { console.error('Error:', r.error); return; }

  // --- INYECTAR TEXTOS DE LA IA ---
  if (r.textos) {
    document.getElementById('txt-resumen').textContent = r.textos.resumen;
    // Usamos innerText para que respete los saltos de línea (\n) de las acciones
    document.getElementById('txt-acciones').innerText = r.textos.acciones; 
    document.getElementById('txt-observaciones').textContent = r.textos.observaciones;
  } else {
    document.getElementById('txt-resumen').textContent = "El backend no envió los textos de IA.";
  }

  // 1. Población Afectada (Barras horizontales - Alerta)
  new Chart(document.getElementById('chart-poblacion-afectada'), {
    type: 'bar',
    data: {
      labels: r.poblacion_afectada.por_estado.map(x => x.estado),
      datasets: [{
        label: 'Población afectada',
        data: r.poblacion_afectada.por_estado.map(x => x.poblacion),
        backgroundColor: '#dc3545' // Rojo alerta
      }]
    },
    options: { 
      indexAxis: 'y', 
      plugins: { legend: { display: false } },
      scales: { x: { beginAtZero: true } }
    }
  });

  // 2. Top 10 (Barras verticales)
  new Chart(document.getElementById('chart-top10'), {
    type: 'bar',
    data: {
      labels: r.top_10_estados_por_opt.map(x => x.estado),
      datasets: [{
        label: 'Cantidad de OPT',
        data: r.top_10_estados_por_opt.map(x => x.cantidad),
        backgroundColor: '#6f42c1'
      }]
    },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
  });

  // --- 3. Población Total (Barras Horizontales + Tabla HTML) ---
  const estadosPob = r.poblacion_total.por_estado;
  
  // A) Dibujar el gráfico
  new Chart(document.getElementById('chart-poblacion-total'), {
    type: 'bar',
    data: {
      labels: estadosPob.map(x => x.estado),
      datasets: [{
        label: 'Población',
        data: estadosPob.map(x => x.poblacion),
        backgroundColor: '#3b82f6', // Azul
        borderRadius: 4
      }]
    },
    options: { 
      indexAxis: 'y', 
      plugins: { legend: { display: false } }, 
      scales: { x: { beginAtZero: true } } 
    }
  });

  // B) Construir la tabla HTML
  let htmlTabla = '<table class="table table-sm table-hover mt-3" style="font-size: 0.85rem;">';
  htmlTabla += '<thead class="table-light"><tr><th>Estado</th><th class="text-end">Población Atendida</th></tr></thead><tbody>';
  estadosPob.forEach(row => {
    const numFormateado = row.poblacion.toLocaleString('es-VE');
    htmlTabla += `<tr><td>${row.estado}</td><td class="text-end">${numFormateado}</td></tr>`;
  });
  htmlTabla += '</tbody></table>';
  
  // C) Inyectar la tabla debajo del gráfico en el contenedor
  const contenedorPob = document.getElementById('contenedor-poblacion');
  // Limpiamos si ya existía una tabla de una carga anterior
  const tablaAnterior = contenedorPob.querySelector('table');
  if (tablaAnterior) tablaAnterior.remove();
  // Agregamos la nueva tabla
  contenedorPob.insertAdjacentHTML('beforeend', htmlTabla);

  // 4. Activas vs Inactivas
  new Chart(document.getElementById('chart-activas'), {
    type: 'doughnut',
    data: {
      labels: ['Activas', 'Inactivas'],
      datasets: [{
        data: [r.activas_inactivas.activas, r.activas_inactivas.inactivas],
        backgroundColor: ['#198754', '#6c757d']
      }]
    },
    options: { plugins: { legend: { position: 'bottom' } } }
  });

  // 5. Cobertura
  new Chart(document.getElementById('chart-cobertura'), {
    type: 'doughnut',
    data: {
      labels: ['Con OPT', 'Sin OPT'],
      datasets: [{
        data: [r.cobertura_poblacional.parroquias_con_opt, r.cobertura_poblacional.parroquias_sin_opt],
        backgroundColor: ['#0dcaf0', '#e9ecef']
      }]
    },
    options: { plugins: { legend: { position: 'bottom' } } }
  });

  // 6. Operativas vs Inoperativas (Barras horizontales)
  const estatusLabels = Object.keys(r.estatus);
  new Chart(document.getElementById('chart-operativas'), {
    type: 'bar',
    data: {
      labels: estatusLabels,
      datasets: [{
        label: 'Cantidad de OPT',
        data: estatusLabels.map(k => r.estatus[k]),
        backgroundColor: ['#198754', '#dc3545', '#ffc107', '#6c757d']
      }]
    },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
  });
}

function cerrarSesion() {
  localStorage.removeItem('oep_usuario');
  location.href = 'index.html';
}
