import { useState, useEffect, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { createAnnouncement } from "@/lib/firestore";
import type { Class } from "@/types";

interface CreateAnnouncementModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  defaultRoom?: string;
  classes?: Class[];
}

export function CreateAnnouncementModal({
  open,
  onClose,
  onSuccess,
  defaultRoom,
  classes = [],
}: CreateAnnouncementModalProps) {
  const { profile, firebaseUser } = useAuth();
  const { toast } = useToast();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [priority, setPriority] = useState<"normal" | "urgent">("normal");
  const [targetType, setTargetType] = useState<"advisor" | "class" | "all">("advisor");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const advisorRoom = defaultRoom || profile?.advisorRoom || profile?.gradeLevel || "ม.2/1";
  const teacherName = profile?.displayName || profile?.fullName || firebaseUser?.displayName || "คุณครู";
  const teacherId = profile?.id || profile?.uid || firebaseUser?.uid || "";

  useEffect(() => {
    if (open) {
      setTitle("");
      setContent("");
      setPriority("normal");
      setTargetType(advisorRoom ? "advisor" : classes.length > 0 ? "class" : "all");
      if (classes.length > 0) {
        setSelectedClassId(classes[0].id);
      }
    }
  }, [open, advisorRoom, classes]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast({
        variant: "destructive",
        title: "กรุณาระบุหัวข้อประกาศ",
      });
      return;
    }
    if (!content.trim()) {
      toast({
        variant: "destructive",
        title: "กรุณาระบุรายละเอียดข้อความประกาศ",
      });
      return;
    }

    setSubmitting(true);
    try {
      let gradeLevel: string | undefined;
      let classId: string | undefined;
      let className: string | undefined;

      if (targetType === "advisor") {
        gradeLevel = advisorRoom;
      } else if (targetType === "class") {
        classId = selectedClassId;
        const targetCls = classes.find((c) => c.id === selectedClassId);
        className = targetCls?.name;
        gradeLevel = targetCls?.gradeLevel;
      }

      await createAnnouncement({
        teacherId,
        teacherName,
        title: title.trim(),
        content: content.trim(),
        priority,
        gradeLevel,
        classId,
        className,
      });

      toast({
        title: "เผยแพร่ประกาศสำเร็จ 🎉",
        description: `ผู้ปกครองและนักเรียน ${gradeLevel ? `ห้อง ${gradeLevel}` : "ทุกคน"} สามารถเปิดดูผ่าน LINE ได้ทันที`,
      });

      onSuccess?.();
      onClose();
    } catch (err) {
      console.error("Create announcement error:", err);
      toast({
        variant: "destructive",
        title: "บันทึกไม่สำเร็จ",
        description: err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการเผยแพร่ประกาศ",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-announcement-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        className="w-full max-w-lg bg-card border border-border rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center text-lg">
              <i className="fa-solid fa-bullhorn" />
            </span>
            <div>
              <h2 id="create-announcement-title" className="text-lg font-bold text-foreground">
                พิมพ์ประกาศถึงผู้ปกครอง & นักเรียน
              </h2>
              <p className="text-xs text-muted-foreground">
                ประกาศข่าวสาร กิจกรรม นัดหมาย และแจ้งเตือนห้องเรียน
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition cursor-pointer"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Target Audience */}
          <div className="space-y-1.5">
            <label className="font-semibold text-foreground flex items-center gap-1.5">
              <i className="fa-solid fa-users text-primary" />
              กลุ่มเป้าหมายผู้รับประกาศ
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setTargetType("advisor")}
                className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col gap-0.5 ${
                  targetType === "advisor"
                    ? "border-primary bg-primary/10 text-primary font-bold shadow-xs"
                    : "border-border bg-card text-muted-foreground hover:bg-muted"
                }`}
              >
                <span className="text-xs">ห้องที่ปรึกษา</span>
                <span className="text-[11px] font-mono opacity-80">{advisorRoom || "ห้องเรียน"}</span>
              </button>

              {classes.length > 0 && (
                <button
                  type="button"
                  onClick={() => setTargetType("class")}
                  className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col gap-0.5 ${
                    targetType === "class"
                      ? "border-primary bg-primary/10 text-primary font-bold shadow-xs"
                      : "border-border bg-card text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <span className="text-xs">วิชาที่สอน</span>
                  <span className="text-[11px] opacity-80">เลือกห้องวิชา</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setTargetType("all")}
                className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col gap-0.5 ${
                  targetType === "all"
                    ? "border-primary bg-primary/10 text-primary font-bold shadow-xs"
                    : "border-border bg-card text-muted-foreground hover:bg-muted"
                }`}
              >
                <span className="text-xs">ทั้งโรงเรียน</span>
                <span className="text-[11px] opacity-80">ทุกคนในระบบ</span>
              </button>
            </div>

            {targetType === "class" && classes.length > 0 && (
              <div className="pt-2">
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-xs"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.gradeLevel}) &middot; {c.studentIds?.length || 0} คน
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Priority */}
          <div className="space-y-1.5">
            <label className="font-semibold text-foreground flex items-center gap-1.5">
              <i className="fa-solid fa-flag text-amber-500" />
              ระดับความสำคัญ
            </label>
            <div className="flex gap-2">
              <label
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl border cursor-pointer transition ${
                  priority === "normal"
                    ? "bg-slate-100 border-slate-300 font-bold text-slate-800 dark:bg-slate-800 dark:text-slate-200"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                <input
                  type="radio"
                  name="priority"
                  value="normal"
                  checked={priority === "normal"}
                  onChange={() => setPriority("normal")}
                  className="sr-only"
                />
                <i className="fa-solid fa-circle-info text-blue-500" />
                <span>ข่าวประชาสัมพันธ์ทั่วไป</span>
              </label>

              <label
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl border cursor-pointer transition ${
                  priority === "urgent"
                    ? "bg-rose-50 border-rose-300 font-bold text-rose-800 dark:bg-rose-950 dark:text-rose-200"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                <input
                  type="radio"
                  name="priority"
                  value="urgent"
                  checked={priority === "urgent"}
                  onChange={() => setPriority("urgent")}
                  className="sr-only"
                />
                <i className="fa-solid fa-triangle-exclamation text-rose-500" />
                <span>🚨 ประกาศด่วนมาก</span>
              </label>
            </div>
          </div>

          {/* Title */}
          <div className="space-y-1">
            <label className="font-semibold text-foreground">
              หัวข้อประกาศ <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="เช่น แจ้งเรื่องการประชุมผู้ปกครองภาคเรียนที่ 1, นัดหมายสอบเก็บคะแนน"
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-foreground text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              required
            />
          </div>

          {/* Content */}
          <div className="space-y-1">
            <label className="font-semibold text-foreground">
              รายละเอียดประกาศ <span className="text-destructive">*</span>
            </label>
            <textarea
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="พิมพ์ข้อความที่ต้องการแจ้งให้นักเรียนและผู้ปกครองทราบ เช่น วัน เวลา สถานที่ สิ่งที่ต้องเตรียม..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-foreground text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 leading-relaxed"
              required
            />
          </div>

          <div className="p-3 rounded-xl bg-muted/60 border border-border/80 text-[11px] text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground flex items-center gap-1.5">
              <i className="fa-brands fa-line text-emerald-500" />
              การแจ้งเตือนผู้ปกครอง:
            </p>
            <p>
              เมื่อกดเผยแพร่ ผู้ปกครองสามารถกดปุ่ม <strong>"ข่าวสาร / ประกาศ"</strong> ใน LINE หรือเปิดแท็บในสมุดพกออนไลน์เพื่ออ่านประกาศนี้ได้ทันที
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2.5 rounded-xl border border-border bg-card text-foreground hover:bg-muted font-semibold text-xs transition cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs transition cursor-pointer shadow-sm flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <i className="fa-solid fa-circle-notch fa-spin" /> กำลังเผยแพร่...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-paper-plane" /> เผยแพร่ประกาศทันที
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
