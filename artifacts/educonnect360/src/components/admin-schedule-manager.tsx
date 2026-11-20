import { useState, useEffect } from "react";
import type { ScheduleItem, DayOfWeek, User } from "@/types";
import {
  getClassSchedule,
  saveClassSchedule,
  generateDefaultSchedule,
  getAllTeachers,
  getTeacherSchedule,
  saveTeacherSchedule,
  generateDefaultTeacherSchedule,
} from "@/lib/firestore";
import { useToast } from "@/hooks/use-toast";

const GRADES = [
  { key: "ม.1", label: "มัธยมศึกษาปีที่ 1 (ม.1)", sub: "ม.ต้น ปี 1" },
  { key: "ม.2", label: "มัธยมศึกษาปีที่ 2 (ม.2)", sub: "ม.ต้น ปี 2" },
  { key: "ม.3", label: "มัธยมศึกษาปีที่ 3 (ม.3)", sub: "ม.ต้น ปี 3" },
  { key: "ม.4", label: "มัธยมศึกษาปีที่ 4 (ม.4)", sub: "ม.ปลาย ปี 1 (วิทย์-คณิต / ทั่วไป)" },
  { key: "ม.5", label: "มัธยมศึกษาปีที่ 5 (ม.5)", sub: "ม.ปลาย ปี 2" },
  { key: "ม.6", label: "มัธยมศึกษาปีที่ 6 (ม.6)", sub: "ม.ปลาย ปี 3 (เตรียมสอบ TCAS)" },
];

const DAYS: Array<{ key: DayOfWeek; thai: string; short: string }> = [
  { key: "monday", thai: "วันจันทร์", short: "จันทร์" },
  { key: "tuesday", thai: "วันอังคาร", short: "อังคาร" },
  { key: "wednesday", thai: "วันพุธ", short: "พุธ" },
  { key: "thursday", thai: "วันพฤหัสบดี", short: "พฤหัสฯ" },
  { key: "friday", thai: "วันศุกร์", short: "ศุกร์" },
];

const COLOR_CLASSES: Record<string, { bg: string; text: string; border: string; badge: string }> = {
  emerald: { bg: "bg-emerald-50/90", text: "text-emerald-950", border: "border-emerald-200", badge: "bg-emerald-100 text-emerald-800" },
  blue: { bg: "bg-blue-50/90", text: "text-blue-950", border: "border-blue-200", badge: "bg-blue-100 text-blue-800" },
  purple: { bg: "bg-purple-50/90", text: "text-purple-950", border: "border-purple-200", badge: "bg-purple-100 text-purple-800" },
  amber: { bg: "bg-amber-50/90", text: "text-amber-950", border: "border-amber-200", badge: "bg-amber-100 text-amber-800" },
  rose: { bg: "bg-rose-50/90", text: "text-rose-950", border: "border-rose-200", badge: "bg-rose-100 text-rose-800" },
  teal: { bg: "bg-teal-50/90", text: "text-teal-950", border: "border-teal-200", badge: "bg-teal-100 text-teal-800" },
  indigo: { bg: "bg-indigo-50/90", text: "text-indigo-950", border: "border-indigo-200", badge: "bg-indigo-100 text-indigo-800" },
};

