import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Lightbulb,
  History,
  Sparkles,
  Menu,
  X
} from "lucide-react";
import { IdeaForm, FieldMapping, ArchiveItem, BitrixAuth } from "./types";
import {
  getAuth,
  callMethod,
  adjustIframeHeight,
  fetchLeadFields,
  createLeadUserField,
  whenBx24Ready,
  RECOMMENDED_FIELDS
} from "./utils/bx24";
import LeadForm from "./components/LeadForm";
import Archive from "./components/Archive";

// Background SVG identical to the user's Vue layout
const BG_SVG = [
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 440" width="240" height="440">',
    '<g transform="translate(120,220) rotate(45) translate(-60,-110)">',
      '<path fill="white" opacity="0.10" fill-rule="evenodd" d="',
        'M 60,18 C 96,18 108,60 108,102 C 108,128 99,146 80,165',
        'L 80,140 C 80,118 71,105 60,105 C 49,105 40,118 40,140 L 40,165',
        'C 21,146 12,128 12,102 C 12,60 24,18 60,18 Z',
        'M 60,68 A 10,10 0 1 0 60,88 A 10,10 0 1 0 60,68 Z',
      '"/>',
      '<path fill="white" opacity="0.10" d="M 104,0 L 120,16 L 104,32 L 88,16 Z"/>',
      '<path fill="white" opacity="0.08" d="M 60,162 L 78,180 L 60,220 L 42,180 Z"/>',
    '</g>',
  '</svg>'
].join("");

const DEFAULT_MAPPING: FieldMapping = {
  department: "COMMENTS",
  category: "COMMENTS",
  currentSituation: "COMMENTS",
  idea: "COMMENTS",
  materialsLink: "COMMENTS",
  needFinance: "COMMENTS",
  implementation: "COMMENTS",
  audience: "COMMENTS"
};

