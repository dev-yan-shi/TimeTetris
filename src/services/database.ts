import * as SQLite from 'expo-sqlite';
import { Category, TimeEntry, Habit, HabitCompletion, JournalEntry } from '../types';
import { createDefaultCategories } from '../constants/defaultCategories';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  db = await SQLite.openDatabaseAsync('timetetris.db');
  await initDatabase(db);
  return db;
}

async function initDatabase(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      icon TEXT,
      eisenhower TEXT,
      is_default INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS time_entries (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      start_slot INTEGER NOT NULL,
      end_slot INTEGER NOT NULL,
      category_id TEXT NOT NULL,
      label TEXT,
      source TEXT NOT NULL DEFAULT 'manual',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );

    CREATE INDEX IF NOT EXISTS idx_entries_date ON time_entries(date);

    CREATE TABLE IF NOT EXISTS day_analyses (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL UNIQUE,
      total_tracked_slots INTEGER NOT NULL DEFAULT 0,
      category_breakdown TEXT NOT NULL DEFAULT '{}',
      eisenhower_breakdown TEXT NOT NULL DEFAULT '{}',
      generated_insight TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS habits (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      icon TEXT NOT NULL DEFAULT '✅',
      color TEXT NOT NULL DEFAULT '#6C63FF',
      frequency TEXT NOT NULL DEFAULT 'daily',
      custom_days TEXT,
      linked_category_id TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_archived INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS habit_completions (
      id TEXT PRIMARY KEY,
      habit_id TEXT NOT NULL,
      date TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      completed_at TEXT,
      FOREIGN KEY (habit_id) REFERENCES habits(id),
      UNIQUE(habit_id, date)
    );

    CREATE INDEX IF NOT EXISTS idx_habit_completions_date ON habit_completions(date);

    CREATE TABLE IF NOT EXISTS journal_entries (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      type TEXT NOT NULL,
      intentions TEXT NOT NULL DEFAULT '[]',
      wins TEXT NOT NULL DEFAULT '[]',
      reflection TEXT NOT NULL DEFAULT '',
      mood_rating INTEGER,
      ai_reflection TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(date, type)
    );

    CREATE INDEX IF NOT EXISTS idx_journal_date ON journal_entries(date);
  `);

  // Seed default categories if none exist
  const result = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM categories'
  );
  if (result && result.count === 0) {
    const defaults = createDefaultCategories();
    for (const cat of defaults) {
      await database.runAsync(
        `INSERT INTO categories (id, name, color, icon, eisenhower, is_default, sort_order, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [cat.id, cat.name, cat.color, cat.icon, cat.eisenhower, cat.isDefault ? 1 : 0, cat.sortOrder, cat.createdAt]
      );
    }
  }
}

// --- Category operations ---

export async function getAllCategories(): Promise<Category[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<any>(
    'SELECT * FROM categories ORDER BY sort_order ASC'
  );
  return rows.map(rowToCategory);
}

export async function insertCategory(category: Category): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `INSERT INTO categories (id, name, color, icon, eisenhower, is_default, sort_order, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [category.id, category.name, category.color, category.icon, category.eisenhower, category.isDefault ? 1 : 0, category.sortOrder, category.createdAt]
  );
}

export async function updateCategory(category: Category): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `UPDATE categories SET name = ?, color = ?, icon = ?, eisenhower = ?, sort_order = ? WHERE id = ?`,
    [category.name, category.color, category.icon, category.eisenhower, category.sortOrder, category.id]
  );
}

export async function deleteCategory(id: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync('DELETE FROM categories WHERE id = ?', [id]);
}

// --- TimeEntry operations ---

export async function getEntriesForDate(date: string): Promise<TimeEntry[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<any>(
    'SELECT * FROM time_entries WHERE date = ? ORDER BY start_slot ASC',
    [date]
  );
  return rows.map(rowToTimeEntry);
}

export async function insertTimeEntry(entry: TimeEntry): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `INSERT INTO time_entries (id, date, start_slot, end_slot, category_id, label, source, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [entry.id, entry.date, entry.startSlot, entry.endSlot, entry.categoryId, entry.label, entry.source, entry.createdAt, entry.updatedAt]
  );
}

export async function updateTimeEntry(entry: TimeEntry): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `UPDATE time_entries SET start_slot = ?, end_slot = ?, category_id = ?, label = ?, updated_at = ? WHERE id = ?`,
    [entry.startSlot, entry.endSlot, entry.categoryId, entry.label, entry.updatedAt, entry.id]
  );
}

export async function deleteTimeEntry(id: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync('DELETE FROM time_entries WHERE id = ?', [id]);
}

// --- Analytics ---

