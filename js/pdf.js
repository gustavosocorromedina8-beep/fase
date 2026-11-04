// Lectura local del PDF: el archivo nunca sale del dispositivo.
import * as pdfjs from '../vendor/pdf.min.mjs';
import { palabras } from './busqueda.js';
pdfjs.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdf.worker.min.mjs', import.meta.url).href;

export async function abrirPdf(archivo) {
  const doc = await pdfjs.getDocument({ data: await archivo.arrayBuffer(), isEvalSupported: false }).promise;
  const paginas = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const p = await doc.getPage(n);
    const c = await p.getTextContent();
    const lineas = new Map();
    for (const it of c.items) {
      if (!it.str?.trim()) continue;
      const y = Math.round(it.transform[5] / 3);
      const l = lineas.get(y) ?? { y, alto: 0, trozos: [] };
      l.alto = Math.max(l.alto, Math.abs(it.transform[3]) || it.height || 0);
      l.trozos.push({ x: it.transform[4], s: it.str });
      lineas.set(y, l);
    }
    const orden = [...lineas.values()].sort((a, b) => b.y - a.y).map((l) => ({
      alto: l.alto,
      texto: l.trozos.sort((a, b) => a.x - b.x).map((t) => t.s).join(' ').replace(/\s+/g, ' ').trim(),
    }));
    paginas.push({ n, lineas: orden, texto: orden.map((l) => l.texto).join('\n') });
    p.cleanup();
  }
  const conTexto = paginas.filter((p) => p.texto.length > 40).length;
  return { doc, paginas, total: doc.numPages, escaneado: conTexto < Math.max(1, doc.numPages * 0.2) };
}

// Admite: "páginas 12 a 18", "pág. 3-5, 9", "tema 3" o simplemente palabras clave.
export function elegirPaginas(pdf, peticion) {
  const t = (peticion || '').toLowerCase();
  const sel = new Set();
  const rangos = t.match(/p[aá]g(?:ina)?s?\.?\s*([\d\s,y\-–a]+)/);
  const soloNumeros = /^[\d\s,\-–]+$/.test(t.trim()) && t.trim();
  const trozo = rangos ? rangos[1] : soloNumeros;
  if (trozo) {
    for (const r of trozo.split(/,|\by\b/)) {
      const m = r.match(/(\d+)\s*(?:-|–|\ba\b)\s*(\d+)/);
      if (m) for (let i = +m[1]; i <= +m[2]; i++) sel.add(i);
      else if (/\d/.test(r)) sel.add(parseInt(r, 10));
    }
    const v = [...sel].filter((n) => n >= 1 && n <= pdf.total).sort((a, b) => a - b);
    if (v.length) return { paginas: v, como: `páginas ${resumir(v)}` };
  }
  const tema = t.match(/(tema|unidad|ud\.?|cap[ií]tulo|bloque)\s*(\d+)/);
  if (tema) {
    const raiz = tema[1].replace('.', '').slice(0, 3); const num = +tema[2];
    const re = (k) => new RegExp(`^\\s*${raiz}\\w*\\.?\\s*${k}\\b`, 'i');
    const ini = pdf.paginas.find((p) => p.lineas.slice(0, 6).some((l) => re(num).test(l.texto)));
    if (ini) {
      const fin = pdf.paginas.find((p) => p.n > ini.n && p.lineas.slice(0, 6).some((l) => re(num + 1).test(l.texto)));
      const v = []; for (let i = ini.n; i <= (fin ? fin.n - 1 : pdf.total); i++) v.push(i);
      return { paginas: v, como: `${tema[1]} ${num}, páginas ${resumir(v)}` };
    }
  }
  const claves = palabras(peticion || '');
  if (claves.length) {
    const puntuadas = pdf.paginas.map((p) => {
      const tx = palabras(p.texto).join(' ');
      return { n: p.n, s: claves.reduce((a, c) => a + (tx.match(new RegExp(c.slice(0, 6), 'g'))?.length ?? 0), 0) };
    }).filter((p) => p.s > 0).sort((a, b) => b.s - a.s).slice(0, 12).map((p) => p.n).sort((a, b) => a - b);
    if (puntuadas.length) return { paginas: puntuadas, como: `páginas sobre «${peticion.trim()}»: ${resumir(puntuadas)}` };
    return { paginas: [], como: `No he encontrado «${peticion.trim()}» en el PDF` };
  }
  const v = pdf.paginas.map((p) => p.n);
  return { paginas: v, como: 'todo el PDF' };
}
function resumir(v) {
  const r = []; let a = v[0], b = v[0];
  for (const n of v.slice(1).concat(Infinity)) { if (n === b + 1) b = n; else { r.push(a === b ? a : `${a}-${b}`); a = b = n; } }
  return r.join(', ');
}

// Saca las imágenes incrustadas de las páginas elegidas; ignora iconos y logotipos pequeños.
export async function imagenesDe(pdf, numeros, max = 16) {
  const fuera = [];
  for (const n of numeros) {
    if (fuera.length >= max) break;
    const p = await pdf.doc.getPage(n);
    const ops = await p.getOperatorList();
    for (let i = 0; i < ops.fnArray.length && fuera.length < max; i++) {
      if (ops.fnArray[i] !== pdfjs.OPS.paintImageXObject) continue;
      try {
        const nombre = ops.argsArray[i][0];
        const img = await new Promise((ok, mal) => {
          const obj = nombre.startsWith('g_') ? p.commonObjs : p.objs;
          const to = setTimeout(() => mal(new Error('tiempo')), 3000);
          obj.get(nombre, (v) => { clearTimeout(to); ok(v); });
        });
        if (!img || img.width < 300 || img.height < 200) continue;
        const c = new OffscreenCanvas(img.width, img.height); const x = c.getContext('2d');
        if (img.bitmap) x.drawImage(img.bitmap, 0, 0);
        else {
          const d = x.createImageData(img.width, img.height); const s = img.data;
          if (s.length === img.width * img.height * 4) d.data.set(s);
          else if (s.length === img.width * img.height * 3) for (let a = 0, b = 0; a < s.length; a += 3, b += 4) { d.data[b] = s[a]; d.data[b + 1] = s[a + 1]; d.data[b + 2] = s[a + 2]; d.data[b + 3] = 255; }
          else continue;
          x.putImageData(d, 0, 0);
        }
        fuera.push({ pagina: n, blob: await c.convertToBlob({ type: 'image/jpeg', quality: 0.85 }) });
      } catch {}
    }
    p.cleanup();
  }
  return fuera;
}
