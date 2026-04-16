import { Category, TimeEntry } from '../types';
import { slotsToDuration, formatDate } from '../utils/time';

export interface CategoryStat {
  categoryId: string;
  categoryName: string;
  color: string;
  icon: string | null;
  totalSlots: number;
  duration: string;
  percentage: number;
}

export interface EisenhowerStat {
  quadrant: string;
  label: string;
  totalSlots: number;
  duration: string;
  percentage: number;
  color: string;
}

export interface DayStats {
  totalTrackedSlots: number;
  totalDuration: string;
  trackingPercentage: number;
  categoryStats: CategoryStat[];
  eisenhowerStats: EisenhowerStat[];
}

export interface WeeklyDayData {
  date: string;
  dayLabel: string; // "Mon", "Tue", etc.
  totalSlots: number;
  categorySlots: Record<string, number>; // categoryId -> slots
}

export interface WeeklyStats {
  days: WeeklyDayData[];
  startDate: string;
  endDate: string;
  totalSlots: number;
  avgSlotsPerDay: number;
  topCategories: { name: string; color: string; icon: string | null; totalSlots: number }[];
  // For stacked bar: ordered list of categories present in the week
  categoryOrder: { id: string; name: string; color: string; icon: string | null }[];
}

const EISENHOWER_LABELS: Record<string, { label: string; color: string }> = {
  'urgent-important': { label: 'Urgent & Important', color: '#E74C3C' },
  'not-urgent-important': { label: 'Not Urgent & Important', color: '#2ECC71' },
  'urgent-not-important': { label: 'Urgent & Not Important', color: '#F1C40F' },
  'not-urgent-not-important': { label: 'Not Urgent & Not Important', color: '#95A5A6' },
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function computeDayStats(
  entries: TimeEntry[],
  categories: Category[]
): DayStats {
  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  const catSlots = new Map<string, number>();
  let totalSlots = 0;

  for (const entry of entries) {
    const slots = entry.endSlot - entry.startSlot;
    totalSlots += slots;
    catSlots.set(entry.categoryId, (catSlots.get(entry.categoryId) || 0) + slots);
  }

  const categoryStats: CategoryStat[] = Array.from(catSlots.entries())
    .map(([catId, slots]) => {
      const cat = categoryMap.get(catId);
      return {
        categoryId: catId,
        categoryName: cat?.name || 'Unknown',
        color: cat?.color || '#95A5A6',
        icon: cat?.icon || null,
        totalSlots: slots,
        duration: slotsToDuration(slots),
        percentage: totalSlots > 0 ? Math.round((slots / totalSlots) * 100) : 0,
      };
    })
    .sort((a, b) => b.totalSlots - a.totalSlots);

  const eisSlots = new Map<string, number>();
  for (const entry of entries) {
    const cat = categoryMap.get(entry.categoryId);
    const quadrant = cat?.eisenhower;
    if (quadrant) {
      eisSlots.set(quadrant, (eisSlots.get(quadrant) || 0) + (entry.endSlot - entry.startSlot));
    }
  }

  const eisenhowerStats: EisenhowerStat[] = Object.entries(EISENHOWER_LABELS).map(
    ([quadrant, { label, color }]) => {
      const slots = eisSlots.get(quadrant) || 0;
      return {
        quadrant,
        label,
        totalSlots: slots,
        duration: slotsToDuration(slots),
        percentage: totalSlots > 0 ? Math.round((slots / totalSlots) * 100) : 0,
        color,
      };
    }
  );

  return {
    totalTrackedSlots: totalSlots,
    totalDuration: slotsToDuration(totalSlots),
    trackingPercentage: Math.round((totalSlots / 48) * 100),
    categoryStats,
    eisenhowerStats,
  };
}

// --- Weekly analytics ---

export function getWeekRange(referenceDate: string): { startDate: string; endDate: string } {
  const d = new Date(referenceDate + 'T12:00:00');
  const dayOfWeek = d.getDay(); // 0=Sun
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((dayOfWeek + 6) % 7)); // Go back to Monday
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    startDate: formatDate(monday),
    endDate: formatDate(sunday),
  };
}

export function computeWeeklyStats(
  entries: TimeEntry[],
  categories: Category[],
  startDate: string,
  endDate: string
): WeeklyStats {
  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  // Build 7 day buckets
  const days: WeeklyDayData[] = [];
  const current = new Date(startDate + 'T12:00:00');
  for (let i = 0; i < 7; i++) {
    const dateStr = formatDate(current);
    const dayOfWeek = current.getDay();
    days.push({
      date: dateStr,
      dayLabel: DAY_NAMES[dayOfWeek],
      totalSlots: 0,
      categorySlots: {},
    });
    current.setDate(current.getDate() + 1);
  }

  // Fill buckets
  const dayMap = new Map(days.map((d) => [d.date, d]));
  const globalCatSlots = new Map<string, number>();

  for (const entry of entries) {
    const day = dayMap.get(entry.date);
    if (!day) continue;
    const slots = entry.endSlot - entry.startSlot;
    day.totalSlots += slots;
    day.categorySlots[entry.categoryId] = (day.categorySlots[entry.categoryId] || 0) + slots;
    globalCatSlots.set(entry.categoryId, (globalCatSlots.get(entry.categoryId) || 0) + slots);
  }

  const totalSlots = days.reduce((sum, d) => sum + d.totalSlots, 0);
  const daysWithData = days.filter((d) => d.totalSlots > 0).length;

  // Top categories across the week, sorted by total
  const topCategories = Array.from(globalCatSlots.entries())
    .map(([catId, slots]) => {
      const cat = categoryMap.get(catId);
      return {
        name: cat?.name || 'Unknown',
        color: cat?.color || '#95A5A6',
        icon: cat?.icon || null,
        totalSlots: slots,
      };
    })
    .sort((a, b) => b.totalSlots - a.totalSlots);

  const categoryOrder = topCategories.map((tc) => {
    const cat = categories.find((c) => c.name === tc.name);
    return {
      id: cat?.id || '',
      name: tc.name,
      color: tc.color,
      icon: tc.icon,
    };
  });

  return {
    days,
    startDate,
    endDate,
    totalSlots,
    avgSlotsPerDay: daysWithData > 0 ? Math.round(totalSlots / daysWithData) : 0,
    topCategories,
    categoryOrder,
  };
}

// --- CSV Export ---

export function generateCSV(
  entries: TimeEntry[],
  categories: Category[]
): string {
  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  const header = 'Date,Start Time,End Time,Duration,Category,Eisenhower Quadrant,Label,Source';
  const rows = entries.map((e) => {
    const cat = categoryMap.get(e.categoryId);
    const startH = Math.floor(e.startSlot / 2);
    const startM = (e.startSlot % 2) * 30;
    const endH = Math.floor(e.endSlot / 2);
    const endM = (e.endSlot % 2) * 30;
    const startTime = `${startH.toString().padStart(2, '0')}:${startM.toString().padStart(2, '0')}`;
    const endTime = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;
    const duration = slotsToDuration(e.endSlot - e.startSlot);
    const catName = cat?.name || 'Unknown';
    const eisenhower = cat?.eisenhower || 'N/A';
    const label = (e.label || '').replace(/,/g, ';').replace(/"/g, "'");

    return `${e.date},${startTime},${endTime},${duration},${catName},${eisenhower},"${label}",${e.source}`;
  });

  return [header, ...rows].join('\n');
}
