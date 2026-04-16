import { useState, useEffect, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';

export function useApiKey() {
  const [hasKey, setHasKey] = useState<boolean | null>(null); // null = loading

  const checkKey = useCallback(async () => {
    const key = await SecureStore.getItemAsync('groq_api_key');
    setHasKey(!!key && key.trim().length > 0);
  }, []);

  useEffect(() => {
    checkKey();
  }, [checkKey]);

  return { hasKey, recheckKey: checkKey };
}
