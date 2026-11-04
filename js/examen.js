// Genera exámenes a partir de los apartados de un PDF o del temario. No inventa contenido:
// cada pregunta sale de una frase concreta, y su corrección indica de dónde.
import { frases, sinMarcas, terminos } from './lectura.js';
import { palabras } from './busqueda.js';

const NO_AUTONOMA = /^(as[ií]|esto|estos|estas|esta|este|dicho|dicha|ello|ahora|por ello|por eso|por tanto|sin embargo|no obstante|adem[aá]s|tambi[eé]n|en este caso|de este modo|de esta forma|en la figura|como se|la figura|para ello|por otro lado|por otra parte|en cambio|es decir|es la|es el|son los|son las|su |sus |se |cuando esto|si se|a continuaci[oó]n|en estos|estas? )\b/i;
const NUM = /^\d+(\.\d+)*\.?\s+/;
// Una frase autónoma empieza nombrando aquello de lo que habla.
const INICIO_OK = /^(El|La|Los|Las|Un|Una|Unos|Unas|Cuando|Se denomina|Se llama|Se conoce|Para|Cada|Todo|Toda|Según|Mediante|Al |En (el|la|los|las|un|una) )/;
// Sustantivos técnicos: así no aparecen verbos ni adjetivos sueltos como opciones.
const SUSTANTIVO = /(ci[oó]n|si[oó]n|dad|dor|dora|tor|tora|ente|encia|ancia|aje|ismo|ura|miento|mento|cidad|ctor|bina|bobinas?|cleo|chapa|hierro|cobre|espira|espiras|flujo|campo|fase|fases|devanados?|carretes?|tensi[oó]n)(es|s)?$/i;
const UNIDADES = ['voltio (V)', 'amperio (A)', 'ohmio (Ω)', 'vatio (W)', 'tesla (T)', 'weber (Wb)', 'henrio (H)', 'faradio (F)', 'hercio (Hz)', 'julio (J)', 'voltamperio (VA)', 'amperio-vuelta (Av)'];
const barajar = (a) => { const v = [...a]; for (let i = v.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [v[i], v[j]] = [v[j], v[i]]; } return v; };
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const limpio = (s) => s.replace(/\s+/g, ' ').replace(/[.:;,]+$/, '').trim();

