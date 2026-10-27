import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import type { ConnectedPosition } from '@angular/cdk/overlay';
import type { SymbolKind, ToolId } from '@core/models';
import { NotificationService } from '@core/services';
import { EditorStore } from '@core/state';
import { IconComponent, type IconName } from '@shared/components';
import { EditorCommandsService } from '../../services/editor-commands.service';
import { RAIL_GROUPS, SHAPE_TOOLS, SYMBOL_OPTIONS, type ToolAction } from './tool-rail.config';

const SHAPE_SET = new Set<ToolId>(SHAPE_TOOLS.map((s) => s.tool));

/** Barra vertical de herramientas del editor (horizontal en móvil). */
@Component({
  selector: 'app-tool-rail',
  imports: [IconComponent, CdkMenuTrigger, CdkMenu, CdkMenuItem],
  templateUrl: './tool-rail.component.html',
  styleUrl: './tool-rail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToolRailComponent {
  protected readonly editorStore = inject(EditorStore);
  private readonly commands = inject(EditorCommandsService);
  private readonly notifications = inject(NotificationService);

  protected readonly groups = RAIL_GROUPS;
  protected readonly shapeTools = SHAPE_TOOLS;
  protected readonly symbols = SYMBOL_OPTIONS;
  protected readonly menuPositions: ConnectedPosition[] = [
    { originX: 'end', originY: 'top', overlayX: 'start', overlayY: 'top', offsetX: 8 },
    { originX: 'center', originY: 'top', overlayX: 'center', overlayY: 'bottom', offsetY: -8 },
  ];

  private readonly activeTool = this.editorStore.tool;
  /** Icono del botón de formas: la forma elegida o el genérico. */
  protected readonly shapesIcon = computed<IconName>(() => {
    const tool = this.activeTool();
    return SHAPE_SET.has(tool)
      ? (SHAPE_TOOLS.find((s) => s.tool === tool)?.icon ?? 'shapes')
      : 'shapes';
  });
  protected readonly symbolIcon = computed<IconName>(() => this.editorStore.toolStyle().symbol);

  /** Elemento de la barra que corresponde a la herramienta activa (una herramienta o un menú). */
  protected readonly activeItem = computed(() => {
    const tool = this.activeTool();
    if (SHAPE_SET.has(tool)) return 'shapes';
    return tool === 'symbol' ? 'symbols' : tool;
  });

  protected selectTool(tool: ToolId): void {
    // Pulsar de nuevo la herramienta activa vuelve a "Seleccionar"
    const next = this.activeTool() === tool && tool !== 'select' ? 'select' : tool;
    this.editorStore.setTool(next);
    if (next === 'edit-text')
      this.notifications.info('Haz clic sobre cualquier texto del PDF para cambiarlo');
  }

  protected selectSymbol(kind: SymbolKind): void {
    this.editorStore.updateToolStyle({ symbol: kind });
    this.editorStore.setTool('symbol');
  }

  protected run(action: ToolAction): void {
    const actions: Record<ToolAction, () => Promise<void>> = {
      image: () => this.commands.pickImage(),
      signature: () => this.commands.openSignature(),
      stamp: () => this.commands.openStamp(),
    };
    void actions[action]();
  }
}
