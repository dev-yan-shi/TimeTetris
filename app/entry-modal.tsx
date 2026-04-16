import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEntryStore } from '../src/stores/useEntryStore';
import { useCategoryStore } from '../src/stores/useCategoryStore';
import { parseNaturalLanguage } from '../src/services/nlpParser';
import {
  startRecording,
  stopRecording,
  cancelRecording,
  transcribeAudio,
} from '../src/services/voiceRecorder';
import { useApiKey } from '../src/hooks/useApiKey';
import { APP_COLORS } from '../src/constants/colors';
import { timeToSlot, slotToTime, slotsToDuration } from '../src/utils/time';
import { PendingEntry } from '../src/types';
import * as Haptics from 'expo-haptics';

type InputMode = 'quick' | 'text' | 'voice';

export default function EntryModal() {
  const router = useRouter();
  const params = useLocalSearchParams<{ slot?: string; date?: string; mode?: string }>();
  const { addEntry, selectedDate } = useEntryStore();
  const { categories, findCategoryByName } = useCategoryStore();
  const { hasKey, recheckKey } = useApiKey();

  const initialSlot = params.slot ? parseInt(params.slot, 10) : null;
  const paramMode = params.mode as InputMode | undefined;
  const [activeMode, setActiveMode] = useState<InputMode>(
    paramMode || (initialSlot !== null ? 'quick' : 'text')
  );

  // Text input state
  const [textInput, setTextInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Voice recording state
  const [isRecordingActive, setIsRecordingActive] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [recordingDuration, setRecordingDuration] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Parsed entries state
  const [pendingEntries, setPendingEntries] = useState<PendingEntry[]>([]);
  const [expandedPickerIndex, setExpandedPickerIndex] = useState<number | null>(null);

  // Quick-tap: multi-slot selection
  const [quickStartSlot, setQuickStartSlot] = useState<number | null>(initialSlot);
  const [quickEndSlot, setQuickEndSlot] = useState<number | null>(
    initialSlot !== null ? initialSlot + 1 : null
  );

  // Cleanup recording on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      cancelRecording();
    };
  }, []);

  // Pulse animation for recording
  useEffect(() => {
    if (isRecordingActive) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.3, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecordingActive]);

  // Recheck API key when modal focuses (after coming back from settings)
  useEffect(() => {
    recheckKey();
  }, [activeMode]);

  // ----- Handlers -----

  const handleQuickTap = async (categoryId: string) => {
    if (quickStartSlot === null || quickEndSlot === null) return;
    try {
      await addEntry(quickStartSlot, quickEndSlot, categoryId, null, 'quick-tap');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (error) {
      Alert.alert('Error', 'Failed to add entry');
    }
  };

  const handleStartRecording = async () => {
    try {
      await startRecording();
      setIsRecordingActive(true);
      setRecordingDuration(0);
      setTranscript('');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      timerRef.current = setInterval(() => {
        setRecordingDuration((d) => d + 1);
      }, 1000);
    } catch (error: any) {
      Alert.alert('Microphone Error', error.message || 'Could not start recording');
    }
  };

  const handleStopRecording = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecordingActive(false);
    setIsTranscribing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const uri = await stopRecording();
      const text = await transcribeAudio(uri);
      if (!text.trim()) {
        Alert.alert('No Speech Detected', 'Could not detect any speech. Try again.');
        setIsTranscribing(false);
        return;
      }
      setTranscript(text);
      setTextInput(text);
      setIsTranscribing(false);

      // Auto-parse the transcript
      await parseInput(text);
    } catch (error: any) {
      setIsTranscribing(false);
      Alert.alert('Transcription Error', error.message || 'Failed to transcribe audio');
    }
  };

  const handleCancelRecording = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecordingActive(false);
    setRecordingDuration(0);
    await cancelRecording();
  };

  const parseInput = async (input?: string) => {
    const text = input || textInput;
    if (!text.trim()) return;

    setIsProcessing(true);
    try {
      const categoryNames = categories.map((c) => c.name);
      const parsed = await parseNaturalLanguage(text.trim(), categoryNames);

      const pending: PendingEntry[] = parsed.map((p) => {
        const matched = findCategoryByName(p.suggestedCategory);
        const startSlot = timeToSlot(p.startTime);
        const endSlot = timeToSlot(p.endTime);
        return {
          parsed: { ...p, suggestedCategoryId: matched?.id || null },
          startSlot,
          endSlot: endSlot <= startSlot ? startSlot + 1 : endSlot,
          categoryId: matched?.id || categories[0]?.id || '',
          label: p.activity,
        };
      });

      setPendingEntries(pending);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      Alert.alert('Parse Error', error.message || 'Failed to parse input');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmAll = async () => {
    try {
      for (const entry of pendingEntries) {
        await addEntry(
          entry.startSlot,
          entry.endSlot,
          entry.categoryId,
          entry.label,
          activeMode === 'voice' ? 'voice' : 'manual'
        );
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (error) {
      Alert.alert('Error', 'Failed to add entries');
    }
  };

  const updatePendingCategory = (index: number, categoryId: string) => {
    setPendingEntries((prev) =>
      prev.map((e, i) => (i === index ? { ...e, categoryId } : e))
    );
    setExpandedPickerIndex(null);
  };

  const resetInput = () => {
    setPendingEntries([]);
    setTextInput('');
    setTranscript('');
  };

  const formatDuration = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // ----- API Key Banner -----
  const renderApiKeyBanner = () => {
    if (hasKey !== false) return null;
    return (
      <View style={styles.apiKeyBanner}>
        <Text style={styles.apiKeyBannerIcon}>🔑</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.apiKeyBannerTitle}>Groq API Key Required</Text>
          <Text style={styles.apiKeyBannerText}>
            Free AI-powered parsing needs a Groq API key. Get one at console.groq.com
          </Text>
        </View>
        <TouchableOpacity
          style={styles.apiKeyBannerBtn}
          onPress={() => router.push('/settings')}
        >
          <Text style={styles.apiKeyBannerBtnText}>Setup</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // ----- Mode Tabs -----
  const renderModeTabs = () => {
    if (initialSlot !== null && pendingEntries.length === 0) {
      // Coming from grid tap - show all three modes
    }
    const modes: { key: InputMode; label: string; icon: string }[] = [
      { key: 'quick', label: 'Quick', icon: '👆' },
      { key: 'text', label: 'Type', icon: '✏️' },
      { key: 'voice', label: 'Voice', icon: '🎙️' },
    ];

    return (
      <View style={styles.modeTabs}>
        {modes.map((m) => (
          <TouchableOpacity
            key={m.key}
            style={[styles.modeTab, activeMode === m.key && styles.modeTabActive]}
            onPress={() => {
              setActiveMode(m.key);
              if (m.key !== 'voice') handleCancelRecording();
            }}
          >
            <Text style={styles.modeTabIcon}>{m.icon}</Text>
            <Text
              style={[styles.modeTabLabel, activeMode === m.key && styles.modeTabLabelActive]}
            >
              {m.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  // ----- Quick Tap Section -----
  const renderQuickTap = () => {
    if (quickStartSlot === null || quickEndSlot === null) {
      return (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Add</Text>
          <Text style={styles.hint}>Tap a time slot on the grid first, then pick a category here.</Text>
        </View>
      );
    }

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {slotToTime(quickStartSlot)} - {slotToTime(quickEndSlot)}
        </Text>

        {/* Duration adjuster */}
        <View style={styles.durationRow}>
          <Text style={styles.durationLabel}>Duration:</Text>
          {[1, 2, 3, 4].map((slots) => (
            <TouchableOpacity
              key={slots}
              style={[
                styles.durationChip,
                quickEndSlot - quickStartSlot === slots && styles.durationChipActive,
              ]}
              onPress={() => setQuickEndSlot(quickStartSlot + slots)}
            >
              <Text
                style={[
                  styles.durationChipText,
                  quickEndSlot - quickStartSlot === slots && styles.durationChipTextActive,
                ]}
              >
                {slotsToDuration(slots)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.pickLabel}>Pick a category:</Text>
        <View style={styles.categoryGrid}>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.categoryChip, { backgroundColor: cat.color + '25', borderColor: cat.color }]}
              onPress={() => handleQuickTap(cat.id)}
            >
              <Text style={styles.categoryChipIcon}>{cat.icon}</Text>
              <Text style={[styles.categoryChipName, { color: cat.color }]}>{cat.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  // ----- Voice Section -----
  const renderVoice = () => (
    <View style={styles.section}>
      {renderApiKeyBanner()}

      {pendingEntries.length === 0 && (
        <>
          <Text style={styles.sectionTitle}>Voice Entry</Text>
          <Text style={styles.hint}>
            Tap the mic and describe what you did. E.g. "I worked out from 7 to 8 AM, then had breakfast for 30 minutes."
          </Text>

          {/* Recording area */}
          <View style={styles.voiceArea}>
            {isTranscribing ? (
              <View style={styles.transcribingContainer}>
                <ActivityIndicator color={APP_COLORS.primary} size="large" />
                <Text style={styles.transcribingText}>Transcribing...</Text>
              </View>
            ) : isRecordingActive ? (
              <View style={styles.recordingContainer}>
                <Animated.View
                  style={[
                    styles.recordingPulse,
                    { transform: [{ scale: pulseAnim }] },
                  ]}
                >
                  <View style={styles.recordingDotOuter}>
                    <View style={styles.recordingDotInner} />
                  </View>
                </Animated.View>
                <Text style={styles.recordingTimer}>{formatDuration(recordingDuration)}</Text>
                <Text style={styles.recordingHint}>Listening...</Text>

                <View style={styles.recordingActions}>
                  <TouchableOpacity style={styles.cancelRecordBtn} onPress={handleCancelRecording}>
                    <Text style={styles.cancelRecordBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.stopRecordBtn} onPress={handleStopRecording}>
                    <Text style={styles.stopRecordBtnIcon}>⬜</Text>
                    <Text style={styles.stopRecordBtnText}>Done</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.micButton, hasKey === false && styles.micButtonDisabled]}
                onPress={hasKey === false ? () => router.push('/settings') : handleStartRecording}
                activeOpacity={0.7}
              >
                <Text style={styles.micButtonIcon}>🎙️</Text>
                <Text style={styles.micButtonText}>
                  {hasKey === false ? 'Set up API key first' : 'Tap to Record'}
                </Text>
              </TouchableOpacity>
            )}

            {/* Show transcript if we have one */}
            {transcript && !isRecordingActive && !isTranscribing && (
              <View style={styles.transcriptBox}>
                <Text style={styles.transcriptLabel}>Transcript:</Text>
                <Text style={styles.transcriptText}>{transcript}</Text>
              </View>
            )}
          </View>

          {/* Show processing state */}
          {isProcessing && (
            <View style={styles.processingContainer}>
              <ActivityIndicator color={APP_COLORS.primary} size="small" />
              <Text style={styles.processingText}>Parsing with AI...</Text>
            </View>
          )}
        </>
      )}
    </View>
  );

  // ----- Text Section -----
  const renderText = () => (
    <View style={styles.section}>
      {renderApiKeyBanner()}

      {pendingEntries.length === 0 && (
        <>
          <Text style={styles.sectionTitle}>Type Entry</Text>
          <Text style={styles.hint}>
            Describe what you did in natural language. You can include multiple activities.
          </Text>
          <TextInput
            style={styles.textInput}
            value={textInput}
            onChangeText={setTextInput}
            placeholder={`E.g. "Worked on app from 2 to 4pm, then took a 30 min break"`}
            placeholderTextColor={APP_COLORS.textMuted}
            multiline
            autoFocus
          />
          <TouchableOpacity
            style={[
              styles.parseBtn,
              (!textInput.trim() || hasKey === false) && styles.parseBtnDisabled,
            ]}
            onPress={() => parseInput()}
            disabled={isProcessing || !textInput.trim() || hasKey === false}
          >
            {isProcessing ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <Text style={styles.parseBtnText}>
                {hasKey === false ? 'Set up API key first' : 'Parse with AI'}
              </Text>
            )}
          </TouchableOpacity>
        </>
      )}
    </View>
  );

  // ----- Pending Entries Verification -----
  const renderPendingEntries = () => {
    if (pendingEntries.length === 0) return null;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Verify Entries</Text>
        <Text style={styles.hint}>Tap a category to change it. Adjust times if needed.</Text>

        {pendingEntries.map((entry, index) => {
          const cat = categories.find((c) => c.id === entry.categoryId);
          return (
            <View key={index} style={styles.pendingCard}>
              {/* Time and confidence */}
              <View style={styles.pendingHeader}>
                <View style={styles.pendingTimeRow}>
                  <Text style={styles.pendingTimeText}>
                    {slotToTime(entry.startSlot)} - {slotToTime(entry.endSlot)}
                  </Text>
                  <Text style={styles.pendingDuration}>
                    {slotsToDuration(entry.endSlot - entry.startSlot)}
                  </Text>
                </View>
                {entry.parsed.confidence === 'low' && (
                  <View style={styles.lowConfBadge}>
                    <Text style={styles.lowConfText}>Check time</Text>
                  </View>
                )}
              </View>

              {/* Time adjustment buttons */}
              <View style={styles.timeAdjustRow}>
                <TouchableOpacity
                  style={styles.timeAdjustBtn}
                  onPress={() => {
                    setPendingEntries((prev) =>
                      prev.map((e, i) =>
                        i === index && e.startSlot > 0
                          ? { ...e, startSlot: e.startSlot - 1 }
                          : e
                      )
                    );
                  }}
                >
                  <Text style={styles.timeAdjustBtnText}>Start -30m</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.timeAdjustBtn}
                  onPress={() => {
                    setPendingEntries((prev) =>
                      prev.map((e, i) =>
                        i === index && e.startSlot < e.endSlot - 1
                          ? { ...e, startSlot: e.startSlot + 1 }
                          : e
                      )
                    );
                  }}
                >
                  <Text style={styles.timeAdjustBtnText}>Start +30m</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.timeAdjustBtn}
                  onPress={() => {
                    setPendingEntries((prev) =>
                      prev.map((e, i) =>
                        i === index && e.endSlot < 48
                          ? { ...e, endSlot: e.endSlot + 1 }
                          : e
                      )
                    );
                  }}
                >
                  <Text style={styles.timeAdjustBtnText}>End +30m</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.timeAdjustBtn}
                  onPress={() => {
                    setPendingEntries((prev) =>
                      prev.map((e, i) =>
                        i === index && e.endSlot > e.startSlot + 1
                          ? { ...e, endSlot: e.endSlot - 1 }
                          : e
                      )
                    );
                  }}
                >
                  <Text style={styles.timeAdjustBtnText}>End -30m</Text>
                </TouchableOpacity>
              </View>

              {/* Activity label */}
              <Text style={styles.pendingLabel}>{entry.label}</Text>

              {/* Category selector */}
              <TouchableOpacity
                style={[
                  styles.pendingCategory,
                  { backgroundColor: (cat?.color || '#666') + '25', borderColor: cat?.color || '#666' },
                ]}
                onPress={() =>
                  setExpandedPickerIndex(expandedPickerIndex === index ? null : index)
                }
              >
                <Text style={styles.pendingCatIcon}>{cat?.icon}</Text>
                <Text style={[styles.pendingCatName, { color: cat?.color }]}>
                  {cat?.name || 'Select category'}
                </Text>
                <Text style={styles.pendingCatChevron}>
                  {expandedPickerIndex === index ? '▲' : '▼'}
                </Text>
              </TouchableOpacity>

              {/* Expanded category picker */}
              {expandedPickerIndex === index && (
                <View style={styles.inlinePicker}>
                  {categories.map((c) => (
                    <TouchableOpacity
                      key={c.id}
                      style={[
                        styles.inlinePickerItem,
                        c.id === entry.categoryId && { backgroundColor: c.color + '30', borderColor: c.color, borderWidth: 1 },
                      ]}
                      onPress={() => updatePendingCategory(index, c.id)}
                    >
                      <Text>{c.icon}</Text>
                      <Text
                        style={[
                          styles.inlinePickerName,
                          { color: c.id === entry.categoryId ? c.color : APP_COLORS.text },
                        ]}
                      >
                        {c.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Remove single entry */}
              {pendingEntries.length > 1 && (
                <TouchableOpacity
                  style={styles.removeEntryBtn}
                  onPress={() =>
                    setPendingEntries((prev) => prev.filter((_, i) => i !== index))
                  }
                >
                  <Text style={styles.removeEntryBtnText}>Remove</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}

        {/* Action buttons */}
        <View style={styles.confirmRow}>
          <TouchableOpacity style={styles.editBtn} onPress={resetInput}>
            <Text style={styles.editBtnText}>Start Over</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirmAll}>
            <Text style={styles.confirmBtnText}>
              Add {pendingEntries.length} {pendingEntries.length === 1 ? 'Entry' : 'Entries'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => { cancelRecording(); router.back(); }}>
            <Text style={styles.cancelBtn}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add Entry</Text>
          <View style={{ width: 60 }} />
        </View>

        {/* Mode tabs (only when no pending entries) */}
        {pendingEntries.length === 0 && renderModeTabs()}

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Content based on mode */}
          {activeMode === 'quick' && pendingEntries.length === 0 && renderQuickTap()}
          {activeMode === 'text' && renderText()}
          {activeMode === 'voice' && renderVoice()}

          {/* Pending entries (shown regardless of mode) */}
          {renderPendingEntries()}
        </ScrollView>
      </KeyboardAvoidingView>
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
    color: APP_COLORS.primary,
    fontSize: 16,
    fontWeight: '500',
  },
  headerTitle: {
    color: APP_COLORS.text,
    fontSize: 17,
    fontWeight: '700',
  },

  // Mode tabs
  modeTabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: APP_COLORS.border,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
    backgroundColor: APP_COLORS.surface,
  },
  modeTabActive: {
    backgroundColor: APP_COLORS.primary + '25',
    borderWidth: 1,
    borderColor: APP_COLORS.primary,
  },
  modeTabIcon: {
    fontSize: 16,
  },
  modeTabLabel: {
    color: APP_COLORS.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  modeTabLabelActive: {
    color: APP_COLORS.primary,
  },

  // Sections
  section: {
    padding: 16,
  },
  sectionTitle: {
    color: APP_COLORS.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  hint: {
    color: APP_COLORS.textMuted,
    fontSize: 13,
    marginBottom: 16,
    lineHeight: 19,
  },

  // API Key Banner
  apiKeyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: APP_COLORS.warning + '15',
    borderWidth: 1,
    borderColor: APP_COLORS.warning + '40',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 10,
  },
  apiKeyBannerIcon: {
    fontSize: 24,
  },
  apiKeyBannerTitle: {
    color: APP_COLORS.warning,
    fontSize: 14,
    fontWeight: '700',
  },
  apiKeyBannerText: {
    color: APP_COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
    lineHeight: 17,
  },
  apiKeyBannerBtn: {
    backgroundColor: APP_COLORS.warning,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  apiKeyBannerBtnText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 13,
  },

  // Quick tap
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
    marginTop: 8,
  },
  durationLabel: {
    color: APP_COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  durationChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: APP_COLORS.surface,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
  },
  durationChipActive: {
    backgroundColor: APP_COLORS.primary + '25',
    borderColor: APP_COLORS.primary,
  },
  durationChipText: {
    color: APP_COLORS.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  durationChipTextActive: {
    color: APP_COLORS.primary,
  },
  pickLabel: {
    color: APP_COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 10,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  categoryChipIcon: {
    fontSize: 16,
  },
  categoryChipName: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Voice
  voiceArea: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  micButton: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: APP_COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: APP_COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  micButtonDisabled: {
    backgroundColor: APP_COLORS.surfaceLight,
    shadowOpacity: 0,
  },
  micButtonIcon: {
    fontSize: 40,
  },
  micButtonText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'center',
  },
  recordingContainer: {
    alignItems: 'center',
    gap: 12,
  },
  recordingPulse: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: APP_COLORS.accent + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingDotOuter: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: APP_COLORS.accent + '40',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingDotInner: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: APP_COLORS.accent,
  },
  recordingTimer: {
    color: APP_COLORS.text,
    fontSize: 32,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  recordingHint: {
    color: APP_COLORS.textMuted,
    fontSize: 14,
  },
  recordingActions: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 12,
  },
  cancelRecordBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
  },
  cancelRecordBtnText: {
    color: APP_COLORS.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  stopRecordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: APP_COLORS.accent,
    gap: 6,
  },
  stopRecordBtnIcon: {
    fontSize: 14,
    color: '#FFF',
  },
  stopRecordBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  transcribingContainer: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 30,
  },
  transcribingText: {
    color: APP_COLORS.textSecondary,
    fontSize: 15,
  },
  transcriptBox: {
    backgroundColor: APP_COLORS.surface,
    borderRadius: 12,
    padding: 14,
    marginTop: 20,
    width: '100%',
    borderWidth: 1,
    borderColor: APP_COLORS.border,
  },
  transcriptLabel: {
    color: APP_COLORS.textMuted,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  transcriptText: {
    color: APP_COLORS.text,
    fontSize: 15,
    lineHeight: 22,
  },
  processingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
  },
  processingText: {
    color: APP_COLORS.textSecondary,
    fontSize: 14,
  },

  // Text input
  textInput: {
    backgroundColor: APP_COLORS.surface,
    borderRadius: 12,
    padding: 16,
    color: APP_COLORS.text,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    lineHeight: 24,
  },
  parseBtn: {
    backgroundColor: APP_COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  parseBtnDisabled: {
    opacity: 0.5,
  },
  parseBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },

  // Pending entries
  pendingCard: {
    backgroundColor: APP_COLORS.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
  },
  pendingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pendingTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pendingTimeText: {
    color: APP_COLORS.text,
    fontSize: 16,
    fontWeight: '700',
  },
  pendingDuration: {
    color: APP_COLORS.textMuted,
    fontSize: 12,
  },
  timeAdjustRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
  },
  timeAdjustBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: APP_COLORS.surfaceLight,
  },
  timeAdjustBtnText: {
    color: APP_COLORS.textMuted,
    fontSize: 10,
    fontWeight: '600',
  },
  lowConfBadge: {
    backgroundColor: APP_COLORS.warning + '30',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  lowConfText: {
    color: APP_COLORS.warning,
    fontSize: 11,
    fontWeight: '600',
  },
  pendingLabel: {
    color: APP_COLORS.textSecondary,
    fontSize: 14,
    marginTop: 8,
    marginBottom: 10,
  },
  pendingCategory: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  pendingCatIcon: {
    fontSize: 16,
  },
  pendingCatName: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  pendingCatChevron: {
    color: APP_COLORS.textMuted,
    fontSize: 10,
  },
  inlinePicker: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  inlinePickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 5,
    backgroundColor: APP_COLORS.surfaceLight,
  },
  inlinePickerName: {
    fontSize: 12,
    fontWeight: '500',
  },
  removeEntryBtn: {
    marginTop: 8,
    alignSelf: 'flex-end',
  },
  removeEntryBtnText: {
    color: APP_COLORS.accent,
    fontSize: 12,
    fontWeight: '600',
  },
  confirmRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  editBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  editBtnText: {
    color: APP_COLORS.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  confirmBtn: {
    flex: 2,
    backgroundColor: APP_COLORS.success,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
