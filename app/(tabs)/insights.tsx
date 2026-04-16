import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useEntryStore } from '../../src/stores/useEntryStore';
import { useCategoryStore } from '../../src/stores/useCategoryStore';
import { useApiKey } from '../../src/hooks/useApiKey';
import { APP_COLORS } from '../../src/constants/colors';
import {
  computeDayStats,
  computeWeeklyStats,
  getWeekRange,
  generateCSV,
  CategoryStat,
  EisenhowerStat,
  WeeklyStats,
} from '../../src/services/analytics';
import { getEntriesInRange } from '../../src/services/database';
import { generateDailyInsight } from '../../src/services/insightGenerator';
import { formatDateDisplay, slotsToDuration, formatDate } from '../../src/utils/time';

type Tab = 'today' | 'week';

export default function InsightsScreen() {
  const { entries, selectedDate } = useEntryStore();
  const { categories } = useCategoryStore();
  const { hasKey } = useApiKey();

  const [activeTab, setActiveTab] = useState<Tab>('today');

  // AI insight state
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [isGeneratingInsight, setIsGeneratingInsight] = useState(false);
  const [insightDate, setInsightDate] = useState<string | null>(null);

  // Weekly data state
  const [weeklyEntries, setWeeklyEntries] = useState<any[]>([]);
  const [weeklyLoaded, setWeeklyLoaded] = useState(false);

  const stats = useMemo(
    () => computeDayStats(entries, categories),
    [entries, categories]
  );

  const weekRange = useMemo(() => getWeekRange(selectedDate), [selectedDate]);

  // Load weekly entries when tab switches or date changes
  useEffect(() => {
    if (activeTab === 'week') {
      loadWeeklyData();
    }
  }, [activeTab, selectedDate]);

  const loadWeeklyData = useCallback(async () => {
    setWeeklyLoaded(false);
    const data = await getEntriesInRange(weekRange.startDate, weekRange.endDate);
    setWeeklyEntries(data);
    setWeeklyLoaded(true);
  }, [weekRange]);

  const weeklyStats = useMemo(
    () =>
      computeWeeklyStats(weeklyEntries, categories, weekRange.startDate, weekRange.endDate),
    [weeklyEntries, categories, weekRange]
  );

  // Generate AI insight
  const handleGenerateInsight = async () => {
    if (stats.totalTrackedSlots === 0) {
      Alert.alert('No Data', 'Track some time blocks first to get AI insights!');
      return;
    }
    setIsGeneratingInsight(true);
    try {
      const insight = await generateDailyInsight(stats, formatDateDisplay(selectedDate));
      setAiInsight(insight);
      setInsightDate(selectedDate);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Could not generate insight');
    } finally {
      setIsGeneratingInsight(false);
    }
  };

  // CSV Export
  const handleExport = async (scope: 'day' | 'week') => {
    try {
      let entriesToExport = entries;
      let filename = `time-tetris-${selectedDate}.csv`;

      if (scope === 'week') {
        entriesToExport = weeklyEntries.length > 0
          ? weeklyEntries
          : await getEntriesInRange(weekRange.startDate, weekRange.endDate);
        filename = `time-tetris-week-${weekRange.startDate}.csv`;
      }

      if (entriesToExport.length === 0) {
        Alert.alert('No Data', 'No entries to export for this period.');
        return;
      }

      const csv = generateCSV(entriesToExport, categories);
      const fileUri = FileSystem.documentDirectory + filename;
      await FileSystem.writeAsStringAsync(fileUri, csv, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: 'Export Time Tetris Data',
          UTI: 'public.comma-separated-values-text',
        });
      } else {
        Alert.alert('Exported', `File saved to ${fileUri}`);
      }
    } catch (error: any) {
      Alert.alert('Export Error', error.message || 'Failed to export');
    }
  };

  // Reset insight when date changes
  useEffect(() => {
    if (insightDate && insightDate !== selectedDate) {
      setAiInsight(null);
      setInsightDate(null);
    }
  }, [selectedDate]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Insights</Text>
        <Text style={styles.subtitle}>{formatDateDisplay(selectedDate)}</Text>
      </View>

      {/* Tab switcher */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'today' && styles.tabActive]}
          onPress={() => setActiveTab('today')}
        >
          <Text style={[styles.tabText, activeTab === 'today' && styles.tabTextActive]}>
            Today
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'week' && styles.tabActive]}
          onPress={() => setActiveTab('week')}
        >
          <Text style={[styles.tabText, activeTab === 'week' && styles.tabTextActive]}>
            This Week
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'today' ? (
          <>
            {/* Day Overview */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Day Overview</Text>
              <View style={styles.overviewRow}>
                <OverviewItem value={stats.totalDuration} label="Tracked" />
                <OverviewItem value={`${stats.trackingPercentage}%`} label="Coverage" />
                <OverviewItem value={`${stats.categoryStats.length}`} label="Activities" />
              </View>
            </View>

            {/* AI Insight */}
            <View style={styles.card}>
              <View style={styles.cardTitleRow}>
                <Text style={styles.cardTitle}>AI Daily Review</Text>
                <Text style={styles.aiChip}>Groq</Text>
              </View>
              {aiInsight && insightDate === selectedDate ? (
                <View>
                  <Text style={styles.aiInsightText}>{aiInsight}</Text>
                  <TouchableOpacity
                    style={styles.regenerateBtn}
                    onPress={handleGenerateInsight}
                  >
                    <Text style={styles.regenerateBtnText}>Regenerate</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.generateBtn,
                    (hasKey === false || stats.totalTrackedSlots === 0) && styles.generateBtnDisabled,
                  ]}
                  onPress={handleGenerateInsight}
                  disabled={isGeneratingInsight || hasKey === false}
                >
                  {isGeneratingInsight ? (
                    <View style={styles.generatingRow}>
                      <ActivityIndicator color={APP_COLORS.primary} size="small" />
                      <Text style={styles.generatingText}>Analyzing your day...</Text>
                    </View>
                  ) : (
                    <View style={styles.generateBtnContent}>
                      <Text style={styles.generateBtnIcon}>✨</Text>
                      <View>
                        <Text style={styles.generateBtnText}>
                          {hasKey === false
                            ? 'API key required'
                            : stats.totalTrackedSlots === 0
                            ? 'Track time first'
                            : 'Generate AI Insight'}
                        </Text>
                        <Text style={styles.generateBtnHint}>
                          Get a personalized analysis of your day
                        </Text>
                      </View>
                    </View>
                  )}
                </TouchableOpacity>
              )}
            </View>

            {/* Category Breakdown */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Time by Category</Text>
              {stats.categoryStats.length === 0 ? (
                <Text style={styles.emptyText}>No entries yet. Start tracking your day!</Text>
              ) : (
                stats.categoryStats.map((cat) => (
                  <CategoryBar key={cat.categoryId} stat={cat} />
                ))
              )}
            </View>

            {/* Eisenhower Matrix */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Eisenhower Matrix</Text>
              <Text style={styles.cardSubtitle}>How you prioritized your time</Text>
              <View style={styles.eisenhowerGrid}>
                {stats.eisenhowerStats.map((es) => (
                  <EisenhowerCell key={es.quadrant} stat={es} />
                ))}
              </View>
            </View>

            {/* Optimization Tips */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Optimization Tips</Text>
              <OptimizationTips stats={stats} />
            </View>

            {/* Export */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Export Data</Text>
              <TouchableOpacity style={styles.exportBtn} onPress={() => handleExport('day')}>
                <Text style={styles.exportBtnIcon}>📄</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.exportBtnText}>Export Today as CSV</Text>
                  <Text style={styles.exportBtnHint}>{entries.length} entries</Text>
                </View>
                <Text style={styles.exportChevron}>{'>'}</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            {/* Weekly view */}
            {!weeklyLoaded ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color={APP_COLORS.primary} size="large" />
                <Text style={styles.loadingText}>Loading week data...</Text>
              </View>
            ) : (
              <>
                {/* Week Overview */}
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Week Overview</Text>
                  <Text style={styles.cardSubtitle}>
                    {formatDateDisplay(weekRange.startDate)} — {formatDateDisplay(weekRange.endDate)}
                  </Text>
                  <View style={styles.overviewRow}>
                    <OverviewItem
                      value={slotsToDuration(weeklyStats.totalSlots)}
                      label="Total"
                    />
                    <OverviewItem
                      value={slotsToDuration(weeklyStats.avgSlotsPerDay)}
                      label="Avg / Day"
                    />
                    <OverviewItem
                      value={`${weeklyStats.days.filter((d) => d.totalSlots > 0).length}/7`}
                      label="Days Tracked"
                    />
                  </View>
                </View>

                {/* Stacked Bar Chart */}
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Daily Breakdown</Text>
                  <Text style={styles.cardSubtitle}>Hours tracked per day, by category</Text>
                  <WeeklyChart stats={weeklyStats} />
                </View>

                {/* Top Categories for the week */}
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Top Categories This Week</Text>
                  {weeklyStats.topCategories.length === 0 ? (
                    <Text style={styles.emptyText}>No data for this week yet.</Text>
                  ) : (
                    weeklyStats.topCategories.slice(0, 8).map((tc, i) => (
                      <View key={i} style={styles.weekCatRow}>
                        <Text style={styles.weekCatRank}>{i + 1}</Text>
                        <View style={[styles.weekCatDot, { backgroundColor: tc.color }]} />
                        <Text style={styles.weekCatIcon}>{tc.icon}</Text>
                        <Text style={styles.weekCatName}>{tc.name}</Text>
                        <Text style={styles.weekCatDuration}>
                          {slotsToDuration(tc.totalSlots)}
                        </Text>
                      </View>
                    ))
                  )}
                </View>

                {/* Export Week */}
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Export Data</Text>
                  <TouchableOpacity
                    style={styles.exportBtn}
                    onPress={() => handleExport('week')}
                  >
                    <Text style={styles.exportBtnIcon}>📊</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.exportBtnText}>Export Week as CSV</Text>
                      <Text style={styles.exportBtnHint}>
                        {weeklyEntries.length} entries across{' '}
                        {weeklyStats.days.filter((d) => d.totalSlots > 0).length} days
                      </Text>
                    </View>
                    <Text style={styles.exportChevron}>{'>'}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// --- Sub-components ---

function OverviewItem({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.overviewItem}>
      <Text style={styles.overviewValue}>{value}</Text>
      <Text style={styles.overviewLabel}>{label}</Text>
    </View>
  );
}

function CategoryBar({ stat }: { stat: CategoryStat }) {
  return (
    <View style={styles.catBarRow}>
      <View style={styles.catBarInfo}>
        <Text style={styles.catBarIcon}>{stat.icon}</Text>
        <Text style={styles.catBarName}>{stat.categoryName}</Text>
        <Text style={styles.catBarDuration}>{stat.duration}</Text>
      </View>
      <View style={styles.catBar}>
        <View
          style={[
            styles.catBarFill,
            { width: `${Math.max(stat.percentage, 3)}%`, backgroundColor: stat.color },
          ]}
        />
      </View>
    </View>
  );
}

function EisenhowerCell({ stat }: { stat: EisenhowerStat }) {
  return (
    <View style={[styles.eisenhowerCell, { borderColor: stat.color + '60' }]}>
      <Text style={[styles.eisenhowerDuration, { color: stat.color }]}>
        {stat.duration || '0m'}
      </Text>
      <Text style={styles.eisenhowerLabel} numberOfLines={2}>
        {stat.label}
      </Text>
      <Text style={styles.eisenhowerPercent}>{stat.percentage}%</Text>
    </View>
  );
}

function OptimizationTips({ stats }: { stats: ReturnType<typeof computeDayStats> }) {
  const tips: string[] = [];
  const q2 = stats.eisenhowerStats.find((e) => e.quadrant === 'not-urgent-important');
  const q4 = stats.eisenhowerStats.find((e) => e.quadrant === 'not-urgent-not-important');
  const q3 = stats.eisenhowerStats.find((e) => e.quadrant === 'urgent-not-important');

  if (q2 && q2.totalSlots >= 8) {
    tips.push('Great focus on Q2 (Important, Not Urgent)! This is where deep work happens.');
  } else if (q2 && q2.totalSlots < 4 && stats.totalTrackedSlots > 0) {
    tips.push('Try to increase Q2 time (Important, Not Urgent) — this is where growth happens.');
  }
  if (q4 && q4.totalSlots > 4) {
    tips.push(`You spent ${q4.duration} on Q4 activities. Consider reducing and redirecting to Q2.`);
  }
  if (q3 && q3.totalSlots > 6) {
    tips.push(`${q3.duration} on urgent but not important tasks. Can any be delegated or batched?`);
  }
  if (stats.trackingPercentage < 50 && stats.totalTrackedSlots > 0) {
    tips.push('Track more of your day to get better insights!');
  }
  if (tips.length === 0) {
    tips.push('Keep tracking to see personalized optimization tips!');
  }

  return (
    <View>
      {tips.map((tip, i) => (
        <View key={i} style={styles.tipRow}>
          <Text style={styles.tipBullet}>{'>'}</Text>
          <Text style={styles.tipText}>{tip}</Text>
        </View>
      ))}
    </View>
  );
}

// --- Weekly Stacked Bar Chart (pure RN, no library) ---

function WeeklyChart({ stats }: { stats: WeeklyStats }) {
  const maxSlots = Math.max(...stats.days.map((d) => d.totalSlots), 1);
  const BAR_MAX_HEIGHT = 160;

  if (stats.totalSlots === 0) {
    return <Text style={styles.emptyText}>No data for this week yet.</Text>;
  }

  return (
    <View>
      {/* Chart */}
      <View style={styles.chartContainer}>
        {stats.days.map((day) => {
          const barHeight = (day.totalSlots / maxSlots) * BAR_MAX_HEIGHT;
          // Build stacked segments
          const segments: { color: string; height: number }[] = [];
          for (const cat of stats.categoryOrder) {
            const catSlots = day.categorySlots[cat.id] || 0;
            if (catSlots > 0) {
              const segHeight = (catSlots / maxSlots) * BAR_MAX_HEIGHT;
              segments.push({ color: cat.color, height: segHeight });
            }
          }

          return (
            <View key={day.date} style={styles.chartDayCol}>
              {/* Bar */}
              <View style={[styles.chartBarWrapper, { height: BAR_MAX_HEIGHT }]}>
                <View style={{ justifyContent: 'flex-end', height: '100%' }}>
                  {segments.length > 0 ? (
                    segments.map((seg, i) => (
                      <View
                        key={i}
                        style={{
                          height: seg.height,
                          backgroundColor: seg.color,
                          borderTopLeftRadius: i === segments.length - 1 ? 4 : 0,
                          borderTopRightRadius: i === segments.length - 1 ? 4 : 0,
                        }}
                      />
                    ))
                  ) : (
                    <View
                      style={{
                        height: 2,
                        backgroundColor: APP_COLORS.surfaceLight,
                        borderRadius: 1,
                      }}
                    />
                  )}
                </View>
              </View>
              {/* Hours label */}
              <Text style={styles.chartHoursLabel}>
                {day.totalSlots > 0 ? slotsToDuration(day.totalSlots) : '—'}
              </Text>
              {/* Day label */}
              <Text style={styles.chartDayLabel}>{day.dayLabel}</Text>
            </View>
          );
        })}
      </View>

      {/* Legend */}
      <View style={styles.legendContainer}>
        {stats.categoryOrder.slice(0, 6).map((cat) => (
          <View key={cat.id} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: cat.color }]} />
            <Text style={styles.legendText} numberOfLines={1}>
              {cat.icon} {cat.name}
            </Text>
          </View>
        ))}
        {stats.categoryOrder.length > 6 && (
          <Text style={styles.legendMore}>+{stats.categoryOrder.length - 6} more</Text>
        )}
      </View>
    </View>
  );
}

