import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { UploadBar } from './upload-bar';

const dropEvent = (file: File) => {
  const event = new Event('drop', { bubbles: true, cancelable: true }) as DragEvent;
  Object.defineProperty(event, 'dataTransfer', { value: { files: [file] } });
  return event;
};

describe('UploadBar', () => {
  it('enables scoring only after a PDF is dropped and rejects other files', () => {
    const fixture = TestBed.createComponent(UploadBar);
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    const bar = root.querySelector('.upload-bar')!;
    const score = root.querySelector<HTMLButtonElement>('.score')!;
    expect(score.disabled).toBe(true);

    bar.dispatchEvent(dropEvent(new File(['x'], 'cv.docx')));
    fixture.detectChanges();
    expect(score.disabled).toBe(true);
    expect(root.querySelector('[role="alert"]')?.textContent).toContain('Only PDF');

    bar.dispatchEvent(dropEvent(new File(['%PDF-'], 'cv.pdf', { type: 'application/pdf' })));
    fixture.detectChanges();
    expect(score.disabled).toBe(false);
    expect(root.querySelector('#upload-bar-status')?.textContent).toContain('cv.pdf is ready');

    score.click();
    fixture.detectChanges();
    expect(score.disabled).toBe(true);
    expect(root.querySelector('#upload-bar-status')?.textContent).toContain("isn't available yet");
  });
});

describe('App', () => {
  it('renders only the navbar, hero, upload bar and showcase', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const main: HTMLElement = fixture.nativeElement.querySelector('main');
    expect(Array.from(main.children).map((el) => el.tagName.toLowerCase())).toEqual([
      'app-hero',
      'app-upload-bar',
      'app-showcase',
    ]);
    expect(fixture.nativeElement.querySelector('#features')).not.toBeNull();
  });
});