function frasesUtiles(secs) {
  const r = [];
  for (const sec of secs) {
    for (const p of sec.parrafos) {
      for (const f of frases(p.texto)) {
        const plano = sinMarcas(f).replace(/^[•·▪–—-]\s*/, '');
        if (plano.length < 45 || plano.length > 260 || !INICIO_OK.test(plano) || NO_AUTONOMA.test(plano) || !/\.$/.test(plano)) continue;
        if (/figura|tabla|siguiente|anterior|mostrad|observa|dich[oa]s?\b|\best[eao]s?\b|\bcaso \d|\bpaso \d|ejemplo/i.test(plano)) continue;
        // Paréntesis sin cerrar o columnas mezcladas: la frase no es fiable.
        if ((plano.match(/\(/g)?.length ?? 0) !== (plano.match(/\)/g)?.length ?? 0)) continue;
        r.push({ marcado: f, plano, sec, pagina: p.pagina });
      }
    }
  }
  return r;
}
const COMUNES = new Set('aquellos aquellas siguiente siguientes tambien también ademas además mientras mediante través cuando entonces siempre durante permite permiten utiliza utilizan necesario necesaria realizar realiza dispone disponen encuentra encuentran diferentes diferente general ejemplo cualquier valores cantidad función funcion momento posible puede pueden debido debe deben manera partir misma mismas mismos tienen número numero'.split(' '));
const TERMINO_MALO = /\d|^(ejemplo|medidas|pasos?|casos?|c[aá]lculo|proceso|forma|manera|objetivo|resultado|valor|siguiente|primer|segund|funci[oó]n|misi[oó]n|raz[oó]n|ventaja|inconveniente)\b|\b(tienen?|hace|puede|debe|realiza)\b/i;
const DEF_MALA = /^(similar|diferente|igual|decir|mism[oa]s?|necesari|important|posible|f[aá]cil|muy|m[aá]s|menos)|no obstante|como ya sabes|como se ha|\bcaso \d|\bpaso \d/i;
function candidatas(frs) {
  const defs = [], medidas = [], huecos = [];
  const vistos = new Set();
  for (const f of frs) {
    const destacados = terminos(f.marcado).map((t) => limpio(t).toLowerCase());
    const titulo = f.sec.titulo.replace(NUM, '').toLowerCase();
    const aval = (t) => destacados.some((d) => d.includes(t.toLowerCase()) || t.toLowerCase().includes(d)) || titulo.includes(t.toLowerCase());
    let m = f.plano.match(/^Se (?:denomina|llama|conoce como) (.{3,45}?) a (.{25,})$/);
    let verbo = 'es';
    if (!m) { const n = f.plano.match(/^(?:El|La|Los|Las|Un|Una) ([^,;:]{3,40}?) (es|son|consiste en|se define como) (.{25,})$/); if (n) { m = [n[0], n[1], n[3]]; verbo = n[2] === 'son' ? 'son' : 'es'; } }
    if (m) {
      const termino = limpio(m[1]); const def = limpio(m[2]);
      const clave = termino.toLowerCase();
      if (termino.split(' ').length <= 5 && !TERMINO_MALO.test(termino) && !DEF_MALA.test(def) && /^(un|una|el|la|los|las|aquel|aquell|unos|unas|lo)\b/i.test(def) && aval(termino) && def.length < 190 && !vistos.has(clave)) {
        vistos.add(clave); defs.push({ termino, def, verbo, f });
      }
    }
    m = f.plano.match(/^(?:El|La|Los|Las) ([^,;:]{4,50}?) (?:se mide en|tiene como unidad|cuya unidad es|se expresa en)(?: el| la| los)? ([^,.;]{3,40})/);
    if (m) medidas.push({ magnitud: limpio(m[1]), unidad: limpio(m[2]), f });
    for (const t of terminos(f.marcado)) {
      if (t.length > 40 || t.length < 5 || /^[A-Z]{1,2}$/.test(t) || TERMINO_MALO.test(t) || /(ar|er|ir)$/.test(t)) continue;
      if (f.plano.split(t).length !== 2 || f.plano.indexOf(t) < 3) continue;
      huecos.push({ termino: limpio(t), f });
    }
  }
  // Respaldo: palabras técnicas frecuentes del propio contenido.
  const frec = new Map();
  for (const f of frs) for (const w of f.plano.match(/[\p{L}]{7,}/gu) ?? []) { const k = w.toLowerCase(); if (!COMUNES.has(k)) frec.set(k, (frec.get(k) ?? 0) + 1); }
  // La palabra que da nombre al tema es demasiado obvia como respuesta.
  const titulos = new Set(frs.flatMap((f) => (f.sec.tema ?? '').toLowerCase().match(/[\p{L}]{5,}/gu) ?? []));
  const totalF = Math.max(frs.length, 1);
  const tecnicas = [...frec].filter(([w, n]) => n >= 3 && n < totalF * 0.3 && SUSTANTIVO.test(w) && ![...titulos].some((t) => w.startsWith(t.slice(0, -2)))).sort((a, b) => b[1] - a[1]).slice(0, 80).map(([w]) => w);
  const clave = new Set(tecnicas);
  const huecos2 = [];
  for (const f of frs) {
    const cand = (f.plano.match(/[\p{L}]{7,}/gu) ?? []).filter((w, i) => i > 1 && clave.has(w.toLowerCase()) && f.plano.split(w).length === 2 && !/(dich|ese|esa|este|esta)\s+$/i.test(f.plano.slice(0, f.plano.indexOf(w))));
    if (cand.length) huecos2.push({ termino: cand.sort((a, b) => tecnicas.indexOf(a.toLowerCase()) - tecnicas.indexOf(b.toLowerCase()))[0], f });
  }
  const poolDefs = frs.map((f) => f.plano.match(/ (?:es|son|consiste en|se define como) ((?:un|una|el|la|los|las)\s(?!que\b|mism|dato\b|nivel\b|caso\b).{25,170})$/i)?.[1]).filter((d) => d && !DEF_MALA.test(d) && (d.match(/\(/g)?.length ?? 0) === (d.match(/\)/g)?.length ?? 0)).map(limpio);
  return { defs, medidas, huecos, huecos2, tecnicas, poolDefs };
}
function terminosDe(secs) {
  const c = new Map();
  for (const s of secs) for (const p of s.parrafos) for (const t of terminos(p.texto)) { const k = limpio(t); if (k.length > 3 && k.length < 40 && !TERMINO_MALO.test(k) && !/[a-záéíóúñ]+(ar|er|ir)$/.test(k) && /[A-Za-zÁÉÍÓÚáéíóú]{4}/.test(k)) c.set(k, (c.get(k) ?? 0) + 1); }
  return [...c.keys()];
}
function opciones(buena, malas, n) {
  const norm = (s) => s.toLowerCase();
  const vistas = new Set([norm(buena)]); const sel = [];
  for (const o of malas) { if (sel.length >= n - 1) break; if (o && !vistas.has(norm(o))) { vistas.add(norm(o)); sel.push(o); } }
  if (sel.length < n - 1) return null;
  const v = barajar([buena, ...sel]);
  return { opciones: v.map(cap), correcta: v.indexOf(buena) };
}

