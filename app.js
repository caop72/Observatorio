/**************************************************************
 * OEP - Frontend
 * FASE 4: Splash + Login + Registro
 **************************************************************/

const API_URL = 'https://script.google.com/macros/s/AKfycbzn4bcq0uYlNnunsv8ePtzIzaHI606CjgXunrOVClZ29pYhXP5CcFPAUck7O0V31CeJOQ/exec';

const REGIONES_ESTADOS = {
  'Andina':       ['Barinas', 'Mérida', 'Táchira', 'Trujillo'],
  'Capital':      ['Distrito Capital', 'Miranda', 'La Guaira'],
  'Central':      ['Aragua', 'Carabobo', 'Cojedes'],
  'Centro Llano': ['Apure', 'Guárico', 'Portuguesa'],
  'Occidente':    ['Falcón', 'Lara', 'Yaracuy', 'Zulia'],
  'Oriente':      ['Amazonas', 'Anzoátegui', 'Bolívar', 'Delta Amacuro',
                   'Monagas', 'Nueva Esparta', 'Sucre']
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
    localStorage.setItem('oep_usuario', JSON.stringify(Object.assign({}, r.usuario, { token: r.token })));

    document.getElementById('panel-nombre').textContent =
      r.usuario.nombres + ' ' + r.usuario.apellidos;
    document.getElementById('panel-cargo').textContent = r.usuario.cargo;

    const cargosValidacion = ['Gerente de Estado', 'Gerente de Región', 'CNC', 'Despacho', 'Observatorio'];
    if (r.usuario.cargo === 'Jefe de OPT') {
      location.href = 'reporte.html';
    } else if (cargosValidacion.includes(r.usuario.cargo)) {
      location.href = 'validacion.html';
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
  let token = null;
  try {
    const u = JSON.parse(localStorage.getItem('oep_usuario') || 'null');
    if (u && u.token) token = u.token;
  } catch(e) {}
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
  msg.style.color = '#c0392b';

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
    usuario: document.getElementById('reg-usuario').value.trim(),
    clave: document.getElementById('reg-clave').value
  };

  const obligatorios = ['cedula','nombres','apellidos','cargo','email','usuario','clave'];
  for (const c of obligatorios) {
    if (!datos[c]) { msg.textContent = 'Falta: ' + c; return; }
  }

  msg.textContent = 'Registrando...';

  try {
    // Si es Jefe de OPT → exigir OPT seleccionada
    if (datos.cargo === 'Jefe de OPT') {
      const idOpt = document.getElementById('reg-opt').value;
      if (!idOpt) {
        msg.textContent = 'Debes seleccionar la OPT';
        return;
      }
      datos.opt = idOpt;
    }

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

  // Escuchar el cambio de cargo para mostrar/ocultar bloque OPT
  const selCargo = document.getElementById('reg-cargo');
  if (selCargo) selCargo.addEventListener('change', toggleBloqueOpt);

  // Auto-login si hay sesión
  const usuario = localStorage.getItem('oep_usuario');
  if (usuario) {
    let u = null;
    try { u = JSON.parse(usuario); } catch(e) { u = null; }
    if (!u || !u.token) return;
    const cargosValidacion = ['Gerente de Estado', 'Gerente de Región', 'CNC', 'Despacho', 'Observatorio'];
    if (u.cargo === 'Jefe de OPT') {
      location.href = 'reporte.html';
    } else if (cargosValidacion.includes(u.cargo)) {
      location.href = 'validacion.html';
    } else {
      document.getElementById('panel-nombre').textContent = u.nombres + ' ' + u.apellidos;
      document.getElementById('panel-cargo').textContent = u.cargo;
      irA('panel');
    }
  }
});
// ============================================================
// FASE 6 — CASCADA MUNICIPIOS / PARROQUIAS + OPT
// ============================================================

function toggleBloqueOpt() {
  const cargo = document.getElementById('reg-cargo').value;
  const mostrar = (cargo === 'Jefe de OPT');
  const bloqueOpt = document.getElementById('bloque-opt');
  if (bloqueOpt) bloqueOpt.style.display = mostrar ? '' : 'none';
}

async function cargarOptsRegistro() {
  const estado = document.getElementById('reg-estado').value;
  const sel = document.getElementById('reg-opt');
  if (!sel) return;
  sel.innerHTML = '<option value="">Seleccione la OPT...</option>';
  if (!estado) return;

  const r = await llamarAPI('obtenerOptsPorEstado', { estado });
  if (r.ok) {
    r.opts.forEach(o => {
      const opt = document.createElement('option');
      opt.value = o.id;
      opt.textContent = o.nombre + ' (' + o.id + ')';
      sel.appendChild(opt);
    });
  }
}




