/**
 * Browser-side upload to Cloudinary.
 *
 * Asks our server for a signature, then posts the file straight to Cloudinary.
 * Nothing large travels through our own server, so a 90 MB video works exactly
 * the same as a 200 KB photo.
 */
export type UploadKind = 'image' | 'video';

export const MAX_BYTES: Record<UploadKind, number> = {
  image: 10 * 1024 * 1024,
  video: 100 * 1024 * 1024,
};

export const ACCEPT: Record<UploadKind, string> = {
  image: 'image/jpeg,image/png,image/webp,image/avif,image/gif',
  video: 'video/mp4,video/quicktime,video/webm,video/x-m4v',
};

export async function uploadToCloudinary(
  file: File,
  kind: UploadKind,
  onProgress?: (percent: number) => void,
): Promise<string> {
  if (file.size > MAX_BYTES[kind]) {
    const mb = (MAX_BYTES[kind] / 1024 / 1024).toFixed(0);
    throw new Error(`That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is ${mb} MB.`);
  }

  const sigRes = await fetch('/api/admin/upload-signature', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind }),
  });
  const sig = (await sigRes.json()) as {
    signature?: string; timestamp?: number; apiKey?: string; cloudName?: string;
    folder?: string; resourceType?: string; error?: string;
  };
  if (!sigRes.ok || !sig.signature) throw new Error(sig.error ?? 'Could not start the upload.');

  const form = new FormData();
  form.append('file', file);
  form.append('api_key', sig.apiKey!);
  form.append('timestamp', String(sig.timestamp));
  form.append('folder', sig.folder!);
  form.append('signature', sig.signature);

  const endpoint = `https://api.cloudinary.com/v1_1/${sig.cloudName}/${sig.resourceType}/upload`;

  // XHR rather than fetch — it is the only way to report upload progress,
  // which matters when someone is sending a 60 MB video over hotel wifi.
  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', endpoint);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText) as { secure_url?: string; error?: { message?: string } };
        if (xhr.status >= 200 && xhr.status < 300 && data.secure_url) resolve(data.secure_url);
        else reject(new Error(data.error?.message ?? 'The upload was rejected.'));
      } catch {
        reject(new Error('The upload did not complete.'));
      }
    };
    xhr.onerror = () => reject(new Error('The upload failed. Check your connection and try again.'));
    xhr.send(form);
  });
}
