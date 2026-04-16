import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useHabitStore } from '../../src/stores/useHabitStore';
import { useEntryStore } from '../../src/stores/useEntryStore';
import { useCategoryStore } from '../../src/stores/useCategoryStore';
import { APP_COLORS, CATEGORY_COLORS } from '../../src/constants/colors';
import { formatDateDisplay } from '../../src/utils/time';
import { Habit } from '../../src/types';
import * as Haptics from 'expo-haptics';

const HABIT_ICONS = ['✅', '🏋️', '📚', '🧘', '💧', '🏃', '✍️', '🎯', '💤', '🥗', '💊', '🎵', '🧹', '📱', '🚫', '🌅', '🧠', '💪', '🎨', '🌿'];

export default function HabitsScreen() {
  const {
    habits,
    completions,
    isLoaded,
    loadHabits,
    loadCompletions,
    toggleCompletion,
    isCompleted,
    isHabitDueToday,
    removeHabit,
  } = useHabitStore();
  const { entries, selectedDate } = useEntryStore();
  const { categories } = useCategoryStore();

  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    loadHabits();
  }, []);

  useEffect(() => {
    loadCompletions(selectedDate);
  }, [selectedDate]);

  // Auto-complete habits linked to tracked categories
  useEffect(() => {
    if (!isLoaded || entries.length === 0) return;
    const trackedCategoryIds = new Set(entries.map((e) => e.categoryId));
    for (const habit of habits) {
      if (
        habit.linkedCategoryId &&
        trackedCategoryIds.has(habit.linkedCategoryId) &&
        !isCompleted(habit.id) &&
        isHabitDueToday(habit, selectedDate)
      ) {
        toggleCompletion(habit.id, selectedDate);
      }
    }
  }, [entries, isLoaded]);

  const dueHabits = habits.filter((h) => isHabitDueToday(h, selectedDate));
  const completedCount = dueHabits.filter((h) => isCompleted(h.id)).length;
  const totalDue = dueHabits.length;

  const handleToggle = async (habitId: string) => {
    await toggleCompletion(habitId, selectedDate);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert('Delete Habit', `Delete "${name}" and all its history?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => removeHabit(id) },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Habits</Text>
            <Text style={styles.subtitle}>{formatDateDisplay(selectedDate)}</Text>
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddModal(true)}>
            <Text style={styles.addBtnText}>+ New</Text>
          </TouchableOpacity>
        </View>

        {/* Progress */}
        {totalDue > 0 && (
          <View style={styles.progressSection}>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.round((completedCount / totalDue) * 100)}%` },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {completedCount}/{totalDue} completed
            </Text>
          </View>
        )}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {dueHabits.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🎯</Text>
            <Text style={styles.emptyTitle}>No habits yet</Text>
            <Text style={styles.emptyText}>
              Create habits to track daily. Link them to time categories for auto-completion!
            </Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => setShowAddModal(true)}>
              <Text style={styles.emptyBtnText}>Create First Habit</Text>
            </TouchableOpacity>
          </View>
        ) : (
          dueHabits.map((habit) => {
            const done = isCompleted(habit.id);
            const linkedCat = habit.linkedCategoryId
              ? categories.find((c) => c.id === habit.linkedCategoryId)
              : null;

            return (
              <TouchableOpacity
                key={habit.id}
                style={[styles.habitCard, done && styles.habitCardDone]}
                onPress={() => handleToggle(habit.id)}
                onLongPress={() => handleDelete(habit.id, habit.name)}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, done && { backgroundColor: habit.color, borderColor: habit.color }]}>
                  {done && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.habitNameRow}>
                    <Text style={styles.habitIcon}>{habit.icon}</Text>
                    <Text style={[styles.habitName, done && styles.habitNameDone]}>
                      {habit.name}
                    </Text>
                  </View>
                  {linkedCat && (
                    <Text style={styles.linkedLabel}>
                      Auto-completes with {linkedCat.icon} {linkedCat.name}
                    </Text>
                  )}
                </View>
                <View style={[styles.habitStreak, { backgroundColor: habit.color + '20' }]}>
                  <Text style={[styles.habitFreq, { color: habit.color }]}>
                    {habit.frequency === 'daily' ? 'Daily' : habit.frequency === 'weekdays' ? 'Weekdays' : 'Custom'}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}

        {/* Not due today */}
        {habits.filter((h) => !isHabitDueToday(h, selectedDate)).length > 0 && (
          <View style={styles.notDueSection}>
            <Text style={styles.notDueTitle}>Not scheduled today</Text>
            {habits
              .filter((h) => !isHabitDueToday(h, selectedDate))
              .map((habit) => (
                <View key={habit.id} style={styles.notDueRow}>
                  <Text style={styles.notDueIcon}>{habit.icon}</Text>
                  <Text style={styles.notDueName}>{habit.name}</Text>
                  <Text style={styles.notDueFreq}>
                    {habit.frequency === 'weekdays' ? 'Weekdays' : 'Custom'}
                  </Text>
                </View>
              ))}
          </View>
        )}
      </ScrollView>

      {/* Add Habit Modal */}
      <AddHabitModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        categories={categories}
      />
    </SafeAreaView>
  );
}

