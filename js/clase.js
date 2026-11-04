// Convierte una fuente (PDF, temario o IA) en una lista de diapositivas.
import { TEMARIO } from './temario.js';
import { buscar, palabras, normal } from './busqueda.js';
import { ia } from './ia.js';
import { etiquetasDe } from './fotos.js';

const TERMINOS = new Set(palabras(TEMARIO.map((f) => f.claves).join(' ')));
const recortar = (s, n = 150) => {
  s = s.replace(/\s+/g, ' ').trim();
  if (s.length <= n) return s;
  const c = s.slice(0, n); const i = Math.max(c.lastIndexOf(', '), c.lastIndexOf('; '), c.lastIndexOf(' '));
  return c.slice(0, i > 60 ? i : n).replace(/[,;:]$/, '') + '…';
};
const frases = (t) => t.replace(/\s+/g, ' ').split(/(?<=[.;:!?])\s+(?=[A-ZÁÉÍÓÚÑ0-9•·-])/).map((s) => s.replace(/^[•·\-–\s]+/, '').trim()).filter((s) => s.length > 25 && s.length < 400);
const esFormula = (l) => /[=≤≥]/.test(l) && l.length < 60 && /[A-Za-zΩφ]/.test(l) && l.split(' ').filter((p) => p.length > 5).length < 4;

// Secciones de un conjunto de páginas: un título por cada línea corta y de mayor tamaño.
export function secciones(pdf, numeros) {
  const pags = numeros.map((n) => pdf.paginas[n - 1]).filter(Boolean);
  const altos = pags.flatMap((p) => p.lineas.map((l) => Math.round(l.alto))).filter(Boolean).sort((a, b) => a - b);
  const normalAlto = altos[Math.floor(altos.length / 2)] || 11;
  const repetidas = new Map();
  pags.forEach((p) => [...p.lineas.slice(0, 2), ...p.lineas.slice(-2)].forEach((l) => repetidas.set(l.texto, (repetidas.get(l.texto) ?? 0) + 1)));
  const fuera = []; let act = null;
  const nueva = (titulo, pagina) => { act = { titulo, pagina, texto: '', formulas: [] }; fuera.push(act); };
  for (const p of pags) {
    for (const l of p.lineas) {
      const tx = l.texto;
      if (!tx || /^\d+$/.test(tx) || (repetidas.get(tx) > 2 && pags.length > 3)) continue;
      const corta = tx.length < 75 && !/[.;,:]$/.test(tx) && /[A-Za-zÁÉÍÓÚáéíóú]{3}/.test(tx);
      if (corta && (l.alto > normalAlto * 1.12 || /^(\d+(\.\d+)*\.?\s+[A-ZÁÉÍÓÚ]|[A-ZÁÉÍÓÚÑ\s]{6,}$)/.test(tx))) { nueva(tx.replace(/^\d+(\.\d+)*\.?\s+/, ''), p.n); continue; }
      if (!act) nueva('', p.n);
      if (esFormula(tx)) act.formulas.push(tx);
      act.texto += ' ' + tx;
      if (act.texto.length > 1400) nueva(act.titulo ? `${act.titulo} (continuación)` : '', p.n);
    }
  }
  return fuera.filter((s) => s.texto.trim().length > 50);
}

function resumirTexto(texto) {
  const fs = frases(texto); if (!fs.length) return [recortar(texto)];
  const frec = {}; palabras(texto).forEach((p) => { frec[p] = (frec[p] ?? 0) + 1; });
  const conPos = fs.map((s, i) => {
    const ps = palabras(s);
    const score = ps.reduce((a, p) => a + Math.min(frec[p] ?? 0, 4) + (TERMINOS.has(p) ? 3 : 0), 0) / Math.max(ps.length, 4) + (i === 0 ? 1.5 : 0) + (/\d/.test(s) ? 0.6 : 0);
    return { s, i, score };
  });
  return conPos.sort((a, b) => b.score - a.score).slice(0, 4).sort((a, b) => a.i - b.i).map((x) => recortar(x.s));
}
function tituloDe(sec) {
  if (sec.titulo) return recortar(sec.titulo, 60);
  return recortar(frases(sec.texto)[0] ?? sec.texto, 50);
}

const PROMPT_DIAPO = `Eres profesor de un ciclo de FP de Instalaciones Eléctricas y Automáticas en España. Convierte el texto en una diapositiva en español. Usa solo datos del texto; no menciones normas, reglamentos ni siglas que no aparezcan en él, y no inventes valores. Responde únicamente con JSON así: {"titulo":"máximo 7 palabras","puntos":["3 o 4 frases cortas, de menos de 16 palabras"],"formula":"fórmula del texto o cadena vacía"}`;

async function diapoIA(sec) {
  const r = await ia.json([{ role: 'user', content: `${PROMPT_DIAPO}\n\nTítulo: ${sec.titulo || 'sin título'}\nTexto:\n${sec.texto.slice(0, 1800)}` }]);
  const puntos = (r.puntos ?? []).filter((p) => typeof p === 'string' && p.length > 5).slice(0, 4).map((p) => recortar(p, 130));
  if (puntos.length < 2) throw new Error('respuesta incompleta');
  return { titulo: recortar(r.titulo || sec.titulo, 60), puntos, formula: typeof r.formula === 'string' && /=/.test(r.formula) ? r.formula.slice(0, 50) : '' };
}

