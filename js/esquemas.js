// Esquemas técnicos dibujados en SVG. Heredan el color del texto (currentColor).
const base = (vb, c) => `<svg viewBox="${vb}" role="img" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="square" font-family="inherit" font-size="20"><style>text{fill:currentColor;stroke:none;font-weight:600}</style>${c}</svg>`;
const R = (x, y, t) => `<rect x="${x}" y="${y}" width="70" height="30"/><text x="${x + 35}" y="${y - 10}" text-anchor="middle">${t}</text>`;
export const ESQUEMAS = {
  serieParalelo: { alt: 'Resistencias en serie y en paralelo', svg: base('0 0 640 260', `
    <path d="M20 70H70M140 70H190M260 70H310"/>${R(70, 55, 'R1')}${R(190, 55, 'R2')}<text x="20" y="30">Serie</text>
    <path d="M350 130H400V70H440M510 70H550V130H620M400 130V190H440M510 190H550V130"/>${R(440, 55, 'R1')}${R(440, 175, 'R2')}<text x="350" y="30">Paralelo</text>
    <text x="20" y="150">Rt = R1 + R2</text><text x="20" y="185">Misma intensidad</text><text x="350" y="245">Misma tensión</text>`) },
  triangulo: { alt: 'Triángulo de potencias con P, Q, S y el ángulo φ', svg: base('0 0 640 300', `
    <path d="M90 250H520V60L90 250Z"/><path d="M160 250A70 70 0 0 0 150 224"/>
    <text x="280" y="285">P (W)</text><text x="535" y="165">Q (var)</text><text x="250" y="135">S (VA)</text><text x="172" y="240">φ</text>`) },
  enlace: { alt: 'Secuencia de una instalación de enlace, desde la red hasta la vivienda', svg: base('0 0 760 200', `
    <path d="M20 100H70M170 100H220M320 100H370M470 100H520M620 100H670"/>
    ${[[70, 'CGP'], [220, 'LGA'], [370, 'Contador'], [520, 'DI']].map(([x, t]) => `<rect x="${x}" y="65" width="${t === 'LGA' || t === 'DI' ? 100 : 100}" height="70"/><text x="${x + 50}" y="107" text-anchor="middle">${t}</text>`).join('')}
    <rect x="670" y="65" width="75" height="70"/><text x="707" y="107" text-anchor="middle">CGMP</text>
    <text x="20" y="50">Red</text><text x="660" y="170">Vivienda</text>`) },
  estrellaTriangulo: { alt: 'Conexión de los devanados de un motor en estrella y en triángulo', svg: base('0 0 640 280', `
    <text x="90" y="30">Estrella</text><path d="M130 150V70M130 150L60 220M130 150L200 220"/><circle cx="130" cy="150" r="5" fill="currentColor"/>
    <text x="120" y="60">U</text><text x="40" y="250">V</text><text x="205" y="250">W</text>
    <text x="430" y="30">Triángulo</text><path d="M470 60L380 220H560Z"/>
    <text x="462" y="50">U</text><text x="350" y="245">V</text><text x="565" y="245">W</text>`) },
  conmutada: { alt: 'Conmutada: la fase entra al común del primer conmutador, dos puentes unen ambos conmutadores, y del común del segundo sale el retorno a la lámpara', svg: base('0 0 640 240', `
    <text x="20" y="85">Fase</text><path d="M80 80H140L200 50M210 50H400M210 110H400"/><path d="M400 50L460 80H520"/><circle cx="560" cy="80" r="40"/><path d="M532 52L588 108M588 52L532 108"/><path d="M560 120V190H20"/>
    <text x="20" y="182">Neutro</text><circle cx="205" cy="50" r="5"/><circle cx="205" cy="110" r="5"/><circle cx="405" cy="50" r="5"/><circle cx="405" cy="110" r="5"/><text x="260" y="38">Puentes</text>`) },
  marchaParo: { alt: 'Circuito de mando de marcha-paro con realimentación por KM1', svg: base('0 0 640 340', `
    <path d="M60 30H580M60 310H580M240 30V70"/>
    <path d="M240 70L225 105M240 105V145"/><text x="255" y="95">S0 Paro (NC)</text>
    <path d="M240 145H150V170L135 205M150 205V230H240M240 145H330V170L315 205M330 205V230H240"/>
    <text x="40" y="195">S1</text><text x="345" y="195">KM1 13-14</text>
    <path d="M240 230V255"/><rect x="205" y="255" width="70" height="30"/><text x="285" y="278">KM1 A1-A2</text><path d="M240 285V310"/>`) },
};
