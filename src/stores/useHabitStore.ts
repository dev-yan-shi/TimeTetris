import { create } from 'zustand';
import { Habit, HabitCompletion } from '../types';
import * as db from '../services/database';
import * as Crypto from 'expo-crypto';
import { formatDate } from '../utils/time';

interface HabitStore {
  habits: Habit[];
  completions: HabitCompletion[]; // for selected date
  isLoaded: boolean;

  loadHabits: () => Promise<void>;
  loadCompletions: (date: string) => Promise<void>;
  addHabit: (name: string, icon: string, color: string, frequency: Habit['frequency'], customDays: number[] | null, linkedCategoryId: string | null) => Promise<Habit>;
  updateHabit: (habit: Habit) => Promise<void>;
  removeHabit: (id: string) => Promise<void>;
  toggleCompletion: (habitId: string, date: string) => Promise<void>;
  isCompleted: (habitId: string) => boolean;
  getCompletionRate: (habitId: string, completions: HabitCompletion[]) => number;
  isHabitDueToday: (habit: Habit, date: string) => boolean;
}

export const useHabitStore = create<HabitStore>((set, get) => ({
  habits: [],
  completions: [],
  isLoaded: false,

  loadHabits: async () => {
    const habits = await db.getAllHabits();
    set({ habits, isLoaded: true });
  },

  loadCompletions: async (date: string) => {
    const completions = await db.getCompletionsForDate(date);
    set({ completions });
  },

  addHabit: async (name, icon, color, frequency, customDays, linkedCategoryId) => {
    const maxOrder = Math.max(0, ...get().habits.map((h) => h.sortOrder));
    const habit: Habit = {
      id: Crypto.randomUUID(),
      name,
      icon,
      color,
      frequency,
      customDays,
      linkedCategoryId,
      sortOrder: maxOrder + 1,
      isArchived: false,
      createdAt: new Date().toISOString(),
    };
    await db.insertHabit(habit);
    set((s) => ({ habits: [...s.habits, habit] }));
    return habit;
  },

  updateHabit: async (habit) => {
    await db.updateHabit(habit);
    set((s) => ({ habits: s.habits.map((h) => (h.id === habit.id ? habit : h)) }));
  },

  removeHabit: async (id) => {
    await db.deleteHabit(id);
    set((s) => ({
      habits: s.habits.filter((h) => h.id !== id),
      completions: s.completions.filter((c) => c.habitId !== id),
    }));
  },

  toggleCompletion: async (habitId, date) => {
    const existing = get().completions.find((c) => c.habitId === habitId);
    const nowCompleted = !existing?.completed;
    const completion: HabitCompletion = {
      id: existing?.id || Crypto.randomUUID(),
      habitId,
      date,
      completed: nowCompleted,
      completedAt: nowCompleted ? new Date().toISOString() : null,
    };
    await db.upsertCompletion(completion);

    set((s) => {
      const filtered = s.completions.filter((c) => c.habitId !== habitId);
      return { completions: [...filtered, completion] };
    });
  },

  isCompleted: (habitId) => {
    return get().completions.some((c) => c.habitId === habitId && c.completed);
  },

  getCompletionRate: (habitId, completions) => {
    const relevant = completions.filter((c) => c.habitId === habitId);
    if (relevant.length === 0) return 0;
    const completed = relevant.filter((c) => c.completed).length;
    return Math.round((completed / relevant.length) * 100);
  },

  isHabitDueToday: (habit, date) => {
    const d = new Date(date + 'T12:00:00');
    const dayOfWeek = d.getDay(); // 0=Sun

    switch (habit.frequency) {
      case 'daily':
        return true;
      case 'weekdays':
        return dayOfWeek >= 1 && dayOfWeek <= 5;
      case 'custom':
        return habit.customDays?.includes(dayOfWeek) ?? false;
      default:
        return true;
    }
  },
}));
