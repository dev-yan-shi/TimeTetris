import { create } from 'zustand';
import { TimeEntry } from '../types';
import * as db from '../services/database';
import { formatDate } from '../utils/time';
import * as Crypto from 'expo-crypto';

interface EntryStore {
  entries: TimeEntry[];
  selectedDate: string;
  isLoaded: boolean;

  setSelectedDate: (date: string) => void;
  loadEntries: (date?: string) => Promise<void>;
  addEntry: (
    startSlot: number,
    endSlot: number,
    categoryId: string,
    label: string | null,
    source: TimeEntry['source']
  ) => Promise<TimeEntry>;
  updateEntry: (entry: TimeEntry) => Promise<void>;
  removeEntry: (id: string) => Promise<void>;
  hasOverlap: (startSlot: number, endSlot: number, excludeId?: string) => boolean;
}

export const useEntryStore = create<EntryStore>((set, get) => ({
  entries: [],
  selectedDate: formatDate(new Date()),
  isLoaded: false,

  setSelectedDate: (date) => {
    set({ selectedDate: date });
  },

  loadEntries: async (date?: string) => {
    const targetDate = date || get().selectedDate;
    const entries = await db.getEntriesForDate(targetDate);
    set({ entries, isLoaded: true, selectedDate: targetDate });
  },

  addEntry: async (startSlot, endSlot, categoryId, label, source) => {
    const now = new Date().toISOString();
    const entry: TimeEntry = {
      id: Crypto.randomUUID(),
      date: get().selectedDate,
      startSlot,
      endSlot,
      categoryId,
      label,
      source,
      createdAt: now,
      updatedAt: now,
    };
    await db.insertTimeEntry(entry);
    set((state) => ({
      entries: [...state.entries, entry].sort((a, b) => a.startSlot - b.startSlot),
    }));
    return entry;
  },

  updateEntry: async (entry) => {
    const updated = { ...entry, updatedAt: new Date().toISOString() };
    await db.updateTimeEntry(updated);
    set((state) => ({
      entries: state.entries
        .map((e) => (e.id === updated.id ? updated : e))
        .sort((a, b) => a.startSlot - b.startSlot),
    }));
  },

  removeEntry: async (id) => {
    await db.deleteTimeEntry(id);
    set((state) => ({
      entries: state.entries.filter((e) => e.id !== id),
    }));
  },

  hasOverlap: (startSlot, endSlot, excludeId?) => {
    return get().entries.some(
      (e) =>
        e.id !== excludeId &&
        startSlot < e.endSlot &&
        endSlot > e.startSlot
    );
  },
}));
