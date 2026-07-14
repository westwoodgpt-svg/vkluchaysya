import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Database, 
  Settings, 
  Sparkles, 
  Check, 
  HelpCircle, 
  ChevronDown, 
  Search, 
  Loader2, 
  RefreshCw, 
  CheckCircle, 
  AlertTriangle,
  User,
  Cpu
} from "lucide-react";
import { FieldMapping, CrmField, BitrixAuth } from "../types";
import { 
  RECOMMENDED_FIELDS, 
  FieldDef, 
  fetchLeadFields, 
  createLeadUserField, 
  isBx24Available 
} from "../utils/bx24";

interface CrmIntegrationProps {
  auth: BitrixAuth | null;
  currentUser: any;
  mapping: FieldMapping;
  onSaveMapping: (newMapping: FieldMapping) => void;
}

export default function CrmIntegration({ auth, currentUser, mapping, onSaveMapping }: CrmIntegrationProps) {
  const [crmFields, setCrmFields] = useState<CrmField[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Auto-creation flow states
  const [autoCreating, setAutoCreating] = useState(false);
  const [autoCreateStep, setAutoCreateStep] = useState(0);
  const [autoCreateProgress, setAutoCreateProgress] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Load CRM fields
  const loadCrmFields = async () => {
    if (!auth) return;
    setLoading(true);
    setError(null);
    try {
      const fields = await fetchLeadFields();
      setCrmFields(fields);
    } catch (err: any) {
      console.error(err);
      setError("Не удалось загрузить структуру полей из CRM Битрикс24. Возможно, токен авторизации истек или у пользователя недостаточно прав.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCrmFields();
  }, [auth]);

  // Handle manual field change
  const handleFieldMapChange = (formField: keyof FieldMapping, crmFieldId: string) => {
    const updated = { ...mapping, [formField]: crmFieldId };
    onSaveMapping(updated);
    setActiveDropdown(null);
    setSearchQuery("");
  };

  // Run auto-creator
  const runAutoCreator = async () => {
    if (!auth) return;
    setAutoCreating(true);
    setAutoCreateStep(0);
    setAutoCreateProgress([]);
    setError(null);

    const newMapping = { ...mapping };
    const logs: string[] = [];

    try {
      for (let i = 0; i < RECOMMENDED_FIELDS.length; i++) {
        const field = RECOMMENDED_FIELDS[i];
        setAutoCreateStep(i);
        logs.push(`Создание поля "${field.label}" (${field.fullCode})...`);
        setAutoCreateProgress([...logs]);

        try {
          const result = await createLeadUserField(field);
          if (result === "ALREADY_EXISTS") {
            logs[logs.length - 1] = `✅ Поле "${field.label}" уже существует в Битрикс24`;
          } else {
            logs[logs.length - 1] = `✅ Успешно создано поле "${field.label}"`;
          }
          newMapping[field.key as keyof FieldMapping] = field.fullCode;
        } catch (e: any) {
          console.error(e);
          logs[logs.length - 1] = `⚠️ Не удалось создать "${field.label}" (${e.message || "проверьте права администратора"})`;
          // Fallback to COMMENTS
          newMapping[field.key as keyof FieldMapping] = "COMMENTS";
        }
        
        setAutoCreateProgress([...logs]);
        // Small delay to make the process visually pleasing and give the API a breather
        await new Promise((resolve) => setTimeout(resolve, 600));
      }

      // Save new mapping and refresh CRM fields list
      onSaveMapping(newMapping);
      setSuccessMessage("Все рекомендуемые поля успешно настроены!");
      await loadCrmFields();
      
      setTimeout(() => {
        setAutoCreating(false);
        setSuccessMessage(null);
      }, 3500);

    } catch (err: any) {
      setError("Во время автоматической настройки произошла ошибка: " + (err.message || String(err)));
      setAutoCreating(false);
    }
  };

  const getFieldNameInRussian = (key: string): string => {
    const labels: Record<string, string> = {
      department: "Отдел",
      category: "Категория идеи",
      currentSituation: "Текущая ситуация",
      idea: "Суть идеи",
      materialsLink: "Ссылка на материалы",
      needFinance: "Финансовые затраты",
      implementation: "Готовность внедрить самостоятельно",
      audience: "Для кого идея"
    };
    return labels[key] || key;
  };

  const filteredCrmFields = crmFields.filter(f => 
    f.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div id="crm-integration-tab" className="max-w-4xl mx-auto space-y-6">
      
      {/* Connection Info */}
      <div id="connection-status-card" className="bg-white rounded-3xl p-6 border border-[#D2D2D7] shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-[#00AEEF]/10 text-[#00AEEF] rounded-2xl">
            <Cpu className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-[#1D1D1F]">Статус интеграции</h3>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                auth ? "bg-emerald-50 text-emerald-700 border border-emerald-250" : "bg-rose-50 text-rose-700 border border-rose-250"
              }`}>
                {auth ? "Подключено" : "Требуется авторизация"}
              </span>
            </div>
            <p className="text-sm text-[#86868B] mt-0.5">
              {auth ? `Портал: ${auth.domain}` : "Приложение не получило данные авторизации от Битрикс24"}
            </p>
          </div>
        </div>

        {currentUser && (
          <div id="authorized-user" className="flex items-center gap-3 bg-[#F5F5F7] py-2 px-3.5 rounded-xl border border-[#D2D2D7]">
            {currentUser.PERSONAL_PHOTO ? (
              <img 
                src={currentUser.PERSONAL_PHOTO} 
                alt="Avatar" 
                className="w-8 h-8 rounded-full border border-[#D2D2D7]"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-[#E5E5E7] text-[#1D1D1F] flex items-center justify-center font-bold text-xs border border-[#D2D2D7]">
                {currentUser.NAME?.[0] || <User className="w-4 h-4" />}
              </div>
            )}
            <div className="text-left">
              <p className="text-xs font-semibold text-[#1D1D1F] leading-tight">
                {[currentUser.NAME, currentUser.LAST_NAME].filter(Boolean).join(" ")}
              </p>
              <p className="text-[10px] text-[#86868B]">{currentUser.WORK_POSITION || "Сотрудник"}</p>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div id="crm-error" className="bg-rose-50 border border-rose-100 rounded-3xl p-5 text-rose-800 text-sm flex gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Ошибка подключения CRM</p>
            <p className="mt-1 text-rose-700">{error}</p>
            <button 
              onClick={loadCrmFields}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-100 hover:bg-rose-200 transition text-rose-900 rounded-xl font-medium text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Повторить попытку
            </button>
          </div>
        </div>
      )}

      {/* Auto-setup Panel */}
      <div id="auto-setup-card" className="bg-gradient-to-br from-[#1D1D1F] to-[#2D3135] rounded-3xl p-6 md:p-8 text-white shadow-lg relative overflow-hidden">
        {/* Subtle decorative circles */}
        <div className="absolute -right-10 -top-10 w-40 h-40 bg-[#00AEEF]/10 rounded-full blur-2xl" />
        <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-white/5 rounded-full blur-2xl" />

        <div className="relative z-10">
          <div className="inline-flex items-center gap-1.5 bg-white/10 px-3 py-1 rounded-full text-xs font-semibold tracking-wide text-teal-200 mb-4">
            <Sparkles className="w-3.5 h-3.5 text-[#00AEEF]" />
            Уникальная технология
          </div>
          <h3 className="text-xl md:text-2xl font-bold tracking-tight">Автоматическая экспресс-настройка</h3>
          <p className="text-slate-300 text-sm mt-2 max-w-2xl leading-relaxed">
            По умолчанию все пункты идеи сохраняются в единый комментарий лида. Наша система может мгновенно создать в Вашем Битрикс24 
            собственные поля (ячейки) под каждый пункт идеи, чтобы Вы могли вести аналитику, строить отчеты и фильтровать лиды в CRM.
          </p>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <button
              disabled={autoCreating || !auth}
              onClick={runAutoCreator}
              className="px-6 py-2.5 bg-[#00AEEF] hover:bg-[#00AEEF]/90 active:scale-95 transition text-white font-bold rounded-full flex items-center justify-center gap-2 shadow-md shadow-[#00AEEF]/20 disabled:opacity-50 disabled:scale-100"
            >
              {autoCreating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Создаем поля...
                </>
              ) : (
                <>
                  <Database className="w-4 h-4" />
                  Настроить автоматически в 1 клик
                </>
              )}
            </button>
            <button 
              onClick={loadCrmFields}
              disabled={loading}
              className="px-5 py-2.5 bg-white/10 hover:bg-white/15 transition text-white font-bold rounded-full flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Обновить список полей CRM
            </button>
          </div>

          {/* Progress Logs */}
          <AnimatePresence>
            {autoCreating && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-6 border-t border-white/10 pt-5 space-y-2 text-xs font-mono"
              >
                <div className="flex justify-between items-center text-[#00AEEF] mb-2 font-sans font-semibold">
                  <span>Процесс конфигурации</span>
                  <span>{Math.round(((autoCreateStep + 1) / RECOMMENDED_FIELDS.length) * 100)}%</span>
                </div>
                
                <div className="bg-black/30 rounded-xl p-4 space-y-2 max-h-48 overflow-y-auto border border-white/5 scrollbar-thin">
                  {autoCreateProgress.map((log, index) => (
                    <div key={index} className="flex items-center gap-2 text-slate-200">
                      <span className="text-[#00AEEF]">❯</span>
                      <span>{log}</span>
                    </div>
                  ))}
                  {successMessage && (
                    <motion.div 
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="flex items-center gap-1.5 text-emerald-400 font-sans font-semibold pt-2"
                    >
                      <CheckCircle className="w-4 h-4" />
                      {successMessage}
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Manual Mapper Block */}
      <div id="manual-mapper-card" className="bg-white rounded-3xl p-6 border border-[#D2D2D7] shadow-sm">
        <div className="flex items-center gap-2 mb-6">
          <Settings className="w-5 h-5 text-slate-500" />
          <h3 className="font-bold text-[#1D1D1F] text-lg">Карта соответствия полей CRM</h3>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-12 gap-4 pb-2 border-b border-[#D2D2D7] text-xs font-semibold text-[#86868B] tracking-wider">
            <div className="col-span-5 md:col-span-4">Поле в форме идеи</div>
            <div className="col-span-7 md:col-span-8">Направление записи в CRM (Битрикс24)</div>
          </div>

          {Object.keys(mapping).map((key) => {
            const val = mapping[key as keyof FieldMapping];
            const russianLabel = getFieldNameInRussian(key);
            const isMapped = val && val !== "COMMENTS";
            const mappedFieldObj = crmFields.find(f => f.id === val);

            return (
              <div key={key} className="grid grid-cols-12 gap-4 items-center py-2.5 border-b border-slate-50 last:border-b-0">
                {/* Form field info */}
                <div className="col-span-5 md:col-span-4 pr-2">
                  <p className="text-sm font-bold text-[#1D1D1F] leading-snug">{russianLabel}</p>
                  <p className="text-[10px] font-mono text-[#86868B] mt-0.5">{key}</p>
                </div>

                {/* Dropdown Selector */}
                <div className="col-span-7 md:col-span-8 relative">
                  <button
                    onClick={() => {
                      if (activeDropdown === key) {
                        setActiveDropdown(null);
                      } else {
                        setActiveDropdown(key);
                        setSearchQuery("");
                      }
                    }}
                    className={`w-full py-2.5 px-4 rounded-xl text-left border flex items-center justify-between text-sm transition-all duration-200 outline-none ${
                      activeDropdown === key 
                        ? "border-[#00AEEF] ring-2 ring-[#00AEEF]/20 bg-white" 
                        : isMapped 
                          ? "border-emerald-200 bg-emerald-50/10 hover:bg-emerald-50/20 text-emerald-950 font-bold" 
                          : "border-[#D2D2D7] hover:border-slate-400 text-slate-600 bg-white"
                    }`}
                  >
                    <span className="truncate flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${isMapped ? "bg-emerald-500" : "bg-slate-300"}`} />
                      {isMapped && mappedFieldObj ? (
                        <>
                          <span className="text-[#1D1D1F]">{mappedFieldObj.title}</span>
                          <span className="text-xs font-mono text-[#86868B] bg-[#F5F5F7] border border-[#D2D2D7] px-1.5 py-0.5 rounded-md">
                            {mappedFieldObj.id}
                          </span>
                        </>
                      ) : (
                        <span className="text-[#86868B] italic">Комментарии лида (fallback)</span>
                      )}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${activeDropdown === key ? "rotate-180" : ""}`} />
                  </button>

                  {/* Dropdown overlay panel */}
                  <AnimatePresence>
                    {activeDropdown === key && (
                      <>
                        {/* Invisible screen mask */}
                        <div className="fixed inset-0 z-40" onClick={() => setActiveDropdown(null)} />

                        <motion.div
                          initial={{ opacity: 0, y: 8, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 8, scale: 0.98 }}
                          transition={{ duration: 0.15 }}
                          className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-[#D2D2D7] rounded-xl shadow-xl z-50 overflow-hidden"
                        >
                          {/* Search bar inside dropdown */}
                          <div className="p-2.5 border-b border-[#D2D2D7] flex items-center gap-2 bg-[#F5F5F7]">
                            <Search className="w-4 h-4 text-slate-400 shrink-0" />
                            <input
                              type="text"
                              placeholder="Поиск полей в CRM..."
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              className="w-full bg-transparent text-xs text-[#1D1D1F] placeholder-slate-400 outline-none"
                              autoFocus
                            />
                          </div>

                          {/* Options list */}
                          <div className="max-h-56 overflow-y-auto py-1 scrollbar-thin">
                            {/* Option 1: Comments (Default fallback) */}
                            <button
                              onClick={() => handleFieldMapChange(key as keyof FieldMapping, "COMMENTS")}
                              className={`w-full text-left px-4 py-2 hover:bg-[#F5F5F7] text-xs transition flex items-center justify-between ${
                                val === "COMMENTS" || !val ? "bg-[#00AEEF]/10 text-[#00AEEF] font-bold" : "text-slate-600"
                              }`}
                            >
                              <span className="italic">Записывать в Комментарии лида</span>
                              {(val === "COMMENTS" || !val) && <Check className="w-3.5 h-3.5 text-[#00AEEF]" />}
                            </button>

                            <div className="border-t border-[#D2D2D7] my-1" />

                            {/* Dynamically loaded options */}
                            {filteredCrmFields.length > 0 ? (
                              filteredCrmFields.map((field) => (
                                <button
                                  key={field.id}
                                  onClick={() => handleFieldMapChange(key as keyof FieldMapping, field.id)}
                                  className={`w-full text-left px-4 py-2 hover:bg-[#F5F5F7] text-xs transition flex items-center justify-between ${
                                    val === field.id ? "bg-[#00AEEF]/10 text-[#00AEEF] font-bold" : "text-slate-750"
                                  }`}
                                >
                                  <span className="truncate mr-4">
                                    <span className="font-bold">{field.title}</span>
                                    <span className="font-mono text-[10px] text-slate-400 ml-1.5">({field.id})</span>
                                  </span>
                                  {val === field.id && <Check className="w-3.5 h-3.5 text-[#00AEEF] shrink-0" />}
                                </button>
                              ))
                            ) : (
                              <div className="px-4 py-3 text-center text-xs text-slate-400 italic">
                                {loading ? "Загрузка полей..." : "Поля не найдены"}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
