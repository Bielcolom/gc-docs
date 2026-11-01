# Arquitectura

Este documento explica cómo está organizado GC Docs y por qué. Está pensado para quien llega
al proyecto (o a Angular) y quiere entender dónde va cada cosa antes de tocar código.

## Visión general

GC Docs es una SPA de Angular que funciona **entera en el navegador**: no hay backend. Los PDF
se leen con [pdf.js](https://mozilla.github.io/pdf.js/) y se escriben con
[pdf-lib](https://pdf-lib.js.org/).

```
            ┌───────────────────────────── features ─────────────────────────────┐
            │  welcome        editor               organizer          dialogs     │
            │  (inicio)       (editar páginas)     (ordenar páginas)  (modales)   │
            └──────┬──────────────────┬───────────────────┬───────────────────────┘
                   │ usan             │                   │
   layout ─────────┤                  ▼                   ▼
   (barra superior,│          shared (componentes, directivas y pipes reutilizables)
    marco)         │                  │
                   ▼                  ▼
            ┌──────────────────────── core ────────────────────────────────────────┐
            │ state (stores)   services (casos de uso)   pdf (lectura)   export      │
            │ models   utils   constants   fonts   annotations   tokens   guards     │
            └──────────────────────────────────────────────────────────────────────┘
```

### Capas y reglas de dependencia

| Carpeta         | Qué contiene                                                                | Puede importar de                      |
| --------------- | --------------------------------------------------------------------------- | -------------------------------------- |
| `core/`         | Lógica sin interfaz: modelos, estado, servicios, lectura y escritura de PDF | solo `core/`                           |
| `shared/`       | Piezas de interfaz genéricas (icono, muestras de color, miniatura, pipes…)  | `core/`, `shared/`                     |
| `layout/`       | El marco de las pantallas de trabajo (barra superior)                       | `core/`, `shared/`, `features/dialogs` |
| `features/<x>/` | Una pantalla o funcionalidad completa                                       | `core/`, `shared/`, `features/dialogs` |

- `core` **nunca** importa componentes. Cuando un servicio necesita preguntar algo al usuario
  (p. ej. una contraseña) lo hace a través del token `USER_PROMPTS`, cuya implementación
  (con diálogos) se registra en `app.config.ts`. Así `core` no depende de la interfaz y se
  puede probar sin ella.
- Las features no se importan entre sí. La única excepción es `features/dialogs`, que hace de
  "feature compartida" de modales.
- Los imports usan alias (`@core/…`, `@shared/…`, `@features/…`, `@layout/…`, `@env/…`,
  `@testing/…`) definidos en `tsconfig.json`, en vez de rutas relativas largas.

## Estructura de carpetas

```
src/
├── app/
│   ├── app.component.*          Raíz: router-outlet, avisos e indicador de actividad
│   ├── app.config.ts            Providers globales (router, HttpClient, tokens, inicialización)
│   ├── app.routes.ts            Rutas con lazy loading y guard
│   ├── core/
│   │   ├── annotations/         Factoría: cómo se crea cada tipo de anotación
│   │   ├── constants/           Valores fijos (tamaños, paletas, rutas, claves de almacenamiento)
│   │   ├── convert/             Formatos, registro de conversores y cada conversor (bajo demanda)
│   │   ├── export/              Escritura del PDF final con pdf-lib (se carga bajo demanda)
│   │   ├── fonts/               Catálogo de fuentes, métricas y registro de @font-face
│   │   ├── guards/              documentLoadedGuard
│   │   ├── models/              Interfaces y tipos (sin lógica)
│   │   ├── pdf/                 Lectura con pdf.js: apertura, render, texto, formularios
│   │   ├── services/            Casos de uso: abrir, guardar, notificar, tema, almacenamiento…
│   │   ├── state/               DocumentStore, EditorStore, historial y operaciones puras
│   │   ├── tokens/              InjectionTokens (APP_BASE_URL, ENVIRONMENT, USER_PROMPTS)
│   │   └── utils/               Funciones puras (geometría, matrices, rangos, teclado…)
│   ├── shared/
│   │   ├── components/          icon, brand-logo, color-swatches, page-thumbnail, dialog-shell…
│   │   ├── directives/          appInViewport, appAutofocus
│   │   └── pipes/               plural
│   ├── layout/
│   │   ├── workspace-layout/    Marco de /documento: barra superior + atajos globales
│   │   └── top-bar/
│   └── features/
│       ├── welcome/             Pantalla de inicio
│       ├── editor/              Visor, herramientas, panel lateral e inspector
│       │   ├── editor-page/     Componente contenedor (smart) de la ruta
│       │   ├── components/      Componentes de presentación
│       │   └── services/        Lógica propia del editor (comandos, búsqueda, atajos)
│       ├── organizer/           Cuadrícula de páginas y documentos
│       ├── converter/           Conversor entre formatos con selector «De ⇄ A»
│       └── dialogs/             Firma, sello, marca de agua, numeración, dividir…
├── environments/                Configuración por entorno
├── styles/                      Tokens de diseño, mixins y estilos globales (SCSS)
└── testing/                     Utilidades y datos de prueba para los tests
```

Cada componente vive en su carpeta con tres archivos: `nombre.component.ts`, `.html` y `.scss`
(y `.spec.ts` si tiene test). Nada de plantillas ni estilos en línea.

## Rutas

| URL                    | Pantalla                 | Notas                               |
| ---------------------- | ------------------------ | ----------------------------------- |
| `/`                    | `WelcomePageComponent`   |                                     |
| `/documento/editar`    | `EditorPageComponent`    | protegida por `documentLoadedGuard` |
| `/documento/organizar` | `OrganizerPageComponent` | protegida por `documentLoadedGuard` |
| `/convertir?de=…&a=…`  | `ConverterPageComponent` | el sentido va en la URL             |

Todas las pantallas se cargan con `loadComponent` (lazy loading). Los segmentos y destinos están
en `core/constants/routes.constants.ts` (`APP_PATHS`) para no repetir cadenas por el código.

## Estado

El estado vive en **servicios con signals** (no hay NgRx; para una app de este tamaño no aporta).

- **`DocumentStore`**: lo que se guarda en el PDF (páginas, anotaciones, formularios, marca de
  agua, numeración, propiedades). Es inmutable: cada cambio crea un objeto nuevo.
- **`EditorStore`**: el estado de la interfaz (herramienta, zoom, selección, paneles abiertos).
  No forma parte del historial.

La lógica de cada cambio está en `core/state/document.operations.ts` como **funciones puras**
(`estado → estado`). El store solo las llama y guarda el resultado en el historial. Esto hace que
la lógica sea fácil de probar (`document.operations.spec.ts`) sin Angular.

```
componente ──llama──▶ DocumentStore.rotatePages(ids)
                         │
                         ├─ ops.rotatePages(estado, ids)   (función pura)
                         └─ history.set(nuevoEstado)       (UndoHistory<T>)
                                   │
                         signals derivados (pages, annotationsByPage…) ──▶ plantillas
```

### Historial (deshacer / rehacer)

`UndoHistory<T>` es genérico y no sabe nada de PDF:

- **Agrupación por clave**: cambios con la misma `coalesceKey` en menos de 1,2 s cuentan como un
  paso (p. ej. escribir en un campo de formulario).
- **Transacciones**: `begin()`/`end()` convierten una interacción larga (arrastrar, editar un
  texto) en un único paso.
- **`replace()`**: ajustes automáticos que no son acciones del usuario (p. ej. medir el tamaño
  real de un texto) no crean pasos.

## Componentes

- **Contenedores** (`*-page`): inyectan stores y servicios, y coordinan.
- **Presentación**: reciben datos con `input()` y avisan con `output()`. No conocen los stores
  cuando no hace falta, lo que los hace reutilizables y fáciles de probar.
- Todos son **standalone**, **OnPush** y la app es **zoneless** (sin Zone.js): la detección de
  cambios la disparan los signals.
- Plantillas con el control de flujo nuevo (`@if`, `@for`, `@switch`, `@let`).
- `host: {...}` en el decorador en lugar de `@HostBinding`/`@HostListener`.
- `viewChild()`, `input()`, `output()`, `computed()`, `effect()` y `resource()` en lugar de los
  decoradores clásicos.
- Formularios de los diálogos con **Reactive Forms tipados** (`NonNullableFormBuilder`) y
  validadores propios (`pageRangesValidator`).
- Modales, menús y arrastrar y soltar con **Angular CDK** (`Dialog`, `Menu`, `DragDrop`).

## Conversores

`core/convert/` convierte archivos de un formato a otro sin que la interfaz conozca ningún
conversor concreto. Todo parte de dos catálogos:

- **`FILE_FORMATS`** (`file-formats.ts`): los formatos que existen (nombre visible, extensiones,
  tipos MIME). `detectFormat()` reconoce el de un archivo.
- **`CONVERTERS`** (`converter-registry.ts`): un `ConverterDefinition` por sentido (`from` → `to`)
  con un `load()` que importa el conversor bajo demanda. Cada conversor es un servicio que
  implementa `Converter.convert(file, { onProgress, signal })`.

La pantalla `/convertir` muestra todos los formatos en los dos lados del selector «De ⇄ A». Si
para un sentido no hay conversor, sale como «próximamente»; al soltar un archivo de otro formato,
cambia el sentido sola. Para añadir uno nuevo (p. ej. DOCX → PDF):

1. Si el formato es nuevo, añádelo a `FileFormatId` (`core/models/conversion.model.ts`) y a
   `FILE_FORMATS`.
2. Crea `core/convert/<origen>-to-<destino>/` con un servicio `providedIn: 'root'` que implemente
   `Converter`.
3. Regístralo en `CONVERTERS`. La interfaz no necesita cambios.

### PDF → Google Docs

Un PDF guarda glifos en coordenadas, no párrafos, así que la conversión reconstruye la estructura
en tres pasos independientes (y probados por separado):

```
pdf-page-reader   pdf.js → líneas con formato (fuente, negrita, color muestreado) e imágenes recortadas
       │
layout            orden de lectura (corte XY: columnas y filas), párrafos, títulos, márgenes
       │
docx-writer       docx → .docx con lo que Google Docs importa bien
```

Decisiones tomadas por Google Docs: un único tamaño de página con saltos manuales, interlineado
múltiple (no exacto), títulos con los estilos `Heading 1–3`, fuentes que Docs tiene (o la estándar
más parecida) e imágenes en línea. Los números de página se quitan porque en un documento que
fluye dejan de cuadrar.

## Rendimiento

- **Carga bajo demanda de librerías pesadas**: pdf.js (~450 kB), pdf-lib + fontkit + JSZip
  (~1,4 MB) y docx (~420 kB, solo al convertir) se descargan con `import()` la primera vez que se
  necesitan. El bundle inicial pesa
  ~535 kB (~140 kB comprimido). Los presupuestos de `angular.json` fallan la compilación si crece.
- **Render solo de lo visible**: cada página y miniatura usa `InViewportDirective`
  (IntersectionObserver); al salir de pantalla se libera su canvas.
- **Render cancelable**: los renders en curso se cancelan con `AbortController` al cambiar el zoom.

## Sistemas de coordenadas

Es la parte más delicada. Hay tres espacios:

1. **Espacio base de la página**: la vista de pdf.js a escala 1 con la rotación propia del PDF,
   en puntos, origen arriba a la izquierda. **Todas las anotaciones se guardan aquí.**
2. **Espacio de pantalla**: el anterior × zoom y girado por la rotación que añade el usuario
   (con CSS). `screenToPage()` convierte un clic al espacio base.
3. **Espacio PDF**: el del archivo, origen abajo a la izquierda. Al exportar se pasa del espacio
   base al PDF con `inv(viewportTransform) ∘ flipY(alto)` (ver `core/export/coordinate-spaces.ts`).

Así una anotación se dibuja igual en una página girada, en pantalla y en el archivo final.

## Edición del texto original

1. `TextExtractionService` lee los fragmentos de texto con pdf.js y `groupTextItems()` los une
   en líneas (mismo renglón, tamaño parecido, fragmentos cercanos).
2. Al hacer clic en una línea se muestrea el color del texto y del fondo en los píxeles del canvas
   (`sampleTextColors`) y se adivina la fuente estándar más parecida (`guessFontStyle`).
3. Se crea una anotación de texto con un `cover`: al exportar se pinta un rectángulo del color del
   fondo sobre la línea original y el texto nuevo en la misma línea base.

## Tests

- **Vitest** con el builder oficial `@angular/build:unit-test`.
- Los tests van junto al código (`*.spec.ts`).
- Prioridad: funciones puras (`utils`, `document.operations`, `annotation-factory`), estado
  (`UndoHistory`, `DocumentStore`), guard, pipes y componentes de `shared`.
- Los datos de prueba compartidos están en `src/testing/fixtures.ts`.

## Calidad automatizada

| Herramienta | Qué hace                                      | Cuándo                         |
| ----------- | --------------------------------------------- | ------------------------------ |
| ESLint      | Reglas de Angular, TypeScript y accesibilidad | `npm run lint`, pre-commit, CI |
| Prettier    | Formato uniforme                              | pre-commit, CI                 |
| commitlint  | Mensajes con Conventional Commits             | commit-msg                     |
| Vitest      | Tests unitarios y cobertura                   | `npm test`, CI                 |
| Budgets     | Límite de tamaño del bundle                   | `npm run build`, CI            |
| Dependabot  | PR semanales con dependencias actualizadas    | GitHub                         |
