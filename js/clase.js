// Convierte una fuente (PDF, temario o IA) en una presentación coherente.
import { TEMARIO } from './temario.js';
import { buscar, palabras, normal } from './busqueda.js';
import { ia } from './ia.js';
import { etiquetasDe } from './fotos.js';
import { frases, sinMarcas, terminos } from './lectura.js';

const TERMINOS = new Set(palabras(TEMARIO.map((f) => f.claves).join(' ')));
const recortarTx = (s, n = 200) => {
  if (sinMarcas(s).length <= n) return s;
  const c = s.slice(0, n); const i = Math.max(c.lastIndexOf(', '), c.lastIndexOf('; '), c.lastIndexOf(' '));
  let r = c.slice(0, i > 70 ? i : n).replace(/[,;:]$/, '').replace(/\*+$/, '');
  if ((r.match(/\*\*/g)?.length ?? 0) % 2) r += '**';
  return `${r}…`;
};
// Frases que dependen de la anterior o que solo presentan otra cosa no sirven solas.
const DEPENDIENTE = /^(as[ií]|esto|estos|estas|esta|este|dicho|dicha|ello|ahora|por ello|por eso|por tanto|sin embargo|no obstante|adem[aá]s|tambi[eé]n|en este caso|de este modo|de esta forma|en la figura|como se (ve|muestra|observa)|la figura|para ello|por otro lado|por otra parte|en cambio|es decir|es la|es el|son los|son las)\b/i;
const DEFINE = /\b(se denomina|se llama|se define|consiste en|se conoce como|se mide|su unidad|tiene como unidad|se representa|se calcula|permite|se utiliza|sirve para|depende de|es proporcional|es la|es el|son los|son las|se clasifican)\b/i;

