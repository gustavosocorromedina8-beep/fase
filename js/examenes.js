// Apartado de exámenes: crear desde PDF o temario, hacerlos y corregirlos.
import { h, ir, hoja, cerrarHoja } from './app.js';
import { todos, guardar, borrar, leer, uid } from './db.js';
import { montarSelector, estadoPdf } from './selector.js';
import { apartadosDe, recortar } from './pdf.js';
import { crearTest, crearDesarrollo, corregirDesarrollo, apartadosDeFichas } from './examen.js';
import { fichasDe } from './clase.js';
import { guardarBlob, urlFoto } from './fotos.js';

export async function vistaExamenes(raiz) {
  raiz.innerHTML = `<section class="seccion" data-hilo="coral">
    <header class="cabeza"><h1>Exámenes</h1><p>Elige el tema y si lo quieres tipo test o a desarrollar. Cada pregunta sale de tu material.</p></header>
    <form class="form-clase" data-form>
      <div data-selector></div>
      <fieldset class="modos"><legend>Tipo de examen</legend>
        <label class="modo"><input type="radio" name="modo" value="test" checked><span><strong>Tipo test</strong>Eliges una respuesta y se corrige sola.</span></label>
        <label class="modo"><input type="radio" name="modo" value="desarrollo"><span><strong>A desarrollar</strong>Escribes la respuesta y la comparas con el libro.</span></label>
      </fieldset>
      <div class="fila-op">
        <div><label for="cuantas">Preguntas</label><select id="cuantas" class="campo">${[5, 10, 15, 20, 30].map((n) => `<option ${n === 10 ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
        <div data-op-n><label for="nop">Respuestas por pregunta</label><select id="nop" class="campo"><option>2</option><option>3</option><option selected>4</option></select></div>
      </div>
      <button class="btn btn-accion btn-grande">Crear el examen</button>
      <p class="error" data-err role="alert" hidden></p>
    </form>
    <section class="guardadas"><h2>Tus exámenes</h2><div class="lista-clases lista-ex" data-lista></div></section>
  </section>`;
  const q = (s) => raiz.querySelector(s);
  const selector = montarSelector(q('[data-selector]'), { ayuda: '¿De qué te examinas?' });
  raiz.querySelectorAll('[name=modo]').forEach((r) => { r.onchange = () => { q('[data-op-n]').hidden = r.value === 'desarrollo' && r.checked; if (r.value === 'desarrollo' && r.checked) q('#cuantas').value = 5; }; });
  q('[data-form]').onsubmit = async (e) => {
    e.preventDefault();
    const err = q('[data-err]'); err.hidden = true;
    const fallo = (m) => { err.textContent = m; err.hidden = false; };
    const { texto, pdf, sel } = selector.obtener();
    const modo = raiz.querySelector('[name=modo]:checked').value;
    const cuantas = +q('#cuantas').value; const nOpciones = +q('#nop').value;
    let secs, titulo;
    if (pdf) {
      if (!sel.paginas.length) return fallo(`${sel.como}.`);
      secs = apartadosDe(pdf, sel);
      titulo = sel.todo ? estadoPdf.nombre : sel.temas?.length === 1 ? sel.temas[0].titulo.replace(/^\d+[.)]?\s*/, '') : texto || estadoPdf.nombre;
    } else {
      if (texto.length < 3) return fallo('Elige un PDF o escribe el tema.');
      const fichas = fichasDe(texto);
      if (!fichas.length) return fallo('Ese tema no está en el temario. Sube un PDF para crear el examen.');
      secs = apartadosDeFichas(fichas); titulo = texto.charAt(0).toUpperCase() + texto.slice(1);
    }
    const preguntas = modo === 'test' ? crearTest(secs, { cuantas, nOpciones }) : crearDesarrollo(secs, { cuantas });
    if (!preguntas.length) return fallo('No he encontrado contenido suficiente para crear preguntas. Prueba con más páginas.');
    if (pdf) for (const p of preguntas) {
      if (p.figura) { try { const r = await recortar(pdf, p.figura); p.figura = r ? { ...(await guardarBlob(r.blob, '')), pie: p.figura.pie } : null; } catch { p.figura = null; } }
    }
    const ex = { id: uid(), titulo: titulo.charAt(0).toUpperCase() + titulo.slice(1), modo, preguntas, pedidas: cuantas, creado: Date.now(), respuestas: {} };
    await guardar('examenes', ex); ir(`#examen/${ex.id}`);
  };
  const cs = (await todos('examenes')).sort((a, b) => b.creado - a.creado);
  q('[data-lista]').innerHTML = cs.length ? cs.map((c) => `<a class="ex-item" href="#examen/${c.id}"><strong>${h(c.titulo)}</strong><span>${c.modo === 'test' ? 'Tipo test' : 'A desarrollar'}, ${c.preguntas.length} preguntas${c.nota != null ? `. Nota: ${String(c.nota).replace('.', ',')}` : ''}</span></a>`).join('') : '<p class="vacio">Aún no hay ninguno.</p>';
}

