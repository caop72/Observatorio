/**************************************************************
 * OEP - Mi Perfil
 **************************************************************/

const API_URL = 'https://script.google.com/macros/s/AKfycbzn4bcq0uYlNnunsv8ePtzIzaHI606CjgXunrOVClZ29pYhXP5CcFPAUck7O0V31CeJOQ/exec';

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
  const usuario = JSON.parse(localStorage.getItem('oep_usuario') || 'null');

  if (!token || !usuario) {
    location.href = 'index.html';
    return;
  }

  document.getElementById('nav-usuario').textContent =
    usuario.nombres + ' ' + usuario.apellidos + ' — ' + usuario.cargo;
  document.getElementById('datos-nombre').textContent = usuario.nombres + ' ' + usuario.apellidos;
  document.getElementById('datos-cargo').textContent = usuario.cargo;
  document.getElementById('datos-ubicacion').textContent =
    (usuario.estado || '-') + ' / ' + (usuario.region || '-');
});

async function cambiarClave() {
  const msg = document.getElementById('msg');
  msg.style.color = '#c0392b';
  msg.textContent = '';

  const actual = document.getElementById('clave-actual').value;
  const nueva = document.getElementById('clave-nueva').value;
  const confirmar = document.getElementById('clave-confirmar').value;

  if (!actual || !nueva || !confirmar) {
    msg.textContent = 'Complete todos los campos';
    return;
  }

  if (nueva !== confirmar) {
    msg.textContent = 'Las claves nuevas no coinciden';
    return;
  }

  if (nueva.length < 6) {
    msg.textContent = 'La clave nueva debe tener al menos 6 caracteres';
    return;
  }

  const token = localStorage.getItem('oep_token');
  msg.textContent = 'Cambiando...';

  const r = await api('cambiarClave', { token, claveActual: actual, claveNueva: nueva });

  if (!r.ok) {
    msg.textContent = r.error;
    return;
  }

  msg.style.color = '#27ae60';
  msg.textContent = '✅ Clave cambiada. Redirigiendo al login...';

  setTimeout(() => {
    localStorage.clear();
    location.href = 'index.html';
  }, 2000);
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
