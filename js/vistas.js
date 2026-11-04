// Temario, calculadoras y ajustes.
import { h, ir, palanca, aviso } from './app.js';
import { TEMARIO, BLOQUES } from './temario.js';
import { buscar } from './busqueda.js';
import { fichaHtml } from './dudas.js';
import { ohm, potenciaCA, seccion, compensar, motorRpm, resistenciaLed, fmt, GAMMA } from './calculos.js';
import { guardar, uid, ajustes, todos } from './db.js';
import { desdeTemario } from './clase.js';
import { delBanco } from './fotos.js';
import { BANCO } from './banco.js';
import { MODELOS, ia } from './ia.js';

export function vistaTemario(raiz) {
  raiz.innerHTML = `<section class="seccion" data-hilo="negro"><header class="cabeza"><h1>Temario</h1><p>${TEMARIO.length} fichas de estudio: REBT, PLC, telecomunicaciones, renovables y más.</p></header>
    <label class="oculto" for="bt">Buscar en el temario</label><input id="bt" class="campo busca" type="search" placeholder="Buscar: diferencial, ITC-BT-25, estrella…">
    <div data-res></div></section>`;
  const res = raiz.querySelector('[data-res]');
  const item = (f) => `<details class="tema-item"><summary>${h(f.titulo)}</summary>${fichaHtml(f)}<p class="fuente">Fuente: ${h(f.fuente)}</p><button class="btn" data-clase="${f.id}">Crear clase con esta ficha</button></details>`;
  const pintar = (q) => {
    if (q.trim().length > 1) { const r = buscar(q, 10); res.innerHTML = r.length ? r.map((x) => item(x.f)).join('') : '<p class="vacio">No aparece en el temario. Prueba a preguntarlo en Dudas con la IA encendida.</p>'; return; }
    res.innerHTML = BLOQUES.map((b) => `<section class="bloque"><h2>${h(b)}</h2>${TEMARIO.filter((f) => f.bloque === b).map(item).join('')}</section>`).join('');
  };
  pintar('');
  raiz.querySelector('#bt').oninput = (e) => pintar(e.target.value);
  res.onclick = async (e) => {
    const b = e.target.closest('[data-clase]'); if (!b) return;
    const f = TEMARIO.find((x) => x.id === b.dataset.clase);
    const slides = desdeTemario([f], f.titulo); const usadas = new Set();
    slides.forEach((s) => { if (['portada', 'foto', 'fotoD', 'cierre', 'separador'].includes(s.tipo)) s.foto = delBanco(s.etiquetas?.length ? s.etiquetas : f.fotos, usadas); });
    const c = { id: uid(), titulo: f.titulo, tema: 'voltio', slides, creada: Date.now() };
    await guardar('clases', c); ir(`#clase/${c.id}`);
  };
}

