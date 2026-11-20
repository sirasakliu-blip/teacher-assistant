import { useEffect, useState } from "react";
import { Link, useParams } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  getClassById,
  getTodaySessionForClass,
  getOrCreateTodaySession,
  hasStudentCheckedIn,
  recordAttendance,
} from "@/lib/firestore";
import { coverGradient } from "@/lib/covers";
import { StudentAssignmentsPanel } from "@/components/student-assignments-panel";
import type { Class, ClassSession } from "@/types";

export default function StudentClass() {
  const { classId } = useParams<{ classId: string }>();
  const { profile } = useAuth();
  const { toast } = useToast();
  const [cls, setCls] = useState<Class | null>(null);
  const [session, setSession] = useState<ClassSession | null>(null);
  const [checkedIn, setCheckedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  async function load() {
    if (!profile) return;
    setLoading(true);
    try {
      const found = await getClassById(classId);
      setCls(found);
      if (found) {
        const s = await getTodaySessionForClass(found.id);
        setSession(s);
        if (s) {
          setCheckedIn(await hasStudentCheckedIn(s.id, profile.id));
        }
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "โหลดข้อมูลห้องเรียนไม่สำเร็จ",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, profile?.id]);

  async function handleDirectCheckIn() {
    if (!cls || !profile) return;
    setScanning(true);
    try {
      const s =
        session ??
        (await getTodaySessionForClass(cls.id)) ??
        (await getOrCreateTodaySession(cls.id, cls.teacherId || "teacher"));
      setSession(s);

      const result = await recordAttendance({
        classId: cls.id,
        sessionId: s.id,
        studentId: profile.id,
        studentName: profile.displayName,
        date: s.date,
      });
      setCheckedIn(true);
      toast({
        title: result.alreadyCheckedIn ? "คุณเช็คชื่อไปแล้ว" : "เช็คชื่อสำเร็จ",
        description: result.alreadyCheckedIn
          ? "บันทึกไว้แล้วสำหรับวันนี้"
          : `บันทึกเวลา ${new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}`,
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "เช็คชื่อไม่สำเร็จ",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setScanning(false);
    }
  }

  async function handleScan() {
    if (!cls || !profile) return;
    setScanning(true);
    try {
      const s =
        session ??
        (await getTodaySessionForClass(cls.id)) ??
        (await getOrCreateTodaySession(cls.id, cls.teacherId || "teacher"));
      setSession(s);
      // Simulate the time it takes to scan a real QR code so the interaction
      // feels intentional rather than instantaneous.
      await new Promise((resolve) => setTimeout(resolve, 900));
      const result = await recordAttendance({
        classId: cls.id,
        sessionId: s.id,
        studentId: profile.id,
        studentName: profile.displayName,
        date: s.date,
      });
      setCheckedIn(true);
      toast({
        title: result.alreadyCheckedIn ? "คุณเช็คชื่อไปแล้ว" : "เช็คชื่อสำเร็จ",
        description: result.alreadyCheckedIn
          ? "บันทึกไว้แล้วสำหรับวันนี้"
          : `บันทึกเวลา ${new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}`,
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "เช็คชื่อไม่สำเร็จ",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setScanning(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-[100dvh] w-full bg-background flex items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <i className="fa-solid fa-circle-notch fa-spin text-primary text-xl" /> กำลังโหลด...
        </div>
      </div>
    );
  }

  if (!cls) {
    return (
      <div className="min-h-[100dvh] w-full bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">ไม่พบห้องเรียนนี้</p>
        <Link href="/student" className="text-primary font-semibold hover:underline">
          กลับหน้าห้องเรียน
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] w-full bg-background relative overflow-hidden font-sans">
      <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] left-[-10%] w-[55%] h-[55%] bg-teal-500/5 rounded-full blur-[120px] pointer-events-none" />

      <nav className="w-full px-6 md:px-10 py-5 flex items-center justify-between relative z-10 glass-panel border-x-0 border-t-0 rounded-none">
        <Link href="/student" className="flex items-center gap-2 text-foreground font-semibold text-sm hover:text-primary transition-colors">
          <i className="fa-solid fa-arrow-left" /> ห้องเรียนของฉัน
        </Link>
      </nav>

      <main className="relative z-10 max-w-2xl mx-auto px-6 md:px-10 py-14 flex flex-col items-center text-center">
        <div className={`w-20 h-20 rounded-3xl bg-gradient-to-br ${coverGradient(cls.cover)} flex items-center justify-center text-white text-3xl mb-6 shadow-xl animate-fade-in-up`}>
          <i className="fa-solid fa-book" />
        </div>
        <h1 className="text-3xl font-extrabold text-foreground mb-1 animate-fade-in-up" style={{ animationDelay: "60ms", animationFillMode: "both" }}>
          {cls.name}
        </h1>
        <p className="text-muted-foreground mb-10 animate-fade-in-up" style={{ animationDelay: "120ms", animationFillMode: "both" }}>
          {cls.gradeLevel} &middot; ครู{cls.teacherName}
        </p>

        <div className="glass-panel rounded-3xl p-10 w-full flex flex-col items-center animate-fade-in-up mb-8" style={{ animationDelay: "200ms", animationFillMode: "both" }}>
          {checkedIn ? (
            <>
              <div className="w-24 h-24 rounded-full bg-emerald-500/15 flex items-center justify-center text-emerald-600 text-4xl mb-6">
                <i className="fa-solid fa-circle-check" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">เช็คชื่อวันนี้เรียบร้อยแล้ว</h3>
              <p className="text-muted-foreground text-sm">พบกันในชั้นเรียนครับ/ค่ะ</p>
            </>
          ) : (
            <>
              <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center text-primary text-4xl mb-6">
                <i className="fa-solid fa-qrcode" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">
                พร้อมเช็คชื่อเข้าเรียนแล้ว
              </h3>
              <p className="text-muted-foreground text-sm mb-6 max-w-sm">
                กดปุ่มเช็คชื่อเข้าเรียน หรือสแกน QR Code จากหน้าจอคุณครูเพื่อบันทึกเวลาเรียน
              </p>
              <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                <button
                  onClick={handleDirectCheckIn}
                  disabled={scanning}
                  className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-all duration-300 shadow-xl shadow-primary/25 hover:-translate-y-1 active:translate-y-0 disabled:opacity-60 flex items-center justify-center gap-2.5 text-sm cursor-pointer"
                >
                  {scanning ? (
                    <>
                      <i className="fa-solid fa-circle-notch fa-spin" /> กำลังบันทึก...
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-circle-check text-base" /> กดเช็คชื่อเข้าเรียนวันนี้
                    </>
                  )}
                </button>
                <button
                  onClick={handleScan}
                  disabled={scanning}
                  className="w-full sm:w-auto px-6 py-3.5 rounded-xl border border-border bg-card text-foreground font-semibold hover:bg-muted transition-all duration-300 flex items-center justify-center gap-2 text-sm cursor-pointer"
                >
                  <i className="fa-solid fa-qrcode" /> สแกน QR Code
                </button>
              </div>
            </>
          )}
        </div>

        <div className="w-full text-left">
          <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
            <i className="fa-solid fa-file-pen text-primary" /> การบ้านของฉัน
          </h3>
          {profile && (
            <StudentAssignmentsPanel
              classId={cls.id}
              studentId={profile.id}
              studentName={profile.displayName}
            />
          )}
        </div>
      </main>
    </div>
  );
}
