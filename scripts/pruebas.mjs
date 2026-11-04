// Pruebas de la parte exacta: node scripts/pruebas.mjs
import assert from 'node:assert/strict';
import { ohm, potenciaCA, seccion, compensar, resolverPregunta, leerValores } from '../js/calculos.js';
import { buscar } from '../js/busqueda.js';
const cerca = (a, b, t = 0.01) => assert.ok(Math.abs(a - b) <= t, `${a} ≠ ${b}`);
cerca(ohm({ V: 230, R: 10 }).I, 23); cerca(ohm({ V: 230, R: 10 }).P, 5290);
cerca(ohm({ V: 230, I: 16 }).R, 14.375);
cerca(potenciaCA({ P: 5500, V: 400, cos: 0.85, tri: true }).I, 9.34);
cerca(potenciaCA({ V: 230, I: 10, cos: 0.8 }).Q, 1380);
const s = seccion({ P: 3680, L: 30, V: 230, pct: 3, gamma: 48 }); cerca(s.s, 2 * 30 * 3680 / (48 * 6.9 * 230)); assert.equal(s.comercial, 4);
cerca(compensar({ P: 10000, cos1: 0.75, cos2: 0.95 }).Qc, 5532, 2);
const casos = [
  ['¿Qué intensidad circula con 230 V y 10 ohmios?', 'V = 230 V · I = 23 A'],
  ['Intensidad de un motor de 5,5 kW trifásico a 400 V con cos φ 0,85', '9,34 A'],
  ['Sección para 3680 W a 30 metros con 3 %', '4 mm²'],
  ['velocidad de un motor de 2 pares de polos', '1500 rpm'],
  ['motor de 4 polos, velocidad en rpm', '1500 rpm'],
];
for (const [q, esp] of casos) { const r = resolverPregunta(q); assert.ok(r?.resultado.includes(esp), `${q} → ${r?.resultado}`); }
for (const q of ['¿Cuáles son las cinco reglas de oro?', '¿Qué es un diferencial?', 'la ITC-BT-25 dice 10 cosas']) assert.equal(resolverPregunta(q), null, q);
const esperado = { 'qué sección lleva el circuito de la lavadora': 'circuitos-vivienda', 'cinco reglas de oro': 'reglas-oro', 'realimentación marcha-paro': 'marcha-paro', 'colores de los cables': 'colores', 'puesta a tierra': 'tierra', 'arranque estrella triángulo': 'arranque', 'qué es el régimen de neutro TT': 'neutro', 'qué es un PLC': 'plc', 'curvas del magnetotérmico': 'magnetotermico', 'volumen de un baño': 'banos' };
for (const [q, id] of Object.entries(esperado)) assert.equal(buscar(q, 1)[0]?.f.id, id, q);
assert.equal(buscar('receta de paella', 1).length, 0);
// Simulador de PLC
const { Simulador, programa, PROGRAMAS } = await import('../js/plc.js');
const paso = (s, n = 1, dt = 100) => { for (let i = 0; i < n; i++) s.ciclo(dt); };
let s1 = new Simulador(programa('marcha-paro')); s1.poner('I0.0', true); paso(s1); s1.poner('I0.0', false); paso(s1, 3); assert.equal(s1.mem['Q0.0'], true); s1.poner('I0.1', false); paso(s1); assert.equal(s1.mem['Q0.0'], false);
s1 = new Simulador(programa('inversion')); s1.poner('I0.0', true); paso(s1); s1.poner('I0.0', false); s1.poner('I0.1', true); paso(s1, 3); assert.equal(s1.mem['Q0.1'], false);
s1 = new Simulador(programa('estrella')); s1.poner('I0.0', true); paso(s1, 2); s1.poner('I0.0', false); assert.equal(s1.mem['Q0.1'], true); paso(s1, 60); assert.equal(s1.mem['Q0.1'], false); assert.equal(s1.mem['Q0.2'], true);
s1 = new Simulador(programa('contador')); for (let i = 0; i < 5; i++) { s1.poner('I0.0', true); paso(s1, 2); s1.poner('I0.0', false); paso(s1, 2); } assert.equal(s1.c.C1, 5); paso(s1); assert.equal(s1.mem['Q0.0'], true);
assert.equal(PROGRAMAS.length, 12);
// Lectura: las notas al margen no se mezclan con el texto principal
const { apartados, analizarDocumento } = await import('../js/lectura.js');
const it = (s, x, y, h = 11, w = s.length * 5) => ({ s, x, y, h, w, f: 'n' });
const pag = { n: 1, x0: 0, base: 0, ancho: 600, alto: 800, items: [it('1. Tema de prueba', 80, 700, 20), ...Array.from({ length: 12 }, (_, i) => it('Linea larga de texto principal que ocupa el ancho de la columna del libro', 80, 660 - i * 13)), it('Nota al margen', 460, 660, 9)] };
const secc = apartados([pag], analizarDocumento([pag]));
assert.equal(secc[0].titulo, '1. Tema de prueba'); assert.ok(!secc[0].parrafos.map((p) => p.texto).join(' ').includes('Nota al margen'));
console.log('Todas las pruebas pasan');
