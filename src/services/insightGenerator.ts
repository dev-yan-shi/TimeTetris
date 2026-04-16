import * as SecureStore from 'expo-secure-store';
import { DayStats } from './analytics';
import { slotsToDuration } from '../utils/time';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

export async function generateDailyInsight(
  stats: DayStats,
  date: string
): Promise<string> {
  const apiKey = await SecureStore.getItemAsync('groq_api_key');
  if (!apiKey) {
    throw new Error('API key not set');
  }

  const categoryBreakdown = stats.categoryStats
    .map((c) => `- ${c.categoryName}: ${c.duration} (${c.percentage}%)`)
    .join('\n');

  const eisenhowerBreakdown = stats.eisenhowerStats
    .filter((e) => e.totalSlots > 0)
    .map((e) => `- ${e.label}: ${e.duration} (${e.percentage}%)`)
    .join('\n');

  const untrackedSlots = 48 - stats.totalTrackedSlots;

  const prompt = `You are a friendly, concise productivity coach analyzing someone's time tracking data for ${date}.

Here's their day:
Total tracked: ${stats.totalDuration} out of 24h (${stats.trackingPercentage}% coverage)
Untracked: ${slotsToDuration(untrackedSlots)}

Time by category:
${categoryBreakdown || 'No entries yet'}

Eisenhower matrix breakdown:
${eisenhowerBreakdown || 'No categorized entries'}

Give a brief, personalized analysis in 3-4 short sentences. Be encouraging but honest. Include:
1. One specific positive observation about their day
2. One concrete suggestion for optimization (mention specific categories/times)
3. A motivating closing thought

Keep it warm and conversational, not robotic. Use no bullet points, just flowing sentences. Max 80 words.`;

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: 'You are a supportive productivity coach who gives brief, actionable feedback.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 200,
    }),
  });

  if (!response.ok) {
    throw new Error(`Groq API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || 'Could not generate insight.';
}
