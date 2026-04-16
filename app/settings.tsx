import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { APP_COLORS } from '../src/constants/colors';

export default function SettingsScreen() {
  const router = useRouter();
  const [apiKey, setApiKey] = useState('');
  const [isLoaded, setIsLoaded] = useState(false);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync('groq_api_key').then((key) => {
      if (key) setApiKey(key);
      setIsLoaded(true);
    });
  }, []);

  const handleSave = async () => {
    if (!apiKey.trim()) {
      await SecureStore.deleteItemAsync('groq_api_key');
      Alert.alert('Cleared', 'API key removed');
    } else {
      await SecureStore.setItemAsync('groq_api_key', apiKey.trim());
      Alert.alert('Saved', 'Groq API key saved securely. You can now use AI parsing and voice entry!');
    }
    router.back();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.cancelBtn}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <TouchableOpacity onPress={handleSave}>
          <Text style={styles.saveBtn}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* API Key Section */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Groq API Key</Text>
          <Text style={styles.cardText}>
            Required for AI-powered text parsing and voice transcription. Completely free!
          </Text>

          {/* Step-by-step guide */}
          <View style={styles.stepsContainer}>
            <Text style={styles.stepTitle}>How to get your free key:</Text>

            <View style={styles.step}>
              <Text style={styles.stepNumber}>1</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.stepText}>
                  Go to console.groq.com and create a free account
                </Text>
                <TouchableOpacity
                  style={styles.linkBtn}
                  onPress={() => Linking.openURL('https://console.groq.com')}
                >
                  <Text style={styles.linkBtnText}>Open Groq Console</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.step}>
              <Text style={styles.stepNumber}>2</Text>
              <Text style={[styles.stepText, { flex: 1 }]}>
                Go to API Keys section and click "Create API Key"
              </Text>
            </View>

            <View style={styles.step}>
              <Text style={styles.stepNumber}>3</Text>
              <Text style={[styles.stepText, { flex: 1 }]}>
                Copy the key (starts with gsk_) and paste it below
              </Text>
            </View>
          </View>

          {/* Key input */}
          {isLoaded && (
            <View style={styles.keyInputRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={apiKey}
                onChangeText={setApiKey}
                placeholder="gsk_..."
                placeholderTextColor={APP_COLORS.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry={!showKey}
              />
              <TouchableOpacity
                style={styles.showKeyBtn}
                onPress={() => setShowKey(!showKey)}
              >
                <Text style={styles.showKeyBtnText}>{showKey ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>
          )}

          {apiKey.trim().length > 0 && (
            <View style={styles.keyStatus}>
              <Text style={styles.keyStatusIcon}>✅</Text>
              <Text style={styles.keyStatusText}>API key set</Text>
            </View>
          )}
        </View>

        {/* Features Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>What AI Powers</Text>

          <View style={styles.featureRow}>
            <Text style={styles.featureIcon}>🎙️</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.featureTitle}>Voice Entry</Text>
              <Text style={styles.featureText}>
                Record yourself saying what you did. Uses Groq Whisper for transcription.
              </Text>
            </View>
          </View>

          <View style={styles.featureRow}>
            <Text style={styles.featureIcon}>✏️</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.featureTitle}>Smart Text Parsing</Text>
              <Text style={styles.featureText}>
                Type "worked out from 7-8 then breakfast for 30 min" and AI breaks it into blocks.
              </Text>
            </View>
          </View>

          <View style={styles.featureRow}>
            <Text style={styles.featureIcon}>👆</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.featureTitle}>Quick Tap (No AI needed)</Text>
              <Text style={styles.featureText}>
                Tap any time slot on the grid and pick a category. Works offline, no API key required.
              </Text>
            </View>
          </View>
        </View>

        {/* Free tier info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Free Tier Limits</Text>
          <Text style={styles.cardText}>
            Groq's free tier includes:{'\n'}
            - 30 requests per minute{'\n'}
            - 14,400 requests per day{'\n'}
            - Whisper transcription + LLM parsing{'\n'}
            {'\n'}
            For personal time tracking, this is more than enough (you'll use ~30-50 requests/day max).
          </Text>
        </View>
      </ScrollView>
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
    color: APP_COLORS.textSecondary,
    fontSize: 16,
  },
  headerTitle: {
    color: APP_COLORS.text,
    fontSize: 17,
    fontWeight: '700',
  },
  saveBtn: {
    color: APP_COLORS.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  card: {
    backgroundColor: APP_COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    color: APP_COLORS.text,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
  },
  cardText: {
    color: APP_COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  stepsContainer: {
    marginTop: 14,
    marginBottom: 14,
  },
  stepTitle: {
    color: APP_COLORS.text,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  stepNumber: {
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
  stepText: {
    color: APP_COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  linkBtn: {
    backgroundColor: APP_COLORS.primary + '20',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  linkBtnText: {
    color: APP_COLORS.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  keyInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  input: {
    backgroundColor: APP_COLORS.surfaceLight,
    borderRadius: 10,
    padding: 14,
    color: APP_COLORS.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
  },
  showKeyBtn: {
    padding: 10,
  },
  showKeyBtnText: {
    fontSize: 20,
  },
  keyStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  keyStatusIcon: {
    fontSize: 14,
  },
  keyStatusText: {
    color: APP_COLORS.success,
    fontSize: 13,
    fontWeight: '600',
  },
  featureRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
    alignItems: 'flex-start',
  },
  featureIcon: {
    fontSize: 24,
    marginTop: 2,
  },
  featureTitle: {
    color: APP_COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },
  featureText: {
    color: APP_COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2,
  },
});
