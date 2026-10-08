import { v2 as cloudinary } from 'cloudinary';

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

/** All Soko media lives under one folder, away from your other work. */
export const CLOUDINARY_FOLDER = process.env.CLOUDINARY_FOLDER || 'soko';

export const uploadsEnabled = Boolean(cloudName && apiKey && apiSecret);
export const CLOUD_NAME = cloudName ?? '';

if (uploadsEnabled) {
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });
}

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'];
export const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v'];

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;   // 10 MB
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;  // 100 MB — Cloudinary's free-plan ceiling

/**
 * A short-lived signature the browser uses to upload straight to Cloudinary.
 *
 * The file never passes through our own server, which matters: hosting
 * platforms cap request bodies at a few megabytes, so a server-side upload
 * route would fail on any real video. The API secret stays here.
 */
export function signUpload(params: Record<string, string | number>) {
  const timestamp = Math.round(Date.now() / 1000);
  const toSign = { ...params, timestamp };
  const signature = cloudinary.utils.api_sign_request(toSign, apiSecret as string);
  return { ...toSign, signature, apiKey: apiKey as string, cloudName: CLOUD_NAME };
}

/** Delivery URL for a Cloudinary video, with the transformations we want applied. */
export function videoUrl(publicIdOrUrl: string, opts: { width?: number } = {}) {
  if (!publicIdOrUrl) return '';
  // Already a full URL: insert transformations after /upload/.
  if (publicIdOrUrl.startsWith('http')) {
    return publicIdOrUrl.replace(
      '/upload/',
      `/upload/q_auto,f_auto${opts.width ? `,w_${opts.width},c_limit` : ''}/`,
    );
  }
  return `https://res.cloudinary.com/${CLOUD_NAME}/video/upload/q_auto,f_auto/${publicIdOrUrl}`;
}

/** A still frame from a video, used as the poster before playback starts. */
export function videoPoster(url: string) {
  if (!url || !url.startsWith('http')) return '';
  return url
    .replace('/upload/', '/upload/so_auto,q_auto,f_auto,w_1200,c_limit/')
    .replace(/\.(mp4|mov|webm|m4v)$/i, '.jpg');
}
