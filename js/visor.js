// Dibuja las diapositivas y gestiona el visor, la edición y el modo presentación.
import { ESQUEMAS } from './esquemas.js';
import { urlFoto, guardarBlob, buscarInternet, internetActivo } from './fotos.js';
import { BANCO } from './banco.js';
import { guardar, leer, borrar } from './db.js';
import { h, hoja, cerrarHoja, ir, aviso } from './app.js';
import { programa, svgPrograma } from './plc.js';

export const TEMAS = { voltio: 'Voltio: azul eléctrico', turquesa: 'Turquesa', coral: 'Coral', solar: 'Solar: amarillo', noche: 'Noche' };
const conFoto = new Set(['portada', 'foto', 'fotoD', 'cierre', 'separador']);
const md = (s) => h(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*\*/g, '');
const lista = (s) => (s.puntos?.length ? `<ul>${s.puntos.map((p, i) => `<li data-campo="puntos" data-i="${i}">${md(p)}</li>`).join('')}</ul>` : '');
const titulo = (s, tag = 'h2') => `<${tag} data-campo="titulo">${h(s.titulo ?? '')}</${tag}>`;
const figuraFoto = (s) => `<figure class="d-foto${s.foto?.credito?.startsWith('Página') ? ' de-pagina' : ''}">${s.foto ? `<img alt="" data-foto>` : ''}${s.foto?.credito ? `<figcaption>${h(s.foto.credito)}</figcaption>` : ''}</figure>`;
const fuente = (s) => (s.fuente ? `<p class="d-fuente">${h(s.fuente)}</p>` : '');
const figs = (s) => (s.figuras?.length ? `<div class="d-figs" data-n="${s.figuras.length}">${s.figuras.map((f, i) => `<figure class="d-fig"><img alt="${h(f.pie ?? '')}" data-fig="${i}"><figcaption>${h(f.pie ?? '')}</figcaption></figure>`).join('')}</div>` : '');
const ecs = (s) => (s.ecuaciones?.length ? `<div class="d-ecs">${s.ecuaciones.map((f, i) => `<img alt="${h(f.texto ?? 'Fórmula')}" data-eq="${i}">`).join('')}</div>` : '');

