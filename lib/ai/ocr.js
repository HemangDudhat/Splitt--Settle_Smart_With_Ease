/**
 * lib/ai/ocr.js
 * Client-side helper to convert a File → base64 and call the /api/scan-receipt route.
 */

/**
 * Converts a File/Blob to a base64 string (data portion only, no prefix).
 * @param {File} file
 * @returns {Promise<string>}
 */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // result is "data:<mimeType>;base64,<data>" — strip the prefix
      const base64 = reader.result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Scans a receipt image and returns extracted data.
 *
 * @param {File} file - The image file to scan
 * @returns {Promise<{
 *   storeName: string | null,
 *   date: string | null,
 *   totalAmount: number | null,
 *   suggestedCategory: string | null
 * }>}
 * @throws {Error} If image is blurry or unreadable (message: "blur")
 * @throws {Error} If network/API error occurs
 */
export async function scanReceipt(file) {
  if (!file) throw new Error("No file provided");

  const imageBase64 = await fileToBase64(file);
  const mimeType = file.type || "image/jpeg";

  const response = await fetch("/api/scan-receipt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageBase64, mimeType }),
  });

  if (!response.ok) {
    throw new Error("Failed to reach the scan service. Please try again.");
  }

  const data = await response.json();

  if (data.error === "blur") {
    throw new Error("blur");
  }

  if (data.error) {
    throw new Error(data.error);
  }

  return {
    storeName: data.storeName || null,
    date: data.date || null,
    totalAmount: typeof data.totalAmount === "number" ? data.totalAmount : null,
    suggestedCategory: data.suggestedCategory || null,
  };
}
