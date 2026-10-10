/**************************************************************
 * OEP - Frontend
 * FASE 4: Splash + Login + Registro
 **************************************************************/

const API_URL = 'https://script.google.com/macros/s/AKfycbygWy1uVxFC32sdHM5gHk3o-p_LWHudotGaEaUC1rkWnLbPcK2Z8sqtzaZ9R_GY7fwzEQ/exec';

const REGIONES_ESTADOS = {
  'Andina':       ['Mérida', 'Trujillo', 'Táchira'],
  'Capital':      ['Distrito Capital', 'Miranda', 'Vargas'],
  'Central':      ['Aragua', 'Carabobo', 'Cojedes'],
  'Centro Llano': ['Apure', 'Barinas', 'Guárico', 'Portuguesa'],
  'Occidente':    ['Falcón', 'Lara', 'Yaracuy', 'Zulia'],
  'Oriente':      ['Anzoátegui', 'Bolívar', 'Delta Amacuro', 'Monagas',
                   'Nueva Esparta', 'Sucre', 'Amazonas']
};

// ============================================================
// NAVEGACIÓN
// ============================================================
function irA(vista) {
  document.querySelectorAll('.vista').forEach(v => v.classList.remove('activa'));
  document.getElementById('vista-' + vista).classList.add('activa');
}

// ============================================================
// API
// ============================================================
async function llamarAPI(accion, datos) {
  const payload = Object.assign({ accion: accion }, datos || {});
  const resp = await fetch(API_URL, {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }
  });
  return await resp.json();
}

// ============================================================
// LOGIN
// ============================================================
async function hacerLogin() {
  const usuario = document.getElementById('login-usuario').value.trim();
  const clave = document.getElementById('login-clave').value;
  const msg = document.getElementById('login-msg');
  msg.textContent = '';

  if (!usuario || !clave) {
    msg.textContent = 'Complete usuario y clave';
    return;
  }

  msg.textContent = 'Verificando...';

  try {
    const r = await llamarAPI('login', { usuario, clave });
    if (!r.ok) { msg.textContent = r.error; return; }

    localStorage.setItem('oep_token', r.token);
    localStorage.setItem('oep_usuario', JSON.stringify(r.usuario));

    document.getElementById('panel-nombre').textContent =
      r.usuario.nombres + ' ' + r.usuario.apellidos;
    document.getElementById('panel-cargo').textContent = r.usuario.cargo;
       if (r.usuario.cargo === 'Jefe de OPT') {
      location.href = 'reporte.html';
    } else {
      irA('panel');
    }
  } catch (e) {
    msg.textContent = 'Error de conexión: ' + e.message;
  }
}

// ============================================================
// LOGOUT
// ============================================================
async function hacerLogout() {
  const token = localStorage.getItem('oep_token');
  if (token) await llamarAPI('logout', { token });
  localStorage.clear();
  irA('splash');
}

// ============================================================
// REGISTRO
// ============================================================
function cargarRegionesRegistro() {
  const sel = document.getElementById('reg-region');
  Object.keys(REGIONES_ESTADOS).forEach(r => {
    const opt = document.createElement('option');
    opt.value = r;
    opt.textContent = r;
    sel.appendChild(opt);
  });
}

function cargarEstadosRegistro() {
  const region = document.getElementById('reg-region').value;
  const sel = document.getElementById('reg-estado');
  sel.innerHTML = '<option value="">Seleccione...</option>';
  if (!region) return;
  REGIONES_ESTADOS[region].forEach(e => {
    const opt = document.createElement('option');
    opt.value = e;
    opt.textContent = e;
    sel.appendChild(opt);
  });
}

async function hacerRegistro() {
  const msg = document.getElementById('registro-msg');
  msg.textContent = '';

  const datos = {
    cedula: document.getElementById('reg-cedula').value.trim(),
    nombres: document.getElementById('reg-nombres').value.trim(),
    apellidos: document.getElementById('reg-apellidos').value.trim(),
    cargo: document.getElementById('reg-cargo').value,
    email: document.getElementById('reg-email').value.trim(),
    telefono: document.getElementById('reg-telefono').value.trim(),
    direccion: document.getElementById('reg-direccion').value.trim(),
    region: document.getElementById('reg-region').value,
    estado: document.getElementById('reg-estado').value,
    opt: document.getElementById('reg-opt').value.trim(),
    usuario: document.getElementById('reg-usuario').value.trim(),
    clave: document.getElementById('reg-clave').value
  };

  const obligatorios = ['cedula','nombres','apellidos','cargo','email','usuario','clave'];
  for (const c of obligatorios) {
    if (!datos[c]) { msg.textContent = 'Falta: ' + c; return; }
  }

  msg.textContent = 'Registrando...';

  try {
    const r = await llamarAPI('registrar', datos);
    if (!r.ok) { msg.textContent = r.error; return; }
    msg.style.color = '#27ae60';
    msg.textContent = '✅ Registrado como ' + r.idUsuario + '. Redirigiendo...';
    setTimeout(() => irA('login'), 1500);
  } catch (e) {
    msg.textContent = 'Error: ' + e.message;
  }
}

// ============================================================
// ARRANQUE
// ============================================================
window.addEventListener('DOMContentLoaded', () => {
  cargarRegionesRegistro();

  // Auto-login si hay token
  const token = localStorage.getItem('oep_token');
  const usuario = localStorage.getItem('oep_usuario');
  if (token && usuario) {
    const u = JSON.parse(usuario);
    document.getElementById('panel-nombre').textContent = u.nombres + ' ' + u.apellidos;
    document.getElementById('panel-cargo').textContent = u.cargo;
    irA('panel');
  }
});
