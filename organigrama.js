const API_URL = 'https://script.google.com/macros/s/AKfycbzn4bcq0uYlNnunsv8ePtzIzaHI606CjgXunrOVClZ29pYhXP5CcFPAUck7O0V31CeJOQ/exec';
let USUARIO = null;
let TOKEN = null;
let ARBOL_GLOBAL = [];

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
  
  const rol = (USUARIO.rol || USUARIO.cargo || '').toString();
  if (rol !== 'Observatorio') {
    alert('Esta sección es exclusiva del Observatorio.');
    location.href = 'reporte.html';
    return;
  }

  TOKEN = USUARIO.token;
  document.getElementById('nav-usuario').textContent = 
    (USUARIO.nombres || '') + ' ' + (USUARIO.apellidos || '') + ' — ' + (USUARIO.cargo || '');

  try {
    const r = await api('obtenerOrganigrama', { token: TOKEN });
    if (!r.ok) throw new Error(r.error);
    ARBOL_GLOBAL = r.estructura;
    renderizarArbol(ARBOL_GLOBAL);
  } catch (e) {
    document.getElementById('loading').classList.add('d-none');
    document.getElementById('error-msg').classList.remove('d-none');
    document.getElementById('error-msg').textContent = 'Error: ' + e.message;
  }
});

function renderizarArbol(nodos) {
  document.getElementById('loading').classList.add('d-none');
  const container = document.getElementById('tree-root');
  container.classList.remove('d-none');
  
  let html = '<ul>';
  nodos.forEach(nodo => {
    html += crearNodoHTML(nodo, true); 
  });
  html += '</ul>';
  
  container.innerHTML = html;
}

function crearNodoHTML(nodo, abiertoPorDefecto = false) {
  let claseColor = 'opt';
  if (nodo.nivel === 'PRESIDENCIA') claseColor = 'presidencia';
  else if (nodo.nivel === 'DIRECCION') claseColor = 'direccion';
  else if (nodo.nivel === 'GERENCIA') claseColor = 'gerencia';
  else if (nodo.nivel === 'DIVISION') claseColor = 'division';

  const tieneHijos = nodo.hijos && nodo.hijos.length > 0;
  const displayHijos = abiertoPorDefecto ? 'abierto' : '';
  
  const botonToggle = tieneHijos ? `<div class="btn-toggle" onclick="toggleNodo(event, this)">${abiertoPorDefecto ? '-' : '+'}</div>` : '';

  let html = `<li>`;
  html += `<div class="nodo-card ${claseColor}" ${tieneHijos ? 'onclick="toggleNodo(event, this)"' : ''}>`;
  html += botonToggle;
  html += `${nodo.nombre}`;
  html += `<span class="nodo-badge">${nodo.cantidad} pers.</span>`;
  html += `</div>`;

  if (tieneHijos) {
    html += `<ul class="nodo-hijos ${displayHijos}">`;
    nodo.hijos.forEach(hijo => {
      html += crearNodoHTML(hijo, false);
    });
    html += `</ul>`;
  }
  
  html += `</li>`;
  return html;
}

window.toggleNodo = function(event, element) {
  event.stopPropagation(); 
  
  const tarjeta = element.classList.contains('btn-toggle') ? element.parentElement : element;
  const ul = tarjeta.nextElementSibling;
  const btn = tarjeta.querySelector('.btn-toggle');

  if (ul && ul.tagName === 'UL') {
    if (ul.classList.contains('abierto')) {
      ul.classList.remove('abierto');
      if (btn) btn.textContent = '+';
    } else {
      ul.classList.add('abierto');
      if (btn) btn.textContent = '-';
    }
  }
};

window.expandirTodo = function() {
  document.querySelectorAll('.nodo-hijos').forEach(ul => ul.classList.add('abierto'));
  document.querySelectorAll('.btn-toggle').forEach(btn => btn.textContent = '-');
};

window.contraerTodo = function() {
  document.querySelectorAll('.nodo-hijos').forEach(ul => ul.classList.remove('abierto'));
  document.querySelectorAll('.btn-toggle').forEach(btn => btn.textContent = '+');
};

window.filtrarOrganigrama = function() {
  const texto = document.getElementById('buscador').value.toLowerCase();
  const container = document.getElementById('tree-root');
  
  if (texto === '') {
    renderizarArbol(ARBOL_GLOBAL);
    return;
  }

  function buscarEnNodos(nodos) {
    let resultados = [];
    nodos.forEach(nodo => {
      if (nodo.nombre.toLowerCase().includes(texto) || nodo.id.toLowerCase().includes(texto)) {
        resultados.push(nodo);
      }
      if (nodo.hijos && nodo.hijos.length > 0) {
        resultados = resultados.concat(buscarEnNodos(nodo.hijos));
      }
    });
    return resultados;
  }

  const resultados = buscarEnNodos(ARBOL_GLOBAL);
  
  if (resultados.length === 0) {
    container.innerHTML = '<p class="text-center text-muted mt-4">No se encontraron resultados.</p>';
    return;
  }

  let html = '<ul>';
  resultados.forEach(nodo => {
    let claseColor = nodo.nivel === 'DIRECCION' ? 'direccion' : (nodo.nivel === 'GERENCIA' ? 'gerencia' : 'opt');
    html += `<li><div class="nodo-card ${claseColor}">`;
    html += `${nodo.nombre}`;
    html += `<span class="nodo-badge">${nodo.cantidad} pers.</span>`;
    html += `</div></li>`;
  });
  html += '</ul>';
  container.innerHTML = html;
};

async function cerrarSesion() {
  try { if (TOKEN) await api('logout', { token: TOKEN }); } catch (e) {}
  localStorage.clear(); location.href = 'index.html';
}
