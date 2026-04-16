import { Category, EisenhowerQuadrant } from '../types';
import * as Crypto from 'expo-crypto';

interface DefaultCategoryDef {
  name: string;
  color: string;
  icon: string;
  eisenhower: EisenhowerQuadrant;
}

const DEFAULTS: DefaultCategoryDef[] = [
  { name: 'Sleep', color: '#34495E', icon: '😴', eisenhower: null },
  { name: 'Deep Work', color: '#2ECC71', icon: '💻', eisenhower: 'not-urgent-important' },
  { name: 'Meetings', color: '#E67E22', icon: '👥', eisenhower: 'urgent-not-important' },
  { name: 'Exercise', color: '#E74C3C', icon: '🏋️', eisenhower: 'not-urgent-important' },
  { name: 'Meals', color: '#F1C40F', icon: '🍽️', eisenhower: null },
  { name: 'Break', color: '#3498DB', icon: '☕', eisenhower: null },
  { name: 'Commute', color: '#95A5A6', icon: '🚗', eisenhower: 'urgent-not-important' },
  { name: 'Social', color: '#9B59B6', icon: '🎉', eisenhower: 'not-urgent-not-important' },
  { name: 'Personal Care', color: '#E91E8A', icon: '🧘', eisenhower: null },
  { name: 'Learning', color: '#1ABC9C', icon: '📚', eisenhower: 'not-urgent-important' },
  { name: 'Errands', color: '#D35400', icon: '📋', eisenhower: 'urgent-not-important' },
  { name: 'Entertainment', color: '#8E44AD', icon: '🎮', eisenhower: 'not-urgent-not-important' },
];

export function createDefaultCategories(): Category[] {
  const now = new Date().toISOString();
  return DEFAULTS.map((def, index) => ({
    id: Crypto.randomUUID(),
    name: def.name,
    color: def.color,
    icon: def.icon,
    eisenhower: def.eisenhower,
    isDefault: true,
    sortOrder: index,
    createdAt: now,
  }));
}
