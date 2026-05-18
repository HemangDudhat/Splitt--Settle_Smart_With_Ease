import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function POST(request) {
  try {
    const { imageBase64, mimeType } = await request.json();

    if (!imageBase64 || !mimeType) {
      return Response.json({ error: "Missing image data" }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `You are a receipt data extractor. Carefully analyze this receipt image and respond ONLY with valid JSON — no markdown, no explanation, no code blocks.

If the image is blurry, low-quality, unreadable, or is NOT a receipt (e.g., a selfie, random photo), respond with exactly:
{"error": "blur"}

Otherwise, extract the following and respond with exactly this JSON structure:
{
  "storeName": "the merchant or store name as shown on the receipt",
  "date": "YYYY-MM-DD format of the transaction date, or null if not found",
  "totalAmount": the final total as a number (no currency symbol, just the number), or null if not found,
  "suggestedCategory": "one of these exact values: foodDrink, coffee, groceries, shopping, travel, transportation, housing, entertainment, tickets, utilities, health, education, bills, other"
}

Important rules:
- Use the FINAL total amount (after tax, after discounts)
- suggestedCategory must be one of the exact values listed above
- If you cannot confidently read any field, use null for that field
- If the image is clearly not a receipt, always return {"error": "blur"}`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType,
          data: imageBase64,
        },
      },
    ]);

    const text = result.response.text().trim();

    // Strip markdown code fences if present
    const cleaned = text.replace(/^```json\s*/i, "").replace(/\s*```$/, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // If we can't parse the response, treat as blur/error
      return Response.json({ error: "blur" });
    }

    return Response.json(parsed);
  } catch (error) {
    console.error("Receipt scan error:", error);
    return Response.json(
      { error: "Failed to process receipt. Please try again." },
      { status: 500 }
    );
  }
}
