/**
 * Input validation utilities for production security.
 * All user-facing input is validated and sanitized here.
 */

export const VALIDATION = {
  email: (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  },

  phone: (phone: string): boolean => {
    return /^\+?[\d\s\-\(\)]{7,15}$/.test(phone.trim());
  },

  password: (password: string): { valid: boolean; message?: string } => {
    if (password.length < 8) return { valid: false, message: 'Password must be at least 8 characters' };
    if (!/[A-Z]/.test(password)) return { valid: false, message: 'Password must contain at least one uppercase letter' };
    if (!/[a-z]/.test(password)) return { valid: false, message: 'Password must contain at least one lowercase letter' };
    if (!/[0-9]/.test(password)) return { valid: false, message: 'Password must contain at least one number' };
    return { valid: true };
  },

  username: (username: string): { valid: boolean; message?: string } => {
    if (username.length < 3) return { valid: false, message: 'Username must be at least 3 characters' };
    if (username.length > 20) return { valid: false, message: 'Username must be at most 20 characters' };
    if (!/^[a-zA-Z0-9_]+$/.test(username)) return { valid: false, message: 'Username can only contain letters, numbers, and underscores' };
    return { valid: true };
  },

  fullName: (name: string): { valid: boolean; message?: string } => {
    if (name.trim().length < 2) return { valid: false, message: 'Name must be at least 2 characters' };
    if (name.trim().length > 50) return { valid: false, message: 'Name must be at most 50 characters' };
    return { valid: true };
  },

  title: (title: string): { valid: boolean; message?: string } => {
    if (title.trim().length < 1) return { valid: false, message: 'Title is required' };
    if (title.trim().length > 200) return { valid: false, message: 'Title must be at most 200 characters' };
    return { valid: true };
  },

  description: (desc: string): { valid: boolean; message?: string } => {
    if (desc.length > 5000) return { valid: false, message: 'Description must be at most 5000 characters' };
    return { valid: true };
  },

  slug: (slug: string): boolean => {
    return /^[a-z0-9\-]+$/.test(slug);
  },

  videoFile: (file: { name?: string; type?: string; size?: number }): { valid: boolean; message?: string } => {
    const allowedTypes = ['video/mp4', 'video/quicktime', 'video/x-matroska', 'video/webm', 'video/avi'];
    const allowedExtensions = ['.mp4', '.mov', '.mkv', '.webm', '.avi'];
    const maxSize = 5 * 1024 * 1024 * 1024; // 5GB

    const ext = file.name ? '.' + file.name.split('.').pop()?.toLowerCase() : '';
    if (!allowedExtensions.includes(ext)) {
      return { valid: false, message: 'Only MP4, MOV, MKV, WebM, and AVI files are allowed' };
    }
    if (file.type && !allowedTypes.includes(file.type)) {
      return { valid: false, message: 'Invalid video format. Only MP4, MOV, MKV, WebM, and AVI are allowed' };
    }
    if (file.size && file.size > maxSize) {
      return { valid: false, message: 'Video file must be less than 5 GB' };
    }
    return { valid: true };
  },

  imageFile: (file: { name?: string; type?: string; size?: number }): { valid: boolean; message?: string } => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    const maxSize = 10 * 1024 * 1024; // 10MB

    const ext = file.name ? '.' + file.name.split('.').pop()?.toLowerCase() : '';
    if (!allowedExtensions.includes(ext)) {
      return { valid: false, message: 'Only JPG, PNG, WebP, and GIF images are allowed' };
    }
    if (file.type && !allowedTypes.includes(file.type)) {
      return { valid: false, message: 'Invalid image format' };
    }
    if (file.size && file.size > maxSize) {
      return { valid: false, message: 'Image must be less than 10 MB' };
    }
    return { valid: true };
  },
};

export function sanitizeString(input: string, maxLength: number = 1000): string {
  return input
    .trim()
    .slice(0, maxLength)
    .replace(/<[^>]*>/g, '');
}

export function sanitizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9\.\-_]/g, '_');
}
