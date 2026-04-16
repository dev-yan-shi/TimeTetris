import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useJournalStore } from '../../src/stores/useJournalStore';
import { useEntryStore } from '../../src/stores/useEntryStore';
import { useCategoryStore } from '../../src/stores/useCategoryStore';
import { useApiKey } from '../../src/hooks/useApiKey';
import { APP_COLORS } from '../../src/constants/colors';
import { formatDateDisplay } from '../../src/utils/time';
import { computeDayStats } from '../../src/services/analytics';
import { generateJournalReflection } from '../../src/services/journalReflection';
import * as Haptics from 'expo-haptics';

type Tab = 'morning' | 'evening';

const MOOD_EMOJIS = [
  { value: 1, emoji: '😫', label: 'Rough' },
  { value: 2, emoji: '😕', label: 'Meh' },
  { value: 3, emoji: '😐', label: 'Okay' },
  { value: 4, emoji: '😊', label: 'Good' },
  { value: 5, emoji: '🤩', label: 'Great' },
];

export default function JournalScreen() {
  const { entries: journalEntries, loadEntries, saveEntry, getMorning, getEvening } = useJournalStore();
  const { entries: timeEntries, selectedDate } = useEntryStore();
  const { categories } = useCategoryStore();
  const { hasKey } = useApiKey();

  const [activeTab, setActiveTab] = useState<Tab>('morning');

  // Morning state
  const [intentions, setIntentions] = useState<string[]>(['', '', '']);
  const [morningDirty, setMorningDirty] = useState(false);

  // Evening state
  const [wins, setWins] = useState<string[]>(['', '', '']);
  const [reflection, setReflection] = useState('');
  const [moodRating, setMoodRating] = useState<number | null>(null);
  const [eveningDirty, setEveningDirty] = useState(false);

  // AI reflection
  const [aiReflection, setAiReflection] = useState<string | null>(null);
  const [isGeneratingReflection, setIsGeneratingReflection] = useState(false);

  // Load journal on date change
  useEffect(() => {
    loadEntries(selectedDate);
  }, [selectedDate]);

  // Populate form from loaded entries
  useEffect(() => {
    const morning = getMorning();
    if (morning) {
      const padded = [...morning.intentions];
      while (padded.length < 3) padded.push('');
      setIntentions(padded);
    } else {
      setIntentions(['', '', '']);
    }

    const evening = getEvening();
    if (evening) {
      const padded = [...evening.wins];
      while (padded.length < 3) padded.push('');
      setWins(padded);
      setReflection(evening.reflection);
      setMoodRating(evening.moodRating);
      setAiReflection(evening.aiReflection);
    } else {
      setWins(['', '', '']);
      setReflection('');
      setMoodRating(null);
      setAiReflection(null);
    }
    setMorningDirty(false);
    setEveningDirty(false);
  }, [journalEntries]);

  const handleSaveMorning = async () => {
    const filtered = intentions.filter((i) => i.trim());
    await saveEntry(selectedDate, 'morning', { intentions: filtered });
    setMorningDirty(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleSaveEvening = async () => {
    const filtered = wins.filter((w) => w.trim());
    await saveEntry(selectedDate, 'evening', {
      wins: filtered,
      reflection,
      moodRating,
    });
    setEveningDirty(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleGenerateReflection = async () => {
    setIsGeneratingReflection(true);
    try {
      const stats = computeDayStats(timeEntries, categories);
      const text = await generateJournalReflection(
        getMorning(),
        getEvening(),
        stats,
        formatDateDisplay(selectedDate)
      );
      setAiReflection(text);
      // Save it to the evening entry
      await saveEntry(selectedDate, 'evening', { aiReflection: text });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Could not generate reflection');
    } finally {
      setIsGeneratingReflection(false);
    }
  };

  const updateIntention = (index: number, value: string) => {
    const updated = [...intentions];
    updated[index] = value;
    setIntentions(updated);
    setMorningDirty(true);
  };

  const updateWin = (index: number, value: string) => {
    const updated = [...wins];
    updated[index] = value;
    setWins(updated);
    setEveningDirty(true);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Journal</Text>
          <Text style={styles.subtitle}>{formatDateDisplay(selectedDate)}</Text>
        </View>

        {/* Tab switcher */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'morning' && styles.tabActive]}
            onPress={() => setActiveTab('morning')}
          >
            <Text style={styles.tabIcon}>🌅</Text>
            <Text style={[styles.tabText, activeTab === 'morning' && styles.tabTextActive]}>
              Morning
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'evening' && styles.tabActive]}
            onPress={() => setActiveTab('evening')}
          >
            <Text style={styles.tabIcon}>🌙</Text>
            <Text style={[styles.tabText, activeTab === 'evening' && styles.tabTextActive]}>
              Evening
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {activeTab === 'morning' ? (
            <>
              {/* Morning Intentions */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Today's Intentions</Text>
                <Text style={styles.cardHint}>What do you want to focus on today?</Text>

                {intentions.map((intention, i) => (
                  <View key={i} style={styles.intentionRow}>
                    <Text style={styles.intentionNum}>{i + 1}</Text>
                    <TextInput
                      style={styles.intentionInput}
                      value={intention}
                      onChangeText={(val) => updateIntention(i, val)}
                      placeholder={
                        i === 0
                          ? 'Most important task...'
                          : i === 1
                          ? 'Second priority...'
                          : 'Would be nice to do...'
                      }
                      placeholderTextColor={APP_COLORS.textMuted}
                    />
                  </View>
                ))}

                {/* Add more */}
                {intentions.length < 5 && (
                  <TouchableOpacity
                    style={styles.addIntentionBtn}
                    onPress={() => {
                      setIntentions([...intentions, '']);
                      setMorningDirty(true);
                    }}
                  >
                    <Text style={styles.addIntentionText}>+ Add another</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Save */}
              <TouchableOpacity
                style={[styles.saveBtn, !morningDirty && styles.saveBtnDisabled]}
                onPress={handleSaveMorning}
                disabled={!morningDirty}
              >
                <Text style={styles.saveBtnText}>
                  {getMorning() ? 'Update Morning Entry' : 'Save Morning Entry'}
                </Text>
              </TouchableOpacity>

              {getMorning() && (
                <View style={styles.savedBadge}>
                  <Text style={styles.savedBadgeText}>
                    ✅ Morning entry saved
                  </Text>
                </View>
              )}
            </>
          ) : (
            <>
              {/* Mood */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>How was your day?</Text>
                <View style={styles.moodRow}>
                  {MOOD_EMOJIS.map((m) => (
                    <TouchableOpacity
                      key={m.value}
                      style={[
                        styles.moodBtn,
                        moodRating === m.value && styles.moodBtnActive,
                      ]}
                      onPress={() => {
                        setMoodRating(m.value);
                        setEveningDirty(true);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                    >
                      <Text style={styles.moodEmoji}>{m.emoji}</Text>
                      <Text
                        style={[
                          styles.moodLabel,
                          moodRating === m.value && styles.moodLabelActive,
                        ]}
                      >
                        {m.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Wins */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Today's Wins</Text>
                <Text style={styles.cardHint}>What went well today? Celebrate the small stuff!</Text>

                {wins.map((win, i) => (
                  <View key={i} style={styles.intentionRow}>
                    <Text style={styles.winStar}>⭐</Text>
                    <TextInput
                      style={styles.intentionInput}
                      value={win}
                      onChangeText={(val) => updateWin(i, val)}
                      placeholder={
                        i === 0
                          ? 'Biggest win today...'
                          : i === 1
                          ? 'Another accomplishment...'
                          : 'Something small but nice...'
                      }
                      placeholderTextColor={APP_COLORS.textMuted}
                    />
                  </View>
                ))}
              </View>

              {/* Reflection */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Evening Reflection</Text>
                <Text style={styles.cardHint}>
                  Anything on your mind? What would you do differently?
                </Text>
                <TextInput
                  style={styles.reflectionInput}
                  value={reflection}
                  onChangeText={(val) => {
                    setReflection(val);
                    setEveningDirty(true);
                  }}
                  placeholder="Write freely..."
                  placeholderTextColor={APP_COLORS.textMuted}
                  multiline
                  textAlignVertical="top"
                />
              </View>

              {/* Save */}
              <TouchableOpacity
                style={[styles.saveBtn, !eveningDirty && styles.saveBtnDisabled]}
                onPress={handleSaveEvening}
                disabled={!eveningDirty}
              >
                <Text style={styles.saveBtnText}>
                  {getEvening() ? 'Update Evening Entry' : 'Save Evening Entry'}
                </Text>
              </TouchableOpacity>

              {getEvening() && (
                <View style={styles.savedBadge}>
                  <Text style={styles.savedBadgeText}>✅ Evening entry saved</Text>
                </View>
              )}

              {/* AI Reflection */}
              <View style={[styles.card, { marginTop: 16 }]}>
                <View style={styles.aiHeaderRow}>
                  <Text style={styles.cardTitle}>AI Day Reflection</Text>
                  <Text style={styles.aiChip}>Groq</Text>
                </View>
                <Text style={styles.cardHint}>
                  Connects your morning intentions, evening wins, and time data into a personalized reflection.
                </Text>

                {aiReflection ? (
                  <View>
                    <Text style={styles.aiText}>{aiReflection}</Text>
                    <TouchableOpacity
                      style={styles.regenerateBtn}
                      onPress={handleGenerateReflection}
                    >
                      <Text style={styles.regenerateText}>Regenerate</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[
                      styles.generateBtn,
                      hasKey === false && styles.generateBtnDisabled,
                    ]}
                    onPress={handleGenerateReflection}
                    disabled={isGeneratingReflection || hasKey === false}
                  >
                    {isGeneratingReflection ? (
                      <View style={styles.generatingRow}>
                        <ActivityIndicator color={APP_COLORS.primary} size="small" />
                        <Text style={styles.generatingText}>Reflecting on your day...</Text>
                      </View>
                    ) : (
                      <View style={styles.generateContent}>
                        <Text style={styles.generateIcon}>✨</Text>
                        <Text style={styles.generateText}>
                          {hasKey === false ? 'API key required' : 'Generate AI Reflection'}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
  title: { color: APP_COLORS.text, fontSize: 24, fontWeight: '700' },
  subtitle: { color: APP_COLORS.textSecondary, fontSize: 14, marginTop: 2 },

  // Tabs
  tabRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
    backgroundColor: APP_COLORS.surface,
  },
  tabActive: {
    backgroundColor: APP_COLORS.primary + '25',
    borderWidth: 1,
    borderColor: APP_COLORS.primary,
  },
  tabIcon: { fontSize: 16 },
  tabText: { color: APP_COLORS.textMuted, fontSize: 14, fontWeight: '600' },
  tabTextActive: { color: APP_COLORS.primary },

  // Cards
  card: {
    backgroundColor: APP_COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: { color: APP_COLORS.text, fontSize: 17, fontWeight: '700', marginBottom: 4 },
  cardHint: { color: APP_COLORS.textMuted, fontSize: 13, marginBottom: 14, lineHeight: 18 },

  // Intentions / Wins
  intentionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  intentionNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: APP_COLORS.primary,
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 24,
    overflow: 'hidden',
  },
  winStar: { fontSize: 16 },
  intentionInput: {
    flex: 1,
    backgroundColor: APP_COLORS.surfaceLight,
    borderRadius: 10,
    padding: 12,
    color: APP_COLORS.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
  },
  addIntentionBtn: { marginTop: 4 },
  addIntentionText: { color: APP_COLORS.primary, fontSize: 13, fontWeight: '600' },

  // Mood
  moodRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  moodBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: APP_COLORS.surfaceLight,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
  },
  moodBtnActive: {
    backgroundColor: APP_COLORS.primary + '20',
    borderColor: APP_COLORS.primary,
  },
  moodEmoji: { fontSize: 24 },
  moodLabel: { color: APP_COLORS.textMuted, fontSize: 10, fontWeight: '600', marginTop: 4 },
  moodLabelActive: { color: APP_COLORS.primary },

  // Reflection
  reflectionInput: {
    backgroundColor: APP_COLORS.surfaceLight,
    borderRadius: 12,
    padding: 14,
    color: APP_COLORS.text,
    fontSize: 15,
    minHeight: 100,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    lineHeight: 22,
  },

  // Save
  saveBtn: {
    backgroundColor: APP_COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  savedBadge: { alignItems: 'center', paddingVertical: 4 },
  savedBadgeText: { color: APP_COLORS.success, fontSize: 13, fontWeight: '600' },

  // AI Reflection
  aiHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  aiChip: {
    color: APP_COLORS.primaryLight,
    fontSize: 11,
    fontWeight: '700',
    backgroundColor: APP_COLORS.primary + '20',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden',
  },
  aiText: { color: APP_COLORS.textSecondary, fontSize: 14, lineHeight: 22 },
  regenerateBtn: { marginTop: 10 },
  regenerateText: { color: APP_COLORS.primary, fontSize: 13, fontWeight: '600' },
  generateBtn: {
    backgroundColor: APP_COLORS.surfaceLight,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
  },
  generateBtnDisabled: { opacity: 0.5 },
  generateContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  generateIcon: { fontSize: 20 },
  generateText: { color: APP_COLORS.text, fontSize: 15, fontWeight: '700' },
  generatingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  generatingText: { color: APP_COLORS.textSecondary, fontSize: 14 },
});
