import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  cvText = '';
  jobText = '';
  readonly showDemo = signal(false);

  analyze(): void {
    if (!this.cvText.trim() || !this.jobText.trim()) return;
    this.showDemo.set(true);
  }

  clearResult(): void {
    this.showDemo.set(false);
  }
}