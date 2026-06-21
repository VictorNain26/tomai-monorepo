export interface NormalizedGrade {
  subject: string;
  value: number | null;           // null = unmarked / "absent" (pawnote GradeKind !== Grade)
  scale: number;                  // e.g. 20
  date: string;                   // ISO date
  comment: string | null;
  coefficient: number;            // always present in pawnote Grade
  classAverage: number | null;    // pawnote Grade.average?.points (optional)
  max: number | null;             // pawnote Grade.max?.points (optional)
  min: number | null;             // pawnote Grade.min?.points (optional)
}

export interface NormalizedHomework {
  subject: string;
  description: string;
  dueDate: string;          // ISO date
  done: boolean;
}

export interface NormalizedLesson {
  subject: string;
  start: string;            // ISO datetime
  end: string;              // ISO datetime
  room: string | null;
  canceled: boolean;
}

export interface ProviderSession {
  token: string;            // rotated token to re-persist after use
  username: string;
}

export interface DiscoveredResource {
  resourceId: number;
  name: string;
  className: string | null;
  establishmentName: string;
}

export interface PronoteChildStatus {
  hasPronote: boolean;
  establishmentName: string | null;
  className: string | null;
}

export interface PronoteProvider {
  connect(input: { url: string; kind: number; username: string; token: string; deviceUuid: string }): Promise<ProviderSession>;
  getGrades(session: ProviderSession, resourceId: number): Promise<NormalizedGrade[]>;
  getHomework(session: ProviderSession, resourceId: number): Promise<NormalizedHomework[]>;
  getTimetable(session: ProviderSession, resourceId: number, day: string): Promise<NormalizedLesson[]>;
  disconnect(session: ProviderSession): Promise<void>;
}
