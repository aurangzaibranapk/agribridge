"use server";

import { generateGeminiText } from "@/lib/ai/gemini-text-client";
import { loadOwnName, loadPublicFacts } from "@/lib/chat/load-public-facts";
import {
  answerFromFacts,
  buildAssistantSystem,
  buildAssistantUser,
  isPrivateQuestion,
  wantsOwnName,
  type ChatReply,
} from "@/lib/chat/public-knowledge";
import { detectChatLanguage, type ChatLang } from "@/lib/chat/language";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export type ChatbotAnswer = ChatReply;

/**
 * Website ka AgriBridge Assistant.
 * Zaban visitor ke jumle se. Ilm sirf public safhon aur unhi tables se
 * jo site pehle se dikhati hai. Service role se khata nahi khola jata.
 */
export async function askChatbot(question: string, siteLang?: ChatLang): Promise<ChatReply> {
  const site = siteLang ?? getLanguageFromCookies("en");
  const trimmed = question.trim();
  const facts = await loadPublicFacts();
  const personal = wantsOwnName(trimmed) && !isPrivateQuestion(trimmed) ? await loadOwnName() : null;
  const local = answerFromFacts(trimmed, site, facts, null, personal);
  const known = !trimmed || isPrivateQuestion(trimmed) || wantsOwnName(trimmed) || local.source !== "fallback";
  if (known) return local;

  const lang = detectChatLanguage(trimmed, site);
  const ai = await generateGeminiText(
    buildAssistantUser(trimmed),
    "public-chat",
    buildAssistantSystem({ lang, facts, ownName: null }),
  );
  return answerFromFacts(trimmed, site, facts, ai, null);
}
