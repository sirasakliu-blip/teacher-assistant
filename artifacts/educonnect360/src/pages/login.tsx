import { useState, useEffect, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export default function Login() {
  const { login, loginWithGoogle, firebaseUser, profile, loading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [loginRole, setLoginRole] = useState<"student" | "teacher">("teacher");
  const [studentId, setStudentId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleGoogleLogin() {
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
      toast({
        title: "เข้าสู่ระบบสำเร็จ",
        description: "ยินดีต้อนรับเข้าสู่ระบบ",
      });
    } catch (err: any) {
      console.error("Google sign-in error:", err);
      let errorMsg = "ไม่สามารถลงชื่อเข้าใช้ด้วย Google ได้";
      if (err?.code === "auth/popup-closed-by-user") {
        errorMsg = "หน้าต่างเข้าสู่ระบบถูกปิดก่อนทำรายการสำเร็จ";
      } else if (err?.code === "auth/operation-not-allowed") {
        errorMsg = "ยังไม่ได้เปิดใช้งาน Google Provider ใน Firebase Console (Authentication > Sign-in method > Google)";
      } else if (err?.code === "auth/unauthorized-domain") {
        errorMsg = `โดเมน ${window.location.hostname} ยังไม่ได้รับอนุญาตใน Firebase ให้เพิ่มใน Authentication > Settings > Authorized domains`;
      } else if (err?.message) {
        errorMsg = err.message;
      }
      toast({
        variant: "destructive",
        title: "เข้าสู่ระบบไม่สำเร็จ",
        description: errorMsg,
      });
    } finally {
      setGoogleLoading(false);
    }
  }

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
        if (!password) {
          throw new Error("กรุณากรอกรหัสผ่าน");
        }
        const syntheticEmail = `${cleanId}@student.school.local`;
        try {
          await login(syntheticEmail, password);
        } catch {
          if (password === "0000") {
            try {
              await login(syntheticEmail, `STD_0000_${cleanId}`);
            } catch {
              try {
                await login(syntheticEmail, "000000");
              } catch {
                try {
                  await login(syntheticEmail, `STD_PASS_${cleanId}`);
                } catch {
                  throw new Error("รหัสนักเรียนหรือรหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบหรือติดต่อครูประจำชั้น");
                }
              }
            }
          } else {
            throw new Error("รหัสนักเรียนหรือรหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบหรือติดต่อครูประจำชั้น");
          }
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
              /* Student Login Form: Student ID & Password */
              <div className="space-y-4 animate-fade-in-down transition-all duration-200">
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                    <i className="fa-solid fa-id-badge text-primary" />
                    รหัสนักเรียน
                  </label>
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
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                    <i className="fa-solid fa-lock text-primary" />
                    รหัสผ่าน
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 rounded-xl bg-background/60 border border-border focus:outline-none focus:ring-2 focus:ring-primary/80 text-foreground placeholder:text-muted-foreground/60 text-base"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                  <i className="fa-solid fa-circle-info text-primary" />
                  สำหรับนักเรียน: กรุณาใช้รหัสผ่านที่ได้รับจากครูประจำชั้น
                </p>
              </div>
            ) : (
              /* Teacher / Personnel Login Form: Google & Email Options */
              <div className="space-y-4 animate-fade-in-down transition-all duration-200">
                {/* Google Sign-in Option */}
                <div className="rounded-2xl p-4 bg-muted/40 border border-border/80 text-center space-y-3">
                  <p className="text-xs text-muted-foreground font-medium flex items-center justify-center gap-1.5">
                    <span className="text-primary text-sm">✦</span> ใช้บัญชี Google ขององค์กรเพื่อเข้าใช้งาน
                  </p>
                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={googleLoading || submitting}
                    className="w-full py-3 px-4 rounded-xl border border-border bg-white hover:bg-slate-50 dark:bg-card dark:hover:bg-accent text-slate-800 dark:text-foreground font-semibold text-sm transition-all duration-200 shadow-sm flex items-center justify-center gap-3 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 cursor-pointer"
                  >
                    {googleLoading ? (
                      <i className="fa-solid fa-circle-notch fa-spin text-primary" />
                    ) : (
                      <>
                        <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                          <path
                            fill="#4285F4"
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          />
                          <path
                            fill="#34A853"
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                          />
                          <path
                            fill="#EA4335"
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                          />
                        </svg>
                        <span>ลงชื่อเข้าใช้ด้วย Google</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="relative my-3">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border/60" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-card px-2 text-muted-foreground">หรือเข้าสู่ระบบด้วยอีเมล</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1.5">
                    อีเมล
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="teacher@school.ac.th"
                    className="w-full px-4 py-2.5 rounded-xl bg-background/60 border border-border focus:outline-none focus:ring-2 focus:ring-ring text-foreground placeholder:text-muted-foreground/70 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1.5">
                    รหัสผ่าน
                  </label>
                  <input
                    type="password"
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-2.5 rounded-xl bg-background/60 border border-border focus:outline-none focus:ring-2 focus:ring-ring text-foreground placeholder:text-muted-foreground/70 text-sm"
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
