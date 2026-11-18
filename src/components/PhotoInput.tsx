"use client";

import { useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/client";

const MAX_SIDE = 2048;
const AVATAR_SIDE = 512;
const QUALITY = 0.85;

/**
 * File input that shrinks photos in the browser before upload: phone pictures (often 5–10 MB, or HEIC on
 * iPhone, which most browsers can't display) become ~2048px JPEGs. Falls back to the original file if the
 * browser can't decode it.
 */
export function PhotoInput({
  name,
  multiple = false,
  id,
  square = false,
}: {
  name: string;
  multiple?: boolean;
  id?: string;
  /** Profile pictures: centre-crop to a 512px square. */
  square?: boolean;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const files = Array.from(input.files ?? []);
    if (!files.length) return setPreviews([]);
    setBusy(true);
    const out = await Promise.all(files.map((f) => shrink(f, square)));
    const dt = new DataTransfer();
    out.forEach((f) => dt.items.add(f));
    input.files = dt.files;
    previews.forEach((u) => URL.revokeObjectURL(u));
    setPreviews(out.map((f) => URL.createObjectURL(f)));
    setBusy(false);
  }

  return (
    <div>
      <input
        ref={ref}
        id={id ?? name}
        name={name}
        type="file"
        accept="image/*"
        multiple={multiple}
        onChange={onChange}
        className="input file:mr-3 file:rounded-lg file:border-0 file:bg-border file:px-2 file:py-1 file:text-foreground"
      />
      {(busy || previews.length > 0) && (
        <div className="mt-2 flex flex-wrap gap-2">
          {busy && <span className="text-xs text-muted">{t.common.processing}</span>}
          {previews.map((u) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={u} src={u} alt="" className={square ? "h-16 w-16 rounded-full object-cover" : "h-16 w-20 rounded-lg object-cover"} />
          ))}
        </div>
      )}
    </div>
  );
}

async function shrink(file: File, square = false): Promise<File> {
  if (!file.type.startsWith("image/") && !/\.(heic|heif)$/i.test(file.name)) return file;
  try {
    const bitmap = await decode(file);
    const canvas = document.createElement("canvas");
    if (square) {
      const side = Math.min(bitmap.width, bitmap.height);
      const out = Math.min(AVATAR_SIDE, side);
      canvas.width = canvas.height = out;
      canvas.getContext("2d")!.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, out, out);
    } else {
      const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
      // Small, already web-friendly images are kept as they are.
      if (scale === 1 && file.size < 1_500_000 && /image\/(jpeg|png|webp)/.test(file.type)) return file;
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    }
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", QUALITY));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg", lastModified: file.lastModified });
  } catch {
    return file;
  }
}

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // fall through to <img>, which Safari can use for HEIC
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}