export function htmlDiapo(s) {
  switch (s.tipo) {
    case 'portada': return `${figuraFoto(s)}<div class="d-texto">${titulo(s, 'h1')}${s.frase ? `<p data-campo="frase">${h(s.frase)}</p>` : ''}</div>`;
    case 'indice': return `<div class="d-texto">${titulo(s)}<ol class="d-indice">${s.puntos.map((p, i) => `<li data-campo="puntos" data-i="${i}">${h(p)}</li>`).join('')}</ol></div>`;
    case 'separador': return `${figuraFoto(s)}<div class="d-texto">${s.frase ? `<p data-campo="frase">${h(s.frase)}</p>` : ''}${titulo(s, 'h1')}</div>`;
    case 'figura': case 'figuraD': return `<div class="d-texto">${titulo(s)}${lista(s)}${ecs(s)}${fuente(s)}</div>${figs(s)}`;
    case 'galeria': return `<div class="d-texto d-cab">${titulo(s)}${fuente(s)}</div>${figs(s)}`;
    case 'ecuaciones': return `<div class="d-texto">${titulo(s)}${lista(s)}${fuente(s)}</div>${ecs(s)}`;
    case 'foto': case 'fotoD': return `${figuraFoto(s)}<div class="d-texto">${titulo(s)}${lista(s)}${fuente(s)}</div>`;
    case 'apartado': case 'campo': return `<div class="d-texto">${titulo(s)}${lista(s)}${fuente(s)}</div>`;
    case 'formula': return `<div class="d-texto">${titulo(s, 'h3')}<p class="d-formula" data-campo="formula">${h(s.formula)}</p>${s.frase ? `<p data-campo="frase">${h(s.frase)}</p>` : ''}${fuente(s)}</div>`;
    case 'tabla': return `<div class="d-texto">${titulo(s)}<table><thead><tr>${s.tabla.cabecera.map((c) => `<th>${h(c)}</th>`).join('')}</tr></thead><tbody>${s.tabla.filas.map((f) => `<tr>${f.map((c) => `<td>${h(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>${fuente(s)}</div>`;
    case 'esquema': return `<div class="d-texto">${titulo(s)}${lista(s)}${fuente(s)}</div><figure class="d-esquema" aria-label="${h(ESQUEMAS[s.esquema]?.alt ?? '')}">${ESQUEMAS[s.esquema]?.svg ?? ''}</figure>`;
    case 'ladder': { const p = programa(s.ladder); return `<div class="d-texto d-cab">${titulo(s)}${p ? `<p>${h(p.desc)}</p>` : ''}</div><figure class="d-ladder">${p ? svgPrograma(p) : ''}</figure>`; }
    case 'cierre': return `${figuraFoto(s)}<div class="d-texto">${titulo(s)}${lista(s)}</div>`;
    default: return `<div class="d-texto">${titulo(s)}${lista(s)}</div>`;
  }
}
export async function pintarDiapo(nodo, s, tema) {
  const largo = (s.puntos ?? []).join(' ').length;
  nodo.className = `diapo s-${s.tipo}${s.figuras?.length ? ' con-figs' : ''}${largo && largo < 320 ? ' poco' : ''}`; nodo.dataset.tema = tema in TEMAS ? tema : 'voltio'; nodo.innerHTML = htmlDiapo(s);
  const img = nodo.querySelector('[data-foto]'); if (img) img.src = await urlFoto(s.foto);
  const cargas = [];
  nodo.querySelectorAll('[data-fig]').forEach((im) => { cargas.push(urlFoto(s.figuras[+im.dataset.fig]).then((u) => { im.src = u; return im.decode?.().catch(() => {}); })); });
  nodo.querySelectorAll('[data-eq]').forEach((im) => { cargas.push(urlFoto(s.ecuaciones[+im.dataset.eq]).then((u) => { im.src = u; return im.decode?.().catch(() => {}); })); });
  await Promise.all(cargas);
  ajustar(nodo);
}
// Reduce el texto de la diapositiva hasta que quepa; nunca se corta contenido.
export function ajustar(nodo) {
  const t = nodo.querySelector('.d-texto'); if (!t || !nodo.clientWidth) return;
  const rn = () => nodo.getBoundingClientRect();
  const desborda = () => { const b = rn(); const r = t.getBoundingClientRect(); const tit = t.querySelector('h1,h2,h3'); return (tit && tit.scrollWidth > tit.clientWidth + 1) || t.scrollHeight > t.clientHeight + 1 || t.scrollWidth > t.clientWidth + 1 || r.bottom > b.bottom + 1 || r.top < b.top - 1; };
  let k = 1; nodo.style.setProperty('--k', k);
  while (desborda() && k > 0.5) { k -= 0.04; nodo.style.setProperty('--k', k.toFixed(2)); }
}

let estado = null, obs = null;
export async function vistaVisor(raiz, id, presentar) {
  const clase = await leer('clases', id);
  if (!clase) { ir('#clases'); return; }
  estado = { clase, i: 0, editar: false };
  raiz.innerHTML = `<section class="visor">
    <header class="visor-cab"><a class="enlace" href="#clases">Volver</a><h1 data-titulo-clase>${h(clase.titulo)}</h1>
      <div class="visor-acc"><button class="btn" data-acc="editar">Editar</button><button class="btn btn-accion" data-acc="presentar">Presentar</button></div></header>
    ${clase.aviso ? `<p class="visor-aviso">${h(clase.aviso)}</p>` : ''}
    <div class="escena" data-escena><div class="diapo" data-diapo></div></div>
    <div class="visor-mandos"><button class="btn" data-acc="ant" aria-label="Diapositiva anterior">Anterior</button><output data-cuenta></output><button class="btn" data-acc="sig" aria-label="Diapositiva siguiente">Siguiente</button></div>
    <div class="visor-edicion" data-edicion hidden>
      <button class="btn" data-acc="foto">Cambiar foto</button><button class="btn" data-acc="tema">Colores</button><button class="btn" data-acc="quitar">Quitar diapositiva</button><button class="btn" data-acc="borrar">Borrar la clase</button>
    </div>
    <details class="notas" data-notas hidden><summary>Texto completo de este apartado</summary><div data-notas-t></div></details>
    <ol class="tiras" data-tiras aria-label="Todas las diapositivas"></ol>
  </section>`;
  raiz.onclick = accion;
  raiz.addEventListener('focusout', guardarTexto);
  pintarTiras(); await mostrar(0, 0);
  iniciarGestos(raiz.querySelector('[data-escena]'));
  if (presentar) abrirPresentacion();
}
// Las miniaturas se dibujan solo al hacerse visibles: una clase puede tener cientos.
function pintarTiras() {
  const t = document.querySelector('[data-tiras]'); if (!t) return;
  obs?.disconnect();
  t.innerHTML = estado.clase.slides.map((s, i) => `<li><button data-ir="${i}" aria-label="Ir a la diapositiva ${i + 1}: ${h(s.titulo ?? '')}"><div class="diapo-mini"><div class="diapo" data-m="${i}"></div></div></button></li>`).join('');
  obs = new IntersectionObserver((es) => {
    for (const e of es) {
      if (!e.isIntersecting) continue;
      obs.unobserve(e.target); const k = +e.target.dataset.m;
      pintarDiapo(e.target, estado.clase.slides[k], estado.clase.tema).then(() => e.target.querySelectorAll('[data-campo]').forEach((n) => n.removeAttribute('data-campo')));
    }
  }, { root: t, rootMargin: '300px' });
  t.querySelectorAll('[data-m]').forEach((n) => obs.observe(n));
}
async function mostrar(i, dir = 1) {
  const c = estado.clase; estado.i = Math.max(0, Math.min(i, c.slides.length - 1));
  const n = document.querySelector('[data-diapo]'); if (!n) return;
  const s = c.slides[estado.i];
  await pintarDiapo(n, s, c.tema);
  n.style.setProperty('--dir', dir);
  if (dir) { n.classList.remove('entra'); void n.offsetWidth; n.classList.add('entra'); }
  document.querySelector('[data-cuenta]').textContent = `${estado.i + 1} de ${c.slides.length}`;
  document.querySelectorAll('[data-tiras] button').forEach((b, k) => { const on = k === estado.i; b.toggleAttribute('data-activa', on); if (on) b.scrollIntoView?.({ inline: 'center', block: 'nearest', behavior: 'smooth' }); });
  const nt = document.querySelector('[data-notas]');
  nt.hidden = !s.notas;
  if (s.notas) document.querySelector('[data-notas-t]').innerHTML = s.notas.split('\n\n').map((p) => `<p>${h(p)}</p>`).join('');
  aplicarEdicion();
}
function aplicarEdicion() {
  document.querySelectorAll('[data-diapo] [data-campo]').forEach((x) => { x.contentEditable = estado.editar ? 'plaintext-only' : 'false'; });
  document.querySelector('[data-edicion]')?.toggleAttribute('hidden', !estado.editar);
  const b = document.querySelector('[data-acc="editar"]'); if (b) b.textContent = estado.editar ? 'Terminar' : 'Editar';
}
async function guardarTexto(e) {
  if (!estado?.editar || !e.target.dataset?.campo) return;
  const s = estado.clase.slides[estado.i]; const v = e.target.textContent.trim(); const k = e.target.dataset.campo;
  if (k === 'puntos') s.puntos[+e.target.dataset.i] = v; else s[k] = v;
  await guardar('clases', estado.clase);
}
async function accion(e) {
  const irA = e.target.closest('[data-ir]'); if (irA) return mostrar(+irA.dataset.ir, Math.sign(+irA.dataset.ir - estado.i));
  const a = e.target.closest('[data-acc]')?.dataset.acc; if (!a) return;
  if (a === 'ant') mostrar(estado.i - 1, -1);
  if (a === 'sig') mostrar(estado.i + 1, 1);
  if (a === 'editar') { estado.editar = !estado.editar; aplicarEdicion(); if (!estado.editar) pintarTiras(); }
  if (a === 'presentar') abrirPresentacion();
  if (a === 'foto') elegirFoto();
  if (a === 'tema') elegirTema();
  if (a === 'quitar') {
    if (estado.clase.slides.length < 2) return;
    estado.clase.slides.splice(estado.i, 1); await guardar('clases', estado.clase); pintarTiras(); mostrar(estado.i, 0);
  }
  if (a === 'borrar') {
    hoja(`<h2>¿Borrar esta clase?</h2><p>Se eliminará «${h(estado.clase.titulo)}» de este dispositivo y no se podrá recuperar.</p><div class="fila"><button class="btn" data-cerrar>Cancelar</button><button class="btn btn-peligro" data-si>Borrar</button></div>`, (d) => {
      d.querySelector('[data-si]').onclick = async () => { await borrar('clases', estado.clase.id); cerrarHoja(); ir('#clases'); };
    });
  }
}
function elegirTema() {
  hoja(`<h2>Colores de la clase</h2><div class="temas">${Object.entries(TEMAS).map(([k, v]) => `<button class="tema-op" data-t="${k}"><span class="muestra" data-tema="${k}"></span>${v}</button>`).join('')}</div><button class="btn" data-cerrar>Cerrar</button>`, (d) => {
    d.querySelectorAll('[data-t]').forEach((b) => { b.onclick = async () => { estado.clase.tema = b.dataset.t; await guardar('clases', estado.clase); cerrarHoja(); pintarTiras(); mostrar(estado.i, 0); }; });
  });
}
function elegirFoto() {
  const s = estado.clase.slides[estado.i];
  const esFig = s.figuras?.length; 
  if (!conFoto.has(s.tipo) && !esFig) return aviso('Esta diapositiva no lleva foto.');
  const dePdf = estado.clase.slides.flatMap((x) => x.figuras ?? []).slice(0, 40);
  hoja(`<h2>Cambiar foto</h2>
    <label class="btn btn-accion subir">Elegir de tu galería o cámara<input type="file" accept="image/*" data-sube hidden></label>
    <form class="busca-foto" data-busca ${internetActivo() ? '' : 'hidden'}><label for="bf">Buscar en internet</label><div class="fila"><input id="bf" class="campo" placeholder="Por ejemplo, circuit breaker"><button class="btn">Buscar</button></div></form>
    <div class="rejilla-fotos" data-red></div>
    ${dePdf.length ? '<h3>De tu PDF</h3><div class="rejilla-fotos" data-pdf></div>' : ''}
    <h3>Banco incluido</h3><div class="rejilla-fotos">${BANCO.map((f, i) => `<button data-b="${i}" aria-label="Foto ${i + 1}"><img loading="lazy" src="${f.src}" alt=""></button>`).join('')}</div>
    <button class="btn" data-cerrar>Cerrar</button>`, async (d) => {
    const poner = async (f) => { if (esFig) s.figuras[0] = { ...f, pie: f.pie ?? s.figuras[0].pie }; else s.foto = f; await guardar('clases', estado.clase); cerrarHoja(); pintarTiras(); mostrar(estado.i, 0); };
    d.querySelectorAll('[data-b]').forEach((b) => { b.onclick = () => { const f = BANCO[+b.dataset.b]; poner({ src: f.src, credito: f.credito }); }; });
    d.querySelector('[data-sube]').onchange = async (e) => { const a = e.target.files[0]; if (a) poner(await guardarBlob(a, '')); };
    const zona = d.querySelector('[data-pdf]');
    if (zona) { for (const f of dePdf) { const b = document.createElement('button'); const im = new Image(); im.src = await urlFoto(f); im.alt = ''; b.append(im); b.onclick = () => poner(f); zona.append(b); } }
    d.querySelector('[data-busca]').onsubmit = async (e) => {
      e.preventDefault(); const red = d.querySelector('[data-red]'); red.textContent = 'Buscando…';
      try {
        const r = await buscarInternet(d.querySelector('#bf').value || s.titulo);
        red.innerHTML = r.length ? '' : 'Sin resultados con licencia libre.';
        r.forEach((f) => { const b = document.createElement('button'); const im = new Image(); im.src = f.url; im.alt = ''; b.append(im); b.onclick = async () => { const bl = await (await fetch(f.url)).blob(); poner(await guardarBlob(bl, f.credito)); }; red.append(b); });
      } catch { red.textContent = 'No se ha podido buscar. Revisa la conexión.'; }
    };
  });
}
function iniciarGestos(n) {
  let x0 = null;
  n.addEventListener('pointerdown', (e) => { if (!estado.editar) x0 = e.clientX; });
  n.addEventListener('pointerup', (e) => { if (x0 == null) return; const d = e.clientX - x0; x0 = null; if (Math.abs(d) > 40) mostrar(estado.i + (d < 0 ? 1 : -1), d < 0 ? 1 : -1); });
}
function abrirPresentacion() {
  const c = estado.clase; let i = estado.i;
  const capa = document.createElement('div'); capa.className = 'presenta'; capa.tabIndex = 0;
  capa.innerHTML = `<div class="diapo" data-p></div><button class="presenta-cerrar" aria-label="Salir de la presentación">Salir</button><output class="presenta-cuenta"></output>`;
  document.body.append(capa); capa.requestFullscreen?.().catch(() => {}); capa.focus();
  const n = capa.querySelector('[data-p]');
  const pinta = async (dir) => {
    i = Math.max(0, Math.min(i, c.slides.length - 1)); await pintarDiapo(n, c.slides[i], c.tema); n.querySelectorAll('[contenteditable]').forEach((x) => x.removeAttribute('contenteditable'));
    n.style.setProperty('--dir', dir); n.classList.remove('entra'); void n.offsetWidth; n.classList.add('entra');
    capa.querySelector('output').textContent = `${i + 1} de ${c.slides.length}`;
  };
  const cerrar = () => { if (document.fullscreenElement) document.exitFullscreen?.(); capa.remove(); mostrar(i, 0); };
  capa.querySelector('.presenta-cerrar').onclick = (e) => { e.stopPropagation(); cerrar(); };
  capa.onclick = (e) => { const izq = e.clientX < innerWidth * 0.3; i += izq ? -1 : 1; pinta(izq ? -1 : 1); };
  capa.onkeydown = (e) => { if (['ArrowRight', ' ', 'PageDown'].includes(e.key)) { i++; pinta(1); } if (['ArrowLeft', 'PageUp'].includes(e.key)) { i--; pinta(-1); } if (e.key === 'Escape') cerrar(); };
  let x0 = null; capa.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  capa.addEventListener('touchend', (e) => { const d = e.changedTouches[0].clientX - x0; if (Math.abs(d) > 40) { e.preventDefault(); i += d < 0 ? 1 : -1; pinta(d < 0 ? 1 : -1); } });
  pinta(0);
}
