import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { ColorSwatchesComponent } from './color-swatches.component';

describe('ColorSwatchesComponent', () => {
  let fixture: ComponentFixture<ColorSwatchesComponent>;
  let host: HTMLElement;

  const radios = (): HTMLButtonElement[] =>
    Array.from(host.querySelectorAll('button[role="radio"]'));

  beforeEach(async () => {
    fixture = TestBed.createComponent(ColorSwatchesComponent);
    fixture.componentRef.setInput('colors', ['#000000', '#ff0000']);
    fixture.componentRef.setInput('value', '#FF0000');
    host = fixture.nativeElement;
    await fixture.whenStable();
  });

  it('muestra una muestra por color y marca la activa sin distinguir mayúsculas', () => {
    expect(radios()).toHaveLength(2);
    expect(radios()[1].getAttribute('aria-checked')).toBe('true');
    expect(radios()[0].getAttribute('aria-checked')).toBe('false');
  });

  it('emite el color elegido', () => {
    const emitted: (string | null)[] = [];
    fixture.componentInstance.valueChange.subscribe((v) => emitted.push(v));
    radios()[0].click();
    expect(emitted).toEqual(['#000000']);
  });

  it('ofrece "sin color" solo si se permite', async () => {
    expect(host.querySelector('.swatch--none')).toBeNull();
    fixture.componentRef.setInput('allowNone', true);
    await fixture.whenStable();

    const emitted: (string | null)[] = [];
    fixture.componentInstance.valueChange.subscribe((v) => emitted.push(v));
    host.querySelector<HTMLButtonElement>('.swatch--none')!.click();
    expect(emitted).toEqual([null]);
  });

  it('marca el selector personalizado cuando el valor no está entre las muestras', async () => {
    fixture.componentRef.setInput('value', '#123456');
    await fixture.whenStable();
    expect(host.querySelector('.swatch--custom')!.classList).toContain('is-active');
  });
});