// --- Styles ---

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
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: APP_COLORS.surface,
  },
  tabActive: {
    backgroundColor: APP_COLORS.primary + '25',
    borderWidth: 1,
    borderColor: APP_COLORS.primary,
  },
  tabText: { color: APP_COLORS.textMuted, fontSize: 14, fontWeight: '600' },
  tabTextActive: { color: APP_COLORS.primary },

  // Cards
  card: {
    backgroundColor: APP_COLORS.surface,
    margin: 16,
    marginBottom: 0,
    borderRadius: 16,
    padding: 16,
  },
  cardTitle: { color: APP_COLORS.text, fontSize: 17, fontWeight: '700', marginBottom: 4 },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  cardSubtitle: { color: APP_COLORS.textMuted, fontSize: 12, marginBottom: 12 },
  emptyText: {
    color: APP_COLORS.textMuted,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 20,
  },

  // Overview
  overviewRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 12 },
  overviewItem: { alignItems: 'center' },
  overviewValue: { color: APP_COLORS.primary, fontSize: 24, fontWeight: '700' },
  overviewLabel: { color: APP_COLORS.textMuted, fontSize: 12, marginTop: 4 },

  // AI Insight
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
  aiInsightText: {
    color: APP_COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 22,
  },
  regenerateBtn: { marginTop: 12, alignSelf: 'flex-start' },
  regenerateBtnText: { color: APP_COLORS.primary, fontSize: 13, fontWeight: '600' },
  generateBtn: {
    backgroundColor: APP_COLORS.surfaceLight,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
  },
  generateBtnDisabled: { opacity: 0.5 },
  generateBtnContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  generateBtnIcon: { fontSize: 28 },
  generateBtnText: { color: APP_COLORS.text, fontSize: 15, fontWeight: '700' },
  generateBtnHint: { color: APP_COLORS.textMuted, fontSize: 12, marginTop: 2 },
  generatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  generatingText: { color: APP_COLORS.textSecondary, fontSize: 14 },

  // Category bars
  catBarRow: { marginTop: 10 },
  catBarInfo: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  catBarIcon: { fontSize: 14 },
  catBarName: { color: APP_COLORS.text, fontSize: 13, fontWeight: '500', flex: 1 },
  catBarDuration: { color: APP_COLORS.textSecondary, fontSize: 12, fontWeight: '600' },
  catBar: {
    height: 8,
    backgroundColor: APP_COLORS.surfaceLight,
    borderRadius: 4,
    overflow: 'hidden',
  },
  catBarFill: { height: '100%', borderRadius: 4 },

  // Eisenhower
  eisenhowerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  eisenhowerCell: {
    width: '48%',
    backgroundColor: APP_COLORS.surfaceLight,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
  },
  eisenhowerDuration: { fontSize: 20, fontWeight: '700' },
  eisenhowerLabel: {
    color: APP_COLORS.textSecondary,
    fontSize: 11,
    marginTop: 4,
    lineHeight: 15,
  },
  eisenhowerPercent: { color: APP_COLORS.textMuted, fontSize: 11, marginTop: 2 },

  // Tips
  tipRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  tipBullet: { color: APP_COLORS.primary, fontSize: 14, fontWeight: '700' },
  tipText: { color: APP_COLORS.textSecondary, fontSize: 13, flex: 1, lineHeight: 19 },

  // Export
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: APP_COLORS.surfaceLight,
    borderRadius: 12,
    padding: 14,
    gap: 12,
    marginTop: 8,
  },
  exportBtnIcon: { fontSize: 24 },
  exportBtnText: { color: APP_COLORS.text, fontSize: 14, fontWeight: '600' },
  exportBtnHint: { color: APP_COLORS.textMuted, fontSize: 12, marginTop: 1 },
  exportChevron: { color: APP_COLORS.textMuted, fontSize: 16 },

  // Loading
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  loadingText: { color: APP_COLORS.textSecondary, fontSize: 14 },

  // Weekly chart
  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 4,
    marginBottom: 12,
  },
  chartDayCol: { alignItems: 'center', flex: 1, gap: 4 },
  chartBarWrapper: {
    width: 28,
    justifyContent: 'flex-end',
    borderRadius: 4,
    overflow: 'hidden',
  },
  chartHoursLabel: {
    color: APP_COLORS.textMuted,
    fontSize: 9,
    fontWeight: '600',
  },
  chartDayLabel: {
    color: APP_COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  legendContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: APP_COLORS.border,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: APP_COLORS.textMuted, fontSize: 11 },
  legendMore: { color: APP_COLORS.textMuted, fontSize: 11, fontStyle: 'italic' },

  // Week category ranking
  weekCatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: APP_COLORS.border,
  },
  weekCatRank: {
    color: APP_COLORS.textMuted,
    fontSize: 12,
    fontWeight: '700',
    width: 18,
    textAlign: 'center',
  },
  weekCatDot: { width: 12, height: 12, borderRadius: 6 },
  weekCatIcon: { fontSize: 14 },
  weekCatName: { color: APP_COLORS.text, fontSize: 14, fontWeight: '500', flex: 1 },
  weekCatDuration: { color: APP_COLORS.textSecondary, fontSize: 13, fontWeight: '600' },
});
