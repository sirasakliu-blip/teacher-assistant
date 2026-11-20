import { useState, useEffect } from "react";
import { Link } from "wouter";
import { getParentViewData } from "@/lib/firestore";
import type { User, Class, Attendance, LeaveRequest, ParentViewToken } from "@/types";
import { coverGradient } from "@/lib/covers";

export default function ParentView() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{
    tokenData: ParentViewToken;
    student: User;
    classes: Class[];
    attendanceRecords: Attendance[];
    leaveRequests: LeaveRequest[];
    stats: {
      attendanceRate: number;
      totalSessions: number;
      present: number;
      late: number;
      absent: number;
      excused: number;
    };
  } | null>(null);

  useEffect(() => {
    async function load() {
      const params = new URLSearchParams(window.location.search);
      const token = params.get("token");

      if (!token) {
        setError("ไม่พบรหัส Token สำหรับเข้าดูข้อมูล กรุณาขอลิงก์ใหม่จากนักเรียนหรือครูผู้สอน");
        setLoading(false);
        return;
      }

      try {
        const result = await getParentViewData(token);
        if (!result) {
          setError("ลิงก์ติดตามผลนี้หมดอายุหรือถูกปิดใช้งานแล้ว กรุณาขอลิงก์ใหม่จากนักเรียนหรือครูผู้สอน");
        } else {
          setData(result);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการโหลดข้อมูล");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="min-h-[100dvh] w-full bg-background flex flex-col items-center justify-center p-6 font-sans">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-xl mb-4 animate-spin">
          <i className="fa-solid fa-circle-notch" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">กำลังโหลดข้อมูลติดตามผลการเรียน...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-[100dvh] w-full bg-background relative overflow-hidden flex items-center justify-center p-6 font-sans">
        <div className="w-full max-w-md glass-panel rounded-3xl p-8 md:p-10 border border-border text-center animate-fade-in-up">
          <div className="w-16 h-16 rounded-3xl bg-destructive/10 text-destructive flex items-center justify-center text-2xl mx-auto mb-4">
            <i className="fa-solid fa-link-slash" />
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">ไม่สามารถเข้าถึงข้อมูลได้</h1>
          <p className="text-xs text-muted-foreground leading-relaxed mb-6">
            {error || "ไม่พบข้อมูลที่ต้องการ"}
          </p>
          <div className="p-3.5 rounded-xl bg-muted/60 text-xs text-muted-foreground mb-6">
            <i className="fa-brands fa-line text-emerald-500 mr-1.5" />
            ผู้ปกครองสามารถแจ้งให้นักเรียนหรือครูกด "สร้างลิงก์ใหม่" แล้วส่งผ่าน LINE อีกครั้งได้ครับ
          </div>
          <Link
            href="/"
            className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
          >
            <i className="fa-solid fa-home" /> กลับสู่หน้าแรก
          </Link>
        </div>
      </div>
    );
  }

  const { student, classes, leaveRequests, stats } = data;

  return (
    <div className="min-h-[100dvh] w-full bg-background relative overflow-hidden flex flex-col font-sans pb-16">
      {/* Background decorations */}
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="w-full px-6 py-4 glass-panel border-x-0 border-t-0 rounded-none flex items-center justify-between sticky top-0 z-20 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-primary-foreground text-sm font-bold shadow-md shadow-primary/20">
            <i className="fa-solid fa-graduation-cap" />
          </div>
          <div>
            <span className="font-bold text-foreground text-sm tracking-tight block">
              ระบบติดตามผลสำหรับผู้ปกครอง
            </span>
            <span className="text-[11px] text-muted-foreground">Parent Magic Portal (Read-Only)</span>
          </div>
        </div>

        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> ออนไลน์
        </span>
      </header>

      <main className="max-w-2xl mx-auto w-full px-5 pt-6 space-y-6 relative z-10">
        {/* Student Profile Card (Mobile-First) */}
        <div className="glass-panel p-6 rounded-3xl border border-white/40 dark:border-white/10 shadow-lg relative overflow-hidden animate-fade-in-up">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-emerald-600 text-white flex items-center justify-center text-2xl font-bold shadow-md">
              <i className="fa-solid fa-user-graduate" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-primary uppercase tracking-wider block">
                ข้อมูลนักเรียน
              </span>
              <h2 className="text-2xl font-extrabold text-foreground">
                {student.fullName || student.displayName}
              </h2>
              {student.studentId && (
                <span className="inline-block mt-1 px-2.5 py-0.5 rounded-md bg-primary/10 text-primary font-mono text-xs font-bold border border-primary/20">
                  รหัสนักเรียน: {student.studentId}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Attendance Summary Stats Card */}
        <div className="glass-panel p-6 rounded-3xl border border-white/40 dark:border-white/10 space-y-4 animate-fade-in-up">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <i className="fa-solid fa-clipboard-user text-primary" /> สรุปการเข้าเรียน
            </h3>
            <span className="text-xs text-muted-foreground">
              ทั้งหมด {stats.totalSessions} วัน
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-background/60 border border-border/80 flex items-center justify-between">
            <div>
              <span className="text-xs text-muted-foreground block mb-0.5">อัตราการเข้าเรียน</span>
              <span className="text-3xl font-black text-foreground">{stats.attendanceRate}%</span>
            </div>
            <div className="w-14 h-14 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 flex items-center justify-center font-bold text-sm text-emerald-600">
              <i className="fa-solid fa-chart-pie" />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 text-center pt-2">
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold block">มาเรียน</span>
              <span className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">{stats.present}</span>
            </div>
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <span className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold block">มาสาย</span>
              <span className="text-xl font-extrabold text-amber-600 dark:text-amber-400">{stats.late}</span>
            </div>
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20">
              <span className="text-[11px] text-destructive font-semibold block">ขาดเรียน</span>
              <span className="text-xl font-extrabold text-destructive">{stats.absent}</span>
            </div>
            <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
              <span className="text-[11px] text-primary font-semibold block">ลากิจ/ป่วย</span>
              <span className="text-xl font-extrabold text-primary">{stats.excused}</span>
            </div>
          </div>
        </div>

        {/* Enrolled Classes Card */}
        <div className="glass-panel p-6 rounded-3xl border border-white/40 dark:border-white/10 space-y-4 animate-fade-in-up">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <i className="fa-solid fa-chalkboard text-primary" /> รายวิชาที่กำลังเรียน ({classes.length})
          </h3>

          {classes.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">ยังไม่มีรายวิชาที่เข้าร่วม</p>
          ) : (
            <div className="space-y-2.5">
              {classes.map((cls) => (
                <div
                  key={cls.id}
                  className="p-3.5 rounded-2xl bg-background/60 border border-border/80 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${coverGradient(cls.cover)} text-white flex items-center justify-center text-xs font-bold`}>
                      <i className="fa-solid fa-book" />
                    </div>
                    <div>
                      <span className="font-bold text-sm text-foreground block">{cls.name}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {cls.gradeLevel} &middot; ครู{cls.teacherName}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-lg bg-muted text-muted-foreground font-semibold">
                    ปกติ
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Leave Requests History Card */}
        <div className="glass-panel p-6 rounded-3xl border border-white/40 dark:border-white/10 space-y-4 animate-fade-in-up">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <i className="fa-solid fa-file-signature text-primary" /> ประวัติหนังสือใบลา
          </h3>

          {leaveRequests.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">ไม่มีประวัติการส่งใบลา</p>
          ) : (
            <div className="space-y-2.5">
              {leaveRequests.map((req) => (
                <div
                  key={req.id}
                  className="p-3.5 rounded-2xl bg-background/60 border border-border/80 flex items-center justify-between"
                >
                  <div>
                    <span className="font-bold text-xs text-foreground block">
                      {req.type === "sick" ? "ลาป่วย" : "ลากิจ"}: {req.reason}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {req.startDate} ถึง {req.endDate} ({req.daysCount} วัน)
                    </span>
                  </div>
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                      req.status === "approved"
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        : req.status === "rejected"
                        ? "bg-destructive/15 text-destructive"
                        : "bg-amber-500/15 text-amber-600"
                    }`}
                  >
                    {req.status === "approved" ? "อนุมัติแล้ว" : req.status === "rejected" ? "ไม่อนุมัติ" : "รอตรวจสอบ"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Note */}
        <div className="text-center text-[11px] text-muted-foreground pt-4">
          <p>ลิงก์นี้เป็นสิทธิ์สำหรับผู้ปกครองในการติดตามผลการเรียนเท่านั้น</p>
          <p className="mt-1">EduConnect360 &copy; {new Date().getFullYear()}</p>
        </div>
      </main>
    </div>
  );
}
