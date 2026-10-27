import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  Router,
  UrlTree,
  type ActivatedRouteSnapshot,
  type RouterStateSnapshot,
} from '@angular/router';
import { DocumentStore } from '@core/state';
import { documentLoadedGuard } from './document-loaded.guard';

describe('documentLoadedGuard', () => {
  const hasDocument = signal(false);

  const run = (): unknown =>
    TestBed.runInInjectionContext(() =>
      documentLoadedGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: DocumentStore, useValue: { hasDocument } }],
    });
  });

  it('deja pasar si hay un documento abierto', () => {
    hasDocument.set(true);
    expect(run()).toBe(true);
  });

  it('redirige al inicio si no hay documento', () => {
    hasDocument.set(false);
    const result = run();
    expect(result).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/');
  });
});
