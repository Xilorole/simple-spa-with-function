import type { Message } from "../components/MessageBubble";
import type { AoaiSettings } from "./useAoaiSettings";

/**
 * Build the JSON body for chat API requests,
 * including optional client-side AOAI settings.
 */
export function buildChatBody(
  messages: Message[],
  settings?: AoaiSettings
): string {
  const body: Record<string, unknown> = { messages };
  if (settings && settings.endpoint && settings.apiKey) {
    body.aoai_settings = {
      endpoint: settings.endpoint,
      apiKey: settings.apiKey,
      deployment: settings.deployment || undefined,
      apiVersion: settings.apiVersion || undefined,
    };
  }
  return JSON.stringify(body);
}

/**
 * Common error handling for fetch responses.
 */
export async function handleFetchError(res: Response): Promise<never> {
  if (res.status === 401 || res.status === 302) {
    window.location.href = "/.auth/login/aad";
    throw new Error("認証が必要です");
  }
  const text = await res.text();
  let errorMsg = `API error (${res.status})`;
  try {
    errorMsg = JSON.parse(text).error || errorMsg;
  } catch {
    errorMsg = text || errorMsg;
  }
  throw new Error(errorMsg);
}
