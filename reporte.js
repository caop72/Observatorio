/**************************************************************
 * OEP - Módulo Jefe de OPT (Carga Diaria) — Modelo v13
 * Lógica de Tabla Interactiva de Personal (Parte Hablado)
 **************************************************************/

const API_URL = 'https://script.google.com/macros/s/AKfycbzn4bcq0uYlNnunsv8ePtzIzaHI606CjgXunrOVClZ29pYhXP5CcFPAUck7O0V31CeJOQ/exec';

let USUARIO = null;
let TOKEN = null;
let ULTIMO = null;
let CATALOGOS = {};
let modalAgregarBS = null;
let categoriaActual = '';
let selectActualId = '';
let PERSONAL_NOMINA = []; // Variable global para la tabla de novedades

const TIPOS = ['directivos','empleados','obreros','contratados'];
const SITUACIONES = ['presentes','reposo','comision','permiso','suspendido'];

// ============================================================
// API
// ============================================================
async function api(accion, datos) {
  const r = await fetch(API_URL, {
    method: 'POST',
    body: JSON.stringify(Object.assign({ accion }, datos || {})),
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }
  });
  return await r.json();
}

// ============================================================
// ARRANQUE
// ============================================================
window.addEventListener('DOMContentLoaded', async () => {
  USUARIO = JSON.parse(localStorage.getItem('oep_usuario') || 'null');
  if (!USUARIO || !USUARIO.token) { location.href = 'index.html'; return; }
  TOKEN = USUARIO.token;

  document.getElementById('nav-usuario').textContent =
    (USUARIO.nombres || '') + ' ' + (USUARIO.apellidos || '') + ' — ' + (USUARIO.cargo || '');

  const hoy = new Date();
  document.getElementById('fecha-hoy').textContent =
    hoy.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const rCat = await api('obtenerCatalogos');
  if (rCat.ok) {
    CATALOGOS = rCat.catalogos || {};
    llenarDropdown('abierta', CATALOGOS.SI_NO || ['SI', 'NO']);
    llenarDropdown('estatus-legal', CATALOGOS.ESTATUS_LEGAL || []);
    llenarDropdown('observacion', CATALOGOS.OBSERVACIONES || []);
  }

  modalAgregarBS = new bootstrap.Modal(document.getElementById('modalAgregar'));

  const idOpt = USUARIO.opt || '';
  if (idOpt) {
    const r = await api('obtenerUltimoReporte', { idOpt });
    if (r.ok && r.ultimo) {
      ULTIMO = r.ultimo;
      precargarUltimo(r.ultimo);
      document.getElementById('banner-precarga').classList.remove('d-none');
      document.getElementById('banner-fecha').textContent = formatearFecha(r.ultimo.fecha);
    }
  }

  calcularTotalRRHH();
  cargarTablaPersonal(); // Carga la tabla de novedades
});

function llenarDropdown(idSelect, valores) {
  const sel = document.getElementById(idSelect);
  if (!sel) return;
  const valorActual = sel.value;
  sel.innerHTML = '<option value="">Seleccione...</option>';
  valores.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = v;
    sel.appendChild(opt);
  });
  if (valorActual) sel.value = valorActual;
}

// ============================================================
// MODAL AGREGAR
// ============================================================
function abrirModalAgregar(categoria, selectId) {
  categoriaActual = categoria;
  selectActualId = selectId;
  document.getElementById('modal-categoria-txt').textContent = categoria;
  document.getElementById('modal-valor').value = '';
  document.getElementById('modal-msg').textContent = '';
  modalAgregarBS.show();
  setTimeout(() => document.getElementById('modal-valor').focus(), 300);
}

