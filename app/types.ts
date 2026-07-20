// NotaryJose types — source of truth para admin + público.

export type FirestoreTimestampish =
  | { seconds: number; nanoseconds: number }
  | { toDate: () => Date; toMillis: () => number }
  | string
  | Date
  | null
  | undefined;

// ─── Booking ────────────────────────────────────────────────
// Slot = "YYYY-MM-DDTHH:00:00" en tz local America/Chicago.
// El doc id en Firestore es el slot con `:` reemplazado por `-`
// (Firestore no permite `:` en doc IDs). Único por slot = evita
// double-booking atómicamente vía `create` que falla si existe.

export interface Booking {
  id: string;                             // doc id (slot key)
  slot: string;                           // ISO local original (con `:`)
  slotDate: string;                       // "YYYY-MM-DD"
  slotHour: number;                       // 8..19
  customerName: string;
  customerPhone: string;                  // 10 dígitos US
  userId: string;                         // Firebase Auth uid
  status: 'confirmed' | 'cancelled';
  notes?: string;
  cancelledBy?: 'user' | 'owner' | 'admin';
  createdAt?: FirestoreTimestampish;
  cancelledAt?: FirestoreTimestampish;
  reminder8amSent?: boolean;
  reminder1hSent?: boolean;
}

// ─── Working hours ───────────────────────────────────────────
// Doc único notaryjose_config/hours. Admin configura qué horas
// están disponibles cada día de la semana. Default: 8..19 (12 slots)
// todos los días. Admin puede cerrar días enteros o horas específicas.

export interface WorkingHours {
  // hoursByDayOfWeek: por cada día 0=Sun..6=Sat, arreglo de horas
  // ABIERTAS (8..19). Ausente = usa DEFAULT_HOURS.
  hoursByDayOfWeek?: Partial<Record<number, number[]>>;
  // blockedDates: fechas específicas cerradas (feriados, vacaciones).
  // Formato "YYYY-MM-DD".
  blockedDates?: string[];
  updatedAt?: FirestoreTimestampish;
}

export const DEFAULT_HOURS = [
  8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
] as const;

export const OPERATION_TZ = 'America/Chicago';
