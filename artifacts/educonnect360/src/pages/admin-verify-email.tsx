import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export default function AdminVerifyEmail() {
  const { firebaseUser, reloadUser, resendVerificationEmail, logout, loading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    // If not loading and user is not logged in, navigate to login page
    if (!loading && !firebaseUser) {
      setLocation("/login");
    }
  }, [loading, firebaseUser, setLocation]);

  async function handleLogoutAndGoLogin() {
    setLoggingOut(true);
    try {
      await logout();
    } catch (err) {
      console.warn("Logout error:", err);
    } finally {
      setLoggingOut(false);
      setLocation("/login");
    }
  }

  async function handleCheckStatus() {
    setChecking(true);
    try {
      const refreshedUser = await reloadUser();
      if (refreshedUser?.emailVerified) {
        toast({
          title: "ยืนยันอีเมลสำเร็จแล้ว!",
          description: "ยินดีต้อนรับเข้าสู่ระบบจัดการสำหรับผู้ดูแลระบบ",
        });
        setLocation("/admin");
      } else {
        toast({
          variant: "destructive",
          title: "ยังไม่พบการยืนยันอีเมล",
          description: "กรุณากดลิงก์ในกล่องข้อความอีเมลของคุณ แล้วกดตรวจสอบอีกครั้ง",
        });
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "ตรวจสอบไม่สำเร็จ",
        description: err instanceof Error ? err.message : "เกิดข้อผิดพลาด",
      });
    } finally {
      setChecking(false);
    }
  }

  async function handleResend() {
    setResending(true);
    try {
      await resendVerificationEmail();
      toast({
        title: "ส่งลิงก์ยืนยันสำเร็จ",
        description: `ระบบได้ส่งอีเมลยืนยันไปยัง ${firebaseUser?.email || "อีเมลของคุณ"} เรียบร้อยแล้ว`,
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "ส่งลิงก์ไม่สำเร็จ",
        description: err instanceof Error ? err.message : "กรุณารอสักครู่แล้วลองใหม่",
      });
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="min-h-[100dvh] w-full bg-background relative overflow-hidden flex items-center justify-center p-6 font-sans">
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

        <div className="glass-panel rounded-3xl p-8 md:p-10 border-2 border-primary/20 text-center">
          <div className="w-16 h-16 rounded-3xl bg-primary/10 text-primary flex items-center justify-center text-2xl mx-auto mb-4 animate-bounce">
            <i className="fa-solid fa-envelope-circle-check" />
          </div>

          <h1 className="text-2xl font-bold text-foreground mb-2">
            รอการยืนยันอีเมลสำหรับผู้ดูแลระบบ
          </h1>
          <p className="text-xs text-muted-foreground leading-relaxed mb-6">
            เพื่อความปลอดภัยสูงสุดของสถานศึกษา บัญชี Admin จะต้องยืนยันตัวตนผ่านลิงก์ในอีเมลก่อนเข้าใช้งานระบบ
          </p>

          <div className="p-4 rounded-2xl bg-muted/50 border border-border/80 mb-6 text-left">
            <span className="text-[11px] font-semibold text-muted-foreground block mb-1">
              อีเมลที่ต้องยืนยัน:
            </span>
            <span className="font-mono text-sm font-bold text-foreground break-all flex items-center gap-2">
              <i className="fa-solid fa-envelope text-primary text-xs" />
              {firebaseUser?.email || "admin@school.ac.th"}
            </span>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleCheckStatus}
              disabled={checking}
              className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all duration-300 shadow-lg shadow-primary/25 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {checking ? (
                <>
                  <i className="fa-solid fa-circle-notch fa-spin" /> กำลังตรวจสอบ...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-arrows-rotate" /> ตรวจสอบสถานะการยืนยัน
                </>
              )}
            </button>

            <button
              onClick={handleResend}
              disabled={resending}
              className="w-full py-2.5 rounded-xl glass-panel text-foreground font-semibold text-xs hover:bg-white/60 dark:hover:bg-black/20 transition-all flex items-center justify-center gap-2 border border-border"
            >
              {resending ? (
                <>
                  <i className="fa-solid fa-circle-notch fa-spin" /> กำลังส่ง...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-paper-plane text-primary" /> ส่งลิงก์ยืนยันอีกครั้ง
                </>
              )}
            </button>
          </div>

          <div className="pt-6 mt-6 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
            <button
              type="button"
              disabled={loggingOut}
              onClick={handleLogoutAndGoLogin}
              className="hover:text-primary transition-colors flex items-center gap-1.5 cursor-pointer bg-transparent border-0 p-0 text-xs text-muted-foreground disabled:opacity-50"
            >
              <i className="fa-solid fa-arrow-left" /> หน้าเข้าสู่ระบบ
            </button>
            <button
              type="button"
              disabled={loggingOut}
              onClick={handleLogoutAndGoLogin}
              className="hover:text-destructive transition-colors flex items-center gap-1.5 cursor-pointer bg-transparent border-0 p-0 text-xs text-muted-foreground disabled:opacity-50"
            >
              <i className="fa-solid fa-right-from-bracket" /> {loggingOut ? "กำลังออกจากระบบ..." : "ออกจากระบบ"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