async function guardarNuevoValor() {
  const valor = document.getElementById('modal-valor').value.trim();
  const msg = document.getElementById('modal-msg');
  msg.style.color = '#c0392b';
  if (!valor) { msg.textContent = 'Escribe un valor'; return; }

  msg.textContent = 'Guardando...';

  try {
    const r = await api('agregarValorCatalogo', {
      token: TOKEN, categoria: categoriaActual, valor: valor
    });
    if (!r.ok) { msg.textContent = r.error || 'Error'; return; }

    const rCat = await api('obtenerCatalogos');
    if (rCat.ok) {
      CATALOGOS = rCat.catalogos || {};
      const lista = categoriaActual === 'OBSERVACIONES' ? (CATALOGOS.OBSERVACIONES || []) :
                    categoriaActual === 'ESTATUS_LEGAL' ? (CATALOGOS.ESTATUS_LEGAL || []) :
                    categoriaActual === 'SI_NO' ? (CATALOGOS.SI_NO || []) : [];
      llenarDropdown(selectActualId, lista);
      document.getElementById(selectActualId).value = valor;
    }

    msg.style.color = '#27ae60';
    msg.textContent = '✅ Agregado';
    setTimeout(() => modalAgregarBS.hide(), 800);
  } catch (e) { msg.textContent = 'Error: ' + e.message; }
}

// ============================================================
// LÓGICA DE FORMULARIO CONDICIONAL
// ============================================================
function toggleAbierta() {
  const abierta = document.getElementById('abierta').value;
  const bloqueInactiva = document.getElementById('bloque-inactiva');
  
  if (abierta === 'NO') {
    bloqueInactiva.style.display = '';
    document.getElementById('estatus').value = 'INOPERATIVA';
    toggleCausaOperativa();
  } else {
    bloqueInactiva.style.display = 'none';
    document.getElementById('causa-inactiva').value = '';
  }
}

function toggleCausaOperativa() {
  const estatus = document.getElementById('estatus').value;
  const bloqueInoperativa = document.getElementById('bloque-inoperativa');
  
  if (estatus === 'INOPERATIVA') {
    bloqueInoperativa.style.display = '';
  } else {
    bloqueInoperativa.style.display = 'none';
    document.getElementById('causa-factor').value = '';
    document.getElementById('causa-fecha').value = '';
    document.getElementById('causa-explicacion').value = '';
    document.getElementById('causa-accion').value = '';
  }
}

function precargarUltimo(ult) {
  const v = ult.valores || {};
  
  document.getElementById('abierta').value = v.abierta || '';
  document.getElementById('causa-inactiva').value = v.causa_inactiva || '';
  document.getElementById('estatus').value = v.estatus || '';
  document.getElementById('estatus-legal').value = v.estatus_legal || '';
  document.getElementById('observacion').value = v.observacion || '';
  
  document.getElementById('causa-factor').value = v.causa_factor || '';
  document.getElementById('causa-fecha').value = v.causa_fecha || '';
  document.getElementById('causa-explicacion').value = v.causa_explicacion || '';
  document.getElementById('causa-accion').value = v.causa_accion || '';

  TIPOS.forEach(t => {
    SITUACIONES.forEach(s => {
      const el = document.getElementById(s + '-' + t);
      if (el) el.value = v[s + '_' + t] || 0;
    });
    const vac = document.getElementById('vacantes-' + t);
    if (vac) vac.value = v['vacantes_' + t] || 0;
  });

  const idsInd = ['IND-01', 'IND-03', 'IND-04', 'IND-05', 'IND-06', 'IND-07', 'IND-08', 'IND-09'];
  idsInd.forEach(id => {
    const el = document.getElementById('ind-' + id);
    if (el && v[id]) el.value = v[id];
  });

  document.getElementById('observaciones').value = v.observaciones || '';
  
  toggleAbierta();
  toggleCausaOperativa();
  calcularTotalRRHH();
}

function restaurarAnterior() {
  if (!ULTIMO) return;
  precargarUltimo(ULTIMO);
}

// ============================================================
// CÁLCULOS EN VIVO
// ============================================================
function num_(id) {
  const el = document.getElementById(id);
  if (!el) return 0;
  return parseInt(el.value, 10) || 0;
}

