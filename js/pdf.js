// Lectura local del PDF: el archivo nunca sale del dispositivo.
import * as pdfjs from '../vendor/pdf.min.mjs';
import { analizarDocumento, apartados } from './lectura.js';
import { normal } from './busqueda.js';
pdfjs.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdf.worker.min.mjs', import.meta.url).href;

const NO_TEMA = /^(portada|[ií]ndice|cr[eé]ditos|soluciones|contenido|bibliograf|anexos?\b)/i;

export async function abrirPdf(archivo, alAvance = () => {}) {
  const doc = await pdfjs.getDocument({ data: await archivo.arrayBuffer(), isEvalSupported: false }).promise;
  const paginas = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const p = await doc.getPage(n);
    const c = await p.getTextContent();
    const [x0, y0, x1, y1] = p.view;
    paginas.push({
      n, x0, base: y0, ancho: x1 - x0, alto: y1 - y0,
      items: c.items.filter((i) => i.str?.trim()).map((i) => ({ s: i.str, x: i.transform[4], y: i.transform[5], w: i.width, h: Math.round(Math.abs(i.transform[3]) * 10) / 10, f: i.fontName })),
    });
    p.cleanup();
    if (n % 10 === 0) { alAvance(n / doc.numPages); await new Promise((r) => setTimeout(r)); }
  }
  const conTexto = paginas.filter((p) => p.items.reduce((a, i) => a + i.s.length, 0) > 40).length;
  const pdf = { doc, paginas, total: doc.numPages, escaneado: conTexto < Math.max(1, doc.numPages * 0.2) };
  if (pdf.escaneado) return pdf;
  pdf.info = analizarDocumento(paginas);
  pdf.temas = await detectarTemas(doc, paginas, pdf.info);
  pdf.texto = paginas.map((p) => normal(p.items.map((i) => i.s).join(' ')));
  return pdf;
}

async function detectarTemas(doc, paginas, info) {
  const lista = [];
  const indice = await doc.getOutline().catch(() => null);
  const pagDe = async (o) => {
    try {
      const d = typeof o.dest === 'string' ? await doc.getDestination(o.dest) : o.dest;
      return d ? (await doc.getPageIndex(d[0])) + 1 : null;
    } catch { return null; }
  };
  if (indice?.length) for (const o of indice) { const n = await pagDe(o); if (n) lista.push({ titulo: o.title.trim(), desde: n }); }
  // Sin índice interno: se buscan títulos grandes del tipo «Tema 3» o «Unidad 3».
  if (lista.filter((t) => !NO_TEMA.test(t.titulo)).length < 2) {
    lista.length = 0;
    for (const p of paginas) {
      const grandes = p.items.filter((i) => i.h >= info.cuerpo * 1.3 && i.y > p.base + p.alto * 0.5).sort((a, b) => b.y - a.y);
      const texto = grandes.map((i) => i.s).join(' ').replace(/\s+/g, ' ').trim();
      const m = texto.match(/^(tema|unidad|ud\.?|cap[ií]tulo|bloque)\s*(\d+)\b.{0,70}/i);
      if (m && !lista.some((t) => t.numero === +m[2])) lista.push({ titulo: m[0].trim(), desde: p.n, numero: +m[2] });
    }
  }
  lista.sort((a, b) => a.desde - b.desde);
  lista.forEach((t, i) => { t.hasta = (lista[i + 1]?.desde ?? doc.numPages + 1) - 1; });
  let cuenta = 0;
  for (const t of lista) {
    t.esTema = !NO_TEMA.test(t.titulo);
    if (t.esTema) { const m = t.titulo.match(/(?:^|\b(?:tema|unidad)\s*)(\d+)/i); t.numero = t.numero ?? (m ? +m[1] : ++cuenta); }
  }
  return lista.filter((t) => t.esTema);
}
const seq = (a, b) => Array.from({ length: Math.max(0, b - a + 1) }, (_, i) => a + i);
const resumir = (v) => {
  const r = []; let a = v[0], b = v[0];
  for (const n of v.slice(1).concat(Infinity)) { if (n === b + 1) b = n; else { r.push(a === b ? a : `${a}-${b}`); a = b = n; } }
  return r.join(', ');
};
const paginasCuerpo = (pdf) => (pdf.temas.length ? pdf.temas.flatMap((t) => seq(t.desde, t.hasta)) : seq(1, pdf.total));

