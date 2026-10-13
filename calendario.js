const API_URL = 'https://script.google.com/macros/s/AKfycbzn4bcq0uYlNnunsv8ePtzIzaHI606CjgXunrOVClZ29pYhXP5CcFPAUck7O0V31CeJOQ/exec';

function getToken() {
  var U = JSON.parse(localStorage.getItem('oep_usuario') || 'null');
  return U ? U.token : null;
}

function getUsuario() {
  return JSON.parse(localStorage.getItem('oep_usuario') || 'null');
}

function cerrarSesion() {
  localStorage.removeItem('oep_usuario');
  location.href = 'index.html';
}

function mostrarMsg(txt, esError) {
  var el = document.getElementById('msg');
  el.innerHTML = '<div class="alert ' + (esError ? 'alert-danger' : 'alert-success') + ' py-2 mb-0">' + txt + '</div>';
  setTimeout(function(){ el.innerHTML = ''; }, 3500);
}

async function llamarAPI(accion, datos) {
  var token = getToken();
  if (!token) { location.href = 'index.html'; return null; }
  var body = Object.assign({ accion: accion, token: token }, datos || {});
  var r = await fetch(API_URL, {
    method: 'POST',
    body: JSON.stringify(body)
  });
  return await r.json();
}

function limpiarForm() {
  document.getElementById('c-fecha').value = '';
  document.getElementById('c-motivo').value = '';
  document.getElementById('c-obs').value = '';
  document.getElementById('c-laborable').value = 'NO';
}

async function cargarCalendario() {
  var res = await llamarAPI('obtenerCalendario');
  if (!res || !res.ok) { mostrarMsg('Error al cargar calendario', true); return; }
  var tbody = document.querySelector('#tabla-cal tbody');
  tbody.innerHTML = '';
  (res.calendario || []).forEach(function(d) {
    var tr = document.createElement('tr');
    tr.innerHTML =
      '<td>' + d.fecha + '</td>' +
      '<td>' + (d.es_laborable ? '<span class="badge bg-success">SI</span>' : '<span class="badge bg-danger">NO</span>') + '</td>' +
      '<td>' + (d.motivo || '') + '</td>' +
      '<td>' + (d.observacion || '') + '</td>' +
      '<td><button class="btn btn-sm btn-outline-danger" onclick="eliminarDia(\'' + d.fecha + '\')">🗑</button></td>';
    tbody.appendChild(tr);
  });
}

async function guardarDia() {
  var fecha = document.getElementById('c-fecha').value;
  if (!fecha) { mostrarMsg('Selecciona una fecha', true); return; }
  var res = await llamarAPI('guardarDiaCalendario', {
    fecha: fecha,
    es_laborable: document.getElementById('c-laborable').value === 'SI',
    motivo: document.getElementById('c-motivo').value,
    observacion: document.getElementById('c-obs').value
  });
  if (!res || !res.ok) { mostrarMsg((res && res.error) || 'Error al guardar', true); return; }
  mostrarMsg('Guardado: ' + res.accion + ' (' + res.fecha + ')', false);
  limpiarForm();
  cargarCalendario();
}

async function eliminarDia(fecha) {
  if (!confirm('¿Eliminar ' + fecha + '?')) return;
  var res = await llamarAPI('eliminarDiaCalendario', { fecha: fecha });
  if (!res || !res.ok) { mostrarMsg((res && res.error) || 'Error al eliminar', true); return; }
  mostrarMsg('Eliminado: ' + fecha, false);
  cargarCalendario();
}

document.addEventListener('DOMContentLoaded', function() {
  var U = getUsuario();
  if (!U) { location.href = 'index.html'; return; }
  document.getElementById('nav-usuario').textContent = (U.nombres || '') + ' — ' + (U.cargo || '');
  cargarCalendario();
});
