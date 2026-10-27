# GC Docs · Editor de PDF

[![CI](https://github.com/Bielcolom/gc-docs/actions/workflows/ci.yml/badge.svg)](https://github.com/Bielcolom/gc-docs/actions/workflows/ci.yml)

Editor de PDF completo que funciona en el navegador. Abre un PDF, cambia su texto, fírmalo, rellena sus campos, ordena sus páginas y descárgalo. **Todo se procesa en tu equipo**: los archivos nunca se suben a ningún servidor.

**Demo:** https://bielcolom.github.io/gc-docs/

![Editor de GC Docs editando el texto de un contrato](docs/editor.png)

![Vista Organizar con páginas de varios PDFs](docs/organizar.png)

## Funcionalidades

### Editar

- **Editar el texto original del PDF.** Con la herramienta «Editar texto» (`E`) los textos del documento aparecen recuadrados; haz clic en uno y reescríbelo. Se conserva la posición, el tamaño y el color, y se detecta la fuente más parecida (Helvetica/Arial, Times o Courier, con negrita y cursiva).
- **Añadir texto** con 9 fuentes (clásicas, modernas y manuscritas), tamaño, negrita, cursiva, subrayado, alineación, color y fondo. Admite cualquier carácter Unicode (ñ, tildes, Ł, Ž…).
- **Tapar** zonas como con un corrector, para escribir encima.

### Anotar

- Resaltar, subrayar y tachar.
- Dibujo a mano alzada.
- Rectángulos, elipses, líneas y flechas, con borde, relleno, grosor y opacidad.
- Comentarios (se guardan como notas estándar de PDF, visibles en cualquier lector).
- Sellos (APROBADO, PAGADO, CONFIDENCIAL… o uno propio).
- Marcas ✓ ✗ • para formularios impresos.
- Imágenes: desde archivo, arrastrándolas a la página o pegándolas con `Ctrl+V`.

### Firmar y rellenar

- **Firma** dibujada, escrita con tipografía manuscrita o subida desde una foto (con eliminación automática del fondo blanco). Las firmas se recuerdan para la próxima vez.
- **Formularios PDF:** los campos de texto, casillas, botones de opción y desplegables se vuelven editables.

### Organizar páginas y documentos

- **Vista «Organizar»** (`G`) a pantalla completa con todas las páginas en cuadrícula y tamaño de miniatura ajustable.
- Arrastrar y soltar una o muchas páginas a la vez, con desplazamiento automático y animación del cambio de orden. En móvil se arrastra desde el asa de cada miniatura.
- Selección múltiple con `Ctrl`/`⇧` + clic, con un recuadro de selección o con `Ctrl+A`.
- Mover la selección una posición (`Alt` + flechas), al principio, al final o a una posición concreta.
- Cada PDF de origen tiene un color, y su nombre aparece bajo cada página para no perderse al unir muchos archivos.
- **Modo «Documentos»:** reordena PDFs enteros arrastrándolos, ordénalos por nombre (A → Z / Z → A), gíralos o quítalos de una vez.
- En el editor, el panel lateral también permite reordenar arrastrando las miniaturas.
- Girar, duplicar y eliminar páginas, o girar todas a la vez.
- Insertar páginas en blanco, otros PDFs o imágenes en cualquier posición.
- **Unir** varios PDFs e imágenes en uno.
- **Dividir** por rangos (`1-3, 4, 5-8`), cada N páginas o una por archivo (se descarga un ZIP).
- **Extraer** las páginas seleccionadas a un PDF nuevo.
- Invertir el orden.

### Acabado y exportación

- Marca de agua en todas las páginas (texto, tamaño, color, opacidad e inclinación).
- Numeración de páginas con varios formatos y posiciones.
- Propiedades del documento: título, autor, asunto y palabras clave.
- Descargar el PDF, guardarlo como imágenes PNG (72, 150 o 300 ppp) o imprimirlo.
- Abre PDFs protegidos con contraseña.

### Comodidad

- Deshacer y rehacer ilimitado (`Ctrl+Z` / `Ctrl+⇧+Z`).
- Búsqueda de texto sin distinguir mayúsculas ni tildes (`Ctrl+F`).
- Zoom con `Ctrl` + rueda, ajuste al ancho o a la página.
- Tema claro y oscuro, diseño adaptado a móvil y tableta.
- Atajos de teclado para todas las herramientas (pulsa `?` para verlos).

## Cómo funciona la edición de texto

Un PDF no guarda párrafos sino glifos colocados en coordenadas exactas, así que «editar texto» significa:

1. [pdf.js](https://mozilla.github.io/pdf.js/) extrae los fragmentos de texto con su posición, tamaño y fuente, y GC Docs los agrupa en líneas.
2. Al hacer clic en una línea, se muestrea el color del texto y del fondo directamente de los píxeles renderizados.
3. Al exportar, [pdf-lib](https://pdf-lib.js.org/) tapa la línea original con el color de fondo y escribe el texto nuevo en la misma línea base, con la fuente estándar equivalente (o una fuente Unicode incrustada si hace falta).

Es el mismo enfoque que usan la mayoría de editores web. El texto original sigue dentro del PDF debajo del parche, así que no sirve para ocultar información sensible.

## Tecnología

- **[Angular 22](https://angular.dev)**: componentes _standalone_, **signals**, sin Zone.js, rutas con _lazy loading_, Reactive Forms tipados y **Angular CDK** (diálogos, menús y arrastrar y soltar).
- **pdf.js** para mostrar las páginas, extraer texto y leer formularios.
- **pdf-lib** + **fontkit** para escribir el PDF final y **JSZip** para descargar varios archivos.
  Estas librerías se cargan solo cuando hacen falta: la página de inicio pesa unos 140 kB comprimida.
- Fuentes incluidas en el proyecto (Roboto, Lora, Roboto Mono, Dancing Script, Great Vibes, Caveat, Bricolage Grotesque y Schibsted Grotesk): la app no depende de servicios externos.
- Calidad: TypeScript estricto, **ESLint** (con reglas de accesibilidad), **Prettier**, tests con **Vitest**, _git hooks_ con Husky y commitlint, y CI/CD con GitHub Actions.

## Estructura del proyecto

```
src/app/
├── core/          Lógica sin interfaz: modelos, estado (stores con signals), lectura y
│                  escritura de PDF, servicios, utilidades puras, tokens y guards
├── shared/        Componentes, directivas y pipes reutilizables
├── layout/        Marco de las pantallas de trabajo (barra superior)
└── features/
    ├── welcome/   Pantalla de inicio
    ├── editor/    Visor, herramientas, panel lateral e inspector
    ├── organizer/ Cuadrícula para ordenar páginas y documentos
    └── dialogs/   Firma, sellos, marca de agua, numeración, dividir…
```

La organización por capas, el flujo de datos, los sistemas de coordenadas y las convenciones
se explican en **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.

## Desarrollo

Necesitas Node.js 22.12 o superior.

```bash
npm install        # dependencias + git hooks
npm start          # servidor de desarrollo en http://localhost:4200
npm test           # tests unitarios
npm run check      # lint, formato, tests y build (lo mismo que la CI)
```

Todos los scripts, el flujo de ramas y las convenciones de código están en
**[CONTRIBUTING.md](CONTRIBUTING.md)**.

## Publicación

La CI (`.github/workflows/ci.yml`) ejecuta lint, formato, tests y compilación en cada pull request.
Cada `push` a `main` que pasa esas comprobaciones se publica en GitHub Pages.

## Licencia

[MIT](LICENSE) © Gabriel Colom
