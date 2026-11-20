import { useState, useEffect, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export default function Login() {
  const { login, firebaseUser, profile, loading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [loginRole, setLoginRole] = useState<"student" | "teacher">("student");
  const [studentId, setStudentId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && firebaseUser && profile) {
      if (profile.role === "admin") {
        if (!firebaseUser.emailVerified) {
          setLocation("/admin-verify-email");
        } else {
          setLocation("/admin");
        }
      } else if (profile.role === "teacher") {
        setLocation("/teacher");
      } else if (profile.role === "parent") {
        setLocation("/parent");
      } else {
        setLocation("/student");
      }
    }
  }, [loading, firebaseUser, profile, setLocation]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (loginRole === "student") {
        const cleanId = studentId.trim();
        if (!cleanId) {
          throw new Error("กรุณากรอกรหัสนักเรียน");
        }
        const syntheticEmail = `${cleanId}@student.school.local`;
        const syntheticPassword = `STD_PASS_${cleanId}`;
        try {
          await login(syntheticEmail, syntheticPassword);
        } catch {
          throw new Error("ไม่พบรหัสนักเรียนนี้ในระบบ กรุณาสมัครสมาชิกก่อนเข้าใช้งาน");
        }
      } else {
        await login(email, password);
      }
      toast({ title: "เข้าสู่ระบบสำเร็จ", description: "ยินดีต้อนรับกลับ" });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "เข้าสู่ระบบไม่สำเร็จ",
        description: err instanceof Error ? err.message : "กรุณาลองใหม่อีกครั้ง",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-[100dvh] w-full bg-background relative overflow-hidden flex items-center justify-center p-6 font-sans">
      <div className="absolute top-[-15%] left-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[55%] h-[55%] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />

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
          <h1 className="text-2xl font-bold text-foreground mb-1">ยินดีต้อนรับกลับ</h1>
          <p className="text-muted-foreground text-sm mb-6">
            เข้าสู่ระบบเพื่อจัดการห้องเรียนและการเข้าเรียนของคุณ
          </p>

          {/* Role Tab Switcher: นักเรียน vs ครู / บุคลากร */}
          <div className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl bg-muted/60 border border-border/80 mb-6">
            <button
              type="button"
              onClick={() => setLoginRole("student")}
              className={`py-2.5 px-3 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
                loginRole === "student"
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/20 scale-[1.01]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <i className="fa-solid fa-user-graduate" /> นักเรียน
            </button>
            <button
              type="button"
              onClick={() => setLoginRole("teacher")}
              className={`py-2.5 px-3 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
                loginRole === "teacher"
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/20 scale-[1.01]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <i className="fa-solid fa-chalkboard-user" /> ครู / บุคลากร
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {loginRole === "student" ? (
              /* Student Login Form: Only Student ID */
              <div className="animate-fade-in-down transition-all duration-200">
                <label className="block text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                  <i className="fa-solid fa-id-badge text-primary" />
                  รหัสนักเรียน
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value.replace(/\s+/g, ""))}
                    placeholder="กรอกรหัสนักเรียน เช่น 67105"
                    className="w-full px-4 py-3 rounded-xl bg-background/60 border border-border focus:outline-none focus:ring-2 focus:ring-primary/80 text-foreground font-mono placeholder:text-muted-foreground/60 text-base"
                    autoFocus
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
                  <i className="fa-solid fa-circle-info text-primary" />
                  เข้าสู่ระบบสะดวกรวดเร็วด้วยรหัสนักเรียนโดยไม่ต้องใช้อีเมล
                </p>
              </div>
            ) : (
              /* Teacher Login Form: Email & Password */
              <div className="space-y-4 animate-fade-in-down transition-all duration-200">
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">
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
                  <label className="block text-sm font-semibold text-foreground mb-2">
                    รหัสผ่าน
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
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-all duration-300 shadow-lg shadow-primary/25 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 disabled:hover:translate-y-0 flex items-center justify-center gap-2 mt-2"
            >
              {submitting ? (
                <i className="fa-solid fa-circle-notch fa-spin" />
              ) : (
                <>
                  เข้าสู่ระบบ <i className="fa-solid fa-arrow-right text-xs" />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-8">
            ยังไม่มีบัญชี?{" "}
            <Link href="/register" className="text-primary font-semibold hover:underline">
              สมัครสมาชิก
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
