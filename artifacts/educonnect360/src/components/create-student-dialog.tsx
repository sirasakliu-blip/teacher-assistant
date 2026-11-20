import { useState, type FormEvent } from "react";
import { useToast } from "@/hooks/use-toast";
import { createStudentAccountByStaff } from "@/lib/firestore";
import type { User } from "@/types";

interface CreateStudentDialogProps {
  open: boolean;
  onClose: () => void;
  classId?: string;
  defaultClassName?: string;
  onSuccess?: (newStudent: User) => void;
}

export function CreateStudentDialog({
  open,
  onClose,
  classId,
  defaultClassName = "",
  onSuccess,
}: CreateStudentDialogProps) {
  const { toast } = useToast();
  const [studentId, setStudentId] = useState("");
  const [fullName, setFullName] = useState("");
  const [className, setClassName] = useState(defaultClassName);
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [createdStudent, setCreatedStudent] = useState<{
    studentId: string;
    fullName: string;
    passwordUsed: string;
  } | null>(null);

  if (!open) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const cleanId = studentId.trim().replace(/\s+/g, "");
    const cleanName = fullName.trim();
    const passToUse = password.trim() || cleanId;

    if (!cleanId) {
      toast({
        variant: "destructive",
        title: "กรุณากรอกรหัสนักเรียน",
      });
      return;
    }

    if (!cleanName) {
      toast({
        variant: "destructive",
        title: "กรุณากรอกชื่อ-นามสกุลนักเรียน",
      });
      return;
    }

    setSaving(true);
    try {
      const student = await createStudentAccountByStaff({
        studentId: cleanId,
        fullName: cleanName,
        className: className.trim() || undefined,
        password: passToUse,
        classIdToEnroll: classId,
      });

      setCreatedStudent({
        studentId: cleanId,
        fullName: cleanName,
        passwordUsed: passToUse,
      });

      toast({
        title: "บันทึกข้อมูลนักเรียนสำเร็จ",
        description: `บันทึกบัญชีสำหรับ ${cleanName} (รหัส ${cleanId}) เรียบร้อยแล้ว`,
      });

      if (onSuccess) {
        onSuccess(student);
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "สร้างบัญชีไม่สำเร็จ",
        description: err instanceof Error ? err.message : "กรุณาลองใหม่อีกครั้ง",
      });
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setStudentId("");
    setFullName("");
    setPassword("");
    setClassName(defaultClassName);
    setCreatedStudent(null);
  }

  function handleClose() {
    handleReset();
    onClose();
  }

  async function handleCopyCredentials() {
    if (!createdStudent) return;
    const text = `ข้อมูลเข้าสู่ระบบ EduConnect360\nชื่อ: ${createdStudent.fullName}\nรหัสนักเรียน: ${createdStudent.studentId}\nรหัสผ่าน: ${createdStudent.passwordUsed}`;
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "คัดลอกข้อมูลแล้ว",
        description: "คัดลอกข้อมูลเข้าสู่ระบบไปยังคลิปบอร์ดแล้ว",
      });
    } catch {
      toast({
        variant: "destructive",
        title: "คัดลอกไม่สำเร็จ",
        description: "กรุณาคัดลอกด้วยตนเอง",
      });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-background border border-border rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <i className="fa-solid fa-user-plus text-base" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">สร้างบัญชีนักเรียนใหม่</h2>
              <p className="text-xs text-muted-foreground">สำหรับครูและผู้ดูแลระบบ</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        {createdStudent ? (
          /* Success Screen with Copy */
          <div className="space-y-4 py-2">
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-emerald-800">
                <i className="fa-solid fa-circle-check text-emerald-600" />
                สร้างบัญชีนักเรียนเรียบร้อยแล้ว!
              </div>
              <div className="text-xs space-y-1 pt-1 font-mono">
                <p>
                  <span className="text-emerald-700 font-sans">ชื่อ-นามสกุล:</span>{" "}
                  <strong>{createdStudent.fullName}</strong>
                </p>
                <p>
                  <span className="text-emerald-700 font-sans">รหัสนักเรียน:</span>{" "}
                  <strong>{createdStudent.studentId}</strong>
                </p>
                <p>
                  <span className="text-emerald-700 font-sans">รหัสผ่าน:</span>{" "}
                  <strong>{createdStudent.passwordUsed}</strong>
                </p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              สามารถส่งข้อมูลนี้ให้นักเรียนเข้าสู่ระบบผ่านหน้านักเรียนได้ทันที
            </p>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleCopyCredentials}
                className="flex-1 py-2.5 px-4 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-copy" /> คัดลอกข้อมูล
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="py-2.5 px-4 rounded-xl border border-border hover:bg-muted text-foreground font-semibold text-sm transition"
              >
                + เพิ่มอีกคน
              </button>
            </div>
          </div>
        ) : (
          /* Input Form */
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                รหัสนักเรียน <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="เช่น 67105"
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/80 focus:outline-none text-sm font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                ชื่อ-นามสกุล (พร้อมคำนำหน้า) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="เช่น เด็กชายสมชาย ใจดี"
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/80 focus:outline-none text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                ชั้นเรียน / ห้อง
              </label>
              <input
                type="text"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                placeholder="เช่น ม.3/1"
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/80 focus:outline-none text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1 flex items-center justify-between">
                <span>รหัสผ่านเริ่มต้น</span>
                <span className="text-[11px] font-normal text-muted-foreground">
                  (เว้นว่างไว้เพื่อใช้รหัสนักเรียน)
                </span>
              </label>
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="เช่น 0000, 1234 หรือเว้นว่างเพื่อใช้รหัสนักเรียน"
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/80 focus:outline-none text-sm font-mono"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                กำหนดรหัสผ่านสั้นๆ ได้ตามต้องการ ไม่จำกัดความยาว (เช่น 0000 หรือเว้นว่าง)
              </p>
            </div>

            <div className="pt-3 flex gap-2">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 py-2.5 px-4 rounded-xl border border-border hover:bg-muted text-foreground font-semibold text-sm transition"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-2.5 px-4 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition shadow-md shadow-primary/20 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <i className="fa-solid fa-circle-notch fa-spin text-xs" />
                    กำลังสร้าง...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-check text-xs" />
                    สร้างบัญชี
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
