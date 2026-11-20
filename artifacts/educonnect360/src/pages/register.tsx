import { useState, useEffect, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import type { UserRole } from "@/types";

export default function Register() {
  const { register, firebaseUser, profile, loading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("student");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && firebaseUser && profile) {
      if (profile.role === "teacher") setLocation("/teacher");
      else if (profile.role === "parent") setLocation("/parent");
      else setLocation("/student");
    }
  }, [loading, firebaseUser, profile, setLocation]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await register(email, password, displayName, role);
      toast({ title: "สร้างบัญชีสำเร็จ", description: "ยินดีต้อนรับสู่ EduConnect360" });
      if (role === "teacher") setLocation("/teacher");
      else if (role === "parent") setLocation("/parent");
      else setLocation("/student");
    } catch (err) {
      toast({
        variant: "destructive",
        title: "สมัครสมาชิกไม่สำเร็จ",
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
          <h1 className="text-2xl font-bold text-foreground mb-1">สร้างบัญชีใหม่</h1>
          <p className="text-muted-foreground text-sm mb-8">
            เริ่มต้นใช้งานแคมปัสดิจิทัลของคุณวันนี้
          </p>

          <div className="grid grid-cols-3 gap-2 mb-6">
            <button
              type="button"
              onClick={() => setRole("student")}
              className={`rounded-xl p-3 border-2 transition-all duration-200 flex flex-col items-center gap-1.5 ${
                role === "student"
                  ? "border-primary bg-primary/10 text-primary shadow-md"
                  : "border-border bg-background/40 text-muted-foreground hover:border-primary/40"
              }`}
            >
              <i className="fa-solid fa-user-graduate text-lg" />
              <span className="text-xs font-semibold">นักเรียน</span>
            </button>
            <button
              type="button"
              onClick={() => setRole("teacher")}
              className={`rounded-xl p-3 border-2 transition-all duration-200 flex flex-col items-center gap-1.5 ${
                role === "teacher"
                  ? "border-primary bg-primary/10 text-primary shadow-md"
                  : "border-border bg-background/40 text-muted-foreground hover:border-primary/40"
              }`}
            >
              <i className="fa-solid fa-chalkboard-user text-lg" />
              <span className="text-xs font-semibold">ครู</span>
            </button>
            <button
              type="button"
              onClick={() => setRole("parent")}
              className={`rounded-xl p-3 border-2 transition-all duration-200 flex flex-col items-center gap-1.5 ${
                role === "parent"
                  ? "border-primary bg-primary/10 text-primary shadow-md"
                  : "border-border bg-background/40 text-muted-foreground hover:border-primary/40"
              }`}
            >
              <i className="fa-solid fa-people-roof text-lg" />
              <span className="text-xs font-semibold">ผู้ปกครอง</span>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">
                ชื่อ-นามสกุล
              </label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="สมชาย ใจดี"
                className="w-full px-4 py-3 rounded-xl bg-background/60 border border-border focus:outline-none focus:ring-2 focus:ring-ring text-foreground placeholder:text-muted-foreground/70"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">
                อีเมล
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@school.ac.th"
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
                placeholder="อย่างน้อย 6 ตัวอักษร"
                className="w-full px-4 py-3 rounded-xl bg-background/60 border border-border focus:outline-none focus:ring-2 focus:ring-ring text-foreground placeholder:text-muted-foreground/70"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-all duration-300 shadow-lg shadow-primary/25 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 disabled:hover:translate-y-0 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <i className="fa-solid fa-circle-notch fa-spin" />
              ) : (
                <>
                  สมัครสมาชิก <i className="fa-solid fa-arrow-right text-xs" />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-8">
            มีบัญชีอยู่แล้ว?{" "}
            <Link href="/login" className="text-primary font-semibold hover:underline">
              เข้าสู่ระบบ
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