const fin = (titulo, puntos) => ({ tipo: 'cierre', titulo: 'Lo que debes recordar', puntos: puntos.slice(0, 3), etiquetas: etiquetasDe(titulo) });

function maquetar(titulo, cuerpo, subtitulo) {
  const s = [{ tipo: 'portada', titulo, frase: subtitulo, etiquetas: etiquetasDe(titulo + ' ' + cuerpo.map((c) => c.titulo).join(' ')) }];
  const giro = ['foto', 'lista', 'fotoD', 'campo'];
  let i = 0;
  for (const c of cuerpo) {
    if (c.tabla) { s.push({ ...c, tipo: 'tabla' }); continue; }
    if (c.esquema) { s.push({ ...c, tipo: 'esquema' }); continue; }
    s.push({ ...c, tipo: giro[i++ % giro.length] });
    if (c.formula) { s.push({ tipo: 'formula', titulo: c.titulo, formula: c.formula, frase: c.frase ?? c.puntos?.[0] ?? '', fuente: c.fuente }); delete c.formula; }
  }
  const clave = cuerpo.map((c) => c.puntos?.[0]).filter(Boolean);
  if (clave.length > 1) s.push(fin(titulo, clave.filter((_, k) => k % Math.ceil(clave.length / 3) === 0)));
  return s;
}

// Crea diapositivas desde el temario.
export function desdeTemario(fichas, titulo) {
  const cuerpo = fichas.map((f) => ({
    titulo: f.titulo, puntos: f.puntos.slice(0, 4).map((p) => recortar(p, 150)), formula: f.formula, esquema: f.esquema, tabla: f.tabla,
    frase: f.resumen, fuente: f.fuente, etiquetas: f.fotos,
  }));
  return maquetar(titulo, cuerpo, fichas.length === 1 ? fichas[0].resumen : `${fichas.length} apartados del temario`);
}

// Crea diapositivas desde secciones del PDF. Si la IA está lista, la usa; si no, extrae frases clave.
export async function desdeSecciones(secs, titulo, { maxDiapos, alAvance, cancelada }) {
  let lista = secs;
  if (lista.length > maxDiapos) {
    const paso = lista.length / maxDiapos; const r = [];
    for (let k = 0; k < maxDiapos; k++) {
      const trozo = lista.slice(Math.floor(k * paso), Math.floor((k + 1) * paso));
      r.push({ ...trozo[0], texto: trozo.map((t) => t.texto).join(' '), formulas: trozo.flatMap((t) => t.formulas) });
    }
    lista = r;
  }
  const cuerpo = []; let conIA = 0;
  for (let k = 0; k < lista.length; k++) {
    if (cancelada()) throw new DOMException('cancelado', 'AbortError');
    const sec = lista[k];
    alAvance((k + 0.2) / lista.length, tituloDe(sec));
    let d = null;
    if (ia.lista) { try { d = await diapoIA(sec); conIA++; } catch { d = null; } }
    d ??= { titulo: tituloDe(sec), puntos: resumirTexto(sec.texto), formula: sec.formulas[0] ?? '' };
    cuerpo.push({ ...d, pagina: sec.pagina, fuente: `Tu PDF, página ${sec.pagina}`, etiquetas: etiquetasDe(`${d.titulo} ${d.puntos.join(' ')}`) });
  }
  return { slides: maquetar(titulo, cuerpo), conIA, total: lista.length };
}

const PROMPT_TEMA = `Eres profesor de un ciclo de FP de Instalaciones Eléctricas y Automáticas en España. Crea el guion de una presentación en español sobre el tema indicado. REBT es el Reglamento Electrotécnico para Baja Tensión. Si no estás seguro de un dato, no lo incluyas; no inventes cifras ni siglas. Responde únicamente con JSON así: {"apartados":[{"titulo":"máximo 7 palabras","puntos":["3 frases cortas"]}]} con 4 a 6 apartados.`;

// Tema libre fuera del temario: solo se puede generar con la IA.
export async function desdeIA(tema) {
  const r = await ia.json([{ role: 'user', content: `${PROMPT_TEMA}\n\nTema: ${tema}` }], 800);
  const cuerpo = (r.apartados ?? []).filter((a) => a.titulo && a.puntos?.length).map((a) => ({
    titulo: recortar(a.titulo, 60), puntos: a.puntos.slice(0, 4).map((p) => recortar(String(p), 130)), fuente: 'Generado por IA: compruébalo', etiquetas: etiquetasDe(`${a.titulo} ${a.puntos.join(' ')}`),
  }));
  if (cuerpo.length < 2) throw new Error('La IA no ha devuelto un guion válido.');
  return maquetar(tema, cuerpo, 'Generado por la IA local. Compruébalo con tus apuntes.');
}

export function fichasDe(peticion) {
  const trozos = peticion.split(/[,;\n]|\sy\s/).map((s) => s.trim()).filter((s) => s.length > 2);
  const vistas = new Map();
  for (const t of trozos.length > 1 ? trozos : [peticion]) buscar(t, trozos.length > 1 ? 1 : 4).forEach(({ f, score }) => { if (score >= 2.5 && !vistas.has(f.id)) vistas.set(f.id, f); });
  return [...vistas.values()].slice(0, 8);
}
export { normal };
