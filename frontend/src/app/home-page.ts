import { Component, inject, signal } from '@angular/core';
import { CvFlow } from './cv-flow';
import { DemoWindow } from './demo-window';
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
  imports: [DemoWindow, Hero, HurdlesSection, ProblemSection, Showcase, UploadBar],
  template: `
    <app-hero />
    <app-upload-bar id="get-started" [busy]="starting()" (submitted)="startCheck($event)" />
    <app-demo-window />
    <app-showcase />
    <app-problem-section />
    <app-hurdles-section />
  `,
})
export class HomePage {
  private readonly navigation = inject(Navigation);
  private readonly flow = inject(CvFlow);
  readonly starting = signal(false);

  /** Hands the file to the checker, which starts scoring it as soon as /check opens. */
  async startCheck(file: File): Promise<void> {
    if (this.starting()) return;
    this.starting.set(true);
    this.flow.reset();
    this.flow.handOff(file);
    try {
      if (!(await this.navigation.go(CHECK_HREF))) this.flow.takeHandOff();
    } catch {
      this.flow.takeHandOff();
    } finally {
      this.starting.set(false);
    }
  }
}
