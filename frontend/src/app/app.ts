import { Component } from '@angular/core';
import { Hero } from './hero';
import { Navbar, NavLink } from './navbar';
import { ProblemSection } from './problem-section';
import { Showcase } from './showcase';
import { UploadBar } from './upload-bar';

@Component({
  selector: 'app-root',
  imports: [Hero, Navbar, ProblemSection, Showcase, UploadBar],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  readonly navLinks: NavLink[] = [
    { href: '#features', label: 'Features' },
    { href: '#problem', label: 'Why ATS matters' },
  ];
}
