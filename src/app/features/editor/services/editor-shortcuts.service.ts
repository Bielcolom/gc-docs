import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import type { ToolId } from '@core/models';
import { DocumentStore, EditorStore } from '@core/state';
import { handleShortcuts, isTypingTarget, type ShortcutMap } from '@core/utils';
import { DialogService } from '@features/dialogs/dialog.service';
import { APP_PATHS } from '@core/constants';
import { EditorCommandsService } from './editor-commands.service';

const TOOL_SHORTCUTS: Readonly<Record<string, ToolId>> = {
  v: 'select',
  e: 'edit-text',
  t: 'text',
  h: 'highlight',
  d: 'ink',
  r: 'rect',
  o: 'ellipse',
  l: 'line',
  a: 'arrow',
  w: 'whiteout',
  n: 'note',
};

const NUDGE = 1;
const NUDGE_FAST = 10;

/** Atajos de teclado propios del editor. */
@Injectable({ providedIn: 'root' })
export class EditorShortcutsService {
  private readonly documentStore = inject(DocumentStore);
  private readonly editorStore = inject(EditorStore);
  private readonly commands = inject(EditorCommandsService);
  private readonly dialogs = inject(DialogService);
  private readonly router = inject(Router);

  handle(event: KeyboardEvent): void {
    if (this.dialogs.hasOpenDialogs()) return;
    if (handleShortcuts(event, this.globalShortcuts())) return;
    if (isTypingTarget(event.target)) return;
    // Mientras se abre un cuadro de texto, las teclas son para escribir
    if (this.editorStore.editingAnnotationId() && event.key !== 'Escape') return;
    if (this.editorStore.selectedAnnotation() && handleShortcuts(event, this.selectionShortcuts()))
      return;
    handleShortcuts(event, this.toolShortcuts());
  }

  /** Funcionan incluso escribiendo en un campo. */
  private globalShortcuts(): ShortcutMap {
    return {
      'mod+f': () => {
        this.editorStore.sidebarOpen.set(true);
        this.editorStore.sidebarTab.set('search');
      },
      'mod+=, mod+plus': () => this.editorStore.stepZoom(1),
      'mod+-': () => this.editorStore.stepZoom(-1),
      'mod+0': () => this.editorStore.requestFit('width'),
    };
  }

  private selectionShortcuts(): ShortcutMap {
    const selected = this.editorStore.selectedAnnotation();
    return {
      'delete, backspace': () => this.commands.deleteSelected(),
      'mod+d': () => this.commands.duplicateSelected(),
      enter: () => {
        if (selected?.type === 'text' || selected?.type === 'note')
          this.editorStore.startEditing(selected.id);
      },
      arrowleft: () => this.commands.nudgeSelected(-NUDGE, 0),
      arrowright: () => this.commands.nudgeSelected(NUDGE, 0),
      arrowup: () => this.commands.nudgeSelected(0, -NUDGE),
      arrowdown: () => this.commands.nudgeSelected(0, NUDGE),
      'shift+arrowleft': () => this.commands.nudgeSelected(-NUDGE_FAST, 0),
      'shift+arrowright': () => this.commands.nudgeSelected(NUDGE_FAST, 0),
      'shift+arrowup': () => this.commands.nudgeSelected(0, -NUDGE_FAST),
      'shift+arrowdown': () => this.commands.nudgeSelected(0, NUDGE_FAST),
      'mod+b': () => this.toggleTextStyle('bold'),
      'mod+i': () => this.toggleTextStyle('italic'),
      'mod+u': () => this.toggleTextStyle('underline'),
    };
  }

  private toolShortcuts(): ShortcutMap {
    const map: Record<string, () => void> = {
      escape: () => this.escape(),
      'pagedown, arrowright': () => this.commands.goToPage(this.editorStore.currentPageIndex() + 1),
      'pageup, arrowleft': () => this.commands.goToPage(this.editorStore.currentPageIndex() - 1),
      i: () => void this.commands.pickImage(),
      s: () => void this.commands.openSignature(),
      g: () => void this.router.navigate(APP_PATHS.organizer),
    };
    for (const [key, tool] of Object.entries(TOOL_SHORTCUTS))
      map[key] = () => this.editorStore.setTool(tool);
    return map;
  }

  private escape(): void {
    if (this.editorStore.editingAnnotationId()) this.editorStore.stopEditing();
    else if (this.editorStore.selectedAnnotationId()) this.editorStore.selectAnnotation(null);
    else if (this.editorStore.tool() !== 'select') this.editorStore.setTool('select');
    else this.editorStore.clearPageSelection();
  }

  private toggleTextStyle(property: 'bold' | 'italic' | 'underline'): void {
    const selected = this.editorStore.selectedAnnotation();
    if (selected?.type === 'text')
      this.documentStore.updateAnnotation(selected.id, { [property]: !selected[property] });
  }
}
