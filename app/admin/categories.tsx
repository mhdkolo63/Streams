import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, RefreshControl,
  Modal, ScrollView, Image, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import {
  Plus, X, Edit, Trash2, Tag, Film, ChevronUp, ChevronDown, AlertCircle, Check, Search,
} from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { supabase, Category } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/Toast';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { LoadingScreen } from '@/components/Loading';
import { Colors, Spacing, FontSizes, FontWeights, BorderRadius } from '@/constants/theme';

export default function ManageCategoriesScreen() {
  const router = useRouter();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const toast = useToast();

  const [categories, setCategories] = useState<Category[]>([]);
  const [videoCounts, setVideoCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ category: Category; videoCount: number } | null>(null);
  const [processing, setProcessing] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formImage, setFormImage] = useState<any>(null);
  const [formIconName, setFormIconName] = useState('Film');
  const [saving, setSaving] = useState(false);

  const fetchCategories = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('categories').select('*').order('sort_order', { ascending: true });
      if (error) throw error;
      if (data) {
        const cats = data as Category[];
        setCategories(cats);
        // Fetch video counts for each category
        const counts: Record<string, number> = {};
        await Promise.all(cats.map(async (cat) => {
          const { count } = await supabase.from('video_categories').select('id', { count: 'exact', head: true }).eq('category_id', cat.id);
          counts[cat.id] = count || 0;
        }));
        setVideoCounts(counts);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
      toast.error('Failed to load categories', 'Please refresh the page');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !isAdmin) { router.replace('/admin/login'); return; }
    fetchCategories();
  }, [authLoading, user, isAdmin, router, fetchCategories]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchCategories();
    setRefreshing(false);
  }, [fetchCategories]);

  const logAdminAction = async (action: string, description: string) => {
    if (!user) return;
    try { await supabase.from('admin_activity_logs').insert({ admin_id: user.id, action, description }); } catch {}
  };

  const filteredCategories = categories.filter(c =>
    !searchQuery.trim() || c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const resetForm = () => {
    setFormName(''); setFormDescription(''); setFormImage(null); setFormIconName('Film'); setEditingCategory(null);
  };

  const openAddForm = () => { resetForm(); setShowAddForm(true); };
  const openEditForm = (cat: Category) => {
    setEditingCategory(cat);
    setFormName(cat.name); setFormDescription(cat.description || ''); setFormIconName(cat.icon_name || 'Film');
    setFormImage(null); setShowAddForm(true);
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8, allowsEditing: true, aspect: [16, 9] });
      if (!result.canceled && result.assets?.length > 0) setFormImage(result.assets[0]);
    } catch { toast.error('Failed to pick image', 'Please try again'); }
  };

  const saveCategory = async () => {
    if (!formName.trim()) { toast.error('Validation failed', 'Category name is required'); return; }
    setSaving(true);
    try {
      const slug = formName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      let imageUrl = editingCategory?.image_url || null;

      if (formImage) {
        const ext = formImage.uri.startsWith('data:') ? 'jpg' : (formImage.uri.split('.').pop() || 'jpg');
        const name = `category-images/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
        const blob = await (await fetch(formImage.uri)).blob();
        const { error: upErr } = await supabase.storage.from('thumbnails').upload(name, blob, { contentType: `image/${ext}` });
        if (!upErr) imageUrl = supabase.storage.from('thumbnails').getPublicUrl(name).data.publicUrl;
      }

      if (editingCategory) {
        const { error } = await supabase.from('categories').update({
          name: formName.trim(), description: formDescription.trim() || null,
          image_url: imageUrl, icon_name: formIconName, updated_at: new Date().toISOString(),
        }).eq('id', editingCategory.id);
        if (error) throw error;
        setCategories(prev => prev.map(c => c.id === editingCategory.id ? { ...c, name: formName.trim(), description: formDescription.trim() || null, image_url: imageUrl, icon_name: formIconName } : c));
        toast.success('Category updated', 'Changes saved successfully');
        await logAdminAction('edit_category', `Edited category: ${formName}`);
      } else {
        const maxSort = Math.max(0, ...categories.map(c => c.sort_order || 0));
        const { data, error } = await supabase.from('categories').insert({
          name: formName.trim(), slug, description: formDescription.trim() || null,
          image_url: imageUrl, icon_name: formIconName, sort_order: maxSort + 1,
        }).select().single();
        if (error) throw error;
        if (data) setCategories(prev => [...prev, data as Category]);
        toast.success('Category created', `${formName} has been added`);
        await logAdminAction('create_category', `Created category: ${formName}`);
      }
      setShowAddForm(false); resetForm();
    } catch (error) {
      console.error('Error saving category:', error);
      toast.error('Save failed', 'Please try again');
    } finally {
      setSaving(false);
    }
  };

  const deleteCategory = async () => {
    if (!deleteModal) return;
    setProcessing(true);
    try {
      const { category } = deleteModal;
      await supabase.from('video_categories').delete().eq('category_id', category.id);
      if (category.image_url) {
        const parts = category.image_url.split('/thumbnails/');
        if (parts.length > 1) await supabase.storage.from('thumbnails').remove([parts[1].split('?')[0]]);
      }
      const { error } = await supabase.from('categories').delete().eq('id', category.id);
      if (error) throw error;
      setCategories(prev => prev.filter(c => c.id !== category.id));
      toast.success('Category deleted', `${category.name} has been removed`);
      await logAdminAction('delete_category', `Deleted category: ${category.name}`);
      setDeleteModal(null);
    } catch (error) {
      console.error('Error deleting category:', error);
      toast.error('Delete failed', 'Please try again');
    } finally {
      setProcessing(false);
    }
  };

  const moveCategory = async (category: Category, direction: 'up' | 'down') => {
    const currentIndex = categories.findIndex(c => c.id === category.id);
    const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (swapIndex < 0 || swapIndex >= categories.length) return;
    const swapCategory = categories[swapIndex];
    const newOrder = [...categories];
    [newOrder[currentIndex], newOrder[swapIndex]] = [newOrder[swapIndex], newOrder[currentIndex]];
    setCategories(newOrder);
    try {
      await Promise.all([
        supabase.from('categories').update({ sort_order: swapIndex }).eq('id', category.id),
        supabase.from('categories').update({ sort_order: currentIndex }).eq('id', swapCategory.id),
      ]);
    } catch (error) {
      console.error('Error reordering:', error);
      fetchCategories();
    }
  };

  if (authLoading || loading) return <LoadingScreen />;
  if (!user || !isAdmin) {
    return <View style={styles.container}><View style={styles.unauthorized}><Text style={styles.unauthorizedText}>Access Denied</Text></View></View>;
  }

  const renderCategory = ({ item, index }: { item: Category; index: number }) => (
    <Animated.View entering={FadeInDown.delay(index * 30).duration(200)} style={styles.categoryCard}>
      <View style={styles.categoryImageContainer}>
        {item.image_url ? <Image source={{ uri: item.image_url }} style={styles.categoryImage} /> : <View style={styles.categoryImagePlaceholder}><Tag size={24} color={Colors.text.muted} /></View>}
      </View>
      <View style={styles.categoryInfo}>
        <Text style={styles.categoryName}>{item.name}</Text>
        {item.description ? <Text style={styles.categoryDescription} numberOfLines={2}>{item.description}</Text> : null}
        <View style={styles.categoryMeta}>
          <View style={styles.videoCountBadge}><Film size={12} color={Colors.primary} /><Text style={styles.videoCountText}>{videoCounts[item.id] || 0} videos</Text></View>
          <Text style={styles.slugText}>/{item.slug}</Text>
        </View>
      </View>
      <View style={styles.categoryActions}>
        <View style={styles.reorderButtons}>
          <TouchableOpacity style={styles.reorderBtn} onPress={() => moveCategory(item, 'up')} disabled={index === 0}><ChevronUp size={16} color={index === 0 ? Colors.text.muted : Colors.text.secondary} /></TouchableOpacity>
          <TouchableOpacity style={styles.reorderBtn} onPress={() => moveCategory(item, 'down')} disabled={index === categories.length - 1}><ChevronDown size={16} color={index === categories.length - 1 ? Colors.text.muted : Colors.text.secondary} /></TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.actionBtn} onPress={() => openEditForm(item)}><Edit size={18} color={Colors.text.muted} /></TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.actionBtnDanger]} onPress={() => setDeleteModal({ category: item, videoCount: videoCounts[item.id] || 0 })}><Trash2 size={18} color={Colors.status.error} /></TouchableOpacity>
      </View>
    </Animated.View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.searchContainer}>
          <Search size={20} color={Colors.text.muted} />
          <TextInput style={styles.searchInput} placeholder="Search categories..." placeholderTextColor={Colors.text.muted} value={searchQuery} onChangeText={setSearchQuery} />
          {searchQuery ? <TouchableOpacity onPress={() => setSearchQuery('')}><X size={18} color={Colors.text.muted} /></TouchableOpacity> : null}
        </View>
        <Button title="" onPress={openAddForm} icon={<Plus size={20} color={Colors.text.primary} />} style={styles.addButton} />
      </View>

      <FlatList
        data={filteredCategories}
        keyExtractor={item => item.id}
        renderItem={renderCategory}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<View style={styles.emptyState}><Tag size={48} color={Colors.text.muted} /><Text style={styles.emptyTitle}>No categories found</Text><Text style={styles.emptySubtitle}>{searchQuery ? 'Try adjusting your search' : 'Create your first category to organize videos'}</Text></View>}
      />

      {/* Add/Edit Modal */}
      <Modal visible={showAddForm} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingCategory ? 'Edit Category' : 'Add Category'}</Text>
              <TouchableOpacity onPress={() => { setShowAddForm(false); resetForm(); }}><X size={24} color={Colors.text.primary} /></TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.formLabel}>Category Image</Text>
              <TouchableOpacity style={styles.imagePicker} onPress={pickImage} activeOpacity={0.8}>
                {formImage ? <Image source={{ uri: formImage.uri }} style={styles.previewImage} /> : editingCategory?.image_url ? <Image source={{ uri: editingCategory.image_url }} style={styles.previewImage} /> : <View style={styles.imagePlaceholder}><Plus size={24} color={Colors.text.muted} /><Text style={styles.imagePlaceholderText}>Add category image</Text></View>}
              </TouchableOpacity>
              <Input label="Name *" value={formName} onChangeText={setFormName} placeholder="Category name" />
              <Input label="Description" value={formDescription} onChangeText={setFormDescription} placeholder="Category description" multiline numberOfLines={3} />
              <Text style={styles.formLabel}>Icon Name</Text>
              <Input value={formIconName} onChangeText={setFormIconName} placeholder="Lucide icon name (e.g. Film, Music, News)" />
              <Text style={styles.formHint}>The slug will be auto-generated from the name</Text>
            </ScrollView>
            <View style={styles.modalFooter}>
              <Button title="Cancel" onPress={() => { setShowAddForm(false); resetForm(); }} variant="outline" style={styles.modalBtn} />
              <Button title={saving ? 'Saving...' : 'Save'} onPress={saveCategory} loading={saving} disabled={saving} style={styles.modalBtn} />
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation */}
      <Modal visible={!!deleteModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.deleteModalContent}>
            <View style={styles.deleteIconContainer}><AlertCircle size={48} color={Colors.status.error} /></View>
            <Text style={styles.deleteTitle}>Delete Category</Text>
            <Text style={styles.deleteMessage}>Are you sure you want to delete "{deleteModal?.category.name}"?</Text>
            {deleteModal && deleteModal.videoCount > 0 && (
              <View style={styles.warningBox}>
                <AlertCircle size={16} color={Colors.status.warning} />
                <Text style={styles.warningText}>This category contains {deleteModal.videoCount} video{deleteModal.videoCount !== 1 ? 's' : ''}. The videos will remain but will no longer be associated with this category.</Text>
              </View>
            )}
            <View style={styles.deleteModalFooter}>
              <Button title="Cancel" onPress={() => setDeleteModal(null)} variant="outline" style={styles.modalBtn} disabled={processing} />
              <Button title={processing ? 'Deleting...' : 'Delete'} onPress={deleteCategory} loading={processing} disabled={processing} style={{ ...styles.modalBtn, ...styles.deleteBtn }} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.sm, gap: Spacing.md },
  searchContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.input, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, height: 44 },
  searchInput: { flex: 1, color: Colors.text.primary, fontSize: FontSizes.md, marginLeft: Spacing.sm },
  addButton: { width: 44, height: 44, padding: 0 },
  listContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  categoryCard: { flexDirection: 'row', backgroundColor: Colors.card, borderRadius: BorderRadius.md, marginBottom: Spacing.md, padding: Spacing.md, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  categoryImageContainer: { marginRight: Spacing.md },
  categoryImage: { width: 64, height: 48, borderRadius: BorderRadius.sm, backgroundColor: Colors.tertiary },
  categoryImagePlaceholder: { width: 64, height: 48, borderRadius: BorderRadius.sm, backgroundColor: Colors.tertiary, justifyContent: 'center', alignItems: 'center' },
  categoryInfo: { flex: 1 },
  categoryName: { fontSize: FontSizes.md, fontWeight: FontWeights.semibold, color: Colors.text.primary },
  categoryDescription: { fontSize: FontSizes.sm, color: Colors.text.secondary, marginTop: 2 },
  categoryMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: 4 },
  videoCountBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(229, 9, 20, 0.1)', paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.sm },
  videoCountText: { fontSize: FontSizes.xs, color: Colors.primary, fontWeight: FontWeights.medium },
  slugText: { fontSize: FontSizes.xs, color: Colors.text.muted },
  categoryActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  reorderButtons: { flexDirection: 'column', gap: 2 },
  reorderBtn: { padding: 2 },
  actionBtn: { padding: Spacing.xs, borderRadius: BorderRadius.sm },
  actionBtnDanger: { backgroundColor: 'rgba(239, 68, 68, 0.1)' },
  emptyState: { alignItems: 'center', paddingVertical: Spacing.xxl * 2, gap: Spacing.md },
  emptyTitle: { fontSize: FontSizes.lg, color: Colors.text.secondary, fontWeight: FontWeights.semibold },
  emptySubtitle: { fontSize: FontSizes.sm, color: Colors.text.muted, textAlign: 'center' },
  unauthorized: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  unauthorizedText: { fontSize: FontSizes.xl, fontWeight: FontWeights.bold, color: Colors.text.primary },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.7)', justifyContent: 'center', padding: Spacing.lg },
  modalContent: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle: { fontSize: FontSizes.xl, fontWeight: FontWeights.bold, color: Colors.text.primary },
  modalBody: { padding: Spacing.lg },
  modalFooter: { flexDirection: 'row', gap: Spacing.md, padding: Spacing.lg, borderTopWidth: 1, borderTopColor: Colors.border },
  modalBtn: { flex: 1 },
  formLabel: { fontSize: FontSizes.sm, color: Colors.text.muted, fontWeight: FontWeights.semibold, marginBottom: Spacing.xs, marginTop: Spacing.sm },
  formHint: { fontSize: FontSizes.xs, color: Colors.text.muted, marginTop: Spacing.sm },
  imagePicker: { height: 120, backgroundColor: Colors.tertiary, borderRadius: BorderRadius.md, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.md },
  previewImage: { width: '100%', height: '100%', borderRadius: BorderRadius.md },
  imagePlaceholder: { alignItems: 'center' },
  imagePlaceholderText: { fontSize: FontSizes.sm, color: Colors.text.muted, marginTop: Spacing.xs },
  deleteModalContent: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.xl, alignItems: 'center', maxWidth: 400, width: '100%' },
  deleteIconContainer: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(239, 68, 68, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.md },
  deleteTitle: { fontSize: FontSizes.xl, fontWeight: FontWeights.bold, color: Colors.text.primary, marginBottom: Spacing.sm },
  deleteMessage: { fontSize: FontSizes.md, color: Colors.text.secondary, textAlign: 'center', marginBottom: Spacing.sm },
  warningBox: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, backgroundColor: 'rgba(245, 158, 11, 0.1)', borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.lg, width: '100%' },
  warningText: { flex: 1, fontSize: FontSizes.sm, color: Colors.status.warning, lineHeight: 20 },
  deleteModalFooter: { flexDirection: 'row', gap: Spacing.md, width: '100%' },
  deleteBtn: { backgroundColor: Colors.status.error },
});
