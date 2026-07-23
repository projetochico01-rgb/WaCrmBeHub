import type { SupabaseClient } from "@supabase/supabase-js";
import { decrypt } from "@/lib/whatsapp/encryption";
import { sanitizePhoneForMeta, isValidE164 } from "@/lib/whatsapp/phone-utils";
import { sendEvolutionInteractive, sendEvolutionMedia, sendEvolutionText } from "./client";
import { interactivePayloadPreviewText } from "@/lib/whatsapp/interactive";
import { SendMessageError, type SendMessageParams, type SendMessageResult } from "@/lib/whatsapp/send-message";

export async function hasEvolutionConfig(db: SupabaseClient, accountId: string) {
  const { data } = await db.from("evolution_config").select("id").eq("account_id", accountId).eq("enabled", true).maybeSingle();
  return Boolean(data);
}

export async function sendEvolutionMessageToConversation(
  db: SupabaseClient,
  accountId: string,
  params: SendMessageParams,
): Promise<SendMessageResult> {
  const { data: conversation } = await db
    .from("conversations")
    .select("*, contact:contacts(*)")
    .eq("id", params.conversationId)
    .eq("account_id", accountId)
    .single();
  if (!conversation?.contact?.phone) throw new SendMessageError("not_found", "Conversa ou telefone não encontrado", 404);

  const number = sanitizePhoneForMeta(conversation.contact.phone);
  if (!isValidE164(number)) throw new SendMessageError("bad_request", "Telefone inválido", 400);
  const allowed = (process.env.BEHUB_ALLOWED_TEST_PHONE || "5547988976484").replace(/\D/g, "");
  if (process.env.BEHUB_TEST_MODE !== "false" && number !== allowed) {
    throw new SendMessageError("test_mode", "Modo de teste: envio permitido somente para o número autorizado", 403);
  }

  const { data: row } = await db.from("evolution_config").select("*").eq("account_id", accountId).eq("enabled", true).single();
  if (!row) throw new SendMessageError("whatsapp_not_configured", "Evolution API não configurada", 400);

  let quotedId: string | undefined;
  if (params.replyToMessageId) {
    const { data: quoted } = await db.from("messages").select("message_id").eq("id", params.replyToMessageId).eq("conversation_id", params.conversationId).maybeSingle();
    quotedId = quoted?.message_id || undefined;
  }

  const credentials = {
    baseUrl: row.api_url,
    apiKey: decrypt(row.encrypted_api_key),
    instance: row.instance_name,
  };

  let externalId: string;
  try {
    if (params.messageType === "text") {
      externalId = await sendEvolutionText(credentials, number, params.contentText || "", quotedId);
    } else if (params.messageType === "interactive" && params.interactivePayload) {
      externalId = await sendEvolutionInteractive(credentials, { number, payload: params.interactivePayload, quotedId });
    } else if (["image", "video", "document", "audio"].includes(params.messageType)) {
      externalId = await sendEvolutionMedia(credentials, {
        number,
        type: params.messageType as "image" | "video" | "document" | "audio",
        media: params.mediaUrl || "",
        caption: params.contentText || undefined,
        filename: params.filename || undefined,
      });
    } else {
      throw new SendMessageError("unsupported", "Este tipo de mensagem ainda não é compatível com a Evolution", 400);
    }
  } catch (error) {
    if (error instanceof SendMessageError) throw error;
    throw new SendMessageError("evolution_error", `Evolution API: ${error instanceof Error ? error.message : "falha no envio"}`, 502);
  }

  const { data: saved, error: saveError } = await db.from("messages").insert({
    conversation_id: params.conversationId,
    sender_type: "agent",
    content_type: params.messageType,
    content_text: params.contentText || null,
    media_url: params.mediaUrl || null,
    interactive_payload: params.interactivePayload || null,
    message_id: externalId,
    external_message_id: externalId,
    provider: "evolution",
    provider_instance: row.instance_name,
    sent_by_type: params.sentByType || "human",
    ai_generated: params.sentByType === "diana",
    status: "sent",
    reply_to_message_id: params.replyToMessageId || null,
  }).select("id").single();
  if (saveError || !saved) throw new SendMessageError("db_error", "Mensagem enviada, mas não foi salva no CRM", 500);

  await db.from("conversations").update({
    last_message_text: params.interactivePayload ? interactivePayloadPreviewText(params.interactivePayload) : params.contentText || `[${params.messageType}]`,
    last_message_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...(params.sentByType === "diana" && params.scheduleCadence !== false
      ? { cadence_step: 0, cadence_due_at: new Date(Date.now() + 15 * 60_000).toISOString(), cadence_completed_at: null }
      : params.sentByType === "human"
        ? { cadence_due_at: null, cadence_completed_at: new Date().toISOString() }
        : {}),
  }).eq("id", params.conversationId);

  return { messageId: saved.id, whatsappMessageId: externalId };
}