export function crearTest(secs, { cuantas = 10, nOpciones = 4 } = {}) {
  const frs = frasesUtiles(secs);
  const { defs, medidas, huecos, huecos2, tecnicas, poolDefs } = candidatas(frs);
  const todos = terminosDe(secs);
  const preguntas = [];
  const usadas = new Set();
  const expl = (f) => ({ explicacion: f.plano, pagina: f.pagina, apartado: f.sec.titulo.replace(NUM, '') });
  const dePorDefinicion = (d) => {
    const inicio = (s) => s.split(' ')[0].toLowerCase();
    const malas = barajar([...new Set([...defs.filter((x) => x.termino !== d.termino).map((x) => x.def), ...poolDefs])].filter((x) => x !== d.def)).sort((a, b) => (inicio(b) === inicio(d.def)) - (inicio(a) === inicio(d.def)));
    const o = opciones(d.def, malas, nOpciones); if (!o) return null;
    return { enunciado: `${d.verbo === 'son' ? '¿Qué son' : '¿Qué es'} ${d.termino.charAt(0).toLowerCase() + d.termino.slice(1)}?`, ...o, ...expl(d.f) };
  };
  const deMedida = (d) => {
    const propias = medidas.filter((x) => x.unidad !== d.unidad).map((x) => x.unidad);
    const o = opciones(d.unidad, barajar([...propias, ...UNIDADES]), nOpciones); if (!o) return null;
    return { enunciado: `¿En qué unidad se expresa ${d.magnitud.toLowerCase().startsWith('la') ? '' : 'la magnitud '}«${d.magnitud}»?`, ...o, ...expl(d.f) };
  };
  const deHueco = (d) => {
    const parecidas = barajar(todos.filter((t) => t !== d.termino && !t.toLowerCase().includes(d.termino.toLowerCase()) && !d.termino.toLowerCase().includes(t.toLowerCase())));
    const palabrasT = d.termino.split(' ').length;
    parecidas.sort((a, b) => Math.abs(a.split(' ').length - palabrasT) - Math.abs(b.split(' ').length - palabrasT));
    const o = opciones(d.termino, parecidas, nOpciones); if (!o) return null;
    return { enunciado: `Completa la frase: «${d.f.plano.replace(d.termino, '_____')}»`, ...o, ...expl(d.f) };
  };
  const deHueco2 = (d) => {
    const o = opciones(d.termino.toLowerCase(), barajar(tecnicas.filter((t) => t !== d.termino.toLowerCase() && !t.startsWith(d.termino.toLowerCase().slice(0, 5)))), nOpciones); if (!o) return null;
    return { enunciado: `Completa la frase: «${d.f.plano.replace(d.termino, '_____')}»`, ...o, ...expl(d.f) };
  };
  // Se reparten las preguntas por todo el contenido, no solo por el principio.
  const porSeccion = new Map();
  const meter = (c, fn, peso) => { const k = c.f.sec.titulo; if (!porSeccion.has(k)) porSeccion.set(k, []); porSeccion.get(k).push({ c, fn, peso }); };
  defs.forEach((c) => meter(c, dePorDefinicion, 3)); medidas.forEach((c) => meter(c, deMedida, 2)); huecos.forEach((c) => meter(c, deHueco, 1)); huecos2.forEach((c) => meter(c, deHueco2, 0));
  const colas = [...porSeccion.values()].map((v) => barajar(v).sort((a, b) => b.peso - a.peso));
  const orden = barajar(colas);
  let quedan = true;
  while (preguntas.length < cuantas && quedan) {
    quedan = false;
    for (const cola of orden) {
      if (preguntas.length >= cuantas) break;
      while (cola.length) {
        const it = cola.shift();
        if (usadas.has(it.c.f.plano)) continue;
        const q = it.fn(it.c);
        if (q) { usadas.add(it.c.f.plano); preguntas.push({ tipo: 'test', ...q }); quedan = true; break; }
      }
    }
  }
  return barajar(preguntas);
}

