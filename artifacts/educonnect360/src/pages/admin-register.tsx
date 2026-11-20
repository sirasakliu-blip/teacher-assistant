import { useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export default function AdminRegister() {
  const { registerAdmin } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();

    // 1. Condition: must end with .ac.th
    if (!cleanEmail.endsWith(".ac.th")) {
      toast({
        variant: "destructive",
        title: "รูปแบบอีเมลไม่ถูกต้อง",
        description: "อีเมลสำหรับผู้ดูแลระบบต้องเป็นอีเมลทางการของสถานศึกษาที่ลงท้ายด้วย .ac.th เท่านั้น",
      });
      return;
    }

    setSubmitting(true);
    try {
      await registerAdmin(cleanEmail, password, displayName);
      toast({
        title: "ลงทะเบียนผู้ดูแลระบบสำเร็จ",
        description: "ระบบได้ส่งลิงก์ยืนยันตัวตนไปยังอีเมลของคุณแล้ว กรุณายืนยันก่อนเข้าสู่ระบบ",
      });
      setLocation("/admin-verify-email");
    } catch (err) {
      toast({
        variant: "destructive",
        title: "ลงทะเบียนไม่สำเร็จ",
        description: err instanceof Error ? err.message : "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-[100dvh] w-full bg-background relative overflow-hidden flex items-center justify-center p-6 font-sans py-12">
      <div className="absolute top-[-15%] right-[-10%] w-[50%] h-[50%] bg-emerald-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] left-[-10%] w-[55%] h-[55%] bg-teal-500/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10 animate-fade-in-up">
        <Link
          href="/"
          className="flex items-center gap-3 justify-center mb-8 group w-fit mx-auto"
        >
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20 group-hover:scale-105 transition-transform">
            <i className="fa-solid fa-graduation-cap text-lg" />
          </div>
          <span className="text-xl font-bold tracking-tight text-foreground">
            EduConnect<span className="text-primary font-extrabold">360</span>
          </span>
        </Link>

        <div className="glass-panel rounded-3xl p-8 md:p-10 border-2 border-primary/20">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center text-lg">
              <i className="fa-solid fa-shield-halved" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-foreground">ลงทะเบียนผู้ดูแลระบบ (Admin)</h1>
              <p className="text-xs text-muted-foreground">สำหรับคณะผู้บริหารและฝ่ายไอทีสถานศึกษา</p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-400 mb-6 flex items-start gap-2.5">
            <i className="fa-solid fa-circle-exclamation text-sm shrink-0 mt-0.5" />
            <span>
              เฉพาะอีเมลที่ได้รับการอนุมัติใน <strong>Whitelist</strong> ของสถานศึกษา และลงท้ายด้วย <strong>.ac.th</strong> เท่านั้นจึงจะสามารถลงทะเบียนได้
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                ชื่อ-นามสกุล ผู้ดูแลระบบ
              </label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="กรุณาใส่ชื่อ - สกุล"
                className="w-full px-4 py-2.5 rounded-xl bg-background/60 border border-border focus:outline-none focus:ring-2 focus:ring-primary/80 text-foreground text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5 flex items-center justify-between">
                <span>อีเมลทางการสถานศึกษา (.ac.th)</span>
                <span className="text-[11px] text-primary font-mono font-medium">*.ac.th only</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@school.ac.th"
                className="w-full px-4 py-2.5 rounded-xl bg-background/60 border border-border focus:outline-none focus:ring-2 focus:ring-primary/80 text-foreground text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                รหัสผ่านสำหรับเข้าสู่ระบบ
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="อย่างน้อย 6 ตัวอักษร"
                className="w-full px-4 py-2.5 rounded-xl bg-background/60 border border-border focus:outline-none focus:ring-2 focus:ring-primary/80 text-foreground text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all duration-300 shadow-lg shadow-primary/25 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 flex items-center justify-center gap-2 mt-4"
            >
              {submitting ? (
                <>
                  <i className="fa-solid fa-circle-notch fa-spin" /> กำลังตรวจสอบสิทธิ์...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-shield-check" /> ลงทะเบียนผู้ดูแลระบบ
                </>
              )}
            </button>
          </form>

          <p className="text-center text-xs text-muted-foreground mt-6">
            กลับไปหน้าทั่วไป?{" "}
            <Link href="/login" className="text-primary font-semibold hover:underline">
              เข้าสู่ระบบ
            </Link>{" "}
            หรือ{" "}
            <Link href="/register" className="text-primary font-semibold hover:underline">
              สมัครสมาชิกทั่วไป
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