function puntuar(fs) {
  const todo = fs.map((f) => f.s).join(' ');
  const frec = {}; palabras(sinMarcas(todo)).forEach((p) => { frec[p] = (frec[p] ?? 0) + 1; });
  return fs.map((f, i) => {
    const ps = palabras(sinMarcas(f.s));
    let score = ps.reduce((a, p) => a + Math.min(frec[p] ?? 0, 3) + (TERMINOS.has(p) ? 1.5 : 0), 0) / Math.max(ps.length, 5);
    if (DEFINE.test(f.s)) score += 2;
    score += terminos(f.s).length * 1.2;
    if (i === 0) score += 2.5;
    if (f.inicio) score += 0.6;
    if (/^(\d+[.)]|[•·▪–—-])\s/.test(f.s)) score += 0.5;
    if (DEPENDIENTE.test(sinMarcas(f.s)) && i > 0) score -= 1;
    if (/:$/.test(f.s)) score -= 1.5;
    if (sinMarcas(f.s).length < 35) score -= 1;
    return { ...f, i, score };
  });
}
// Frases en orden de lectura; una frase dependiente se une a la anterior para que tenga sentido.
function frasesDe(sec) {
  const fs = [];
  for (const p of sec.parrafos) {
    frases(p.texto).forEach((s, k) => {
      const lim = s.replace(/^[•·▪–—-]\s*/, '').trim();
      const plano = sinMarcas(lim);
      if (!/^[A-ZÁÉÍÓÚÑ0-9(*¿]/.test(lim.replace(/^\*\*/, '')) && fs.length) { fs[fs.length - 1].s += ` ${lim}`; return; }
      if (/(^|\s)(tabla|figura) \d+[.\d]*\.?$/i.test(plano)) return;
      // Un título de viñeta en negrita va siempre unido a su explicación.
      const u = fs[fs.length - 1];
      if (u?.encabeza && k > 0) { u.s = `${u.s.replace(/[.:]$/, '')}: ${lim}`; u.encabeza = false; return; }
      fs.push({ s: lim, pagina: p.pagina, inicio: k === 0, encabeza: /^\*\*[^*]+\*\*[.:]?$/.test(lim) && plano.length < 70 });
    });
  }
  return fs.filter((f) => !f.encabeza || fs.length < 2);
}
const MAX_DIAPO = 640;
// Elige las ideas de un apartado respetando el orden del libro.
function ideas(sec, detalle) {
  const fs = puntuar(frasesDe(sec));
  const limite = { breve: 520, normal: 980, completa: 99999 }[detalle];
  const elegidas = [...fs].sort((a, b) => b.score - a.score);
  const sel = []; let total = 0;
  for (const f of elegidas) {
    const n = sinMarcas(f.s).length;
    if (total + n > limite && sel.length >= 2) continue;
    sel.push(f); total += n;
  }
  return sel.sort((a, b) => a.i - b.i).map((f) => recortarTx(f.s, detalle === 'breve' ? 180 : 260));
}
function trocear(puntos) {
  const grupos = []; let g = [], t = 0;
  for (const p of puntos) {
    const n = sinMarcas(p).length;
    if (g.length && (t + n > MAX_DIAPO || g.length >= 6)) { grupos.push(g); g = []; t = 0; }
    g.push(p); t += n;
  }
  if (g.length) grupos.push(g);
  // Una última diapositiva con una sola idea se une a la anterior si cabe.
  if (grupos.length > 1 && grupos[grupos.length - 1].length === 1) {
    const ant = grupos[grupos.length - 2]; const u = grupos[grupos.length - 1];
    const t = [...ant, ...u].reduce((a, p) => a + sinMarcas(p).length, 0);
    if (t < 800) { ant.push(...u); grupos.pop(); }
  }
  return grupos;
}
const textoCompleto = (sec) => sec.parrafos.map((p) => sinMarcas(p.texto)).join('\n\n');
const titNumero = (t) => t.replace(/^\d+(\.\d+)*\.?\s+/, '');

const PROMPT_DIAPO = `Reescribe estas frases de unos apuntes de electricidad como puntos de una diapositiva, en español y claros. Usa solo lo que dicen; no añadas datos, cifras, normas ni siglas nuevas. Responde únicamente con JSON así: {"puntos":["frase","frase"]} con 3 a 5 frases completas de menos de 30 palabras.`;
async function mejorarIA(sec, puntos) {
  const fuente = sec.parrafos.map((p) => sinMarcas(p.texto)).join(' ').slice(0, 1900);
  const r = await ia.json([{ role: 'user', content: `${PROMPT_DIAPO}\n\nApartado: ${sec.titulo}\nFrases:\n${fuente}` }], 320);
  const base = normal(fuente); const palabrasBase = new Set(palabras(fuente).map((p) => p.slice(0, 5)));
  // Se descarta cualquier punto con cifras que no estén en el libro o que se aleje de su contenido.
  const validos = (r.puntos ?? []).filter((p) => {
    if (typeof p !== 'string' || p.length < 15) return false;
    const nums = p.match(/\d+(?:[.,]\d+)?/g) ?? [];
    if (nums.some((x) => !base.includes(x.replace(',', '.')) && !base.includes(x))) return false;
    const ps = palabras(p);
    return ps.filter((w) => palabrasBase.has(w.slice(0, 5))).length / Math.max(ps.length, 1) >= 0.6;
  });
  return validos.length >= 2 ? validos.slice(0, 5) : puntos;
}

// Presentación de un documento: portada, índice, separadores, apartados y repaso.
export async function desdeApartados(secs, titulo, { detalle = 'normal', usarIA = false, alAvance = () => {}, cancelada = () => false, subtitulo = '' }) {
  const slides = [{ tipo: 'portada', titulo, frase: subtitulo, etiquetas: etiquetasDe(titulo) }];
  const bloques = [...new Set(secs.filter((s) => s.nivel === 1).map((s) => titNumero(s.titulo)))];
  if (bloques.length > 1) slides.push({ tipo: 'indice', titulo: 'Qué vamos a ver', puntos: bloques.slice(0, 12), etiquetas: [] });
  let temaAct = null, conIA = 0;
  const lista = detalle === 'breve' ? fusionar(secs) : secs;
  for (let k = 0; k < lista.length; k++) {
    if (cancelada()) throw new DOMException('cancelado', 'AbortError');
    const sec = lista[k];
    alAvance(k / lista.length, titNumero(sec.titulo) || 'Apartado');
    if (sec.tema && sec.tema !== temaAct && new Set(secs.map((s) => s.tema)).size > 1) { temaAct = sec.tema; slides.push({ tipo: 'separador', titulo: titNumero(sec.tema), frase: `Tema ${parseInt(sec.tema, 10) || ''}`.trim(), fuente: '' }); }
    if (sec.nivel === 1 && detalle !== 'breve' && lista[k + 1]?.nivel === 2 && sec.parrafos.join('').length < 1 && !sec.figuras.length) continue;
    let puntos = ideas(sec, detalle);
    if (usarIA && ia.lista && sec.parrafos.length) { try { const n = await mejorarIA(sec, puntos); if (n !== puntos) { puntos = n; conIA++; } } catch {} }
    const titA = titNumero(sec.titulo) || titNumero(sec.padre ?? '') || titNumero(sec.tema ?? '') || titulo;
    const figs = [...sec.figuras]; const forms = [...sec.formulas];
    const grupos = puntos.length ? trocear(puntos) : [[]];
    const maxFig = { breve: 1, normal: 2, completa: 2 }[detalle];
    grupos.forEach((g, n) => {
      const propias = figs.splice(0, g.length > 3 ? Math.min(1, maxFig) : maxFig);
      const eqs = forms.splice(0, propias.length ? 2 : 3);
      slides.push({
        tipo: propias.length ? (slides.length % 2 ? 'figura' : 'figuraD') : eqs.length ? 'ecuaciones' : (slides.length % 2 ? 'campo' : 'apartado'),
        titulo: n ? `${titA} (continuación)` : titA, seccion: sec.padre ? titNumero(sec.padre) : '',
        puntos: g, figuras: propias, ecuaciones: eqs,
        fuente: `Página ${sec.pagina}${sec.paginaFin > sec.pagina ? `-${sec.paginaFin}` : ''} del PDF`, notas: n === 0 ? textoCompleto(sec) : '',
      });
    });
    // Lo que no haya cabido junto al texto va en sus propias diapositivas, nunca se pierde en modo completo.
    const quedan = detalle === 'breve' ? figs.splice(0, 2) : figs.splice(0);
    for (let i = 0; i < quedan.length; i += 3) slides.push({ tipo: 'galeria', titulo: titA, figuras: quedan.slice(i, i + 3), fuente: `Página ${quedan[i].pagina} del PDF` });
    if (forms.length && detalle !== 'breve') slides.push({ tipo: 'ecuaciones', titulo: `${titA}: fórmulas`, puntos: [], ecuaciones: forms.splice(0, 6), figuras: [], fuente: `Página ${sec.pagina} del PDF` });
  }
  const repaso = secs.flatMap((s) => frasesDe(s).filter((f) => DEFINE.test(f.s) && !DEPENDIENTE.test(sinMarcas(f.s)) && terminos(f.s).length).map((f) => recortarTx(f.s, 170)));
  const paso = Math.max(1, Math.floor(repaso.length / 5));
  const clave = repaso.filter((_, i) => i % paso === 0).slice(0, 5);
  if (clave.length >= 2) slides.push({ tipo: 'cierre', titulo: 'Para repasar', puntos: clave, etiquetas: etiquetasDe(titulo) });
  return { slides, conIA };
}
// En modo breve, los subapartados se resumen dentro de su apartado principal.
function fusionar(secs) {
  const r = [];
  for (const s of secs) {
    const u = r[r.length - 1];
    if (s.nivel === 2 && u && u.padreDe === (s.padre ?? '') ) {
      u.parrafos.push(...s.parrafos); u.figuras.push(...s.figuras); u.formulas.push(...s.formulas); u.paginaFin = Math.max(u.paginaFin, s.paginaFin);
    } else r.push({ ...s, parrafos: [...s.parrafos], figuras: [...s.figuras], formulas: [...s.formulas], padreDe: s.nivel === 1 ? s.titulo : s.padre ?? '' });
  }
  return r;
}

export function desdeTemario(fichas, titulo) {
  const slides = [{ tipo: 'portada', titulo, frase: fichas.length === 1 ? fichas[0].resumen : `${fichas.length} apartados del temario`, etiquetas: fichas[0]?.fotos ?? [] }];
  if (fichas.length > 2) slides.push({ tipo: 'indice', titulo: 'Qué vamos a ver', puntos: fichas.map((f) => f.titulo) });
  const giro = ['foto', 'apartado', 'fotoD', 'campo'];
  let i = 0;
  for (const f of fichas) {
    const puntos = f.puntos.slice(0, 6);
    if (f.tabla) { slides.push({ tipo: 'tabla', titulo: f.titulo, tabla: f.tabla, fuente: f.fuente }); slides.push({ tipo: 'campo', titulo: f.titulo, puntos, fuente: f.fuente, notas: f.resumen }); continue; }
    if (f.esquema) slides.push({ tipo: 'esquema', titulo: f.titulo, puntos: puntos.slice(0, 4), esquema: f.esquema, fuente: f.fuente, notas: f.resumen });
    else slides.push({ tipo: giro[i++ % giro.length], titulo: f.titulo, puntos, fuente: f.fuente, etiquetas: f.fotos, notas: f.resumen });
    if (f.ladder) slides.push({ tipo: 'ladder', titulo: f.titulo, ladder: f.ladder, fuente: f.fuente });
    if (f.formula) slides.push({ tipo: 'formula', titulo: f.titulo, formula: f.formula, frase: f.resumen, fuente: f.fuente });
  }
  const clave = fichas.map((f) => f.puntos[0]).filter(Boolean);
  if (clave.length > 1) slides.push({ tipo: 'cierre', titulo: 'Para repasar', puntos: clave.slice(0, 5), etiquetas: fichas[0]?.fotos ?? [] });
  return slides;
}

const PROMPT_TEMA = `Eres profesor de un ciclo de FP de Instalaciones Eléctricas y Automáticas en España. Crea el guion de una presentación en español sobre el tema indicado. REBT es el Reglamento Electrotécnico para Baja Tensión. Si no estás seguro de un dato, no lo incluyas; no inventes cifras ni siglas. Responde únicamente con JSON así: {"apartados":[{"titulo":"máximo 7 palabras","puntos":["3 frases cortas"]}]} con 4 a 6 apartados.`;
export async function desdeIA(tema) {
  const r = await ia.json([{ role: 'user', content: `${PROMPT_TEMA}\n\nTema: ${tema}` }], 800);
  const secs = (r.apartados ?? []).filter((a) => a.titulo && a.puntos?.length);
  if (secs.length < 2) throw new Error('La IA no ha devuelto un guion válido.');
  const slides = [{ tipo: 'portada', titulo: tema, frase: 'Generado por la IA local. Compruébalo con tus apuntes.', etiquetas: etiquetasDe(tema) }];
  secs.forEach((a, i) => slides.push({ tipo: ['foto', 'apartado', 'fotoD', 'campo'][i % 4], titulo: recortarTx(a.titulo, 60), puntos: a.puntos.slice(0, 4).map((p) => recortarTx(String(p), 170)), fuente: 'Generado por IA: compruébalo', etiquetas: etiquetasDe(`${a.titulo} ${a.puntos.join(' ')}`) }));
  return slides;
}

export function fichasDe(peticion) {
  const trozos = peticion.split(/[,;\n]|\sy\s/).map((s) => s.trim()).filter((s) => s.length > 2);
  const vistas = new Map();
  for (const t of trozos.length > 1 ? trozos : [peticion]) buscar(t, trozos.length > 1 ? 1 : 4).forEach(({ f, score }) => { if (score >= 2.5 && !vistas.has(f.id)) vistas.set(f.id, f); });
  return [...vistas.values()].slice(0, 10);
}
