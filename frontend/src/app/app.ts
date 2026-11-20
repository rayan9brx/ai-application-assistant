import { Component } from '@angular/core';
import { Hero } from './hero';
import { Navbar, NavLink } from './navbar';
import { Showcase } from './showcase';
import { UploadBar } from './upload-bar';

@Component({
  selector: 'app-root',
  imports: [Hero, Navbar, Showcase, UploadBar],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  readonly navLinks: NavLink[] = [{ href: '#features', label: 'Features' }];
}
