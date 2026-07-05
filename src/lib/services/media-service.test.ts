const mockUpload = jest.fn();
const mockRemove = jest.fn();
const mockGetPublicUrl = jest.fn();
const mockFrom = jest.fn(() => ({
  upload: mockUpload,
  remove: mockRemove,
  getPublicUrl: mockGetPublicUrl,
}));

jest.mock("@/lib/supabase/server", () => ({
  createAdminClient: async () => ({ storage: { from: mockFrom } }),
}));

import {
  validateFile,
  uploadMedia,
  deleteMedia,
  replaceMedia,
} from "@/lib/services/media-service";

// A real 1x1 transparent PNG, used to exercise sharp's actual dimension detection.
const ONE_BY_ONE_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);

describe("validateFile", () => {
  it("rejects an unsupported file type", async () => {
    const result = await validateFile(ONE_BY_ONE_PNG, "application/pdf", "banners");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/unsupported/i);
  });

  it("rejects a file over 2MB", async () => {
    const oversized = Buffer.alloc(2 * 1024 * 1024 + 1);
    const result = await validateFile(oversized, "image/png", "banners");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/2MB/i);
  });

  it("accepts a valid small PNG and reports its real dimensions", async () => {
    const result = await validateFile(ONE_BY_ONE_PNG, "image/png", "banners");
    expect(result.valid).toBe(true);
    expect(result.width).toBe(1);
    expect(result.height).toBe(1);
  });

  it("warns (but does not reject) when dimensions differ from the namespace recommendation", async () => {
    const result = await validateFile(ONE_BY_ONE_PNG, "image/png", "banners");
    expect(result.valid).toBe(true);
    expect(result.dimensionWarning).toMatch(/728x90/);
  });

  it("does not warn for namespaces with no recommended dimensions", async () => {
    const result = await validateFile(ONE_BY_ONE_PNG, "image/png", "products");
    expect(result.valid).toBe(true);
    expect(result.dimensionWarning).toBeUndefined();
  });
});

describe("uploadMedia", () => {
  afterEach(() => jest.clearAllMocks());

  it("uploads to the namespace's configured bucket and returns the public URL", async () => {
    mockUpload.mockResolvedValue({ error: null });
    mockGetPublicUrl.mockReturnValue({ data: { publicUrl: "https://example.com/banners/x.png" } });

    const result = await uploadMedia(ONE_BY_ONE_PNG, "image/png", "banners");

    expect(mockFrom).toHaveBeenCalledWith("banners");
    expect(result.publicUrl).toBe("https://example.com/banners/x.png");
    expect(result.path).toMatch(/^banners\/.+\.png$/);
  });

  it("throws when the storage upload fails", async () => {
    mockUpload.mockResolvedValue({ error: { message: "quota exceeded" } });

    await expect(uploadMedia(ONE_BY_ONE_PNG, "image/png", "banners")).rejects.toThrow(
      /quota exceeded/
    );
  });
});

describe("deleteMedia", () => {
  afterEach(() => jest.clearAllMocks());

  it("removes the given path from the namespace's bucket", async () => {
    mockRemove.mockResolvedValue({ error: null });

    await deleteMedia("banners/old.png", "banners");

    expect(mockFrom).toHaveBeenCalledWith("banners");
    expect(mockRemove).toHaveBeenCalledWith(["banners/old.png"]);
  });
});

describe("replaceMedia", () => {
  afterEach(() => jest.clearAllMocks());

  it("uploads the new file and deletes the old one afterward", async () => {
    mockUpload.mockResolvedValue({ error: null });
    mockGetPublicUrl.mockReturnValue({ data: { publicUrl: "https://example.com/banners/new.png" } });
    mockRemove.mockResolvedValue({ error: null });

    const result = await replaceMedia(ONE_BY_ONE_PNG, "image/png", "banners", "banners/old.png");

    expect(result.publicUrl).toBe("https://example.com/banners/new.png");
    expect(mockRemove).toHaveBeenCalledWith(["banners/old.png"]);
  });

  it("skips deletion when there is no old path", async () => {
    mockUpload.mockResolvedValue({ error: null });
    mockGetPublicUrl.mockReturnValue({ data: { publicUrl: "https://example.com/banners/new.png" } });

    await replaceMedia(ONE_BY_ONE_PNG, "image/png", "banners", null);

    expect(mockRemove).not.toHaveBeenCalled();
  });
});
