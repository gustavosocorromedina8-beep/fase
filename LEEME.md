# Fase

App de estudio para el ciclo de Instalaciones Eléctricas y Automáticas. Funciona sin internet y sin Claude.

## Abrirla en el Mac

Haz doble clic en `Abrir Fase.command` y deja abierta esa ventana mientras la usas.
La primera vez, macOS puede pedirte confirmación: clic derecho, Abrir.

## Instalarla en el iPhone o el iPad

El iPhone tiene que descargarla una vez desde una dirección HTTPS, así que antes hay que publicarla.
Después:

1. Abre la dirección en Safari.
2. Toca Compartir y elige Añadir a pantalla de inicio.
3. Abre Fase desde el icono, con WiFi, para que se guarde completa.
4. En Dudas, sube la palanca de la IA para descargar el modelo.

Necesita iOS 26 o posterior para la IA. El temario y los cálculos funcionan igualmente.

## Qué hace cada apartado

- **Clases**: crea una presentación desde un PDF, indicando páginas, tema o palabras clave, o desde lo que escribas.
- **Dudas**: resuelve preguntas. Calcula con exactitud, consulta el temario y, si la enciendes, usa la IA local.
- **Temario**: fichas de estudio de REBT, protecciones, máquinas, automatismos y electrónica.
- **Cálculo**: seis calculadoras con fórmulas exactas.
- **Ajustes**: modelo de IA, fotos de internet, espacio usado y créditos de las fotos.

## Qué fiabilidad tiene cada respuesta

- **Cálculo exacto**: fórmula programada, no pasa por la IA.
- **Del temario**: ficha fija, redactada por Claude sin cotejarla con el texto oficial. Compárala con tus apuntes y con el REBT vigente.
- **Explicación de la IA**: puede equivocarse. Si da cifras que no están en el temario, la app avisa, pero ese aviso no detecta todos los errores.

## Limitaciones

- Los PDF escaneados, sin texto seleccionable, no se pueden leer.
- El modelo Ligero solo responde si hay una ficha del temario sobre la pregunta.
- La tabla de intensidades admisibles de la ITC-BT-19 no está incluida: compruébala siempre al calcular una sección.

## Si cambias archivos de la app

```bash
python3 scripts/lista_archivos.py
```

Actualiza la lista de archivos que se guardan para usar la app sin conexión.

## Pruebas

```bash
node --experimental-default-type=module scripts/pruebas.mjs
```

Comprueba los cálculos y la búsqueda en el temario. Necesita Node 22 o posterior.

## Componentes de terceros

- [WebLLM](https://github.com/mlc-ai/web-llm) y [PDF.js](https://github.com/mozilla/pdf.js): licencia Apache 2.0.
- Tipografía [Archivo](https://github.com/Omnibus-Type/Archivo): licencia SIL Open Font.
- Fotos de Wikimedia Commons: autor, licencia y enlace de cada una en Ajustes, dentro de la app.
