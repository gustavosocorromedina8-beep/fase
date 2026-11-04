// Reconstruye la estructura de un PDF a partir de la posición de cada trozo de texto:
// columnas, notas al margen, títulos, párrafos, fórmulas y figuras con su pie.
// No depende de PDF.js ni del navegador para poder probarse aparte.

const moda = (mapa) => [...mapa.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
const contar = (m, k, v = 1) => m.set(k, (m.get(k) ?? 0) + v);
const OMITIR = /^(caso pr[aá]ctico|situaci[oó]n de partida|estudio del caso|vamos a conocer|y al finalizar|actividades|ejercicios|evall?[uú]a|entra en internet|mundo t[eé]cnico|en resumen|pr[aá]ctica profesional|herramientas\b.*materiales$|ampl[ií]a|recuerda|sab[ií]as|vocabulario|nota\b|ejemplo\b|cr[eé]ditos|soluciones|[ií]ndice)/i;
const PIE = /^(Figura|Fig\.|Imagen|Fotograf[ií]a|Foto)\s*\d+([.\-]\d+)*\.?/i;
const PIE_TABLA = /^Tabla\s*\d+([.\-]\d+)*\.?/i;

// Une los trozos de una línea respetando los espacios reales.
function unir(items) {
  let t = '', fin = null;
  for (const i of items) {
    if (fin != null && i.x - fin > Math.max(0.8, i.h * 0.12) && !t.endsWith(' ') && !i.s.startsWith(' ')) t += ' ';
    t += i.s; fin = i.x + i.w;
  }
  return t.replace(/\s+/g, ' ').replace(/\s+([.,;:)])/g, '$1').replace(/\(\s+/g, '(').trim();
}

function agruparLineas(items) {
  const orden = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const lineas = [];
  for (const i of orden) {
    const l = lineas.find((x) => Math.abs(x.y - i.y) <= Math.min(2.2, Math.max(x.h, i.h) * 0.25));
    if (l) { l.items.push(i); l.h = Math.max(l.h, i.h); } else lineas.push({ y: i.y, h: i.h, items: [i] });
  }
  for (const l of lineas) {
    l.items.sort((a, b) => a.x - b.x);
    l.x0 = l.items[0].x; l.x1 = Math.max(...l.items.map((i) => i.x + i.w));
    const peso = new Map(); l.items.forEach((i) => contar(peso, i.h, i.s.length));
    l.hd = moda(peso);
    l.texto = unir(l.items);
  }
  return lineas.sort((a, b) => b.y - a.y);
}

// Datos comunes del documento: cuerpo de letra, fuente normal y bandas de cabecera y pie.
export function analizarDocumento(paginas) {
  const tam = new Map();
  paginas.forEach((p) => p.items.forEach((i) => contar(tam, i.h, i.s.length)));
  const cuerpo = moda(tam) ?? 11;
  const fuentes = new Map(), arriba = new Map(), abajo = new Map();
  for (const p of paginas) {
    for (const i of p.items) if (Math.abs(i.h - cuerpo) < 0.6 && i.s.length > 3) contar(fuentes, i.f, i.s.length);
    const alto = p.alto;
    // Una cabecera lleva letra pequeña; un título grande arriba de la página no lo es.
    const ys = [...new Set(p.items.filter((i) => i.h <= cuerpo * 1.15).map((i) => Math.round(i.y)))];
    ys.filter((y) => y > p.base + alto * 0.9).forEach((y) => contar(arriba, y));
    ys.filter((y) => y < p.base + alto * 0.08).forEach((y) => contar(abajo, y));
  }
  const umbral = Math.max(3, paginas.length * 0.25);
  // La cabecera es la línea repetida más alta; el primer título de la página no debe caer en ella.
  const cab = [...arriba].filter(([, n]) => n >= umbral).map(([y]) => y);
  const pie = [...abajo].filter(([, n]) => n >= umbral).map(([y]) => y);
  return { cuerpo, cabecera: cab.length ? Math.max(...cab) - 3 : Infinity, pie: pie.length ? Math.min(...pie) + 3 : -Infinity };
}

// Columnas de texto principal de una página.
function columnas(p, info) {
  const lineas = agruparLineas(p.items.filter((i) => Math.abs(i.h - info.cuerpo) < 0.6 && i.y < info.cabecera && i.y > info.pie));
  const largas = lineas.filter((l) => l.texto.length > 25);
  if (!largas.length) return [];
  const inicios = new Map();
  largas.forEach((l) => contar(inicios, Math.round(l.x0 / 4) * 4));
  const cand = [...inicios].sort((a, b) => b[1] - a[1]);
  const principal = cand[0][0];
  // Con viñetas, la mayoría de líneas empieza sangrada: el borde real es el inicio más a la izquierda cercano.
  const izquierda = (x) => Math.min(x, ...largas.filter((l) => l.x0 < x && l.x0 >= x - 30).map((l) => l.x0));
  const otra = cand.find(([x, n]) => Math.abs(x - principal) > p.ancho * 0.28 && n >= Math.max(4, largas.length * 0.25));
  const borde = (x0, x1) => {
    const f = largas.filter((l) => l.x0 >= x0 - 6 && l.x0 <= x1).map((l) => l.x1).sort((a, b) => a - b);
    return f[Math.floor(f.length * 0.9)] ?? x1;
  };
  if (otra) {
    const [a, b] = principal < otra[0] ? [principal, otra[0]] : [otra[0], principal];
    const finA = borde(a, b - 20);
    if (finA < b + 2) return [{ x0: izquierda(a), x1: finA }, { x0: izquierda(b), x1: borde(b, p.base + p.ancho + p.x0) }];
  }
  const x0 = izquierda(principal);
  return [{ x0, x1: borde(x0, Infinity) }];
}

// Devuelve los bloques de una página en orden de lectura.
export function bloquesDePagina(p, info) {
  // Cada página numera sus fuentes de una manera: la normal es la más usada en esa página.
  const usoF = new Map();
  p.items.forEach((i) => { if (Math.abs(i.h - info.cuerpo) < 0.6) contar(usoF, i.f, i.s.length); });
  info = { ...info, normal: moda(usoF) };
  const utiles = p.items.filter((i) => i.y < info.cabecera && i.y > info.pie && i.s.trim());
  const cols = columnas(p, info);
  const dentro = (i, c) => i.x >= c.x0 - 4 && i.x <= c.x1 + 2;
  const bloques = [];
  const figuras = figurasDePagina(p, utiles, cols, info);

  cols.forEach((c, ic) => {
    const lineas = agruparLineas(utiles.filter((i) => dentro(i, c)));
    const ancho = c.x1 - c.x0;
    for (let k = 0; k < lineas.length; k++) {
      const l = lineas[k];
      const r = l.hd / info.cuerpo;
      const corta = l.texto.length < 110;
      if (r >= 1.1 && corta && /[A-Za-zÁÉÍÓÚáéíóúñ]{3}/.test(l.texto)) {
        const sig = lineas[k + 1];
        let titulo = l.texto;
        if (sig && sig.hd / info.cuerpo >= 1.1 && Math.abs(sig.hd - l.hd) < 4 && l.y - sig.y < l.h * 1.7 && !/[.:]$/.test(l.texto)) { titulo += ' ' + sig.texto; k++; }
        bloques.push({ tipo: 'titulo', nivel: r >= 1.55 ? 1 : 2, texto: titulo.replace(/- /g, ''), y: l.y, col: ic });
      } else if (Math.abs(l.hd - info.cuerpo) < 0.6) {
        const sangrada = l.x0 > c.x0 + 25;
        const estrecha = l.x1 - l.x0 < ancho * 0.6;
        if (sangrada && estrecha) {
          bloques.push({ tipo: 'suelta', texto: l.texto, y: l.y, x0: l.x0, x1: l.x1, h: l.h, col: ic });
          continue;
        }
        bloques.push({ tipo: 'linea', texto: marcar(l, info), plano: l.texto, y: l.y, x0: l.x0, x1: l.x1, h: l.h, col: ic, cierra: l.x1 < c.x1 - ancho * 0.12 });
      }
    }
  });
  // Agrupa líneas sueltas contiguas: si alguna lleva un signo igual, es una fórmula.
  const salida = [];
  let grupo = [];
  const volcar = () => {
    if (grupo.length && grupo.some((g) => /[=≈≤≥]/.test(g.texto))) {
      salida.push({ tipo: 'formula', texto: grupo.map((g) => g.texto).join(' '), y: grupo[0].y, y0: grupo[grupo.length - 1].y - grupo[grupo.length - 1].h * 0.45, y1: grupo[0].y + grupo[0].h * 1.15, x0: Math.min(...grupo.map((g) => g.x0)) - 6, x1: Math.max(...grupo.map((g) => g.x1)) + 6, col: grupo[0].col });
    }
    grupo = [];
  };
  for (const b of bloques) {
    if (b.tipo === 'suelta') {
      if (grupo.length && grupo[grupo.length - 1].y - b.y > b.h * 1.5) volcar();
      grupo.push(b);
    } else { volcar(); salida.push(b); }
  }
  volcar();
  // Inserta cada figura en su sitio según su altura.
  for (const f of figuras) {
    let k = salida.findIndex((b) => b.col === f.col && b.y < f.y);
    if (k < 0) k = salida.length;
    salida.splice(k, 0, { tipo: 'figura', ...f });
  }
  return salida;
}

// Marca con ** los términos destacados (negrita o cursiva) de la línea.
function marcar(l, info) {
  const trozos = [];
  for (const i of l.items) {
    const dest = i.f !== info.normal && Math.abs(i.h - info.cuerpo) < 0.6;
    const u = trozos[trozos.length - 1];
    if (u && u.dest === dest) u.items.push(i); else trozos.push({ dest, items: [i] });
  }
  let t = '', fin = null;
  for (const tr of trozos) {
    const x = tr.items[0].x;
    if (fin != null && x - fin > 0.8) t += ' ';
    const s = unir(tr.items);
    // Una letra suelta es una variable o una inicial, no un término destacado.
    const marca = tr.dest && (s.match(/[a-záéíóúñ]/gi)?.length ?? 0) >= 4;
    t += marca ? `**${s.replace(/[.,;:]$/, '')}**${/[.,;:]$/.test(s) ? s.slice(-1) : ''}` : s;
    const u = tr.items[tr.items.length - 1]; fin = u.x + u.w;
  }
  return t.replace(/\s+/g, ' ').replace(/\s+([.,;:)])/g, '$1').trim();
}

