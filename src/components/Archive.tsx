import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Search, 
  Filter, 
  Calendar, 
  User, 
  MapPin, 
  Briefcase, 
  ExternalLink, 
  ChevronRight, 
  FileText, 
  DollarSign, 
  Users, 
  Flame, 
  Sparkles,
  ArrowRight,
  ClipboardList
} from "lucide-react";
import { ArchiveItem } from "../types";

interface ArchiveProps {
  archive: ArchiveItem[];
  onClearArchive?: () => void;
  onNavigateToForm: () => void;
}

export default function Archive({ archive, onClearArchive, onNavigateToForm }: ArchiveProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [activeItem, setActiveItem] = useState<ArchiveItem | null>(null);

  const categories = [
    { key: "all", label: "Все категории" },
    { key: "Атмосфера и комфорт в офисе", label: "Атмосфера и комфорт" },
    { key: "Улучшение в процессах", label: "Процессы" },
    { key: "Корпоративная культура", label: "Корпоративная культура" }
  ];

  // Filters logic
  const filteredItems = archive.filter((item) => {
    const matchesSearch = 
      item.ideaTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.idea.toLowerCase().includes(searchQuery.toLowerCase());
      
    const matchesCategory = 
      selectedCategory === "all" || 
      item.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  return (
    <div id="archive-tab" className="max-w-4xl mx-auto space-y-6">
      
      {/* Search & filters bar */}
      {archive.length > 0 && (
        <div className="bg-white rounded-3xl p-4.5 border border-[#D2D2D7] shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-4 top-3.5 w-4.5 h-4.5 text-slate-400" />
              <input
                type="text"
                placeholder="Поиск по названию, автору, отделу или сути идеи..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-[#F5F5F7] border border-[#D2D2D7] focus:border-[#00AEEF] focus:ring-2 focus:ring-[#00AEEF]/20 focus:bg-white rounded-xl text-sm outline-none transition-all duration-200 text-[#1D1D1F] placeholder-slate-400 font-medium"
              />
            </div>
            
            {/* Category filter scroll */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none items-center">
              {categories.map((cat) => {
                const isSelected = selectedCategory === cat.key;
                return (
                  <button
                    key={cat.key}
                    onClick={() => setSelectedCategory(cat.key)}
                    className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-semibold border transition active:scale-95 ${
                      isSelected
                        ? "bg-[#00AEEF] border-[#00AEEF] text-white"
                        : "bg-white border-[#D2D2D7] text-[#86868B] hover:border-slate-450 hover:text-[#1D1D1F]"
                    }`}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Main List / Empty State */}
      <AnimatePresence mode="wait">
        {filteredItems.length > 0 ? (
          <motion.div
            key="archive-list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            {filteredItems.map((item, index) => (
              <motion.div
                key={item.id || index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-white rounded-3xl p-5 border border-[#D2D2D7] hover:border-[#00AEEF] hover:shadow-md hover:shadow-[#00AEEF]/10 transition-all duration-300 flex flex-col justify-between group cursor-pointer"
                onClick={() => setActiveItem(item)}
              >
                <div className="space-y-3.5">
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#00AEEF] bg-[#00AEEF]/10 border border-[#00AEEF]/20 px-2 py-0.5 rounded-md leading-none">
                      {item.category || "Идея"}
                    </span>
                    <span className="text-[10px] font-mono text-[#86868B] font-medium">{item.date}</span>
                  </div>

                  <h4 className="font-bold text-[#1D1D1F] leading-snug group-hover:text-[#00AEEF] transition-colors text-base line-clamp-2">
                    Идея № {item.ideaNumber} — {item.ideaTitle}
                  </h4>

                  <p className="text-[#86868B] text-xs leading-relaxed line-clamp-3">
                    {item.idea}
                  </p>
                </div>

                <div className="mt-5 pt-3 border-t border-[#D2D2D7] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-slate-600 font-medium truncate">
                    <div className="w-5 h-5 bg-[#F5F5F7] text-[#1D1D1F] border border-[#D2D2D7] font-bold rounded-full flex items-center justify-center text-[10px]">
                      {item.fullName?.[0] || "U"}
                    </div>
                    <span className="truncate max-w-[120px] text-[#1D1D1F]">{item.fullName}</span>
                    <span className="text-slate-300">|</span>
                    <span className="text-[#86868B] text-[10px] truncate max-w-[80px]">{item.department}</span>
                  </div>

                  <span className="text-[#00AEEF] font-semibold inline-flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                    Подробнее
                    <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <motion.div
            key="empty-state"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl p-10 md:p-14 text-center border border-[#D2D2D7] shadow-sm max-w-lg mx-auto space-y-6"
          >
            <div className="mx-auto w-16 h-16 bg-[#F5F5F7] rounded-2xl flex items-center justify-center text-slate-400 border border-[#D2D2D7]">
              <ClipboardList className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-bold text-[#1D1D1F]">Архив идей пуст</h3>
              <p className="text-[#86868B] text-sm leading-relaxed">
                {archive.length === 0 
                  ? "Вы еще не отправляли идеи в текущей сессии работы. Все отправленные предложения будут надежно сохранены в истории!"
                  : "По заданным условиям поиска ничего не найдено. Попробуйте изменить параметры фильтрации или поисковый запрос."}
              </p>
            </div>

            {archive.length === 0 && (
              <button
                onClick={onNavigateToForm}
                className="inline-flex items-center gap-1.5 px-6 py-2.5 bg-[#1D1D1F] hover:bg-black text-white font-bold rounded-full active:scale-95 transition text-sm"
              >
                Подать первую идею
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* DETAIL DRAWER / MODAL CONTAINER */}
      <AnimatePresence>
        {activeItem && (
          <>
            {/* Screen Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-950 z-50 cursor-pointer"
              onClick={() => setActiveItem(null)}
            />

            {/* Slide-in Drawer */}
            <motion.div
              initial={{ x: "100%", opacity: 0.9 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "100%", opacity: 0.9 }}
              transition={{ type: "spring", damping: 26, stiffness: 220 }}
              className="fixed top-0 right-0 h-full w-full max-w-lg bg-white shadow-2xl z-50 flex flex-col justify-between overflow-hidden border-l border-[#D2D2D7]"
            >
              {/* Header */}
              <div className="p-6 border-b border-[#D2D2D7] flex justify-between items-center bg-[#F5F5F7]/40">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#00AEEF] bg-[#00AEEF]/10 border border-[#00AEEF]/20 px-2 py-0.5 rounded-md leading-none">
                    Идея № {activeItem.ideaNumber}
                  </span>
                  <h3 className="font-bold text-[#1D1D1F] text-lg mt-1 truncate max-w-[340px]">
                    {activeItem.ideaTitle}
                  </h3>
                </div>
                <button
                  onClick={() => setActiveItem(null)}
                  className="w-8 h-8 rounded-full bg-[#E5E5E7] hover:bg-[#D2D2D7] transition flex items-center justify-center text-[#1D1D1F] text-lg font-semibold"
                >
                  ×
                </button>
              </div>

              {/* Scrollable details container */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
                {/* Meta details */}
                <div className="flex items-center gap-3 text-xs text-[#86868B]">
                  <Calendar className="w-4 h-4" />
                  <span>Дата создания: <strong className="text-[#1D1D1F]">{activeItem.date}</strong></span>
                </div>

                {/* Section 1: Author */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-[#86868B] uppercase tracking-wider">Об авторе</h4>
                  <div className="grid grid-cols-2 gap-4 bg-[#F5F5F7] p-4 rounded-xl border border-[#D2D2D7] text-xs">
                    <div className="space-y-1">
                      <p className="text-[#86868B] font-medium">ФИО</p>
                      <p className="text-[#1D1D1F] font-bold">{activeItem.fullName}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[#86868B] font-medium">Отдел</p>
                      <p className="text-[#1D1D1F] font-bold">{activeItem.department}</p>
                    </div>
                    <div className="space-y-1 col-span-2">
                      <p className="text-[#86868B] font-medium">Должность</p>
                      <p className="text-[#1D1D1F] font-bold">{activeItem.position}</p>
                    </div>
                  </div>
                </div>

                {/* Section 2: Proposal content */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-[#86868B] uppercase tracking-wider">Суть предложения</h4>
                  
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-[#86868B] uppercase tracking-wide">Текущая ситуация</p>
                    <p className="text-sm text-[#1D1D1F] bg-[#F5F5F7]/40 p-4 rounded-xl border border-[#D2D2D7] leading-relaxed font-medium">
                      {activeItem.currentSituation}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-[#86868B] uppercase tracking-wide">Идея / Решение</p>
                    <p className="text-sm text-[#1D1D1F] bg-[#00AEEF]/5 p-4 rounded-xl border border-[#00AEEF]/25 leading-relaxed font-semibold">
                      {activeItem.idea}
                    </p>
                  </div>

                  {activeItem.materialsLink && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold text-[#86868B] uppercase tracking-wide">Материалы идеи</p>
                      <a 
                        href={activeItem.materialsLink} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="inline-flex items-center gap-1.5 py-2 px-4 bg-[#F5F5F7] border border-[#D2D2D7] hover:bg-[#E5E5E7] transition rounded-xl text-xs font-bold text-[#1D1D1F]"
                      >
                        Открыть вложения
                        <ExternalLink className="w-3.5 h-3.5 text-[#00AEEF]" />
                      </a>
                    </div>
                  )}
                </div>

                {/* Section 3: CRM Cells Structure */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-[#86868B] uppercase tracking-wider">Разметка ячеек в CRM Битрикс24</h4>
                  <div className="space-y-2.5">
                    
                    <div className="flex items-center justify-between p-3.5 bg-[#F5F5F7] rounded-xl border border-[#D2D2D7] text-xs">
                      <span className="text-[#86868B] font-semibold flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-[#00AEEF] shrink-0" />
                        Требуются ли финансы:
                      </span>
                      <span className="font-bold text-[#1D1D1F] bg-white border border-[#D2D2D7] px-2.5 py-1 rounded-full uppercase text-[10px]">
                        {activeItem.needFinance}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-3.5 bg-[#F5F5F7] rounded-xl border border-[#D2D2D7] text-xs">
                      <span className="text-[#86868B] font-semibold flex items-center gap-2">
                        <Users className="w-4 h-4 text-[#00AEEF] shrink-0" />
                        Целевая аудитория:
                      </span>
                      <span className="font-bold text-[#1D1D1F] bg-white border border-[#D2D2D7] px-2.5 py-1 rounded-full uppercase text-[10px]">
                        {activeItem.audience}
                      </span>
                    </div>

                    <div className="flex flex-col gap-1 p-3.5 bg-[#F5F5F7] rounded-xl border border-[#D2D2D7] text-xs">
                      <span className="text-[#86868B] font-semibold flex items-center gap-2 mb-1.5">
                        <Flame className="w-4 h-4 text-[#00AEEF] shrink-0" />
                        Готовность к внедрению:
                      </span>
                      <span className="font-bold text-[#1D1D1F] bg-white border border-[#D2D2D7] px-3 py-1.5 rounded-xl self-start">
                        {activeItem.implementation === "да" ? "Да, полностью самостоятельно" : activeItem.implementation}
                      </span>
                    </div>

                  </div>
                </div>

              </div>

              {/* Footer */}
              <div className="p-5.5 border-t border-[#D2D2D7] bg-[#F5F5F7]/40">
                <button
                  onClick={() => setActiveItem(null)}
                  className="w-full py-3 px-4 bg-[#1D1D1F] hover:bg-black transition text-white font-bold rounded-full text-sm"
                >
                  Закрыть детали
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
