import { useState, useEffect } from "react";
import type { ScheduleItem, DayOfWeek, Class } from "@/types";
import { getClassSchedule, saveClassSchedule, generateDefaultSchedule } from "@/lib/firestore";
import { useToast } from "@/hooks/use-toast";

interface StudentSchedulePanelProps {
  gradeLevel?: string | null;
  studentClasses?: Class[];
}

const DAY_LABELS: Record<DayOfWeek, { thai: string; short: string; color: string }> = {
  monday: { thai: "วันจันทร์", short: "จันทร์", color: "text-amber-600 bg-amber-50 border-amber-200" },
  tuesday: { thai: "วันอังคาร", short: "อังคาร", color: "text-pink-600 bg-pink-50 border-pink-200" },
  wednesday: { thai: "วันพุธ", short: "พุธ", color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  thursday: { thai: "วันพฤหัสบดี", short: "พฤหัสฯ", color: "text-orange-600 bg-orange-50 border-orange-200" },
  friday: { thai: "วันศุกร์", short: "ศุกร์", color: "text-blue-600 bg-blue-50 border-blue-200" },
};

const COLOR_CLASSES: Record<string, { bg: string; text: string; border: string; badge: string }> = {
  emerald: { bg: "bg-emerald-50/80", text: "text-emerald-900", border: "border-emerald-200", badge: "bg-emerald-100 text-emerald-800" },
  blue: { bg: "bg-blue-50/80", text: "text-blue-900", border: "border-blue-200", badge: "bg-blue-100 text-blue-800" },
  purple: { bg: "bg-purple-50/80", text: "text-purple-900", border: "border-purple-200", badge: "bg-purple-100 text-purple-800" },
  amber: { bg: "bg-amber-50/80", text: "text-amber-900", border: "border-amber-200", badge: "bg-amber-100 text-amber-800" },
  rose: { bg: "bg-rose-50/80", text: "text-rose-900", border: "border-rose-200", badge: "bg-rose-100 text-rose-800" },
  teal: { bg: "bg-teal-50/80", text: "text-teal-900", border: "border-teal-200", badge: "bg-teal-100 text-teal-800" },
  indigo: { bg: "bg-indigo-50/80", text: "text-indigo-900", border: "border-indigo-200", badge: "bg-indigo-100 text-indigo-800" },
};

function getTodayDayOfWeek(): DayOfWeek {
  const d = new Date().getDay();
  if (d === 1) return "monday";
  if (d === 2) return "tuesday";
  if (d === 3) return "wednesday";
  if (d === 4) return "thursday";
  if (d === 5) return "friday";
  return "monday"; // Default weekend to Monday
}

function isToday(day: DayOfWeek): boolean {
  const d = new Date().getDay();
  const map: Record<number, DayOfWeek> = { 1: "monday", 2: "tuesday", 3: "wednesday", 4: "thursday", 5: "friday" };
  return map[d] === day;
}

function getPeriodStatus(item: ScheduleItem, currentDay: DayOfWeek): "ongoing" | "past" | "upcoming" {
  if (!isToday(currentDay)) return "upcoming";

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [sH, sM] = item.startTime.split(":").map(Number);
  const [eH, eM] = item.endTime.split(":").map(Number);
  const startMin = sH * 60 + sM;
  const endMin = eH * 60 + eM;

  if (currentMinutes >= startMin && currentMinutes <= endMin) return "ongoing";
  if (currentMinutes > endMin) return "past";
  return "upcoming";
}

export function StudentSchedulePanel({ gradeLevel, studentClasses = [] }: StudentSchedulePanelProps) {
  const { toast } = useToast();
  const todayDay = getTodayDayOfWeek();
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(todayDay);
  const [viewMode, setViewMode] = useState<"daily" | "weekly">("daily");
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit Modal State
  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [saving, setSaving] = useState(false);

  const resolvedGrade = gradeLevel || (studentClasses.length > 0 ? studentClasses[0].gradeLevel : "ม.2/1");

  useEffect(() => {
    let isMounted = true;
    async function load() {
      setLoading(true);
      try {
        const items = await getClassSchedule(resolvedGrade, studentClasses);
        if (isMounted) setScheduleItems(items);
      } catch (err) {
        console.error("Load schedule error:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [resolvedGrade, studentClasses]);

  const currentDayItems = scheduleItems
    .filter((item) => item.day === selectedDay)
    .sort((a, b) => a.period - b.period);

  const morningItems = currentDayItems.filter((i) => i.period <= 4);
  const afternoonItems = currentDayItems.filter((i) => i.period >= 5);

  async function handleSaveItem(e: React.FormEvent) {
    e.preventDefault();
    if (!editingItem) return;

    setSaving(true);
    try {
      let updated: ScheduleItem[];
      if (isAddingNew) {
        updated = [...scheduleItems, { ...editingItem, id: `${editingItem.day}_p${editingItem.period}_${Date.now()}` }];
      } else {
        updated = scheduleItems.map((it) => (it.id === editingItem.id ? editingItem : it));
      }
      await saveClassSchedule(resolvedGrade, updated);
      setScheduleItems(updated);
      toast({ title: "บันทึกตารางเรียนสำเร็จ" });
      setEditingItem(null);
      setIsAddingNew(false);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "บันทึกไม่สำเร็จ",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteItem(itemId: string) {
    if (!confirm("คุณต้องการลบคาบเรียนนี้ออกจากตารางใช่หรือไม่?")) return;
    try {
      const updated = scheduleItems.filter((it) => it.id !== itemId);
      await saveClassSchedule(resolvedGrade, updated);
      setScheduleItems(updated);
      toast({ title: "ลบคาบเรียนสำเร็จ" });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "ลบไม่สำเร็จ",
      });
    }
  }

  async function handleResetDefault() {
    if (!confirm("ต้องการรีเซ็ตตารางเรียนกลับเป็นตารางมาตรฐานของระดับชั้นนี้หรือไม่?")) return;
    try {
      const defaults = generateDefaultSchedule(resolvedGrade, studentClasses);
      await saveClassSchedule(resolvedGrade, defaults);
      setScheduleItems(defaults);
      toast({ title: "รีเซ็ตตารางเรียนสำเร็จ" });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "รีเซ็ตไม่สำเร็จ",
      });
    }
  }

  return (
    <div className="glass-panel rounded-3xl p-6 sm:p-8 mb-8 border border-border shadow-sm animate-fade-in-up">
      {/* Top Header of Schedule */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center text-lg">
              <i className="fa-solid fa-calendar-days" />
            </span>
            <h2 className="text-xl font-bold text-foreground">ตารางเรียนประจำวัน</h2>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1.5 shadow-xs">
              <i className="fa-solid fa-door-open text-emerald-600" />
              ห้อง / ชั้น: {resolvedGrade}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-2">
            <span>ตารางเรียนและคาบสอนสำหรับนักเรียนชั้น {resolvedGrade}</span>
            {isToday(selectedDay) && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                วันนี้
              </span>
            )}
          </p>
        </div>

        {/* View Switcher & Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-xl border border-border bg-muted/40 p-1 text-xs">
            <button
              onClick={() => setViewMode("daily")}
              className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
                viewMode === "daily" ? "bg-background text-foreground shadow-xs font-semibold" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <i className="fa-solid fa-list-ul" />
              รายวัน
            </button>
            <button
              onClick={() => setViewMode("weekly")}
              className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
                viewMode === "weekly" ? "bg-background text-foreground shadow-xs font-semibold" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <i className="fa-solid fa-table-cells" />
              ทั้งสัปดาห์
            </button>
          </div>

          <button
            onClick={() => {
              setIsAddingNew(true);
              setEditingItem({
                id: `new_${Date.now()}`,
                day: selectedDay,
                period: currentDayItems.length + 1,
                startTime: "08:30",
                endTime: "09:20",
                subjectName: "",
                subjectCode: "",
                teacherName: "",
                room: `ห้อง ${resolvedGrade}`,
                color: "emerald",
              });
            }}
            className="px-3 py-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
            title="เพิ่มคาบเรียนใหม่"
          >
            <i className="fa-solid fa-plus" />
            <span>เพิ่มวิชา</span>
          </button>

          <button
            onClick={handleResetDefault}
            className="px-2.5 py-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60 text-xs font-medium transition flex items-center gap-1 cursor-pointer"
            title="รีเซ็ตกลับเป็นตารางมาตรฐาน"
          >
            <i className="fa-solid fa-arrow-rotate-left text-xs" />
          </button>
        </div>
      </div>

      {/* Daily View Mode */}
      {viewMode === "daily" && (
        <div className="mt-5 space-y-6">
          {/* Day of Week Selector Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {(["monday", "tuesday", "wednesday", "thursday", "friday"] as DayOfWeek[]).map((day) => {
              const isSelected = selectedDay === day;
              const isCurrent = isToday(day);
              const dayMeta = DAY_LABELS[day];

              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2 shrink-0 border cursor-pointer ${
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/20"
                      : "bg-card text-foreground hover:bg-muted border-border"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${isCurrent ? "bg-emerald-400 ring-2 ring-emerald-300/50" : "bg-slate-300"}`} />
                  <span>{dayMeta.thai}</span>
                  {isCurrent && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${isSelected ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-800"}`}>
                      วันนี้
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {loading ? (
            <div className="py-12 text-center text-muted-foreground text-sm flex items-center justify-center gap-2">
              <i className="fa-solid fa-circle-notch fa-spin text-primary" />
              กำลังโหลดตารางเรียน...
            </div>
          ) : currentDayItems.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <i className="fa-solid fa-calendar-xmark text-3xl mb-2 text-muted-foreground/40 block" />
              ยังไม่มีตารางเรียนสำหรับ{DAY_LABELS[selectedDay].thai}
              <div className="mt-3">
                <button
                  onClick={handleResetDefault}
                  className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold"
                >
                  โหลดตารางมาตรฐาน
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Morning Session Banner */}
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <i className="fa-solid fa-sun text-amber-500" /> คาบเรียนช่วงเช้า
                </span>
                <div className="flex-1 border-t border-border" />
              </div>

              {/* Assembly card */}
              <div className="p-3.5 rounded-2xl border border-dashed border-border bg-muted/20 flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-3">
                  <span className="px-2 py-0.5 rounded-md bg-muted font-mono font-semibold text-[11px]">
                    08:00 - 08:30
                  </span>
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <i className="fa-solid fa-flag text-rose-500" />
                    เข้าแถวเคารพธงชาติ & กิจกรรมโฮมรูม
                  </span>
                </div>
                <span className="text-[11px] text-muted-foreground">ลานกิจกรรม / หน้าเสาธง</span>
              </div>

              {/* Morning Periods */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {morningItems.map((item) => {
                  const status = getPeriodStatus(item, selectedDay);
                  const colorTheme = COLOR_CLASSES[item.color || "emerald"] || COLOR_CLASSES.emerald;

                  return (
                    <div
                      key={item.id}
                      className={`p-4 rounded-2xl border transition-all ${colorTheme.bg} ${colorTheme.border} ${
                        status === "ongoing"
                          ? "ring-2 ring-emerald-500 shadow-md shadow-emerald-500/10 scale-[1.01]"
                          : "hover:shadow-sm"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg ${colorTheme.badge}`}>
                            คาบ {item.period}
                          </span>
                          <span className="text-xs font-mono font-semibold text-muted-foreground">
                            {item.startTime} - {item.endTime} น.
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {status === "ongoing" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white animate-pulse">
                              <span className="w-1.5 h-1.5 rounded-full bg-white" />
                              กำลังเรียน
                            </span>
                          )}
                          <button
                            onClick={() => {
                              setIsAddingNew(false);
                              setEditingItem(item);
                            }}
                            className="w-6 h-6 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center text-muted-foreground hover:text-foreground text-[11px] transition cursor-pointer"
                            title="แก้ไขคาบนี้"
                          >
                            <i className="fa-solid fa-pen" />
                          </button>
                        </div>
                      </div>

                      <div className="mb-2">
                        <div className="flex items-center gap-2">
                          <h4 className={`text-base font-bold ${colorTheme.text}`}>{item.subjectName}</h4>
                          {item.subjectCode && (
                            <span className="text-[11px] font-mono text-muted-foreground font-semibold">
                              ({item.subjectCode})
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-black/5 dark:border-white/5">
                        <span className="flex items-center gap-1.5 truncate max-w-[160px]">
                          <i className="fa-solid fa-chalkboard-user text-primary" />
                          {item.teacherName || "ครูผู้สอน"}
                        </span>
                        <span className="flex items-center gap-1.5 font-medium">
                          <i className="fa-solid fa-door-open text-muted-foreground" />
                          {item.room || `ห้อง ${resolvedGrade}`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Lunch Break Card */}
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-700 dark:text-amber-300 text-sm">
                    <i className="fa-solid fa-utensils" />
                  </span>
                  <div>
                    <h5 className="font-bold">พักรับประทานอาหารกลางวัน</h5>
                    <p className="text-[11px] opacity-80">เวลา 12:00 - 13:00 น. &middot; โรงอาหารกลาง</p>
                  </div>
                </div>
                <span className="font-semibold text-[11px] px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30">
                  พักกลางวัน 60 นาที
                </span>
              </div>

              {/* Afternoon Session Banner */}
              {afternoonItems.length > 0 && (
                <>
                  <div className="flex items-center gap-3 pt-2">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <i className="fa-solid fa-cloud-sun text-teal-500" /> คาบเรียนช่วงบ่าย
                    </span>
                    <div className="flex-1 border-t border-border" />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {afternoonItems.map((item) => {
                      const status = getPeriodStatus(item, selectedDay);
                      const colorTheme = COLOR_CLASSES[item.color || "teal"] || COLOR_CLASSES.teal;

                      return (
                        <div
                          key={item.id}
                          className={`p-4 rounded-2xl border transition-all ${colorTheme.bg} ${colorTheme.border} ${
                            status === "ongoing"
                              ? "ring-2 ring-emerald-500 shadow-md shadow-emerald-500/10 scale-[1.01]"
                              : "hover:shadow-sm"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg ${colorTheme.badge}`}>
                                คาบ {item.period}
                              </span>
                              <span className="text-xs font-mono font-semibold text-muted-foreground">
                                {item.startTime} - {item.endTime} น.
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5">
                              {status === "ongoing" && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white animate-pulse">
                                  <span className="w-1.5 h-1.5 rounded-full bg-white" />
                                  กำลังเรียน
                                </span>
                              )}
                              <button
                                onClick={() => {
                                  setIsAddingNew(false);
                                  setEditingItem(item);
                                }}
                                className="w-6 h-6 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center text-muted-foreground hover:text-foreground text-[11px] transition cursor-pointer"
                                title="แก้ไขคาบนี้"
                              >
                                <i className="fa-solid fa-pen" />
                              </button>
                            </div>
                          </div>

                          <div className="mb-2">
                            <div className="flex items-center gap-2">
                              <h4 className={`text-base font-bold ${colorTheme.text}`}>{item.subjectName}</h4>
                              {item.subjectCode && (
                                <span className="text-[11px] font-mono text-muted-foreground font-semibold">
                                  ({item.subjectCode})
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-black/5 dark:border-white/5">
                            <span className="flex items-center gap-1.5 truncate max-w-[160px]">
                              <i className="fa-solid fa-chalkboard-user text-primary" />
                              {item.teacherName || "ครูผู้สอน"}
                            </span>
                            <span className="flex items-center gap-1.5 font-medium">
                              <i className="fa-solid fa-door-open text-muted-foreground" />
                              {item.room || `ห้อง ${resolvedGrade}`}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Weekly View Mode */}
      {viewMode === "weekly" && (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[700px]">
            <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
              <tr>
                <th className="py-3 px-3 w-28">วัน</th>
                {[1, 2, 3, 4, 5, 6, 7].map((p) => (
                  <th key={p} className="py-3 px-2 text-center">
                    คาบ {p}
                    <div className="text-[10px] font-normal text-muted-foreground font-mono">
                      {p === 1 && "08:30"}
                      {p === 2 && "09:20"}
                      {p === 3 && "10:20"}
                      {p === 4 && "11:10"}
                      {p === 5 && "13:00"}
                      {p === 6 && "13:50"}
                      {p === 7 && "14:40"}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(["monday", "tuesday", "wednesday", "thursday", "friday"] as DayOfWeek[]).map((day) => {
                const dayMeta = DAY_LABELS[day];
                const dayItems = scheduleItems.filter((i) => i.day === day);
                const isCurrent = isToday(day);

                return (
                  <tr key={day} className={`hover:bg-muted/20 transition ${isCurrent ? "bg-emerald-500/5 font-medium" : ""}`}>
                    <td className="py-3 px-3 font-semibold">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${isCurrent ? "bg-emerald-500" : "bg-slate-300"}`} />
                        <span>{dayMeta.thai}</span>
                      </div>
                    </td>
                    {[1, 2, 3, 4, 5, 6, 7].map((p) => {
                      const item = dayItems.find((it) => it.period === p);
                      if (!item) {
                        return (
                          <td key={p} className="py-3 px-2 text-center text-muted-foreground/40 text-[11px]">
                            -
                          </td>
                        );
                      }
                      const colorTheme = COLOR_CLASSES[item.color || "emerald"] || COLOR_CLASSES.emerald;

                      return (
                        <td key={p} className="py-2 px-1 text-center">
                          <div
                            onClick={() => {
                              setIsAddingNew(false);
                              setEditingItem(item);
                            }}
                            className={`p-2 rounded-xl text-left cursor-pointer transition hover:scale-[1.02] border ${colorTheme.bg} ${colorTheme.border}`}
                          >
                            <div className="font-bold text-xs truncate max-w-[110px]">{item.subjectName}</div>
                            <div className="text-[10px] text-muted-foreground truncate">{item.teacherName}</div>
                            <div className="text-[9px] text-muted-foreground font-mono mt-0.5">{item.room}</div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit / Add Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="rounded-3xl p-6 sm:p-7 w-full max-w-md bg-card text-card-foreground border border-border shadow-2xl relative z-10 animate-scale-in">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-foreground">
                {isAddingNew ? "เพิ่มวิชาในตารางเรียน" : "แก้ไขคาบเรียน"}
              </h3>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition cursor-pointer"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">วันในสัปดาห์</label>
                  <select
                    value={editingItem.day}
                    onChange={(e) => setEditingItem({ ...editingItem, day: e.target.value as DayOfWeek })}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground"
                  >
                    <option value="monday">วันจันทร์</option>
                    <option value="tuesday">วันอังคาร</option>
                    <option value="wednesday">วันพุธ</option>
                    <option value="thursday">วันพฤหัสบดี</option>
                    <option value="friday">วันศุกร์</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">คาบที่</label>
                  <select
                    value={editingItem.period}
                    onChange={(e) => setEditingItem({ ...editingItem, period: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground"
                  >
                    {[1, 2, 3, 4, 5, 6, 7].map((p) => (
                      <option key={p} value={p}>
                        คาบ {p}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">เวลาเริ่ม</label>
                  <input
                    type="time"
                    required
                    value={editingItem.startTime}
                    onChange={(e) => setEditingItem({ ...editingItem, startTime: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">เวลาสิ้นสุด</label>
                  <input
                    type="time"
                    required
                    value={editingItem.endTime}
                    onChange={(e) => setEditingItem({ ...editingItem, endTime: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">ชื่อวิชา / กิจกรรม</label>
                <input
                  type="text"
                  required
                  placeholder="เช่น คณิตศาสตร์พื้นฐาน หรือ ภาษาอังกฤษ"
                  value={editingItem.subjectName}
                  onChange={(e) => setEditingItem({ ...editingItem, subjectName: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">รหัสวิชา (ไม่บังคับ)</label>
                  <input
                    type="text"
                    placeholder="เช่น ค22101"
                    value={editingItem.subjectCode || ""}
                    onChange={(e) => setEditingItem({ ...editingItem, subjectCode: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">ห้องเรียน / อาคาร</label>
                  <input
                    type="text"
                    placeholder="เช่น ห้อง 214"
                    value={editingItem.room || ""}
                    onChange={(e) => setEditingItem({ ...editingItem, room: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">ครูผู้สอน</label>
                <input
                  type="text"
                  placeholder="เช่น ครูสมหมาย หรือ ครูประจำวิชา"
                  value={editingItem.teacherName || ""}
                  onChange={(e) => setEditingItem({ ...editingItem, teacherName: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-border gap-2">
                {!isAddingNew ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteItem(editingItem.id)}
                    className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 transition font-medium cursor-pointer"
                  >
                    <i className="fa-solid fa-trash mr-1" /> ลบคาบนี้
                  </button>
                ) : (
                  <div />
                )}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingItem(null)}
                    className="px-3.5 py-2 rounded-xl hover:bg-muted text-foreground transition font-medium cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition shadow-sm cursor-pointer disabled:opacity-60 flex items-center gap-1.5"
                  >
                    {saving && <i className="fa-solid fa-circle-notch fa-spin text-xs" />}
                    บันทึก
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
