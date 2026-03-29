import type { TelegramUpdate } from "../schemas";
import { TelegramUpdateSchema } from "../schemas";
import { log as rootLog } from "../lib/logger";
import { handleCommand } from "./commands";
import { handleMessage } from "./message";
import { sendMessage } from "./telegram";

const log = rootLog.child({ module: "[bot]" });

export function startServer() {
  return Bun.serve({
    port: Number(process.env.PORT ?? 3000),
    async fetch(req) {
      if (req.method !== "POST") return new Response("ok");

      const result = TelegramUpdateSchema.safeParse(await req.json());
      if (!result.success) return new Response("ok"); // silently ignore malformed updates

      handleUpdate(result.data).catch((err) =>
        log.error("unhandled error in handleUpdate", err, {
          chatId: result.data.message?.chat?.id,
        })
      ); // async — always return 200 fast
      return new Response("ok");
    },
  });
}

async function handleUpdate(update: TelegramUpdate): Promise<void> {
  const message = update.message;
  if (!message?.text) return; // ignore stickers, photos, etc.

  const { chat, text } = message;
  const reqLog = log.child({ chatId: chat.id });

  if (chat.id !== Number(process.env.OWNER_CHAT_ID)) {
    reqLog.warn("unauthorized access attempt");
    await sendMessage(chat.id, "This is a personal bot and you're not authorized to use it.\n\nWant your own? Deploy it yourself: https://github.com/amarangganar/pixance");
    return;
  }

  if (text.startsWith("/")) {
    await handleCommand(chat.id, text, reqLog);
  } else {
    await handleMessage(chat.id, text, reqLog);
  }
}
