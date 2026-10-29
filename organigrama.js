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

// Función para dibujar el árbol en HTML
function renderizarArbol(nodos) {
  document.getElementById('loading').classList.add('d-none');
  const container = document.getElementById('organigrama-container');
  container.classList.remove('d-none');
  
  let html = '<ul class="arbol-organigrama">';
  
  nodos.forEach(nodo => {
    let claseColor = 'opt';
    if (nodo.nivel === 'PRESIDENCIA') claseColor = 'presidencia';
    else if (nodo.nivel === 'DIRECCION') claseColor = 'direccion';
    else if (nodo.nivel === 'GERENCIA') claseColor = 'gerencia';
    else if (nodo.nivel === 'DIVISION') claseColor = 'division';

    html += `<li>`;
    html += `<div class="nodo-item ${claseColor}" onclick="toggleHijos(this)">`;
    html += `<span class="nodo-titulo">${nodo.nombre}</span>`;
    html += `<span class="nodo-badge">${nodo.cantidad} pers.</span>`;
    html += `</div>`;

    if (nodo.hijos && nodo.hijos.length > 0) {
      html += `<ul class="nodo-hijos" style="display: none;">`;
      nodo.hijos.forEach(hijo => {
        html += renderizarHijoHTML(hijo);
      });
      html += `</ul>`;
    }
    html += `</li>`;
  });
  
  html += '</ul>';
  container.innerHTML = html;
}

function renderizarHijoHTML(nodo) {
  let claseColor = 'opt';
  if (nodo.nivel === 'DIRECCION') claseColor = 'direccion';
  else if (nodo.nivel === 'GERENCIA') claseColor = 'gerencia';
  else if (nodo.nivel === 'DIVISION') claseColor = 'division';

  let html = `<li>`;
  html += `<div class="nodo-item ${claseColor}" onclick="toggleHijos(this)">`;
  html += `<span class="nodo-titulo">${nodo.nombre}</span>`;
  html += `<span class="nodo-badge">${nodo.cantidad} pers.</span>`;
  html += `</div>`;

  if (nodo.hijos && nodo.hijos.length > 0) {
    html += `<ul class="nodo-hijos" style="display: none;">`;
    nodo.hijos.forEach(hijo => {
      html += renderizarHijoHTML(hijo);
    });
    html += `</ul>`;
  }
  html += `</li>`;
  return html;
}

// Función para abrir/cerrar carpetas
window.toggleHijos = function(elemento) {
  const ul = elemento.nextElementSibling;
  if (ul && ul.tagName === 'UL') {
    if (ul.style.display === 'none') {
      ul.style.display = 'block';
      elemento.classList.add('abierto');
    } else {
      ul.style.display = 'none';
      elemento.classList.remove('abierto');
    }
  }
};

// Función de filtro (Buscador)
window.filtrarOrganigrama = function() {
  const texto = document.getElementById('buscador').value.toLowerCase();
  const container = document.getElementById('organigrama-container');
  
  if (texto === '') {
    renderizarArbol(ARBOL_GLOBAL);
    return;
  }

  // Buscar en todo el árbol
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
    container.innerHTML = '<p class="text-center text-muted mt-4">No se encontraron resultados para: <b>' + texto + '</b></p>';
    return;
  }

  let html = '<ul class="arbol-organigrama">';
  resultados.forEach(nodo => {
    let claseColor = nodo.nivel === 'DIRECCION' ? 'direccion' : (nodo.nivel === 'GERENCIA' ? 'gerencia' : 'opt');
    html += `<li><div class="nodo-item ${claseColor}">`;
    html += `<span class="nodo-titulo">${nodo.nombre}</span>`;
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
