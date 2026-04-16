import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useEntryStore } from '../../src/stores/useEntryStore';
import { useCategoryStore } from '../../src/stores/useCategoryStore';
import { useApiKey } from '../../src/hooks/useApiKey';
import { APP_COLORS } from '../../src/constants/colors';
import {
  slotToTime,
  getCurrentSlot,
  formatDateDisplay,
  formatDate,
  slotsToDuration,
} from '../../src/utils/time';
import { TimeEntry } from '../../src/types';
import * as Haptics from 'expo-haptics';

const SLOT_HEIGHT = 52;
const TIME_LABEL_WIDTH = 54;

export default function TodayScreen() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const { entries, selectedDate, setSelectedDate, loadEntries, removeEntry, updateEntry } =
    useEntryStore();
  const { categories } = useCategoryStore();
  const { hasKey } = useApiKey();
  const [currentSlot, setCurrentSlot] = useState(getCurrentSlot());

  // Edit modal state
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  useEffect(() => {
    const interval = setInterval(() => setCurrentSlot(getCurrentSlot()), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setTimeout(() => {
      const offset = Math.max(0, (currentSlot - 4) * SLOT_HEIGHT);
      scrollRef.current?.scrollTo({ y: offset, animated: true });
    }, 300);
  }, []);

  const navigateDate = useCallback(
    (delta: number) => {
      const current = new Date(selectedDate + 'T12:00:00');
      current.setDate(current.getDate() + delta);
      const newDate = formatDate(current);
      setSelectedDate(newDate);
      loadEntries(newDate);
    },
    [selectedDate, setSelectedDate, loadEntries]
  );

  const goToToday = useCallback(() => {
    const today = formatDate(new Date());
    setSelectedDate(today);
    loadEntries(today);
  }, [setSelectedDate, loadEntries]);

  const isToday = selectedDate === formatDate(new Date());

  // Build slot -> entry map
  const slotEntryMap = new Map<number, TimeEntry>();
  for (const entry of entries) {
    for (let s = entry.startSlot; s < entry.endSlot; s++) {
      slotEntryMap.set(s, entry);
    }
  }

  const trackedSlots = entries.reduce((sum, e) => sum + (e.endSlot - e.startSlot), 0);

  const handleSlotPress = (slot: number) => {
    const existing = slotEntryMap.get(slot);
    if (existing) {
      setEditingEntry(existing);
      setShowEditModal(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return;
    }
    router.push({
      pathname: '/entry-modal',
      params: { slot: slot.toString(), date: selectedDate },
    });
  };

  const handleDeleteEntry = () => {
    if (!editingEntry) return;
    Alert.alert('Delete Entry', 'Remove this time block?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          removeEntry(editingEntry.id);
          setShowEditModal(false);
          setEditingEntry(null);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      },
    ]);
  };

  const handleChangeCategoryForEntry = (newCategoryId: string) => {
    if (!editingEntry) return;
    updateEntry({ ...editingEntry, categoryId: newCategoryId });
    setShowEditModal(false);
    setEditingEntry(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const renderSlot = (slot: number) => {
    const entry = entries.find((e) => e.startSlot === slot);
    const isOccupied = slotEntryMap.has(slot);
    const isEntryStart = entry !== undefined;
    const time = slotToTime(slot);
    const isHourMark = slot % 2 === 0;
    const isCurrent = slot === currentSlot && isToday;

    if (isOccupied && !isEntryStart) {
      // Render empty row to maintain grid spacing for multi-slot entries
      return (
        <View key={slot} style={{ height: SLOT_HEIGHT }}>
          {isCurrent && (
            <View style={styles.currentTimeLine}>
              <View style={styles.currentTimeDot} />
            </View>
          )}
          <View style={styles.slotRow}>
            <View style={styles.timeLabel}>
              {isHourMark && <Text style={styles.timeLabelText}>{time}</Text>}
            </View>
            {/* Empty space under multi-slot block */}
            <View style={{ flex: 1 }} />
          </View>
        </View>
      );
    }

    const category = entry ? categoryMap.get(entry.categoryId) : null;
    const blockHeight = entry
      ? (entry.endSlot - entry.startSlot) * SLOT_HEIGHT - 4
      : SLOT_HEIGHT - 4;

    return (
      <View key={slot} style={{ height: SLOT_HEIGHT, position: 'relative', zIndex: entry ? 5 : 1 }}>
        {isCurrent && (
          <View style={styles.currentTimeLine}>
            <View style={styles.currentTimeDot} />
          </View>
        )}

        <View style={styles.slotRow}>
          <View style={styles.timeLabel}>
            {isHourMark && <Text style={styles.timeLabelText}>{time}</Text>}
          </View>

          <TouchableOpacity
            style={[
              styles.block,
              {
                height: blockHeight,
                backgroundColor: category ? category.color + 'DD' : 'transparent',
                borderColor: category ? category.color : APP_COLORS.border,
                borderWidth: category ? 0 : 1,
                borderStyle: category ? 'solid' : 'dashed',
              },
            ]}
            onPress={() => handleSlotPress(slot)}
            activeOpacity={0.7}
          >
            {category ? (
              <View style={styles.blockContent}>
                <Text style={styles.blockIcon}>{category.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.blockName} numberOfLines={1}>
                    {category.name}
                  </Text>
                  {entry && entry.label && (
                    <Text style={styles.blockLabel} numberOfLines={1}>
                      {entry.label}
                    </Text>
                  )}
                </View>
                {entry && entry.endSlot - entry.startSlot > 1 && (
                  <Text style={styles.blockDuration}>
                    {slotsToDuration(entry.endSlot - entry.startSlot)}
                  </Text>
                )}
              </View>
            ) : null}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Edit modal for existing entries
  const renderEditModal = () => {
    if (!editingEntry) return null;
    const cat = categoryMap.get(editingEntry.categoryId);

    return (
      <Modal
        visible={showEditModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowEditModal(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
            {/* Entry info */}
            <View style={styles.modalHeader}>
              <View
                style={[styles.modalColorBar, { backgroundColor: cat?.color || '#666' }]}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>
                  {cat?.icon} {cat?.name || 'Unknown'}
                </Text>
                <Text style={styles.modalTime}>
                  {slotToTime(editingEntry.startSlot)} - {slotToTime(editingEntry.endSlot)}
                  {'  '}({slotsToDuration(editingEntry.endSlot - editingEntry.startSlot)})
                </Text>
                {editingEntry.label && (
                  <Text style={styles.modalLabel}>{editingEntry.label}</Text>
                )}
              </View>
            </View>

            {/* Change category */}
            <Text style={styles.modalSectionTitle}>Change Category</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.modalCategoryRow}
            >
              {categories.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[
                    styles.modalCategoryChip,
                    {
                      backgroundColor: c.color + '25',
                      borderColor: c.color,
                      borderWidth: c.id === editingEntry.categoryId ? 2 : 1,
                    },
                  ]}
                  onPress={() => handleChangeCategoryForEntry(c.id)}
                >
                  <Text style={styles.modalCategoryIcon}>{c.icon}</Text>
                  <Text style={[styles.modalCategoryName, { color: c.color }]} numberOfLines={1}>
                    {c.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalDeleteBtn}
                onPress={handleDeleteEntry}
              >
                <Text style={styles.modalDeleteBtnText}>Delete Entry</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setShowEditModal(false)}
              >
                <Text style={styles.modalCloseBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.appTitle}>Time Tetris</Text>
          <TouchableOpacity onPress={() => router.push('/settings')} style={styles.settingsBtn}>
            <Text style={styles.settingsIcon}>{'⚙️'}</Text>
            {hasKey === false && <View style={styles.settingsDot} />}
          </TouchableOpacity>
        </View>
        <View style={styles.dateNav}>
          <TouchableOpacity onPress={() => navigateDate(-1)} style={styles.navBtn}>
            <Text style={styles.navBtnText}>{'◀'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={goToToday}>
            <Text style={styles.dateText}>{formatDateDisplay(selectedDate)}</Text>
            {!isToday && <Text style={styles.todayHint}>Tap for today</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigateDate(1)} style={styles.navBtn}>
            <Text style={styles.navBtnText}>{'▶'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statsRow}>
          <Text style={styles.statText}>{slotsToDuration(trackedSlots)} tracked</Text>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.min(100, Math.round((trackedSlots / 48) * 100))}%`,
                },
              ]}
            />
          </View>
          <Text style={styles.statPercent}>
            {Math.round((trackedSlots / 48) * 100)}%
          </Text>
        </View>
      </View>

      {/* Grid */}
      <ScrollView
        ref={scrollRef}
        style={styles.grid}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {Array.from({ length: 48 }, (_, i) => renderSlot(i))}
      </ScrollView>

      {/* FABs */}
      <View style={styles.fabContainer}>
        <TouchableOpacity
          style={[styles.fab, styles.fabText]}
          onPress={() =>
            router.push({
              pathname: '/entry-modal',
              params: { mode: 'text', date: selectedDate },
            })
          }
        >
          <Text style={styles.fabIcon}>✏️</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.fab, styles.fabMic]}
          onPress={() =>
            router.push({
              pathname: '/entry-modal',
              params: { mode: 'voice', date: selectedDate },
            })
          }
        >
          <Text style={styles.fabIcon}>🎙️</Text>
        </TouchableOpacity>
      </View>

      {/* Edit Modal */}
      {renderEditModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: APP_COLORS.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: APP_COLORS.border,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  appTitle: {
    color: APP_COLORS.primary,
    fontSize: 20,
    fontWeight: '800',
  },
  settingsBtn: {
    position: 'relative',
    padding: 4,
  },
  settingsIcon: {
    fontSize: 20,
  },
  settingsDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: APP_COLORS.accent,
  },
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    paddingVertical: 6,
  },
  navBtn: {
    padding: 8,
  },
  navBtnText: {
    color: APP_COLORS.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  dateText: {
    color: APP_COLORS.text,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  todayHint: {
    color: APP_COLORS.primary,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  statText: {
    color: APP_COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '500',
    width: 80,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: APP_COLORS.surfaceLight,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: APP_COLORS.primary,
    borderRadius: 3,
  },
  statPercent: {
    color: APP_COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    width: 32,
    textAlign: 'right',
  },
  grid: {
    flex: 1,
    paddingHorizontal: 8,
  },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    height: SLOT_HEIGHT,
  },
  timeLabel: {
    width: TIME_LABEL_WIDTH,
    paddingRight: 8,
    paddingTop: 2,
  },
  timeLabelText: {
    color: APP_COLORS.textMuted,
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'right',
  },
  block: {
    flex: 1,
    marginVertical: 2,
    borderRadius: 8,
    justifyContent: 'center',
    paddingHorizontal: 10,
    minHeight: SLOT_HEIGHT - 4,
  },
  blockContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  blockIcon: {
    fontSize: 16,
  },
  blockName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  blockLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    marginTop: 1,
  },
  blockDuration: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    fontWeight: '500',
  },
  currentTimeLine: {
    position: 'absolute',
    top: 0,
    left: TIME_LABEL_WIDTH - 4,
    right: 8,
    height: 2,
    backgroundColor: APP_COLORS.currentTimeLine,
    zIndex: 10,
  },
  currentTimeDot: {
    position: 'absolute',
    left: -4,
    top: -4,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: APP_COLORS.currentTimeLine,
  },
  fabContainer: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    gap: 12,
  },
  fab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  fabText: {
    backgroundColor: APP_COLORS.surfaceLight,
  },
  fabMic: {
    backgroundColor: APP_COLORS.primary,
  },
  fabIcon: {
    fontSize: 22,
  },

  // Edit modal
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
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  modalColorBar: {
    width: 4,
    borderRadius: 2,
    alignSelf: 'stretch',
  },
  modalTitle: {
    color: APP_COLORS.text,
    fontSize: 18,
    fontWeight: '700',
  },
  modalTime: {
    color: APP_COLORS.textSecondary,
    fontSize: 14,
    marginTop: 4,
  },
  modalLabel: {
    color: APP_COLORS.textMuted,
    fontSize: 13,
    marginTop: 4,
    fontStyle: 'italic',
  },
  modalSectionTitle: {
    color: APP_COLORS.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  modalCategoryRow: {
    gap: 8,
    paddingBottom: 4,
  },
  modalCategoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
    minWidth: 90,
  },
  modalCategoryIcon: {
    fontSize: 14,
  },
  modalCategoryName: {
    fontSize: 12,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  modalDeleteBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: APP_COLORS.accent,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalDeleteBtnText: {
    color: APP_COLORS.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  modalCloseBtn: {
    flex: 1,
    backgroundColor: APP_COLORS.surfaceLight,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalCloseBtnText: {
    color: APP_COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
});