export default function App() {
  const [activeTab, setActiveTab] = useState<"form" | "archive">("form");
  const [auth, setAuth] = useState<BitrixAuth | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [autoFilled, setAutoFilled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // App states
  const [mapping, setMapping] = useState<FieldMapping>(DEFAULT_MAPPING);
  const [fieldsCreateError, setFieldsCreateError] = useState<string | null>(null);
  const [archive, setArchive] = useState<ArchiveItem[]>([]);
  const [initialForm, setInitialForm] = useState<IdeaForm>({
    fullName: "",
    position: "",
    department: "",
    category: "",
    ideaTitle: "",
    currentSituation: "",
    idea: "",
    materialsLink: "",
    needFinance: "",
    implementation: "",
    audience: ""
  });

  // Load static data and auth
  useEffect(() => {
    let cancelled = false;

    // 1. Load Archive from localStorage
    try {
      const savedArchive = localStorage.getItem("ideas_archive");
      if (savedArchive) {
        setArchive(JSON.parse(savedArchive));
      }
    } catch (e) {
      console.warn("Failed to load archive", e);
    }

    // 2. Load cached field mapping (refreshed from CRM once auth resolves)
    try {
      const savedMapping = localStorage.getItem("crm_field_mapping");
      if (savedMapping) {
        setMapping(JSON.parse(savedMapping));
      }
    } catch (e) {
      console.warn("Failed to load crm mappings", e);
    }

    // 3. Get Authentication — wait for the BX24 SDK handshake first so
    // BX24.getAuth() can be used as the primary token source
    (async () => {
      await whenBx24Ready();
      if (!cancelled) {
        setAuth(getAuth());
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch Bitrix24 User Profile details and ensure CRM idea fields exist
  useEffect(() => {
    if (auth) {
      fetchCurrentUser();
      ensureCrmFields();
    }
  }, [auth]);

  // Adjust Iframe height on tab or view transitions
  useEffect(() => {
    adjustIframeHeight();
  }, [activeTab]);

  // Matches a recommended field to an existing CRM lead field either by its
  // exact code (UF_CRM_IDEA_*) or by its display name ("Включайся: ...").
  // Name matching lets manually created fields work too — the lead card UI
  // auto-generates codes like UF_CRM_17xxxxx that can't be customized.
  const resolveCrmField = (def: (typeof RECOMMENDED_FIELDS)[number], fields: { id: string; title: string }[]) => {
    const byCode = fields.find(f => f.id === def.fullCode);
    if (byCode) return byCode;
    const wanted = def.label.trim().toLowerCase();
    return fields.find(f => f.id.startsWith("UF_") && f.title.trim().toLowerCase() === wanted);
  };

  // Ensures the custom "Включайся" lead fields exist (creating any missing
  // ones — requires CRM admin rights) and maps every form field that has a
  // matching CRM field. Fields that could not be created stay on the
  // COMMENTS fallback, which is always written anyway. Returns the fresh
  // mapping so the submit flow can use it without racing React state.
  const ensureCrmFields = async (): Promise<FieldMapping> => {
    try {
      let fields = await fetchLeadFields();
      const missing = RECOMMENDED_FIELDS.filter(
        def => !resolveCrmField(def, fields)
      );

      if (missing.length > 0) {
        let createdAny = false;
        let lastError: string | null = null;
        for (const def of missing) {
          try {
            await createLeadUserField(def);
            createdAny = true;
          } catch (e: any) {
            lastError = e?.message || String(e);
            console.warn(`Could not auto-create CRM field ${def.fullCode}:`, e);
          }
        }
        if (createdAny) {
          fields = await fetchLeadFields();
        }
        setFieldsCreateError(createdAny ? null : lastError);
      } else {
        setFieldsCreateError(null);
      }

      const newMapping: FieldMapping = { ...DEFAULT_MAPPING };
      for (const def of RECOMMENDED_FIELDS) {
        const match = resolveCrmField(def, fields);
        if (match) {
          newMapping[def.key as keyof FieldMapping] = match.id;
        }
      }

      setMapping(newMapping);
      localStorage.setItem("crm_field_mapping", JSON.stringify(newMapping));
      return newMapping;
    } catch (e) {
      console.warn("Could not sync CRM idea fields", e);
      return mapping;
    }
  };

  const fetchCurrentUser = async () => {
    try {
      const res = await callMethod("user.current", {});
      const d = res.data;
      if (d) {
        setCurrentUser(d);
        const name = [d.LAST_NAME, d.NAME, d.SECOND_NAME].filter(Boolean).join(" ");
        const pos = d.WORK_POSITION || "";
        
        setInitialForm(prev => ({
          ...prev,
          fullName: name,
          position: pos
        }));
        setAutoFilled(true);

        // Fetch user department name
        const deptIds = d.UF_DEPARTMENT;
        if (deptIds && deptIds.length > 0) {
          try {
            const dr = await callMethod("department.get", { ID: deptIds[0] });
            const depts = dr.data;
            if (depts && depts.length > 0) {
              setInitialForm(prev => ({
                ...prev,
                department: depts[0].NAME
              }));
            }
          } catch (deptErr) {
            console.warn("Failed to load department info:", deptErr);
          }
        }
      }
    } catch (err) {
      console.warn("Failed to load current user details:", err);
    }
  };

  // Triggers when a lead is submitted
  const handleLeadSubmit = async (formData: IdeaForm): Promise<{ ideaNumber: number; leadId?: number }> => {
    // 0. Re-sync CRM fields right before submitting so we always write into
    // every UF_CRM_IDEA_* field that exists at this moment (and retry
    // creating missing ones — succeeds when the user is a CRM admin)
    const activeMapping = await ensureCrmFields();

    // 1. Calculate next idea number from lead title count (matching vue mechanism)
    let ideaNumber = archive.length + 1;
    try {
      const listRes = await callMethod("crm.lead.list", {
        filter: { "%TITLE": "Идея №" },
        select: ["ID"]
      });
      ideaNumber = (listRes.total || 0) + 1;
    } catch (e) {
      console.warn("Failed to query leads count, using local size:", e);
    }

    // 2. Prepare Name splits
    const parts = formData.fullName.trim().split(/\s+/).filter(Boolean);
    const lastName = parts[0] || "";
    const firstName = parts[1] || "";
    const secondName = parts.slice(2).join(" ");

    // 3. Build a high-fidelity formatted description string for the generic COMMENTS box (backup)
    const formattedComments = [
      `✦ Название идеи: ${formData.ideaTitle}`,
      "--------------------------------------------",
      `• ФИО автора: ${formData.fullName}`,
      `• Должность: ${formData.position}`,
      `• Отдел: ${formData.department}`,
      "--------------------------------------------",
      `• Категория: ${formData.category}`,
      `• Текущая ситуация: ${formData.currentSituation}`,
      `• Предлагаемое решение: ${formData.idea}`,
      `• Ссылка на материалы: ${formData.materialsLink || "—"}`,
      "--------------------------------------------",
      `• Требуются финансы: ${formData.needFinance}`,
      `• Готовность к внедрению: ${formData.implementation}`,
      `• Для кого идея: ${formData.audience}`
    ].join("\n");

    const fields: any = {
      TITLE: `Идея № ${ideaNumber} — ${formData.ideaTitle}`,
      LAST_NAME: lastName,
      NAME: firstName,
      SECOND_NAME: secondName,
      POST: formData.position,
      ASSIGNED_BY_ID: 1220, // Assigned manager from the Vue constructor template
      SOURCE_ID: "6",       // Source: Web site/Widget
      SOURCE_DESCRIPTION: "Включайся",
      COMMENTS: formattedComments // Always supply readable comments as backup
    };

    // 4. Map form answers to separate CRM fields if defined
    const formKeys: (keyof FieldMapping)[] = [
      "department", 
      "category", 
      "currentSituation", 
      "idea", 
      "materialsLink", 
      "needFinance", 
      "implementation", 
      "audience"
    ];

    formKeys.forEach((key) => {
      const targetCrmField = activeMapping[key];
      if (targetCrmField && targetCrmField !== "COMMENTS") {
        fields[targetCrmField] = formData[key as keyof IdeaForm];
      }
    });

    // 5. Submit to CRM Lead Add
    const addRes = await callMethod("crm.lead.add", { fields });
    const leadId = addRes.data;

    // 6. Append to local history archive
    const now = new Date();
    const dateStr = now.toLocaleDateString("ru-RU") + " " + now.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

    const newItem: ArchiveItem = {
      ...formData,
      id: String(Date.now()),
      date: dateStr,
      ideaNumber,
      leadId: typeof leadId === "number" ? leadId : parseInt(leadId) || undefined
    };

    const updatedArchive = [newItem, ...archive]; // Newest first
    setArchive(updatedArchive);
    localStorage.setItem("ideas_archive", JSON.stringify(updatedArchive));

    return { ideaNumber, leadId: newItem.leadId };
  };

  return (
    <div 
      id="app-root-shell" 
      className="bg-[#F5F5F7] text-[#1D1D1F] min-height-viewport min-h-screen pb-12 transition-all duration-300 antialiased"
    >
      {/* Dynamic Header */}
      <header className="relative max-w-5xl mx-auto px-4 pt-8 md:pt-12 pb-6 text-left select-none">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="inline-flex items-center gap-1.5 bg-[#00AEEF]/10 border border-[#00AEEF]/20 px-3.5 py-1 rounded-full text-xs font-bold tracking-wide text-[#00AEEF]"
              >
                <Sparkles className="w-3.5 h-3.5" />
                ✦ Программа «Включайся»
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border ${
                  auth
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                    : "bg-slate-100 border-slate-200 text-slate-500"
                }`}
                title={auth ? `Портал: ${auth.domain}` : "Откройте приложение внутри Битрикс24"}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${auth ? "bg-emerald-500" : "bg-slate-400"}`} />
                {auth ? "Битрикс24 подключен" : "Нет связи с Битрикс24"}
              </motion.div>
            </div>
            
            <motion.h1 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="text-3xl md:text-5xl font-black tracking-tight text-[#1D1D1F]"
            >
              Поделитесь идеей
            </motion.h1>
            
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-sm md:text-base font-semibold text-[#86868B] max-w-xl leading-relaxed"
            >
              Любое предложение по улучшению работы Фонда — важный шаг вперёд для всей нашей сплоченной команды.
            </motion.p>
          </div>

          {/* Desktop Navigation Tabs */}
          <nav id="desktop-nav" className="hidden md:flex items-center gap-1 bg-[#E5E5E7] p-1 rounded-xl">
            <button
              onClick={() => setActiveTab("form")}
              className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-all duration-200 flex items-center gap-2 ${
                activeTab === "form" 
                  ? "bg-white text-[#1D1D1F] shadow-sm" 
                  : "text-[#86868B] hover:text-[#1D1D1F] hover:bg-white/40"
              }`}
            >
              <Lightbulb className="w-4 h-4" />
              Подать идею
            </button>
            <button
              onClick={() => setActiveTab("archive")}
              className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-all duration-200 flex items-center gap-2 ${
                activeTab === "archive" 
                  ? "bg-white text-[#1D1D1F] shadow-sm" 
                  : "text-[#86868B] hover:text-[#1D1D1F] hover:bg-white/40"
              }`}
            >
              <History className="w-4 h-4" />
              История ({archive.length})
            </button>
          </nav>

          {/* Mobile Menu Burger Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2.5 bg-white rounded-xl border border-[#D2D2D7] text-[#1D1D1F] active:scale-95 transition"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile Navigation Panel */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute left-4 right-4 top-full mt-2 bg-white/95 backdrop-blur-2xl rounded-2xl p-3 shadow-lg border border-[#D2D2D7]/50 flex flex-col gap-1 z-50 text-[#1D1D1F] font-bold text-sm md:hidden"
            >
              <button
                onClick={() => {
                  setActiveTab("form");
                  setMobileMenuOpen(false);
                }}
                className={`w-full py-2.5 px-4 rounded-xl flex items-center gap-2.5 text-left transition ${
                  activeTab === "form" ? "bg-[#00AEEF]/10 text-[#00AEEF]" : "hover:bg-slate-50"
                }`}
              >
                <Lightbulb className="w-4.5 h-4.5 text-[#00AEEF]" />
                Подать идею
              </button>
              <button
                onClick={() => {
                  setActiveTab("archive");
                  setMobileMenuOpen(false);
                }}
                className={`w-full py-2.5 px-4 rounded-xl flex items-center gap-2.5 text-left transition ${
                  activeTab === "archive" ? "bg-[#00AEEF]/10 text-[#00AEEF]" : "hover:bg-slate-50"
                }`}
              >
                <History className="w-4.5 h-4.5 text-[#00AEEF]" />
                История предложений ({archive.length})
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Main Container Stage */}
      <main className="max-w-5xl mx-auto px-4 relative z-10">
        <AnimatePresence mode="wait">
          {activeTab === "form" && (
            <motion.div
              key="form-tab-view"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
            >
              <LeadForm
                initialForm={initialForm}
                mapping={mapping}
                autoFilled={autoFilled}
                fieldsCreateError={fieldsCreateError}
                onSubmit={handleLeadSubmit}
              />
            </motion.div>
          )}

          {activeTab === "archive" && (
            <motion.div
              key="archive-tab-view"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
            >
              <Archive 
                archive={archive} 
                onNavigateToForm={() => setActiveTab("form")}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
