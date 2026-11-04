// Apartado de dudas: primero cálculo exacto, después temario y, si está encendida, IA local.
import { h, palanca, ir } from './app.js';
import { resolverPregunta } from './calculos.js';
import { buscar } from './busqueda.js';
import { ia } from './ia.js';
import { ajustes } from './db.js';
import { ESQUEMAS } from './esquemas.js';

const SUGERENCIAS = ['¿Qué es el lenguaje KOP?', '¿Cómo se dimensiona una instalación solar?', '¿Qué sección lleva el circuito de la lavadora?', 'Intensidad de un motor de 5,5 kW trifásico a 400 V con cos φ 0,85', '¿Cuáles son las cinco reglas de oro?', '¿Cómo funciona la realimentación en un marcha-paro?'];
const GLOSARIO = 'REBT: Reglamento Electrotécnico para Baja Tensión (una norma, no un aparato). ITC: Instrucción Técnica Complementaria. PIA: pequeño interruptor automático o magnetotérmico. IGA: interruptor general automático. ID: interruptor diferencial. CGP: caja general de protección. LGA: línea general de alimentación. DI: derivación individual. PLC: autómata programable.';
const SISTEMA = `Eres profesor de un ciclo de FP de Instalaciones Eléctricas y Automáticas en España. Responde en español, en un máximo de 5 frases sencillas.
Reglas: usa solo hechos que sepas con seguridad; basa la respuesta en el TEMARIO si trata el tema; no des cifras ni artículos que no aparezcan en el TEMARIO; no inventes siglas; si no lo sabes, responde exactamente «No estoy seguro: consúltalo en tus apuntes».
Si preguntan cómo intervenir en una instalación real, recuerda que hay que trabajar sin tensión.
GLOSARIO: ${GLOSARIO}`;
// Avisa de cifras con unidad que la IA da y no aparecen en el temario consultado.
const CIFRA = /\d+(?:[.,]\d+)?\s?(?:mA|kW|kVA|mm²|mm2|Hz|rpm|MΩ|Ω|%|[VAW])(?![a-zA-Záéíóú])/g;
const sinRepetidas = (t) => [...new Set(t.split(/(?<=[.!?])\s+/).map((s) => s.trim()))].join(' ');
export function cifrasSinRespaldo(respuesta, contexto) {
  const limpio = (s) => s.replace(/\s/g, '').replace(',', '.').toLowerCase();
  const base = limpio(contexto);
  return [...new Set(respuesta.match(CIFRA) ?? [])].filter((c) => !base.includes(limpio(c)));
}
let hilo = ajustes.leer('chat', []);
let generando = false;

