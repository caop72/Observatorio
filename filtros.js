const API_URL = 'https://script.google.com/macros/s/AKfycbzn4bcq0uYlNnunsv8ePtzIzaHI606CjgXunrOVClZ29pYhXP5CcFPAUck7O0V31CeJOQ/exec';

let USUARIO = null;
let RESULTADOS = [];

const REGIONES_ESTADOS = {
  'Andina':       ['Barinas', 'Mérida', 'Táchira', 'Trujillo'],
  'Capital':      ['Distrito Capital', 'Miranda', 'La Guaira'],
  'Central':      ['Aragua', 'Carabobo', 'Cojedes'],
  'Centro Llano': ['Apure', 'Guárico', 'Portuguesa'],
  'Occidente':    ['Falcón', 'Lara', 'Yaracuy', 'Zulia'],
  'Oriente':      ['Amazonas', 'Anzoátegui', 'Bolívar', 'Delta Amacuro', 'Monagas', 'Nueva Esparta', 'Sucre']
};

document.addEventListener('DOMContentLoaded', () => {
  USUARIO = JSON.parse(localStorage.getItem('oep_usuario') || 'null');
  if (!USUARIO || !USUARIO.token) { location.href = 'index.html'; return; }
  document.getElementById('nav-usuario').textContent =
    (USUARIO.nombres || '') + ' ' + (USUARIO.apellidos || '') + ' — ' + (USUARIO.cargo || '');

  cargarRegiones();
  cargarEstados();
});

function cargarRegiones() {
  const sel = document.getElementById('f-region');
  Object.keys(REGIONES_ESTADOS).forEach(r => {
    const opt = document.createElement('option');
    opt.value = r;
    opt.textContent = r;
    sel.appendChild(opt);
  });
  sel.addEventListener('change', cargarEstados);
}

function cargarEstados() {
  const region = document.getElementById('f-region').value;
  const sel = document.getElementById('f-estado');
  sel.innerHTML = '<option value="">Todos los estados</option>';
  const estados = region ? REGIONES_ESTADOS[region] : Object.values(REGIONES_ESTADOS).flat();
  estados.sort().forEach(e => {
    const opt = document.createElement('option');
    opt.value = e;
    opt.textContent = e;
    sel.appendChild(opt);
  });
}

async function apiPost(accion, datos) {
  const r = await fetch(API_URL, {
    method: 'POST',
    body: JSON.stringify(Object.assign({ accion }, datos || {})),
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }
  });
  return await r.json();
}

function getSeleccion(campo) {
  const checks = document.querySelectorAll(`input[type=checkbox][id^="${campo}-"]`);
  return Array.from(checks).filter(c => c.checked).map(c => c.value);
}

function setRango(tipo) {
  const hoy = new Date();
  const iso = d => d.toISOString().substring(0, 10);
  if (tipo === 'hoy') {
    document.getElementById('f-desde').value = iso(hoy);
    document.getElementById('f-hasta').value = iso(hoy);
  } else if (tipo === '7d') {
    document.getElementById('f-desde').value = iso(new Date(hoy.getTime() - 7*86400000));
    document.getElementById('f-hasta').value = iso(hoy);
  } else if (tipo === '30d') {
    document.getElementById('f-desde').value = iso(new Date(hoy.getTime() - 30*86400000));
    document.getElementById('f-hasta').value = iso(hoy);
  } else {
    document.getElementById('f-desde').value = '';
    document.getElementById('f-hasta').value = '';
  }
}

async function aplicarFiltro() {
  const filtros = {
    reporte: getSeleccion('rep'),
    estatus: getSeleccion('est'),
    legalidad: getSeleccion('leg'),
    region: document.getElementById('f-region').value,
    estado: document.getElementById('f-estado').value,
    texto: document.getElementById('f-texto').value.trim(),
    desde: document.getElementById('f-desde').value,
    hasta: document.getElementById('f-hasta').value
  };

  const r = await apiPost('listarOptsFiltradas', { token: USUARIO.token, filtros: filtros });
  if (!r.ok) { alert('Error: ' + r.error); return; }

  RESULTADOS = r.opts || [];
  renderResultados();
  document.getElementById('btn-exportar').disabled = RESULTADOS.length === 0;
}

function renderResultados() {
  document.getElementById('total-result').textContent = RESULTADOS.length;
  const tbody = document.querySelector('#tabla-resultados tbody');
  tbody.innerHTML = '';
  RESULTADOS.forEach(o => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><code>${o.id}</code></td>
      <td>${o.nombre}</td>
      <td>${o.region}</td>
      <td>${o.estado}</td>
      <td class="text-center"><span class="semaforo-punto ${o.colorReporte}"></span></td>
      <td class="text-center"><span class="semaforo-punto ${o.colorEstatus}"></span></td>
      <td class="text-center"><span class="semaforo-punto ${o.colorLegalidad}"></span></td>
      <td>${o.ultimoReporteFecha || '—'}</td>
    `;
    tbody.appendChild(tr);
  });
}

function limpiarFiltros() {
  document.querySelectorAll('input[type=checkbox]').forEach(c => c.checked = false);
  document.getElementById('f-region').value = '';
  cargarEstados();
  document.getElementById('f-texto').value = '';
  document.getElementById('f-desde').value = '';
  document.getElementById('f-hasta').value = '';
  RESULTADOS = [];
  renderResultados();
  document.getElementById('btn-exportar').disabled = true;
}

function exportarCSV() {
  if (!RESULTADOS.length) return;
  const filas = [['ID', 'Nombre', 'Region', 'Estado', 'Reporte', 'Estatus', 'Legalidad', 'UltimoReporte']];
  RESULTADOS.forEach(o => {
    filas.push([o.id, o.nombre, o.region, o.estado, o.colorReporte, o.colorEstatus, o.colorLegalidad, o.ultimoReporteFecha]);
  });
  const csv = filas.map(f => f.map(x => '"' + String(x).replace(/"/g, '""') + '"').join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'opts_filtradas_' + new Date().toISOString().substring(0,10) + '.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function cerrarSesion() {
  localStorage.removeItem('oep_usuario');
  location.href = 'index.html';
}
