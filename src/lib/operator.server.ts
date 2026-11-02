import { createHash } from "node:crypto";
import type { OperatorMedicine } from "./operator-model";

export const hashCapability = (secret: string) => createHash("sha256").update(secret).digest("hex");
async function telegram(token: string, method: string, body: Record<string, unknown> | FormData) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: "POST", ...(body instanceof FormData ? { body } : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }) });
  if (!response.ok) { const detail = await response.text(); console.error("Telegram", response.status, detail); throw new Error("Telegram xabarni qabul qilmadi"); }
  const result = await response.json() as { ok: boolean; result?: { message_id: number }; description?: string };
  if (!result.ok) { console.error("Telegram", result.description); throw new Error("Telegram xabarni qabul qilmadi"); }
  return result.result;
}
export async function createOperatorRequest(image: string, note: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) throw new Error("Operator bilan aloqa hozir mavjud emas");
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const id = crypto.randomUUID();
  const secret = `${crypto.randomUUID()}${crypto.randomUUID()}`;
  const { error } = await db.from("operator_requests").insert({ id, secret_hash: hashCapability(secret), chat_id: Number(chatId) });
  if (error) throw new Error("So‘rov saqlanmadi");
  try {
    const [meta, encoded] = image.split(",");
    const bytes = Uint8Array.from(atob(encoded ?? ""), c => c.charCodeAt(0));
    const form = new FormData();
    form.set("chat_id", chatId);
    form.set("caption", `📋 Mijoz retsepti #${id.slice(0, 8)}${note ? `\n${note}` : ""}`.slice(0, 1024));
    form.set("photo", new Blob([bytes], { type: /data:(.*?);/.exec(meta ?? "")?.[1] || "image/jpeg" }), "retsept.jpg");
    form.set("reply_markup", JSON.stringify({ inline_keyboard: [[{ text: "Buyurtmani qabul qilish", callback_data: `op:claim:${id}` }]] }));
    const message = await telegram(token, "sendPhoto", form);
    const { error: updateError } = await db.from("operator_requests").update({ message_id: message?.message_id }).eq("id", id);
    if (updateError) throw new Error("So‘rov bog‘lanmadi");
    return { id, secret };
  } catch (error) {
    await db.from("operator_requests").delete().eq("id", id);
    throw error;
  }
}
function keyboard(id: string, preview: boolean) {
  const button = (text: string, action: string) => ({ text, callback_data: `op:${action}:${id}` });
  return { inline_keyboard: [
    [button("Dorilarni qo‘shish", "add"), button("Shular holos", "preview")],
    [button("Yana dori qo‘shish", "add"), button("Dorini o‘chirish", "remove")],
    [button("↶ Orqaga qaytarish", "undo")],
    ...(preview ? [[button("Jo‘natish", "send")]] : []),
  ] };
}
export async function handleOperatorUpdate(update: any, token: string): Promise<boolean> {
  const cb = update.callback_query;
  const match = /^op:(claim|add|preview|remove|undo|send):([0-9a-f-]{36})$/.exec(cb?.data ?? "");
  const message = update.message;
  if (!match && !message?.reply_to_message?.message_id) return false;
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  let row;
  if (match) {
    const result = await db.from("operator_requests").select("*").eq("id", match[2]).maybeSingle();
    row = result.data;
  } else {
    const result = await db.from("operator_requests").select("*").eq("chat_id", message.chat.id).eq("prompt_id", message.reply_to_message.message_id).maybeSingle();
    row = result.data;
  }
  if (!row) return !!match;
  const chatId = cb?.message?.chat?.id ?? message?.chat?.id;
  const operatorId = cb?.from?.id ?? message?.from?.id;
  if (String(chatId) !== String(row.chat_id) || String(row.chat_id) !== String(process.env.TELEGRAM_CHAT_ID) || !Number.isSafeInteger(operatorId)) return true;
  const action = async (name: string, value: any = null) => {
    const { data, error } = await db.rpc("operator_request_action", { p_id: row.id, p_operator: operatorId, p_action: name, p_value: value, p_update: update.update_id });
    if (error) throw new Error(error.message.includes("claimed") ? "Bu retseptni boshqa operator qabul qilgan" : "Amal bajarilmadi; raqamni tekshiring");
    return data as unknown as typeof row;
  };
  try {
    if (row.status === "sent") {
      if (cb) await telegram(token, "answerCallbackQuery", { callback_query_id: cb.id, text: "Ro‘yxat allaqachon yuborilgan" });
      return true;
    }
    if (match) {
      row = await action(match[1]);
      await telegram(token, "answerCallbackQuery", { callback_query_id: cb.id, text: match[1] === "send" ? "Ro‘yxat mijozga yuborildi" : "Qabul qilindi" });
    } else {
      if (row.operator_id !== operatorId) return true;
      const text = String(message.text ?? "").trim().slice(0, 500);
      if (row.step === "choose" || row.step === "remove") {
        if (!/^\d{1,3}$/.test(text)) throw new Error("Dori raqamini yuboring");
        row = await action(row.step === "remove" ? "delete" : "pick", Number(text));
      } else if (row.step === "search") {
        const { lookupMedicines, extractCandidateNames } = await import("./ai-search.functions");
        const { found } = await lookupMedicines(extractCandidateNames(text));
        if (!found.length) throw new Error("Dori topilmadi; nomini qayta yuboring");
        row = await action("candidates", found.slice(0, 40));
      } else return true;
    }
    if (!row) return true;
    const selected = row.selected as unknown as OperatorMedicine[];
    const candidates = row.candidates as unknown as OperatorMedicine[];
    const lines = (meds: OperatorMedicine[]) => meds.map((m, i) => `${i + 1}. ${m.name} — ${Number(m.price).toLocaleString("uz-UZ")} so‘m`).join("\n");
    if (["search", "choose", "remove"].includes(row.step)) {
      const text = row.step === "search" ? "Dori nomini yuboring." : row.step === "choose" ? `${lines(candidates)}\n\nDori raqamini yuboring.` : `${lines(selected)}\n\nO‘chiriladigan dori raqamini yuboring.`;
      const prompt = await telegram(token, "sendMessage", { chat_id: chatId, reply_to_message_id: row.message_id, text: `Retsept #${row.id.slice(0, 8)}\n${text}`.slice(0, 4096), reply_markup: { force_reply: true, selective: false } });
      await db.from("operator_requests").update({ prompt_id: prompt?.message_id }).eq("id", row.id);
    } else {
      await telegram(token, "sendMessage", { chat_id: chatId, reply_to_message_id: row.message_id, text: `${row.status === "sent" ? "✅ Mijozga yuborildi" : "Siz bergan retsept"} #${row.id.slice(0, 8)}\n${lines(selected) || "Dorilar hali qo‘shilmagan"}`.slice(0, 4096), ...(row.status === "sent" ? {} : { reply_markup: keyboard(row.id, row.step === "preview") }) });
    }
  } catch (error) {
    const text = error instanceof Error ? error.message : "Amal bajarilmadi";
    if (cb) await telegram(token, "answerCallbackQuery", { callback_query_id: cb.id, text }).catch(() => undefined);
    else await telegram(token, "sendMessage", { chat_id: chatId, text, reply_to_message_id: message.message_id });
  }
  return true;
}