// Admite: «PDF entero», «tema 3», «temas 2 y 3», «páginas 12 a 18», el título de un tema o palabras clave.
export function elegirPaginas(pdf, peticion, temasMarcados = []) {
  if (temasMarcados.length) {
    const v = temasMarcados.flatMap((t) => seq(t.desde, t.hasta));
    return { paginas: [...new Set(v)].sort((a, b) => a - b), como: temasMarcados.map((t) => t.titulo).join(', '), temas: temasMarcados };
  }
  const t = (peticion || '').toLowerCase().trim();
  if (!t || /\b(entero|enteros|completo|todo|todos|todas)\b/.test(t)) {
    return { paginas: paginasCuerpo(pdf), como: 'todo el PDF', todo: true, temas: pdf.temas };
  }
  const rangos = t.match(/p[aá]g(?:ina)?s?\.?\s*([\d\s,y\-–a]+)/);
  const soloNumeros = /^[\d\s,\-–]+$/.test(t) && t;
  const trozo = rangos ? rangos[1] : soloNumeros;
  if (trozo) {
    const sel = new Set();
    for (const r of trozo.split(/,|\by\b/)) {
      const m = r.match(/(\d+)\s*(?:-|–|\ba\b)\s*(\d+)/);
      if (m) seq(+m[1], +m[2]).forEach((n) => sel.add(n));
      else if (/\d/.test(r)) sel.add(parseInt(r, 10));
    }
    const v = [...sel].filter((n) => n >= 1 && n <= pdf.total).sort((a, b) => a - b);
    if (v.length) return { paginas: v, como: `páginas ${resumir(v)}` };
  }
  const mt = t.match(/(temas?|unidad(?:es)?|ud\.?|cap[ií]tulos?|bloques?)\s*([\d\s,y\-–]+)/);
  if (mt) {
    const nums = new Set();
    for (const r of mt[2].split(/,|\by\b/)) {
      const m = r.match(/(\d+)\s*[-–]\s*(\d+)/);
      if (m) seq(+m[1], +m[2]).forEach((n) => nums.add(n)); else if (/\d/.test(r)) nums.add(parseInt(r, 10));
    }
    const hay = pdf.temas.filter((x) => nums.has(x.numero));
    if (hay.length) return { paginas: hay.flatMap((x) => seq(x.desde, x.hasta)), como: hay.map((x) => x.titulo).join(', '), temas: hay };
    return { paginas: [], como: `No encuentro «${peticion.trim()}» en este PDF. ${pdf.temas.length ? `Tiene ${pdf.temas.length} temas` : 'No he detectado sus temas'}` };
  }
  const q = normal(t);
  const porTitulo = pdf.temas.filter((x) => normal(x.titulo).includes(q));
  if (porTitulo.length) return { paginas: porTitulo.flatMap((x) => seq(x.desde, x.hasta)), como: porTitulo.map((x) => x.titulo).join(', '), temas: porTitulo };
  // Un apartado concreto por su título.
  const secs = todosLosApartados(pdf);
  const k = secs.findIndex((s) => normal(s.titulo).includes(q));
  if (k >= 0) {
    const s = secs[k];
    const sig = secs.slice(k + 1).find((x) => x.nivel <= s.nivel);
    return { paginas: seq(s.pagina, Math.max(s.pagina, (sig?.pagina ?? s.pagina + 1) - (sig && sig.pagina > s.pagina ? 1 : 0))), como: `el apartado «${s.titulo}»`, soloDesde: s.titulo };
  }
  const claves = q.split(/\s+/).filter((c) => c.length > 3);
  if (claves.length) {
    const v = pdf.texto.map((tx, i) => ({ n: i + 1, s: claves.reduce((a, c) => a + (tx.match(new RegExp(c.slice(0, 7), 'g'))?.length ?? 0), 0) })).filter((p) => p.s > 1).sort((a, b) => b.s - a.s).slice(0, 15).map((p) => p.n).sort((a, b) => a - b);
    if (v.length) return { paginas: v, como: `las páginas sobre «${peticion.trim()}»: ${resumir(v)}` };
  }
  return { paginas: [], como: `No he encontrado «${peticion.trim()}» en el PDF` };
}

