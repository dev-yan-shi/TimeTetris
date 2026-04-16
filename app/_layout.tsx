import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCategoryStore } from '../src/stores/useCategoryStore';
import { useEntryStore } from '../src/stores/useEntryStore';
import { useHabitStore } from '../src/stores/useHabitStore';
import { APP_COLORS } from '../src/constants/colors';

export default function RootLayout() {
  const loadCategories = useCategoryStore((s) => s.loadCategories);
  const loadEntries = useEntryStore((s) => s.loadEntries);
  const loadHabits = useHabitStore((s) => s.loadHabits);

  useEffect(() => {
    loadCategories()
      .then(() => loadEntries())
      .then(() => loadHabits());
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: APP_COLORS.background },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="entry-modal"
          options={{
            presentation: 'modal',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="category-edit"
          options={{
            presentation: 'modal',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="settings"
          options={{
            presentation: 'modal',
            headerShown: false,
          }}
        />
      </Stack>
    </>
  );
}
