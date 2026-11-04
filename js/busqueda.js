import { TEMARIO } from './temario.js';
export const normal = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9%²\s-]/g, ' ');
const VACIAS = new Set('el la los las un una unos unas de del a al y o u en con por para que como cual cuales es son se su sus lo le les me mi tu te qué esto esta este eso esa ese hay si no mas muy tiene tienen entre sobre cuando donde quiero saber dime explica explicame cuanto cuanta debe puede ser hace hacer tema'.split(' '));
export const palabras = (s) => normal(s).split(/\s+/).filter((p) => p.length > 1 && !VACIAS.has(p));
const docs = TEMARIO.map((f) => ({
  f,
  fuerte: palabras(`${f.titulo} ${f.claves}`),
  texto: palabras(`${f.resumen} ${f.puntos.join(' ')} ${f.fuente}`),
}));
const raiz = (p) => (p.length > 5 ? p.slice(0, 5) : p);
export function buscar(consulta, n = 3) {
  const q = palabras(consulta);
  if (!q.length) return [];
  return docs.map((d) => {
    let score = 0;
    for (const p of q) {
      const r = raiz(p);
      if (d.fuerte.includes(p)) score += 4; else if (d.fuerte.some((x) => raiz(x) === r)) score += 3;
      if (d.texto.some((x) => raiz(x) === r)) score += 1;
    }
    return { f: d.f, score: score / Math.sqrt(q.length) };
  }).filter((x) => x.score >= 1.5).sort((a, b) => b.score - a.score).slice(0, n);
}