const VACIAS_EX = new Set('aquella aquellos aquellas cuando desde donde entre hacia hasta mientras sobre tiene tienen tanto puede pueden debe deben siempre siguiente manera forma mayor menor otros otras otro otra este esta estos estas dicha dicho mismo misma mismas mismos parte partes través además también según'.split(' '));
function enunciadoDe(s) {
  const lim = s.titulo.replace(NUM, '').replace(/\s*\(continuaci[oó]n\)$/, '');
  const padre = s.padre?.replace(NUM, '');
  const texto = /^(por|de|en|para|con|seg[uú]n)\s/i.test(lim) && padre ? `${padre}: ${lim}` : lim;
  if (/^(tipos|clasificaci[oó]n|partes|elementos|materiales|herramientas|instrumentos)\b/i.test(texto)) return `Describe este punto: ${texto}.`;
  if (/^(c[aá]lculo|dise[nñ]o|proceso|ensayo)/i.test(texto)) return `Explica paso a paso: ${texto}.`;
  return `Explica este punto: ${texto}.`;
}
export function crearDesarrollo(secs, { cuantas = 5 } = {}) {
  const buenas = secs.filter((s) => s.parrafos.map((p) => p.texto).join(' ').length > 250 && s.titulo.length > 3);
  // Reparto uniforme por todo el contenido.
  const orden = barajar(buenas).slice(0, Math.min(buenas.length, Math.max(cuantas * 4, cuantas))).sort((a, b) => a.pagina - b.pagina);
  const paso = Math.max(1, orden.length / cuantas);
  const sel = Array.from({ length: Math.min(cuantas, orden.length) }, (_, i) => orden[Math.floor(i * paso)]);
  return sel.map((s) => {
    const texto = s.parrafos.map((p) => p.texto).join(' ');
    const destacados = [...new Set(terminos(texto).map(limpio))].filter((t) => !TERMINO_MALO.test(t));
    const frec = {};
    (sinMarcas(texto).match(/[\p{L}]{6,}/gu) ?? []).forEach((w) => { const k = w.toLowerCase(); if (!VACIAS_EX.has(k)) frec[k] = (frec[k] ?? 0) + 1; });
    const comunes = Object.entries(frec).sort((a, b) => b[1] - a[1]).map(([p]) => p);
    return {
      tipo: 'desarrollo', enunciado: enunciadoDe(s), respuesta: s.parrafos.map((p) => sinMarcas(p.texto)).join('\n\n').slice(0, 2400),
      claves: [...new Set([...destacados, ...comunes])].slice(0, 8), pagina: s.pagina, apartado: s.titulo.replace(NUM, ''), figura: s.figuras[0] ?? null,
    };
  });
}
// Corrección orientativa: mira qué ideas clave aparecen en la respuesta.
export function corregirDesarrollo(q, texto) {
  const t = palabras(texto).map((p) => p.slice(0, 6));
  const estan = q.claves.filter((c) => palabras(c).every((w) => t.includes(w.slice(0, 6))));
  return { estan, faltan: q.claves.filter((c) => !estan.includes(c)), nota: q.claves.length ? Math.round((estan.length / q.claves.length) * 100) / 10 : null };
}
// Convierte fichas del temario en apartados para poder examinar sin PDF.
export const apartadosDeFichas = (fichas) => fichas.map((f) => ({
  titulo: f.titulo, nivel: 2, pagina: 0, paginaFin: 0, figuras: [], formulas: [],
  parrafos: [f.resumen, ...f.puntos].map((t) => ({ texto: resaltarClaves(t, f), pagina: 0 })),
}));
function resaltarClaves(t, f) {
  const palabrasClave = f.claves.split(' ').filter((p) => p.length > 5);
  let hecho = false;
  return t.replace(/[\p{L}-]{6,}/gu, (w) => {
    const n = w.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    if (!hecho && palabrasClave.includes(n)) { hecho = true; return `**${w}**`; }
    return w;
  });
}
