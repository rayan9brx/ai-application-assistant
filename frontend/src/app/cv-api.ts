import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CvScore } from './cv-flow';
import { OnboardingAnswers } from './onboarding-options';

/** Mirrors AccountController's records on the backend. */
export interface Profile {
  id: string;
  email: string | null;
  fullName: string | null;
  plan: 'free' | 'pro' | 'lifetime';
  /** Set only in the database; the backend checks it again on every admin request. */
  role: 'user' | 'admin';
  createdAt: string;
}
/** "edit" (Settings) keeps whether the flow was finished or skipped as it is. */
export type OnboardingStatus = 'progress' | 'completed' | 'skipped' | 'edit';
export interface OnboardingState {
  answers: OnboardingAnswers;
  completed: boolean;
  skippedAtStep: number | null;
  /** Finished or skipped: the flow is never shown again. */
  done: boolean;
}
export interface CvContent {
  text: string;
}
export interface CvSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  lastScore: number | null;
  lastScoredAt: string | null;
  /** The start of the CV text, for the dashboard's mini page. */
  preview: string;
}
export interface Usage {
  cvs: number;
  aiUsesThisMonth: number;
}
export interface SavedCv {
  id: string;
  title: string;
  content: CvContent;
  jobDescription: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface SavedAnalysis {
  id: string;
  cvId: string;
  overallScore: number;
  categoryScores: CvScore['categories'];
  result: CvScore;
  createdAt: string;
}
export interface CvInput {
  title: string;
  content: CvContent;
  jobDescription: string | null;
}

/** Account and saved-CV endpoints; the auth interceptor adds the access token. */
@Injectable({ providedIn: 'root' })
export class CvApi {
  private readonly http = inject(HttpClient);

  me(): Promise<Profile> {
    return firstValueFrom(this.http.get<Profile>('/api/me'));
  }
  updateMe(fullName: string): Promise<Profile> {
    return firstValueFrom(this.http.patch<Profile>('/api/me', { fullName }));
  }
  onboarding(): Promise<OnboardingState> {
    return firstValueFrom(this.http.get<OnboardingState>('/api/me/onboarding'));
  }
  saveOnboarding(answers: OnboardingAnswers, status: OnboardingStatus, step?: number): Promise<OnboardingState> {
    return firstValueFrom(
      this.http.put<OnboardingState>('/api/me/onboarding', { answers, status, step: step ?? null }),
    );
  }
  usage(): Promise<Usage> {
    return firstValueFrom(this.http.get<Usage>('/api/me/usage'));
  }
  deleteMe(): Promise<void> {
    return firstValueFrom(this.http.delete<void>('/api/me'));
  }
  list(): Promise<CvSummary[]> {
    return firstValueFrom(this.http.get<CvSummary[]>('/api/cvs'));
  }
  get(id: string): Promise<SavedCv> {
    return firstValueFrom(this.http.get<SavedCv>(`/api/cvs/${id}`));
  }
  create(cv: CvInput): Promise<SavedCv> {
    return firstValueFrom(this.http.post<SavedCv>('/api/cvs', cv));
  }
  update(id: string, cv: CvInput): Promise<SavedCv> {
    return firstValueFrom(this.http.put<SavedCv>(`/api/cvs/${id}`, cv));
  }
  duplicate(id: string): Promise<SavedCv> {
    return firstValueFrom(this.http.post<SavedCv>(`/api/cvs/${id}/duplicate`, null));
  }
  remove(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/cvs/${id}`));
  }
  history(id: string): Promise<SavedAnalysis[]> {
    return firstValueFrom(this.http.get<SavedAnalysis[]>(`/api/cvs/${id}/analyses`));
  }
  saveAnalysis(id: string, result: CvScore): Promise<SavedAnalysis> {
    return firstValueFrom(this.http.post<SavedAnalysis>(`/api/cvs/${id}/analyses`, { result }));
  }
}
