import { ParsedEntry } from '../types';
import { buildParsePrompt } from '../constants/prompts';
import { getCurrentTime, formatDate } from '../utils/time';
import * as SecureStore from 'expo-secure-store';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

async function getGroqApiKey(): Promise<string | null> {
  return await SecureStore.getItemAsync('groq_api_key');
}

export async function setGroqApiKey(key: string): Promise<void> {
  await SecureStore.setItemAsync('groq_api_key', key);
}

export async function parseNaturalLanguage(
  input: string,
  categoryNames: string[]
): Promise<ParsedEntry[]> {
  const apiKey = await getGroqApiKey();
  if (!apiKey) {
    throw new Error('Groq API key not set. Go to Settings to add your API key.');
  }

  const currentTime = getCurrentTime();
  const currentDate = formatDate(new Date());
  const systemPrompt = buildParsePrompt(currentTime, currentDate, categoryNames);

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: input },
      ],
      temperature: 0.1,
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content?.trim();

  if (!content) {
    throw new Error('Empty response from AI');
  }

  // Extract JSON from response (handle potential markdown code blocks)
  let jsonStr = content;
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    jsonStr = jsonMatch[0];
  }

  const parsed: ParsedEntry[] = JSON.parse(jsonStr);

  return parsed.map((entry) => ({
    activity: entry.activity || 'Unknown activity',
    suggestedCategory: entry.suggestedCategory || 'Break',
    suggestedCategoryId: null, // resolved by caller
    startTime: entry.startTime || '00:00',
    endTime: entry.endTime || '00:30',
    confidence: entry.confidence || 'low',
  }));
}
