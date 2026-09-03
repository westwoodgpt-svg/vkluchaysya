// Vercel serverless function: creates the "Идея № N" lead on behalf of an
// employee who has no CRM permissions of their own.
//
// Why this exists: Bitrix24 answers crm.lead.add with "Access denied. (400)"
// for every user who is not in a CRM permission role, so those employees
// could fill in the whole form and then lose it on the last click. When a
// service inbound webhook is configured (BITRIX_WEBHOOK_URL), the lead is
// created with the webhook's rights instead — including the "Включайся: …"
// user fields, which a regular employee cannot create either.
//
// The endpoint is not open: every request must carry the caller's own
// Bitrix24 token, which is verified with user.current against the same
// portal the webhook belongs to before anything is written.
import { IdeaForm, CrmField } from "../src/types";
import {
  RECOMMENDED_FIELDS,
  DEFAULT_MAPPING,
  IDEA_FORM_KEYS,
  buildLeadFields,
  buildMapping,
  normalizeLeadFields,
  resolveCrmField,
  userFieldAddParams,
} from "../src/utils/leadPayload";

const MAX_FIELD_LENGTH = 5000;

/** Inbound webhook of the portal, e.g. https://portal.example/rest/1/token/ */
function getWebhookUrl(): string | null {
  const raw = process.env.BITRIX_WEBHOOK_URL || process.env.BITRIX24_WEBHOOK_URL;
  if (!raw || !raw.trim()) return null;
  return raw.trim().replace(/\/+$/, "") + "/";
}

function cleanDomain(domain: unknown): string {
  return String(domain || "")
    .trim()
    .replace(/^(https?:\/\/)/, "")
    .replace(/\/.*$/, "")
    .toLowerCase();
}

async function callRest(url: string, body: Record<string, any>): Promise<any> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => null);
  if (!data) {
    throw new Error(`Битрикс24 вернул нечитаемый ответ (HTTP ${response.status})`);
  }
  if (data.error) {
    throw new Error(String(data.error_description || data.error));
  }
  return data;
}

/** Calls a REST method with the service webhook's rights. */
function callWebhook(webhook: string, method: string, params: Record<string, any> = {}) {
  return callRest(`${webhook}${method}.json`, params);
}

/** Keeps only the known IdeaForm keys, as trimmed strings of sane length. */
function sanitizeForm(raw: any): IdeaForm | null {
  if (!raw || typeof raw !== "object") return null;

  const form: Record<string, string> = {};
  for (const key of IDEA_FORM_KEYS) {
    const value = raw[key];
    form[key] = value === undefined || value === null ? "" : String(value).slice(0, MAX_FIELD_LENGTH);
  }

  // The three fields the form itself insists on before enabling submit.
  if (!form.fullName.trim() || !form.ideaTitle.trim() || !form.idea.trim()) return null;

  return form as unknown as IdeaForm;
}

/**
 * Makes sure the "Включайся: …" lead fields exist and returns the mapping.
 * Best-effort: any failure just leaves answers in COMMENTS.
 */
async function ensureFields(webhook: string) {
  try {
    let fields: CrmField[] = normalizeLeadFields((await callWebhook(webhook, "crm.lead.fields")).result);
    const missing = RECOMMENDED_FIELDS.filter(def => !resolveCrmField(def, fields));

    if (missing.length > 0) {
      let createdAny = false;
      for (const def of missing) {
        try {
          await callWebhook(webhook, "crm.lead.userfield.add", userFieldAddParams(def));
          createdAny = true;
        } catch (e: any) {
          console.warn(`Could not create CRM field ${def.fullCode}:`, e?.message || e);
        }
      }
      if (createdAny) {
        fields = normalizeLeadFields((await callWebhook(webhook, "crm.lead.fields")).result);
      }
    }

    return buildMapping(fields);
  } catch (e: any) {
    console.warn("Could not sync CRM idea fields via webhook:", e?.message || e);
    return { ...DEFAULT_MAPPING };
  }
}

export default async function handler(req: any, res: any) {
  const webhook = getWebhookUrl();

  // Lets the SPA tell the employee up front whether this fallback exists.
  if (req.method === "GET") {
    res.status(200).json({ configured: Boolean(webhook) });
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "METHOD_NOT_ALLOWED", error_description: "Method not allowed" });
    return;
  }

  if (!webhook) {
    res.status(501).json({
      error: "WEBHOOK_NOT_CONFIGURED",
      error_description:
        "Отправка от имени сервиса не настроена: в приложении не задан входящий вебхук Битрикс24 (переменная BITRIX_WEBHOOK_URL).",
    });
    return;
  }

  const { domain, auth, form: rawForm } = req.body || {};
  const portal = cleanDomain(domain);
  const webhookHost = cleanDomain(webhook);

  if (!portal || !auth) {
    res.status(400).json({
      error: "MISSING_PARAMETERS",
      error_description: "Не переданы domain и auth текущего пользователя.",
    });
    return;
  }

  // The webhook may only ever be used for its own portal.
  if (portal !== webhookHost) {
    res.status(400).json({
      error: "WRONG_PORTAL",
      error_description: `Приложение настроено на портал ${webhookHost}, а запрос пришёл с ${portal}.`,
    });
    return;
  }

  const form = sanitizeForm(rawForm);
  if (!form) {
    res.status(400).json({
      error: "INVALID_FORM",
      error_description: "Данные идеи отсутствуют или заполнены не полностью.",
    });
    return;
  }

  // Only real users of this portal may create leads through the webhook.
  try {
    await callRest(`https://${portal}/rest/user.current.json`, { auth: String(auth) });
  } catch (e: any) {
    console.warn("Caller token rejected by Bitrix24:", e?.message || e);
    res.status(403).json({
      error: "INVALID_AUTH",
      error_description:
        "Битрикс24 не подтвердил вашу авторизацию. Перезагрузите приложение внутри портала и попробуйте снова.",
    });
    return;
  }

  try {
    const mapping = await ensureFields(webhook);

    let ideaNumber = 1;
    try {
      const listRes = await callWebhook(webhook, "crm.lead.list", {
        filter: { "%TITLE": "Идея №" },
        select: ["ID"],
      });
      ideaNumber = (Number(listRes.total) || 0) + 1;
    } catch (e: any) {
      console.warn("Could not count existing ideas:", e?.message || e);
    }

    const addRes = await callWebhook(webhook, "crm.lead.add", {
      fields: buildLeadFields(form, ideaNumber, mapping),
    });

    res.status(200).json({ ideaNumber, leadId: addRes.result });
  } catch (e: any) {
    console.error("Failed to create lead via webhook:", e?.message || e);
    res.status(502).json({
      error: "LEAD_CREATE_FAILED",
      error_description: `Не удалось создать лид через сервисный вебхук: ${e?.message || e}`,
    });
  }
}
