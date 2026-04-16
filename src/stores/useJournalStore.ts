import { create } from 'zustand';
import { JournalEntry, JournalType } from '../types';
import * as db from '../services/database';
import * as Crypto from 'expo-crypto';

interface JournalStore {
  entries: JournalEntry[]; // for selected date (max 2: morning + evening)
  isLoaded: boolean;

  loadEntries: (date: string) => Promise<void>;
  getMorning: () => JournalEntry | undefined;
  getEvening: () => JournalEntry | undefined;
  saveEntry: (
    date: string,
    type: JournalType,
    data: {
      intentions?: string[];
      wins?: string[];
      reflection?: string;
      moodRating?: number | null;
      aiReflection?: string | null;
    }
  ) => Promise<JournalEntry>;
}

export const useJournalStore = create<JournalStore>((set, get) => ({
  entries: [],
  isLoaded: false,

  loadEntries: async (date: string) => {
    const entries = await db.getJournalForDate(date);
    set({ entries, isLoaded: true });
  },

  getMorning: () => get().entries.find((e) => e.type === 'morning'),
  getEvening: () => get().entries.find((e) => e.type === 'evening'),

  saveEntry: async (date, type, data) => {
    const existing = get().entries.find((e) => e.type === type);
    const now = new Date().toISOString();

    const entry: JournalEntry = {
      id: existing?.id || Crypto.randomUUID(),
      date,
      type,
      intentions: data.intentions ?? existing?.intentions ?? [],
      wins: data.wins ?? existing?.wins ?? [],
      reflection: data.reflection ?? existing?.reflection ?? '',
      moodRating: data.moodRating !== undefined ? data.moodRating : existing?.moodRating ?? null,
      aiReflection: data.aiReflection !== undefined ? data.aiReflection : existing?.aiReflection ?? null,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    await db.upsertJournalEntry(entry);

    set((s) => {
      const filtered = s.entries.filter((e) => e.type !== type);
      return { entries: [...filtered, entry] };
    });

    return entry;
  },
}));
