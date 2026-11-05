export interface ApplicationInput {
  jobTitle: string;
  company: string;
  language: string;
  sourceCv: string;
  jobDescription: string;
  includeLetter: boolean;
  motivation: string;
  editedCv: string;
  editedLetter: string | null;
  demo: boolean;
  version?: number;
}

export interface SavedApplication extends ApplicationInput {
  id: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationSummary {
  id: string;
  jobTitle: string;
  company: string;
  language: string;
  demo: boolean;
  version: number;
  updatedAt: string;
}

export interface ApplicationPage {
  items: ApplicationSummary[];
  page: number;
  size: number;
  total: number;
}
