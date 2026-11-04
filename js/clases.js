// Apartado de presentaciones: formulario, generación y clases guardadas.
import { h, ir } from './app.js';
import { todos, guardar, uid } from './db.js';
import { apartadosDe, recortar, portadaDe } from './pdf.js';
import { desdeApartados, desdeTemario, desdeIA, fichasDe } from './clase.js';
import { delBanco, guardarBlob, urlFoto, internetActivo, fotoInternet } from './fotos.js';
import { BANCO } from './banco.js';
import { ia } from './ia.js';
import { TEMAS } from './visor.js';
import { montarSelector, estadoPdf } from './selector.js';

const conFoto = new Set(['portada', 'foto', 'fotoD', 'cierre', 'separador']);

export async function vistaClases(raiz) {
  raiz.innerHTML = `<section class="seccion" data-hilo="azul">
    <header class="cabeza"><h1>Clases</h1><p>Sube tu PDF y elige el tema. Te monto la clase con sus propias figuras.</p></header>
    <form class="form-clase" data-form>
      <div data-selector></div>
      <div class="fila-op">
        <div><label for="det">Información</label><select id="det" class="campo"><option value="breve">Resumida</option><option value="normal" selected>Normal</option><option value="completa">Completa: todo el texto</option></select></div>
        <div><label for="t">Colores</label><select id="t" class="campo">${Object.entries(TEMAS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
      </div>
      <label class="check" data-ia-op hidden><input type="checkbox" id="conia"> Reescribir con la IA local. Es más lento y puede cambiar matices; lo que invente cifras se descarta.</label>
      <button class="btn btn-accion btn-grande" data-crear>Crear la presentación</button>
      <p class="error" data-err role="alert" hidden></p>
    </form>
    <div class="progreso" data-prog hidden><p data-prog-txt></p><div class="barra"><span data-prog-b></span></div><button class="btn" type="button" data-cancel>Cancelar</button></div>
    <section class="guardadas"><h2>Tus clases</h2><div class="lista-clases" data-lista></div></section>
  </section>`;
  const q = (s) => raiz.querySelector(s);
  const selector = montarSelector(q('[data-selector]'));
  q('[data-ia-op]').hidden = !ia.lista;
  q('[data-form]').onsubmit = (e) => { e.preventDefault(); crear(raiz, selector); };
  pintarLista(raiz);
}
async function pintarLista(raiz) {
  const cont = raiz.querySelector('[data-lista]'); if (!cont) return;
  const cs = (await todos('clases')).sort((a, b) => b.creada - a.creada);
  if (!cs.length) { cont.innerHTML = '<p class="vacio">Aún no hay ninguna. Sube un PDF o escribe «motor asíncrono» para crear la primera.</p>'; return; }
  cont.innerHTML = cs.map((c) => `<a class="clase-item" href="#clase/${c.id}"><span class="clase-foto"><img alt="" data-c="${c.id}"></span><strong>${h(c.titulo)}</strong><span>${c.slides.length} diapositivas</span></a>`).join('');
  for (const c of cs) { const im = cont.querySelector(`[data-c="${c.id}"]`); const f = c.slides.find((s) => s.foto)?.foto ?? c.slides.find((s) => s.figuras?.length)?.figuras[0]; if (im && f) im.src = await urlFoto(f); }
}
const sinNumero = (t) => t.replace(/^\d+[.)]?\s*/, '');
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);

