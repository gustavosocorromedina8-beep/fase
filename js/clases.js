// Apartado de presentaciones: formulario, generación y clases guardadas.
import { h, ir, palanca, aviso } from './app.js';
import { todos, guardar, uid } from './db.js';
import { abrirPdf, elegirPaginas, imagenesDe } from './pdf.js';
import { secciones, desdeSecciones, desdeTemario, desdeIA, fichasDe } from './clase.js';
import { delBanco, guardarBlob, urlFoto, internetActivo, fotoInternet } from './fotos.js';
import { BANCO } from './banco.js';
import { ia } from './ia.js';
import { TEMAS } from './visor.js';

let pdfActual = null, nombrePdf = '';
const conFoto = new Set(['portada', 'foto', 'fotoD', 'cierre']);

export async function vistaClases(raiz) {
  raiz.innerHTML = `<section class="seccion" data-hilo="marron">
    <header class="cabeza"><h1>Clases</h1><p>Sube tu PDF o escribe qué entra. Te monto la presentación con fotos.</p></header>
    <form class="form-clase" data-form>
      <div class="zona-pdf" data-zona>
        <label class="btn btn-grande" for="pdf">Elegir PDF</label><input id="pdf" type="file" accept="application/pdf" class="oculto">
        <p data-pdf-info>${pdfActual ? h(`${nombrePdf}: ${pdfActual.total} páginas`) : 'Opcional. Tu PDF no sale de este dispositivo.'}</p>
      </div>
      <label for="que">¿Qué entra?</label>
      <textarea id="que" class="campo" rows="3" placeholder="Páginas 12 a 18, tema 3, o circuitos de una vivienda y diferenciales"></textarea>
      <div class="fila-op">
        <div><label for="n">Diapositivas</label><select id="n" class="campo">${[6, 8, 10, 14, 20].map((n) => `<option ${n === 10 ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
        <div><label for="t">Colores</label><select id="t" class="campo">${Object.entries(TEMAS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
      </div>
      <button class="btn btn-accion btn-grande" data-crear>Crear la presentación</button>
      <p class="error" data-err role="alert" hidden></p>
    </form>
    <div class="progreso" data-prog hidden><p data-prog-txt></p><div class="barra"><span data-prog-b></span></div><button class="btn" type="button" data-cancel>Cancelar</button></div>
    <section class="guardadas"><h2>Tus clases</h2><div class="lista-clases" data-lista></div></section>
  </section>`;
  const q = (s) => raiz.querySelector(s);
  q('#pdf').onchange = async (e) => {
    const a = e.target.files[0]; if (!a) return;
    q('[data-pdf-info]').textContent = 'Leyendo el PDF…';
    try {
      pdfActual = await abrirPdf(a); nombrePdf = a.name.replace(/\.pdf$/i, '');
      q('[data-pdf-info]').textContent = pdfActual.escaneado
        ? `${nombrePdf}: ${pdfActual.total} páginas. Parece escaneado y apenas tiene texto, así que no puedo leerlo. Escribe abajo qué entra para usar el temario.`
        : `${nombrePdf}: ${pdfActual.total} páginas.`;
      if (pdfActual.escaneado) pdfActual = null;
    } catch { pdfActual = null; q('[data-pdf-info]').textContent = 'No he podido abrir ese PDF. Puede estar dañado o tener contraseña.'; }
  };
  q('[data-form]').onsubmit = (e) => { e.preventDefault(); crear(raiz); };
  pintarLista(raiz);
}

async function pintarLista(raiz) {
  const cont = raiz.querySelector('[data-lista]'); if (!cont) return;
  const cs = (await todos('clases')).sort((a, b) => b.creada - a.creada);
  if (!cs.length) { cont.innerHTML = '<p class="vacio">Aún no hay ninguna. Prueba a escribir «motor asíncrono» y crea la primera.</p>'; return; }
  cont.innerHTML = cs.map((c) => `<a class="clase-item" href="#clase/${c.id}"><span class="clase-foto"><img alt="" data-c="${c.id}"></span><strong>${h(c.titulo)}</strong><span>${c.slides.length} diapositivas</span></a>`).join('');
  for (const c of cs) { const im = cont.querySelector(`[data-c="${c.id}"]`); if (im) im.src = await urlFoto(c.slides.find((s) => s.foto)?.foto); }
}

async function crear(raiz) {
  const q = (s) => raiz.querySelector(s);
  const peticion = q('#que').value.trim(); const err = q('[data-err]');
  const maxDiapos = +q('#n').value; const tema = q('#t').value;
  err.hidden = true;
  const fallo = (m) => { err.textContent = m; err.hidden = false; };
  if (!pdfActual && peticion.length < 3) return fallo('Elige un PDF o escribe qué entra.');
  let cancelado = false;
  const prog = q('[data-prog]'); const form = q('[data-form]');
  form.hidden = true; prog.hidden = false;
  q('[data-cancel]').onclick = () => { cancelado = true; ia.parar(); };
  const avance = (f, t) => { q('[data-prog-txt]').textContent = t; q('[data-prog-b]').style.transform = `scaleX(${f})`; };
  try {
    let slides, tituloClase, avisoIA = '', imgs = [];
    if (pdfActual) {
      const sel = elegirPaginas(pdfActual, peticion);
      if (!sel.paginas.length) throw new Error(`${sel.como}. Prueba con los números de página.`);
      avance(0.05, `Leyendo ${sel.como}…`);
      const secs = secciones(pdfActual, sel.paginas);
      if (!secs.length) throw new Error('Esas páginas no tienen texto que se pueda leer. Prueba con otras.');
      const generica = !peticion || /^\s*(p[aá]g|tema|unidad|ud\b|cap[ií]tulo|bloque)|^[\d\s,-]+$/i.test(peticion);
      const limpia = (secs.find((s) => s.titulo)?.titulo ?? nombrePdf).replace(/^(tema|unidad|ud\.?|cap[ií]tulo|bloque)\s*\d+\s*[.:–-]?\s*/i, '');
      tituloClase = generica ? limpia || nombrePdf : peticion.slice(0, 60);
      const r = await desdeSecciones(secs, tituloClase, { maxDiapos, cancelada: () => cancelado, alAvance: (f, t) => avance(0.1 + f * 0.75, ia.lista ? `La IA está redactando: ${t}` : `Resumiendo: ${t}`) });
      slides = r.slides;
      if (!ia.lista) avisoIA = 'Hecha sin IA, con frases extraídas de tu PDF. Enciende la IA en Dudas para que la redacte mejor.';
      else if (r.conIA < r.total) avisoIA = `La IA redactó ${r.conIA} de ${r.total} apartados; el resto son frases extraídas de tu PDF.`;
      else avisoIA = 'Redactada por la IA local a partir de tu PDF. Revisa los datos antes de exponerla.';
      avance(0.88, 'Sacando las imágenes del PDF…');
      imgs = await imagenesDe(pdfActual, sel.paginas).catch(() => []);
    } else {
      const fichas = fichasDe(peticion);
      const cap = peticion[0].toUpperCase() + peticion.slice(1);
      tituloClase = fichas.length > 2 ? `${fichas[0].titulo} y ${fichas.length - 1} temas más` : cap.length <= 48 ? cap : fichas[0]?.titulo ?? `${cap.slice(0, 45)}…`;
      if (fichas.length) slides = desdeTemario(fichas, tituloClase);
      else if (ia.lista) {
        avance(0.3, 'La IA está escribiendo el guion. Puede tardar un par de minutos…');
        slides = await desdeIA(peticion); avisoIA = 'Este tema no está en el temario, así que lo ha escrito la IA. Compruébalo con tus apuntes.';
      } else throw new Error('Ese tema no está en el temario. Sube el PDF, o enciende la IA en Dudas e inténtalo otra vez.');
    }
    if (cancelado) throw new DOMException('cancelado', 'AbortError');
    avance(0.92, 'Colocando las fotos…');
    const fotosPdf = [];
    for (const im of imgs) fotosPdf.push({ ...(await guardarBlob(im.blob, 'Imagen de tu PDF')), pagina: im.pagina });
    await ponerFotos(slides, fotosPdf);
    const clase = { id: uid(), titulo: tituloClase, tema, slides, creada: Date.now(), aviso: avisoIA, fotosPdf };
    await guardar('clases', clase);
    ir(`#clase/${clase.id}`);
  } catch (e) {
    prog.hidden = true; form.hidden = false;
    if (e.name !== 'AbortError') fallo(e.message || 'No se ha podido crear la presentación.');
  }
}

async function ponerFotos(slides, fotosPdf) {
  const usadas = new Set(); const libres = [...fotosPdf];
  let enRed = 0;
  for (const s of slides) {
    if (!conFoto.has(s.tipo)) continue;
    const et = s.etiquetas?.length ? s.etiquetas : ['cuadro'];
    const k = libres.findIndex((f) => f.pagina === s.pagina);
    if (k >= 0) { s.foto = libres.splice(k, 1)[0]; continue; }
    const hayEtiqueta = BANCO.some((f) => !usadas.has(f.src) && f.tags.some((t) => et.includes(t)));
    // Internet solo aporta variedad cuando el banco se queda sin fotos de ese tema.
    if (!hayEtiqueta && internetActivo() && enRed < 3) {
      enRed++;
      try {
        const f = await Promise.race([fotoInternet(et), new Promise((_, m) => setTimeout(() => m(new Error("lento")), 5000))]);
        if (f) { s.foto = f; continue; }
      } catch {}
    }
    s.foto = libres.length && !hayEtiqueta ? libres.shift() : delBanco(et, usadas);
  }
}
