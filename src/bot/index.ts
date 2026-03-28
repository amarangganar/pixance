import type { TelegramUpdate } from "../schemas";
import { TelegramUpdateSchema } from "../schemas";
import { handleCommand } from "./commands";
import { handleMessage } from "./message";

export function startServer() {
  return Bun.serve({
    port: Number(process.env.PORT ?? 3000),
    async fetch(req) {
      if (req.method !== "POST") return new Response("ok");

      const result = TelegramUpdateSchema.safeParse(await req.json());
      if (!result.success) return new Response("ok"); // silently ignore malformed updates

      handleUpdate(result.data).catch(console.error); // async — always return 200 fast
      return new Response("ok");
    },
  });
}

async function handleUpdate(update: TelegramUpdate): Promise<void> {
  const message = update.message;
  if (!message?.text) return; // ignore stickers, photos, etc.

  const { chat, text } = message;

  if (text.startsWith("/")) {
    await handleCommand(chat.id, text);
  } else {
    await handleMessage(chat.id, text);
  }
}
