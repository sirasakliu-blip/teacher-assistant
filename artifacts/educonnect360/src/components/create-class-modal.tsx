import { useState, type FormEvent } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { createClass } from "@/lib/firestore";
import { CLASS_COVERS } from "@/lib/covers";
import type { ClassCover } from "@/types";

interface CreateClassModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  defaultGrade?: string;
}

export function CreateClassModal({
  open,
  onClose,
  onSuccess,
  defaultGrade = "ม.2/1",
}: CreateClassModalProps) {
  const { profile, firebaseUser } = useAuth();
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [gradeLevel, setGradeLevel] = useState(defaultGrade);
  const [cover, setCover] = useState<ClassCover>("emerald");
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast({ variant: "destructive", title: "กรุณาระบุชื่อห้องเรียน/วิชา" });
      return;
    }

    const teacherId = profile?.id || profile?.uid || firebaseUser?.uid;
    const teacherName = profile?.displayName || profile?.fullName || "คุณครูผู้สอน";

    if (!teacherId) {
      toast({ variant: "destructive", title: "ไม่พบบัญชีผู้ใช้", description: "กรุณาลองเข้าสู่ระบบใหม่อีกครั้ง" });
      return;
    }

    setSubmitting(true);
    try {
      const newClass = await createClass({
        name: name.trim(),
        gradeLevel: gradeLevel.trim() || "ม.2/1",
        cover,
        teacherId,
        teacherName,
      });

      toast({
        title: "สร้างห้องเรียนสำเร็จ",
        description: `สร้างห้อง "${newClass.name}" เรียบร้อยแล้ว (รหัสเข้าห้อง: ${newClass.joinCode})`,
      });

      setName("");
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "สร้างห้องเรียนไม่สำเร็จ",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="rounded-3xl p-6 sm:p-8 w-full max-w-md bg-card text-card-foreground border border-border shadow-2xl relative z-10 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-lg">
              <i className="fa-solid fa-chalkboard" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">สร้างห้องเรียนใหม่</h2>
              <p className="text-xs text-muted-foreground">สร้างห้องเรียนสำหรับเช็คชื่อ มอบหมายงาน และใบลา</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition cursor-pointer"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <i className="fa-solid fa-book text-primary" /> ชื่อวิชา / ชื่อห้องเรียน
              </span>
              <span className="text-[11px] text-muted-foreground font-normal">คลิกเลือกชื่อด้านล่างได้</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="เช่น ห้องเรียนประจำชั้น ม.2/1 หรือ คณิตศาสตร์"
              className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary text-sm text-foreground mb-1.5"
            />
            <div className="flex items-center gap-1.5 flex-wrap">
              {[`ห้องเรียนประจำชั้น ${gradeLevel || "ม.2/1"}`, "คณิตศาสตร์พื้นฐาน", "วิทยาศาสตร์", "ภาษาอังกฤษ", "ภาษาไทย", "สังคมศึกษา"].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setName(s)}
                  className="px-2.5 py-1 rounded-lg text-[11px] bg-muted hover:bg-muted/80 text-foreground transition cursor-pointer"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <i className="fa-solid fa-door-open text-primary" /> ระดับชั้น / ห้อง
              </span>
              <span className="text-[11px] text-muted-foreground font-normal">คลิกเลือกระดับชั้น</span>
            </label>
            <input
              type="text"
              required
              value={gradeLevel}
              onChange={(e) => setGradeLevel(e.target.value)}
              placeholder="เช่น ม.2/1 หรือ ม.1/3"
              className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary text-sm text-foreground mb-1.5"
            />
            <div className="flex items-center gap-1.5 flex-wrap">
              {["ม.1/1", "ม.2/1", "ม.2/2", "ม.3/1", "ม.4/1", "ม.5/1", "ม.6/1"].map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGradeLevel(g)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] transition cursor-pointer ${
                    gradeLevel === g ? "bg-primary text-primary-foreground font-semibold" : "bg-muted hover:bg-muted/80 text-foreground"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-2">เลือกโทนสีปกห้องเรียน</label>
            <div className="grid grid-cols-6 gap-2">
              {CLASS_COVERS.map((c) => (
                <button
                  type="button"
                  key={c.value}
                  onClick={() => setCover(c.value)}
                  className={`h-11 rounded-xl bg-gradient-to-br ${c.gradient} transition-all cursor-pointer ${
                    cover === c.value ? "ring-2 ring-offset-2 ring-primary ring-offset-card scale-105" : "opacity-80 hover:opacity-100"
                  }`}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-semibold transition cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition shadow-sm cursor-pointer disabled:opacity-60 flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <i className="fa-solid fa-circle-notch fa-spin text-xs" /> กำลังสร้าง...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-plus" /> สร้างห้องเรียน
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
