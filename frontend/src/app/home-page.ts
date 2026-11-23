import { Component, inject, signal } from '@angular/core';
import { AuthService, signupUrl } from './auth.service';
import { CvExamplesSection } from './cv-examples-section';
import { CvFlow } from './cv-flow';
import { DemoWindow } from './demo-window';
import { Hero } from './hero';
import { HowItWorks } from './how-it-works';
import { HurdlesSection } from './hurdles-section';
import { CHECK_HREF } from './menu-config';
import { Navigation } from './navigation';
import { ProblemSection } from './problem-section';
import { Showcase } from './showcase';
import { UploadBar } from './upload-bar';

/** The landing page. */
@Component({
  selector: 'app-home-page',
  imports: [CvExamplesSection, DemoWindow, Hero, HowItWorks, HurdlesSection, ProblemSection, Showcase, UploadBar],
  template: `
    <app-hero />
    <app-upload-bar
      id="get-started"
      [busy]="starting()"
      [browseWhenEmpty]="auth.signedIn()"
      (selected)="picked($event)"
      (submitted)="startCheck($event)"
      (emptySubmit)="toSignup()"
    />
    <app-demo-window />
    <app-showcase />
    <app-problem-section />
    <app-hurdles-section />
    <app-how-it-works />
    <app-cv-examples-section />
  `,
})
export class HomePage {
  private readonly navigation = inject(Navigation);
  private readonly flow = inject(CvFlow);
  readonly auth = inject(AuthService);
  readonly starting = signal(false);

  /** Guests don't need to press "Score my CV": picking a file already leads to sign-up. */
  picked(file: File | null): void {
    if (file && !this.auth.signedIn()) void this.startCheck(file);
  }

  /** "Score my CV" without a file, as a guest. */
  toSignup(): void {
    void this.navigation.go(signupUrl(CHECK_HREF));
  }

  /**
   * Hands the file to the checker, which starts scoring it as soon as /check opens. A guest
   * signs up (or logs in) first; the file waits in memory, so it is still there after a log-in
   * in this tab, but not after a reload (e.g. an email confirmation link).
   */
  async startCheck(file: File): Promise<void> {
    if (this.starting()) return;
    this.starting.set(true);
    this.flow.reset();
    this.flow.handOff(file);
    const signedIn = this.auth.signedIn();
    try {
      const done = await this.navigation.go(signedIn ? CHECK_HREF : signupUrl(CHECK_HREF));
      if (!done && signedIn) this.flow.takeHandOff();
    } catch {
      this.flow.takeHandOff();
    } finally {
      this.starting.set(false);
    }
  }
}