function calcularTotalRRHH() {
  const totalesSituacion = {};
  SITUACIONES.forEach(s => totalesSituacion[s] = 0);

  let granTotalActivos = 0;
  let granTotalVacantes = 0;

  TIPOS.forEach(t => {
    let activosTipo = 0;
    SITUACIONES.forEach(s => {
      const v = num_(s + '-' + t);
      activosTipo += v;
      totalesSituacion[s] += v;
    });
    const vacantesTipo = num_('vacantes-' + t);
    const totalTipo = activosTipo + vacantesTipo;

    document.getElementById('activos-' + t).textContent = activosTipo;
    document.getElementById('total-' + t).textContent = totalTipo;

    granTotalActivos += activosTipo;
    granTotalVacantes += vacantesTipo;
  });

  SITUACIONES.forEach(s => {
    const el = document.getElementById('tot-' + s);
    if (el) el.textContent = totalesSituacion[s];
  });
  document.getElementById('tot-activos').textContent = granTotalActivos;
  document.getElementById('tot-vacantes').textContent = granTotalVacantes;
  document.getElementById('tot-total').textContent = granTotalActivos + granTotalVacantes;

  document.getElementById('total-activos').textContent = granTotalActivos;
  document.getElementById('total-vacantes').textContent = granTotalVacantes;
  document.getElementById('total-rrhh').textContent = granTotalActivos + granTotalVacantes;
}

// ============================================================
// ENVÍO
// ============================================================
function recogerDatos() {
  const d = {
    abierta: document.getElementById('abierta').value,
    causa_inactiva: document.getElementById('causa-inactiva').value.trim(),
    estatus: document.getElementById('estatus').value,
    estatus_legal: document.getElementById('estatus-legal').value,
    observacion: document.getElementById('observacion').value,
    
    causa_factor: document.getElementById('causa-factor').value,
    causa_fecha: document.getElementById('causa-fecha').value,
    causa_explicacion: document.getElementById('causa-explicacion').value.trim(),
    causa_accion: document.getElementById('causa-accion').value.trim(),
    
    observaciones: document.getElementById('observaciones').value.trim()
  };

  TIPOS.forEach(t => {
    SITUACIONES.forEach(s => {
      d[s + '_' + t] = num_(s + '-' + t);
    });
    d['vacantes_' + t] = num_('vacantes-' + t);
    d['activos_' + t] = parseInt(document.getElementById('activos-' + t).textContent, 10) || 0;
    d['total_' + t] = parseInt(document.getElementById('total-' + t).textContent, 10) || 0;
  });

  const idsInd = ['IND-01', 'IND-03', 'IND-04', 'IND-05', 'IND-06', 'IND-07', 'IND-08', 'IND-09'];
  idsInd.forEach(id => {
    const el = document.getElementById('ind-' + id);
    if (el) d[id] = el.value;
  });

  return d;
}

function validar(d) {
  if (!d.abierta) return 'Selecciona si está abierta al público';
  if (d.abierta === 'NO' && !d.causa_inactiva) return 'Explica brevemente por qué está inactiva';
  
  if (!d.estatus) return 'Selecciona el Estatus operativo';
  if (!d.estatus_legal) return 'Selecciona el Estatus legal';
  if (!d.observacion) return 'Selecciona una Observación';
  
  if (d.estatus === 'INOPERATIVA') {
    if (!d.causa_factor) return 'Selecciona el Factor Causante';
    if (!d.causa_fecha) return 'Indica la fecha del pase a inoperatividad';
    if (!d.causa_explicacion) return 'Explica la causa de la inoperatividad';
    if (!d.causa_accion) return 'Indica la acción tomada';
  }
  return null;
}

async function enviarSinNovedades() {
  if (!ULTIMO) { alert('No hay reporte anterior para reutilizar'); return; }
  precargarUltimo(ULTIMO);
  document.getElementById('observaciones').value = 'Sin novedades respecto al reporte anterior';
  await enviarReporte();
}

