import { TestBed } from '@angular/core/testing';
import { Router, provideRouter, withComponentInputBinding } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';
import { UploadBar } from './upload-bar';

const dropEvent = (file: File) => {
  const event = new Event('drop', { bubbles: true, cancelable: true }) as DragEvent;
  Object.defineProperty(event, 'dataTransfer', { value: { files: [file] } });
  return event;
};

describe('UploadBar', () => {
  it('accepts PDF and DOCX, rejects other files and oversized ones, and submits the file', () => {
    const fixture = TestBed.createComponent(UploadBar);
    const submitted: File[] = [];
    fixture.componentInstance.submitted.subscribe((file) => submitted.push(file));
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    const bar = root.querySelector('.upload-bar')!;
    const score = root.querySelector<HTMLButtonElement>('.score')!;
    const alert = () => root.querySelector('[role="alert"]')?.textContent ?? '';
    expect(score.disabled).toBe(true);

    bar.dispatchEvent(dropEvent(new File(['x'], 'photo.png', { type: 'image/png' })));
    fixture.detectChanges();
    expect(score.disabled).toBe(true);
    expect(alert()).toContain('PDF or Word');

    const big = new File(['x'], 'cv.pdf', { type: 'application/pdf' });
    Object.defineProperty(big, 'size', { value: 5 * 1024 * 1024 + 1 });
    bar.dispatchEvent(dropEvent(big));
    fixture.detectChanges();
    expect(score.disabled).toBe(true);
    expect(alert()).toContain('5 MB');

    bar.dispatchEvent(dropEvent(new File(['PK'], 'cv.docx')));
    fixture.detectChanges();
    expect(score.disabled).toBe(false);
    expect(root.querySelector('#upload-bar-status')?.textContent).toContain('cv.docx is ready');

    score.click();
    expect(submitted.map((file) => file.name)).toEqual(['cv.docx']);
  });
});

describe('App', () => {
  it('renders the landing sections in order', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes, withComponentInputBinding())] });
    const fixture = TestBed.createComponent(App);
    await TestBed.inject(Router).navigateByUrl('/');
    fixture.detectChanges();
    await fixture.whenStable();
    const home: HTMLElement = fixture.nativeElement.querySelector('main app-home-page');
    expect(Array.from(home.children).map((el) => el.tagName.toLowerCase())).toEqual([
      'app-hero',
      'app-upload-bar',
      'app-showcase',
      'app-problem-section',
      'app-hurdles-section',
    ]);
    expect(fixture.nativeElement.querySelector('#features')).not.toBeNull();
  });
});
