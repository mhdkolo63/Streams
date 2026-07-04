import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Plus, Edit, Trash2, Check, X } from 'lucide-react-native';
import { supabase, Category } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { LoadingScreen } from '@/components/Loading';
import { Colors, Spacing, FontSizes, FontWeights, BorderRadius } from '@/constants/theme';

export default function CategoriesScreen() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const router = useRouter();

  const fetchCategories = useCallback(async () => {
    try {
      const { data } = await supabase.from('categories').select('*').order('name');
      if (data) setCategories(data);
    } catch (error) {
      console.error('Error fetching categories:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !isAdmin) {
      router.replace('/admin/login');
      return;
    }
    fetchCategories();
  }, [authLoading, user, isAdmin, router, fetchCategories]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchCategories();
    setRefreshing(false);
  }, [fetchCategories]);

  const handleAdd = async () => {
    if (!newName.trim() || !newSlug.trim()) {
      Alert.alert('Error', 'Name and slug are required');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('categories').insert({
        name: newName.trim(),
        slug: newSlug.trim().toLowerCase().replace(/\s+/g, '-'),
        description: newDescription.trim() || null,
      });
      if (error) throw error;
      setNewName('');
      setNewSlug('');
      setNewDescription('');
      setShowAddForm(false);
      fetchCategories();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to add category');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      await supabase.from('categories').update({ name: editName.trim(), description: editDescription.trim() || null }).eq('id', id);
      setEditingId(null);
      fetchCategories();
    } catch (error) {
      console.error('Error updating category:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (category: Category) => {
    Alert.alert('Delete Category', `Are you sure you want to delete "${category.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await supabase.from('categories').delete().eq('id', category.id);
            setCategories((prev) => prev.filter((c) => c.id !== category.id));
          } catch (error) {
            console.error('Error deleting category:', error);
            Alert.alert('Error', 'Failed to delete category');
          }
        },
      },
    ]);
  };

  const startEditing = (category: Category) => {
    setEditingId(category.id);
    setEditName(category.name);
    setEditDescription(category.description || '');
  };

  if (authLoading || loading) return <LoadingScreen />;
  if (!user || !isAdmin) {
    return (
      <View style={styles.container}>
        <View style={styles.unauthorized}>
          <Text style={styles.unauthorizedText}>Access Denied</Text>
        </View>
      </View>
    );
  }

  const renderItem = ({ item }: { item: Category }) => {
    if (editingId === item.id) {
      return (
        <View style={styles.editCard}>
          <Input value={editName} onChangeText={setEditName} placeholder="Category name" />
          <Input value={editDescription} onChangeText={setEditDescription} placeholder="Description" multiline numberOfLines={2} />
          <View style={styles.editActions}>
            <TouchableOpacity style={styles.editCancelBtn} onPress={() => setEditingId(null)}>
              <X size={20} color={Colors.text.muted} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.editSaveBtn} onPress={() => handleUpdate(item.id)} disabled={saving}>
              <Check size={20} color={Colors.text.primary} />
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.categoryCard}>
        <View style={styles.categoryInfo}>
          <Text style={styles.categoryName}>{item.name}</Text>
          <Text style={styles.categorySlug}>/{item.slug}</Text>
          {item.description && <Text style={styles.categoryDescription}>{item.description}</Text>}
        </View>
        <View style={styles.actions}>
          <TouchableOpacity onPress={() => startEditing(item)} style={styles.actionBtn}>
            <Edit size={18} color={Colors.text.muted} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDelete(item)} style={styles.actionBtn}>
            <Trash2 size={18} color={Colors.status.error} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={categories}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          showAddForm ? (
            <View style={styles.addForm}>
              <Input
                label="Name"
                value={newName}
                onChangeText={(text) => {
                  setNewName(text);
                  setNewSlug(text.toLowerCase().replace(/\s+/g, '-'));
                }}
                placeholder="Category name"
              />
              <Input label="Slug" value={newSlug} onChangeText={setNewSlug} placeholder="URL slug" autoCapitalize="none" />
              <Input label="Description" value={newDescription} onChangeText={setNewDescription} placeholder="Description" multiline numberOfLines={2} />
              <View style={styles.formActions}>
                <Button title="Cancel" variant="outline" onPress={() => setShowAddForm(false)} style={styles.cancelBtn} />
                <Button title={saving ? 'Saving...' : 'Add Category'} onPress={handleAdd} loading={saving} disabled={saving} />
              </View>
            </View>
          ) : (
            <TouchableOpacity style={styles.addButton} onPress={() => setShowAddForm(true)}>
              <Plus size={20} color={Colors.text.primary} />
              <Text style={styles.addButtonText}>Add Category</Text>
            </TouchableOpacity>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  listContent: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.xxl },
  addButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.card, borderRadius: BorderRadius.md, padding: Spacing.lg, marginBottom: Spacing.lg, gap: Spacing.sm },
  addButtonText: { color: Colors.text.primary, fontSize: FontSizes.md, fontWeight: FontWeights.semibold },
  addForm: { backgroundColor: Colors.card, borderRadius: BorderRadius.md, padding: Spacing.lg, marginBottom: Spacing.lg },
  formActions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.lg },
  cancelBtn: { flex: 1 },
  categoryCard: { flexDirection: 'row', backgroundColor: Colors.card, borderRadius: BorderRadius.md, padding: Spacing.lg, marginBottom: Spacing.md, alignItems: 'center' },
  categoryInfo: { flex: 1 },
  categoryName: { fontSize: FontSizes.lg, fontWeight: FontWeights.semibold, color: Colors.text.primary, marginBottom: Spacing.xs },
  categorySlug: { fontSize: FontSizes.sm, color: Colors.primary, marginBottom: Spacing.xs },
  categoryDescription: { fontSize: FontSizes.sm, color: Colors.text.secondary, marginTop: Spacing.xs },
  actions: { flexDirection: 'row', gap: Spacing.sm },
  actionBtn: { padding: Spacing.sm },
  editCard: { backgroundColor: Colors.card, borderRadius: BorderRadius.md, padding: Spacing.lg, marginBottom: Spacing.md },
  editActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm, marginTop: Spacing.md },
  editCancelBtn: { padding: Spacing.sm, borderRadius: BorderRadius.sm, backgroundColor: Colors.tertiary },
  editSaveBtn: { padding: Spacing.sm, borderRadius: BorderRadius.sm, backgroundColor: Colors.primary },
  unauthorized: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  unauthorizedText: { fontSize: FontSizes.xl, fontWeight: FontWeights.bold, color: Colors.text.primary },
});
