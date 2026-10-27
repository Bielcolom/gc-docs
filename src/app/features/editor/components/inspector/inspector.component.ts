import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DocumentStore, EditorStore } from '@core/state';
import { IconComponent } from '@shared/components';
import { PluralPipe } from '@shared/pipes';
import { TOOL_LABELS } from '../tool-rail/tool-rail.config';
import { InspectorTargetService } from './inspector-target/inspector-target.service';
import { AnnotationActionsComponent } from './panels/annotation-actions/annotation-actions.component';
import { DocumentPanelComponent } from './panels/document-panel/document-panel.component';
import { HighlightPropertiesComponent } from './panels/highlight-properties/highlight-properties.component';
import { NotePropertiesComponent } from './panels/note-properties/note-properties.component';
import { OpacityFieldComponent } from './panels/opacity-field/opacity-field.component';
import { ShapePropertiesComponent } from './panels/shape-properties/shape-properties.component';
import { StampPropertiesComponent } from './panels/stamp-properties/stamp-properties.component';
import { StrokePropertiesComponent } from './panels/stroke-properties/stroke-properties.component';
import { SymbolPropertiesComponent } from './panels/symbol-properties/symbol-properties.component';
import { TextPropertiesComponent } from './panels/text-properties/text-properties.component';
import { ToolHintComponent } from './panels/tool-hint/tool-hint.component';

const ANNOTATION_TITLES: Readonly<Record<string, string>> = {
  text: 'Texto',
  rect: 'Rectángulo',
  ellipse: 'Elipse',
  line: 'Línea',
  arrow: 'Flecha',
  ink: 'Trazo a mano',
  highlight: 'Resaltado',
  image: 'Imagen',
  note: 'Comentario',
  stamp: 'Sello',
  symbol: 'Marca',
};

/**
 * Panel de propiedades. Muestra las opciones de lo seleccionado, las de la herramienta activa
 * o, si no hay ninguna de las dos cosas, las acciones del documento.
 */
@Component({
  selector: 'app-inspector',
  imports: [
    IconComponent,
    PluralPipe,
    TextPropertiesComponent,
    ShapePropertiesComponent,
    StrokePropertiesComponent,
    HighlightPropertiesComponent,
    NotePropertiesComponent,
    StampPropertiesComponent,
    SymbolPropertiesComponent,
    ToolHintComponent,
    OpacityFieldComponent,
    AnnotationActionsComponent,
    DocumentPanelComponent,
  ],
  providers: [InspectorTargetService],
  templateUrl: './inspector.component.html',
  styleUrl: './inspector.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InspectorComponent {
  protected readonly target = inject(InspectorTargetService);
  protected readonly editorStore = inject(EditorStore);
  protected readonly documentStore = inject(DocumentStore);

  protected readonly title = computed(() => {
    const a = this.target.annotation();
    if (!a) return this.target.panel() ? TOOL_LABELS[this.editorStore.tool()] : 'Documento';
    if (a.type === 'text' && a.cover) return 'Texto editado';
    if (a.type === 'image' && a.isSignature) return 'Firma';
    if (a.type === 'rect' && a.fill === '#ffffff' && !a.stroke) return 'Corrector';
    return ANNOTATION_TITLES[a.type];
  });

  protected readonly pageNumber = computed(() => {
    const a = this.target.annotation();
    return (a ? this.documentStore.pageIndex(a.pageId) : this.editorStore.currentPageIndex()) + 1;
  });

  protected readonly showOpacity = computed(() => {
    const panel = this.target.panel();
    return !!panel && panel !== 'edit-text-hint' && panel !== 'whiteout-hint';
  });
}