async function enviarReporte() {
  const msg = document.getElementById('msg');
  msg.style.color = '#c0392b';
  msg.textContent = '';

  const d = recogerDatos();
  const err = validar(d);
  if (err) { msg.textContent = err; return; }

  msg.textContent = 'Enviando...';

  try {
    const r = await api('guardarReporte', {
      token: TOKEN,
      idOpt: USUARIO.opt || '',
      valores: d,
      commit: d.causa_explicacion || d.causa_inactiva || 'Sin novedades'
    });

    if (!r.ok) { msg.textContent = r.error; return; }

    msg.style.color = '#27ae60';
    msg.textContent = '✅ Reporte enviado: ' + r.idReporte + ' — Semáforo: ' + r.semaforo;
  } catch (e) {
    msg.textContent = 'Error: ' + e.message;
  }
}

// ============================================================
// UTIL
// ============================================================
function formatearFecha(f) {
  if (!f) return '';
  try {
    const d = new Date(f);
    if (isNaN(d.getTime())) return String(f);
    return d.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch(e) { return String(f); }
}

async function cerrarSesion() {
  try { if (TOKEN) await api('logout', { token: TOKEN }); } catch (e) {}
  localStorage.clear();
  sessionStorage.clear();
  location.href = 'index.html';
}

// ============================================================
// LÓGICA DE NOVEDADES (TABLA INTERACTIVA)
// ============================================================async function cargarTablaPersonal() {
  const tbody = document.getElementById('tbody-novedades');
  if (!tbody) return;

  try {
    // 1. Cargar Personal de la OPT
    const rPersonal = await api('obtenerPersonalDeOpt', { idOpt: USUARIO.opt });
    if (!rPersonal.ok || !rPersonal.personal) throw new Error("No se pudo cargar el personal");
    
    PERSONAL_NOMINA = rPersonal.personal;

    // 2. Cargar Motivos
    const rMotivos = await api('obtenerMotivosNovedad', {});
    let opcionesMotivos = '<option value="ACTIVO">ACTIVO (Disponible)</option>';
    if (rMotivos.ok && rMotivos.motivos) {
      rMotivos.motivos.forEach(m => {
        opcionesMotivos += `<option value="${m.codigo}">${m.motivo}</option>`;
      });
    }

    // 3. Dibujar la tabla
    tbody.innerHTML = '';
    if (PERSONAL_NOMINA.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center">No hay personal registrado en esta OPT.</td></tr>';
      return;
    }

    PERSONAL_NOMINA.forEach((p) => {
      const tr = document.createElement('tr');
      tr.id = `fila-emp-${p.cedula}`;
      
      const estaActivo = p.estatus === 'ACTIVO';
      
      tr.innerHTML = `
        <td>${p.cedula}</td>
        <td>${p.nombre}</td>
        <td>${p.cargo}</td>
        <td class="text-center"><span class="badge ${estaActivo ? 'bg-success' : 'bg-warning text-dark'}">${p.estatus}</span></td>
        <td>
          <select id="sel-estatus-${p.cedula}" class="form-select form-select-sm" onchange="toggleFechas('${p.cedula}')">
             ${opcionesMotivos}
          </select>
        </td>
        <td><input type="date" id="fecha-desde-${p.cedula}" class="form-control form-control-sm" disabled></td>
        <td><input type="date" id="fecha-hasta-${p.cedula}" class="form-control form-control-sm" disabled></td>
        <td><button class="btn btn-sm btn-primary" onclick="guardarNovedadFila('${p.cedula}', '${p.nombre}')">💾 Guardar</button></td>
      `;
      tbody.appendChild(tr);
      
      document.getElementById(`sel-estatus-${p.cedula}`).value = estaActivo ? 'ACTIVO' : p.estatus;
      toggleFechas(p.cedula); 
    });

    actualizarParteNumericoDesdeNomina();

  } catch (e) { 
    console.error(e); 
    tbody.innerHTML = `<tr><td colspan="8" class="text-center text-danger">Error: ${e.message}</td></tr>`;
  }
}