function figurasDePagina(p, utiles, cols, info) {
  const pies = [];
  const orden = [...utiles].sort((a, b) => b.y - a.y || a.x - b.x);
  orden.forEach((i, k) => {
    const s = i.s.trim();
    const esTabla = PIE_TABLA.test(s);
    if (!PIE.test(s) && !esTabla) return;
    const fila = orden.filter((o) => Math.abs(o.y - i.y) < 2.5 && o.x >= i.x - 1).sort((a, b) => a.x - b.x);
    const mios = []; let fin = i.x;
    for (const o of fila) { if (o.x - fin > 25) break; mios.push(o); fin = o.x + o.w; }
    let texto = unir(mios), y = i.y; const x0 = i.x; let x1 = fin;
    for (let n = 0; n < 2; n++) {
      const sig = orden.filter((o) => y - o.y > 4 && y - o.y < i.h * 1.7 && o.x >= x0 - 3 && o.x < x1 && Math.abs(o.h - i.h) < 0.8);
      if (!sig.length || /[.:]$/.test(texto) && texto.length > 90) break;
      if (/\.$/.test(texto) && !/^\S+\s*\d+(\.\d+)*\.$/.test(texto)) break;
      texto += ' ' + unir(sig.sort((a, b) => a.x - b.x)); y = sig[0].y; x1 = Math.max(x1, ...sig.map((o) => o.x + o.w));
    }
    pies.push({ texto: texto.replace(/- /g, '').trim(), y: i.y, yFin: y, x0, x1, h: i.h, tabla: esTabla });
  });
  // Líneas de texto "de verdad": limitan la figura por arriba o por abajo.
  const lineasDe = (c) => agruparLineas(utiles.filter((i) => i.x >= c.x0 - 4 && i.x <= c.x1 + 2 && (i.h >= info.cuerpo - (c.margen ? 3.5 : 0.6))));
  const fuera = [];
  for (const f of pies) {
    let ic = cols.findIndex((c) => f.x0 >= c.x0 - 10 && f.x0 <= c.x1);
    // Pie centrado bajo la figura: su centro decide la columna.
    if (ic < 0) ic = cols.findIndex((c) => (f.x0 + f.x1) / 2 >= c.x0 && (f.x0 + f.x1) / 2 <= c.x1);
    const c = ic >= 0 ? cols[ic] : margenDe(p, cols, f);
    let xa = c.x0 - 3, xb = c.x1 + 3;
    for (const g of pies) {
      if (g === f || Math.abs(g.y - f.y) > 6 || g.x0 < xa || g.x0 > xb) continue;
      if (g.x0 > f.x0) xb = Math.min(xb, g.x0 - 8); else xa = Math.max(xa, g.x1 > f.x0 ? (g.x0 + f.x0) / 2 : g.x1 + 4);
    }
    const anchoCol = c.x1 - c.x0;
    const todas = agruparLineas(utiles.filter((i) => i.x >= c.x0 - 4 && i.x <= c.x1 + 2 && i.h >= 6.5));
    const lineas = [...lineasDe(c).filter((l) => l.x1 - l.x0 > anchoCol * (c.margen ? 0.35 : 0.55) || (Math.abs(l.hd - info.cuerpo) > 1 && l.hd > info.cuerpo)),
      // El final corto de un párrafo o el resto de un pie también son texto, no parte de la figura.
      ...todas.filter((l) => Math.abs(l.x0 - c.x0) < 4 && l.x1 - l.x0 > 8 && (Math.abs(l.hd - info.cuerpo) < 0.6 || /[.)]$/.test(l.texto))),
      ...todas.filter((l) => /[a-záéíóú]{2,}[.)]$/.test(l.texto) && l.x1 - l.x0 < anchoCol * 0.5 && l.items.every((i) => i.h <= info.cuerpo))]
      .sort((a, b) => b.y - a.y);
    let y0, y1;
    if (f.tabla) {
      // Las tablas llevan el título encima.
      const abajo = lineas.filter((l) => l.y < f.yFin - 4);
      y1 = f.yFin - 2;
      y0 = abajo.length ? abajo[0].y + abajo[0].h * 1.1 : p.base + 30;
    } else {
      const encima = lineas.filter((l) => l.y > f.y + 2 && !pies.some((g) => g !== f && Math.abs(g.y - l.y) < 2));
      const otroPie = pies.filter((g) => g !== f && g.y > f.y + 4 && g.x0 < xb && g.x1 > xa).map((g) => g.yFin);
      y0 = f.y + f.h * 0.9;
      const cortes = [...encima.map((l) => l.y - l.h * 0.25), ...otroPie.map((v) => v - 2)];
      y1 = cortes.length ? Math.min(...cortes) : Math.min(info.cabecera, p.base + p.alto) - 4;
    }
    if (y1 - y0 < 22 || xb - xa < 30) continue;
    fuera.push({ pie: f.texto, y: f.y, x0: xa, x1: xb, y0, y1, col: ic < 0 ? 0 : ic, margen: ic < 0, tabla: f.tabla });
  }
  return fuera;
}
function margenDe(p, cols, f) {
  const c = cols[0] ?? { x0: p.x0, x1: p.x0 + p.ancho };
  if (f.x0 < c.x0) return { x0: p.x0 + 8, x1: c.x0 - 6, margen: true };
  return { x0: c.x1 + 6, x1: p.x0 + p.ancho - 8, margen: true };
}

