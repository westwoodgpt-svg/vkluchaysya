import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  User, 
  Lightbulb, 
  Settings2, 
  ArrowRight, 
  ArrowLeft, 
  Send, 
  Check, 
  HelpCircle, 
  Briefcase, 
  Network,
  DollarSign, 
  Users, 
  Flame,
  CheckCircle,
  FileText,
  AlertCircle
} from "lucide-react";
import { IdeaForm, FieldMapping } from "../types";
import { adjustIframeHeight, RECOMMENDED_FIELDS } from "../utils/bx24";

interface LeadFormProps {
  initialForm: IdeaForm;
  mapping: FieldMapping;
  autoFilled: boolean;
  fieldsCreateError: string | null;
  onSubmit: (formData: IdeaForm) => Promise<{ ideaNumber: number; leadId?: number }>;
}

export default function LeadForm({ initialForm, mapping, autoFilled, fieldsCreateError, onSubmit }: LeadFormProps) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<IdeaForm>(initialForm);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [lastSubmittedIdeaNumber, setLastSubmittedIdeaNumber] = useState<number>(0);
  const [lastLeadId, setLastLeadId] = useState<number | undefined>(undefined);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Synced state on initial load
  useEffect(() => {
    setForm(initialForm);
  }, [initialForm]);

  // Readjust height on step changes
  useEffect(() => {
    adjustIframeHeight();
  }, [step, success, errorMsg]);

  // Categories & options lists
  const categories = [
    "Атмосфера и комфорт в офисе", 
    "Улучшение в процессах", 
    "Корпоративная культура"
  ];
  
  const audienceOptions = [
    "только мне", 
    "отдела", 
    "блока", 
    "всего Фонда"
  ];

  const implementationOptions = [
    { value: "да", label: "Да, полностью готов" },
    { value: "нужна команда от Фонда", label: "Нужна команда от Фонда" },
    { value: "нужны внешние исполнители", label: "Нужны внешние исполнители" }
  ];

  // Validation helpers
  const isStep1Valid = () => {
    return form.fullName.trim().length > 0 && 
           form.position.trim().length > 0 && 
           form.department.trim().length > 0;
  };

  const isStep2Valid = () => {
    return form.category.length > 0 && 
           form.ideaTitle.trim().length > 0 && 
           form.currentSituation.trim().length > 0 && 
           form.idea.trim().length > 0;
  };

  const isStep3Valid = () => {
    return form.needFinance.length > 0 && 
           form.audience.length > 0 && 
           form.implementation.length > 0;
  };

  const isFormValid = isStep1Valid() && isStep2Valid() && isStep3Valid();

  // Progress metrics
  const totalFields = 10;
  const getFilledCount = () => {
    let count = 0;
    if (form.fullName.trim()) count++;
    if (form.position.trim()) count++;
    if (form.department.trim()) count++;
    if (form.category) count++;
    if (form.ideaTitle.trim()) count++;
    if (form.currentSituation.trim()) count++;
    if (form.idea.trim()) count++;
    if (form.needFinance) count++;
    if (form.implementation) count++;
    if (form.audience) count++;
    return count;
  };

  const filledCount = getFilledCount();
  const progressPercent = Math.round((filledCount / totalFields) * 100);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

    setLoading(true);
    setErrorMsg(null);

    try {
      const result = await onSubmit(form);
      setLastSubmittedIdeaNumber(result.ideaNumber);
      setLastLeadId(result.leadId);
      setSuccess(true);
      
      // Reset form
      setForm({
        fullName: form.fullName, // Preserve identity
        position: form.position,
        department: form.department,
        category: "",
        ideaTitle: "",
        currentSituation: "",
        idea: "",
        materialsLink: "",
        needFinance: "",
        implementation: "",
        audience: ""
      });
      setStep(1);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Не удалось отправить идею в CRM Битрикс24. Попробуйте еще раз или обратитесь к администратору.");
    } finally {
      setLoading(false);
    }
  };

  // Check how many fields are mapped
  const mappedCount = Object.values(mapping).filter(v => v && v !== "COMMENTS").length;
  const isFullyComments = mappedCount === 0;

  return (
    <div className="max-w-3xl mx-auto">
      <AnimatePresence mode="wait">
        {!success ? (
          <motion.div
            key="form-container"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="bg-white rounded-3xl border border-[#D2D2D7] shadow-sm overflow-hidden"
          >
            {/* Header / Progress bar */}
            <div className="p-6 pb-4 border-b border-[#D2D2D7] bg-[#F5F5F7]/40">
              <div className="flex justify-between items-center text-xs text-[#86868B] font-semibold mb-2">
                <span className="uppercase tracking-wider">Шаг {step} из 3</span>
                <span>{filledCount} из {totalFields} полей заполнено ({progressPercent}%)</span>
              </div>
              <div className="h-2 w-full bg-[#E5E5E7] rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-[#00AEEF] rounded-full"
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-8">
              {errorMsg && (
                <div id="form-error" className="bg-rose-50 border border-rose-100 text-rose-800 rounded-2xl p-4 text-sm flex gap-3">
                  <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                  <p>{errorMsg}</p>
                </div>
              )}

              {/* Step 1: Author Info */}
              {step === 1 && (
                <motion.div
                  key="step-1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  <div className="flex items-center gap-3 pb-2 border-b border-[#D2D2D7]">
                    <div className="w-7 h-7 rounded-full bg-[#00AEEF]/10 text-[#00AEEF] flex items-center justify-center font-bold text-xs">1</div>
                    <h3 className="font-bold text-[#1D1D1F] text-lg">Информация об авторе</h3>
                    {autoFilled && (
                      <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-emerald-100">
                        <Check className="w-3 h-3" /> из профиля Б24
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div className="md:col-span-1 space-y-1.5">
                      <label className="text-[11px] font-bold text-[#86868B] uppercase px-1">ФИО *</label>
                      <div className="relative">
                        <User className="absolute left-4 top-3.5 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          required
                          placeholder="Иванов Иван Иванович"
                          value={form.fullName}
                          onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                          className="w-full pl-11 pr-4 py-3 bg-[#F5F5F7] border border-[#D2D2D7] focus:border-[#00AEEF] focus:ring-2 focus:ring-[#00AEEF]/20 focus:bg-white rounded-xl text-sm outline-none transition-all duration-200 text-[#1D1D1F] placeholder-slate-400 font-medium"
                        />
                      </div>
                    </div>

                    <div className="md:col-span-1 space-y-1.5">
                      <label className="text-[11px] font-bold text-[#86868B] uppercase px-1">Должность *</label>
                      <div className="relative">
                        <Briefcase className="absolute left-4 top-3.5 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          required
                          placeholder="Главный специалист"
                          value={form.position}
                          onChange={(e) => setForm({ ...form, position: e.target.value })}
                          className="w-full pl-11 pr-4 py-3 bg-[#F5F5F7] border border-[#D2D2D7] focus:border-[#00AEEF] focus:ring-2 focus:ring-[#00AEEF]/20 focus:bg-white rounded-xl text-sm outline-none transition-all duration-200 text-[#1D1D1F] placeholder-slate-400 font-medium"
                        />
                      </div>
                    </div>

                    <div className="md:col-span-1 space-y-1.5">
                      <label className="text-[11px] font-bold text-[#86868B] uppercase px-1">Отдел *</label>
                      <div className="relative">
                        <Network className="absolute left-4 top-3.5 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          required
                          placeholder="Департамент развития"
                          value={form.department}
                          onChange={(e) => setForm({ ...form, department: e.target.value })}
                          className="w-full pl-11 pr-4 py-3 bg-[#F5F5F7] border border-[#D2D2D7] focus:border-[#00AEEF] focus:ring-2 focus:ring-[#00AEEF]/20 focus:bg-white rounded-xl text-sm outline-none transition-all duration-200 text-[#1D1D1F] placeholder-slate-400 font-medium"
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Step 2: Idea Details */}
              {step === 2 && (
                <motion.div
                  key="step-2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  <div className="flex items-center gap-3 pb-2 border-b border-[#D2D2D7]">
                    <div className="w-7 h-7 rounded-full bg-[#00AEEF]/10 text-[#00AEEF] flex items-center justify-center font-bold text-xs">2</div>
                    <h3 className="font-bold text-[#1D1D1F] text-lg">Суть Вашей идеи</h3>
                  </div>

                  {/* Category selector */}
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-[#86868B] uppercase px-1">К какой категории относится Ваша идея? *</label>
                    <div className="flex flex-wrap gap-2">
                      {categories.map((c) => {
                        const isSelected = form.category === c;
                        return (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setForm({ ...form, category: c })}
                            className={`py-2 px-4 rounded-xl text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 border active:scale-95 ${
                              isSelected
                                ? "bg-[#00AEEF] border-[#00AEEF] text-white shadow-sm"
                                : "bg-white border-[#D2D2D7] text-[#1D1D1F] hover:bg-slate-50"
                            }`}
                          >
                            {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                            {c}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Title field */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-[#86868B] uppercase px-1">Название идеи *</label>
                    <input
                      type="text"
                      required
                      placeholder="Например: Оптимизация системы хранения архивных документов"
                      value={form.ideaTitle}
                      onChange={(e) => setForm({ ...form, ideaTitle: e.target.value })}
                      className="w-full px-4 py-3 bg-white border border-[#D2D2D7] focus:border-[#00AEEF] focus:ring-2 focus:ring-[#00AEEF]/20 rounded-xl text-sm outline-none transition-all duration-200 text-[#1D1D1F] placeholder-slate-400 font-medium"
                    />
                  </div>

                  {/* Current Situation and Proposal textareas */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-[#86868B] uppercase px-1">Опишите текущую ситуацию *</label>
                      <textarea
                        required
                        rows={4}
                        placeholder="Как процесс устроен сейчас? В чем основное затруднение, потеря времени или ресурсов?"
                        value={form.currentSituation}
                        onChange={(e) => setForm({ ...form, currentSituation: e.target.value })}
                        className="w-full px-4 py-3 bg-white border border-[#D2D2D7] focus:border-[#00AEEF] focus:ring-2 focus:ring-[#00AEEF]/20 rounded-xl text-sm outline-none transition-all duration-200 text-[#1D1D1F] placeholder-slate-400 font-medium resize-none leading-relaxed"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-[#86868B] uppercase px-1">Опишите Вашу идею *</label>
                      <textarea
                        required
                        rows={4}
                        placeholder="Что конкретно предлагаете сделать? Как изменится процесс, и какой эффект мы получим?"
                        value={form.idea}
                        onChange={(e) => setForm({ ...form, idea: e.target.value })}
                        className="w-full px-4 py-3 bg-white border border-[#D2D2D7] focus:border-[#00AEEF] focus:ring-2 focus:ring-[#00AEEF]/20 rounded-xl text-sm outline-none transition-all duration-200 text-[#1D1D1F] placeholder-slate-400 font-medium resize-none leading-relaxed"
                      />
                    </div>
                  </div>

                  {/* Attachment link */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-[11px] font-bold text-[#86868B] uppercase px-1">Ссылка на дополнительные материалы</label>
                      <span className="text-[10px] font-semibold text-[#86868B]">Необязательно</span>
                    </div>
                    <input
                      type="url"
                      placeholder="Ссылка на Диск, Схему, Презентацию или ТЗ (например, https://disk.yandex.ru/...)"
                      value={form.materialsLink}
                      onChange={(e) => setForm({ ...form, materialsLink: e.target.value })}
                      className="w-full px-4 py-3 bg-white border border-[#D2D2D7] focus:border-[#00AEEF] focus:ring-2 focus:ring-[#00AEEF]/20 rounded-xl text-sm outline-none transition-all duration-200 text-[#1D1D1F] placeholder-slate-400 font-medium"
                    />
                  </div>
                </motion.div>
              )}

              {/* Step 3: Implementation parameters */}
              {step === 3 && (
                <motion.div
                  key="step-3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  <div className="flex items-center gap-3 pb-2 border-b border-[#D2D2D7]">
                    <div className="w-7 h-7 rounded-full bg-[#00AEEF]/10 text-[#00AEEF] flex items-center justify-center font-bold text-xs">3</div>
                    <h3 className="font-bold text-[#1D1D1F] text-lg">Параметры внедрения</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Finance needs */}
                    <div className="space-y-2.5">
                      <label className="text-[11px] font-bold text-[#86868B] uppercase px-1 flex items-center gap-1.5">
                        <DollarSign className="w-4 h-4 text-[#86868B]" />
                        Требуются ли финансовые затраты? *
                      </label>
                      <div className="flex gap-2">
                        {["да", "нет"].map((opt) => {
                          const isSelected = form.needFinance === opt;
                          return (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => setForm({ ...form, needFinance: opt })}
                              className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1.5 border active:scale-95 capitalize ${
                                isSelected
                                  ? "bg-[#00AEEF] border-[#00AEEF] text-white shadow-sm"
                                  : "bg-white border-[#D2D2D7] text-[#1D1D1F] hover:bg-slate-50"
                              }`}
                            >
                              {isSelected && <Check className="w-4 h-4 shrink-0" />}
                              {opt === "да" ? "Да, требуются" : "Нет, без затрат"}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Audience option */}
                    <div className="space-y-2.5">
                      <label className="text-[11px] font-bold text-[#86868B] uppercase px-1 flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-[#86868B]" />
                        Для кого эта идея? *
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {audienceOptions.map((a) => {
                          const isSelected = form.audience === a;
                          return (
                            <button
                              key={a}
                              type="button"
                              onClick={() => setForm({ ...form, audience: a })}
                              className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-1.5 border active:scale-95 ${
                                isSelected
                                  ? "bg-[#00AEEF] border-[#00AEEF] text-white shadow-sm"
                                  : "bg-white border-[#D2D2D7] text-[#1D1D1F] hover:bg-slate-50"
                              }`}
                            >
                              {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                              {a}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Ready to implement himself */}
                  <div className="space-y-2.5 pt-2">
                    <label className="text-[11px] font-bold text-[#86868B] uppercase px-1 flex items-center gap-1.5">
                      <Flame className="w-4 h-4 text-[#86868B]" />
                      Готовы ли Вы самостоятельно внедрить идею? *
                    </label>
                    <div className="flex flex-col gap-2.5">
                      {implementationOptions.map((opt) => {
                        const isSelected = form.implementation === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setForm({ ...form, implementation: opt.value })}
                            className={`w-full py-3 px-5 rounded-xl text-sm font-bold transition-all duration-200 flex items-center gap-3 border active:scale-95 text-left ${
                              isSelected
                                ? "bg-[#00AEEF] border-[#00AEEF] text-white shadow-sm"
                                : "bg-white border-[#D2D2D7] text-[#1D1D1F] hover:bg-slate-50"
                            }`}
                          >
                            <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                              isSelected ? "border-white bg-white/20" : "border-[#D2D2D7]"
                            }`}>
                              {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
                            </span>
                            <span>{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* CRM mapping status (fields are created and mapped automatically) */}
                  {isFullyComments && (
                    <div id="mapping-warning-card" className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex gap-3 text-xs text-amber-900 leading-relaxed">
                      <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">Отдельные поля CRM пока не созданы</p>
                        <p className="mt-0.5 text-amber-800">
                          Идея сохранится в комментарий лида одним текстом. Чтобы данные раскладывались по отдельным полям
                          карточки, достаточно один раз открыть это приложение под пользователем с правами администратора CRM —
                          поля создадутся автоматически.
                        </p>
                        {fieldsCreateError && (
                          <p className="mt-1.5 font-mono text-[10px] text-amber-700/80">
                            Ответ Битрикс24: {fieldsCreateError}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {!isFullyComments && (
                    <div id="mapping-info-card" className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex gap-3 text-xs text-emerald-900 leading-relaxed">
                      <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">✨ Активная интеграция ячеек ({mappedCount} из {RECOMMENDED_FIELDS.length} полей)</p>
                        <p className="mt-0.5 text-emerald-800">
                          Параметры этой идеи будут записаны в соответствующие поля карточки лида в Вашем Битрикс24.
                          Это позволит строить отчетность и вести фильтрацию!
                        </p>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Navigation Actions */}
              <div className="flex justify-between items-center pt-4 border-t border-[#D2D2D7]">
                {step > 1 ? (
                  <button
                    type="button"
                    onClick={() => setStep(step - 1)}
                    className="px-5 py-2.5 hover:bg-slate-100 active:scale-95 transition text-[#86868B] hover:text-[#1D1D1F] font-bold rounded-full flex items-center gap-1.5 text-sm"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Назад
                  </button>
                ) : (
                  <div />
                )}

                {step < 3 ? (
                  <button
                    type="button"
                    onClick={() => setStep(step + 1)}
                    disabled={step === 1 ? !isStep1Valid() : !isStep2Valid()}
                    className="px-6 py-2.5 bg-[#1D1D1F] hover:bg-black active:scale-95 transition text-white font-bold rounded-full flex items-center gap-1.5 text-sm disabled:opacity-30 disabled:pointer-events-none"
                  >
                    Далее
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!isFormValid || loading}
                    className="px-6 py-2.5 bg-[#00AEEF] hover:bg-[#00AEEF]/90 active:scale-95 transition text-white font-bold rounded-full flex items-center gap-1.5 text-sm shadow-md shadow-[#00AEEF]/10 disabled:opacity-40"
                  >
                    {loading ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Отправка в CRM...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Подать идею
                      </>
                    )}
                  </button>
                )}
              </div>
            </form>
          </motion.div>
        ) : (
          /* GORGEOUS SUCCESS MODAL */
          <motion.div
            key="success-container"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-3xl border border-[#D2D2D7] shadow-xl p-8 text-center max-w-md mx-auto space-y-6"
          >
            <div className="mx-auto w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 border border-emerald-100 shadow-sm shadow-emerald-500/10">
              <Check className="w-8 h-8 animate-bounce" />
            </div>

            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-[#1D1D1F]">Идея успешно отправлена!</h3>
              <p className="text-[#86868B] text-sm leading-relaxed">
                Спасибо большое! Любое предложение по улучшению работы Фонда — это важный шаг вперёд для всей команды.
              </p>
            </div>

            <div className="bg-[#F5F5F7] rounded-2xl p-4.5 border border-[#D2D2D7] text-left space-y-2 font-medium text-xs text-[#1D1D1F]">
              <div className="flex justify-between items-center pb-2 border-b border-[#D2D2D7] text-[#86868B] uppercase tracking-wider font-semibold">
                <span>Информация о лиде CRM</span>
                <span className="text-emerald-600 font-bold">Активен</span>
              </div>
              <div className="flex justify-between pt-1">
                <span>Порядковый номер идеи:</span>
                <span className="font-bold text-[#1D1D1F]">№ {lastSubmittedIdeaNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>ID записи в Битрикс24:</span>
                <span className="font-mono text-[#1D1D1F] bg-[#E5E5E7] px-1.5 py-0.5 rounded-md">
                  {lastLeadId ? `LEAD_${lastLeadId}` : "Синхронизировано"}
                </span>
              </div>
            </div>

            <button
              onClick={() => setSuccess(false)}
              className="w-full py-3 px-4 bg-[#1D1D1F] hover:bg-black transition text-white font-semibold rounded-full active:scale-95 text-sm"
            >
              Отправить еще одну идею
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
