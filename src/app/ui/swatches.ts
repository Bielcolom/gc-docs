import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Icon } from './icon';

@Component({
  selector: 'app-swatches',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="row" role="radiogroup">
      @if (allowNone()) {
        <button type="button" class="sw none" [class.on]="value() === null" title="Sin color" (click)="pick.emit(null)" role="radio" [attr.aria-checked]="value() === null">
          <app-icon name="close" [size]="13" />
        </button>
      }
      @for (c of colors(); track c) {
        <button
          type="button"
          class="sw"
          [class.on]="value()?.toLowerCase() === c"
          [class.light]="c === '#ffffff'"
          [style.--c]="c"
          [title]="c"
          role="radio"
          [attr.aria-checked]="value()?.toLowerCase() === c"
          (click)="pick.emit(c)"
        ></button>
      }
      <label class="sw custom" title="Otro color" [class.on]="value() !== null && !colors().includes(value()!.toLowerCase())" [style.--c]="value() ?? '#ffffff'">
        <input type="color" [value]="value() ?? '#000000'" (input)="pick.emit($any($event.target).value)" aria-label="Elegir otro color" />
      </label>
    </div>
  `,
  styles: `
    .row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .sw {
      position: relative;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      border: 0;
      padding: 0;
      background: var(--c);
      cursor: pointer;
      box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.12);
      display: grid;
      place-items: center;
      color: var(--ink-3);
    }
    .sw.light {
      box-shadow: inset 0 0 0 1px var(--line-strong);
    }
    .sw.on {
      box-shadow:
        0 0 0 2px var(--surface),
        0 0 0 4px var(--ink);
    }
    .sw.none {
      background: var(--surface-2);
      box-shadow: inset 0 0 0 1px var(--line-strong);
    }
    .sw.none.on {
      box-shadow:
        0 0 0 2px var(--surface),
        0 0 0 4px var(--ink);
    }
    .custom {
      background: conic-gradient(from 0deg, #ff5f57, #ffbd2e, #28c840, #2a6fdb, #8e3fb8, #ff5f57);
      overflow: hidden;
    }
    .custom::after {
      content: '';
      position: absolute;
      inset: 6px;
      border-radius: 50%;
      background: var(--c);
      box-shadow: 0 0 0 1.5px #fff;
    }
    .custom input {
      position: absolute;
      inset: 0;
      opacity: 0;
      cursor: pointer;
    }
  `,
})
export class Swatches {
  readonly colors = input.required<string[]>();
  readonly value = input<string | null>(null);
  readonly allowNone = input(false);
  readonly pick = output<string | null>();
}
