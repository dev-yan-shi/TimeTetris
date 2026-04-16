import { create } from 'zustand';
import { Category } from '../types';
import * as db from '../services/database';
import * as Crypto from 'expo-crypto';

interface CategoryStore {
  categories: Category[];
  isLoaded: boolean;
  loadCategories: () => Promise<void>;
  addCategory: (name: string, color: string, icon: string | null, eisenhower: Category['eisenhower']) => Promise<Category>;
  updateCategory: (category: Category) => Promise<void>;
  removeCategory: (id: string) => Promise<void>;
  findCategoryByName: (name: string) => Category | undefined;
}

export const useCategoryStore = create<CategoryStore>((set, get) => ({
  categories: [],
  isLoaded: false,

  loadCategories: async () => {
    const categories = await db.getAllCategories();
    set({ categories, isLoaded: true });
  },

  addCategory: async (name, color, icon, eisenhower) => {
    const maxOrder = Math.max(0, ...get().categories.map((c) => c.sortOrder));
    const category: Category = {
      id: Crypto.randomUUID(),
      name,
      color,
      icon,
      eisenhower,
      isDefault: false,
      sortOrder: maxOrder + 1,
      createdAt: new Date().toISOString(),
    };
    await db.insertCategory(category);
    set((state) => ({ categories: [...state.categories, category] }));
    return category;
  },

  updateCategory: async (category) => {
    await db.updateCategory(category);
    set((state) => ({
      categories: state.categories.map((c) => (c.id === category.id ? category : c)),
    }));
  },

  removeCategory: async (id) => {
    await db.deleteCategory(id);
    set((state) => ({
      categories: state.categories.filter((c) => c.id !== id),
    }));
  },

  findCategoryByName: (name) => {
    const lower = name.toLowerCase();
    return get().categories.find(
      (c) => c.name.toLowerCase() === lower || c.name.toLowerCase().includes(lower) || lower.includes(c.name.toLowerCase())
    );
  },
}));
