import { Audio } from 'expo-av';
import * as SecureStore from 'expo-secure-store';

const GROQ_WHISPER_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const WHISPER_MODEL = 'whisper-large-v3';

let recording: Audio.Recording | null = null;

export async function requestMicPermission(): Promise<boolean> {
  const { status } = await Audio.requestPermissionsAsync();
  return status === 'granted';
}

export async function startRecording(): Promise<void> {
  const hasPermission = await requestMicPermission();
  if (!hasPermission) {
    throw new Error('Microphone permission not granted. Please enable it in Settings.');
  }

  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
  });

  const { recording: newRecording } = await Audio.Recording.createAsync(
    Audio.RecordingOptionsPresets.HIGH_QUALITY
  );
  recording = newRecording;
}

export async function stopRecording(): Promise<string> {
  if (!recording) {
    throw new Error('No active recording');
  }

  await recording.stopAndUnloadAsync();
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
  });

  const uri = recording.getURI();
  recording = null;

  if (!uri) {
    throw new Error('Recording failed - no audio file created');
  }

  return uri;
}

export async function cancelRecording(): Promise<void> {
  if (recording) {
    try {
      await recording.stopAndUnloadAsync();
    } catch (e) {
      // Already stopped
    }
    recording = null;
  }
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
  });
}

export async function transcribeAudio(audioUri: string): Promise<string> {
  const apiKey = await SecureStore.getItemAsync('groq_api_key');
  if (!apiKey) {
    throw new Error('Groq API key not set. Go to Settings to add your API key.');
  }

  // Create form data with the audio file
  const formData = new FormData();
  formData.append('file', {
    uri: audioUri,
    type: 'audio/m4a',
    name: 'recording.m4a',
  } as any);
  formData.append('model', WHISPER_MODEL);
  formData.append('language', 'en');
  formData.append('response_format', 'json');

  const response = await fetch(GROQ_WHISPER_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Transcription failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.text || '';
}

export function isRecording(): boolean {
  return recording !== null;
}
