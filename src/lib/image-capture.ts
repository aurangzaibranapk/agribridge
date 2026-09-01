/**
 * Maidan se aayi tasveer ko chhota karna (browser mein).
 *
 * Phone ka camera 4-5 MB ki tasveer banata hai. Gaon mein network dhima
 * hota hai, aur offline mode mein yehi tasveerein device par jama rehti
 * hain -- poore din ki 40 tasveerein asal naap mein rakhein to device ki
 * jagah bhar jati hai aur sync kabhi mukammal nahi hota.
 *
 * LR ki parchi parhne ke liye 1280px kaafi se zyada hai. Asal tasveer se
 * behtar rahna hamara maqsad nahi -- parhi jane wali tasveer chahiye,
 * chhapne wali nahi.
 */

const MAX_SIDE = 1280;
const QUALITY = 0.7;

export interface CapturedImage {
  /** base64, "data:" wale hisse ke baghair. */
  base64: string;
  mimeType: string;
  /** Chhota karne ke baad ka naap (bytes) -- user ko dikhane ke liye. */
  bytes: number;
}

export async function shrinkImage(file: File): Promise<CapturedImage> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Tasveer parhi nahi ja saki."));
    reader.readAsDataURL(file);
  });

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Tasveer kholi nahi ja saki."));
    img.src = dataUrl;
  });

  const scale = Math.min(1, MAX_SIDE / Math.max(image.width, image.height));
  const width = Math.round(image.width * scale);
  const height = Math.round(image.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  // Canvas na mile to asal tasveer hi bhej dete hain. Bari tasveer
  // bhejna dhima hai, magar entry ka saboot kho dena us se bura.
  if (!ctx) {
    const raw = dataUrl.split(",")[1] ?? "";
    return { base64: raw, mimeType: file.type || "image/jpeg", bytes: file.size };
  }

  ctx.drawImage(image, 0, 0, width, height);
  const shrunk = canvas.toDataURL("image/jpeg", QUALITY);
  const base64 = shrunk.split(",")[1] ?? "";

  return {
    base64,
    mimeType: "image/jpeg",
    bytes: Math.round((base64.length * 3) / 4),
  };
}
