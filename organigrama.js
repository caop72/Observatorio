const API_URL = 'https://script.google.com/macros/s/AKfycbzn4bcq0uYlNnunsv8ePtzIzaHI606CjgXunrOVClZ29pYhXP5CcFPAUck7O0V31CeJOQ/exec';
let USUARIO = null;
let TOKEN = null;

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
    dibujarOrganigrama(r.estructura);
  } catch (e) {
    document.getElementById('loading').classList.add('d-none');
    document.getElementById('error-msg').classList.remove('d-none');
    document.getElementById('error-msg').textContent = 'Error: ' + e.message;
  }
});

function dibujarOrganigrama(estructura) {
  document.getElementById('loading').classList.add('d-none');
  document.getElementById('organigrama-container').classList.remove('d-none');

  let graphDef = 'graph TD\n';
  
  graphDef += '  classDef presidencial fill:#1a3d7c,color:white,stroke:#fff,stroke-width:2px;\n';
  graphDef += '  classDef direccion fill:#28a745,color:white,stroke:#fff,stroke-width:1px;\n';
  graphDef += '  classDef gerencia fill:#ffc107,color:black,stroke:#fff,stroke-width:1px;\n';
  graphDef += '  classDef opt fill:#17a2b8,color:white,stroke:#fff,stroke-width:1px;\n';
  graphDef += '  classDef personal fill:#e9ecef,color:black,stroke:#ccc,stroke-width:1px;\n';

  estructura.forEach(nodo => {
    const idNodo = `N${nodo.id.replace(/[^a-zA-Z0-9]/g, '')}`;
    const etiqueta = `"${nodo.nombre}<br/><small>(${nodo.cantidad} pers.)</small>"`;
    
    graphDef += `  ${idNodo}[${etiqueta}]\n`;

    if (nodo.nivel === 'PRESIDENCIA' || nodo.nivel === 'DESPACHO') graphDef += `  class ${idNodo} presidencial;\n`;
    else if (nodo.nivel === 'DIRECCION') graphDef += `  class ${idNodo} direccion;\n`;
    else if (nodo.nivel === 'GERENCIA') graphDef += `  class ${idNodo} gerencia;\n`;
    else if (nodo.nivel === 'OPT') graphDef += `  class ${idNodo} opt;\n`;
    else graphDef += `  class ${idNodo} personal;\n`;

    if (nodo.padre) {
      const idPadre = `N${nodo.padre.replace(/[^a-zA-Z0-9]/g, '')}`;
      graphDef += `  ${idPadre} --> ${idNodo}\n`;
    }
  });

  // 🔥 CORRECCIÓN AQUÍ: Le decimos a Mermaid que procese el código
  const contenedor = document.getElementById('mermaid-graph');
  contenedor.innerHTML = ''; // Limpiamos el contenedor
  contenedor.textContent = graphDef; // Inyectamos el código como texto
  contenedor.removeAttribute('data-processed'); // Forzamos el reprocesamiento
  
  mermaid.init(undefined, contenedor);
}

async function cerrarSesion() {
  try { if (TOKEN) await api('logout', { token: TOKEN }); } catch (e) {}
  localStorage.clear(); location.href = 'index.html';
}
