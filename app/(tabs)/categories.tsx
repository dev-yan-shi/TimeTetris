import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useCategoryStore } from '../../src/stores/useCategoryStore';
import { APP_COLORS } from '../../src/constants/colors';

const EISENHOWER_LABELS: Record<string, string> = {
  'urgent-important': 'Q1: Urgent & Important',
  'not-urgent-important': 'Q2: Not Urgent & Important',
  'urgent-not-important': 'Q3: Urgent & Not Important',
  'not-urgent-not-important': 'Q4: Not Urgent & Not Important',
};

export default function CategoriesScreen() {
  const router = useRouter();
  const { categories, removeCategory } = useCategoryStore();

  const handleDelete = (id: string, name: string) => {
    Alert.alert('Delete Category', `Delete "${name}"? Entries using this category will remain but show as unknown.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => removeCategory(id),
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Categories</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push('/category-edit')}
        >
          <Text style={styles.addBtnText}>+ New</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={categories}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 100 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.categoryRow}
            onPress={() =>
              router.push({
                pathname: '/category-edit',
                params: { id: item.id },
              })
            }
            onLongPress={() => !item.isDefault && handleDelete(item.id, item.name)}
          >
            <View style={[styles.colorDot, { backgroundColor: item.color }]} />
            <View style={{ flex: 1 }}>
              <View style={styles.nameRow}>
                <Text style={styles.categoryIcon}>{item.icon}</Text>
                <Text style={styles.categoryName}>{item.name}</Text>
                {item.isDefault && (
                  <View style={styles.defaultBadge}>
                    <Text style={styles.defaultBadgeText}>Default</Text>
                  </View>
                )}
              </View>
              {item.eisenhower && (
                <Text style={styles.eisenhowerLabel}>
                  {EISENHOWER_LABELS[item.eisenhower]}
                </Text>
              )}
            </View>
            <Text style={styles.chevron}>{'>'}</Text>
          </TouchableOpacity>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
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
  title: {
    color: APP_COLORS.text,
    fontSize: 24,
    fontWeight: '700',
  },
  addBtn: {
    backgroundColor: APP_COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addBtnText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 14,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  colorDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  categoryIcon: {
    fontSize: 16,
  },
  categoryName: {
    color: APP_COLORS.text,
    fontSize: 16,
    fontWeight: '600',
  },
  defaultBadge: {
    backgroundColor: APP_COLORS.surfaceLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 4,
  },
  defaultBadgeText: {
    color: APP_COLORS.textMuted,
    fontSize: 10,
    fontWeight: '600',
  },
  eisenhowerLabel: {
    color: APP_COLORS.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  chevron: {
    color: APP_COLORS.textMuted,
    fontSize: 16,
  },
  separator: {
    height: 1,
    backgroundColor: APP_COLORS.border,
    marginLeft: 52,
  },
});
