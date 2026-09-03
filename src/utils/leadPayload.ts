// Shared (browser + serverless) description of the CRM lead payload the app
// produces. Kept free of any browser or React dependency so `api/idea.ts`
// can import it too and both paths build exactly the same lead.
import { IdeaForm, FieldMapping, CrmField } from "../types";

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

// Every answer falls back to the COMMENTS box, which is always written.
export const DEFAULT_MAPPING: FieldMapping = {
  department: "COMMENTS",
  category: "COMMENTS",
  currentSituation: "COMMENTS",
  idea: "COMMENTS",
  materialsLink: "COMMENTS",
  needFinance: "COMMENTS",
  implementation: "COMMENTS",
  audience: "COMMENTS"
};

// Responsible manager for every created lead (from the original Vue template).
export const ASSIGNED_BY_ID = 1324;

// The keys of IdeaForm that can live in their own CRM field.
export const MAPPED_FORM_KEYS: (keyof FieldMapping)[] = [
  "department",
  "category",
  "currentSituation",
  "idea",
  "materialsLink",
  "needFinance",
  "implementation",
  "audience"
];

/**
 * Matches a recommended field to an existing CRM lead field either by its
 * exact code (UF_CRM_IDEA_*) or by its display name ("Включайся: ...").
 * Name matching lets manually created fields work too — the lead card UI
 * auto-generates codes like UF_CRM_17xxxxx that can't be customized.
 */
export function resolveCrmField(def: FieldDef, fields: CrmField[]): CrmField | undefined {
  const byCode = fields.find(f => f.id === def.fullCode);
  if (byCode) return byCode;
  const wanted = def.label.trim().toLowerCase();
  return fields.find(f => f.id.startsWith("UF_") && f.title.trim().toLowerCase() === wanted);
}

/** Builds a form-key -> CRM-field-code mapping out of the CRM field list. */
export function buildMapping(fields: CrmField[]): FieldMapping {
  const mapping: FieldMapping = { ...DEFAULT_MAPPING };
  for (const def of RECOMMENDED_FIELDS) {
    const match = resolveCrmField(def, fields);
    if (match) {
      mapping[def.key as keyof FieldMapping] = match.id;
    }
  }
  return mapping;
}

/** Human-readable dump of the whole idea, always stored in COMMENTS. */
export function formatIdeaComments(form: IdeaForm): string {
  return [
    `✦ Название идеи: ${form.ideaTitle}`,
    "--------------------------------------------",
    `• ФИО автора: ${form.fullName}`,
    `• Должность: ${form.position}`,
    `• Отдел: ${form.department}`,
    "--------------------------------------------",
    `• Категория: ${form.category}`,
    `• Текущая ситуация: ${form.currentSituation}`,
    `• Предлагаемое решение: ${form.idea}`,
    `• Ссылка на материалы: ${form.materialsLink || "—"}`,
    "--------------------------------------------",
    `• Требуются финансы: ${form.needFinance}`,
    `• Готовность к внедрению: ${form.implementation}`,
    `• Для кого идея: ${form.audience}`
  ].join("\n");
}

/** Builds the `fields` payload for crm.lead.add. */
export function buildLeadFields(
  form: IdeaForm,
  ideaNumber: number,
  mapping: FieldMapping
): Record<string, any> {
  const parts = form.fullName.trim().split(/\s+/).filter(Boolean);

  const fields: Record<string, any> = {
    TITLE: `Идея № ${ideaNumber} — ${form.ideaTitle}`,
    LAST_NAME: parts[0] || "",
    NAME: parts[1] || "",
    SECOND_NAME: parts.slice(2).join(" "),
    POST: form.position,
    ASSIGNED_BY_ID,
    SOURCE_ID: "6",       // Source: Web site/Widget
    SOURCE_DESCRIPTION: "Включайся",
    COMMENTS: formatIdeaComments(form) // Always supply readable comments as backup
  };

  for (const key of MAPPED_FORM_KEYS) {
    const targetCrmField = mapping[key];
    if (targetCrmField && targetCrmField !== "COMMENTS") {
      fields[targetCrmField] = form[key as keyof IdeaForm];
    }
  }

  return fields;
}

/** Payload for crm.lead.userfield.add for one recommended field. */
export function userFieldAddParams(def: FieldDef) {
  const en = def.label.replace("Включайся:", "Vkluchaysya:");
  return {
    fields: {
      // Bitrix24 prepends UF_CRM_ automatically: IDEA_DEPT -> UF_CRM_IDEA_DEPT
      FIELD_NAME: def.fieldName,
      EDIT_FORM_LABEL: { ru: def.label, en },
      LIST_COLUMN_LABEL: { ru: def.label, en },
      LIST_FILTER_LABEL: { ru: def.label, en },
      USER_TYPE_ID: def.type === "string" ? "string" : def.type,
      MANDATORY: "N",
      SHOW_FILTER: "Y",
      SHOW_IN_LIST: "Y",
      SORT: 100,
    }
  };
}

/** Turns the raw crm.lead.fields map into the flat list the app works with. */
export function normalizeLeadFields(fieldsMap: Record<string, any> | null | undefined): CrmField[] {
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
}

/** Keys of IdeaForm — used to sanitize what arrives at the serverless API. */
export const IDEA_FORM_KEYS: (keyof IdeaForm)[] = [
  "fullName",
  "position",
  "department",
  "category",
  "ideaTitle",
  "currentSituation",
  "idea",
  "materialsLink",
  "needFinance",
  "implementation",
  "audience"
];
