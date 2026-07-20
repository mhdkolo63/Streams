import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  Platform,
  Dimensions,
} from 'react-native';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import {
  ArrowLeft,
  Film,
  Tag,
  Globe,
  Eye,
  EyeOff,
  Lock,
  Check,
  CheckCircle,
  Image as ImageIcon,
  Upload,
  Trash2,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { supabase, Video, Category } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthGuard } from '@/hooks/useGlobalStore';
import { useToast } from '@/components/Toast';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { LoadingScreen } from '@/components/Loading';
import { Colors, Spacing, FontSizes, FontWeights, BorderRadius } from '@/constants/theme';
import { VALIDATION, sanitizeString, sanitizeFilename } from '@/lib/validation';

const isWeb = Platform.OS === 'web';

type Visibility = 'published' | 'unlisted' | 'private';

export default function StudioEditVideoScreen() {
  useAuthGuard(true);
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const toast = useToast();

  const [video, setVideo] = useState<Video | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [genre, setGenre] = useState('');
  const [language, setLanguage] = useState('');
  const [tags, setTags] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<Visibility>('published');
  const [thumbnailFile, setThumbnailFile] = useState<any>(null);
  const [currentThumbUrl, setCurrentThumbUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!id || !user) return;
    fetchVideo();
    fetchCategories();
  }, [id, user]);

  const fetchVideo = async () => {
    if (!id || !user) return;
    try {
      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .eq('id', id)
        .eq('uploader_id', user.id)
        .maybeSingle();

      if (error || !data) {
        toast.error('Not found', 'Video not found or you do not have access');
        router.back();
        return;
      }

      const v = data as Video;
      setVideo(v);
      setTitle(v.title);
      setDescription(v.description || '');
      setGenre(v.genre || '');
      setLanguage(v.language || '');
      setTags((v.tags || []).join(', '));
      setVisibility((v.status as Visibility) || 'published');
      setCurrentThumbUrl(v.thumbnail_url);

      // Fetch linked categories
      const { data: linkedCats } = await supabase
        .from('video_categories')
        .select('category_id')
        .eq('video_id', v.id);
      if (linkedCats) {
        setSelectedCategories(linkedCats.map((c: any) => c.category_id));
      }
    } catch (error) {
      console.error('Error fetching video:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const { data } = await supabase.from('categories').select('*').order('name');
      if (data) setCategories(data);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const pickThumbnail = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8, allowsEditing: true, aspect: [16, 9],
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        const fileCheck = VALIDATION.imageFile({ name: file.fileName || 'thumb.jpg', type: file.mimeType, size: file.fileSize });
        if (!fileCheck.valid) {
          toast.error('Invalid file', fileCheck.message || 'Please select a valid image');
          return;
        }
        setThumbnailFile(file);
      }
    } catch (error) {
      console.error('Error picking thumbnail:', error);
      toast.error('Failed to pick thumbnail', 'Please try again');
    }
  };

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories(prev =>
      prev.includes(categoryId) ? prev.filter(id => id !== categoryId) : [...prev, categoryId]
    );
  };

  const handleSave = async () => {
    if (!video || !user) return;

    const newErrors: Record<string, string> = {};
    if (!title.trim()) newErrors.title = 'Title is required';
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setSaving(true);
    try {
      let thumbnailUrl = currentThumbUrl;

      // Upload new thumbnail if selected
      if (thumbnailFile) {
        const thumbExt = thumbnailFile.uri?.startsWith('data:image/') ? 'jpg' : sanitizeFilename(thumbnailFile.uri?.split('.').pop() || 'jpg');
        const thumbName = `${user.id}/${Date.now()}_edit_${Math.random().toString(36).substring(7)}.${thumbExt}`;
        const thumbResponse = await fetch(thumbnailFile.uri);
        const thumbBlob = await thumbResponse.blob();

        const { error: thumbError } = await supabase.storage
          .from('thumbnails')
          .upload(thumbName, thumbBlob, { contentType: `image/${thumbExt}` });

        if (!thumbError) {
          const { data: urlData } = supabase.storage.from('thumbnails').getPublicUrl(thumbName);
          thumbnailUrl = urlData.publicUrl;

          // Delete old thumbnail
          if (currentThumbUrl) {
            const oldPath = currentThumbUrl.split('/thumbnails/')[1]?.split('?')[0];
            if (oldPath) {
              await supabase.storage.from('thumbnails').remove([oldPath]);
            }
          }
        }
      }

      const tagsArray = tags.split(',').map(t => sanitizeString(t, 50)).filter(Boolean);

      const { error: updateError } = await supabase
        .from('videos')
        .update({
          title: sanitizeString(title, 200),
          description: description.trim() ? sanitizeString(description, 5000) : null,
          genre: sanitizeString(genre, 50) || null,
          language: sanitizeString(language, 30) || null,
          tags: tagsArray.length > 0 ? tagsArray : null,
          thumbnail_url: thumbnailUrl,
          status: visibility,
        })
        .eq('id', video.id)
        .eq('uploader_id', user.id);

      if (updateError) throw updateError;

      // Update categories: remove old, insert new
      await supabase.from('video_categories').delete().eq('video_id', video.id);
      if (selectedCategories.length > 0) {
        const inserts = selectedCategories.map(catId => ({
          video_id: video.id,
          category_id: catId,
        }));
        await supabase.from('video_categories').insert(inserts);
      }

      toast.success('Changes saved', 'Video updated successfully');
      setTimeout(() => router.back(), 1000);
    } catch (error: any) {
      console.error('Error saving:', error);
      toast.error('Save failed', error.message || 'Please try again');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingScreen />;

  const visibilityOptions: { value: Visibility; label: string; icon: any; desc: string }[] = [
    { value: 'published', label: 'Public', icon: Eye, desc: 'Visible to everyone' },
    { value: 'unlisted', label: 'Unlisted', icon: EyeOff, desc: 'Only visible with the link' },
    { value: 'private', label: 'Private', icon: Lock, desc: 'Only visible to you' },
  ];

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 } as any}>
              <ArrowLeft size={24} color={Colors.text.primary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Edit Video</Text>
          </View>

          {/* Thumbnail */}
          <Animated.View entering={FadeInDown.duration(300)} style={styles.section}>
            <Text style={styles.sectionTitle}>Thumbnail</Text>
            <TouchableOpacity style={styles.thumbnailBox} onPress={pickThumbnail} activeOpacity={0.8}>
              {(thumbnailFile || currentThumbUrl) ? (
                <View style={styles.thumbnailWrapper}>
                  <Image source={{ uri: thumbnailFile?.uri || currentThumbUrl || '' }} style={styles.thumbnailImage} resizeMode="cover" />
                  <View style={styles.thumbnailOverlay}>
                    <Upload size={20} color={Colors.text.primary} />
                    <Text style={styles.thumbnailChangeText}>Change</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.thumbnailPlaceholder}>
                  <ImageIcon size={32} color={Colors.text.muted} />
                  <Text style={styles.thumbnailPlaceholderText}>Upload thumbnail</Text>
                </View>
              )}
            </TouchableOpacity>
          </Animated.View>

          {/* Info */}
          <Animated.View entering={FadeInDown.delay(50).duration(300)} style={styles.section}>
            <Text style={styles.sectionTitle}>Video Information</Text>
            <Input label="Title *" value={title} onChangeText={setTitle} placeholder="Enter video title" error={errors.title} leftIcon={<Film size={18} color={Colors.text.muted} />} />
            <Input label="Description" value={description} onChangeText={setDescription} placeholder="Enter description" multiline numberOfLines={4} />
            <View style={styles.row}>
              <View style={styles.halfWidth}>
                <Input label="Genre" value={genre} onChangeText={setGenre} placeholder="Action, Drama..." leftIcon={<Tag size={18} color={Colors.text.muted} />} />
              </View>
              <View style={styles.halfWidth}>
                <Input label="Language" value={language} onChangeText={setLanguage} placeholder="English..." leftIcon={<Globe size={18} color={Colors.text.muted} />} />
              </View>
            </View>
            <Input label="Tags" value={tags} onChangeText={setTags} placeholder="Comma-separated" leftIcon={<Tag size={18} color={Colors.text.muted} />} />
          </Animated.View>

          {/* Categories */}
          <Animated.View entering={FadeInDown.delay(100).duration(300)} style={styles.section}>
            <Text style={styles.sectionTitle}>Categories</Text>
            <View style={styles.categoriesGrid}>
              {categories.map(cat => (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.categoryChip, selectedCategories.includes(cat.id) && styles.categoryChipActive]}
                  onPress={() => toggleCategory(cat.id)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.categoryChipText, selectedCategories.includes(cat.id) && styles.categoryChipTextActive]}>{cat.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>

          {/* Visibility */}
          <Animated.View entering={FadeInDown.delay(150).duration(300)} style={styles.section}>
            <Text style={styles.sectionTitle}>Visibility</Text>
            <View style={styles.visibilityOptions}>
              {visibilityOptions.map(opt => {
                const Icon = opt.icon;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.visibilityOption, visibility === opt.value && styles.visibilityOptionActive]}
                    onPress={() => setVisibility(opt.value)}
                    activeOpacity={0.7}
                  >
                    <Icon size={18} color={visibility === opt.value ? Colors.primary : Colors.text.muted} />
                    <View style={styles.visibilityTextContainer}>
                      <Text style={[styles.visibilityLabel, visibility === opt.value && styles.visibilityLabelActive]}>{opt.label}</Text>
                      <Text style={styles.visibilityDesc}>{opt.desc}</Text>
                    </View>
                    <View style={[styles.radio, visibility === opt.value && styles.radioActive]}>
                      {visibility === opt.value && <Check size={12} color={Colors.text.primary} />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Animated.View>

          <Button
            title={saving ? 'Saving...' : 'Save Changes'}
            onPress={handleSave}
            loading={saving}
            disabled={saving}
            style={styles.saveButton}
            icon={<Check size={18} color={Colors.text.primary} />}
          />
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: Spacing.lg, paddingTop: 50, paddingBottom: Spacing.xxl * 2 },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.lg },
  backButton: { padding: Spacing.xs },
  headerTitle: { fontSize: FontSizes.xxl, fontWeight: FontWeights.bold, color: Colors.text.primary },
  section: { marginBottom: Spacing.xl },
  sectionTitle: { fontSize: FontSizes.lg, fontWeight: FontWeights.semibold, color: Colors.text.primary, marginBottom: Spacing.sm },
  row: { flexDirection: 'row', gap: Spacing.md },
  halfWidth: { flex: 1 },
  thumbnailBox: { height: 180, borderRadius: BorderRadius.lg, overflow: 'hidden', backgroundColor: Colors.card },
  thumbnailWrapper: { width: '100%', height: '100%', position: 'relative' },
  thumbnailImage: { width: '100%', height: '100%' },
  thumbnailOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 48, backgroundColor: 'rgba(0,0,0,0.6)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs },
  thumbnailChangeText: { fontSize: FontSizes.sm, color: Colors.text.primary, fontWeight: FontWeights.semibold },
  thumbnailPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  thumbnailPlaceholderText: { fontSize: FontSizes.sm, color: Colors.text.muted },
  categoriesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  categoryChip: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.full, backgroundColor: Colors.tertiary, borderWidth: 1, borderColor: 'transparent' },
  categoryChipActive: { backgroundColor: 'rgba(229, 9, 20, 0.15)', borderColor: Colors.primary },
  categoryChipText: { fontSize: FontSizes.md, color: Colors.text.secondary, fontWeight: FontWeights.medium },
  categoryChipTextActive: { color: Colors.primary },
  visibilityOptions: { gap: Spacing.sm },
  visibilityOption: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: BorderRadius.md, backgroundColor: Colors.card, borderWidth: 2, borderColor: 'transparent' },
  visibilityOptionActive: { borderColor: Colors.primary, backgroundColor: 'rgba(229, 9, 20, 0.05)' },
  visibilityTextContainer: { flex: 1 },
  visibilityLabel: { fontSize: FontSizes.md, color: Colors.text.primary, fontWeight: FontWeights.medium },
  visibilityLabelActive: { color: Colors.primary },
  visibilityDesc: { fontSize: FontSizes.sm, color: Colors.text.muted, marginTop: 2 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
  radioActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  saveButton: { marginTop: Spacing.lg },
});