const fichaHtml = (f) => `<div class="ficha"><h3>${h(f.titulo)}</h3><p>${h(f.resumen)}</p>${f.formula ? `<p class="formula">${h(f.formula)}</p>` : ''}${f.tabla ? tablaHtml(f.tabla) : ''}<ul>${f.puntos.map((p) => `<li>${h(p)}</li>`).join('')}</ul>${f.esquema ? `<figure class="esquema" aria-label="${h(ESQUEMAS[f.esquema].alt)}">${ESQUEMAS[f.esquema].svg}</figure>` : ''}</div>`;
export const tablaHtml = (t) => `<div class="tabla-env"><table><thead><tr>${t.cabecera.map((c) => `<th>${h(c)}</th>`).join('')}</tr></thead><tbody>${t.filas.map((f) => `<tr>${f.map((c) => `<td>${h(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
export { fichaHtml };
const calcHtml = (c) => `<div class="calculo"><h3>${h(c.titulo)}</h3><ol>${c.pasos.map((p) => `<li>${h(p)}</li>`).join('')}</ol><p class="resultado">${h(c.resultado)}</p>${c.nota ? `<p>${h(c.nota)}</p>` : ''}</div>`;

function burbuja(m) {
  if (m.rol === 'yo') return `<div class="msg msg-yo">${h(m.texto)}</div>`;
  const origen = { calculo: 'Cálculo exacto', temario: 'Del temario', ia: 'Explicación de la IA local. Puede equivocarse: compruébala.', nada: '' }[m.origen] ?? '';
  const cuerpo = m.html ?? `<div class="msg-texto">${h(m.texto).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")}</div>`;
  return `<div class="msg msg-app" data-origen="${m.origen}">${cuerpo}${m.atascada ? '<p class="sospecha">La IA se ha atascado con esta pregunta: su respuesta no es de fiar.</p>' : ''}${m.dudosas?.length ? `<p class="sospecha">Ojo: estas cifras no están en el temario: ${h(m.dudosas.join(', '))}.</p>` : ''}${origen ? `<p class="origen">${h(origen)}${m.origen === 'temario' && m.fuentes?.length ? ` Fuente: ${h(m.fuentes.join('; '))}.` : ''}</p>` : ''}</div>`;
}
export function vistaDudas(raiz) {
  raiz.innerHTML = `<section class="seccion seccion-chat" data-hilo="turquesa">
    <header class="cabeza cabeza-chat"><h1>Dudas</h1><div data-palanca-ia></div></header>
    <div class="conversacion" data-conv aria-live="polite"></div>
    <form class="redactar" data-form><label class="oculto" for="preg">Tu pregunta</label>
      <textarea id="preg" class="campo" rows="1" placeholder="Escribe tu duda"></textarea>
      <button class="btn btn-accion" data-enviar>Enviar</button></form>
  </section>`;
  const conv = raiz.querySelector('[data-conv]');
  const pintar = () => {
    conv.innerHTML = hilo.length ? hilo.map(burbuja).join('') : `<div class="inicio-chat"><p>Los cálculos son exactos y las fichas te dan la base. Para preguntas libres, enciende la IA con la palanca.</p><div class="sugerencias">${SUGERENCIAS.slice(0, 5).map((s) => `<button type="button" class="btn sug" data-s="${h(s)}">${h(s)}</button>`).join('')}</div></div>`;
    conv.scrollTop = conv.scrollHeight;
    if (hilo.length) { const b = document.createElement('button'); b.className = 'enlace limpiar'; b.textContent = 'Borrar la conversación'; b.onclick = () => { hilo = []; ajustes.poner('chat', hilo); pintar(); }; conv.prepend(b); }
  };
  pintar();
  const quitar = palanca(raiz.querySelector('[data-palanca-ia]'));
  const ta = raiz.querySelector('#preg');
  ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = `${Math.min(ta.scrollHeight, 140)}px`; });
  ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && matchMedia('(hover:hover)').matches) { e.preventDefault(); raiz.querySelector('[data-form]').requestSubmit(); } });
  conv.onclick = (e) => { const s = e.target.closest('[data-s]'); if (s) enviar(s.dataset.s); };
  raiz.querySelector('[data-form]').onsubmit = (e) => { e.preventDefault(); if (generando) { ia.parar(); return; } const v = ta.value.trim(); if (v) { ta.value = ''; ta.style.height = 'auto'; enviar(v); } };

  async function enviar(q) {
    hilo.push({ rol: 'yo', texto: q });
    const calc = resolverPregunta(q);
    const hits = buscar(q, 2);
    if (calc) { hilo.push({ rol: 'app', origen: 'calculo', html: calcHtml(calc) }); return fin(); }
    if (!ia.lista) {
      if (hits.length) hilo.push({ rol: 'app', origen: 'temario', html: fichaHtml(hits[0].f), fuentes: [hits[0].f.fuente] });
      else hilo.push({ rol: 'app', origen: 'nada', texto: ia.estado.fase === 'cargando' ? 'Eso no está en el temario y la IA aún está cargando. Pregúntamelo otra vez cuando termine.' : 'Eso no está en el temario. Enciende la IA con la palanca de arriba para que intente responderte.' });
      return fin();
    }
    if (hits.length && hits[0].score >= 2.5) hilo.push({ rol: 'app', origen: 'temario', html: fichaHtml(hits[0].f), fuentes: [hits[0].f.fuente] });
    // El modelo ligero no es fiable sin una ficha que lo respalde: en ese caso no se le pregunta.
    if (!hits.length && ia.estado.modelo === 'ligero') {
      hilo.push({ rol: 'app', origen: 'nada', texto: 'Eso no está en el temario y el modelo ligero no es fiable sin una ficha que lo respalde. Prueba el modelo Mejor en Ajustes o consúltalo en tus apuntes.' });
      return fin();
    }
    const m = { rol: 'app', origen: 'ia', texto: '' };
    hilo.push(m); pintar();
    const nodo = conv.querySelector('.msg-app:last-child');
    nodo.classList.add('escribiendo');
    generando = true; raiz.querySelector('[data-enviar]').textContent = 'Parar';
    const ctx = hits.map((x) => `${x.f.titulo} (${x.f.fuente}): ${x.f.resumen} ${x.f.puntos.join(' ')}`).join('\n').slice(0, 1800);
    const hist = hilo.slice(-6, -2).filter((x) => x.texto).map((x) => ({ role: x.rol === 'yo' ? 'user' : 'assistant', content: x.texto.slice(0, 500) }));
    try {
      for await (const t of ia.responder([...hist, { role: 'user', content: `${SISTEMA}\n\nTEMARIO:\n${ctx || 'No hay datos sobre esta pregunta.'}\n\nPREGUNTA: ${q}` }], { temperatura: 0.1, max: 220 })) {
        m.texto += t; nodo.firstChild.textContent = m.texto; conv.scrollTop = conv.scrollHeight;
        // Si el modelo entra en bucle, se corta y se avisa: ese texto no sirve.
        const fr = m.texto.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.length > 15);
        if (fr.length !== new Set(fr).size) {
          ia.parar(); m.texto = sinRepetidas(m.texto); m.atascada = true; break;
        }
      }
    } catch (e) { m.texto = m.texto || `La IA no ha podido responder: ${e.message}`; }
    m.dudosas = cifrasSinRespaldo(m.texto, ctx);
    generando = false; const b = raiz.querySelector('[data-enviar]'); if (b) b.textContent = 'Enviar';
    fin();
  }
  function fin() { hilo = hilo.slice(-40); ajustes.poner('chat', hilo); if (raiz.querySelector('[data-conv]')) pintar(); }
  return quitar;
}
