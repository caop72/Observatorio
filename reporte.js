/**************************************************************
 * OEP - Módulo Jefe de OPT (Carga Diaria)
 **************************************************************/

const API_URL = 'https://script.google.com/macros/s/AKfycby-F2Ww2yUntW1fDmkwsRd-hHmkGq7AiO0DQH-FO6IpifHWvIPzVFeB9tBArJk-Jdiq3w/exec';

let INDICADORES = [];
let VALORES_ACTUALES = {};
let VALORES_PREVIOS = null;

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
  const token = localStorage.getItem('oep_token');
  const usuario = JSON.parse(localStorage.getItem('oep_usuario') || 'null');

  if (!token || !usuario) {
    location.href = 'index.html';
    return;
  }

  document.getElementById('nav-usuario').textContent =
    usuario.nombres + ' ' + usuario.apellidos + ' — ' + usuario.cargo;

  const hoy = new Date().toISOString().substring(0, 10);
  document.getElementById('fecha-hoy').textContent = hoy;

  // Cargar indicadores
  const rInd = await api('obtenerIndicadores');
  INDICADORES = rInd.indicadores || [];

  // Cargar último reporte para precarga
  const idOpt = usuario.opt || 'OPT-DEFAULT';
  const rUlt = await api('obtenerUltimoReporte', { idOpt });

  if (rUlt.ok && rUlt.ultimo) {
    VALORES_PREVIOS = rUlt.ultimo.valores;
    VALORES_ACTUALES = JSON.parse(JSON.stringify(VALORES_PREVIOS));
    document.getElementById('banner-precarga').classList.remove('d-none');
    document.getElementById('banner-fecha').textContent = rUlt.ultimo.fecha;
  } else {
    VALORES_ACTUALES = {};
  }

  renderIndicadores();
});

// ============================================================
// RENDER
// ============================================================
function renderIndicadores() {
  const cont = document.getElementById('contenedor-indicadores');
  const spinner = document.getElementById('spinner-carga');
  if (spinner) spinner.style.display = 'none';
  cont.innerHTML = '';

  INDICADORES.forEach(ind => {
    const v = VALORES_ACTUALES[ind.codigo] || {};
    const div = document.createElement('div');
    div.className = 'mb-3 p-3 border rounded bg-white shadow-sm';
    div.innerHTML = `<label class="form-label fw-bold">${ind.codigo} — ${ind.nombre}</label>`;

    if (ind.tipo === 'SELECTOR_SIMPLE') {
      const sel = document.createElement('select');
      sel.className = 'form-select';
      sel.innerHTML = '<option value="">Seleccione...</option>';
      ind.opciones.forEach(o => {
        const opt = document.createElement('option');
        opt.value = o;
        opt.textContent = o;
        if (v.texto === o) opt.selected = true;
        sel.appendChild(opt);
      });
      sel.onchange = () => { VALORES_ACTUALES[ind.codigo] = { texto: sel.value }; };
      div.appendChild(sel);
    }
    else if (ind.tipo === 'MULTIPLE_NUMERICO') {
      const wrap = document.createElement('div');
      wrap.className = 'row g-2';
      for (let i = 1; i <= 4; i++) {
        const col = document.createElement('div');
        col.className = 'col-md-3';
        col.innerHTML = `<input type="number" class="form-control" placeholder="Valor ${i}"
                          value="${v['valor' + i] || ''}" data-idx="${i}">`;
        col.querySelector('input').oninput = (e) => {
          VALORES_ACTUALES[ind.codigo] = VALORES_ACTUALES[ind.codigo] || {};
          VALORES_ACTUALES[ind.codigo]['valor' + e.target.dataset.idx] = e.target.value;
        };
        wrap.appendChild(col);
      }
      div.appendChild(wrap);
    }
    else {
      const ta = document.createElement('textarea');
      ta.className = 'form-control';
      ta.rows = 2;
      ta.value = v.texto || '';
      ta.oninput = () => { VALORES_ACTUALES[ind.codigo] = { texto: ta.value }; };
      div.appendChild(ta);
    }

    cont.appendChild(div);
  });
}

// ============================================================
// ACCIONES
// ============================================================
function restaurarAnterior() {
  if (!VALORES_PREVIOS) return;
  VALORES_ACTUALES = JSON.parse(JSON.stringify(VALORES_PREVIOS));
  renderIndicadores();
}

async function enviarSinNovedades() {
  if (!VALORES_PREVIOS) {
    alert('No hay reporte anterior para reenviar');
    return;
  }
  VALORES_ACTUALES = JSON.parse(JSON.stringify(VALORES_PREVIOS));
  renderIndicadores();
  document.getElementById('commit').value = 'Sin novedades respecto al reporte anterior';
  await enviarReporte();
}

async function enviarReporte() {
  const msg = document.getElementById('msg');
  msg.style.color = '#c0392b';
  msg.textContent = '';

  const commit = document.getElementById('commit').value.trim();
  if (!commit) { msg.textContent = 'El commit es obligatorio'; return; }

  const usuario = JSON.parse(localStorage.getItem('oep_usuario'));
  const token = localStorage.getItem('oep_token');

  msg.textContent = 'Enviando...';

  try {
    const r = await api('guardarReporte', {
      token,
      idOpt: usuario.opt || 'OPT-DEFAULT',
      valores: VALORES_ACTUALES,
      commit,
      observaciones: document.getElementById('observaciones').value.trim()
    });

    if (!r.ok) { msg.textContent = r.error; return; }

    msg.style.color = '#27ae60';
    msg.textContent = '✅ Reporte enviado: ' + r.idReporte + ' — Semáforo: ' + r.semaforo;
  } catch (e) {
    msg.textContent = 'Error: ' + e.message;
  }
}
