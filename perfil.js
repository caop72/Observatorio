/**************************************************************
 * OEP - Perfil con Fotos y GPS
 **************************************************************/

const API_URL = 'https://script.google.com/macros/s/AKfycbzn4bcq0uYlNnunsv8ePtzIzaHI606CjgXunrOVClZ29pYhXP5CcFPAUck7O0V31CeJOQ/exec';

let USUARIO = null;
let TOKEN = null;
let OPT_DATA = null;

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
  TOKEN = USUARIO.token;

  // Cargar datos iniciales
  const res = await api('obtenerDatosPerfil', { token: TOKEN });
  
  if (res.ok) {
    document.getElementById('datos-nombre').textContent = USUARIO.nombres + ' ' + USUARIO.apellidos;
    document.getElementById('datos-cargo').textContent = USUARIO.cargo;
    document.getElementById('datos-ubicacion').textContent = (USUARIO.estado || '') + ' / ' + (USUARIO.region || '');

    // Foto Usuario
    if (res.urlFotoUsuario) {
      document.getElementById('preview-foto-usuario').src = res.urlFotoUsuario;
    }

    // Lógica para Jefes y Gerentes
    if (USUARIO.cargo === 'Jefe de OPT' || USUARIO.cargo === 'Gerente de Estado') {
      document.getElementById('card-foto-sede').style.display = '';
      document.getElementById('card-gps').style.display = '';
      
      if (res.optData) {
        OPT_DATA = res.optData;
        document.getElementById('nombre-opt-sede').textContent = OPT_DATA.nombre + ' (' + OPT_DATA.idOpt + ')';
        if (OPT_DATA.fotoFachada) {
          document.getElementById('preview-foto-opt').src = OPT_DATA.fotoFachada;
        }
        if (OPT_DATA.latitud && OPT_DATA.longitud) {
          document.getElementById('input-lat').value = OPT_DATA.latitud;
          document.getElementById('input-lng').value = OPT_DATA.longitud;
          mostrarMapa(OPT_DATA.latitud, OPT_DATA.longitud);
        }
      }
    }
  }
});

// ==========================================
// FOTO USUARIO
// ==========================================
document.getElementById('input-foto-usuario').addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(evt) {
      document.getElementById('preview-foto-usuario').src = evt.target.result;
    };
    reader.readAsDataURL(file);
  }
});

async function guardarFotoUsuario() {
  const input = document.getElementById('input-foto-usuario');
  if (!input.files || !input.files[0]) { alert('Selecciona una foto primero'); return; }

  const msg = document.getElementById('msg-foto-usuario');
  msg.textContent = 'Subiendo...';
  msg.style.color = 'blue';

  const reader = new FileReader();
  reader.onload = async function(evt) {
    const res = await api('subirFotoUsuario', { token: TOKEN, imagenBase64: evt.target.result });
    if (res.ok) {
      msg.textContent = '✅ Foto actualizada';
      msg.style.color = 'green';
      // Actualizar localStorage si es necesario (opcional)
    } else {
      msg.textContent = '❌ Error: ' + res.error;
      msg.style.color = 'red';
    }
  };
  reader.readAsDataURL(input.files[0]);
}

// ==========================================
// FOTO OPT
// ==========================================
document.getElementById('input-foto-opt').addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(evt) {
      document.getElementById('preview-foto-opt').src = evt.target.result;
    };
    reader.readAsDataURL(file);
  }
});

async function guardarFotoOpt() {
  const input = document.getElementById('input-foto-opt');
  if (!input.files || !input.files[0]) { alert('Selecciona una foto primero'); return; }
  if (!OPT_DATA) { alert('No hay OPT asignada'); return; }

  const msg = document.getElementById('msg-foto-opt');
  msg.textContent = 'Subiendo...';
  msg.style.color = 'blue';

  const reader = new FileReader();
  reader.onload = async function(evt) {
    const res = await api('subirFotoOpt', { 
      token: TOKEN, 
      idOpt: OPT_DATA.idOpt, 
      imagenBase64: evt.target.result 
    });
    if (res.ok) {
      msg.textContent = '✅ Foto de sede actualizada';
      msg.style.color = 'green';
    } else {
      msg.textContent = '❌ Error: ' + res.error;
      msg.style.color = 'red';
    }
  };
  reader.readAsDataURL(input.files[0]);
}

// ==========================================
// GPS
// ==========================================
function capturarGPS() {
  const msg = document.getElementById('msg-gps');
  msg.textContent = 'Obteniendo coordenadas...';
  msg.style.color = 'blue';

  if (!navigator.geolocation) {
    msg.textContent = '❌ Tu navegador no soporta GPS';
    msg.style.color = 'red';
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      document.getElementById('input-lat').value = lat;
      document.getElementById('input-lng').value = lng;
      mostrarMapa(lat, lng);
      msg.textContent = '✅ Coordenadas capturadas. Presiona "Guardar Ubicación".';
      msg.style.color = 'green';
    },
    (error) => {
      msg.textContent = '❌ Error al obtener GPS: ' + error.message;
      msg.style.color = 'red';
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

function mostrarMapa(lat, lng) {
  const divMapa = document.getElementById('mapa-confirmacion');
  divMapa.style.display = 'block';
  // Usamos un iframe de OpenStreetMap (no requiere API key)
  divMapa.innerHTML = `
    <iframe width="100%" height="100%" frameborder="0" scrolling="no" marginheight="0" marginwidth="0" 
      src="https://www.openstreetmap.org/export/embed.html?bbox=${lng-0.005}%2C${lat-0.005}%2C${lng+0.005}%2C${lat+0.005}&layer=mapnik&marker=${lat}%2C${lng}">
    </iframe>
  `;
}

async function guardarGPS() {
  const lat = document.getElementById('input-lat').value;
  const lng = document.getElementById('input-lng').value;
  if (!lat || !lng) { alert('Primero captura las coordenadas'); return; }
  if (!OPT_DATA) { alert('No hay OPT asignada'); return; }

  const msg = document.getElementById('msg-gps');
  msg.textContent = 'Guardando...';
  msg.style.color = 'blue';

  const res = await api('guardarUbicacionOpt', {
    token: TOKEN,
    idOpt: OPT_DATA.idOpt,
    latitud: lat,
    longitud: lng
  });

  if (res.ok) {
    msg.textContent = '✅ Ubicación guardada correctamente';
    msg.style.color = 'green';
  } else {
    msg.textContent = '❌ Error: ' + res.error;
    msg.style.color = 'red';
  }
}

// ==========================================
// CAMBIAR CLAVE (existente)
// ==========================================
async function cambiarClave() {
  // ... (tu código original de cambiar clave) ...
  const actual = document.getElementById('clave-actual').value;
  const nueva = document.getElementById('clave-nueva').value;
  const confirmar = document.getElementById('clave-confirmar').value;
  const msg = document.getElementById('msg');
  msg.textContent = '';

  if (nueva !== confirmar) { msg.textContent = 'Las claves no coinciden'; return; }
  if (nueva.length < 6) { msg.textContent = 'Mínimo 6 caracteres'; return; }

  const res = await api('cambiarClave', { token: TOKEN, claveActual: actual, claveNueva: nueva });
  if (res.ok) {
    alert('Clave cambiada. Inicia sesión de nuevo.');
    localStorage.clear();
    location.href = 'index.html';
  } else {
    msg.textContent = res.error;
  }
}

async function cerrarSesion() {
  try {
    if (TOKEN) await api('logout', { token: TOKEN });
  } catch (e) {}
  localStorage.clear();
  sessionStorage.clear();
  location.href = 'index.html';
}
