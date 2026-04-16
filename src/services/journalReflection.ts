import * as SecureStore from 'expo-secure-store';
import { JournalEntry } from '../types';
import { DayStats } from './analytics';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

export async function generateJournalReflection(
  morning: JournalEntry | undefined,
  evening: JournalEntry | undefined,
  stats: DayStats,
  date: string
): Promise<string> {
  const apiKey = await SecureStore.getItemAsync('groq_api_key');
  if (!apiKey) throw new Error('API key not set');

  const morningSection = morning
    ? `Morning intentions: ${morning.intentions.join(', ') || 'None set'}`
    : 'No morning entry.';

  const eveningSection = evening
    ? `Evening wins: ${evening.wins.join(', ') || 'None listed'}
Mood: ${evening.moodRating ? `${evening.moodRating}/5` : 'Not rated'}
Reflection: ${evening.reflection || 'None'}`
    : 'No evening entry yet.';

  const timeSection = stats.totalTrackedSlots > 0
    ? `Time tracked: ${stats.totalDuration} (${stats.trackingPercentage}% of day)
Top activities: ${stats.categoryStats.slice(0, 5).map((c) => `${c.categoryName} ${c.duration}`).join(', ')}`
    : 'No time blocks tracked today.';

  const prompt = `You are a thoughtful daily journal companion. Analyze this person's day holistically by connecting their morning intentions, evening reflections, and actual time data.

Date: ${date}

${morningSection}

${eveningSection}

${timeSection}

Write a warm, insightful 3-4 sentence reflection that:
1. Connects their intentions to what they actually did (if both available)
2. Acknowledges their wins and mood
3. Offers one gentle, specific insight or pattern you notice
4. Ends with an encouraging forward-looking thought

Be conversational, not robotic. Max 100 words.`;

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: 'You are a supportive journal companion who writes warm, personalized reflections.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 250,
    }),
  });

  if (!response.ok) throw new Error(`API error: ${response.status}`);
  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || 'Could not generate reflection.';
}
