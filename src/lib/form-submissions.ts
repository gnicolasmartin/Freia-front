import type { FormSubmissionEvent, ButtonActionEvent } from "@/types/front-widgets";

const STORAGE_KEY = "freia_front_form_submissions";
const MAX_ENTRIES = 500;

/** Read all form submission events from localStorage */
export function getFormSubmissions(): FormSubmissionEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as FormSubmissionEvent[]) : [];
  } catch {
    return [];
  }
}

/** Get submissions filtered by frontId */
export function getFormSubmissionsByFront(frontId: string): FormSubmissionEvent[] {
  return getFormSubmissions().filter((e) => e.frontId === frontId);
}

/** Record a new form submission event with traceability */
export function addFormSubmission(event: Omit<FormSubmissionEvent, "id" | "submittedAt">): FormSubmissionEvent {
  const entry: FormSubmissionEvent = {
    ...event,
    id: `fsub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    submittedAt: new Date().toISOString(),
  };

  const all = getFormSubmissions();
  all.unshift(entry);

  // Keep only the most recent entries
  if (all.length > MAX_ENTRIES) {
    all.length = MAX_ENTRIES;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    /* storage full — ignore */
  }

  return entry;
}

// --- Button action events ---

const BUTTON_ACTIONS_KEY = "freia_front_button_actions";

export function getButtonActions(): ButtonActionEvent[] {
  try {
    const raw = localStorage.getItem(BUTTON_ACTIONS_KEY);
    return raw ? (JSON.parse(raw) as ButtonActionEvent[]) : [];
  } catch {
    return [];
  }
}

export function addButtonAction(event: Omit<ButtonActionEvent, "id" | "triggeredAt">): ButtonActionEvent {
  const entry: ButtonActionEvent = {
    ...event,
    id: `bact_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    triggeredAt: new Date().toISOString(),
  };

  const all = getButtonActions();
  all.unshift(entry);
  if (all.length > MAX_ENTRIES) all.length = MAX_ENTRIES;

  try {
    localStorage.setItem(BUTTON_ACTIONS_KEY, JSON.stringify(all));
  } catch { /* ignore */ }

  return entry;
}
