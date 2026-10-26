const API_URL = 'https://script.google.com/macros/s/AKfycbzn4bcq0uYlNnunsv8ePtzIzaHI606CjgXunrOVClZ29pYhXP5CcFPAUck7O0V31CeJOQ/exec';

let USUARIO = null;
let DATOS_MIS_OPT = null;
let DATOS_ESTADISTICAS = null;
let chartDinamico = null;

document.addEventListener('DOMContentLoaded', async () => {
  USUARIO = JSON.parse(localStorage.getItem('oep_usuario') || 'null');
  if (!USUARIO || !USUARIO.token) { location.href = 'index.html'; return; }
  
  const navUsuario = document.getElementById('nav-usuario');
  if (navUsuario) navUsuario.textContent = (USUARIO.nombres || '') + ' ' + (USUARIO.apellidos || '') + ' — ' + (USUARIO.cargo || '');

  try {
    const [r1, r2] = await Promise.all([
      apiPost('obtenerEstadisticasV2', { token: USUARIO.token }),
      apiPost('obtenerDashboardMisOPT', { token: USUARIO.token })
    ]);

    if (r1.ok) DATOS_ESTADISTICAS = r1;
    if (r2.ok) DATOS_MIS_OPT = r2;

    if (DATOS_ESTADISTICAS && DATOS_MIS_OPT) {
      document.getElementById('kpi-total').textContent = DATOS_ESTADISTICAS.totalOpts;
      cambiarGrafico('informe_global'); // Cargamos el informe global por defecto
    } else {
      alert("Error cargando los datos. Revisa la consola.");
      console.error("Error en API:", r1, r2);
    }
  } catch (error) {
    console.error("Error en la petición inicial:", error);
    alert("Error de conexión con el servidor.");
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

async function cambiarGrafico(tipo) {
  if (!DATOS_MIS_OPT || !DATOS_ESTADISTICAS) return;

  if (chartDinamico) { chartDinamico.destroy(); }
  const tablaAnterior = document.querySelector('#din-canvas-container table');
  if (tablaAnterior) tablaAnterior.remove();

  // Referencias al DOM
  const canvasContainer = document.getElementById('din-canvas-container');
  const panelGlobal = document.getElementById('din-panel-global');
  const btnPdf = document.getElementById('btn-pdf');

  // Lógica especial para el Informe Global
  if (tipo === 'informe_global') {
    if(canvasContainer) canvasContainer.style.display = 'none';
    if(panelGlobal) panelGlobal.style.display = 'block';
    if(btnPdf) btnPdf.style.display = 'block'; 
    
    const tituloEl = document.getElementById('din-titulo');
    const subEl = document.getElementById('din-subtitulo');
    if(tituloEl) tituloEl.textContent = "Informe Gerencial Global del Observatorio";
    if(subEl) subEl.textContent = "Consolidado de infraestructura, población y operatividad nacional.";

    const resEl = document.getElementById('din-resumen');
    const accEl = document.getElementById('din-acciones');
    const obsEl = document.getElementById('din-observaciones');
    
    if(resEl) resEl.textContent = "Analizando datos globales...";
    if(accEl) accEl.textContent = "Generando recomendaciones...";
    if(obsEl) obsEl.textContent = "Evaluando tendencias...";

    try {
      const rTex = await apiPost('obtenerResumenGlobal', { token: USUARIO.token });
      if (rTex.ok && rTex.textos) {
        if(resEl) resEl.textContent = rTex.textos.resumen;
        if(accEl) accEl.innerText = rTex.textos.acciones;
        if(obsEl) obsEl.textContent = rTex.textos.observaciones;
      }
    } catch (e) {
      console.error("Error cargando el resumen global:", e);
    }
    return; 
  }

  // Para el resto de gráficos normales
  if(canvasContainer) canvasContainer.style.display = 'block';
  if(panelGlobal) panelGlobal.style.display = 'none';
  if(btnPdf) btnPdf.style.display = 'none'; 

  const canvasElement = document.getElementById('chart-dinamico');
  if(!canvasElement) return;
  
  const ctx = canvasElement.getContext('2d');
  const d = DATOS_MIS_OPT;
  const e = DATOS_ESTADISTICAS;
  
  let titulo = "Gráfico Estadístico", subtitulo = "";

  if (tipo === 'activas') {
    titulo = "Activas vs Inactivas (Administrativo)";
    subtitulo = "Estado administrativo de las oficinas postales registradas.";
    chartDinamico = new Chart(ctx, { type: 'doughnut', data: { labels: ['Activas', 'Inactivas'], datasets: [{ data: [e.porReporte.verde, e.porReporte.rojo], backgroundColor: ['#198754', '#dc3545'] }] } });
  }
  else if (tipo === 'cobertura') {
    titulo = "Cobertura Parroquial";
    subtitulo = "Parroquias que cuentan con al menos una OPT.";
    chartDinamico = new Chart(ctx, { type: 'doughnut', data: { labels: ['Con OPT', 'Sin OPT'], datasets: [{ data: [d.cobertura_poblacional.parroquias_con_opt, d.cobertura_poblacional.parroquias_sin_opt], backgroundColor: ['#0dcaf0', '#e9ecef'] }] } });
  }
  else if (tipo === 'estatus') {
    titulo = "Estatus Legal";
    subtitulo = "Condición jurídica de los inmuebles donde operan las OPT.";
    chartDinamico = new Chart(ctx, { type: 'doughnut', data: { labels: ['Propia', 'Arrendada', 'Comodato'], datasets: [{ data: [e.porLegalidad.verde, e.porLegalidad.naranja, e.porLegalidad.amarillo], backgroundColor: ['#28a745', '#fd7e14', '#ffc107'] }] } });
  }
  else if (tipo === 'operativas') {
    titulo = "Estatus de Operatividad (Técnico)";
    subtitulo = "Condición técnica actual de las OPT.";
    const labels = Object.keys(d.estatus);
    chartDinamico = new Chart(ctx, { type: 'bar', data: { labels: labels, datasets: [{ label: 'Cantidad', data: labels.map(k => d.estatus[k]), backgroundColor: ['#198754', '#dc3545', '#ffc107', '#6c757d'] }] }, options: { plugins: { legend: { display: false } } } });
  }
  else if (tipo === 'poblacion_afectada') {
    titulo = "Población Afectada por Inoperatividad";
    subtitulo = "Ciudadanos sin servicio postal por fallas técnicas o cierres.";
    chartDinamico = new Chart(ctx, { type: 'bar', data: { labels: d.poblacion_afectada.por_estado.map(x => x.estado), datasets: [{ label: 'Afectados', data: d.poblacion_afectada.por_estado.map(x => x.poblacion), backgroundColor: '#dc3545' }] }, options: { indexAxis: 'y', plugins: { legend: { display: false } } } });
  } 
  else if (tipo === 'poblacion_total') {
    titulo = "Población Total Atendida por Estado";
    subtitulo = "Basado en el Censo 2011 cruzado con las OPT registradas.";
    chartDinamico = new Chart(ctx, { type: 'bar', data: { labels: d.poblacion_total.por_estado.map(x => x.estado), datasets: [{ label: 'Población', data: d.poblacion_total.por_estado.map(x => x.poblacion), backgroundColor: '#0d6efd' }] }, options: { indexAxis: 'y', plugins: { legend: { display: false } } } });
    
    let htmlTabla = '<table class="table table-sm table-hover mt-3" style="font-size: 0.85rem;"><thead class="table-light"><tr><th>Estado</th><th class="text-end">Población Atendida</th></tr></thead><tbody>';
    d.poblacion_total.por_estado.forEach(row => { htmlTabla += `<tr><td>${row.estado}</td><td class="text-end">${row.poblacion.toLocaleString('es-VE')}</td></tr>`; });
    htmlTabla += '</tbody></table>';
    if(canvasContainer) canvasContainer.insertAdjacentHTML('beforeend', htmlTabla);
  }
  else if (tipo === 'region') {
    titulo = "OPTs por Región";
    subtitulo = "Distribución geográfica de las oficinas a nivel nacional.";
    const regiones = Object.keys(e.porRegion).sort();
    chartDinamico = new Chart(ctx, { type: 'bar', data: { labels: regiones, datasets: [{ label: 'OPTs', data: regiones.map(k => e.porRegion[k]), backgroundColor: '#1a3d7c' }] }, options: { scales: { y: { beginAtZero: true } }, plugins: { legend: { display: false } } } });
  }
  else if (tipo === 'reporte') {
    titulo = "Reportes por Estatus (Semáforo)";
    subtitulo = "Cumplimiento de reportes de las OPT según el semáforo.";
    chartDinamico = new Chart(ctx, { type: 'doughnut', data: { labels: ['En plazo', 'Sin novedad', 'Objetado', 'Sin reportar'], datasets: [{ data: [e.porReporte.blanco, e.porReporte.verde, e.porReporte.amarillo, e.porReporte.rojo], backgroundColor: ['#e9ecef', '#28a745', '#ffc107', '#dc3545'] }] } });
  }
  else if (tipo === 'top10') {
    titulo = "Top 10 Estados por cantidad de OPT";
    subtitulo = "Estados con mayor presencia de infraestructura postal.";
    chartDinamico = new Chart(ctx, { type: 'bar', data: { labels: d.top_10_estados_por_opt.map(x => x.estado), datasets: [{ label: 'Cantidad', data: d.top_10_estados_por_opt.map(x => x.cantidad), backgroundColor: '#6f42c1' }] }, options: { plugins: { legend: { display: false } } } });
  } else {
    // Fallback por si envían un tipo desconocido
    titulo = "Tipo de gráfico no reconocido";
    subtitulo = "Por favor, seleccione otra opción del menú.";
  }

  const tituloEl = document.getElementById('din-titulo');
  const subEl = document.getElementById('din-subtitulo');
  if(tituloEl) tituloEl.textContent = titulo;
  if(subEl) subEl.textContent = subtitulo;

  // Pedir los textos analíticos al backend
  const resEl = document.getElementById('din-resumen');
  const accEl = document.getElementById('din-acciones');
  const obsEl = document.getElementById('din-observaciones');

  if(resEl) resEl.textContent = "Generando análisis...";
  if(accEl) accEl.textContent = "Generando acciones...";
  if(obsEl) obsEl.textContent = "Generando observaciones...";

  try {
    const rTex = await apiPost('obtenerAnalisisIA', { token: USUARIO.token, tipoGrafico: tipo });
    if (rTex.ok && rTex.textos) {
      if(resEl) resEl.textContent = rTex.textos.resumen;
      if(accEl) accEl.innerText = rTex.textos.acciones;
      if(obsEl) obsEl.textContent = rTex.textos.observaciones;
    }
  } catch (error) {
    console.error("Error al generar análisis:", error);
  }
}

async function descargarPdfInforme() {
  const btn = document.getElementById('btn-pdf');
  if(!btn) return;
  
  const textoOriginal = btn.innerHTML;
  
  btn.innerHTML = '⏳ Generando PDF...';
  btn.disabled = true;

  try {
    const r = await apiPost('generarPdfInformeGlobal', { token: USUARIO.token });
    if (r.ok && r.pdfUrl) {
      window.open(r.pdfUrl, '_blank');
      alert('¡Informe PDF generado con éxito!\nSe ha abierto en una nueva pestaña y se guardó en tu Google Drive.');
    } else {
      alert('Error al generar el PDF: ' + (r.error || 'Desconocido'));
    }
  } catch (error) {
    alert('Error de conexión al intentar generar el PDF.');
    console.error(error);
  } finally {
    btn.innerHTML = textoOriginal;
    btn.disabled = false;
  }
}

function cerrarSesion() {
  localStorage.removeItem('oep_usuario');
  location.href = 'index.html';
}
