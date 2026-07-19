import { randomUUID } from "crypto";
import sharp from "sharp";
import { createAdminClient } from "@/lib/supabase/server";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 2 * 1024 * 1024;

export const MEDIA_NAMESPACES = {
  banners: { bucket: "banners", recommendedWidth: 728, recommendedHeight: 90, public: true },
  products: { bucket: "products", recommendedWidth: null, recommendedHeight: null, public: true },
  payments: { bucket: "payments", recommendedWidth: null, recommendedHeight: null, public: false },
  // Brand assets (logos, favicons, category icons). Reuses the public banners bucket —
  // paths are prefixed "branding/" so no new storage bucket/policy is needed.
  branding: { bucket: "banners", recommendedWidth: null, recommendedHeight: null, public: true },
} as const;

export type MediaNamespace = keyof typeof MEDIA_NAMESPACES;

export interface ValidationResult {
  valid: boolean;
  error?: string;
  dimensionWarning?: string;
  width?: number;
  height?: number;
}

export async function validateFile(
  file: Buffer,
  mimeType: string,
  namespace: MediaNamespace
): Promise<ValidationResult> {
  if (!ALLOWED_TYPES.includes(mimeType)) {
    return { valid: false, error: `Unsupported file type: ${mimeType}. Allowed: PNG, JPG, JPEG, WEBP.` };
  }
  if (file.byteLength > MAX_BYTES) {
    return { valid: false, error: "File exceeds the 2MB maximum size." };
  }

  const metadata = await sharp(file).metadata();
  const { width, height } = metadata;
  const config = MEDIA_NAMESPACES[namespace];

  let dimensionWarning: string | undefined;
  if (config.recommendedWidth && config.recommendedHeight && width && height) {
    if (width !== config.recommendedWidth || height !== config.recommendedHeight) {
      dimensionWarning = `Recommended size is ${config.recommendedWidth}x${config.recommendedHeight}, uploaded image is ${width}x${height}.`;
    }
  }

  return { valid: true, dimensionWarning, width, height };
}

export interface UploadResult {
  path: string;
  publicUrl: string | null;
}

function extensionForMimeType(mimeType: string): string {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

export async function uploadMedia(
  file: Buffer,
  mimeType: string,
  namespace: MediaNamespace
): Promise<UploadResult> {
  const config = MEDIA_NAMESPACES[namespace];
  const path = `${namespace}/${randomUUID()}-${Date.now()}.${extensionForMimeType(mimeType)}`;

  const supabase = await createAdminClient();
  const { error } = await supabase.storage.from(config.bucket).upload(path, file, {
    contentType: mimeType,
    upsert: false,
  });
  if (error) throw new Error(`Upload failed: ${error.message}`);

  if (!config.public) {
    return { path, publicUrl: null };
  }

  const { data } = supabase.storage.from(config.bucket).getPublicUrl(path);
  return { path, publicUrl: data.publicUrl };
}

export async function deleteMedia(path: string, namespace: MediaNamespace): Promise<void> {
  const config = MEDIA_NAMESPACES[namespace];
  const supabase = await createAdminClient();
  await supabase.storage.from(config.bucket).remove([path]);
}

export async function replaceMedia(
  newFile: Buffer,
  newMimeType: string,
  namespace: MediaNamespace,
  oldPath: string | null
): Promise<UploadResult> {
  const result = await uploadMedia(newFile, newMimeType, namespace);
  if (oldPath) {
    await deleteMedia(oldPath, namespace);
  }
  return result;
}

export async function getSignedMediaUrl(
  path: string,
  namespace: MediaNamespace,
  expiresInSeconds = 3600
): Promise<string> {
  const config = MEDIA_NAMESPACES[namespace];
  const supabase = await createAdminClient();
  const { data, error } = await supabase.storage
    .from(config.bucket)
    .createSignedUrl(path, expiresInSeconds);
  if (error || !data) {
    throw new Error(`Failed to create signed URL: ${error?.message ?? "unknown error"}`);
  }
  return data.signedUrl;
}
