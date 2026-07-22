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
  TextInput,
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
  FileText,
  Monitor,
  Smartphone,
  Play,
  Trash2,
  Calendar,
  Star,
  Crown,
} from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { supabase, Category } from '@/lib/supabase';
import { uploadWithProgress, getVideoMime, getImageMime } from '@/lib/storage';
import { scheduleVideo } from '@/lib/scheduling';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthGuard } from '@/hooks/useGlobalStore';
import { useToast } from '@/components/Toast';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { LoadingScreen } from '@/components/Loading';
import { Colors, Spacing, FontSizes, FontWeights, BorderRadius } from '@/constants/theme';
import { VALIDATION, sanitizeString, sanitizeFilename } from '@/lib/validation';

const { width } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB for creators
const SUPPORTED_FORMATS = ['mp4', 'mov', 'webm', 'mkv'];

type Visibility = 'published' | 'unlisted' | 'private';

interface VideoMeta {
  duration: number;
  width: number;
  height: number;
  aspectRatio: string;
  resolution: string;
}

export default function StudioUploadScreen() {
  useAuthGuard(true);
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();

  const [categories, setCategories] = useState<Category[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [videoFile, setVideoFile] = useState<any>(null);
  const [thumbnailFile, setThumbnailFile] = useState<any>(null);
  const [duration, setDuration] = useState('');
  const [genre, setGenre] = useState('');
  const [language, setLanguage] = useState('');
  const [tags, setTags] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<Visibility>('published');
  const [isPremiere, setIsPremiere] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [isPremium, setIsPremium] = useState(false);
  const [isMemberOnly, setIsMemberOnly] = useState(false);
  const [videoMeta, setVideoMeta] = useState<VideoMeta | null>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState('');
  const [uploadSpeed, setUploadSpeed] = useState('');
  const [uploadEta, setUploadEta] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const uploadStartTime = useRef(0);
  const dragCounter = useRef(0);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const { data } = await supabase.from('categories').select('*').order('name');
      if (data) setCategories(data);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + ' GB';
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
    if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return bytes + ' B';
  };

  const formatDurationDisplay = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  const formatUploadSpeed = (bytesPerSec: number): string => {
    if (bytesPerSec >= 1073741824) return `${(bytesPerSec / 1073741824).toFixed(1)} GB/s`;
    if (bytesPerSec >= 1048576) return `${(bytesPerSec / 1048576).toFixed(1)} MB/s`;
    if (bytesPerSec >= 1024) return `${(bytesPerSec / 1024).toFixed(0)} KB/s`;
    return `${bytesPerSec} B/s`;
  };

  const formatEta = (seconds: number): string => {
    if (seconds <= 0 || !isFinite(seconds)) return '';
    if (seconds < 60) return `${Math.ceil(seconds)}s remaining`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.ceil(seconds % 60);
    return `${mins}m ${secs}s remaining`;
  };

  const computeAspectRatio = (w: number, h: number): string => {
    if (!w || !h) return '';
    const ratio = w / h;
    const common: Record<string, number> = {
      '16:9': 16 / 9, '9:16': 9 / 16, '4:3': 4 / 3, '3:4': 3 / 4, '1:1': 1, '21:9': 21 / 9,
    };
    for (const [label, val] of Object.entries(common)) {
      if (Math.abs(ratio - val) < 0.02) return label;
    }
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
          video.currentTime = Math.min(2, (video.duration || 10) * 0.1);
        });
        video.addEventListener('seeked', () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth || 640;
            canvas.height = video.videoHeight || 360;
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
    toast.success('Video selected', file.name || 'Ready to upload');

    if (isWeb && file.uri) {
      try {
        const meta = await getVideoMetadata(file.uri);
        if (meta) {
          setVideoMeta(meta);
          setDuration(Math.round(meta.duration).toString());
        }
      } catch {
        if (file.size) {
          const estimatedMinutes = Math.ceil(file.size / (5 * 1024 * 1024));
          setDuration((estimatedMinutes * 60).toString());
        }
      }

      if (!thumbnailFile) {
        try {
          const generatedThumb = await generateThumbnailFromVideo(file.uri);
          if (generatedThumb) {
            setThumbnailFile({ uri: generatedThumb, name: `thumb_${Date.now()}.jpg`, mimeType: 'image/jpeg' });
            toast.success('Thumbnail auto-generated', 'From first frame of video');
          }
        } catch { /* best-effort */ }
      }
    } else if (file.size) {
      const estimatedMinutes = Math.ceil(file.size / (5 * 1024 * 1024));
      setDuration((estimatedMinutes * 60).toString());
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

  const handleDragEnter = (e: any) => {
    if (!isWeb) return;
    e.preventDefault(); e.stopPropagation();
    dragCounter.current++;
    setDragActive(true);
  };
  const handleDragLeave = (e: any) => {
    if (!isWeb) return;
    e.preventDefault(); e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) setDragActive(false);
  };
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
        quality: 0.8, allowsEditing: true, aspect: [16, 9],
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

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!title.trim()) newErrors.title = 'Title is required';
    if (!videoFile) newErrors.video = 'Video file is required';
    if (!duration || parseInt(duration) === 0) newErrors.duration = 'Duration is required';
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
    setUploadSpeed('');
    setUploadEta('');

    try {
      let videoUrl: string | null = null;

      // Upload video file to user's folder
      if (videoFile) {
        setUploadStage('Uploading video...');
        setUploadProgress(2);

        const rawExt = (videoFile.name?.split('.').pop() || 'mp4').toLowerCase();
        const fileExt = sanitizeFilename(rawExt);
        const fileName = `${user.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const response = await fetch(videoFile.uri);
        const blob = await response.blob();
        const contentType = getVideoMime(rawExt);

        uploadStartTime.current = Date.now();

        let lastProgress = 0;
        const result = await uploadWithProgress(
          'videos',
          fileName,
          blob,
          contentType,
          (p) => {
            const mapped = 5 + (p / 100) * 55;
            if (mapped > lastProgress) {
              lastProgress = mapped;
              setUploadProgress(mapped);
              const elapsed = (Date.now() - uploadStartTime.current) / 1000;
              if (p > 5 && elapsed > 0) {
                const speed = (blob.size * (p / 100)) / elapsed;
                setUploadSpeed(formatUploadSpeed(speed));
                if (speed > 0) {
                  const remaining = (blob.size * (1 - p / 100)) / speed;
                  setUploadEta(formatEta(remaining));
                }
              }
            }
          },
          false,
          3
        );

        videoUrl = result.publicUrl;
        setUploadProgress(60);
        setUploadSpeed(''); setUploadEta('');
      }

      // Upload thumbnail to user's folder (optional — auto-generated or user-provided)
      let thumbnailUrl: string | null = null;
      if (thumbnailFile) {
        setUploadStage('Uploading thumbnail...');
        setUploadProgress(65);

        const isDataUri = thumbnailFile.uri?.startsWith('data:image/');
        const rawThumbExt = isDataUri
          ? (thumbnailFile.mimeType?.split('/')[1] || 'jpg')
          : (thumbnailFile.uri?.split('.').pop() || 'jpg');
        const thumbExt = sanitizeFilename(rawThumbExt);
        const thumbName = `${user.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${thumbExt}`;
        const thumbResponse = await fetch(thumbnailFile.uri);
        const thumbBlob = await thumbResponse.blob();
        const thumbContentType = getImageMime(rawThumbExt);

        try {
          const thumbResult = await uploadWithProgress(
            'thumbnails',
            thumbName,
            thumbBlob,
            thumbContentType,
            (p) => setUploadProgress(65 + (p / 100) * 5),
            false,
            2
          );
          thumbnailUrl = thumbResult.publicUrl;
        } catch (err: any) {
          if ((err.message || '').includes('already exists')) {
            throw new Error('Thumbnail upload failed: file already exists.');
          }
        }
      }

      setUploadProgress(75);
      setUploadStage('Saving video record...');

      const tagsArray = tags.split(',').map(t => sanitizeString(t, 50)).filter(Boolean);

      const { data: insertedVideo, error: insertError } = await supabase
        .from('videos')
        .insert({
          title: sanitizeString(title, 200),
          description: description.trim() ? sanitizeString(description, 5000) : null,
          video_url: videoUrl,
          thumbnail_url: thumbnailUrl,
          duration: parseInt(duration) || 0,
          genre: sanitizeString(genre, 50) || null,
          language: sanitizeString(language, 30) || null,
          tags: tagsArray.length > 0 ? tagsArray : null,
          resolution: videoMeta?.resolution || null,
          aspect_ratio: videoMeta?.aspectRatio || null,
          is_short: (parseInt(duration) || 0) > 0 && (parseInt(duration) || 0) <= 60,
          status: (scheduleDate && scheduleTime) ? 'draft' : visibility,
          views_count: 0,
          like_count: 0,
          uploader_id: user.id,
          is_premium: isPremium,
          is_member_only: isMemberOnly,
          premiere_at: isPremiere && scheduleDate && scheduleTime ? new Date(`${scheduleDate}T${scheduleTime}`).toISOString() : null,
          scheduled_at: scheduleDate && scheduleTime ? new Date(`${scheduleDate}T${scheduleTime}`).toISOString() : null,
        })
        .select()
        .single();

      if (insertError) throw new Error(`Failed to save video: ${insertError.message}`);

      // Schedule if date/time provided
      if (insertedVideo && scheduleDate && scheduleTime) {
        const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();
        await scheduleVideo(insertedVideo.id, user.id, scheduledAt, isPremiere);
      }

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
      setUploadStage('Completed');
      setSuccessMessage(`"${title.trim()}" uploaded successfully!`);
      toast.success('Upload Successful', 'Your video is now live');

      setTimeout(() => {
        setTitle(''); setDescription(''); setVideoFile(null); setThumbnailFile(null);
        setDuration(''); setGenre(''); setLanguage(''); setTags('');
        setSelectedCategories([]); setVisibility('published'); setVideoMeta(null);
        setIsPremiere(false); setScheduleDate(''); setScheduleTime(''); setIsPremium(false); setIsMemberOnly(false);
        setUploadProgress(0); setUploadStage(''); setUploading(false);
        setSuccessMessage(null); setUploadSpeed(''); setUploadEta('');
      }, 4000);
    } catch (error: any) {
      console.error('Upload error:', error);
      const msg = error.message || 'Failed to upload video';
      setErrorMessage(msg);
      toast.error('Upload failed', msg);
      setUploading(false);
      setUploadProgress(0); setUploadStage(''); setUploadSpeed(''); setUploadEta('');
    }
  };

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
            <Upload size={24} color={Colors.primary} />
            <Text style={styles.headerTitle}>Upload Video</Text>
          </View>

          {successMessage && (
            <Animated.View entering={FadeInDown.duration(300)} style={styles.successBanner}>
              <View style={styles.successIcon}>
                <CheckCircle size={24} color={Colors.status.success} />
              </View>
              <View style={styles.successContent}>
                <Text style={styles.successTitle}>Upload Successful</Text>
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
              <View style={styles.progressInfoRow}>
                {uploadSpeed ? <Text style={styles.progressInfo}>{uploadSpeed}</Text> : null}
                {uploadEta ? <Text style={styles.progressInfo}>{uploadEta}</Text> : null}
              </View>
            </Animated.View>
          )}

          {/* Video File */}
          <Animated.View entering={FadeInUp.delay(50).duration(400)} style={styles.section}>
            <Text style={styles.sectionTitle}>Video File *</Text>
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
                  </View>
                  <TouchableOpacity onPress={() => { setVideoFile(null); setVideoMeta(null); }} disabled={uploading} style={styles.removeFileBtn}>
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
          </Animated.View>

          {/* Preview */}
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
                        <Text style={styles.uploadHint}>JPG, PNG, WebP</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  {errors.thumbnail && <Text style={styles.error}>{errors.thumbnail}</Text>}
                </View>
              </View>
            </Animated.View>
          )}

          {/* Video Info */}
          <Animated.View entering={FadeInUp.delay(150).duration(400)} style={styles.section}>
            <Text style={styles.sectionTitle}>Video Information</Text>
            <Input label="Title *" value={title} onChangeText={setTitle} placeholder="Enter video title" error={errors.title} leftIcon={<Film size={18} color={Colors.text.muted} />} />
            <Input label="Description" value={description} onChangeText={setDescription} placeholder="Enter video description" multiline numberOfLines={4} />
            <View style={styles.row}>
              <View style={styles.halfWidth}>
                <Input label="Duration (seconds) *" value={duration} onChangeText={setDuration} placeholder="Auto-detected" keyboardType="numeric" error={errors.duration} leftIcon={<Clock size={18} color={Colors.text.muted} />} />
                {videoMeta && videoMeta.duration > 0 ? <Text style={styles.autoDetectHint}>Auto-detected: {formatDurationDisplay(videoMeta.duration)}</Text> : null}
              </View>
              <View style={styles.halfWidth}>
                <Input label="Genre" value={genre} onChangeText={setGenre} placeholder="Action, Drama..." leftIcon={<Tag size={18} color={Colors.text.muted} />} />
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.halfWidth}>
                <Input label="Language" value={language} onChangeText={setLanguage} placeholder="English, Spanish..." leftIcon={<Globe size={18} color={Colors.text.muted} />} />
              </View>
              <View style={styles.halfWidth}>
                <Input label="Tags" value={tags} onChangeText={setTags} placeholder="Comma-separated" leftIcon={<Tag size={18} color={Colors.text.muted} />} />
              </View>
            </View>
          </Animated.View>

          {/* Categories */}
          <Animated.View entering={FadeInUp.delay(200).duration(400)} style={styles.section}>
            <Text style={styles.sectionTitle}>Categories</Text>
            <View style={styles.categoriesGrid}>
              {categories.map(cat => (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.categoryChip, selectedCategories.includes(cat.id) && styles.categoryChipActive]}
                  onPress={() => toggleCategory(cat.id)}
                  disabled={uploading}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.categoryChipText, selectedCategories.includes(cat.id) && styles.categoryChipTextActive]}>{cat.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>

          {/* Visibility */}
          <Animated.View entering={FadeInUp.delay(250).duration(400)} style={styles.section}>
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

          {/* Scheduling & Premiere */}
          <Animated.View entering={FadeInUp.delay(250).duration(400)} style={styles.section}>
            <Text style={styles.sectionTitle}>Schedule & Premiere</Text>
            <View style={styles.scheduleRow}>
              <TouchableOpacity
                style={[styles.scheduleOption, (scheduleDate && scheduleTime) && styles.scheduleOptionActive]}
                onPress={() => {
                  if (!scheduleDate) setScheduleDate(new Date().toISOString().split('T')[0]);
                  if (!scheduleTime) setScheduleTime('18:00');
                }}
              >
                <Calendar size={18} color={(scheduleDate && scheduleTime) ? Colors.primary : Colors.text.muted} />
                <Text style={[styles.scheduleLabel, (scheduleDate && scheduleTime) && styles.scheduleLabelActive]}>Schedule for later</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.scheduleOption, isPremiere && styles.scheduleOptionActive]}
                onPress={() => setIsPremiere(!isPremiere)}
              >
                <Star size={18} color={isPremiere ? Colors.primary : Colors.text.muted} fill={isPremiere ? Colors.primary : 'transparent'} />
                <Text style={[styles.scheduleLabel, isPremiere && styles.scheduleLabelActive]}>Premiere</Text>
              </TouchableOpacity>
            </View>
            {scheduleDate && (
              <View style={styles.scheduleInputs}>
                <View style={styles.halfWidth}>
                  <Text style={styles.inputLabel}>Date</Text>
                  <TextInput
                    style={styles.input}
                    value={scheduleDate}
                    onChangeText={setScheduleDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={Colors.text.muted}
                  />
                </View>
                <View style={styles.halfWidth}>
                  <Text style={styles.inputLabel}>Time</Text>
                  <TextInput
                    style={styles.input}
                    value={scheduleTime}
                    onChangeText={setScheduleTime}
                    placeholder="HH:MM"
                    placeholderTextColor={Colors.text.muted}
                  />
                </View>
                {(scheduleDate && scheduleTime) && (
                  <TouchableOpacity onPress={() => { setScheduleDate(''); setScheduleTime(''); }}>
                    <Text style={styles.clearSchedule}>Clear</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
            {isPremiere && (
              <Text style={styles.premiereHint}>Premiere includes a live countdown and chat before the video plays.</Text>
            )}
          </Animated.View>

          {/* Access Control */}
          <Animated.View entering={FadeInUp.delay(280).duration(400)} style={styles.section}>
            <Text style={styles.sectionTitle}>Access Control</Text>
            <View style={styles.accessRow}>
              <TouchableOpacity
                style={[styles.accessOption, isPremium && styles.accessOptionActive]}
                onPress={() => setIsPremium(!isPremium)}
              >
                <Crown size={18} color={isPremium ? '#FFD700' : Colors.text.muted} />
                <Text style={[styles.accessLabel, isPremium && styles.accessLabelActive]}>Premium</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.accessOption, isMemberOnly && styles.accessOptionActive]}
                onPress={() => setIsMemberOnly(!isMemberOnly)}
              >
                <Lock size={18} color={isMemberOnly ? Colors.status.info : Colors.text.muted} />
                <Text style={[styles.accessLabel, isMemberOnly && styles.accessLabelActive]}>Members Only</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(300).duration(400)}>
            <Button
              title={uploading ? uploadStage || 'Uploading...' : 'Upload Video'}
              onPress={handleUpload}
              loading={uploading}
              disabled={uploading}
              style={styles.submitButton}
              icon={<Upload size={18} color={Colors.text.primary} />}
            />
            <Text style={styles.submitHint}>
              {(scheduleDate && scheduleTime) ? 'Video will be scheduled for later' : isPremiere ? 'Premiere will start with a countdown' : visibility === 'published' ? 'Video will be public immediately' : visibility === 'unlisted' ? 'Video will only be visible with the link' : 'Video will be private — only you can see it'}
            </Text>
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
  removeFileBtn: { padding: Spacing.sm },
  autoDetectHint: { fontSize: FontSizes.xs, color: Colors.status.success, marginTop: Spacing.xs },
  previewRow: { flexDirection: 'row', gap: Spacing.md },
  previewContainer: { flex: 1 },
  previewLabel: { fontSize: FontSizes.sm, color: Colors.text.muted, marginBottom: Spacing.xs },
  videoPreviewBox: { height: 120, backgroundColor: '#000', borderRadius: BorderRadius.md, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  thumbnailPreviewBox: { height: 120, backgroundColor: Colors.tertiary, borderRadius: BorderRadius.md, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  thumbnailPreviewWrapper: { width: '100%', height: '100%', position: 'relative' },
  thumbnailPreviewImage: { width: '100%', height: '100%', borderRadius: BorderRadius.md },
  removeThumbnailBtn: { position: 'absolute', top: Spacing.xs, right: Spacing.xs, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0, 0, 0, 0.6)', justifyContent: 'center', alignItems: 'center' },
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
  submitButton: { marginTop: Spacing.lg },
  submitHint: { fontSize: FontSizes.sm, color: Colors.text.muted, textAlign: 'center', marginTop: Spacing.sm },
  scheduleRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  scheduleOption: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderRadius: BorderRadius.md, backgroundColor: Colors.card, borderWidth: 2, borderColor: 'transparent' },
  scheduleOptionActive: { borderColor: Colors.primary, backgroundColor: 'rgba(229, 9, 20, 0.05)' },
  scheduleLabel: { fontSize: FontSizes.sm, color: Colors.text.muted, fontWeight: FontWeights.medium },
  scheduleLabelActive: { color: Colors.primary },
  scheduleInputs: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-end' },
  inputLabel: { fontSize: FontSizes.xs, color: Colors.text.muted, marginBottom: 4 },
  input: { backgroundColor: Colors.card, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, color: Colors.text.primary, fontSize: FontSizes.sm, borderWidth: 1, borderColor: Colors.border },
  clearSchedule: { fontSize: FontSizes.xs, color: Colors.status.error, fontWeight: FontWeights.medium, paddingVertical: Spacing.sm },
  premiereHint: { fontSize: FontSizes.xs, color: Colors.text.muted, marginTop: Spacing.sm, lineHeight: 16 },
  accessRow: { flexDirection: 'row', gap: Spacing.sm },
  accessOption: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderRadius: BorderRadius.md, backgroundColor: Colors.card, borderWidth: 2, borderColor: 'transparent' },
  accessOptionActive: { borderColor: Colors.primary, backgroundColor: 'rgba(229, 9, 20, 0.05)' },
  accessLabel: { fontSize: FontSizes.sm, color: Colors.text.muted, fontWeight: FontWeights.medium },
  accessLabelActive: { color: Colors.primary },
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
  progressInfoRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.sm },
  progressInfo: { fontSize: FontSizes.sm, color: Colors.text.muted },
});
