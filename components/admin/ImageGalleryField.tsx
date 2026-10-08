'use client';

import { useRef, useState } from 'react';
import { ACCEPT, uploadToCloudinary } from '@/lib/upload-client';

/**
 * Several photos per product, in the order shoppers will see them.
 * Adapted from Lighthill. Each photo posts as a repeated `image` field.
 */
export default function ImageGalleryField({ defaultValue = [] }: { defaultValue?: string[] }) {
  const [images, setImages] = useState<string[]>(defaultValue);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function upload(files: FileList) {
    setError(null);
    setBusy(true);
    const added: string[] = [];
    for (const file of Array.from(files).slice(0, 8)) {
      try {
        added.push(await uploadToCloudinary(file, 'image'));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'The upload did not complete.');
        break;
      }
    }
    setImages((prev) => [...prev, ...added].slice(0, 12));
    setBusy(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  function move(index: number, by: number) {
    setImages((prev) => {
      const next = [...prev];
      const target = index + by;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  const tool = 'h-8 w-8 rounded-md bg-white/90 text-sm font-bold text-[#0A2540] disabled:opacity-40';

  return (
    <div className="flex flex-col gap-3">
      {images.map((url) => (
        <input type="hidden" name="image" value={url} key={url} />
      ))}

      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {images.map((url, i) => (
            <figure key={url} className="relative overflow-hidden rounded-xl border border-[#E3E7EC] bg-[#F4F5F7]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="aspect-square w-full object-cover" />
              {i === 0 && (
                <span className="absolute left-2 top-2 rounded-md bg-[#0A2540] px-2 py-0.5 text-xs font-bold text-white">
                  Main
                </span>
              )}
              <div className="absolute bottom-2 left-2 right-2 flex justify-between">
                <button type="button" className={tool} onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move earlier">←</button>
                <button type="button" className={tool} onClick={() => setImages((p) => p.filter((u) => u !== url))} aria-label="Remove photo">✕</button>
                <button type="button" className={tool} onClick={() => move(i, 1)} disabled={i === images.length - 1} aria-label="Move later">→</button>
              </div>
            </figure>
          ))}
        </div>
      )}

      <div>
        <button
          type="button"
          className="h-10 rounded-lg border border-[#0A2540] px-4 text-sm font-bold disabled:opacity-50"
          disabled={busy || images.length >= 12}
          onClick={() => fileRef.current?.click()}
        >
          {busy ? 'Uploading…' : images.length ? 'Add more photos' : 'Add photos'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT.image}
          multiple
          hidden
          onChange={(e) => e.target.files && void upload(e.target.files)}
        />
      </div>

      {error && <p role="alert" className="text-sm font-medium text-[#BE123C]">{error}</p>}
      <p className="text-sm text-[#5B6B7C]">
        The first photo is the one shoppers see in lists. Up to 12; change the order with the arrows.
      </p>
    </div>
  );
}
