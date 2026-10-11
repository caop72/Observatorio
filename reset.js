/**************************************************************
 * OEP - Recuperación de clave
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

let TOKEN_RESET = null;

window.addEventListener('DOMContentLoaded', async () => {
  const url = new URL(window.location.href);
  const token = url.searchParams.get('token');

  if (!token) return; // Vista solicitar

  // Validar token
  const r = await api('validarTokenReset', { token });
  if (!r.ok) {
    document.getElementById('vista-solicitar').classList.add('activa');
    document.getElementById('vista-cambiar').classList.remove('activa');
    const msg = document.getElementById('msg-solicitar');
    msg.style.color = '#c0392b';
    msg.textContent = r.error;
    return;
  }

  // Token válido → mostrar vista cambiar
  TOKEN_RESET = token;
  document.getElementById('vista-solicitar').classList.remove('activa');
  document.getElementById('vista-cambiar').classList.add('activa');
});

async function solicitarReset() {
  const msg = document.getElementById('msg-solicitar');
  msg.style.color = '#c0392b';
  msg.textContent = '';

  const identificador = document.getElementById('identificador').value.trim();
  if (!identificador) {
    msg.textContent = 'Ingresa tu usuario o cédula';
    return;
  }

  msg.style.color = '#1a3d7c';
  msg.textContent = 'Enviando...';

  const r = await api('solicitarResetClave', { identificador });
  if (!r.ok) {
    msg.style.color = '#c0392b';
    msg.textContent = r.error;
    return;
  }

  msg.style.color = '#27ae60';
  msg.textContent = '✅ ' + r.mensaje + ' Revisa tu correo.';
}

async function cambiarClaveToken() {
  const msg = document.getElementById('msg-cambiar');
  msg.style.color = '#c0392b';
  msg.textContent = '';

  const nueva = document.getElementById('clave-nueva').value;
  const confirmar = document.getElementById('clave-confirmar').value;

  if (!nueva || !confirmar) {
    msg.textContent = 'Completa los 2 campos';
    return;
  }

  if (nueva !== confirmar) {
    msg.textContent = 'Las claves no coinciden';
    return;
  }

  if (nueva.length < 6) {
    msg.textContent = 'La clave debe tener al menos 6 caracteres';
    return;
  }

  msg.style.color = '#1a3d7c';
  msg.textContent = 'Cambiando...';

  const r = await api('cambiarClaveConToken', { token: TOKEN_RESET, claveNueva: nueva });
  if (!r.ok) {
    msg.style.color = '#c0392b';
    msg.textContent = r.error;
    return;
  }

  msg.style.color = '#27ae60';
  msg.textContent = '✅ Clave cambiada. Redirigiendo al login...';

  setTimeout(() => {
    location.href = 'index.html';
  }, 2000);
}
