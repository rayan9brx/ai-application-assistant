import { Component, inject, input } from '@angular/core';
import { Auth } from './auth';

export interface NavLink<T extends string = string> {
  href: string;
  section: T;
  label: string;
}

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
})
export class Navbar {
  readonly auth = inject(Auth);
  readonly links = input.required<readonly NavLink[]>();
  readonly active = input.required<string>();
}
