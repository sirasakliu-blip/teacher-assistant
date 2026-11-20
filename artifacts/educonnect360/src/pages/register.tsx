import { useState, useEffect, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export default function Register() {
  const { register, firebaseUser, profile, loading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && firebaseUser && profile) {
      if (profile.role === "admin") setLocation("/admin");
      else if (profile.role === "teacher") setLocation("/teacher");
      else if (profile.role === "parent") setLocation("/parent");
      else setLocation("/student");
    }
  }, [loading, firebaseUser, profile, setLocation]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!displayName.trim()) {
      toast({
        variant: "destructive",
        title: "กรุณากรอกชื่อ-นามสกุล",
      });
      return;
    }

    if (!email.trim()) {
      toast({
        variant: "destructive",
        title: "กรุณากรอกอีเมล",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        variant: "destructive",
        title: "รหัสผ่านสั้นเกินไป",
        description: "รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร",
      });
      return;
    }

    if (!inviteCode.trim()) {
      toast({
        variant: "destructive",
        title: "กรุณากรอกรหัสลงทะเบียนบุคลากร",
        description: "จำเป็นต้องระบุรหัสลงทะเบียนที่ได้รับจากผู้ดูแลระบบสถานศึกษา",
      });
      return;
    }

    setSubmitting(true);
    try {
      await register(email, password, displayName, "teacher", {
        inviteCode: inviteCode.trim(),
      });
      toast({
        title: "ลงทะเบียนบุคลากรสำเร็จ",
        description: `ยินดีต้อนรับ ${displayName} สู่ระบบ EduConnect360`,
      });
      setLocation("/teacher");
    } catch (err) {
      toast({
        variant: "destructive",
        title: "ลงทะเบียนไม่สำเร็จ",
        description: err instanceof Error ? err.message : "กรุณาลองใหม่อีกครั้ง",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-[100dvh] w-full bg-background relative overflow-hidden flex items-center justify-center p-6 font-sans py-12">
      <div className="absolute top-[-15%] right-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
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

        <div className="glass-panel rounded-3xl p-8 md:p-10">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary w-fit text-xs font-semibold mb-3">
            <i className="fa-solid fa-chalkboard-user" /> สำหรับครูและบุคลากรทางการศึกษา
          </div>

          <h1 className="text-2xl font-bold text-foreground mb-1">
            ลงทะเบียนสำหรับครูและบุคลากร
          </h1>
          <p className="text-muted-foreground text-sm mb-6">
            กรอกข้อมูลและรหัสลงทะเบียนบุคลากรเพื่อเข้าใช้งานระบบ
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1.5">
                ชื่อ-นามสกุล (พร้อมคำนำหน้า)
              </label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="เช่น อาจารย์สมคิด จิตมั่นคง"
                className="w-full px-4 py-3 rounded-xl bg-background/60 border border-border focus:outline-none focus:ring-2 focus:ring-ring text-foreground placeholder:text-muted-foreground/70"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-foreground mb-1.5">
                อีเมล
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teacher@school.ac.th"
                className="w-full px-4 py-3 rounded-xl bg-background/60 border border-border focus:outline-none focus:ring-2 focus:ring-ring text-foreground placeholder:text-muted-foreground/70"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-foreground mb-1.5">
                รหัสผ่าน (อย่างน้อย 6 ตัวอักษร)
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl bg-background/60 border border-border focus:outline-none focus:ring-2 focus:ring-ring text-foreground placeholder:text-muted-foreground/70"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-foreground mb-1.5 flex items-center justify-between">
                <span>รหัสลงทะเบียนบุคลากร (Teacher Invite Code)</span>
                <span className="text-[11px] font-normal text-muted-foreground">ใช้ได้ 1 ครั้ง</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase().replace(/\s+/g, ""))}
                  placeholder="เช่น TCH-XXXX-XX"
                  className="w-full px-4 py-3 rounded-xl bg-primary/5 border border-primary/30 focus:outline-none focus:ring-2 focus:ring-primary text-foreground font-mono uppercase tracking-wider placeholder:normal-case placeholder:tracking-normal placeholder:font-sans placeholder:text-muted-foreground/60"
                />
                <i className="fa-solid fa-key absolute right-3.5 top-3.5 text-muted-foreground/60 text-sm" />
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                ขอรับรหัสได้จากผู้ดูแลระบบสถานศึกษา (Admin)
              </p>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-all duration-300 shadow-lg shadow-primary/25 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 disabled:hover:translate-y-0 flex items-center justify-center gap-2 mt-4"
            >
              {submitting ? (
                <>
                  <i className="fa-solid fa-circle-notch fa-spin text-sm" />
                  กำลังลงทะเบียน...
                </>
              ) : (
                <>
                  ยืนยันการลงทะเบียน <i className="fa-solid fa-arrow-right text-xs" />
                </>
              )}
            </button>
          </form>

          {/* Student & Parent Notice */}
          <div className="mt-6 p-3.5 rounded-2xl bg-muted/60 border border-border/80 text-xs text-muted-foreground space-y-1.5">
            <p className="flex items-start gap-2">
              <i className="fa-solid fa-user-graduate text-primary mt-0.5" />
              <span>
                <strong>สำหรับนักเรียน:</strong> บัญชีจะถูกสร้างโดยครูประจำชั้น กรุณารับรหัสนักเรียนและรหัสผ่านจากครู
              </span>
            </p>
            <p className="flex items-start gap-2">
              <i className="fa-solid fa-comment-dots text-emerald-600 mt-0.5" />
              <span>
                <strong>สำหรับผู้ปกครอง:</strong> ไม่ต้องสร้างบัญชี สามารถติดตามผลการเรียนและการเข้าเรียนได้ทาง LINE Official Account
              </span>
            </p>
          </div>

          <p className="text-center text-sm text-muted-foreground mt-6">
            มีบัญชีอยู่แล้ว?{" "}
            <Link href="/login" className="text-primary font-semibold hover:underline">
              เข้าสู่ระบบ
            </Link>
          </p>

          <div className="pt-4 mt-6 border-t border-border/40 text-center">
            <Link
              href="/admin-register"
              className="text-xs text-muted-foreground/70 hover:text-primary transition-colors inline-flex items-center gap-1.5"
            >
              <i className="fa-solid fa-shield-halved text-[11px]" />
              ลงทะเบียนสำหรับผู้ดูแลระบบสถานศึกษา (Admin)
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
