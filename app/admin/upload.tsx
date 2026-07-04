import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Dimensions,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import {
  Upload,
  Image as ImageIcon,
  Check,
  X,
  AlertCircle,
  CheckCircle,
  FileVideo,
  Film,
  Clock,
  Calendar,
  Tag,
  Star,
  TrendingUp,
  Play,
  Trash2,
  ArrowLeft,
} from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp, SlideInRight } from 'react-native-reanimated';
import { supabase, Category } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/Toast';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { LoadingScreen } from '@/components/Loading';
import { Colors, Spacing, FontSizes, FontWeights, BorderRadius } from '@/constants/theme';

const { width } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';

export default function UploadVideoScreen() {
  const router = useRouter();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const toast = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [videoFile, setVideoFile] = useState<any>(null);
  const [thumbnailFile, setThumbnailFile] = useState<any>(null);
  const [duration, setDuration] = useState('');
  const [releaseYear, setReleaseYear] = useState('');
  const [genre, setGenre] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [featured, setFeatured] = useState(false);
  const [trending, setTrending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !isAdmin) {
      router.replace('/admin/login');
      return;
    }
    fetchCategories();
  }, [authLoading, user, isAdmin, router]);

  const fetchCategories = async () => {
    try {
      const { data } = await supabase.from('categories').select('*').order('name');
      if (data) setCategories(data);
    } catch (error) {
      console.error('Error fetching categories:', error);
      toast.error('Failed to load categories', 'Please refresh the page');
    }
  };

  if (authLoading) return <LoadingScreen />;
  if (!user || !isAdmin) {
    return (
      <View style={styles.container}>
        <View style={styles.unauthorized}>
          <AlertCircle size={48} color={Colors.status.error} />
          <Text style={styles.unauthorizedTitle}>Access Denied</Text>
          <Text style={styles.unauthorizedText}>Admin privileges required.</Text>
        </View>
      </View>
    );
  }

  const pickVideo = async () => {
    try {
      setErrorMessage(null);
      const result = await DocumentPicker.getDocumentAsync({
        type: ['video/*'],
        copyToCacheDirectory: true,
      });
      if (result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        setVideoFile(file);
        setErrors(prev => ({ ...prev, video: '' }));
        toast.success('Video selected', file.name || 'Ready to upload');

        // Auto-generate thumbnail from video frame (web only)
        if (isWeb && file.uri) {
          try {
            const generatedThumb = await generateThumbnailFromVideo(file.uri);
            if (generatedThumb && !thumbnailFile) {
              setThumbnailFile({
                uri: generatedThumb,
                name: `thumb_${Date.now()}.jpg`,
                mimeType: 'image/jpeg',
              });
              toast.success('Thumbnail auto-generated', 'From first frame of video');
            }
          } catch (e) {
            console.error('Auto thumbnail generation failed:', e);
          }
        }

        // Get real duration from video metadata (web only)
        if (isWeb && file.uri) {
          try {
            const realDuration = await getVideoDuration(file.uri);
            if (realDuration > 0) {
              setDuration(Math.round(realDuration).toString());
            } else if (file.size) {
              const estimatedMinutes = Math.ceil(file.size / (5 * 1024 * 1024));
              setDuration((estimatedMinutes * 60).toString());
            }
          } catch (e) {
            if (file.size) {
              const estimatedMinutes = Math.ceil(file.size / (5 * 1024 * 1024));
              setDuration((estimatedMinutes * 60).toString());
            }
          }
        } else if (file.size) {
          const estimatedMinutes = Math.ceil(file.size / (5 * 1024 * 1024));
          setDuration((estimatedMinutes * 60).toString());
        }
      }
    } catch (error) {
      console.error('Error picking video:', error);
      toast.error('Failed to pick video', 'Please try again');
    }
  };

  // Generate thumbnail from video's first few seconds using HTML5 video element
  const generateThumbnailFromVideo = (videoUri: string): Promise<string | null> => {
    return new Promise((resolve) => {
      try {
        const video = document.createElement('video');
        video.crossOrigin = 'anonymous';
        video.muted = true;
        video.preload = 'metadata';
        video.src = videoUri;

        video.addEventListener('loadeddata', () => {
          // Seek to 2 seconds or 10% of duration, whichever is smaller
          const seekTime = Math.min(2, (video.duration || 10) * 0.1);
          video.currentTime = seekTime;
        });

        video.addEventListener('seeked', () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth || 640;
            canvas.height = video.videoHeight || 360;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              resolve(null);
              return;
            }
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            resolve(dataUrl);
          } catch (e) {
            resolve(null);
          }
        });

        video.addEventListener('error', () => resolve(null));
        // Timeout fallback
        setTimeout(() => resolve(null), 10000);
      } catch (e) {
        resolve(null);
      }
    });
  };

  // Get video duration from metadata
  const getVideoDuration = (videoUri: string): Promise<number> => {
    return new Promise((resolve) => {
      try {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.src = videoUri;
        video.addEventListener('loadedmetadata', () => {
          resolve(video.duration || 0);
        });
        video.addEventListener('error', () => resolve(0));
        setTimeout(() => resolve(0), 5000);
      } catch (e) {
        resolve(0);
      }
    });
  };

  const pickThumbnail = async () => {
    try {
      setErrorMessage(null);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: true,
        aspect: [16, 9],
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setThumbnailFile(result.assets[0]);
        toast.success('Thumbnail selected');
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

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!title.trim()) newErrors.title = 'Title is required';
    if (!videoFile) newErrors.video = 'Video file is required';
    if (!duration || parseInt(duration) === 0) newErrors.duration = 'Duration is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleUpload = async () => {
    setSuccessMessage(null);
    setErrorMessage(null);

    if (!validateForm()) return;

    setUploading(true);
    setUploadProgress(0);
    setUploadStage('Preparing upload...');

    try {
      let videoUrl = null;

      // Upload video file
      if (videoFile) {
        setUploadStage('Uploading video...');
        setUploadProgress(5);

        const fileExt = videoFile.name?.split('.').pop() || 'mp4';
        const fileName = `videos/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const response = await fetch(videoFile.uri);
        const blob = await response.blob();

        // Simulate progress (Supabase JS doesn't expose real progress)
        const progressInterval = setInterval(() => {
          setUploadProgress(prev => Math.min(prev + 2, 55));
        }, 500);

        const { error: uploadError } = await supabase.storage
          .from('videos')
          .upload(fileName, blob, {
            contentType: `video/${fileExt}`,
            upsert: false,
          });

        clearInterval(progressInterval);

        if (uploadError) throw new Error(`Video upload failed: ${uploadError.message}`);

        setUploadProgress(60);
        const { data: urlData } = supabase.storage.from('videos').getPublicUrl(fileName);
        videoUrl = urlData.publicUrl;
      }

      // Upload thumbnail
      let thumbnailUrl = null;
      if (thumbnailFile) {
        setUploadStage('Uploading thumbnail...');
        setUploadProgress(65);

        const thumbExt = thumbnailFile.uri.split('.').pop() || 'jpg';
        const thumbName = `thumbnails/${Date.now()}_${Math.random().toString(36).substring(7)}.${thumbExt}`;
        const thumbResponse = await fetch(thumbnailFile.uri);
        const thumbBlob = await thumbResponse.blob();

        const { error: thumbError } = await supabase.storage
          .from('thumbnails')
          .upload(thumbName, thumbBlob, { contentType: `image/${thumbExt}` });

        if (!thumbError) {
          const { data: urlData } = supabase.storage.from('thumbnails').getPublicUrl(thumbName);
          thumbnailUrl = urlData.publicUrl;
        }
      }

      setUploadProgress(75);
      setUploadStage('Creating video record...');

      // Insert video record (notifications are auto-created via trigger)
      const { data: insertedVideo, error: insertError } = await supabase
        .from('videos')
        .insert({
          title: title.trim(),
          description: description.trim() || null,
          video_url: videoUrl,
          thumbnail_url: thumbnailUrl,
          duration: parseInt(duration) || 0,
          release_year: parseInt(releaseYear) || null,
          genre: genre.trim() || null,
          featured,
          trending,
          status: 'published',
          views_count: 0,
          like_count: 0,
          uploader_id: user.id,
        })
        .select()
        .single();

      if (insertError) throw new Error(`Failed to save video: ${insertError.message}`);

      // Link categories
      if (selectedCategories.length > 0 && insertedVideo) {
        setUploadProgress(90);
        setUploadStage('Linking categories...');

        const categoryInserts = selectedCategories.map(catId => ({
          video_id: insertedVideo.id,
          category_id: catId,
        }));

        await supabase.from('video_categories').insert(categoryInserts);
      }

      setUploadProgress(100);
      setUploadStage('Complete!');
      setSuccessMessage(`"${title.trim()}" uploaded successfully! Users have been notified.`);
      toast.success('Upload complete!', 'Users have been notified');

      // Reset form after delay
      setTimeout(() => {
        setTitle('');
        setDescription('');
        setVideoFile(null);
        setThumbnailFile(null);
        setDuration('');
        setReleaseYear('');
        setGenre('');
        setSelectedCategories([]);
        setFeatured(false);
        setTrending(false);
        setUploadProgress(0);
        setUploadStage('');
        setUploading(false);
        setSuccessMessage(null);
      }, 4000);
    } catch (error: any) {
      console.error('Upload error:', error);
      setErrorMessage(error.message || 'Failed to upload video');
      toast.error('Upload failed', error.message || 'Please try again');
      setUploading(false);
      setUploadProgress(0);
      setUploadStage('');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + ' GB';
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
    if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return bytes + ' bytes';
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header with Back Button */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <ArrowLeft size={24} color={Colors.text.primary} />
          </TouchableOpacity>
          <Upload size={24} color={Colors.primary} />
          <Text style={styles.headerTitle}>Upload Video</Text>
        </View>

        {/* Success Message */}
        {successMessage && (
          <Animated.View entering={FadeInDown.duration(300)} style={styles.successBanner}>
            <View style={styles.successIcon}>
              <CheckCircle size={24} color={Colors.status.success} />
            </View>
            <View style={styles.successContent}>
              <Text style={styles.successTitle}>Upload Complete</Text>
              <Text style={styles.successText}>{successMessage}</Text>
            </View>
          </Animated.View>
        )}

        {/* Error Message */}
        {errorMessage && (
          <Animated.View entering={FadeInDown.duration(300)} style={styles.errorBanner}>
            <AlertCircle size={20} color={Colors.status.error} />
            <Text style={styles.errorText}>{errorMessage}</Text>
            <TouchableOpacity onPress={() => setErrorMessage(null)} style={styles.closeBanner}>
              <X size={18} color={Colors.text.secondary} />
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Upload Progress */}
        {uploading && (
          <Animated.View entering={FadeInDown.duration(300)} style={styles.progressCard}>
            <View style={styles.progressHeader}>
              {uploadProgress < 100 ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <CheckCircle size={20} color={Colors.status.success} />
              )}
              <Text style={styles.progressStage}>{uploadStage}</Text>
              <Text style={styles.progressPercent}>{uploadProgress}%</Text>
            </View>
            <View style={styles.progressBar}>
              <Animated.View style={[styles.progressFill, { width: `${uploadProgress}%` }]} />
            </View>
            <Text style={styles.progressHint}>
              {uploadProgress < 55 ? 'Uploading video... this may take a few minutes depending on file size' :
               uploadProgress < 75 ? 'Processing video...' :
               uploadProgress < 100 ? 'Finalizing...' : 'Upload complete!'}
            </Text>
          </Animated.View>
        )}

        {/* Video Information Section */}
        <Animated.View entering={FadeInUp.delay(100).duration(400)} style={styles.section}>
          <Text style={styles.sectionTitle}>Video Information</Text>
          <Input
            label="Title *"
            value={title}
            onChangeText={setTitle}
            placeholder="Enter video title"
            error={errors.title}
            leftIcon={<Film size={18} color={Colors.text.muted} />}
          />
          <Input
            label="Description"
            value={description}
            onChangeText={setDescription}
            placeholder="Enter video description"
            multiline
            numberOfLines={4}
          />
          <View style={styles.row}>
            <View style={styles.halfWidth}>
              <Input
                label="Duration (seconds) *"
                value={duration}
                onChangeText={setDuration}
                placeholder="e.g., 7200"
                keyboardType="numeric"
                error={errors.duration}
                leftIcon={<Clock size={18} color={Colors.text.muted} />}
              />
            </View>
            <View style={styles.halfWidth}>
              <Input
                label="Release Year"
                value={releaseYear}
                onChangeText={setReleaseYear}
                placeholder="e.g., 2024"
                keyboardType="numeric"
                leftIcon={<Calendar size={18} color={Colors.text.muted} />}
              />
            </View>
          </View>
          <Input
            label="Genre"
            value={genre}
            onChangeText={setGenre}
            placeholder="e.g., Action, Drama, Comedy"
            leftIcon={<Tag size={18} color={Colors.text.muted} />}
          />
        </Animated.View>

        {/* Video File Section */}
        <Animated.View entering={FadeInUp.delay(150).duration(400)} style={styles.section}>
          <Text style={styles.sectionTitle}>Video File *</Text>
          <TouchableOpacity
            style={[styles.uploadArea, dragActive && styles.uploadAreaActive, videoFile && styles.uploadAreaFilled]}
            onPress={pickVideo}
            disabled={uploading}
            activeOpacity={0.8}
          >
            {videoFile ? (
              <View style={styles.fileInfo}>
                <View style={styles.fileIcon}>
                  <FileVideo size={24} color={Colors.status.success} />
                </View>
                <View style={styles.fileDetails}>
                  <Text style={styles.fileName} numberOfLines={1}>{videoFile.name || 'Video selected'}</Text>
                  {videoFile.size && <Text style={styles.fileSize}>{formatFileSize(videoFile.size)}</Text>}
                </View>
                <TouchableOpacity onPress={() => setVideoFile(null)} disabled={uploading} style={styles.removeFileBtn}>
                  <Trash2 size={18} color={Colors.status.error} />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.uploadPlaceholder}>
                <Upload size={40} color={Colors.text.muted} />
                <Text style={styles.uploadText}>Click to select video</Text>
                <Text style={styles.uploadHint}>MP4, MOV, MKV up to 5GB</Text>
                {isWeb && <Text style={styles.uploadHint}>or drag and drop</Text>}
              </View>
            )}
          </TouchableOpacity>
          {errors.video && <Text style={styles.error}>{errors.video}</Text>}
        </Animated.View>

        {/* Thumbnail Section */}
        <Animated.View entering={FadeInUp.delay(200).duration(400)} style={styles.section}>
          <Text style={styles.sectionTitle}>Thumbnail Image</Text>
          <TouchableOpacity style={[styles.uploadArea, styles.thumbnailArea]} onPress={pickThumbnail} disabled={uploading} activeOpacity={0.8}>
            {thumbnailFile ? (
              <View style={styles.thumbnailPreview}>
                <Image
                  source={{ uri: thumbnailFile.uri }}
                  style={styles.thumbnailImage}
                />
                <TouchableOpacity onPress={() => setThumbnailFile(null)} disabled={uploading} style={styles.removeThumbnailBtn}>
                  <X size={16} color={Colors.text.primary} />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.uploadPlaceholder}>
                <ImageIcon size={36} color={Colors.text.muted} />
                <Text style={styles.uploadText}>Click to upload thumbnail</Text>
                <Text style={styles.uploadHint}>JPG, PNG, WebP (16:9 ratio preferred)</Text>
              </View>
            )}
          </TouchableOpacity>
        </Animated.View>

        {/* Categories Section */}
        <Animated.View entering={FadeInUp.delay(250).duration(400)} style={styles.section}>
          <Text style={styles.sectionTitle}>Categories</Text>
          <Text style={styles.sectionHint}>Select categories to organize this video</Text>
          <View style={styles.categoriesGrid}>
            {categories.map(cat => (
              <TouchableOpacity
                key={cat.id}
                style={[styles.categoryChip, selectedCategories.includes(cat.id) && styles.categoryChipActive]}
                onPress={() => toggleCategory(cat.id)}
                disabled={uploading}
                activeOpacity={0.7}
              >
                <Text style={[styles.categoryChipText, selectedCategories.includes(cat.id) && styles.categoryChipTextActive]}>
                  {cat.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>

        {/* Visibility Options */}
        <Animated.View entering={FadeInUp.delay(300).duration(400)} style={styles.section}>
          <Text style={styles.sectionTitle}>Visibility Options</Text>
          <TouchableOpacity style={styles.checkboxRow} onPress={() => setFeatured(!featured)} disabled={uploading} activeOpacity={0.7}>
            <View style={[styles.checkbox, featured && styles.checkboxActive]}>
              {featured && <Check size={16} color={Colors.text.primary} />}
            </View>
            <View style={styles.checkboxContent}>
              <Star size={18} color={featured ? Colors.primary : Colors.text.muted} />
              <View style={styles.checkboxTextContainer}>
                <Text style={styles.checkboxLabel}>Feature on homepage</Text>
                <Text style={styles.checkboxHint}>Display in the hero banner</Text>
              </View>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.checkboxRow} onPress={() => setTrending(!trending)} disabled={uploading} activeOpacity={0.7}>
            <View style={[styles.checkbox, trending && styles.checkboxActive]}>
              {trending && <Check size={16} color={Colors.text.primary} />}
            </View>
            <View style={styles.checkboxContent}>
              <TrendingUp size={18} color={trending ? Colors.primary : Colors.text.muted} />
              <View style={styles.checkboxTextContainer}>
                <Text style={styles.checkboxLabel}>Show in trending</Text>
                <Text style={styles.checkboxHint}>Highlight in trending section</Text>
              </View>
            </View>
          </TouchableOpacity>
        </Animated.View>

        {/* Submit Button */}
        <Animated.View entering={FadeInUp.delay(350).duration(400)}>
          <Button
            title={uploading ? 'Uploading...' : 'Upload Video'}
            onPress={handleUpload}
            loading={uploading}
            disabled={uploading}
            style={styles.submitButton}
            icon={<Upload size={18} color={Colors.text.primary} />}
          />
          <Text style={styles.submitHint}>
            Video will be published immediately and users will be notified
          </Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, paddingBottom: Spacing.xxl * 2 },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.lg },
  backButton: { padding: Spacing.xs },
  headerTitle: { fontSize: FontSizes.xxl, fontWeight: FontWeights.bold, color: Colors.text.primary },
  section: { marginBottom: Spacing.xl },
  sectionTitle: { fontSize: FontSizes.lg, fontWeight: FontWeights.semibold, color: Colors.text.primary, marginBottom: Spacing.sm },
  sectionHint: { fontSize: FontSizes.sm, color: Colors.text.muted, marginBottom: Spacing.md },
  row: { flexDirection: 'row', gap: Spacing.md },
  halfWidth: { flex: 1 },
  uploadArea: {
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.card,
  },
  uploadAreaActive: { borderColor: Colors.primary, backgroundColor: 'rgba(229, 9, 20, 0.05)' },
  uploadAreaFilled: { borderStyle: 'solid', borderColor: Colors.status.success },
  uploadPlaceholder: { alignItems: 'center' },
  uploadText: { fontSize: FontSizes.md, color: Colors.text.secondary, marginTop: Spacing.sm },
  uploadHint: { fontSize: FontSizes.sm, color: Colors.text.muted, marginTop: Spacing.xs },
  fileInfo: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, width: '100%' },
  fileIcon: { width: 48, height: 48, borderRadius: BorderRadius.md, backgroundColor: 'rgba(34, 197, 94, 0.1)', justifyContent: 'center', alignItems: 'center' },
  fileDetails: { flex: 1 },
  fileName: { fontSize: FontSizes.md, color: Colors.text.primary, fontWeight: FontWeights.medium },
  fileSize: { fontSize: FontSizes.sm, color: Colors.text.muted, marginTop: 2 },
  removeFileBtn: { padding: Spacing.sm },
  thumbnailArea: { height: 180 },
  thumbnailPreview: { width: '100%', height: '100%', position: 'relative' },
  thumbnailImage: { width: '100%', height: '100%', borderRadius: BorderRadius.lg },
  removeThumbnailBtn: { position: 'absolute', top: Spacing.sm, right: Spacing.sm, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0, 0, 0, 0.6)', justifyContent: 'center', alignItems: 'center' },
  categoriesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  categoryChip: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.tertiary,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  categoryChipActive: { backgroundColor: 'rgba(229, 9, 20, 0.15)', borderColor: Colors.primary },
  categoryChipText: { fontSize: FontSizes.md, color: Colors.text.secondary, fontWeight: FontWeights.medium },
  categoryChipTextActive: { color: Colors.primary },
  checkboxRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, marginBottom: Spacing.md },
  checkbox: { width: 24, height: 24, borderRadius: BorderRadius.sm, borderWidth: 2, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  checkboxActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  checkboxContent: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
  checkboxTextContainer: { flex: 1 },
  checkboxLabel: { fontSize: FontSizes.md, color: Colors.text.primary },
  checkboxHint: { fontSize: FontSizes.sm, color: Colors.text.muted, marginTop: 2 },
  submitButton: { marginTop: Spacing.lg },
  submitHint: { fontSize: FontSizes.sm, color: Colors.text.muted, textAlign: 'center', marginTop: Spacing.sm },
  error: { color: Colors.status.error, fontSize: FontSizes.sm, marginTop: Spacing.xs },
  unauthorized: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xxl },
  unauthorizedTitle: { fontSize: FontSizes.xl, fontWeight: FontWeights.bold, color: Colors.text.primary, marginTop: Spacing.md },
  unauthorizedText: { fontSize: FontSizes.md, color: Colors.text.secondary },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderLeftWidth: 4,
    borderLeftColor: Colors.status.success,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  successIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(34, 197, 94, 0.15)', justifyContent: 'center', alignItems: 'center' },
  successContent: { flex: 1 },
  successTitle: { color: Colors.status.success, fontSize: FontSizes.md, fontWeight: FontWeights.bold },
  successText: { color: Colors.text.secondary, fontSize: FontSizes.sm, marginTop: 2 },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderLeftWidth: 4,
    borderLeftColor: Colors.status.error,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  errorText: { flex: 1, color: Colors.status.error, fontSize: FontSizes.md },
  closeBanner: { padding: Spacing.xs },
  progressCard: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  progressHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  progressStage: { flex: 1, fontSize: FontSizes.md, color: Colors.text.primary, fontWeight: FontWeights.medium },
  progressPercent: { fontSize: FontSizes.md, color: Colors.primary, fontWeight: FontWeights.bold },
  progressBar: { height: 8, backgroundColor: Colors.tertiary, borderRadius: BorderRadius.full, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: BorderRadius.full },
  progressHint: { fontSize: FontSizes.sm, color: Colors.text.muted, marginTop: Spacing.sm, textAlign: 'center' },
});
