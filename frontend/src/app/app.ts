import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly http = inject(HttpClient);

  readonly backendStatus = signal('Checking backend...');
  readonly isLoading = signal(false);
  readonly analysisMessage = signal('');
  readonly analysisError = signal('');

  cvText = '';
  jobText = '';

  // Check the backend connection when the page opens.
  constructor() {
    this.http
      .get<{ status: string }>('http://localhost:8080/api/health')
      .subscribe({
        next: (response) => {
          this.backendStatus.set(
            response.status === 'ok'
              ? 'Backend connected'
              : 'Unexpected backend response'
          );
        },
        error: () => {
          this.backendStatus.set('Cannot connect to backend');
        },
      });
  }

  // Send both texts to the backend and display its response.
  analyze(): void {
    if (!this.cvText.trim() || !this.jobText.trim() || this.isLoading()) {
      return;
    }

    this.analysisMessage.set('');
    this.analysisError.set('');

    if (this.cvText.length > 30000 || this.jobText.length > 30000) {
      this.analysisError.set(
        'Keep each text within 30,000 characters.'
      );
      return;
    }

    this.isLoading.set(true);

    this.http
      .post<{ message: string }>('http://localhost:8080/api/analyze', {
        cvText: this.cvText,
        jobText: this.jobText,
      })
      .subscribe({
        next: (response) => {
          this.analysisMessage.set(response.message);
          this.isLoading.set(false);
        },
        error: (error) => {
          this.analysisError.set(
            error.status === 400
              ? 'Enter both texts and keep each within 30,000 characters.'
              : 'Request failed. Check that the backend is running.'
          );
          this.isLoading.set(false);
        },
      });
  }

  // Clear previous results when either input changes.
  clearResult(): void {
    this.analysisMessage.set('');
    this.analysisError.set('');
  }
}