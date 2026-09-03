import { BitrixAuth, CrmField, IdeaForm } from "../types";
import {
  FieldDef,
  RECOMMENDED_FIELDS,
  normalizeLeadFields,
  userFieldAddParams
} from "./leadPayload";

// Field definitions live in the shared module (used by the serverless API
// too); re-exported here so existing importers keep working.
export type { FieldDef };
export { RECOMMENDED_FIELDS };

/**
 * Checks if the official Bitrix24 JS SDK is available in the browser.
 */
export function isBx24Available(): boolean {
  if (typeof window === "undefined") return false;
  // The official Bitrix24 SDK script sets `window.BX24 = null` synchronously
  // on load, then replaces it with a real object only after it finishes an
  // async postMessage handshake with the parent frame. Checking
  // `!== undefined` treats that transient `null` as "available" and crashes
  // every call (`Cannot read properties of null`) if our code runs before
  // the handshake completes. Require a real object with callMethod present.
  const bx = (window as any).BX24;
  return !!bx && typeof bx.callMethod === "function";
}

let readyPromise: Promise<boolean> | null = null;

/**
 * Waits for the BX24 JS SDK to finish its async handshake with the parent
 * Bitrix24 frame (or gives up after `timeoutMs` when running outside of
 * Bitrix24). Resolves true when the SDK is usable, false otherwise.
 */
export function whenBx24Ready(timeoutMs = 4000): Promise<boolean> {
  if (readyPromise) return readyPromise;
  readyPromise = new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve(false);
      return;
    }
    const started = Date.now();
    const poll = () => {
      if (isBx24Available()) {
        try {
          (window as any).BX24.init(() => {
            // Tell Bitrix24 the installation is complete. Until this is
            // called (once, by an admin opening the app), regular employees
            // get the "Приложение ещё не установлено до конца" stub instead
            // of the app. Safe to call on every load — it's a no-op when
            // the app is already marked as installed.
            try {
              (window as any).BX24.installFinish();
            } catch (e) {
              console.warn("BX24.installFinish failed:", e);
            }
            resolve(true);
          });
          // Safety net in case the init callback never fires
          setTimeout(() => resolve(true), 1500);
        } catch {
          resolve(true);
        }
        return;
      }
      if (Date.now() - started >= timeoutMs) {
        resolve(false);
        return;
      }
      setTimeout(poll, 100);
    };
    poll();
  });
  return readyPromise;
}

/**
 * Adjusts the height of the Bitrix24 iframe.
 * Should be called whenever the DOM height changes.
 */
export function adjustIframeHeight() {
  if (isBx24Available()) {
    try {
      (window as any).BX24.fitWindow();
    } catch (e) {
      console.warn("Failed to call BX24.fitWindow:", e);
    }
  }
}

function saveAuth(auth: BitrixAuth): BitrixAuth {
  localStorage.setItem("bx24_auth", JSON.stringify(auth));
  return auth;
}

/**
 * Extracts and stores authorization details. Sources, in priority order:
 * 1. Live token from the BX24 JS SDK (auto-refreshed by the SDK itself);
 * 2. window.__BX_AUTH__ injected server-side from Bitrix24's POST body;
 * 3. URL query params (legacy redirect flow);
 * 4. localStorage (last successful auth).
 */
export function getAuth(): BitrixAuth | null {
  if (typeof window === "undefined") return null;

  if (isBx24Available()) {
    try {
      const live = (window as any).BX24.getAuth();
      if (live && live.access_token && live.domain) {
        return saveAuth({
          authId: live.access_token,
          domain: live.domain,
          userId: undefined,
          placement: undefined,
        });
      }
    } catch (e) {
      console.warn("BX24.getAuth() failed:", e);
    }
  }

  const injected = (window as any).__BX_AUTH__;
  if (injected && injected.AUTH_ID && injected.DOMAIN) {
    return saveAuth({
      authId: String(injected.AUTH_ID),
      domain: String(injected.DOMAIN),
      userId: injected.USER_ID ? String(injected.USER_ID) : undefined,
      placement: injected.PLACEMENT ? String(injected.PLACEMENT) : undefined,
    });
  }

  const params = new URLSearchParams(window.location.search);
  const authId = params.get("AUTH_ID");
  const domain = params.get("DOMAIN");
  const userId = params.get("USER_ID");
  const placement = params.get("PLACEMENT");

  if (authId && domain) {
    const auth: BitrixAuth = { 
      authId, 
      domain, 
      userId: userId || undefined, 
      placement: placement || undefined 
    };
    localStorage.setItem("bx24_auth", JSON.stringify(auth));
    return auth;
  }

  // Fallback to saved
  const saved = localStorage.getItem("bx24_auth");
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      // Clear invalid data
      localStorage.removeItem("bx24_auth");
    }
  }

  return null;
}

/**
 * Promise wrapper around BX24 JS SDK method calls.
 */
