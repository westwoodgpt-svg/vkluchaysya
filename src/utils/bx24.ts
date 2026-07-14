import { BitrixAuth, CrmField } from "../types";

// Recommended custom CRM Lead field definitions
export interface FieldDef {
  key: string;
  fieldName: string; // The suffix without UF_CRM_
  fullCode: string;  // The actual expected code: UF_CRM_IDEA_...
  label: string;
  type: string;
}

export const RECOMMENDED_FIELDS: FieldDef[] = [
  { key: "department", fieldName: "IDEA_DEPT", fullCode: "UF_CRM_IDEA_DEPT", label: "Включайся: Отдел", type: "string" },
  { key: "category", fieldName: "IDEA_CAT", fullCode: "UF_CRM_IDEA_CAT", label: "Включайся: Категория идеи", type: "string" },
  { key: "currentSituation", fieldName: "IDEA_SIT", fullCode: "UF_CRM_IDEA_SIT", label: "Включайся: Текущая ситуация", type: "string" },
  { key: "idea", fieldName: "IDEA_DESC", fullCode: "UF_CRM_IDEA_DESC", label: "Включайся: Суть идеи", type: "string" },
  { key: "materialsLink", fieldName: "IDEA_LINK", fullCode: "UF_CRM_IDEA_LINK", label: "Включайся: Ссылка на материалы", type: "string" },
  { key: "needFinance", fieldName: "IDEA_FIN", fullCode: "UF_CRM_IDEA_FIN", label: "Включайся: Финансовые затраты", type: "string" },
  { key: "implementation", fieldName: "IDEA_IMPL", fullCode: "UF_CRM_IDEA_IMPL", label: "Включайся: Готовность внедрить", type: "string" },
  { key: "audience", fieldName: "IDEA_AUD", fullCode: "UF_CRM_IDEA_AUD", label: "Включайся: Целевая аудитория", type: "string" },
];

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
          (window as any).BX24.init(() => resolve(true));
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
 * Automatically adjusts the height of the Bitrix24 iframe.
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
 * Fetches all available lead fields (standard & user fields) from the active CRM.
 */
export async function fetchLeadFields(): Promise<CrmField[]> {
  try {
    const res = await callMethod("crm.lead.fields", {});
    const fieldsMap = res.data;
    if (!fieldsMap) return [];

    const list: CrmField[] = [];
    for (const [key, val] of Object.entries(fieldsMap)) {
      const fieldInfo = val as any;
      let label: any = key;

      if (fieldInfo) {
        label = fieldInfo.title || fieldInfo.formLabel || fieldInfo.listLabel || fieldInfo.caption || key;
        // Sometimes labels are object structures for different languages
        if (typeof label === "object" && label !== null) {
          const labelObj = label as Record<string, any>;
          label = labelObj.ru || labelObj.en || Object.values(labelObj)[0] || key;
        }
      }

      list.push({
        id: key,
        title: String(label),
        type: fieldInfo?.type || "unknown"
      });
    }

    // Sort: standard fields first, then UF_ fields, sorted alphabetically
    return list.sort((a, b) => {
      const aIsUf = a.id.startsWith("UF_");
      const bIsUf = b.id.startsWith("UF_");
      if (aIsUf !== bIsUf) return aIsUf ? 1 : -1;
      return a.title.localeCompare(b.title, "ru");
    });
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
    const params = {
      fields: {
        FIELD_NAME: fieldDef.fieldName,
        EDIT_FORM_LABEL: { ru: fieldDef.label, en: fieldDef.label.replace("Включайся:", "Vkluchaysya:") },
        LIST_COLUMN_LABEL: { ru: fieldDef.label, en: fieldDef.label.replace("Включайся:", "Vkluchaysya:") },
        LIST_FILTER_LABEL: { ru: fieldDef.label, en: fieldDef.label.replace("Включайся:", "Vkluchaysya:") },
        USER_TYPE_ID: fieldDef.type === "string" ? "string" : fieldDef.type,
        ENTITY_ID: "CRM_LEAD",
        MANDATORY: "N",
        SHOW_FILTER: "Y",
        SHOW_IN_LIST: "Y",
        SORT: 100,
      }
    };

    const res = await callMethod("crm.userfield.add", params);
    return res.data; // Returns ID of the created field
  } catch (err: any) {
    // If the field already exists, don't fail, just return a custom string
    if (err.message && err.message.includes("already exists")) {
      return "ALREADY_EXISTS";
    }
    console.error(`Failed to create custom field ${fieldDef.fieldName}:`, err);
    throw err;
  }
}
