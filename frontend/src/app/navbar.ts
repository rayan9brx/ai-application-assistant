import { Component, input } from '@angular/core';

export interface NavLink {
  href: string;
  label: string;
}

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
})
export class Navbar {
  readonly links = input.required<readonly NavLink[]>();
}
