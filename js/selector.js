// Selector de PDF compartido por Clases y Exámenes: temas detectados, PDF entero o lo que escribas.
import { h } from './app.js';
import { abrirPdf, elegirPaginas } from './pdf.js';
export const estadoPdf = { pdf: null, nombre: '' };

export function montarSelector(nodo, { ayuda = '¿Qué entra?' } = {}) {
  nodo.innerHTML = `<div class="sel-pdf">
    <div class="zona-pdf"><label class="btn btn-grande btn-blanco" for="pdf-${ayuda.length}">Elegir PDF</label><input id="pdf-${ayuda.length}" type="file" accept="application/pdf" class="oculto" data-archivo>
      <p data-info>Opcional. Tu PDF no sale de este dispositivo.</p></div>
    <div data-temas></div>
    <label for="que-${ayuda.length}">${h(ayuda)}</label>
    <textarea id="que-${ayuda.length}" class="campo" rows="2" data-que placeholder="Tema 3, PDF entero, páginas 12 a 18, transformadores…"></textarea>
    <p class="vista-previa" data-previa role="status"></p></div>`;
  const q = (s) => nodo.querySelector(s);
  let marcados = new Set();
  const pintarTemas = () => {
    const p = estadoPdf.pdf; const zona = q('[data-temas]');
    if (!p || !p.temas?.length) { zona.innerHTML = ''; return; }
    zona.innerHTML = `<p class="chips-t">Elige qué entra</p><div class="chips"><button type="button" class="chip" data-todo aria-pressed="${!marcados.size}">PDF entero</button>${p.temas.map((t, i) => `<button type="button" class="chip" data-t="${i}" aria-pressed="${marcados.has(i)}">${h(t.titulo)}</button>`).join('')}</div>`;
    zona.querySelector('[data-todo]').onclick = () => { marcados.clear(); q('[data-que]').value = ''; pintarTemas(); previa(); };
    zona.querySelectorAll('[data-t]').forEach((b) => { b.onclick = () => { const i = +b.dataset.t; if (marcados.has(i)) marcados.delete(i); else marcados.add(i); q('[data-que]').value = ''; pintarTemas(); previa(); }; });
  };
  const obtener = () => {
    const p = estadoPdf.pdf; const texto = q('[data-que]').value.trim();
    if (!p) return { texto };
    const temas = [...marcados].map((i) => p.temas[i]);
    return { texto, pdf: p, sel: elegirPaginas(p, texto, temas) };
  };
  const previa = () => {
    const r = obtener(); const z = q('[data-previa]');
    if (!r.pdf) { z.textContent = ''; return; }
    z.textContent = r.sel.paginas.length ? `Entra: ${r.sel.como} (${r.sel.paginas.length} páginas).` : `${r.sel.como}.`;
    z.classList.toggle('error', !r.sel.paginas.length);
  };
  const info = () => {
    const p = estadoPdf.pdf;
    q('[data-info]').textContent = p ? `${estadoPdf.nombre}: ${p.total} páginas${p.temas?.length ? `, ${p.temas.length} temas detectados` : ''}.` : 'Opcional. Tu PDF no sale de este dispositivo.';
    pintarTemas(); previa();
  };
  q('[data-archivo]').onchange = async (e) => {
    const a = e.target.files[0]; if (!a) return;
    q('[data-info]').textContent = 'Leyendo el PDF…'; marcados = new Set();
    try {
      const p = await abrirPdf(a, (f) => { q('[data-info]').textContent = `Leyendo el PDF… ${Math.round(f * 100)} %`; });
      if (p.escaneado) { estadoPdf.pdf = null; pintarTemas(); q('[data-info]').textContent = `${a.name}: parece escaneado y apenas tiene texto, así que no puedo leerlo.`; return; }
      estadoPdf.pdf = p; estadoPdf.nombre = a.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ');
      info();
    } catch { estadoPdf.pdf = null; pintarTemas(); q('[data-info]').textContent = 'No he podido abrir ese PDF. Puede estar dañado o tener contraseña.'; }
  };
  q('[data-que]').oninput = () => { if (q('[data-que]').value.trim() && marcados.size) { marcados.clear(); pintarTemas(); } previa(); };
  info();
  return { obtener };
}