window.toggleFechas = function(cedula) {
  const select = document.getElementById(`sel-estatus-${cedula}`);
  const fechaDesde = document.getElementById(`fecha-desde-${cedula}`);
  const fechaHasta = document.getElementById(`fecha-hasta-${cedula}`);
  
  if (select.value === 'ACTIVO') {
    fechaDesde.disabled = true;
    fechaHasta.disabled = true;
    fechaDesde.value = '';
    fechaHasta.value = '';
  } else {
    fechaDesde.disabled = false;
    fechaHasta.disabled = false;
    if (!fechaDesde.value) fechaDesde.value = new Date().toISOString().split('T')[0];
  }
};

window.guardarNovedadFila = async function(cedula, nombre) {
  const motivoCodigo = document.getElementById(`sel-estatus-${cedula}`).value;
  const fechaDesde = document.getElementById(`fecha-desde-${cedula}`).value;
  const fechaHasta = document.getElementById(`fecha-hasta-${cedula}`).value;
  const msgDiv = document.getElementById('msg-novedad');

  if (motivoCodigo !== 'ACTIVO' && (!fechaDesde || !fechaHasta)) {
    msgDiv.style.color = '#c0392b';
    msgDiv.textContent = 'Debe indicar la fecha Desde y Hasta para el estatus seleccionado.';
    return;
  }

  msgDiv.style.color = '#1a3d7c';
  msgDiv.textContent = 'Guardando...';

  try {
    const payload = {
      token: TOKEN,
      idOpt: USUARIO.opt,
      cedula: cedula,
      nombre: nombre,
      motivoCodigo: motivoCodigo === 'ACTIVO' ? 'NOV-00' : motivoCodigo,
      fechaDesde: fechaDesde,
      fechaHasta: fechaHasta,
      observacion: ''
    };

    const r = await api('registrarNovedad', payload);

    if (r.ok) {
      msgDiv.style.color = '#27ae60';
      msgDiv.textContent = '✅ Estatus actualizado correctamente.';
      cargarTablaPersonal(); 
    } else {
      msgDiv.style.color = '#c0392b';
      msgDiv.textContent = '❌ Error: ' + r.error;
    }
  } catch (e) {
    msgDiv.style.color = '#c0392b';
    msgDiv.textContent = '❌ Error de conexión: ' + e.message;
  }
};

function actualizarParteNumericoDesdeNomina() {
  const conteo = {
    directivos: { presentes: 0, reposo: 0, comision: 0, permiso: 0, suspendido: 0 },
    empleados: { presentes: 0, reposo: 0, comision: 0, permiso: 0, suspendido: 0 },
    obreros: { presentes: 0, reposo: 0, comision: 0, permiso: 0, suspendido: 0 },
    contratados: { presentes: 0, reposo: 0, comision: 0, permiso: 0, suspendido: 0 }
  };

  PERSONAL_NOMINA.forEach(p => {
    let tipo = 'empleados';
    const cat = (p.categoria || '').toLowerCase();
    if (cat.includes('directiv')) tipo = 'directivos';
    else if (cat.includes('obrero')) tipo = 'obreros';
    else if (cat.includes('contratad')) tipo = 'contratados';

    const est = (p.estatus || 'ACTIVO').toUpperCase();
    
    if (est === 'ACTIVO' || est === 'DISPONIBLE') {
      conteo[tipo].presentes++;
    } else if (est.includes('NOV-01') || est.includes('REPOSO')) {
      conteo[tipo].reposo++;
    } else if (est.includes('NOV-06') || est.includes('COMISION')) {
      conteo[tipo].comision++;
    } else if (est.includes('NOV-05') || est.includes('NOV-07') || est.includes('PERMISO') || est.includes('VACACIONES')) {
      conteo[tipo].permiso++;
    } else if (est.includes('NOV-10') || est.includes('SUSPENDIDO')) {
      conteo[tipo].suspendido++;
    }
  });

  TIPOS.forEach(t => {
    SITUACIONES.forEach(s => {
      const el = document.getElementById(`${s}-${t}`);
      if (el) el.value = conteo[t][s];
    });
  });

  calcularTotalRRHH();
}
