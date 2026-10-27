# Guía de contribución

Gracias por querer mejorar GC Docs. Esta guía resume cómo se trabaja en el proyecto. Para
entender la organización del código, lee antes [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Puesta en marcha

Necesitas **Node.js 22.12 o superior** (hay un `.nvmrc`: `nvm use`).

```bash
npm install        # instala dependencias y activa los git hooks (Husky)
npm start          # servidor de desarrollo en http://localhost:4200
```

## Scripts

| Script                  | Qué hace                                            |
| ----------------------- | --------------------------------------------------- |
| `npm start`             | Servidor de desarrollo con recarga automática       |
| `npm run build`         | Compilación de producción en `dist/gc-docs/browser` |
| `npm test`              | Tests unitarios (Vitest) una vez                    |
| `npm run test:watch`    | Tests en modo observación                           |
| `npm run test:coverage` | Tests con informe de cobertura en `coverage/`       |
| `npm run lint`          | ESLint (TypeScript, plantillas y accesibilidad)     |
| `npm run lint:fix`      | ESLint corrigiendo lo que pueda                     |
| `npm run format`        | Formatea todo con Prettier                          |
| `npm run check`         | Lo mismo que la CI: lint, formato, tests y build    |

## Flujo de trabajo

1. Crea una rama desde `main` con un prefijo según el tipo de cambio:
   `feat/organizador-zoom`, `fix/texto-girado`, `refactor/page-view`, `docs/readme`…
2. Haz commits pequeños y con sentido propio.
3. Ejecuta `npm run check` antes de subir.
4. Abre un pull request. La CI ejecuta lint, formato, tests y compilación; al fusionar en
   `main` se publica automáticamente en GitHub Pages.

### Mensajes de commit

Se usa [Conventional Commits](https://www.conventionalcommits.org/es/). El hook `commit-msg`
lo comprueba con commitlint.

```
<tipo>(<ámbito opcional>): <descripción en imperativo>

feat(organizer): permite mover la selección a una posición concreta
fix(export): conserva los valores de formulario al unir PDFs
refactor(editor): extrae la búsqueda a SearchService
test(state): cubre las transacciones del historial
```

Tipos habituales: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `style`, `build`, `ci`, `chore`.

## Convenciones de código

### Archivos y nombres

- Un componente por carpeta: `nombre.component.ts`, `.html`, `.scss` y `.spec.ts`.
  Nada de plantillas ni estilos en línea.
- Sufijos: `.component.ts`, `.service.ts`, `.directive.ts`, `.pipe.ts`, `.guard.ts`,
  `.model.ts`, `.utils.ts`, `.constants.ts`, `.token.ts`.
- Selectores con prefijo `app-` (componentes) y `app` en camelCase (directivas).
- Usa los alias `@core/…`, `@shared/…`, `@features/…`, `@layout/…` en vez de `../../..`.
- Respeta las reglas de dependencia entre capas (ver ARCHITECTURE.md): `core` no importa nada
  de interfaz.

### Angular

- Componentes **standalone** con `ChangeDetectionStrategy.OnPush` (lo exige el lint).
- **Signals** para el estado: `signal`, `computed`, `input()`, `output()`, `viewChild()`.
  Evita `@Input`/`@Output`/`@ViewChild` y `BehaviorSubject` para estado de interfaz.
- `inject()` en lugar de inyección por constructor.
- Control de flujo nuevo en plantillas: `@if`, `@for` (siempre con `track`), `@switch`, `@let`.
- Bindings del host en `host: {}` del decorador.
- Los componentes de presentación reciben datos y emiten eventos; la lógica de negocio va en
  servicios o en funciones puras de `core`.
- Los métodos del estado que cambian el documento llaman a funciones puras de
  `document.operations.ts`; si añades una operación nueva, añade también su test.
- No nombres un `output()` como un evento nativo del DOM (`click`, `input`, `textInput`…):
  el listener del padre recibiría también el evento nativo.

### TypeScript

- Modo estricto. Prohibido `any`: usa `unknown` y estrecha el tipo.
- `import type` para lo que solo se usa como tipo (lo corrige `npm run lint:fix`).
- Los modelos son `interface` con propiedades `readonly`; el estado nunca se muta.
- Sin `public` explícito; `protected` para lo que solo usa la plantilla; `private` para el resto.

### Estilos

- SCSS con encapsulación por componente.
- Colores, radios y sombras salen de los **tokens** (`src/styles/_tokens.scss`), nunca valores
  sueltos, para que el tema oscuro funcione.
- Puntos de corte con el mixin `bp.down(sm|md|lg)` de `_breakpoints.scss`.
- Clases con BEM ligero: `.bloque`, `.bloque__elemento`, `.bloque--variante`, estado con `.is-*`.

### Accesibilidad

- Todo lo que se puede pulsar es un `<button>` o un enlace, con nombre accesible
  (`aria-label` si solo tiene icono).
- El lint incluye las reglas de accesibilidad de angular-eslint: no las desactives sin motivo.
- Revisa el foco con el teclado y el tema oscuro al cambiar la interfaz.

## Tests

- Los tests van junto al archivo que prueban (`*.spec.ts`).
- Describe el comportamiento, no la implementación: `it('nunca deja el documento sin páginas')`.
- Usa los datos de `@testing/fixtures` en lugar de construir objetos a mano.
- Para componentes, prueba lo que ve y hace el usuario (DOM y eventos emitidos) con
  `TestBed.createComponent` y `fixture.componentRef.setInput()`.
