import { useState, type FormEvent } from "react";
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface ChangePasswordModalProps {
  open: boolean;
  onClose: () => void;
}

export function ChangePasswordModal({ open, onClose }: ChangePasswordModalProps) {
  const { profile, firebaseUser } = useAuth();
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!firebaseUser || !auth) {
      toast({
        variant: "destructive",
        title: "ไม่ได้เข้าสู่ระบบ",
        description: "กรุณาเข้าสู่ระบบก่อนเปลี่ยนรหัสผ่าน",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        variant: "destructive",
        title: "รหัสผ่านสั้นเกินไป",
        description: "รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "รหัสผ่านไม่ตรงกัน",
        description: "กรุณากรอกรหัสผ่านใหม่และยืนยันรหัสผ่านให้ตรงกัน",
      });
      return;
    }

    setSubmitting(true);
    try {
      // Re-authenticate if user entered current password and email exists
      if (currentPassword && firebaseUser.email) {
        const credential = EmailAuthProvider.credential(firebaseUser.email, currentPassword);
        await reauthenticateWithCredential(firebaseUser, credential);
      }

      // Update password in Firebase Auth
      await updatePassword(firebaseUser, newPassword);

      toast({
        title: "เปลี่ยนรหัสผ่านสำเร็จแล้ว 🎉",
        description: "กรุณาจดจำรหัสผ่านใหม่นี้สำหรับใช้เข้าสู่ระบบในครั้งถัดไป",
      });

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      onClose();
    } catch (err: any) {
      console.error("Change password error:", err);
      let msg = "เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน กรุณาลองใหม่อีกครั้ง";
      if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        msg = "รหัสผ่านเดิมไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง";
      } else if (err.code === "auth/requires-recent-login") {
        msg = "เพื่อความปลอดภัย กรุณาออกจากระบบแล้วเข้าสู่ระบบใหม่อีกครั้งก่อนเปลี่ยนรหัสผ่าน";
      } else if (err.message) {
        msg = err.message;
      }

      toast({
        variant: "destructive",
        title: "เปลี่ยนรหัสผ่านไม่สำเร็จ",
        description: msg,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="glass-panel rounded-3xl p-6 sm:p-8 w-full max-w-md bg-card/95 border border-border shadow-2xl relative">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <i className="fa-solid fa-key text-lg" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">เปลี่ยนรหัสผ่าน</h2>
              <p className="text-xs text-muted-foreground">
                สำหรับ {profile?.displayName || "นักเรียน"} (รหัส: {profile?.studentId || "-"})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
              <i className="fa-solid fa-lock text-muted-foreground" />
              รหัสผ่านเดิม (ที่ได้รับจากครู/แอดมิน)
            </label>
            <div className="relative">
              <input
                type={showCurrent ? "text" : "password"}
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="กรอกรหัสผ่านเดิม"
                className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-background/60 border border-border focus:outline-none focus:ring-2 focus:ring-primary text-sm text-foreground"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground text-xs"
              >
                <i className={`fa-solid ${showCurrent ? "fa-eye-slash" : "fa-eye"}`} />
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
              <i className="fa-solid fa-shield-halved text-primary" />
              รหัสผ่านใหม่ (อย่างน้อย 6 ตัวอักษร)
            </label>
            <div className="relative">
              <input
                type={showNew ? "text" : "password"}
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="กรอกรหัสผ่านใหม่ที่คุณต้องการ"
                className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-background/60 border border-border focus:outline-none focus:ring-2 focus:ring-primary text-sm text-foreground"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground text-xs"
              >
                <i className={`fa-solid ${showNew ? "fa-eye-slash" : "fa-eye"}`} />
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
              <i className="fa-solid fa-check-double text-primary" />
              ยืนยันรหัสผ่านใหม่อีกครั้ง
            </label>
            <input
              type={showNew ? "text" : "password"}
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
              className="w-full px-3.5 py-2.5 rounded-xl bg-background/60 border border-border focus:outline-none focus:ring-2 focus:ring-primary text-sm text-foreground"
            />
          </div>

          <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 text-[11px] text-muted-foreground flex items-start gap-2">
            <i className="fa-solid fa-circle-info text-primary shrink-0 mt-0.5" />
            <span>
              เมื่อเปลี่ยนรหัสผ่านแล้ว คุณจะต้องใช้รหัสผ่านใหม่นี้ร่วมกับรหัสนักเรียนในการเข้าสู่ระบบครั้งถัดไป
            </span>
          </div>

          <div className="flex items-center gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="w-1/2 py-2.5 rounded-xl border border-border text-foreground hover:bg-muted font-medium text-xs transition"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="w-1/2 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/90 transition shadow-md shadow-primary/20 disabled:opacity-60 flex items-center justify-center gap-1.5"
            >
              {submitting ? (
                <>
                  <i className="fa-solid fa-circle-notch fa-spin text-xs" />
                  กำลังบันทึก...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-check text-xs" />
                  บันทึกรหัสผ่านใหม่
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
