import React, { useState, useRef, useEffect } from 'react';
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
import { useRouter, Stack } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import {
  ArrowLeft,
  Upload,
  Image as ImageIcon,
  Check,
  X,
  AlertCircle,
  CheckCircle,
  FileVideo,
  Film,
  Clock,
  Tag,
  Globe,
  Eye,
  EyeOff,
  Lock,
  Smartphone,
  Play,
  Trash2,
} from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthGuard } from '@/hooks/useGlobalStore';
import { useToast } from '@/components/Toast';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Colors, Spacing, FontSizes, FontWeights, BorderRadius } from '@/constants/theme';
import { VALIDATION, sanitizeString, sanitizeFilename } from '@/lib/validation';

const { width } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB for shorts
const MAX_DURATION_SECONDS = 60;

type Visibility = 'published' | 'unlisted' | 'private';

interface VideoMeta {
  duration: number;
  width: number;
  height: number;
  aspectRatio: string;
  resolution: string;
}

export default function StudioUploadShortScreen() {
  useAuthGuard(true);
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [videoFile, setVideoFile] = useState<any>(null);
  const [thumbnailFile, setThumbnailFile] = useState<any>(null);
  const [duration, setDuration] = useState('');
  const [language, setLanguage] = useState('');
  const [tags, setTags] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('published');
  const [videoMeta, setVideoMeta] = useState<VideoMeta | null>(null);
  const [isPortrait, setIsPortrait] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const uploadStartTime = useRef(0);
  const dragCounter = useRef(0);

  const formatFileSize = (bytes: number): string => {
    if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + ' GB';
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
    if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return bytes + ' B';
  };

  const formatUploadSpeed = (bytesPerSec: number): string => {
    if (bytesPerSec >= 1048576) return `${(bytesPerSec / 1048576).toFixed(1)} MB/s`;
    if (bytesPerSec >= 1024) return `${(bytesPerSec / 1024).toFixed(0)} KB/s`;
    return `${bytesPerSec} B/s`;
  };

  const formatEta = (seconds: number): string => {
    if (seconds <= 0 || !isFinite(seconds)) return '';
    if (seconds < 60) return `${Math.ceil(seconds)}s remaining`;
    return `${Math.floor(seconds / 60)}m ${Math.ceil(seconds % 60)}s remaining`;
  };

  const computeAspectRatio = (w: number, h: number): string => {
    if (!w || !h) return '';
    const ratio = w / h;
    if (Math.abs(ratio - 9 / 16) < 0.02) return '9:16';
    if (Math.abs(ratio - 1) < 0.02) return '1:1';
    return `${w}:${h}`;
  };

  const getVideoMetadata = (videoUri: string): Promise<VideoMeta | null> => {
    return new Promise((resolve) => {
      try {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.src = videoUri;
        video.addEventListener('loadedmetadata', () => {
          const w = video.videoWidth || 0;
          const h = video.videoHeight || 0;
          resolve({
            duration: video.duration || 0,
            width: w, height: h,
            aspectRatio: computeAspectRatio(w, h),
            resolution: w > 0 && h > 0 ? `${w}x${h}` : '',
          });
        });
        video.addEventListener('error', () => resolve(null));
        setTimeout(() => resolve(null), 5000);
      } catch { resolve(null); }
    });
  };

  const generateThumbnailFromVideo = (videoUri: string): Promise<string | null> => {
    return new Promise((resolve) => {
      try {
        const video = document.createElement('video');
        video.crossOrigin = 'anonymous';
        video.muted = true;
        video.preload = 'metadata';
        video.src = videoUri;
        video.addEventListener('loadeddata', () => {
          video.currentTime = Math.min(1, (video.duration || 5) * 0.1);
        });
        video.addEventListener('seeked', () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth || 360;
            canvas.height = video.videoHeight || 640;
            const ctx = canvas.getContext('2d');
            if (!ctx) { resolve(null); return; }
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', 0.8));
          } catch { resolve(null); }
        });
        video.addEventListener('error', () => resolve(null));
        setTimeout(() => resolve(null), 10000);
      } catch { resolve(null); }
    });
  };

  const validateVideoFile = (file: any): string | null => {
    if (!file) return 'No file selected';
    const result = VALIDATION.videoFile({ name: file.name, type: file.mimeType || file.type, size: file.size });
    if (!result.valid) return result.message || 'Invalid video file';
    if (file.size && file.size > MAX_FILE_SIZE) return `File too large. Maximum ${formatFileSize(MAX_FILE_SIZE)}.`;
    return null;
  };

  const handleVideoSelected = async (file: any) => {
    const validationError = validateVideoFile(file);
    if (validationError) {
      setErrorMessage(validationError);
      toast.error('Invalid video file', validationError);
      return;
    }

    setErrorMessage(null);
    setVideoFile(file);
    setErrors(prev => ({ ...prev, video: '' }));
    toast.success('Short selected', file.name || 'Ready to upload');

    if (isWeb && file.uri) {
      try {
        const meta = await getVideoMetadata(file.uri);
        if (meta) {
          setVideoMeta(meta);
          setDuration(Math.round(meta.duration).toString());
          const portrait = meta.height > meta.width;
          setIsPortrait(portrait);
          if (!portrait) {
            toast.info('Not portrait', 'Shorts work best in vertical (9:16) format');
          }
          if (meta.duration > MAX_DURATION_SECONDS) {
            setErrors(prev => ({ ...prev, duration: `Shorts must be ${MAX_DURATION_SECONDS}s or less. This video is ${Math.round(meta.duration)}s.` }));
          }
        }
      } catch { /* best-effort */ }

      if (!thumbnailFile) {
        try {
          const generatedThumb = await generateThumbnailFromVideo(file.uri);
          if (generatedThumb) {
            setThumbnailFile({ uri: generatedThumb, name: `thumb_${Date.now()}.jpg`, mimeType: 'image/jpeg' });
            toast.success('Thumbnail auto-generated', 'From first frame');
          }
        } catch { /* best-effort */ }
      }
    }
  };

  const pickVideo = async () => {
    try {
      setErrorMessage(null);
      const result = await DocumentPicker.getDocumentAsync({ type: ['video/*'], copyToCacheDirectory: true });
      if (result.assets && result.assets.length > 0) {
        await handleVideoSelected(result.assets[0]);
      }
    } catch (error) {
      console.error('Error picking video:', error);
      toast.error('Failed to pick video', 'Please try again');
    }
  };

  const handleDragEnter = (e: any) => { if (isWeb) { e.preventDefault(); e.stopPropagation(); dragCounter.current++; setDragActive(true); } };
  const handleDragLeave = (e: any) => { if (isWeb) { e.preventDefault(); e.stopPropagation(); dragCounter.current--; if (dragCounter.current === 0) setDragActive(false); } };
  const handleDragOver = (e: any) => { if (isWeb) { e.preventDefault(); e.stopPropagation(); } };
  const handleDrop = async (e: any) => {
    if (!isWeb) return;
    e.preventDefault(); e.stopPropagation();
    dragCounter.current = 0;
    setDragActive(false);
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      await handleVideoSelected({ uri: URL.createObjectURL(file), name: file.name, size: file.size, mimeType: file.type });
    }
  };

  const pickThumbnail = async () => {
    try {
      setErrorMessage(null);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8, allowsEditing: true, aspect: [9, 16],
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

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!title.trim()) newErrors.title = 'Title is required';
    if (!videoFile) newErrors.video = 'Video file is required';
    if (!duration || parseInt(duration) === 0) newErrors.duration = 'Duration is required';
    if (parseInt(duration) > MAX_DURATION_SECONDS) newErrors.duration = `Shorts must be ${MAX_DURATION_SECONDS}s or less`;
    if (!thumbnailFile) newErrors.thumbnail = 'Thumbnail is required';
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      toast.error('Validation failed', Object.values(newErrors)[0]);
    }
    return Object.keys(newErrors).length === 0;
  };

  const handleUpload = async () => {
    setSuccessMessage(null);
    setErrorMessage(null);
    if (!validateForm() || !user) return;

    setUploading(true);
    setUploadProgress(0);
    setUploadStage('Preparing upload...');

    try {
      let videoUrl: string | null = null;

      if (videoFile) {
        setUploadStage('Uploading short...');
        setUploadProgress(5);

        const fileExt = sanitizeFilename(videoFile.name?.split('.').pop() || 'mp4');
        const fileName = `${user.id}/${Date.now()}_short_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const response = await fetch(videoFile.uri);
        const blob = await response.blob();

        uploadStartTime.current = Date.now();

        const progressInterval = setInterval(() => {
          const elapsed = (Date.now() - uploadStartTime.current) / 1000;
          const estimatedProgress = Math.min(55, 5 + (elapsed / Math.max(1, blob.size / (2 * 1024 * 1024))) * 50);
          setUploadProgress(prev => Math.min(prev + 1, Math.max(prev, estimatedProgress)));
        }, 500);

        const { error: uploadError } = await supabase.storage
          .from('videos')
          .upload(fileName, blob, { contentType: `video/${fileExt}`, upsert: false });

        clearInterval(progressInterval);

        if (uploadError) {
          if (uploadError.message.includes('duplicate') || uploadError.message.includes('already exists')) {
            throw new Error('Duplicate upload prevented.');
          }
          throw new Error(`Upload failed: ${uploadError.message}`);
        }

        setUploadProgress(60);
        const { data: urlData } = supabase.storage.from('videos').getPublicUrl(fileName);
        videoUrl = urlData.publicUrl;
      }

      let thumbnailUrl: string | null = null;
      if (thumbnailFile) {
        setUploadStage('Uploading thumbnail...');
        setUploadProgress(65);

        const thumbExt = thumbnailFile.uri?.startsWith('data:image/') ? 'jpg' : sanitizeFilename(thumbnailFile.uri?.split('.').pop() || 'jpg');
        const thumbName = `${user.id}/${Date.now()}_short_thumb_${Math.random().toString(36).substring(7)}.${thumbExt}`;
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
      setUploadStage('Saving short...');

      const tagsArray = tags.split(',').map(t => sanitizeString(t, 50)).filter(Boolean);

      const { error: insertError } = await supabase
        .from('videos')
        .insert({
          title: sanitizeString(title, 200),
          description: description.trim() ? sanitizeString(description, 5000) : null,
          video_url: videoUrl,
          thumbnail_url: thumbnailUrl,
          duration: parseInt(duration) || 0,
          language: sanitizeString(language, 30) || null,
          tags: tagsArray.length > 0 ? tagsArray : null,
          resolution: videoMeta?.resolution || null,
          aspect_ratio: '9:16',
          status: visibility,
          views_count: 0,
          like_count: 0,
          uploader_id: user.id,
        });

      if (insertError) throw new Error(`Failed to save: ${insertError.message}`);

      setUploadProgress(100);
      setUploadStage('Completed');
      setSuccessMessage(`"${title.trim()}" uploaded successfully!`);
      toast.success('Short Uploaded', 'Your short is now live in the Shorts feed');

      setTimeout(() => {
        setTitle(''); setDescription(''); setVideoFile(null); setThumbnailFile(null);
        setDuration(''); setLanguage(''); setTags('');
        setVisibility('published'); setVideoMeta(null); setIsPortrait(false);
        setUploadProgress(0); setUploadStage(''); setUploading(false);
        setSuccessMessage(null);
      }, 4000);
    } catch (error: any) {
      console.error('Upload error:', error);
      const msg = error.message || 'Failed to upload';
      setErrorMessage(msg);
      toast.error('Upload failed', msg);
      setUploading(false);
      setUploadProgress(0); setUploadStage('');
    }
  };

  const visibilityOptions: { value: Visibility; label: string; icon: any; desc: string }[] = [
    { value: 'published', label: 'Public', icon: Eye, desc: 'Visible in Shorts feed' },
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
            <Play size={24} color={Colors.primary} fill={Colors.primary} />
            <Text style={styles.headerTitle}>Upload Short</Text>
          </View>

          <View style={styles.infoBanner}>
            <Smartphone size={18} color="#3B82F6" />
            <Text style={styles.infoText}>Shorts are vertical videos up to {MAX_DURATION_SECONDS} seconds. They appear in the Shorts feed.</Text>
          </View>

          {successMessage && (
            <Animated.View entering={FadeInDown.duration(300)} style={styles.successBanner}>
              <View style={styles.successIcon}>
                <CheckCircle size={24} color={Colors.status.success} />
              </View>
              <View style={styles.successContent}>
                <Text style={styles.successTitle}>Short Uploaded Successfully</Text>
                <Text style={styles.successText}>{successMessage}</Text>
              </View>
            </Animated.View>
          )}

          {errorMessage && (
            <Animated.View entering={FadeInDown.duration(300)} style={styles.errorBanner}>
              <AlertCircle size={20} color={Colors.status.error} />
              <Text style={styles.errorText}>{errorMessage}</Text>
              <TouchableOpacity onPress={() => setErrorMessage(null)} style={styles.closeBanner}>
                <X size={18} color={Colors.text.secondary} />
              </TouchableOpacity>
            </Animated.View>
          )}

          {uploading && (
            <Animated.View entering={FadeInDown.duration(300)} style={styles.progressCard}>
              <View style={styles.progressHeader}>
                {uploadProgress < 100 ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                  <CheckCircle size={20} color={Colors.status.success} />
                )}
                <Text style={styles.progressStage}>{uploadStage}</Text>
                <Text style={styles.progressPercent}>{Math.round(uploadProgress)}%</Text>
              </View>
              <View style={styles.progressBar}>
                <Animated.View style={[styles.progressFill, { width: `${uploadProgress}%` }]} />
              </View>
            </Animated.View>
          )}

          {/* Video File */}
          <Animated.View entering={FadeInUp.delay(50).duration(400)} style={styles.section}>
            <Text style={styles.sectionTitle}>Short Video File *</Text>
            <View
              style={[styles.uploadArea, dragActive && styles.uploadAreaActive, videoFile && styles.uploadAreaFilled]}
              {...(isWeb ? { onDragEnter: handleDragEnter, onDragLeave: handleDragLeave, onDragOver: handleDragOver, onDrop: handleDrop } : {})}
            >
              {videoFile ? (
                <View style={styles.fileInfo}>
                  <View style={styles.fileIcon}>
                    <FileVideo size={24} color={Colors.status.success} />
                  </View>
                  <View style={styles.fileDetails}>
                    <Text style={styles.fileName} numberOfLines={1}>{videoFile.name || 'Video selected'}</Text>
                    {videoFile.size ? <Text style={styles.fileSize}>{formatFileSize(videoFile.size)}</Text> : null}
                    {videoMeta?.resolution ? <Text style={styles.fileMeta}>{videoMeta.resolution} · {videoMeta.aspectRatio}</Text> : null}
                    {isPortrait && <Text style={styles.portraitBadge}>Portrait detected</Text>}
                  </View>
                  <TouchableOpacity onPress={() => { setVideoFile(null); setVideoMeta(null); setIsPortrait(false); }} disabled={uploading} style={styles.removeFileBtn}>
                    <Trash2 size={18} color={Colors.status.error} />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity onPress={pickVideo} disabled={uploading} activeOpacity={0.8} style={styles.uploadTouchArea}>
                  <View style={styles.uploadPlaceholder}>
                    <Upload size={40} color={Colors.text.muted} />
                    <Text style={styles.uploadText}>Click to browse or drag and drop</Text>
                    <Text style={styles.uploadHint}>MP4, MOV, WEBM up to {formatFileSize(MAX_FILE_SIZE)}</Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>
            {errors.video && <Text style={styles.error}>{errors.video}</Text>}
            {errors.duration && <Text style={styles.error}>{errors.duration}</Text>}
          </Animated.View>

          {/* Preview + Thumbnail */}
          {videoFile && (
            <Animated.View entering={FadeInUp.delay(100).duration(400)} style={styles.section}>
              <Text style={styles.sectionTitle}>Preview</Text>
              <View style={styles.previewRow}>
                <View style={styles.previewContainer}>
                  <Text style={styles.previewLabel}>Video</Text>
                  {isWeb && videoFile.uri ? (
                    <View style={styles.videoPreviewBox}>
                      <video src={videoFile.uri} style={{ width: '100%', height: '100%', borderRadius: BorderRadius.md, objectFit: 'contain' }} controls muted />
                    </View>
                  ) : (
                    <View style={styles.videoPreviewBox}><Play size={32} color={Colors.text.muted} /></View>
                  )}
                </View>
                <View style={styles.previewContainer}>
                  <Text style={styles.previewLabel}>Thumbnail</Text>
                  <TouchableOpacity style={styles.thumbnailPreviewBox} onPress={pickThumbnail} disabled={uploading} activeOpacity={0.8}>
                    {thumbnailFile ? (
                      <View style={styles.thumbnailPreviewWrapper}>
                        <Image source={{ uri: thumbnailFile.uri }} style={styles.thumbnailPreviewImage} />
                        <TouchableOpacity onPress={() => setThumbnailFile(null)} disabled={uploading} style={styles.removeThumbnailBtn}>
                          <X size={16} color={Colors.text.primary} />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={styles.uploadPlaceholder}>
                        <ImageIcon size={28} color={Colors.text.muted} />
                        <Text style={styles.uploadTextSmall}>Upload thumbnail</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  {errors.thumbnail && <Text style={styles.error}>{errors.thumbnail}</Text>}
                </View>
              </View>
            </Animated.View>
          )}

          {/* Info */}
          <Animated.View entering={FadeInUp.delay(150).duration(400)} style={styles.section}>
            <Text style={styles.sectionTitle}>Short Information</Text>
            <Input label="Title *" value={title} onChangeText={setTitle} placeholder="Enter short title" error={errors.title} leftIcon={<Film size={18} color={Colors.text.muted} />} />
            <Input label="Description" value={description} onChangeText={setDescription} placeholder="Enter description" multiline numberOfLines={3} />
            <View style={styles.row}>
              <View style={styles.halfWidth}>
                <Input label="Duration (sec) *" value={duration} onChangeText={setDuration} placeholder="Auto-detected" keyboardType="numeric" error={errors.duration} leftIcon={<Clock size={18} color={Colors.text.muted} />} />
              </View>
              <View style={styles.halfWidth}>
                <Input label="Language" value={language} onChangeText={setLanguage} placeholder="English..." leftIcon={<Globe size={18} color={Colors.text.muted} />} />
              </View>
            </View>
            <Input label="Tags" value={tags} onChangeText={setTags} placeholder="Comma-separated" leftIcon={<Tag size={18} color={Colors.text.muted} />} />
          </Animated.View>

          {/* Visibility */}
          <Animated.View entering={FadeInUp.delay(200).duration(400)} style={styles.section}>
            <Text style={styles.sectionTitle}>Visibility</Text>
            <View style={styles.visibilityOptions}>
              {visibilityOptions.map(opt => {
                const Icon = opt.icon;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.visibilityOption, visibility === opt.value && styles.visibilityOptionActive]}
                    onPress={() => setVisibility(opt.value)}
                    disabled={uploading}
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

          <Animated.View entering={FadeInUp.delay(250).duration(400)}>
            <Button
              title={uploading ? uploadStage || 'Uploading...' : 'Upload Short'}
              onPress={handleUpload}
              loading={uploading}
              disabled={uploading}
              style={styles.submitButton}
              icon={<Play size={18} color={Colors.text.primary} fill={Colors.text.primary} />}
            />
          </Animated.View>
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, paddingBottom: Spacing.xxl * 2, paddingTop: 50 },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.lg },
  backButton: { padding: Spacing.xs },
  headerTitle: { fontSize: FontSizes.xxl, fontWeight: FontWeights.bold, color: Colors.text.primary },
  infoBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: 'rgba(59, 130, 246, 0.1)', padding: Spacing.md, borderRadius: BorderRadius.md, marginBottom: Spacing.lg },
  infoText: { flex: 1, fontSize: FontSizes.sm, color: '#3B82F6' },
  section: { marginBottom: Spacing.xl },
  sectionTitle: { fontSize: FontSizes.lg, fontWeight: FontWeights.semibold, color: Colors.text.primary, marginBottom: Spacing.sm },
  row: { flexDirection: 'row', gap: Spacing.md },
  halfWidth: { flex: 1 },
  uploadArea: { borderWidth: 2, borderColor: Colors.border, borderStyle: 'dashed', borderRadius: BorderRadius.lg, padding: Spacing.xl, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.card, minHeight: 160 },
  uploadAreaActive: { borderColor: Colors.primary, backgroundColor: 'rgba(229, 9, 20, 0.05)' },
  uploadAreaFilled: { borderStyle: 'solid', borderColor: Colors.status.success },
  uploadTouchArea: { width: '100%', alignItems: 'center' },
  uploadPlaceholder: { alignItems: 'center' },
  uploadText: { fontSize: FontSizes.md, color: Colors.text.secondary, marginTop: Spacing.sm },
  uploadTextSmall: { fontSize: FontSizes.sm, color: Colors.text.secondary, marginTop: Spacing.xs },
  uploadHint: { fontSize: FontSizes.sm, color: Colors.text.muted, marginTop: Spacing.xs },
  fileInfo: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, width: '100%' },
  fileIcon: { width: 48, height: 48, borderRadius: BorderRadius.md, backgroundColor: 'rgba(34, 197, 94, 0.1)', justifyContent: 'center', alignItems: 'center' },
  fileDetails: { flex: 1 },
  fileName: { fontSize: FontSizes.md, color: Colors.text.primary, fontWeight: FontWeights.medium },
  fileSize: { fontSize: FontSizes.sm, color: Colors.text.muted, marginTop: 2 },
  fileMeta: { fontSize: FontSizes.sm, color: Colors.text.muted, marginTop: 2 },
  portraitBadge: { fontSize: FontSizes.xs, color: Colors.status.success, marginTop: 2, fontWeight: FontWeights.semibold },
  removeFileBtn: { padding: Spacing.sm },
  previewRow: { flexDirection: 'row', gap: Spacing.md },
  previewContainer: { flex: 1 },
  previewLabel: { fontSize: FontSizes.sm, color: Colors.text.muted, marginBottom: Spacing.xs },
  videoPreviewBox: { height: 200, backgroundColor: '#000', borderRadius: BorderRadius.md, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  thumbnailPreviewBox: { height: 200, backgroundColor: Colors.tertiary, borderRadius: BorderRadius.md, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  thumbnailPreviewWrapper: { width: '100%', height: '100%', position: 'relative' },
  thumbnailPreviewImage: { width: '100%', height: '100%', borderRadius: BorderRadius.md },
  removeThumbnailBtn: { position: 'absolute', top: Spacing.xs, right: Spacing.xs, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0, 0, 0, 0.6)', justifyContent: 'center', alignItems: 'center' },
  visibilityOptions: { gap: Spacing.sm },
  visibilityOption: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: BorderRadius.md, backgroundColor: Colors.card, borderWidth: 2, borderColor: 'transparent' },
  visibilityOptionActive: { borderColor: Colors.primary, backgroundColor: 'rgba(229, 9, 20, 0.05)' },
  visibilityTextContainer: { flex: 1 },
  visibilityLabel: { fontSize: FontSizes.md, color: Colors.text.primary, fontWeight: FontWeights.medium },
  visibilityLabelActive: { color: Colors.primary },
  visibilityDesc: { fontSize: FontSizes.sm, color: Colors.text.muted, marginTop: 2 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
  radioActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  submitButton: { marginTop: Spacing.lg },
  error: { color: Colors.status.error, fontSize: FontSizes.sm, marginTop: Spacing.xs },
  successBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: 'rgba(34, 197, 94, 0.1)', borderLeftWidth: 4, borderLeftColor: Colors.status.success, padding: Spacing.md, borderRadius: BorderRadius.md, marginBottom: Spacing.lg },
  successIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(34, 197, 94, 0.15)', justifyContent: 'center', alignItems: 'center' },
  successContent: { flex: 1 },
  successTitle: { color: Colors.status.success, fontSize: FontSizes.md, fontWeight: FontWeights.bold },
  successText: { color: Colors.text.secondary, fontSize: FontSizes.sm, marginTop: 2 },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: 'rgba(239, 68, 68, 0.1)', borderLeftWidth: 4, borderLeftColor: Colors.status.error, padding: Spacing.md, borderRadius: BorderRadius.md, marginBottom: Spacing.lg },
  errorText: { flex: 1, color: Colors.status.error, fontSize: FontSizes.md },
  closeBanner: { padding: Spacing.xs },
  progressCard: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.lg, borderWidth: 1, borderColor: Colors.border },
  progressHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  progressStage: { flex: 1, fontSize: FontSizes.md, color: Colors.text.primary, fontWeight: FontWeights.medium },
  progressPercent: { fontSize: FontSizes.md, color: Colors.primary, fontWeight: FontWeights.bold },
  progressBar: { height: 8, backgroundColor: Colors.tertiary, borderRadius: BorderRadius.full, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: BorderRadius.full },
});
