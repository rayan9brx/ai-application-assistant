import { TestBed } from '@angular/core/testing';
import { Router, provideRouter, withComponentInputBinding } from '@angular/router';
import { App } from '../app';
import { routes } from '../app.routes';
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
    const picker = root.querySelector<HTMLInputElement>('input[type="file"]')!;
    let pickerOpened = 0;
    picker.click = () => void pickerOpened++;

    // Without a file the button stays live and opens the file picker.
    expect(score.disabled).toBe(false);
    score.click();
    expect(pickerOpened).toBe(1);
    expect(submitted).toEqual([]);

    bar.dispatchEvent(dropEvent(new File(['x'], 'photo.png', { type: 'image/png' })));
    fixture.detectChanges();
    expect(alert()).toContain('PDF or Word');
    expect(bar.classList).toContain('invalid');

    const big = new File(['x'], 'cv.pdf', { type: 'application/pdf' });
    Object.defineProperty(big, 'size', { value: 5 * 1024 * 1024 + 1 });
    bar.dispatchEvent(dropEvent(big));
    fixture.detectChanges();
    expect(alert()).toContain('5 MB');
    score.click();
    expect(submitted).toEqual([]);

    bar.dispatchEvent(dropEvent(new File(['PK'], 'cv.docx')));
    fixture.detectChanges();
    expect(alert()).toBe('');
    expect(root.querySelector('.file-name')?.textContent).toBe('cv.docx');

    score.click();
    expect(submitted.map((file) => file.name)).toEqual(['cv.docx']);

    root.querySelector<HTMLButtonElement>('.remove')!.click();
    fixture.detectChanges();
    expect(root.querySelector('.file-name')).toBeNull();
    expect(fixture.componentInstance.file()).toBeNull();
  });

  it('highlights while dragging and shows a spinner while busy', () => {
    const fixture = TestBed.createComponent(UploadBar);
    fixture.componentRef.setInput('busy', true);
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    const bar = root.querySelector('.upload-bar')!;
    bar.dispatchEvent(new Event('dragover', { cancelable: true }));
    fixture.detectChanges();
    expect(bar.classList).toContain('dragging');
    const score = root.querySelector<HTMLButtonElement>('.score')!;
    expect(score.textContent).toContain('Scoring…');
    expect(score.querySelector('.spinner')).not.toBeNull();
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
