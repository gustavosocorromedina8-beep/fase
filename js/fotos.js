// Elige fotos del banco incluido, del PDF, de la galería o de internet si hay conexión.
import { BANCO } from './banco.js';
import { guardar, leer, uid, ajustes } from './db.js';
const REGLAS = [
  [/magnetot|diferencial|pia\b|interruptor autom|protecci[oó]n|cuadro|iga\b/i, ['magnetotermico', 'cuadro']],
  [/contactor|rel[eé]|marcha|paro|enclavamiento/i, ['contactor', 'armario']],
  [/aut[oó]mata|plc|logo|ladder/i, ['plc', 'armario']],
  [/motor|arranque|estator|rotor|giro/i, ['motor']],
  [/transformador|primario|secundario|subestaci/i, ['transformador', 'torre']],
  [/tierra|pica|electrodo|neutro/i, ['tierra', 'cables']],
  [/multímetro|multimetro|medida|medir|volt[ií]metro|amper[ií]metro|mult[ií]metro/i, ['multimetro', 'pinza']],
  [/pinza/i, ['pinza']], [/osciloscop|senoidal|onda|alterna/i, ['osciloscopio', 'torre']],
  [/diodo|transistor|electr[oó]nic|semiconductor|condensador|resistencia/i, ['componentes', 'pcb']],
  [/\bled\b|l[aá]mpara|alumbrado|iluminaci|bombilla/i, ['led', 'bombilla']],
  [/enchufe|toma de|vivienda|baño/i, ['enchufe', 'cuadro']],
  [/cable|conductor|secci[oó]n|cobre|ca[ií]da de tensi/i, ['cables', 'tubo']],
  [/tubo|canalizaci|canaleta|bandeja/i, ['tubo', 'cables']],
  [/seguridad|reglas|riesgo|electricista|trabaj/i, ['electricista', 'armario']],
  [/trif[aá]sic|l[ií]nea|red el[eé]ctrica|transporte|distribuci/i, ['torre', 'transformador']],
  [/solar|fotovolt/i, ['solar']], [/soldadura|soldar/i, ['soldar', 'pcb']],
];
export function etiquetasDe(texto) {
  const r = []; for (const [re, t] of REGLAS) if (re.test(texto)) r.push(...t);
  return r.length ? [...new Set(r)] : ['cuadro', 'armario', 'electricista'];
}
export function delBanco(etiquetas, usadas = new Set()) {
  for (const e of etiquetas) {
    const c = BANCO.filter((f) => f.tags.includes(e));
    const libre = c.find((f) => !usadas.has(f.src));
    if (libre) { usadas.add(libre.src); return { src: libre.src, credito: libre.credito }; }
  }
  const libre = BANCO.find((f) => !usadas.has(f.src)) ?? BANCO[0];
  if (!libre) return null;
  usadas.add(libre.src); return { src: libre.src, credito: libre.credito };
}
export async function guardarBlob(blob, credito = '') {
  const id = uid(); await guardar('fotos', { id, blob, credito }); return { id, credito };
}
const urls = new Map();
export async function urlFoto(foto) {
  if (!foto) return '';
  if (foto.src) return foto.src;
  if (urls.has(foto.id)) return urls.get(foto.id);
  const r = await leer('fotos', foto.id); if (!r) return '';
  const u = URL.createObjectURL(r.blob); urls.set(foto.id, u); return u;
}
export const internetActivo = () => navigator.onLine && ajustes.leer('fotosInternet', true);
const INGLES = { magnetotermico: 'circuit breaker', cuadro: 'electrical panel', contactor: 'contactor relay', armario: 'control cabinet', plc: 'programmable logic controller', motor: 'electric motor', transformador: 'transformer substation', torre: 'power lines', tierra: 'grounding rod', cables: 'electrical cables', multimetro: 'multimeter', pinza: 'clamp meter', osciloscopio: 'oscilloscope', componentes: 'electronic components', pcb: 'circuit board', led: 'LED lamp', bombilla: 'light bulb', enchufe: 'socket outlet', tubo: 'electrical conduit', electricista: 'electrician', solar: 'solar panels', soldar: 'soldering' };
// Solo envía a Wikimedia las palabras de búsqueda, nunca el contenido del PDF.
export async function buscarInternet(consulta, n = 12) {
  const u = 'https://commons.wikimedia.org/w/api.php?' + new URLSearchParams({ action: 'query', format: 'json', origin: '*', generator: 'search', gsrsearch: `${consulta} filetype:bitmap`, gsrnamespace: 6, gsrlimit: 24, prop: 'imageinfo', iiprop: 'url|size|extmetadata|mime', iiurlwidth: 1280 });
  const d = await (await fetch(u)).json();
  return Object.values(d.query?.pages ?? {}).sort((a, b) => (a.index ?? 0) - (b.index ?? 0)).map((p) => {
    const i = p.imageinfo?.[0]; const m = i?.extmetadata ?? {}; const lic = m.LicenseShortName?.value ?? '';
    if (!i || i.mime !== 'image/jpeg' || i.width < 900 || i.width < i.height || !/CC BY|CC0|public domain/i.test(lic) || /NC|ND/.test(lic)) return null;
    const autor = (m.Artist?.value ?? '').replace(/<[^>]+>/g, '').trim().slice(0, 60);
    return { url: i.thumburl, credito: `${autor || 'Autor en Wikimedia Commons'} · ${lic} · Wikimedia Commons`, pagina: i.descriptionurl };
  }).filter(Boolean).slice(0, n);
}
export async function fotoInternet(etiquetas) {
  const r = await buscarInternet(INGLES[etiquetas[0]] ?? etiquetas[0], 6);
  for (const f of r) {
    const b = await fetch(f.url).then((x) => (x.ok ? x.blob() : null)).catch(() => null);
    if (b) return guardarBlob(b, f.credito);
  }
  return null;
}