const CALCS = [
  { id: 'ohm', t: 'Ley de Ohm', d: 'Rellena dos valores cualesquiera.', campos: [['V', 'Tensión (V)'], ['I', 'Intensidad (A)'], ['R', 'Resistencia (Ω)']],
    f: (v) => { const r = ohm(v); return r && Object.keys(v).filter((k) => v[k] != null).length === 2 ? [['Tensión', fmt(r.V), 'V'], ['Intensidad', fmt(r.I), 'A'], ['Resistencia', fmt(r.R), 'Ω'], ['Potencia', fmt(r.P), 'W']] : null; } },
  { id: 'pot', t: 'Potencia e intensidad', d: 'Con la tensión y la potencia sacas la intensidad, o al revés.', campos: [['V', 'Tensión (V)', 230], ['P', 'Potencia (W)'], ['I', 'Intensidad (A)'], ['cos', 'cos φ', 1]], tri: true,
    f: (v) => { if (!v.V || (v.P == null && v.I == null) || !v.cos) return null; const r = potenciaCA(v); return [['Intensidad', fmt(r.I), 'A'], ['Activa', fmt(r.P, 0), 'W'], ['Reactiva', fmt(r.Q, 0), 'var'], ['Aparente', fmt(r.S, 0), 'VA']]; } },
  { id: 'sec', t: 'Sección por caída de tensión', d: 'Cobre o aluminio, según la ITC-BT-19. Comprueba después la intensidad admisible.', campos: [['P', 'Potencia (W)'], ['L', 'Longitud (m)'], ['V', 'Tensión (V)', 230], ['pct', 'Caída admitida (%)', 3]], tri: true, material: true,
    f: (v) => { if (!v.P || !v.L || !v.V || !v.pct) return null; const r = seccion({ ...v, gamma: GAMMA[v.material][v.temp] }); return [['Caída', fmt(r.e), 'V'], ['Sección calculada', fmt(r.s), 'mm²'], ['Sección comercial', r.comercial ? fmt(r.comercial, 1) : 'más de 240', 'mm²']]; } },
  { id: 'comp', t: 'Batería de condensadores', d: 'Potencia reactiva para mejorar el factor de potencia.', campos: [['P', 'Potencia activa (W)'], ['cos1', 'cos φ actual', 0.75], ['cos2', 'cos φ deseado', 0.95]],
    f: (v) => { if (!v.P || !v.cos1 || !v.cos2) return null; return [['Qc', fmt(compensar(v).Qc, 0), 'var']]; } },
  { id: 'rpm', t: 'Velocidad de un motor', d: 'Velocidad de sincronismo. La real es algo menor.', campos: [['f', 'Frecuencia (Hz)', 50], ['pares', 'Pares de polos', 2]],
    f: (v) => (v.f && v.pares ? [['Velocidad', fmt(motorRpm(v).n, 0), 'rpm']] : null) },
  { id: 'fv', t: 'Paneles solares necesarios', d: 'A partir del consumo diario y las horas de sol pico del lugar.', campos: [['E', 'Consumo diario (Wh)'], ['Wp', 'Potencia del panel (Wp)', 450], ['HSP', 'Horas de sol pico', 4.5], ['PR', 'Rendimiento global', 0.75]],
    f: (v) => { if (!v.E || !v.Wp || !v.HSP || !v.PR) return null; const n = v.E / (v.Wp * v.HSP * v.PR); return [['Calculados', fmt(n), 'paneles'], ['Instalar', fmt(Math.ceil(n), 0), 'paneles']]; } },
  { id: 'bat', t: 'Capacidad de baterías', d: 'Capacidad necesaria según la autonomía y la profundidad de descarga.', campos: [['E', 'Consumo diario (Wh)'], ['dias', 'Días de autonomía', 2], ['V', 'Tensión (V)', 24], ['dod', 'Profundidad de descarga', 0.8]],
    f: (v) => { if (!v.E || !v.dias || !v.V || !v.dod) return null; return [['Capacidad', fmt((v.E * v.dias) / (v.V * v.dod), 0), 'Ah']]; } },
  { id: 'db', t: 'Nivel de señal en una toma', d: 'Balance de una instalación de RTV: suma ganancias y resta pérdidas.', campos: [['ent', 'Nivel de entrada (dBµV)', 60], ['g', 'Ganancia (dB)', 30], ['a', 'Atenuación total (dB)', 25]],
    f: (v) => { if (v.ent == null || v.g == null || v.a == null) return null; return [['En la toma', fmt(v.ent + v.g - v.a, 1), 'dBµV']]; } },
  { id: 'led', t: 'Resistencia para un LED', d: 'Resistencia en serie y la potencia que disipa.', campos: [['Vf', 'Tensión de fuente (V)', 12], ['Vled', 'Tensión del LED (V)', 2], ['mA', 'Corriente (mA)', 20]],
    f: (v) => { if (!v.Vf || !v.mA || v.Vf <= (v.Vled ?? 0)) return null; const r = resistenciaLed(v); return [['Resistencia', fmt(r.R, 0), 'Ω'], ['Potencia', fmt(r.P, 3), 'W']]; } },
];
export function vistaCalculo(raiz) {
  raiz.innerHTML = `<section class="seccion" data-hilo="verde"><header class="cabeza"><h1>Cálculo</h1><p>Fórmulas exactas, sin IA. El resultado aparece mientras escribes.</p></header>
  <div class="calcs">${CALCS.map((c) => `<form class="calc" data-c="${c.id}"><h2>${h(c.t)}</h2><p>${h(c.d)}</p>
    <div class="calc-campos">${c.campos.map(([k, l, d]) => `<div><label for="${c.id}-${k}">${h(l)}</label><input class="campo" id="${c.id}-${k}" name="${k}" type="number" inputmode="decimal" step="any" min="0" ${d != null ? `value="${d}"` : ''}></div>`).join('')}
    ${c.tri ? `<div><label for="${c.id}-tri">Línea</label><select class="campo" id="${c.id}-tri" name="tri"><option value="">Monofásica</option><option value="1">Trifásica</option></select></div>` : ''}
    ${c.material ? `<div><label for="${c.id}-m">Conductor</label><select class="campo" id="${c.id}-m" name="material"><option value="cobre">Cobre</option><option value="aluminio">Aluminio</option></select></div><div><label for="${c.id}-t">Aislamiento</label><select class="campo" id="${c.id}-t" name="temp"><option value="70">PVC, 70 °C</option><option value="90">XLPE, 90 °C</option></select></div>` : ''}</div>
    <output class="calc-res" data-res><span class="vacio">Faltan datos.</span></output></form>`).join('')}</div></section>`;
  raiz.querySelectorAll('.calc').forEach((form) => {
    const c = CALCS.find((x) => x.id === form.dataset.c);
    const calc = () => {
      const fd = new FormData(form); const v = {};
      for (const [k, val] of fd) { if (k === 'tri') v.tri = !!val; else if (k === 'material' || k === 'temp') v[k] = val; else if (val !== '') { const n = parseFloat(val); if (Number.isFinite(n)) v[k] = n; } }
      if (c.tri && form.elements.V && v.tri && form.elements.V.dataset.toc !== '1' && form.elements.V.value === '230') { form.elements.V.value = 400; v.V = 400; }
      if (c.tri && form.elements.V && !v.tri && form.elements.V.dataset.toc !== '1' && form.elements.V.value === '400') { form.elements.V.value = 230; v.V = 230; }
      const r = c.f(v);
      form.querySelector('[data-res]').innerHTML = r ? r.map(([a, b, u]) => `<div class="dato"><span>${h(a)}</span><strong>${h(b)} <small>${h(u)}</small></strong></div>`).join('') : '<span class="vacio">Faltan datos.</span>';
    };
    if (form.elements.V) form.elements.V.addEventListener('input', () => { form.elements.V.dataset.toc = '1'; });
    form.oninput = calc; form.onsubmit = (e) => e.preventDefault(); calc();
  });
}

