// Arranque, navegación y piezas comunes.
import { ia, MODELOS } from './ia.js';
import { ajustes } from './db.js';
export const h = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const ir = (r) => { location.hash = r; };

const SECCIONES = [['clases', 'Clases', 'marron'], ['dudas', 'Dudas', 'azul'], ['temario', 'Temario', 'negro'], ['calculo', 'Cálculo', 'gris'], ['ajustes', 'Ajustes', 'tierra']];
const carril = document.getElementById('carril');
const vista = document.getElementById('vista');
carril.innerHTML = SECCIONES.map(([id, t, c]) => `<a class="pia" href="#${id}" data-id="${id}" data-hilo="${c}"><span class="pia-ranura"><span class="pia-maneta"></span></span><span class="pia-nombre">${t}</span></a>`).join('');

let limpiar = null;
async function enrutar() {
  const [ruta, arg] = (location.hash.slice(1) || 'clases').split('/');
  const activa = ruta === 'clase' ? 'clases' : ruta;
  carril.querySelectorAll('.pia').forEach((a) => { const on = a.dataset.id === activa; a.toggleAttribute('data-on', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  limpiar?.(); limpiar = null;
  vista.onclick = null; vista.classList.remove('entra'); vista.scrollTop = 0; scrollTo(0, 0);
  document.body.dataset.ruta = ruta;
  if (ruta === 'clase') { const { vistaVisor } = await import('./visor.js'); await vistaVisor(vista, arg); }
  else if (ruta === 'dudas') { const { vistaDudas } = await import('./dudas.js'); limpiar = vistaDudas(vista); }
  else if (ruta === 'temario') { const { vistaTemario } = await import('./vistas.js'); vistaTemario(vista); }
  else if (ruta === 'calculo') { const { vistaCalculo } = await import('./vistas.js'); vistaCalculo(vista); }
  else if (ruta === 'ajustes') { const { vistaAjustes } = await import('./vistas.js'); limpiar = vistaAjustes(vista); }
  else { const { vistaClases } = await import('./clases.js'); await vistaClases(vista); }
  void vista.offsetWidth; vista.classList.add('entra');
}
addEventListener('hashchange', enrutar);

const dlg = document.getElementById('hoja');
export function hoja(html, alAbrir) {
  dlg.innerHTML = html; dlg.showModal();
  dlg.querySelectorAll('[data-cerrar]').forEach((b) => { b.onclick = cerrarHoja; });
  alAbrir?.(dlg);
}
export function cerrarHoja() { dlg.close(); }
dlg.addEventListener('click', (e) => { if (e.target === dlg) cerrarHoja(); });
export function aviso(t) {
  const n = document.createElement('div'); n.className = 'aviso'; n.role = 'status'; n.textContent = t; document.body.append(n);
  setTimeout(() => n.remove(), 2600);
}

// La palanca de la IA: un magnetotérmico de verdad. Subirla carga el modelo.
export function palanca(nodo) {
  nodo.innerHTML = `<div class="ia-pia"><button type="button" class="pia pia-grande" data-boton role="switch" aria-checked="false" aria-label="IA local"><span class="pia-ranura"><span class="pia-maneta"></span></span></button><div class="ia-txt"><strong>IA local</strong><span data-txt></span></div></div><div class="barra" data-barra hidden><span data-b></span></div>`;
  const b = nodo.querySelector('[data-boton]'); const txt = nodo.querySelector('[data-txt]');
  b.onclick = async () => {
    const e = ia.estado;
    if (e.fase === 'lista') return ia.apagar();
    if (e.fase === 'cargando') return;
    if (ajustes.leer('modeloBajado', false) && !ia.cierreAnterior()) return ia.encender();
    const s = await ia.soporte();
    if (!s.ok) return hoja(`<h2>La IA no puede funcionar aquí</h2><p>${h(s.motivo)}</p><p>Los cálculos y el temario siguen funcionando.</p><button class="btn" data-cerrar>Entendido</button>`);
    const k = ia.modeloElegido(s); const m = MODELOS[k];
    hoja(`<h2>Encender la IA local</h2><p>Hay que descargar el modelo ${h(m.nombre.toLowerCase())}, ${h(m.peso)}, solo esta vez. Hazlo con WiFi. Después funcionará sin internet y nada saldrá de tu dispositivo.</p>${ia.cierreAnterior() ? '<p class="error">La última vez el sistema cerró la app mientras cargaba la IA, seguramente por falta de memoria. Cierra otras apps o elige el modelo ligero en Ajustes.</p>' : ''}<div class="fila"><button class="btn" data-cerrar>Ahora no</button><button class="btn btn-accion" data-si>Descargar y encender</button></div>`, (d) => {
      d.querySelector('[data-si]').onclick = () => { cerrarHoja(); ajustes.poner('modeloBajado', true); ia.encender(k); };
    });
  };
  return ia.oir((e) => {
    const on = e.fase === 'lista' || e.fase === 'cargando';
    b.toggleAttribute('data-on', on); b.setAttribute('aria-checked', String(e.fase === 'lista'));
    const barra = nodo.querySelector('[data-barra]'); barra.hidden = e.fase !== 'cargando';
    nodo.querySelector('[data-b]').style.transform = `scaleX(${e.progreso || 0})`;
    txt.textContent = { apagada: 'Apagada', lista: 'Lista, sin conexión', cargando: `Cargando ${Math.round((e.progreso || 0) * 100)} %`, error: e.error || 'Error' }[e.fase];
  });
}

if ('serviceWorker' in navigator && location.protocol !== 'file:' && !ajustes.leer('dev', false)) navigator.serviceWorker.register('sw.js').catch(() => {});
enrutar();
// Si ya estaba encendida y el modelo está guardado, se vuelve a cargar sola.
if (ajustes.leer('iaActiva', null) && !ia.cierreAnterior()) setTimeout(() => ia.encender(ajustes.leer('iaActiva')), 800);