async function crear(raiz, selector) {
  const q = (s) => raiz.querySelector(s);
  const err = q('[data-err]'); err.hidden = true;
  const fallo = (m) => { err.textContent = m; err.hidden = false; };
  const { texto, pdf, sel } = selector.obtener();
  if (!pdf && texto.length < 3) return fallo('Elige un PDF o escribe qué entra.');
  if (pdf && !sel.paginas.length) return fallo(`${sel.como}.`);
  const detalle = q('#det').value; const tema = q('#t').value; const usarIA = q('#conia')?.checked && ia.lista;
  let cancelado = false;
  const prog = q('[data-prog]'); const form = q('[data-form]');
  form.hidden = true; prog.hidden = false;
  q('[data-cancel]').onclick = () => { cancelado = true; ia.parar(); };
  const avance = (f, t) => { q('[data-prog-txt]').textContent = t; q('[data-prog-b]').style.transform = `scaleX(${f})`; };
  const pausa = () => new Promise((r) => setTimeout(r));
  try {
    let slides, titulo, aviso = '';
    if (pdf) {
      avance(0.03, `Leyendo ${sel.como}…`); await pausa();
      const secs = apartadosDe(pdf, sel);
      if (!secs.length) throw new Error('Esas páginas no tienen texto que se pueda leer. Prueba con otras.');
      titulo = sel.todo ? cap(estadoPdf.nombre) : sel.temas?.length === 1 ? sinNumero(sel.temas[0].titulo) : sel.temas?.length ? `${sel.temas.length} temas de ${cap(estadoPdf.nombre)}` : cap(texto.replace(/^(p[aá]g\w*\.?)\s*/i, 'Páginas ').slice(0, 60)) || cap(estadoPdf.nombre);
      const subtitulo = sel.temas?.length === 1 ? cap(estadoPdf.nombre) : `Páginas ${sel.paginas[0]} a ${sel.paginas[sel.paginas.length - 1]} del PDF`;
      const r = await desdeApartados(secs, titulo, { detalle, usarIA, subtitulo, cancelada: () => cancelado, alAvance: (f, t) => avance(0.05 + f * 0.25, usarIA ? `La IA está reescribiendo: ${t}` : `Ordenando: ${t}`) });
      slides = r.slides;
      aviso = usarIA ? `Reescrita con la IA en ${r.conIA} apartados: revisa los datos. Abajo tienes el texto original de cada apartado.` : 'Las frases salen tal cual de tu PDF. Abajo tienes el texto completo de cada apartado.';
      await recortarFiguras(pdf, slides, (f, t) => avance(0.3 + f * 0.62, t), () => cancelado);
      const portada = slides[0];
      const n = sel.todo ? 1 : sel.temas?.[0]?.desde;
      if (n) { const b = await portadaDe(pdf, n).catch(() => null); if (b) portada.foto = await guardarBlob(b, `Página ${n} de tu PDF`); }
    } else {
      const fichas = fichasDe(texto);
      const c = cap(texto);
      titulo = fichas.length > 2 ? `${fichas[0].titulo} y ${fichas.length - 1} temas más` : c.length <= 48 ? c : fichas[0]?.titulo ?? `${c.slice(0, 45)}…`;
      if (fichas.length) slides = desdeTemario(fichas, titulo);
      else if (ia.lista) {
        avance(0.3, 'La IA está escribiendo el guion. Puede tardar un par de minutos…');
        slides = await desdeIA(texto); aviso = 'Este tema no está en el temario, así que lo ha escrito la IA. Compruébalo con tus apuntes.';
      } else throw new Error('Ese tema no está en el temario. Sube el PDF, o enciende la IA en Dudas e inténtalo otra vez.');
    }
    if (cancelado) throw new DOMException('cancelado', 'AbortError');
    avance(0.95, 'Colocando las fotos…');
    await ponerFotos(slides);
    const clase = { id: uid(), titulo, tema, slides, creada: Date.now(), aviso };
    await guardar('clases', clase);
    ir(`#clase/${clase.id}`);
  } catch (e) {
    prog.hidden = true; form.hidden = false;
    if (e.name !== 'AbortError') fallo(e.message || 'No se ha podido crear la presentación.');
  }
}
// Recorta del PDF cada figura y fórmula, y las guarda en el dispositivo.
async function recortarFiguras(pdf, slides, avance, cancelada) {
  const total = slides.reduce((a, s) => a + (s.figuras?.length ?? 0) + (s.ecuaciones?.length ?? 0), 0);
  let hechas = 0;
  for (const s of slides) {
    for (const campo of ['figuras', 'ecuaciones']) {
      if (!s[campo]?.length) continue;
      const salida = [];
      for (const z of s[campo]) {
        if (cancelada()) throw new DOMException('cancelado', 'AbortError');
        hechas++; avance(hechas / Math.max(total, 1), `Recortando figuras del PDF: ${hechas} de ${total}`);
        try {
          const r = await recortar(pdf, z);
          if (r) { const g = await guardarBlob(r.blob, ''); salida.push({ ...g, pie: z.pie ?? '', texto: z.texto ?? '', ancho: r.ancho, alto: r.alto }); }
        } catch {}
      }
      s[campo] = salida;
    }
    // Una diapositiva sin figuras válidas pasa a ser de solo texto.
    if ((s.tipo === 'figura' || s.tipo === 'figuraD') && !s.figuras.length) s.tipo = s.ecuaciones?.length ? 'ecuaciones' : 'apartado';
    if (s.tipo === 'galeria' && !s.figuras.length) s.vacia = true;
  }
  for (let i = slides.length - 1; i >= 0; i--) if (slides[i].vacia) slides.splice(i, 1);
}
async function ponerFotos(slides) {
  const usadas = new Set(); let enRed = 0;
  for (const s of slides) {
    if (!conFoto.has(s.tipo) || s.foto) continue;
    const et = s.etiquetas?.length ? s.etiquetas : ['cuadro', 'armario'];
    const hay = BANCO.some((f) => !usadas.has(f.src) && f.tags.some((t) => et.includes(t)));
    if (!hay && internetActivo() && enRed < 3) {
      enRed++;
      try { const f = await Promise.race([fotoInternet(et), new Promise((_, m) => setTimeout(() => m(new Error('lento')), 5000))]); if (f) { s.foto = f; continue; } } catch {}
    }
    s.foto = delBanco(et, usadas);
  }
}
