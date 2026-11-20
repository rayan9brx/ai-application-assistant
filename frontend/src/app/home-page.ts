import { Component, inject } from '@angular/core';
import { CvFlow } from './cv-flow';
import { Hero } from './hero';
import { HurdlesSection } from './hurdles-section';
import { CHECK_HREF } from './menu-config';
import { Navigation } from './navigation';
import { ProblemSection } from './problem-section';
import { Showcase } from './showcase';
import { UploadBar } from './upload-bar';

/** The landing page. */
@Component({
  selector: 'app-home-page',
  imports: [Hero, HurdlesSection, ProblemSection, Showcase, UploadBar],
  template: `
    <app-hero />
    <app-upload-bar id="get-started" (submitted)="startCheck($event)" />
    <app-showcase />
    <app-problem-section />
    <app-hurdles-section />
  `,
})
export class HomePage {
  private readonly navigation = inject(Navigation);
  private readonly flow = inject(CvFlow);

  /** The landing upload bar hands its file to the checker and opens it. */
  startCheck(file: File): void {
    this.flow.reset();
    void this.navigation.go(CHECK_HREF);
    void this.flow.startWithFile(file);
  }
}