export function AdminScheduleManager() {
  const { toast } = useToast();
  // Type switcher: Student Timetable vs Teacher Teaching Schedule
  const [scheduleType, setScheduleType] = useState<"student" | "teacher">("student");

  // Student schedule state
  const [selectedGrade, setSelectedGrade] = useState("ม.2");
  const [customRoom, setCustomRoom] = useState("");

  // Teacher schedule state
  const [teachers, setTeachers] = useState<User[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [selectedTeacher, setSelectedTeacher] = useState<User | null>(null);

  // Common timetable state
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>("monday");
  const [viewMode, setViewMode] = useState<"daily" | "weekly">("daily");
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Modal State
  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  const activeGradeKey = customRoom.trim() || selectedGrade;

  // Load teachers on mount
  useEffect(() => {
    async function loadTeachers() {
      try {
        const list = await getAllTeachers();
        setTeachers(list);
        if (list.length > 0 && !selectedTeacherId) {
          setSelectedTeacherId(list[0].id);
          setSelectedTeacher(list[0]);
        }
      } catch (err) {
        console.warn("Error loading teachers for schedule manager:", err);
      }
    }
    loadTeachers();
  }, []);

  // Sync selectedTeacher when selectedTeacherId changes
  useEffect(() => {
    const found = teachers.find((t) => t.id === selectedTeacherId);
    if (found) setSelectedTeacher(found);
  }, [selectedTeacherId, teachers]);

  // Load timetable items based on scheduleType
  useEffect(() => {
    let isMounted = true;
    async function load() {
      setLoading(true);
      try {
        let items: ScheduleItem[];
        if (scheduleType === "teacher") {
          if (selectedTeacherId) {
            items = await getTeacherSchedule(selectedTeacherId, selectedTeacher);
          } else {
            items = [];
          }
        } else {
          items = await getClassSchedule(activeGradeKey);
        }
        if (isMounted) setScheduleItems(items);
      } catch (err) {
        console.error("Load schedule in admin error:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [scheduleType, activeGradeKey, selectedTeacherId, selectedTeacher]);

  const currentDayItems = scheduleItems
    .filter((it) => it.day === selectedDay)
    .sort((a, b) => a.period - b.period);

  async function handleSaveAll() {
    setSaving(true);
    try {
      if (scheduleType === "teacher") {
        if (!selectedTeacherId) return;
        const tName = selectedTeacher?.fullName || selectedTeacher?.displayName || "คุณครู";
        await saveTeacherSchedule(selectedTeacherId, scheduleItems, tName);
        toast({
          title: "บันทึกตารางสอนสำเร็จ",
          description: `ตารางสอนของคุณครู ${tName} ถูกบันทึกเรียบร้อยแล้ว`,
        });
      } else {
        await saveClassSchedule(activeGradeKey, scheduleItems);
        toast({
          title: "บันทึกตารางเรียนสำเร็จ",
          description: `ตารางเรียนของ ${activeGradeKey} ถูกบันทึกและอัปเดตเรียบร้อยแล้ว`,
        });
      }
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

  async function handleResetDefault() {
    if (scheduleType === "teacher") {
      const tName = selectedTeacher?.fullName || selectedTeacher?.displayName || "คุณครู";
      if (!confirm(`คุณต้องการโหลดตารางสอนมาตรฐานสำหรับคุณครู ${tName} หรือไม่?`)) return;
      const defaults = generateDefaultTeacherSchedule(selectedTeacher || { displayName: tName });
      setScheduleItems(defaults);
      try {
        await saveTeacherSchedule(selectedTeacherId, defaults, tName);
        toast({
          title: "โหลดตารางสอนมาตรฐานสำเร็จ",
          description: `โหลดข้อมูลตารางสอนมาตรฐานสำหรับ ${tName} เรียบร้อยแล้ว`,
        });
      } catch (err) {
        toast({
          variant: "destructive",
          title: "รีเซ็ตไม่สำเร็จ",
        });
      }
    } else {
      if (!confirm(`คุณต้องการโหลดข้อมูลตารางเรียนมาตรฐานสำหรับ ${selectedGrade} หรือไม่? ข้อมูลเดิมจะถูกเขียนทับ`)) return;
      const defaults = generateDefaultSchedule(selectedGrade);
      setScheduleItems(defaults);
      try {
        await saveClassSchedule(activeGradeKey, defaults);
        toast({
          title: "โหลดตารางมาตรฐานสำเร็จ",
          description: `โหลดข้อมูลตารางเรียนมาตรฐานระดับชั้น ${selectedGrade} เรียบร้อยแล้ว`,
        });
      } catch (err) {
        toast({
          variant: "destructive",
          title: "รีเซ็ตไม่สำเร็จ",
        });
      }
    }
  }

  function handleModalSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingItem) return;

    let updated: ScheduleItem[];
    if (isAddingNew) {
      const newItem: ScheduleItem = {
        ...editingItem,
        id: `${editingItem.day}_p${editingItem.period}_${Date.now()}`,
      };
      updated = [...scheduleItems, newItem];
    } else {
      updated = scheduleItems.map((it) => (it.id === editingItem.id ? editingItem : it));
    }

    setScheduleItems(updated);
    setEditingItem(null);
    setIsAddingNew(false);
    toast({ title: "อัปเดตข้อมูลคาบเรียนแล้ว (อย่าลืมกดบันทึกตารางเรียนด้านบน)" });
  }

  function handleDeleteItem(itemId: string) {
    setScheduleItems((prev) => prev.filter((it) => it.id !== itemId));
    toast({ title: "ลบคาบเรียนออกจากตารางแล้ว" });
  }

  const activeTargetName =
    scheduleType === "teacher"
      ? selectedTeacher?.fullName || selectedTeacher?.displayName || "คุณครู"
      : activeGradeKey;

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Schedule Type Mode Switcher */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-100 rounded-2xl border border-slate-200/80 w-fit">
        <button
          onClick={() => setScheduleType("student")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            scheduleType === "student"
              ? "bg-white text-emerald-800 shadow-xs border border-slate-200"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <i className="fa-solid fa-graduation-cap text-emerald-600" />
          <span>ตารางเรียนนักเรียน (ม.1 - ม.6)</span>
        </button>

        <button
          onClick={() => setScheduleType("teacher")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            scheduleType === "teacher"
              ? "bg-white text-amber-800 shadow-xs border border-slate-200"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <i className="fa-solid fa-chalkboard-user text-amber-600" />
          <span>ตารางสอนครูผู้สอน (รายบุคคล)</span>
          {teachers.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-100 text-amber-800">
              {teachers.length} ท่าน
            </span>
          )}
        </button>
      </div>

      {/* Top Banner */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
              scheduleType === "teacher" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-700"
            }`}>
              <i className={`fa-solid ${scheduleType === "teacher" ? "fa-chalkboard-user" : "fa-calendar-days"}`} />
            </span>
            <h2 className="text-lg font-bold text-slate-900">
              {scheduleType === "teacher"
                ? `จัดการตารางสอนครูผู้สอน: ${activeTargetName}`
                : "จัดการตารางเรียนนักเรียน (ม.1 - ม.6)"}
            </h2>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
              scheduleType === "teacher"
                ? "bg-amber-50 text-amber-800 border-amber-200"
                : "bg-emerald-50 text-emerald-700 border border-emerald-200"
            }`}>
              {scheduleType === "teacher" ? "ตารางสอนรายบุคคล" : "6 ระดับชั้น"}
            </span>
          </div>
          <p className="text-xs text-slate-500">
            {scheduleType === "teacher"
              ? "แอดมินสามารถจัดคาบสอน ระบุห้องที่ครูต้องไปสอน (เช่น ม.2/1, ม.3/2) และเวลาเรียนให้คุณครูแต่ละท่านได้โดยตรง"
              : "ระบบสร้างตารางเรียนมาตรฐานชั้น ม.1 ถึง ม.6 ไว้ให้เรียบร้อยแล้ว แอดมินสามารถเลือกชั้นปีเพื่อดู ปรับแต่ง เพิ่ม/แก้ไขวิชา หรือระบุเป็นห้องเฉพาะได้"}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleResetDefault}
            className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
            title="รีเซ็ตเป็นตารางมาตรฐาน"
          >
            <i className="fa-solid fa-arrow-rotate-left text-slate-500" />
            <span>
              {scheduleType === "teacher"
                ? `โหลดตารางสอนมาตรฐาน (${activeTargetName})`
                : `โหลดตารางมาตรฐาน ${selectedGrade}`}
            </span>
          </button>
          <button
            onClick={handleSaveAll}
            disabled={saving}
            className={`px-4 py-2 rounded-xl text-white text-xs font-semibold shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-60 ${
              scheduleType === "teacher"
                ? "bg-amber-600 hover:bg-amber-700"
                : "bg-emerald-600 hover:bg-emerald-700"
            }`}
          >
            {saving ? <i className="fa-solid fa-circle-notch fa-spin" /> : <i className="fa-solid fa-cloud-arrow-up" />}
            <span>
              {scheduleType === "teacher"
                ? `บันทึกตารางสอน (${activeTargetName})`
                : `บันทึกตารางเรียน (${activeGradeKey})`}
            </span>
          </button>
        </div>
      </div>

      {/* Target Selector Card */}
      {scheduleType === "student" ? (
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
              <i className="fa-solid fa-graduation-cap text-emerald-600" />
              เลือกระดับชั้นปี (ม.1 - ม.6) หรือพิมพ์ห้องเฉพาะ:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {GRADES.map((g) => {
                const isSelected = selectedGrade === g.key && !customRoom.trim();
                return (
                  <button
                    key={g.key}
                    onClick={() => {
                      setSelectedGrade(g.key);
                      setCustomRoom("");
                    }}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                      isSelected
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                        : "bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200"
                    }`}
                  >
                    <div className="font-bold text-sm">{g.key}</div>
                    <div className={`text-[10px] truncate mt-0.5 ${isSelected ? "text-emerald-100" : "text-slate-500"}`}>
                      {g.sub}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Room Option */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-3 border-t border-slate-100">
            <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
              <i className="fa-solid fa-door-open text-slate-400" />
              หรือต้องการกำหนดตารางให้ห้องเฉพาะ (เช่น ม.2/1 หรือ ม.1/3):
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={customRoom}
                onChange={(e) => setCustomRoom(e.target.value)}
                placeholder="เช่น ม.2/1, ม.3/2"
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs w-36 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-bold"
              />
              {customRoom && (
                <button
                  onClick={() => setCustomRoom("")}
                  className="text-xs text-rose-500 hover:underline"
                >
                  ล้างค่า
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-3">
          <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <i className="fa-solid fa-user-tie text-amber-600" />
            เลือกคุณครูผู้สอนที่ต้องการจัดการตารางสอน:
          </label>

          {teachers.length === 0 ? (
            <p className="text-xs text-slate-400 py-3">ยังไม่มีข้อมูลคุณครูในระบบ</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
              <div className="md:col-span-2">
                <select
                  value={selectedTeacherId}
                  onChange={(e) => setSelectedTeacherId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/20 cursor-pointer"
                >
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.fullName || t.displayName} {t.advisorRoom ? `(ครูที่ปรึกษา ${t.advisorRoom})` : ""} - {t.email}
                    </option>
                  ))}
                </select>
              </div>

              {selectedTeacher && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
                  <i className="fa-solid fa-id-card text-amber-600" />
                  <div className="truncate">
                    <span className="font-bold">{selectedTeacher.fullName || selectedTeacher.displayName}</span>
                    <span className="text-slate-500 block text-[11px]">
                      {selectedTeacher.advisorRoom ? `ที่ปรึกษา: ${selectedTeacher.advisorRoom}` : "ยังไม่ได้ระบุห้องที่ปรึกษา"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Schedule Table & Day Controller */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          {/* Day Selector Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {DAYS.map((d) => {
              const isSelected = selectedDay === d.key && viewMode === "daily";
              return (
                <button
                  key={d.key}
                  onClick={() => {
                    setSelectedDay(d.key);
                    setViewMode("daily");
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border ${
                    isSelected
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                      : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                  }`}
                >
                  <i className="fa-regular fa-calendar" />
                  {d.thai}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode(viewMode === "daily" ? "weekly" : "daily")}
              className={`px-3 py-2 rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 cursor-pointer ${
                viewMode === "weekly"
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white hover:bg-slate-50 text-slate-700 border-slate-200"
              }`}
            >
              <i className="fa-solid fa-table-cells" />
              {viewMode === "weekly" ? "มุมมองรายวัน" : "ดูตารางรวมทั้งสัปดาห์"}
            </button>

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
                  room: `ห้อง ${activeGradeKey}`,
                  color: "emerald",
                });
              }}
              className="px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold border border-emerald-200 transition flex items-center gap-1.5 cursor-pointer"
            >
              <i className="fa-solid fa-plus" />
              <span>เพิ่มคาบเรียน</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            <i className="fa-solid fa-circle-notch fa-spin mr-2" /> กำลังโหลดตารางเรียน {activeGradeKey}...
          </div>
        ) : viewMode === "daily" ? (
          currentDayItems.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <i className="fa-solid fa-calendar-xmark text-3xl mb-2 text-slate-300 block" />
              ไม่มีคาบเรียนในวันนี้
              <div className="mt-3">
                <button
                  onClick={handleResetDefault}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold"
                >
                  โหลดตารางมาตรฐาน
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Assembly Badge */}
              <div className="p-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 flex items-center justify-between text-xs text-slate-600">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200 font-semibold text-[11px]">
                    08:00 - 08:30
                  </span>
                  <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <i className="fa-solid fa-flag text-rose-500" /> เข้าแถวเคารพธงชาติ & โฮมรูม
                  </span>
                </div>
                <span className="text-[11px] text-slate-400">หน้าเสาธง</span>
              </div>

              {/* Grid of Periods */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {currentDayItems.map((item) => {
                  const colorTheme = COLOR_CLASSES[item.color || "emerald"] || COLOR_CLASSES.emerald;

                  return (
                    <div
                      key={item.id}
                      className={`p-4 rounded-xl border transition ${colorTheme.bg} ${colorTheme.border} shadow-2xs`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${colorTheme.badge}`}>
                            คาบ {item.period}
                          </span>
                          <span className="text-xs font-mono font-semibold text-slate-600">
                            {item.startTime} - {item.endTime} น.
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setIsAddingNew(false);
                              setEditingItem(item);
                            }}
                            className="p-1.5 rounded-lg hover:bg-white text-slate-500 hover:text-slate-800 transition text-xs cursor-pointer"
                            title="แก้ไขคาบเรียน"
                          >
                            <i className="fa-solid fa-pen" />
                          </button>
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            className="p-1.5 rounded-lg hover:bg-rose-100 text-slate-400 hover:text-rose-600 transition text-xs cursor-pointer"
                            title="ลบคาบนี้"
                          >
                            <i className="fa-solid fa-trash-can" />
                          </button>
                        </div>
                      </div>

                      <div className="mb-2">
                        <h4 className={`text-sm font-bold ${colorTheme.text}`}>
                          {item.subjectName}
                          {item.subjectCode && (
                            <span className="ml-1.5 text-xs font-mono font-semibold text-slate-500">
                              ({item.subjectCode})
                            </span>
                          )}
                        </h4>
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-200/60">
                        <span className="flex items-center gap-1.5 truncate max-w-[160px]">
                          <i className="fa-solid fa-chalkboard-user text-emerald-600" />
                          {item.teacherName || "ครูผู้สอน"}
                        </span>
                        <span className="flex items-center gap-1 font-medium text-slate-600">
                          <i className="fa-solid fa-door-open text-slate-400" />
                          {item.room || `ห้อง ${activeGradeKey}`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )
        ) : (
          /* Weekly Grid Mode */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[700px]">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <tr>
                  <th className="py-3 px-3 w-28">วัน</th>
                  {[1, 2, 3, 4, 5, 6, 7].map((p) => (
                    <th key={p} className="py-3 px-2 text-center">
                      คาบ {p}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {DAYS.map((d) => {
                  const dayItems = scheduleItems.filter((i) => i.day === d.key);
                  return (
                    <tr key={d.key} className="hover:bg-slate-50/50 transition">
                      <td className="py-3 px-3 font-bold text-slate-800">{d.thai}</td>
                      {[1, 2, 3, 4, 5, 6, 7].map((p) => {
                        const item = dayItems.find((it) => it.period === p);
                        if (!item) {
                          return (
                            <td key={p} className="py-2 px-1 text-center text-slate-300">
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
                              <div className="font-bold text-xs truncate max-w-[110px] text-slate-900">{item.subjectName}</div>
                              <div className="text-[10px] text-slate-500 truncate">{item.teacherName}</div>
                              <div className="text-[9px] text-slate-400 font-mono mt-0.5">{item.room}</div>
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
      </div>

      {/* Edit / Add Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="rounded-3xl p-6 sm:p-7 w-full max-w-md bg-white text-slate-800 border border-slate-200 shadow-2xl relative z-10 animate-scale-in">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-slate-900">
                {isAddingNew ? `เพิ่มคาบเรียนใหม่ (${activeGradeKey})` : `แก้ไขคาบเรียน (${activeGradeKey})`}
              </h3>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 transition cursor-pointer"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            <form onSubmit={handleModalSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1 text-slate-700">วันในสัปดาห์</label>
                  <select
                    value={editingItem.day}
                    onChange={(e) => setEditingItem({ ...editingItem, day: e.target.value as DayOfWeek })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800"
                  >
                    {DAYS.map((d) => (
                      <option key={d.key} value={d.key}>
                        {d.thai}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-slate-700">คาบที่</label>
                  <select
                    value={editingItem.period}
                    onChange={(e) => setEditingItem({ ...editingItem, period: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800"
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
                  <label className="block font-semibold mb-1 text-slate-700">เวลาเริ่ม</label>
                  <input
                    type="time"
                    required
                    value={editingItem.startTime}
                    onChange={(e) => setEditingItem({ ...editingItem, startTime: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-slate-700">เวลาสิ้นสุด</label>
                  <input
                    type="time"
                    required
                    value={editingItem.endTime}
                    onChange={(e) => setEditingItem({ ...editingItem, endTime: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-700">ชื่อวิชา / กิจกรรม</label>
                <input
                  type="text"
                  required
                  placeholder="เช่น ภาษาไทยพื้นฐาน หรือ ฟิสิกส์ 1"
                  value={editingItem.subjectName}
                  onChange={(e) => setEditingItem({ ...editingItem, subjectName: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1 text-slate-700">รหัสวิชา</label>
                  <input
                    type="text"
                    placeholder="เช่น ท21101"
                    value={editingItem.subjectCode || ""}
                    onChange={(e) => setEditingItem({ ...editingItem, subjectCode: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-slate-700">ห้องเรียน / อาคาร</label>
                  <input
                    type="text"
                    placeholder={`เช่น ห้อง ${activeGradeKey}`}
                    value={editingItem.room || ""}
                    onChange={(e) => setEditingItem({ ...editingItem, room: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1 text-slate-700">ครูผู้สอน</label>
                  <input
                    type="text"
                    placeholder="เช่น ครูสมหมาย ใจดี"
                    value={editingItem.teacherName || ""}
                    onChange={(e) => setEditingItem({ ...editingItem, teacherName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-slate-700">ธีมสี</label>
                  <select
                    value={editingItem.color || "emerald"}
                    onChange={(e) => setEditingItem({ ...editingItem, color: e.target.value as ScheduleItem["color"] })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800"
                  >
                    <option value="emerald">สีเขียว (วิทยาศาสตร์/เทคโนโลยี)</option>
                    <option value="blue">สีฟ้า (ภาษาไทย/วิชาการ)</option>
                    <option value="purple">สีม่วง (คณิตศาสตร์)</option>
                    <option value="teal">สีฟ้าอมเขียว (ภาษาต่างประเทศ)</option>
                    <option value="amber">สีส้ม/ทอง (สังคม/ประวัติศาสตร์)</option>
                    <option value="rose">สีชมพู/แดง (ศิลปะ/พละ)</option>
                    <option value="indigo">สีคราม (แนะแนว/กิจกรรม)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end pt-3 border-t border-slate-100 gap-2">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-3.5 py-2 rounded-xl hover:bg-slate-100 text-slate-600 transition font-medium cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition shadow-xs cursor-pointer"
                >
                  บันทึกคาบเรียน
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
