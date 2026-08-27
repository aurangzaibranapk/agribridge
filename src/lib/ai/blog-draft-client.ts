// Gemini-powered blog draft generation. Takes a topic and returns a
// draft title, excerpt, and content for the AgriBridge blog - written
// for a Pakistani agriculture audience, in a helpful/informative tone.
import { generateGeminiText } from "@/lib/ai/gemini-text-client";

export interface GeneratedBlogDraft {
  title?: string;
  excerpt?: string;
  content?: string;
}

export async function generateBlogDraft(topic: string): Promise<GeneratedBlogDraft | null> {
  const prompt = `You are a content writer for AgriBridge, an agriculture platform in Pakistan run by Al Rana Traders. Write a blog post draft about this topic: "${topic}"

Respond with ONLY a JSON object with these exact keys:
- title: a catchy, clear blog post title (under 70 characters)
- excerpt: a 1-2 sentence summary/teaser for the post
- content: the full blog post body, 4-6 paragraphs, practical and helpful for farmers in Pakistan, plain English, no markdown formatting

Do not include any text outside the JSON object.`;

  const result = await generateGeminiText(prompt);
  if (!result) return null;

  try {
    const cleaned = result.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return parsed as GeneratedBlogDraft;
  } catch (err) {
    console.error("Failed to parse blog draft:", err);
    return null;
  }
}