import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DialogShellComponent } from '@shared/components';

interface ShortcutGroup {
  readonly title: string;
  readonly items: readonly { readonly keys: readonly string[]; readonly description: string }[];
}

@Component({
  selector: 'app-shortcuts-dialog',
  imports: [DialogShellComponent],
  templateUrl: './shortcuts-dialog.component.html',
  styleUrl: './shortcuts-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShortcutsDialogComponent {
  protected readonly groups: readonly ShortcutGroup[] = [
    {
      title: 'Herramientas',
      items: [
        { keys: ['V'], description: 'Seleccionar y mover' },
        { keys: ['E'], description: 'Editar texto del PDF' },
        { keys: ['T'], description: 'Añadir texto' },
        { keys: ['H'], description: 'Resaltar' },
        { keys: ['D'], description: 'Dibujar' },
        { keys: ['R', 'O', 'L', 'A'], description: 'Rectángulo, elipse, línea, flecha' },
        { keys: ['W'], description: 'Tapar' },
        { keys: ['I', 'S', 'N'], description: 'Imagen, firma, comentario' },
      ],
    },
    {
      title: 'Edición',
      items: [
        { keys: ['Ctrl', 'Z'], description: 'Deshacer' },
        { keys: ['Ctrl', '⇧', 'Z'], description: 'Rehacer' },
        { keys: ['Ctrl', 'D'], description: 'Duplicar elemento' },
        { keys: ['Supr'], description: 'Eliminar elemento' },
        { keys: ['←', '→', '↑', '↓'], description: 'Mover (con ⇧, más rápido)' },
        { keys: ['Intro'], description: 'Editar el texto seleccionado' },
        { keys: ['Esc'], description: 'Terminar o deseleccionar' },
      ],
    },
    {
      title: 'Documento',
      items: [
        { keys: ['G'], description: 'Organizar páginas' },
        { keys: ['Ctrl', 'S'], description: 'Descargar PDF' },
        { keys: ['Ctrl', 'O'], description: 'Abrir' },
        { keys: ['Ctrl', 'F'], description: 'Buscar' },
        { keys: ['Ctrl', 'P'], description: 'Imprimir' },
        { keys: ['Ctrl', '+', '−'], description: 'Zoom' },
        { keys: ['Ctrl', '0'], description: 'Ajustar al ancho' },
      ],
    },
    {
      title: 'Organizar',
      items: [
        { keys: ['Ctrl', 'A'], description: 'Seleccionar todas' },
        { keys: ['Alt', '←', '→'], description: 'Mover la selección' },
        { keys: ['R'], description: 'Girar (⇧ R al revés)' },
        { keys: ['Supr'], description: 'Eliminar páginas' },
        { keys: ['Intro'], description: 'Abrir en el editor' },
      ],
    },
  ];
}
