import { useState, useEffect, type FormEvent } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { updateTeacherContactProfile, getUserProfile } from "@/lib/firestore";

interface TeacherProfileModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function TeacherProfileModal({ open, onClose, onSuccess }: TeacherProfileModalProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [displayName, setDisplayName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [lineId, setLineId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName || profile.fullName || "");
      setPhoneNumber(profile.phoneNumber || "");
      setLineId(profile.lineId || "");
    }
  }, [profile, open]);

  if (!open) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!profile?.id) return;

    if (!displayName.trim()) {
      toast({
        variant: "destructive",
        title: "กรุณาระบุชื่อ-นามสกุล",
      });
      return;
    }

    setSubmitting(true);
    try {
      await updateTeacherContactProfile(profile.id, {
        displayName: displayName.trim(),
        phoneNumber: phoneNumber.trim(),
        lineId: lineId.trim(),
      });

      toast({
        title: "บันทึกข้อมูลติดต่อครูสำเร็จ",
        description: "ผู้ปกครองจะสามารถดูเบอร์โทรและ LINE ID ของท่านใน LINE ได้ทันที",
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Save teacher profile error:", err);
      toast({
        variant: "destructive",
        title: "บันทึกไม่สำเร็จ",
        description: err instanceof Error ? err.message : "กรุณาลองใหม่อีกครั้ง",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div className="rounded-3xl p-6 sm:p-8 w-full max-w-md bg-card text-card-foreground border border-border shadow-2xl relative z-10">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <i className="fa-solid fa-address-card text-lg" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">ข้อมูลติดต่อคุณครู</h2>
              <p className="text-xs text-muted-foreground">
                ข้อมูลนี้จะแสดงให้ผู้ปกครองติดต่อใน LINE Official Account
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
              <i className="fa-solid fa-user text-primary" />
              ชื่อ-นามสกุลครู / ตำแหน่ง
            </label>
            <input
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="เช่น คุณครูสมชาย ใจดี"
              className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary text-sm text-foreground"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
              <i className="fa-solid fa-phone text-emerald-600" />
              เบอร์โทรศัพท์ติดต่อ
            </label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="เช่น 081-234-5678"
              className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary text-sm text-foreground font-mono"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              ผู้ปกครองสามารถกดปุ่มโทรออกจาก LINE ได้โดยตรง
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
              <i className="fa-brands fa-line text-[#06C755] text-sm" />
              LINE ID ของคุณครู
            </label>
            <input
              type="text"
              value={lineId}
              onChange={(e) => setLineId(e.target.value)}
              placeholder="เช่น kru_somchai หรือ เบอร์โทร"
              className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary text-sm text-foreground"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              ผู้ปกครองสามารถกดปุ่ม "เพิ่มเพื่อนใน LINE" เพื่อแชทสอบถามเรื่องบุตรหลานได้ทันที
            </p>
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
                  <i className="fa-solid fa-floppy-disk text-xs" />
                  บันทึกข้อมูล
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