function todosLosApartados(pdf) { return (pdf.secs ??= apartados(pdf.paginas.filter((p) => paginasCuerpo(pdf).includes(p.n)), pdf.info)); }

// Apartados de las páginas elegidas, con el tema al que pertenece cada uno.
export function apartadosDe(pdf, sel) {
  const set = new Set(sel.paginas);
  let secs = apartados(pdf.paginas.filter((p) => set.has(p.n)), pdf.info);
  if (sel.soloDesde) { const k = secs.findIndex((s) => s.titulo === sel.soloDesde); if (k > 0) secs = secs.slice(k); }
  for (const s of secs) s.tema = pdf.temas.find((t) => s.pagina >= t.desde && s.pagina <= t.hasta)?.titulo ?? '';
  return secs;
}

const render = new Map();
async function paginaDibujada(pdf, n, escala) {
  const k = `${n}@${escala}`;
  if (render.has(k)) return render.get(k);
  const p = await pdf.doc.getPage(n);
  const vp = p.getViewport({ scale: escala });
  const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height;
  await p.render({ canvasContext: c.getContext('2d', { willReadFrequently: true }), viewport: vp, background: '#ffffff' }).promise;
  p.cleanup();
  // Solo se conserva la última página: un móvil no aguanta muchas en memoria.
  render.clear(); render.set(k, { c, vp });
  return render.get(k);
}
// Quita los bordes blancos del recorte; devuelve null si no hay nada dibujado.
function recortarBlanco(ctx, w, h) {
  const d = ctx.getImageData(0, 0, w, h).data;
  const lleno = (x, y) => { const i = (y * w + x) * 4; return d[i] < 245 || d[i + 1] < 245 || d[i + 2] < 245; };
  let t = 0, b = h - 1, l = 0, r = w - 1;
  const fila = (y) => { for (let x = 0; x < w; x += 2) if (lleno(x, y)) return true; return false; };
  const col = (x) => { for (let y = 0; y < h; y += 2) if (lleno(x, y)) return true; return false; };
  while (t < h && !fila(t)) t++;
  if (t >= h) return null;
  while (b > t && !fila(b)) b--;
  while (l < w && !col(l)) l++;
  while (r > l && !col(r)) r--;
  return { x: Math.max(0, l - 6), y: Math.max(0, t - 6), w: Math.min(w, r - l + 13), h: Math.min(h, b - t + 13) };
}
// Recorta una zona de la página ya dibujada: así salen las figuras y fórmulas tal y como son.
export async function recortar(pdf, zona, escala = 2) {
  const { c, vp } = await paginaDibujada(pdf, zona.pagina, escala);
  const [ax, ay] = vp.convertToViewportPoint(zona.x0, zona.y1);
  const [bx, by] = vp.convertToViewportPoint(zona.x1, zona.y0);
  const w = Math.round(Math.abs(bx - ax)), h = Math.round(Math.abs(by - ay));
  if (w < 20 || h < 12) return null;
  const tmp = document.createElement('canvas'); tmp.width = w; tmp.height = h;
  const ct = tmp.getContext('2d', { willReadFrequently: true });
  ct.drawImage(c, Math.min(ax, bx), Math.min(ay, by), w, h, 0, 0, w, h);
  const caja = recortarBlanco(ct, w, h);
  if (!caja || caja.w < 24 || caja.h < 14) return null;
  const fin = document.createElement('canvas'); fin.width = caja.w; fin.height = caja.h;
  fin.getContext('2d').drawImage(tmp, caja.x, caja.y, caja.w, caja.h, 0, 0, caja.w, caja.h);
  const blob = await new Promise((r) => fin.toBlob(r, 'image/jpeg', 0.88));
  return { blob, ancho: caja.w, alto: caja.h };
}
// Primera página como imagen, para la portada de la clase.
export async function portadaDe(pdf, n = 1) {
  const p = await pdf.doc.getPage(n);
  const vp = p.getViewport({ scale: 1.4 });
  const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height;
  await p.render({ canvasContext: c.getContext('2d'), viewport: vp, background: '#ffffff' }).promise;
  p.cleanup();
  return new Promise((r) => c.toBlob(r, 'image/jpeg', 0.85));
}