export async function getEntriesInRange(startDate: string, endDate: string): Promise<TimeEntry[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<any>(
    'SELECT * FROM time_entries WHERE date >= ? AND date <= ? ORDER BY date ASC, start_slot ASC',
    [startDate, endDate]
  );
  return rows.map(rowToTimeEntry);
}

// --- Habit operations ---

export async function getAllHabits(): Promise<Habit[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<any>(
    'SELECT * FROM habits WHERE is_archived = 0 ORDER BY sort_order ASC'
  );
  return rows.map(rowToHabit);
}

export async function insertHabit(habit: Habit): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `INSERT INTO habits (id, name, icon, color, frequency, custom_days, linked_category_id, sort_order, is_archived, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [habit.id, habit.name, habit.icon, habit.color, habit.frequency,
     habit.customDays ? JSON.stringify(habit.customDays) : null,
     habit.linkedCategoryId, habit.sortOrder, habit.isArchived ? 1 : 0, habit.createdAt]
  );
}

export async function updateHabit(habit: Habit): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `UPDATE habits SET name = ?, icon = ?, color = ?, frequency = ?, custom_days = ?, linked_category_id = ?, sort_order = ?, is_archived = ? WHERE id = ?`,
    [habit.name, habit.icon, habit.color, habit.frequency,
     habit.customDays ? JSON.stringify(habit.customDays) : null,
     habit.linkedCategoryId, habit.sortOrder, habit.isArchived ? 1 : 0, habit.id]
  );
}

export async function deleteHabit(id: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync('DELETE FROM habit_completions WHERE habit_id = ?', [id]);
  await database.runAsync('DELETE FROM habits WHERE id = ?', [id]);
}

export async function getCompletionsForDate(date: string): Promise<HabitCompletion[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<any>(
    'SELECT * FROM habit_completions WHERE date = ?',
    [date]
  );
  return rows.map(rowToHabitCompletion);
}

export async function getCompletionsForRange(startDate: string, endDate: string): Promise<HabitCompletion[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<any>(
    'SELECT * FROM habit_completions WHERE date >= ? AND date <= ?',
    [startDate, endDate]
  );
  return rows.map(rowToHabitCompletion);
}

export async function upsertCompletion(completion: HabitCompletion): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `INSERT INTO habit_completions (id, habit_id, date, completed, completed_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(habit_id, date) DO UPDATE SET completed = ?, completed_at = ?`,
    [completion.id, completion.habitId, completion.date, completion.completed ? 1 : 0, completion.completedAt,
     completion.completed ? 1 : 0, completion.completedAt]
  );
}

// --- Journal operations ---

export async function getJournalForDate(date: string): Promise<JournalEntry[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<any>(
    'SELECT * FROM journal_entries WHERE date = ? ORDER BY type ASC',
    [date]
  );
  return rows.map(rowToJournalEntry);
}

export async function upsertJournalEntry(entry: JournalEntry): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `INSERT INTO journal_entries (id, date, type, intentions, wins, reflection, mood_rating, ai_reflection, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(date, type) DO UPDATE SET intentions = ?, wins = ?, reflection = ?, mood_rating = ?, ai_reflection = ?, updated_at = ?`,
    [entry.id, entry.date, entry.type, JSON.stringify(entry.intentions), JSON.stringify(entry.wins),
     entry.reflection, entry.moodRating, entry.aiReflection, entry.createdAt, entry.updatedAt,
     JSON.stringify(entry.intentions), JSON.stringify(entry.wins), entry.reflection,
     entry.moodRating, entry.aiReflection, entry.updatedAt]
  );
}

// --- Row mappers ---

function rowToCategory(row: any): Category {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    icon: row.icon,
    eisenhower: row.eisenhower,
    isDefault: row.is_default === 1,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

function rowToTimeEntry(row: any): TimeEntry {
  return {
    id: row.id,
    date: row.date,
    startSlot: row.start_slot,
    endSlot: row.end_slot,
    categoryId: row.category_id,
    label: row.label,
    source: row.source as TimeEntry['source'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToHabit(row: any): Habit {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    color: row.color,
    frequency: row.frequency,
    customDays: row.custom_days ? JSON.parse(row.custom_days) : null,
    linkedCategoryId: row.linked_category_id,
    sortOrder: row.sort_order,
    isArchived: row.is_archived === 1,
    createdAt: row.created_at,
  };
}

function rowToHabitCompletion(row: any): HabitCompletion {
  return {
    id: row.id,
    habitId: row.habit_id,
    date: row.date,
    completed: row.completed === 1,
    completedAt: row.completed_at,
  };
}

function rowToJournalEntry(row: any): JournalEntry {
  return {
    id: row.id,
    date: row.date,
    type: row.type,
    intentions: JSON.parse(row.intentions || '[]'),
    wins: JSON.parse(row.wins || '[]'),
    reflection: row.reflection || '',
    moodRating: row.mood_rating,
    aiReflection: row.ai_reflection,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