export function vistaMas(raiz) {
  raiz.innerHTML = `<section class="seccion" data-hilo="negro"><header class="cabeza"><h1>Más</h1></header><nav class="mas-nav">
    <a href="#temario" data-c="azul"><strong>Temario</strong>Fichas de REBT, PLC, telecomunicaciones y renovables.</a>
    <a href="#calculo" data-c="verde"><strong>Cálculo</strong>Calculadoras con fórmulas exactas.</a>
    <a href="#ajustes" data-c="gris"><strong>Ajustes</strong>Modelo de IA, fotos y créditos.</a></nav></section>`;
}

export function vistaAjustes(raiz) {
  const k = ajustes.leer('modelo', null);
  raiz.innerHTML = `<section class="seccion" data-hilo="gris"><header class="cabeza"><h1>Ajustes</h1></header>
    <div class="ajuste"><div data-palanca-ia></div>
      <label for="mod">Modelo de IA</label><select id="mod" class="campo">${Object.entries(MODELOS).map(([c, m]) => `<option value="${c}">${h(m.nombre)}: ${h(m.peso)}, para ${h(m.para)}</option>`).join('')}</select>
      <p>El cambio se aplica la próxima vez que enciendas la IA. La calidad y la velocidad dependen de tu dispositivo.</p></div>
    <div class="ajuste"><h2>Fotos de internet</h2><label class="check"><input type="checkbox" id="red" ${ajustes.leer('fotosInternet', true) ? 'checked' : ''}> Buscar fotos en Wikimedia Commons cuando haya conexión</label><p>Solo envía las palabras de búsqueda. El contenido de tu PDF no sale del dispositivo.</p></div>
    <div class="ajuste"><h2>Espacio usado</h2><p data-esp>Calculando…</p></div>
    <div class="ajuste"><h2>Instalar en el iPhone o el iPad</h2><p>Abre la app en Safari, toca Compartir y elige Añadir a pantalla de inicio. Antes tiene que estar publicada en una dirección HTTPS.</p></div>
    <div class="ajuste"><h2>Sobre la información</h2><p>El temario es material de estudio resumido. Para trabajos reales, consulta el texto vigente del REBT y a un instalador habilitado.</p></div>
    <div class="ajuste"><h2>Créditos de las fotos</h2><ul class="creditos">${[...new Set(BANCO.map((f) => f.creditoLargo ?? f.credito))].map((c) => `<li>${h(c)}</li>`).join('')}</ul></div></section>`;
  const sel = raiz.querySelector('#mod');
  ia.soporte().then((s) => { sel.value = k ?? ia.modeloElegido(s); });
  sel.onchange = () => { ajustes.poner('modelo', sel.value); aviso('Modelo cambiado.'); };
  raiz.querySelector('#red').onchange = (e) => ajustes.poner('fotosInternet', e.target.checked);
  navigator.storage?.estimate?.().then((e) => { raiz.querySelector('[data-esp]').textContent = `${fmt((e.usage ?? 0) / 1e6, 0)} MB en este dispositivo.`; }).catch(() => {});
  return palanca(raiz.querySelector('[data-palanca-ia]'));
}