// --- Add Habit Modal ---

function AddHabitModal({
  visible,
  onClose,
  categories,
}: {
  visible: boolean;
  onClose: () => void;
  categories: any[];
}) {
  const { addHabit } = useHabitStore();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('✅');
  const [color, setColor] = useState(CATEGORY_COLORS[0]);
  const [frequency, setFrequency] = useState<Habit['frequency']>('daily');
  const [linkedCategoryId, setLinkedCategoryId] = useState<string | null>(null);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Habit name is required');
      return;
    }
    await addHabit(name.trim(), icon, color, frequency, null, linkedCategoryId);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setName('');
    setIcon('✅');
    setLinkedCategoryId(null);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
          <Text style={styles.modalTitle}>New Habit</Text>

          <Text style={styles.modalLabel}>Name</Text>
          <TextInput
            style={styles.modalInput}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Meditate, Read 30 min..."
            placeholderTextColor={APP_COLORS.textMuted}
            autoFocus
          />

          <Text style={styles.modalLabel}>Icon</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.iconRow}>
              {HABIT_ICONS.map((e) => (
                <TouchableOpacity
                  key={e}
                  style={[styles.iconOption, icon === e && styles.iconSelected]}
                  onPress={() => setIcon(e)}
                >
                  <Text style={styles.iconText}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <Text style={styles.modalLabel}>Color</Text>
          <View style={styles.colorRow}>
            {CATEGORY_COLORS.slice(0, 8).map((c) => (
              <TouchableOpacity
                key={c}
                style={[styles.colorDot, { backgroundColor: c }, color === c && styles.colorDotSelected]}
                onPress={() => setColor(c)}
              />
            ))}
          </View>

          <Text style={styles.modalLabel}>Frequency</Text>
          <View style={styles.freqRow}>
            {(['daily', 'weekdays', 'custom'] as Habit['frequency'][]).map((f) => (
              <TouchableOpacity
                key={f}
                style={[styles.freqChip, frequency === f && styles.freqChipActive]}
                onPress={() => setFrequency(f)}
              >
                <Text style={[styles.freqChipText, frequency === f && styles.freqChipTextActive]}>
                  {f === 'daily' ? 'Daily' : f === 'weekdays' ? 'Weekdays' : 'Custom'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.modalLabel}>Auto-complete with category (optional)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.linkRow}>
              <TouchableOpacity
                style={[styles.linkChip, !linkedCategoryId && styles.linkChipActive]}
                onPress={() => setLinkedCategoryId(null)}
              >
                <Text style={styles.linkChipText}>None</Text>
              </TouchableOpacity>
              {categories.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[
                    styles.linkChip,
                    linkedCategoryId === c.id && { backgroundColor: c.color + '30', borderColor: c.color },
                  ]}
                  onPress={() => setLinkedCategoryId(c.id)}
                >
                  <Text style={styles.linkChipIcon}>{c.icon}</Text>
                  <Text style={[styles.linkChipText, linkedCategoryId === c.id && { color: c.color }]}>
                    {c.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <View style={styles.modalBtnRow}>
            <TouchableOpacity style={styles.modalCancelBtn} onPress={onClose}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSave}>
              <Text style={styles.modalSaveText}>Create Habit</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: APP_COLORS.background },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: APP_COLORS.border,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: { color: APP_COLORS.text, fontSize: 24, fontWeight: '700' },
  subtitle: { color: APP_COLORS.textSecondary, fontSize: 14, marginTop: 2 },
  addBtn: {
    backgroundColor: APP_COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addBtnText: { color: '#FFF', fontWeight: '600', fontSize: 14 },
  progressSection: { marginTop: 12 },
  progressBar: {
    height: 8,
    backgroundColor: APP_COLORS.surfaceLight,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: APP_COLORS.success,
    borderRadius: 4,
  },
  progressText: {
    color: APP_COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },

  // Habit cards
  habitCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: APP_COLORS.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    gap: 12,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
  },
  habitCardDone: {
    borderColor: APP_COLORS.success + '40',
    backgroundColor: APP_COLORS.success + '08',
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: APP_COLORS.textMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmark: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  habitNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  habitIcon: { fontSize: 16 },
  habitName: { color: APP_COLORS.text, fontSize: 15, fontWeight: '600' },
  habitNameDone: { textDecorationLine: 'line-through', color: APP_COLORS.textMuted },
  linkedLabel: { color: APP_COLORS.textMuted, fontSize: 11, marginTop: 3 },
  habitStreak: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  habitFreq: { fontSize: 10, fontWeight: '700' },

  // Empty
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { color: APP_COLORS.text, fontSize: 18, fontWeight: '700', marginTop: 12 },
  emptyText: {
    color: APP_COLORS.textMuted,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 40,
    lineHeight: 20,
  },
  emptyBtn: {
    backgroundColor: APP_COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 20,
  },
  emptyBtnText: { color: '#FFF', fontWeight: '700', fontSize: 15 },

  // Not due
  notDueSection: { marginTop: 24 },
  notDueTitle: { color: APP_COLORS.textMuted, fontSize: 13, fontWeight: '600', marginBottom: 8 },
  notDueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    opacity: 0.5,
  },
  notDueIcon: { fontSize: 14 },
  notDueName: { color: APP_COLORS.textMuted, fontSize: 13, flex: 1 },
  notDueFreq: { color: APP_COLORS.textMuted, fontSize: 11 },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: APP_COLORS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
    maxHeight: '85%',
  },
  modalTitle: { color: APP_COLORS.text, fontSize: 20, fontWeight: '700', marginBottom: 16 },
  modalLabel: {
    color: APP_COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 14,
    marginBottom: 6,
  },
  modalInput: {
    backgroundColor: APP_COLORS.surfaceLight,
    borderRadius: 10,
    padding: 14,
    color: APP_COLORS.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
  },
  iconRow: { flexDirection: 'row', gap: 6 },
  iconOption: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: APP_COLORS.surfaceLight,
  },
  iconSelected: { backgroundColor: APP_COLORS.primary + '30', borderWidth: 2, borderColor: APP_COLORS.primary },
  iconText: { fontSize: 18 },
  colorRow: { flexDirection: 'row', gap: 8 },
  colorDot: { width: 30, height: 30, borderRadius: 15 },
  colorDotSelected: { borderWidth: 3, borderColor: '#FFF' },
  freqRow: { flexDirection: 'row', gap: 8 },
  freqChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: APP_COLORS.surfaceLight,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
  },
  freqChipActive: { backgroundColor: APP_COLORS.primary + '25', borderColor: APP_COLORS.primary },
  freqChipText: { color: APP_COLORS.textMuted, fontSize: 13, fontWeight: '600' },
  freqChipTextActive: { color: APP_COLORS.primary },
  linkRow: { flexDirection: 'row', gap: 6 },
  linkChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
    backgroundColor: APP_COLORS.surfaceLight,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
  },
  linkChipActive: { backgroundColor: APP_COLORS.primary + '20', borderColor: APP_COLORS.primary },
  linkChipIcon: { fontSize: 12 },
  linkChipText: { color: APP_COLORS.textSecondary, fontSize: 12, fontWeight: '500' },
  modalBtnRow: { flexDirection: 'row', gap: 12, marginTop: 20 },
  modalCancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalCancelText: { color: APP_COLORS.textSecondary, fontSize: 15, fontWeight: '600' },
  modalSaveBtn: {
    flex: 2,
    backgroundColor: APP_COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalSaveText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
});
