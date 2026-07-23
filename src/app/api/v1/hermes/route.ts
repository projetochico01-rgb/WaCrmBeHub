import { requireApiKey } from "@/lib/auth/api-context";
import { ok, fail, toApiErrorResponse } from "@/lib/api/v1/respond";
import { findExistingContact } from "@/lib/contacts/dedupe";
import { sanitizePhoneForMeta } from "@/lib/whatsapp/phone-utils";
import { sendEvolutionMessageToConversation } from "@/lib/evolution/send-message";
import { isBehubCommercialTime, nextBehubCommercialTime } from "@/lib/behub/business-hours";

const STAGES = [
  "Novo lead", "Em atendimento", "Aguardando atendimento humano",
  "Qualificado", "Não qualificado", "Fechado", "Perdido",
] as const;

type Body = Record<string, unknown>;
const str = (value: unknown) => typeof value === "string" ? value.trim() : "";

export async function POST(request: Request) {
  try {
    const ctx = await requireApiKey(request, "hermes:operate");
    const body = await request.json().catch(() => null) as Body | null;
    if (!body) return fail("bad_request", "Corpo JSON obrigatório", 400);
    const action = str(body.action);

    if (action === "listar_followups_pendentes") {
      const now = new Date();
      const { data, error } = await ctx.supabase
        .from("conversations")
        .select("id,contact_id,cadence_step,cadence_due_at,cadence_last_inbound_at,contact:contacts(id,name,phone)")
        .eq("account_id", ctx.accountId)
        .eq("automation_contact_allowed", true)
        .eq("human_handoff", false)
        .is("do_not_contact_at", null)
        .is("cadence_completed_at", null)
        .not("cadence_due_at", "is", null)
        .lte("cadence_due_at", now.toISOString())
        .order("cadence_due_at", { ascending: true })
        .limit(50);
      if (error) return fail("internal", "Não foi possível consultar os follow-ups", 500);
      const allowedNow = isBehubCommercialTime(now);
      return ok({
        allowed_now: allowedNow,
        next_allowed_at: allowedNow ? now.toISOString() : nextBehubCommercialTime(now).toISOString(),
        followups: data ?? [],
      });
    }

    if (action === "buscar_lead") {
      const phone = sanitizePhoneForMeta(str(body.phone));
      const contactId = str(body.contact_id);
      const contact = contactId
        ? (await ctx.supabase.from("contacts").select("*").eq("account_id", ctx.accountId).eq("id", contactId).maybeSingle()).data
        : phone ? await findExistingContact(ctx.supabase, ctx.accountId, phone) : null;
      if (!contact) return fail("not_found", "Lead não encontrado", 404);
      const [conversation, deal, observations] = await Promise.all([
        ctx.supabase.from("conversations").select("*").eq("account_id", ctx.accountId).eq("contact_id", contact.id).maybeSingle(),
        ctx.supabase.from("deals").select("*,stage:pipeline_stages(name,color,position)").eq("account_id", ctx.accountId).eq("contact_id", contact.id).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
        ctx.supabase.from("lead_observations").select("id,author_type,observation_type,content,metadata,created_at").eq("account_id", ctx.accountId).eq("contact_id", contact.id).order("created_at", { ascending: false }).limit(50),
      ]);
      return ok({ contact, conversation: conversation.data, deal: deal.data, observations: observations.data || [] });
    }

    const contactId = str(body.contact_id);
    if (!contactId) return fail("bad_request", "contact_id é obrigatório", 400);
    const { data: contact } = await ctx.supabase.from("contacts").select("id,name,phone").eq("account_id", ctx.accountId).eq("id", contactId).maybeSingle();
    if (!contact) return fail("not_found", "Lead não encontrado", 404);

    if (action === "registrar_observacao") {
      const content = str(body.content);
      if (!content) return fail("bad_request", "content é obrigatório", 400);
      const { data, error } = await ctx.supabase.from("lead_observations").insert({
        account_id: ctx.accountId, contact_id: contact.id,
        deal_id: str(body.deal_id) || null, conversation_id: str(body.conversation_id) || null,
        author_type: "diana", observation_type: str(body.observation_type) || "note",
        content, metadata: body.metadata && typeof body.metadata === "object" ? body.metadata : {},
      }).select("id,created_at").single();
      if (error) return fail("internal", "Não foi possível registrar a observação", 500);
      return ok(data, 201);
    }

    if (action === "atualizar_dados_lead") {
      const allowed: Record<string, unknown> = {};
      for (const key of ["name", "email", "company"] as const) {
        if (typeof body[key] === "string") allowed[key] = str(body[key]) || null;
      }
      if (!Object.keys(allowed).length) return fail("bad_request", "Nenhum campo permitido informado", 400);
      const { data, error } = await ctx.supabase.from("contacts").update(allowed).eq("account_id", ctx.accountId).eq("id", contact.id).select("id,name,email,company,updated_at").single();
      if (error) return fail("internal", "Não foi possível atualizar o lead", 500);
      return ok(data);
    }

    if (action === "solicitar_mudanca_etapa") {
      const stageName = str(body.stage);
      if (!(STAGES as readonly string[]).includes(stageName)) return fail("bad_request", "Etapa comercial inválida", 400);
      const { data: pipelines } = await ctx.supabase.from("pipelines").select("id").eq("account_id", ctx.accountId).order("created_at").limit(1);
      const pipelineId = pipelines?.[0]?.id;
      if (!pipelineId) return fail("not_found", "Funil Comercial BeHub ainda não foi criado", 404);
      const { data: stage } = await ctx.supabase.from("pipeline_stages").select("id").eq("pipeline_id", pipelineId).eq("name", stageName).maybeSingle();
      if (!stage) return fail("not_found", "Etapa não encontrada no funil", 404);
      const { data: account } = await ctx.supabase.from("accounts").select("owner_user_id").eq("id", ctx.accountId).single();
      const { data: existing } = await ctx.supabase.from("deals").select("id").eq("account_id", ctx.accountId).eq("contact_id", contact.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
      const payload = { stage_id: stage.id, pipeline_id: pipelineId, updated_at: new Date().toISOString(), qualification_reason: str(body.reason) || null };
      const result = existing
        ? await ctx.supabase.from("deals").update(payload).eq("id", existing.id).select("id,stage_id,updated_at").single()
        : await ctx.supabase.from("deals").insert({ ...payload, account_id: ctx.accountId, user_id: account?.owner_user_id, contact_id: contact.id, conversation_id: str(body.conversation_id) || null, title: str(body.title) || "Nova oportunidade", currency: "BRL" }).select("id,stage_id,updated_at").single();
      if (result.error) return fail("internal", "Não foi possível mudar a etapa", 500);
      await ctx.supabase.from("lead_observations").insert({ account_id: ctx.accountId, contact_id: contact.id, deal_id: result.data.id, author_type: "diana", observation_type: "stage_change", content: `Etapa alterada para ${stageName}${str(body.reason) ? `: ${str(body.reason)}` : ""}` });
      return ok({ ...result.data, stage: stageName });
    }

    if (action === "enviar_para_fila_humana") {
      const conversationId = str(body.conversation_id);
      if (!conversationId) return fail("bad_request", "conversation_id é obrigatório", 400);
      const now = new Date().toISOString();
      const { data, error } = await ctx.supabase.from("conversations").update({ human_handoff: true, handoff_requested_at: now, handoff_reason: str(body.reason) || "Solicitado pela Diana", queue_entered_at: now, ai_autoreply_disabled: true }).eq("account_id", ctx.accountId).eq("id", conversationId).eq("contact_id", contact.id).select("id,queue_entered_at").single();
      if (error) return fail("internal", "Não foi possível incluir na fila humana", 500);
      await ctx.supabase.from("lead_observations").insert({ account_id: ctx.accountId, contact_id: contact.id, conversation_id: conversationId, author_type: "diana", observation_type: "human_handoff", content: str(body.reason) || "Atendimento encaminhado para a equipe humana" });
      return ok(data);
    }

    if (action === "registrar_optout") {
      const conversationId = str(body.conversation_id);
      const reason = str(body.reason) || "Cliente pediu para não receber mensagens";
      const { data, error } = await ctx.supabase.from("conversations").update({ automation_contact_allowed: false, do_not_contact_at: new Date().toISOString(), do_not_contact_reason: reason, ai_autoreply_disabled: true }).eq("account_id", ctx.accountId).eq("id", conversationId).eq("contact_id", contact.id).select("id,do_not_contact_at").single();
      if (error) return fail("internal", "Não foi possível registrar opt-out", 500);
      await ctx.supabase.from("lead_observations").insert({ account_id: ctx.accountId, contact_id: contact.id, conversation_id: conversationId, author_type: "diana", observation_type: "opt_out", content: reason });
      return ok(data);
    }

    if (action === "enviar_mensagem") {
      const conversationId = str(body.conversation_id);
      const text = str(body.text);
      if (!conversationId || !text) return fail("bad_request", "conversation_id e text são obrigatórios", 400);
      const result = await sendEvolutionMessageToConversation(ctx.supabase, ctx.accountId, { conversationId, messageType: "text", contentText: text, sentByType: "diana" });
      return ok(result, 201);
    }

    if (action === "executar_followup") {
      const conversationId = str(body.conversation_id);
      const text = str(body.text);
      if (!conversationId || !text) return fail("bad_request", "conversation_id e text são obrigatórios", 400);
      const now = new Date();
      if (!isBehubCommercialTime(now)) {
        return fail("outside_business_hours", `Follow-up permitido a partir de ${nextBehubCommercialTime(now).toISOString()}`, 409);
      }
      const { data: conversation } = await ctx.supabase.from("conversations")
        .select("id,cadence_step,cadence_due_at,automation_contact_allowed,do_not_contact_at,human_handoff,cadence_completed_at")
        .eq("account_id", ctx.accountId).eq("id", conversationId).eq("contact_id", contact.id).maybeSingle();
      if (!conversation) return fail("not_found", "Conversa não encontrada", 404);
      if (!conversation.automation_contact_allowed || conversation.do_not_contact_at || conversation.human_handoff || conversation.cadence_completed_at) {
        return fail("cadence_blocked", "A cadência deste lead está bloqueada ou concluída", 409);
      }
      const dueAt = conversation.cadence_due_at ? new Date(conversation.cadence_due_at) : null;
      if (!dueAt || dueAt > now) return fail("not_due", "Este follow-up ainda não está vencido", 409);
      const step = Number(conversation.cadence_step ?? 0);
      if (step < 0 || step > 2) return fail("cadence_complete", "Cadência já concluída", 409);

      const claimUntil = new Date(Date.now() + 10 * 60_000).toISOString();
      const { data: claim } = await ctx.supabase.from("conversations")
        .update({ cadence_due_at: claimUntil })
        .eq("id", conversation.id).eq("cadence_due_at", conversation.cadence_due_at)
        .select("id").maybeSingle();
      if (!claim) return fail("already_claimed", "Outro processo já assumiu este follow-up", 409);
      try {
        const result = await sendEvolutionMessageToConversation(ctx.supabase, ctx.accountId, {
          conversationId, messageType: "text", contentText: text,
          sentByType: "diana", scheduleCadence: false,
        });
        const finished = step === 2;
        const nextDelay = step === 0 ? 4 * 60 * 60_000 : 24 * 60 * 60_000;
        const nextDue = finished ? null : new Date(Date.now() + nextDelay).toISOString();
        await ctx.supabase.from("conversations").update({
          cadence_step: step + 1,
          cadence_due_at: nextDue,
          cadence_completed_at: finished ? new Date().toISOString() : null,
        }).eq("id", conversation.id);
        await ctx.supabase.from("lead_observations").insert({
          account_id: ctx.accountId, contact_id: contact.id, conversation_id: conversation.id,
          author_type: "diana", observation_type: "follow_up",
          content: `Follow-up ${step + 1}/3 enviado pela Diana`,
          metadata: { next_due_at: nextDue },
        });
        return ok({ ...result, cadence_step: step + 1, next_due_at: nextDue, completed: finished }, 201);
      } catch (error) {
        await ctx.supabase.from("conversations").update({ cadence_due_at: conversation.cadence_due_at }).eq("id", conversation.id).eq("cadence_due_at", claimUntil);
        throw error;
      }
    }

    return fail("bad_request", "Ação Hermes não reconhecida", 400);
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
