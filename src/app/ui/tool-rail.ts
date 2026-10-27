import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DocumentStore } from '../core/document.store';
import { ToolId } from '../core/models';
import { Icon } from './icon';
import { PageActions } from './page-actions';
import { UiService } from './ui.service';

interface RailItem {
  id: string;
  icon: string;
  label: string;
  key?: string;
  tool?: ToolId;
  run?: () => void;
  flyout?: 'shapes' | 'symbols';
}

export const TOOL_LABELS: Partial<Record<ToolId, string>> = {
  select: 'Seleccionar',
  editText: 'Editar texto',
  text: 'Añadir texto',
  highlight: 'Resaltar',
  ink: 'Dibujar',
  rect: 'Rectángulo',
  ellipse: 'Elipse',
  line: 'Línea',
  arrow: 'Flecha',
  whiteout: 'Tapar',
  note: 'Comentario',
  symbol: 'Marcas',
};

@Component({
  selector: 'app-tool-rail',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="rail" aria-label="Herramientas">
      @for (group of groups; track $index; let last = $last) {
        @for (it of group; track it.id) {
          <div class="slot">
            <button
              type="button"
              class="tool"
              [class.active]="isActive(it)"
              [attr.aria-pressed]="isActive(it)"
              [attr.aria-label]="it.label"
              (click)="activate(it)"
            >
              <span class="ink"><app-icon [name]="iconFor(it)" [size]="20" /></span>
              @if (it.flyout) {
                <span class="corner"></span>
              }
              <span class="tip">{{ it.label }} @if (it.key) {<kbd>{{ it.key }}</kbd>}</span>
            </button>
            @if (it.flyout && flyout() === it.flyout) {
              <div class="flyout" role="menu">
                @if (it.flyout === 'shapes') {
                  @for (s of shapeTools; track s.tool) {
                    <button type="button" role="menuitem" [class.on]="store.tool() === s.tool" (click)="pick(s.tool)">
                      <app-icon [name]="s.icon" [size]="18" /> <span>{{ s.label }}</span> <kbd>{{ s.key }}</kbd>
                    </button>
                  }
                } @else {
                  @for (s of symbols; track s.kind) {
                    <button type="button" role="menuitem" [class.on]="store.tool() === 'symbol' && store.style().symbol === s.kind" (click)="pickSymbol(s.kind)">
                      <app-icon [name]="s.kind" [size]="18" [stroke]="2.4" /> <span>{{ s.label }}</span>
                    </button>
                  }
                }
              </div>
            }
          </div>
        }
        @if (!last) {
          <span class="sep"></span>
        }
      }
    </nav>
    @if (flyout()) {
      <div class="scrim" (pointerdown)="flyout.set(null)"></div>
    }
  `,
  styleUrl: './tool-rail.css',
})
export class ToolRail {
  protected readonly store = inject(DocumentStore);
  private readonly ui = inject(UiService);
  private readonly actions = inject(PageActions);
  protected readonly flyout = signal<'shapes' | 'symbols' | null>(null);
  private lastShape = signal<ToolId>('rect');

  protected readonly shapeTools: { tool: ToolId; icon: string; label: string; key: string }[] = [
    { tool: 'rect', icon: 'rect', label: 'Rectángulo', key: 'R' },
    { tool: 'ellipse', icon: 'ellipse', label: 'Elipse', key: 'O' },
    { tool: 'line', icon: 'line', label: 'Línea', key: 'L' },
    { tool: 'arrow', icon: 'arrow', label: 'Flecha', key: 'A' },
  ];
  protected readonly symbols: { kind: 'check' | 'cross' | 'dot'; label: string }[] = [
    { kind: 'check', label: 'Visto bueno' },
    { kind: 'cross', label: 'Aspa' },
    { kind: 'dot', label: 'Punto' },
  ];

  protected readonly groups: RailItem[][] = [
    [
      { id: 'select', icon: 'select', label: 'Seleccionar y mover', key: 'V', tool: 'select' },
      { id: 'editText', icon: 'editText', label: 'Editar texto del PDF', key: 'E', tool: 'editText' },
    ],
    [
      { id: 'text', icon: 'text', label: 'Añadir texto', key: 'T', tool: 'text' },
      { id: 'highlight', icon: 'highlight', label: 'Resaltar', key: 'H', tool: 'highlight' },
      { id: 'ink', icon: 'ink', label: 'Dibujar a mano', key: 'D', tool: 'ink' },
      { id: 'shapes', icon: 'shapes', label: 'Formas', flyout: 'shapes' },
      { id: 'whiteout', icon: 'whiteout', label: 'Tapar (corrector)', key: 'W', tool: 'whiteout' },
    ],
    [
      { id: 'image', icon: 'image', label: 'Insertar imagen', key: 'I', run: () => this.actions.addImage() },
      { id: 'signature', icon: 'signature', label: 'Firmar', key: 'S', run: () => this.ui.open('signature') },
      { id: 'note', icon: 'note', label: 'Comentario', key: 'N', tool: 'note' },
      { id: 'stamp', icon: 'stamp', label: 'Sello', run: () => this.ui.open('stamp') },
      { id: 'symbols', icon: 'check', label: 'Marcas ✓ ✗', flyout: 'symbols' },
    ],
  ];

  private readonly shapeSet = computed(() => new Set<ToolId>(['rect', 'ellipse', 'line', 'arrow']));

  protected isActive(it: RailItem): boolean {
    const t = this.store.tool();
    if (it.tool) return t === it.tool;
    if (it.flyout === 'shapes') return this.shapeSet().has(t);
    if (it.flyout === 'symbols') return t === 'symbol';
    return false;
  }

  protected iconFor(it: RailItem): string {
    if (it.flyout === 'shapes') {
      const t = this.store.tool();
      return this.shapeSet().has(t) ? t : 'shapes';
    }
    if (it.flyout === 'symbols') return this.store.style().symbol;
    return it.icon;
  }

  protected activate(it: RailItem): void {
    if (it.flyout) {
      this.flyout.set(this.flyout() === it.flyout ? null : it.flyout);
      return;
    }
    this.flyout.set(null);
    if (it.run) {
      it.run();
      return;
    }
    if (it.tool) this.setTool(it.tool);
  }

  protected pick(tool: ToolId): void {
    this.lastShape.set(tool);
    this.setTool(tool);
    this.flyout.set(null);
  }

  protected pickSymbol(kind: 'check' | 'cross' | 'dot'): void {
    this.store.style.update((s) => ({ ...s, symbol: kind }));
    this.setTool('symbol');
    this.flyout.set(null);
  }

  private setTool(tool: ToolId): void {
    const next = this.store.tool() === tool && tool !== 'select' ? 'select' : tool;
    this.store.tool.set(next);
    this.store.selectedId.set(null);
    this.store.editingId.set(null);
    if (next === 'editText') this.ui.toast('Haz clic sobre cualquier texto del PDF para cambiarlo', 'info', 3200);
  }
}