const barajar = (a) => { const v = [...a]; for (let i = v.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [v[i], v[j]] = [v[j], v[i]]; } return v; };
const LETRAS = 'ABCD';
export async function vistaExamen(raiz, id) {
  const ex = await leer('examenes', id);
  if (!ex) return ir('#examenes');
  const pintar = () => (ex.corregido ? resultado() : examen());
  const cabecera = (sub) => `<header class="cabeza cabeza-ex"><a class="enlace" href="#examenes">Volver</a><h1>${h(ex.titulo)}</h1><p>${h(sub)}</p></header>`;
  function examen() {
    const aviso = ex.preguntas.length < ex.pedidas ? `He creado ${ex.preguntas.length} de ${ex.pedidas}: con este contenido no hay frases suficientes para más preguntas fiables.` : '';
    raiz.innerHTML = `<section class="seccion" data-hilo="coral">${cabecera(ex.modo === 'test' ? 'Tipo test: elige una respuesta en cada pregunta.' : 'A desarrollar: escribe con tus palabras.')}
      ${aviso ? `<p class="nota-ex">${h(aviso)}</p>` : ''}
      <ol class="preguntas">${ex.preguntas.map((p, i) => `<li class="pregunta"><p class="enun">${h(p.enunciado)}</p>${p.tipo === 'test'
        ? `<div class="opciones">${p.opciones.map((o, k) => `<label class="opcion"><input type="radio" name="q${i}" value="${k}" ${ex.respuestas[i] === k ? 'checked' : ''}><span class="letra">${LETRAS[k]}</span><span>${h(o)}</span></label>`).join('')}</div>`
        : `<label class="oculto" for="r${i}">Tu respuesta</label><textarea id="r${i}" data-r="${i}" class="campo" rows="6" placeholder="Escribe tu respuesta">${h(ex.respuestas[i] ?? '')}</textarea>`}</li>`).join('')}</ol>
      <div class="pie-ex"><output data-cuenta></output><button class="btn btn-accion btn-grande" data-corregir>Corregir</button></div></section>`;
    const contar = () => {
      const hechas = ex.preguntas.filter((_, i) => ex.respuestas[i] != null && ex.respuestas[i] !== '').length;
      raiz.querySelector('[data-cuenta]').textContent = `${hechas} de ${ex.preguntas.length} respondidas`;
    };
    contar();
    raiz.querySelectorAll('[type=radio]').forEach((r) => { r.onchange = () => { ex.respuestas[+r.name.slice(1)] = +r.value; guardar('examenes', ex); contar(); }; });
    raiz.querySelectorAll('[data-r]').forEach((t) => { t.oninput = () => { ex.respuestas[+t.dataset.r] = t.value; contar(); }; t.onblur = () => guardar('examenes', ex); });
    raiz.querySelector('[data-corregir]').onclick = () => {
      const faltan = ex.preguntas.filter((_, i) => ex.respuestas[i] == null || ex.respuestas[i] === '').length;
      const hacer = async () => { await corregir(); pintar(); scrollTo(0, 0); };
      if (!faltan) return hacer();
      hoja(`<h2>Te faltan ${faltan} preguntas</h2><p>Las que dejes en blanco contarán como no respondidas.</p><div class="fila"><button class="btn" data-cerrar>Seguir</button><button class="btn btn-accion" data-si>Corregir igualmente</button></div>`, (d) => { d.querySelector('[data-si]').onclick = () => { cerrarHoja(); hacer(); }; });
    };
  }
  async function corregir() {
    if (ex.modo === 'test') {
      const bien = ex.preguntas.filter((p, i) => ex.respuestas[i] === p.correcta).length;
      ex.nota = Math.round((bien / ex.preguntas.length) * 100) / 10; ex.aciertos = bien;
    } else {
      const notas = ex.preguntas.map((p, i) => corregirDesarrollo(p, ex.respuestas[i] ?? '').nota ?? 0);
      ex.nota = Math.round((notas.reduce((a, b) => a + b, 0) / notas.length) * 10) / 10;
    }
    ex.corregido = true; await guardar('examenes', ex);
  }
  function resultado() {
    const sub = ex.modo === 'test' ? `${ex.aciertos} de ${ex.preguntas.length} aciertos` : 'Nota orientativa: mide qué ideas clave aparecen, no la calidad de tu explicación';
    raiz.innerHTML = `<section class="seccion" data-hilo="coral">${cabecera(sub)}
      <p class="nota-grande">${String(ex.nota).replace('.', ',')}<small>/10</small></p>
      <ol class="preguntas">${ex.preguntas.map((p, i) => {
        const dato = p.pagina ? ` (página ${p.pagina})` : '';
        if (p.tipo === 'test') {
          const r = ex.respuestas[i]; const ok = r === p.correcta;
          return `<li class="pregunta ${ok ? 'bien' : 'mal'}"><p class="enun">${h(p.enunciado)}</p><div class="opciones">${p.opciones.map((o, k) => `<div class="opcion ${k === p.correcta ? 'correcta' : k === r ? 'errada' : ''}"><span class="letra">${LETRAS[k]}</span><span>${h(o)}</span></div>`).join('')}</div>${r == null ? '<p class="sin-r">Sin responder.</p>' : ''}<p class="expl"><strong>Según ${h(p.apartado)}${dato}:</strong> ${h(p.explicacion)}</p></li>`;
        }
        const c = corregirDesarrollo(p, ex.respuestas[i] ?? '');
        return `<li class="pregunta"><p class="enun">${h(p.enunciado)}</p><p class="tuya">${h(ex.respuestas[i] || 'Sin responder.')}</p>
          <div class="claves">${c.estan.map((k) => `<span class="clave si">${h(k)}</span>`).join('')}${c.faltan.map((k) => `<span class="clave no">${h(k)}</span>`).join('')}</div>
          <details class="modelo"><summary>Ver lo que dice el libro${dato}</summary>${p.figura ? `<figure><img data-ff="${i}" alt="${h(p.figura.pie ?? '')}"><figcaption>${h(p.figura.pie ?? '')}</figcaption></figure>` : ''}${p.respuesta.split('\n\n').map((x) => `<p>${h(x)}</p>`).join('')}</details></li>`;
      }).join('')}</ol>
      <div class="pie-ex"><button class="btn btn-accion btn-grande" data-otra>Repetir</button><button class="btn" data-borrar>Borrar el examen</button></div></section>`;
    raiz.querySelectorAll('[data-ff]').forEach(async (im) => { im.src = await urlFoto(ex.preguntas[+im.dataset.ff].figura); });
    raiz.querySelector('[data-otra]').onclick = async () => {
      ex.corregido = false; ex.nota = null; ex.respuestas = {};
      ex.preguntas = barajar(ex.preguntas).map((p) => {
        if (p.tipo !== 'test') return p;
        const buena = p.opciones[p.correcta]; const op = barajar(p.opciones);
        return { ...p, opciones: op, correcta: op.indexOf(buena) };
      });
      await guardar('examenes', ex); pintar(); scrollTo(0, 0);
    };
    raiz.querySelector('[data-borrar]').onclick = () => hoja(`<h2>¿Borrar este examen?</h2><p>No se podrá recuperar.</p><div class="fila"><button class="btn" data-cerrar>Cancelar</button><button class="btn btn-peligro" data-si>Borrar</button></div>`, (d) => { d.querySelector('[data-si]').onclick = async () => { await borrar('examenes', ex.id); cerrarHoja(); ir('#examenes'); }; });
  }
  pintar();
}
