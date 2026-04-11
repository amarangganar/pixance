// Thin typed wrapper around the Telegram Bot API. Plain fetch, no library.
// Non-2xx responses are logged and thrown — callers handle user-facing errors.

import { log as rootLog } from "../lib/logger";

const log = rootLog.child({ module: "[telegram]" });

async function apiCall<T>(method: string, body: Record<string, unknown>): Promise<T> {
  const url = `https://api.telegram.org/bot${process.env.BOT_TOKEN}/${method}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    log.error("API call failed", new Error(text), { method, status: res.status });
    throw new Error(`Telegram API error: ${method} → ${res.status}`);
  }

  const data = (await res.json()) as { ok: boolean; result: T };
  return data.result;
}

export async function sendMessage(
  chatId: number,
  text: string,
  options?: { parse_mode?: "Markdown" | "MarkdownV2" | "HTML" }
): Promise<{ message_id: number }> {
  return apiCall("sendMessage", { chat_id: chatId, text, ...options });
}

export async function deleteMessage(chatId: number, messageId: number): Promise<void> {
  await apiCall("deleteMessage", { chat_id: chatId, message_id: messageId });
}

export async function sendChatAction(chatId: number, action: "typing"): Promise<void> {
  await apiCall("sendChatAction", { chat_id: chatId, action });
}

export async function setWebhook(url: string): Promise<void> {
  await apiCall("setWebhook", { url });
}

export async function setMyCommands(): Promise<void> {
  await apiCall("setMyCommands", {
    commands: [
      { command: "start", description: "Show help and active pockets" },
      { command: "report", description: "Monthly financial summary" },
      { command: "history", description: "Last 10 transactions" },
      { command: "pockets", description: "List active pockets" },
      { command: "addpocket", description: "Create a new pocket" },
      { command: "renamepocket", description: "Rename a pocket" },
      { command: "archivepocket", description: "Archive a pocket" },
      { command: "restorepocket", description: "Restore an archived pocket" },
      { command: "delete", description: "Delete a recent transaction" },
    ],
  });
}
