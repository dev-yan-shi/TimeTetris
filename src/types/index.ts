export type EisenhowerQuadrant =
  | 'urgent-important'
  | 'not-urgent-important'
  | 'urgent-not-important'
  | 'not-urgent-not-important'
  | null;

export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  eisenhower: EisenhowerQuadrant;
  isDefault: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface TimeEntry {
  id: string;
  date: string; // "YYYY-MM-DD"
  startSlot: number; // 0-47
  endSlot: number; // exclusive
  categoryId: string;
  label: string | null;
  source: 'voice' | 'manual' | 'quick-tap';
  createdAt: string;
  updatedAt: string;
}

export interface DayAnalysis {
  id: string;
  date: string;
  totalTrackedSlots: number;
  categoryBreakdown: Record<string, number>;
  eisenhowerBreakdown: Record<string, number>;
  generatedInsight: string | null;
  createdAt: string;
}

export interface ParsedEntry {
  activity: string;
  suggestedCategory: string;
  suggestedCategoryId: string | null;
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  confidence: 'high' | 'low';
}

export interface PendingEntry {
  parsed: ParsedEntry;
  startSlot: number;
  endSlot: number;
  categoryId: string;
  label: string;
}

// --- Habits ---

export type HabitFrequency = 'daily' | 'weekdays' | 'custom';

export interface Habit {
  id: string;
  name: string;
  icon: string;
  color: string;
  frequency: HabitFrequency;
  customDays: number[] | null; // 0=Sun, 1=Mon, ..., 6=Sat (for 'custom')
  linkedCategoryId: string | null; // auto-complete when this category is tracked
  sortOrder: number;
  isArchived: boolean;
  createdAt: string;
}

export interface HabitCompletion {
  id: string;
  habitId: string;
  date: string; // "YYYY-MM-DD"
  completed: boolean;
  completedAt: string | null;
}

// --- Journal ---

export type JournalType = 'morning' | 'evening';

export interface JournalEntry {
  id: string;
  date: string; // "YYYY-MM-DD"
  type: JournalType;
  intentions: string[]; // morning: top goals/intentions
  wins: string[]; // evening: wins/accomplishments
  reflection: string; // evening: freeform
  moodRating: number | null; // 1-5
  aiReflection: string | null; // LLM-generated insight
  createdAt: string;
  updatedAt: string;
}