function callBx24Method(method: string, params: any = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    if (!isBx24Available()) {
      reject(new Error("BX24 JS SDK is not available."));
      return;
    }
    try {
      (window as any).BX24.callMethod(method, params, (res: any) => {
        if (res.error()) {
          reject(new Error(res.error().toString()));
        } else {
          const payload = typeof res.data === "function" ? res.data() : res.data;
          const total = typeof res.total === "function" ? res.total() : res.total;
          resolve({ data: payload, total });
        }
      });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Node Express server proxy-based REST method call.
 */
async function callProxyMethod(method: string, params: any = {}): Promise<any> {
  const auth = getAuth();
  if (!auth) {
    throw new Error("Не найдена активная авторизация. Пожалуйста, откройте приложение внутри Битрикс24.");
  }

  const response = await fetch("/api/rest", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      method,
      domain: auth.domain,
      auth: auth.authId,
      params,
    }),
  });

  const resData = await response.json();
  if (response.ok) {
    if (resData.error) {
      throw new Error(resData.error_description || resData.error);
    }
    return { data: resData.result, total: resData.total };
  } else {
    throw new Error(resData.error_description || resData.error || "Ошибка REST-прокси");
  }
}

/**
 * Universal execution method - uses native BX24 window SDK if available,
 * otherwise falls back to the server-side CORS-bypass REST proxy.
 * Always waits for the SDK handshake first so calls made right after
 * page load don't race it and needlessly fall back to the proxy.
 */
export async function callMethod(method: string, params: any = {}): Promise<any> {
  await whenBx24Ready();
  if (isBx24Available()) {
    return callBx24Method(method, params);
  } else {
    return callProxyMethod(method, params);
  }
}

/**
 * True when Bitrix24 refused the call because of the current user's
 * permissions rather than because of a bug in the request. Employees who
 * are not in a CRM permission role get this for every crm.* method —
 * including crm.lead.add, which is what blocks them from submitting.
 */
export function isAccessDeniedError(err: any): boolean {
  const msg = String(err?.message || err || "").toLowerCase();
  return /access denied|access_denied|insufficient|доступ запрещ|недостаточно прав/.test(msg);
}

/**
 * Turns a raw Bitrix24 error (often the untranslated "Access denied. (400)")
 * into something an employee can act on.
 */
export function describeBitrixError(err: any): string {
  const raw = String(err?.message || err || "").trim();

  if (isAccessDeniedError(err)) {
    return (
      "Битрикс24 не разрешает вашей учётной записи создавать лиды в CRM " +
      "(«Access denied»). Попросите администратора портала выдать вам права " +
      "на создание лидов — или настроить в приложении входящий вебхук, " +
      "чтобы идеи отправлялись от имени сервиса. Идея пока не отправлена, " +
      "текст сохранён в форме."
    );
  }

  if (!raw) {
    return "Не удалось отправить идею в CRM Битрикс24. Попробуйте ещё раз или обратитесь к администратору.";
  }

  return `Не удалось отправить идею в CRM Битрикс24: ${raw}`;
}

/**
 * Fetches all available lead fields (standard & user fields) from the active CRM.
 */
export async function fetchLeadFields(): Promise<CrmField[]> {
  try {
    const res = await callMethod("crm.lead.fields", {});
    return normalizeLeadFields(res.data);
  } catch (err) {
    console.error("Failed to fetch lead fields:", err);
    throw err;
  }
}

/**
 * Auto-creates a recommended custom field for CRM Leads.
 */
export async function createLeadUserField(fieldDef: FieldDef): Promise<string> {
  try {
    // NOTE: the generic "crm.userfield.add" method does not exist in the
    // Bitrix24 REST API — user fields are created via the entity-specific
    // method. Calling the wrong method made auto-creation fail silently
    // even for CRM administrators.
    const res = await callMethod("crm.lead.userfield.add", userFieldAddParams(fieldDef));
    return res.data; // Returns ID of the created field
  } catch (err: any) {
    // If the field already exists, don't fail, just return a custom string
    if (err.message && /already exists|уже существует/i.test(err.message)) {
      return "ALREADY_EXISTS";
    }
    console.error(`Failed to create custom field ${fieldDef.fieldName}:`, err);
    throw err;
  }
}

/**
 * Asks the serverless API whether the service webhook is configured, i.e.
 * whether ideas can still be submitted for employees without CRM rights.
 */
export async function isServerSubmitAvailable(): Promise<boolean> {
  try {
    const res = await fetch("/api/idea", { method: "GET" });
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data?.configured);
  } catch (e) {
    console.warn("Could not check the server submit fallback:", e);
    return false;
  }
}

/**
 * Creates the lead through the serverless API, which uses the portal's
 * service webhook instead of the employee's own (possibly CRM-less) token.
 * The API verifies the caller's Bitrix24 token before doing anything.
 */
export async function submitIdeaViaServer(
  form: IdeaForm
): Promise<{ ideaNumber: number; leadId?: number }> {
  const auth = getAuth();
  if (!auth) {
    throw new Error("Не найдена активная авторизация. Пожалуйста, откройте приложение внутри Битрикс24.");
  }

  const response = await fetch("/api/idea", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      domain: auth.domain,
      auth: auth.authId,
      form,
    }),
  });

  const data = await response.json().catch(() => null);

  if (!data) {
    const err: any = new Error(
      `Сервер приложения вернул неожиданный ответ (HTTP ${response.status}).`
    );
    err.serverFallbackStatus = response.status;
    throw err;
  }

  if (!response.ok || data.error) {
    const detail = data.error_description || data.error || `HTTP ${response.status}`;
    const err: any = new Error(String(detail));
    err.serverFallbackStatus = response.status;
    throw err;
  }

  return {
    ideaNumber: Number(data.ideaNumber) || 0,
    leadId: typeof data.leadId === "number" ? data.leadId : parseInt(data.leadId, 10) || undefined,
  };
}