const acaba = (t) => /[.:;!?»)]$/.test(t.replace(/\*+$/, ''));
// Convierte las páginas en apartados con párrafos, fórmulas y figuras.
export function apartados(paginas, info) {
  const secs = [];
  let act = null, nivel1 = null, omitiendo = false, parr = null;
  const nueva = (titulo, nivel, n) => {
    act = { titulo: limpiarTitulo(titulo), nivel, padre: nivel === 2 ? nivel1 : null, pagina: n, paginaFin: n, parrafos: [], formulas: [], figuras: [] };
    if (nivel === 1) nivel1 = act.titulo;
    secs.push(act); parr = null;
  };
  for (const p of paginas) {
    for (const b of bloquesDePagina(p, info)) {
      if (b.tipo === 'titulo') {
        const t = b.texto.trim();
        if (OMITIR.test(t.replace(/^\d+(\.\d+)*\.?\s*/, '')) || t.length < 4) { omitiendo = true; parr = null; continue; }
        // Títulos enormes de portada de unidad: no son apartados.
        omitiendo = false;
        nueva(t, b.nivel, p.n);
      } else if (b.tipo === 'linea') {
        if (omitiendo) continue;
        if (!act) nueva('', 2, p.n);
        act.paginaFin = p.n;
        const empieza = /^(\d+[.)]|[a-z]\)|[•·▪–—-])\s/.test(b.plano);
        const siguePendiente = parr && !parr.cerrado && !acaba(parr.texto) && /^(\*\*)?[a-záéíóúñ(]/.test(b.texto);
        if (siguePendiente && !empieza) {
          const corte = /-(\*\*)?$/.test(parr.texto);
          parr.texto = corte ? parr.texto.replace(/-(\*\*)?$/, '$1') + b.texto.replace(/^\*\*/, '') : `${parr.texto} ${b.texto}`;
          parr.yUlt = b.y; parr.pagina = p.n;
          if (b.cierra && acaba(b.plano)) parr.cerrado = true;
          continue;
        }
        if (!parr || empieza || parr.cerrado) {
          // Un párrafo sin punto final continúa en la siguiente columna o página.
          parr = { texto: b.texto, yUlt: b.y, h: b.h, cerrado: false, pagina: p.n };
          act.parrafos.push(parr);
        } else if (parr.pagina !== p.n || parr.yUlt - b.y < b.h * 1.5) {
          const corte = /-(\*\*)?$/.test(parr.texto) && /^(\*\*)?[a-záéíóúñ]/.test(b.texto);
          parr.texto = corte ? parr.texto.replace(/-(\*\*)?$/, '$1') + b.texto.replace(/^\*\*/, '') : `${parr.texto} ${b.texto}`;
          parr.yUlt = b.y; parr.pagina = p.n;
        } else {
          parr = { texto: b.texto, yUlt: b.y, h: b.h, cerrado: false, pagina: p.n };
          act.parrafos.push(parr);
        }
        if (b.cierra && acaba(b.plano)) parr.cerrado = true;
      } else if (b.tipo === 'formula') {
        if (omitiendo || !act) continue;
        act.formulas.push({ pagina: p.n, texto: b.texto, x0: b.x0, x1: b.x1, y0: b.y0, y1: b.y1 });
        if (parr) parr.cerrado = true;
      } else if (b.tipo === 'figura') {
        if (omitiendo || !act) continue;
        act.figuras.push({ pagina: p.n, pie: b.pie, x0: b.x0, x1: b.x1, y0: b.y0, y1: b.y1, tabla: b.tabla });
      }
    }
  }
  for (const s of secs) s.parrafos = s.parrafos.map((q) => ({ texto: q.texto.replace(/\*\*\s*\*\*/g, ' ').replace(/\s+/g, ' ').trim(), pagina: q.pagina })).filter((q) => q.texto.length > 15);
  return secs.filter((s) => s.parrafos.length || s.figuras.length || s.formulas.length);
}
const limpiarTitulo = (t) => t.replace(/\s+/g, ' ').trim();

const ABREV = /(?:\b(?:fig|figs|pág|págs|núm|aprox|etc|ej|p\.ej|art|sr|sra|dr|ud|uds|máx|mín|cap|vol|tab)\.|\b[A-Z]\.|\d\.)$/i;
// Parte un párrafo en frases sin romper abreviaturas ni números.
export function frases(texto) {
  const salida = []; let act = '';
  for (const t of texto.split(/(?<=[.!?:;])\s+/)) {
    act += (act ? ' ' : '') + t;
    if (ABREV.test(act.replace(/\*+$/, '')) && !/\d\.\s*$/.test(act.slice(-3)) ) continue;
    salida.push(act); act = '';
  }
  if (act) salida.push(act);
  return salida.map((s) => s.trim()).filter((s) => s.replace(/\*/g, '').length > 12);
}
export const sinMarcas = (s) => s.replace(/\*\*/g, '');
export const terminos = (s) => [...s.matchAll(/\*\*(.+?)\*\*(?![\p{L}-])/gu)].map((m) => m[1].replace(/^[•·▪–—-]\s*/, '').replace(/-$/, '').trim()).filter((t) => t.length > 3 && t.split(' ').length <= 5);
