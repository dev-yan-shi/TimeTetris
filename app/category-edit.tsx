import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useCategoryStore } from '../src/stores/useCategoryStore';
import { APP_COLORS, CATEGORY_COLORS } from '../src/constants/colors';
import { EisenhowerQuadrant } from '../src/types';

const EMOJI_OPTIONS = ['💻', '🏋️', '😴', '🍽️', '☕', '👥', '🚗', '🎉', '🧘', '📚', '📋', '🎮', '🎵', '🏠', '💼', '🛒', '✍️', '🎯', '🧹', '📱'];

const EISENHOWER_OPTIONS: { value: EisenhowerQuadrant; label: string; color: string }[] = [
  { value: 'urgent-important', label: 'Q1: Urgent & Important', color: '#E74C3C' },
  { value: 'not-urgent-important', label: 'Q2: Not Urgent & Important', color: '#2ECC71' },
  { value: 'urgent-not-important', label: 'Q3: Urgent & Not Important', color: '#F1C40F' },
  { value: 'not-urgent-not-important', label: 'Q4: Not Urgent & Not Important', color: '#95A5A6' },
  { value: null, label: 'N/A (Neutral)', color: APP_COLORS.textMuted },
];

export default function CategoryEditScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const { categories, addCategory, updateCategory } = useCategoryStore();

  const existing = params.id ? categories.find((c) => c.id === params.id) : null;
  const isEdit = !!existing;

  const [name, setName] = useState(existing?.name || '');
  const [color, setColor] = useState(existing?.color || CATEGORY_COLORS[0]);
  const [icon, setIcon] = useState(existing?.icon || '📌');
  const [eisenhower, setEisenhower] = useState<EisenhowerQuadrant>(existing?.eisenhower || null);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Category name is required');
      return;
    }

    try {
      if (isEdit && existing) {
        await updateCategory({
          ...existing,
          name: name.trim(),
          color,
          icon,
          eisenhower,
        });
      } else {
        await addCategory(name.trim(), color, icon, eisenhower);
      }
      router.back();
    } catch (error) {
      Alert.alert('Error', 'Failed to save category');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.cancelBtn}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEdit ? 'Edit Category' : 'New Category'}</Text>
        <TouchableOpacity onPress={handleSave}>
          <Text style={styles.saveBtn}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Preview */}
        <View style={[styles.preview, { backgroundColor: color + '30', borderColor: color }]}>
          <Text style={styles.previewIcon}>{icon}</Text>
          <Text style={[styles.previewName, { color }]}>{name || 'Category Name'}</Text>
        </View>

        {/* Name */}
        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Deep Work, Reading..."
          placeholderTextColor={APP_COLORS.textMuted}
          autoFocus={!isEdit}
        />

        {/* Color */}
        <Text style={styles.label}>Color</Text>
        <View style={styles.colorGrid}>
          {CATEGORY_COLORS.map((c) => (
            <TouchableOpacity
              key={c}
              style={[
                styles.colorOption,
                { backgroundColor: c },
                color === c && styles.colorSelected,
              ]}
              onPress={() => setColor(c)}
            />
          ))}
        </View>

        {/* Icon */}
        <Text style={styles.label}>Icon</Text>
        <View style={styles.emojiGrid}>
          {EMOJI_OPTIONS.map((e) => (
            <TouchableOpacity
              key={e}
              style={[
                styles.emojiOption,
                icon === e && styles.emojiSelected,
              ]}
              onPress={() => setIcon(e)}
            >
              <Text style={styles.emojiText}>{e}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Eisenhower Quadrant */}
        <Text style={styles.label}>Priority Quadrant</Text>
        <Text style={styles.sublabel}>Used for time analysis and optimization tips</Text>
        {EISENHOWER_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.label}
            style={[
              styles.eisenhowerOption,
              eisenhower === opt.value && { borderColor: opt.color, backgroundColor: opt.color + '15' },
            ]}
            onPress={() => setEisenhower(opt.value)}
          >
            <View
              style={[
                styles.radioOuter,
                eisenhower === opt.value && { borderColor: opt.color },
              ]}
            >
              {eisenhower === opt.value && (
                <View style={[styles.radioInner, { backgroundColor: opt.color }]} />
              )}
            </View>
            <Text
              style={[
                styles.eisenhowerLabel,
                eisenhower === opt.value && { color: opt.color },
              ]}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: APP_COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: APP_COLORS.border,
  },
  cancelBtn: {
    color: APP_COLORS.textSecondary,
    fontSize: 16,
  },
  headerTitle: {
    color: APP_COLORS.text,
    fontSize: 17,
    fontWeight: '700',
  },
  saveBtn: {
    color: APP_COLORS.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
    marginBottom: 24,
  },
  previewIcon: {
    fontSize: 24,
  },
  previewName: {
    fontSize: 18,
    fontWeight: '700',
  },
  label: {
    color: APP_COLORS.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 16,
  },
  sublabel: {
    color: APP_COLORS.textMuted,
    fontSize: 12,
    marginBottom: 10,
    marginTop: -4,
  },
  input: {
    backgroundColor: APP_COLORS.surface,
    borderRadius: 10,
    padding: 14,
    color: APP_COLORS.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  colorOption: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  colorSelected: {
    borderWidth: 3,
    borderColor: '#FFF',
    shadowColor: '#FFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  emojiOption: {
    width: 42,
    height: 42,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: APP_COLORS.surface,
  },
  emojiSelected: {
    backgroundColor: APP_COLORS.primary + '30',
    borderWidth: 2,
    borderColor: APP_COLORS.primary,
  },
  emojiText: {
    fontSize: 20,
  },
  eisenhowerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    marginBottom: 8,
    gap: 10,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: APP_COLORS.textMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  eisenhowerLabel: {
    color: APP_COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
});
