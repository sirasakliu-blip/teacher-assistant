import { useState, type FormEvent } from "react";
import { useToast } from "@/hooks/use-toast";
import { createLeaveRequest } from "@/lib/firestore";
import { openAgent, copyToClipboard } from "@/lib/ai-assistant";
import type { LeaveRequest, User } from "@/types";

interface Props {
  user: User;
  onClose: () => void;
  onCreated: (newLeave: LeaveRequest) => void;
  defaultStudentName?: string;
  defaultStudentId?: string;
  submittedByRole: "student" | "parent";
}

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

export function LeaveRequestModal({
  user,
  onClose,
  onCreated,
  defaultStudentName = "",
  defaultStudentId = "",
  submittedByRole,
}: Props) {
  const { toast } = useToast();

  const [prefix, setPrefix] = useState("เด็กชาย");
  const [studentName, setStudentName] = useState(defaultStudentName || (submittedByRole === "student" ? user.displayName : ""));
  const [studentGrade, setStudentGrade] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [writtenAt, setWrittenAt] = useState("โรงเรียน");
  const [type, setType] = useState<"sick" | "business">("sick");
  const [reason, setReason] = useState("");
  const [startDate, setStartDate] = useState(todayISODate());
  const [endDate, setEndDate] = useState(todayISODate());
  const [advisorName, setAdvisorName] = useState("");
  const [subjectTeacherName, setSubjectTeacherName] = useState("");
  const [parentName, setParentName] = useState(submittedByRole === "parent" ? user.displayName : "");
  const [submitting, setSubmitting] = useState(false);

  // Auto calculate days count
  const startD = new Date(startDate);
  const endD = new Date(endDate);
  const diffTime = Math.max(0, endD.getTime() - startD.getTime());
  const daysCount = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1);

  async function handleAiDraftLeave() {
    const leaveTypeTh = type === "sick" ? "ป่วย" : "กิจส่วนตัว";
    const startStr = startDate || "วันนี้";
    const endStr = endDate || startDate || "วันนี้";
    const reasonStr = reason.trim() || (type === "sick" ? "มีอาการป่วย ไม่สบาย" : "มีกิจธุระจำเป็นของครอบครัว");
    const promptText = `ช่วยร่างใบลา${leaveTypeTh} ตั้งแต่ ${startStr} ถึง ${endStr} เหตุผล ${reasonStr} ตามระเบียบสำนักนายกรัฐมนตรีว่าด้วยการลาของข้าราชการ พ.ศ. 2555 และออกเป็นไฟล์ Word`;

    await copyToClipboard(promptText);
    openAgent("docs", promptText);
    toast({
      title: "คัดลอกคำสั่งแล้ว",
      description: "นำไปวาง (Ctrl+V) ในหน้าต่างแชต LangMind ที่เปิดขึ้นได้ทันทีครับ",
      duration: 3000,
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!studentName.trim()) {
      toast({ variant: "destructive", title: "กรุณาระบุชื่อ-นามสกุลนักเรียน" });
      return;
    }
    if (!reason.trim()) {
      toast({ variant: "destructive", title: "กรุณาระบุสาเหตุการลา" });
      return;
    }
    if (!advisorName.trim()) {
      toast({ variant: "destructive", title: "กรุณาระบุชื่อครูที่ปรึกษา" });
      return;
    }

    setSubmitting(true);
    try {
      const studentId = defaultStudentId || (submittedByRole === "student" ? user.id : user.id);
      const leave = await createLeaveRequest({
        studentId,
        studentName: studentName.trim(),
        prefix,
        studentGrade: studentGrade.trim(),
        studentNumber: studentNumber.trim(),
        writtenAt: writtenAt.trim() || "โรงเรียน",
        date: todayISODate(),
        type,
        reason: reason.trim(),
        startDate,
        endDate,
        daysCount,
        advisorName: advisorName.trim(),
        subjectTeacherName: subjectTeacherName.trim() || undefined,
        parentName: parentName.trim() || "ผู้ปกครอง",
        submittedByRole,
      });

      toast({
        title: "ยื่นใบลาสำเร็จ",
        description: `บันทึกคำขอใบลาของ ${studentName} เรียบร้อยแล้ว`,
      });
      onCreated(leave);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "ยื่นใบลาไม่สำเร็จ",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-sm overflow-y-auto">
      <div className="bg-card w-full max-w-2xl rounded-3xl p-6 sm:p-8 shadow-2xl border border-border my-auto animate-fade-in-up">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary text-xl">
              <i className="fa-solid fa-file-pen" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">เขียนหนังสือใบลา</h2>
              <p className="text-xs text-muted-foreground">กรอกข้อมูลเพื่อส่งให้ครูที่ปรึกษาพิจารณาและพิมพ์เป็นทางการ</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          {/* Prefix, Name */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">คำนำหน้า</label>
              <select
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-background/60 border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="เด็กชาย">เด็กชาย</option>
                <option value="เด็กหญิง">เด็กหญิง</option>
                <option value="นาย">นาย</option>
                <option value="นางสาว">นางสาว</option>
              </select>
            </div>
            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold text-foreground mb-1.5">ชื่อ-นามสกุลนักเรียน</label>
              <input
                required
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="สมชาย ใจดี"
                className="w-full px-3.5 py-2.5 rounded-xl bg-background/60 border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {/* Grade, Number, Written At */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">ชั้น (เช่น ม.3/1)</label>
              <input
                required
                value={studentGrade}
                onChange={(e) => setStudentGrade(e.target.value)}
                placeholder="ม.3/1"
                className="w-full px-3.5 py-2.5 rounded-xl bg-background/60 border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">เลขที่</label>
              <input
                required
                value={studentNumber}
                onChange={(e) => setStudentNumber(e.target.value)}
                placeholder="12"
                className="w-full px-3.5 py-2.5 rounded-xl bg-background/60 border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">เขียนที่</label>
              <input
                required
                value={writtenAt}
                onChange={(e) => setWrittenAt(e.target.value)}
                placeholder="โรงเรียน หรือ บ้านเลขที่..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-background/60 border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {/* Type of leave */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">ประเภทการลา</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setType("sick")}
                className={`py-2.5 rounded-xl border text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                  type === "sick"
                    ? "border-primary bg-primary/10 text-primary shadow-sm"
                    : "border-border bg-background text-muted-foreground"
                }`}
              >
                <i className="fa-solid fa-temperature-arrow-up" /> ลาป่วย
              </button>
              <button
                type="button"
                onClick={() => setType("business")}
                className={`py-2.5 rounded-xl border text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                  type === "business"
                    ? "border-primary bg-primary/10 text-primary shadow-sm"
                    : "border-border bg-background text-muted-foreground"
                }`}
              >
                <i className="fa-solid fa-briefcase" /> ขอลากิจ
              </button>
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              สาเหตุการลา {type === "sick" ? "(หากป่วยให้ระบุอาการ)" : ""}
            </label>
            <textarea
              required
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={type === "sick" ? "เช่น มีไข้สูงและปวดศีรษะ แพทย์สั่งให้พักผ่อน" : "เช่น ไปร่วมงานฌาปนกิจศพคุณยายที่ต่างจังหวัด"}
              className="w-full px-3.5 py-2.5 rounded-xl bg-background/60 border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">ตั้งแต่วันที่</label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-background/60 border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">ถึงวันที่</label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-background/60 border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">รวมระยะเวลา</label>
              <div className="px-3.5 py-2.5 rounded-xl bg-muted/60 border border-border text-foreground text-sm font-bold flex items-center justify-between">
                <span>{daysCount} วัน</span>
                <i className="fa-regular fa-calendar-days text-muted-foreground" />
              </div>
            </div>
          </div>

          {/* Advisor and Subject teacher */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">เรียน ครูที่ปรึกษา</label>
              <input
                required
                value={advisorName}
                onChange={(e) => setAdvisorName(e.target.value)}
                placeholder="ชื่อ-นามสกุลครูที่ปรึกษา"
                className="w-full px-3.5 py-2.5 rounded-xl bg-background/60 border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                ครูผู้สอนวิชา / วิชา <span className="text-muted-foreground font-normal">(ถ้ามี)</span>
              </label>
              <input
                value={subjectTeacherName}
                onChange={(e) => setSubjectTeacherName(e.target.value)}
                placeholder="เช่น ครูสมชาย ใจดี หรือ วิชาคณิตศาสตร์"
                className="w-full px-3.5 py-2.5 rounded-xl bg-background/60 border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {/* Parent name */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">ชื่อผู้ปกครองผู้รับรอง</label>
            <input
              required
              value={parentName}
              onChange={(e) => setParentName(e.target.value)}
              placeholder="ชื่อ-นามสกุล ผู้ปกครอง"
              className="w-full px-3.5 py-2.5 rounded-xl bg-background/60 border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-2.5 mt-4">
            <button
              type="button"
              onClick={handleAiDraftLeave}
              className="w-full sm:w-auto px-4 py-3.5 rounded-xl border border-[#1e7a4f] text-[#1e7a4f] hover:bg-[#1e7a4f]/10 dark:text-emerald-400 dark:border-emerald-500 font-semibold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              title="ให้ AI ร่างใบลาเป็นไฟล์ Word ตามระเบียบสำนักนายกรัฐมนตรี"
            >
              <span>✨ ให้ AI ช่วยร่าง</span>
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="flex-1 w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-all shadow-lg shadow-primary/25 disabled:opacity-60 flex items-center justify-center gap-2 text-sm cursor-pointer"
            >
              {submitting ? (
                <i className="fa-solid fa-circle-notch fa-spin" />
              ) : (
                <>
                  <i className="fa-solid fa-paper-plane" /> บันทึกและยื่นใบลา
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
