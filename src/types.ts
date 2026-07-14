export interface IdeaForm {
  fullName: string;
  position: string;
  department: string;
  category: string;
  ideaTitle: string;
  currentSituation: string;
  idea: string;
  materialsLink: string;
  needFinance: string;
  implementation: string;
  audience: string;
}

export interface FieldMapping {
  department: string; // E.g., 'UF_CRM_IDEA_DEPT' or 'COMMENTS'
  category: string;
  currentSituation: string;
  idea: string;
  materialsLink: string;
  needFinance: string;
  implementation: string;
  audience: string;
}

export interface ArchiveItem extends IdeaForm {
  id: string;
  date: string;
  ideaNumber: number;
  leadId?: number;
}

export interface BitrixAuth {
  authId: string;
  domain: string;
  userId?: string;
  placement?: string;
}

export interface CrmField {
  id: string;
  title: string;
  type: string;
}
