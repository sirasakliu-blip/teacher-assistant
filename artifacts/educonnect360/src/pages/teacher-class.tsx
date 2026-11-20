import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useLocation } from "wouter";
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  getClassAttendanceRate,
  getClassById,
  deleteClass,
  getOrCreateTodaySession,
  getTodaySessionForClass,
  subscribeSessionAttendance,
  updateOrSetStudentAttendance,
  batchSetAllAttendance,
  getClassStudents,
} from "@/lib/firestore";
import { coverGradient } from "@/lib/covers";
import { RiskTable } from "@/components/risk-table";
import { TeacherAssignmentsPanel } from "@/components/assignments-panel";
import { CreateStudentDialog } from "@/components/create-student-dialog";
import type { Attendance, AttendanceStatus, Class, ClassSession } from "@/types";

type TabId = "overview" | "assignments";

export default function TeacherClass() {
  const { classId } = useParams<{ classId: string }>();
  const [, setLocation] = useLocation();
  const { profile } = useAuth();
  const { toast } = useToast();
  const [cls, setCls] = useState<Class | null>(null);
  const [session, setSession] = useState<ClassSession | null>(null);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [rate, setRate] = useState<{ rate: number; totalSessions: number; totalCheckins: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [tab, setTab] = useState<TabId>("overview");
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [students, setStudents] = useState<Array<{ id: string; uid: string; studentId: string; fullName: string; gradeLevel: string }>>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showKioskModal, setShowKioskModal] = useState(false);
  const [kioskSearch, setKioskSearch] = useState("");
  const [markingAll, setMarkingAll] = useState(false);
  const [markingStudentId, setMarkingStudentId] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    async function load() {
      setLoading(true);
      try {
        const found = await getClassById(classId);
        setCls(found);
        if (found) {
          const [stats, todaySession, studentList] = await Promise.all([
            getClassAttendanceRate(found.id, found.studentIds.length),
            getTodaySessionForClass(found.id),
            getClassStudents(found),
          ]);
          setRate(stats);
          setStudents(studentList);
          if (todaySession) {
            setSession(todaySession);
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
    load();
    return () => unsubscribe?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  useEffect(() => {
    if (!session) return;
    const unsubscribe = subscribeSessionAttendance(session.id, setAttendance);
    return unsubscribe;
  }, [session]);

  async function handleStartSession() {
    if (!cls || !profile) return;
    setStarting(true);
    try {
      const s = await getOrCreateTodaySession(cls.id, profile.id);
      setSession(s);
      toast({ title: "เปิดเซสชันเช็คชื่อวันนี้แล้ว", description: "ให้นักเรียนสแกน QR Code เพื่อเช็คชื่อ" });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "เปิดเซสชันไม่สำเร็จ",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setStarting(false);
    }
  }

  async function handleDeleteClass() {
    if (!cls) return;
    setDeleting(true);
    try {
      await deleteClass(cls.id);
      toast({
        title: "ลบห้องเรียนสำเร็จ",
        description: `ลบห้องเรียน "${cls.name}" ออกจากระบบเรียบร้อยแล้ว`,
      });
      setLocation("/teacher");
    } catch (err) {
      toast({
        variant: "destructive",
        title: "ลบห้องเรียนไม่สำเร็จ",
        description: err instanceof Error ? err.message : undefined,
      });
      setDeleting(false);
    }
  }

  async function handleSetStatus(
    student: { id: string; uid: string; studentId: string; fullName: string },
    status: AttendanceStatus,
  ) {
    if (!cls || !profile) return;
    setMarkingStudentId(student.studentId || student.id);
    try {
      let currentSession = session;
      if (!currentSession) {
        currentSession = await getOrCreateTodaySession(cls.id, profile.id);
        setSession(currentSession);
      }
      await updateOrSetStudentAttendance({
        classId: cls.id,
        sessionId: currentSession.id,
        studentId: student.studentId || student.id,
        studentName: student.fullName,
        date: currentSession.date,
        status,
      });
      const statusText =
        status === "present"
          ? "เข้าเรียน 🟢"
          : status === "late"
          ? "มาสาย 🟡"
          : status === "excused"
          ? "ลา 🔵"
          : "ขาดเรียน 🔴";
      toast({
        title: "เช็คชื่อสำเร็จ",
        description: `${student.fullName}: ${statusText}`,
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "เช็คชื่อไม่สำเร็จ",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setMarkingStudentId(null);
    }
  }

  async function handleMarkAllPresent() {
    if (!cls || !profile || students.length === 0) return;
    setMarkingAll(true);
    try {
      let currentSession = session;
      if (!currentSession) {
        currentSession = await getOrCreateTodaySession(cls.id, profile.id);
        setSession(currentSession);
      }
      await batchSetAllAttendance({
        classId: cls.id,
        sessionId: currentSession.id,
        date: currentSession.date,
        students,
        status: "present",
      });
      toast({
        title: "เช็คชื่อสำเร็จ",
        description: `บันทึกว่า "มาเรียน" สำหรับนักเรียนทุกคน (${students.length} คน) เรียบร้อยแล้ว`,
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "เช็คชื่อไม่สำเร็จ",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setMarkingAll(false);
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
        <Link href="/teacher" className="text-primary font-semibold hover:underline">
          กลับหน้าห้องเรียน
        </Link>
      </div>
    );
  }

  const attendanceMap = useMemo(() => {
    const map = new Map<string, Attendance>();
    attendance.forEach((a) => {
      if (a.studentId) map.set(String(a.studentId), a);
      if (a.userId) map.set(String(a.userId), a);
    });
    return map;
  }, [attendance]);

  const rosterSize = Math.max(cls.studentIds.length, students.length);
  const checkedInToday = attendance.length;
  const todayRate = rosterSize > 0 ? Math.round((checkedInToday / rosterSize) * 100) : 0;
  const qrValue = session ? `EDUCONNECT360:${cls.id}:${session.id}` : "";

  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students;
    const q = searchQuery.toLowerCase().trim();
    return students.filter(
      (s) =>
        (s.fullName && s.fullName.toLowerCase().includes(q)) ||
        (s.studentId && s.studentId.toLowerCase().includes(q))
    );
  }, [students, searchQuery]);

  const kioskFilteredStudents = useMemo(() => {
    if (!kioskSearch.trim()) return students;
    const q = kioskSearch.toLowerCase().trim();
    return students.filter(
      (s) =>
        (s.fullName && s.fullName.toLowerCase().includes(q)) ||
        (s.studentId && s.studentId.toLowerCase().includes(q))
    );
  }, [students, kioskSearch]);

  const statsBreakdown = useMemo(() => {
    let present = 0;
    let late = 0;
    let excused = 0;
    let absent = 0;
    students.forEach((s) => {
      const att = attendanceMap.get(s.studentId || s.id);
      if (!att) return;
      if (att.status === "present") present++;
      else if (att.status === "late") late++;
      else if (att.status === "excused") excused++;
      else if (att.status === "absent") absent++;
    });
    const pending = Math.max(0, students.length - (present + late + excused + absent));
    return { present, late, excused, absent, pending };
  }, [students, attendanceMap]);

  return (
    <div className="min-h-[100dvh] w-full bg-background relative overflow-hidden font-sans">
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[55%] h-[55%] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />

      <nav className="w-full px-6 md:px-10 py-5 flex items-center justify-between relative z-10 glass-panel border-x-0 border-t-0 rounded-none">
        <Link href="/teacher" className="flex items-center gap-2 text-foreground font-semibold text-sm hover:text-primary transition-colors">
          <i className="fa-solid fa-arrow-left" /> ห้องเรียนของฉัน
        </Link>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="px-3.5 py-1.5 rounded-full border border-rose-300 bg-rose-50/60 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:border-rose-900/60 dark:text-rose-400 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="ลบห้องเรียนนี้"
          >
            <i className="fa-solid fa-trash-can text-xs" />
            ลบห้องเรียน
          </button>
          <button
            onClick={() => setShowAddStudent(true)}
            className="px-3.5 py-1.5 rounded-full bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold transition flex items-center gap-1.5"
          >
            <i className="fa-solid fa-user-plus" />
            + เพิ่มนักเรียนเข้าห้อง
          </button>
          <div className={`px-4 py-1.5 rounded-full bg-gradient-to-br ${coverGradient(cls.cover)} text-white text-xs font-bold tracking-widest font-mono`}>
            รหัสเข้าห้อง: {cls.joinCode}
          </div>
        </div>
      </nav>

      <main className="relative z-10 max-w-6xl mx-auto px-6 md:px-10 py-10">
        <div className="mb-6 animate-fade-in-up">
          <h1 className="text-3xl font-extrabold text-foreground">{cls.name}</h1>
          <p className="text-muted-foreground mt-1">{cls.gradeLevel}</p>
        </div>

        <div className="flex items-center gap-1 mb-8 glass-panel rounded-xl p-1.5 w-fit">
          {(
            [
              { id: "overview" as const, label: "ภาพรวม", icon: "fa-chart-line" },
              { id: "assignments" as const, label: "การบ้าน", icon: "fa-file-pen" },
            ]
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all ${
                tab === t.id ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <i className={`fa-solid ${t.icon}`} /> {t.label}
            </button>
          ))}
        </div>

        {tab === "assignments" && profile && (
          <TeacherAssignmentsPanel cls={cls} teacherId={profile.id} />
        )}

        {tab === "overview" && (
        <>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <StatCard icon="fa-users" label="นักเรียนทั้งหมด" value={String(rosterSize)} accent="text-primary" delay={0} />
          <StatCard icon="fa-user-check" label="เช็คชื่อวันนี้" value={`${checkedInToday} / ${rosterSize}`} accent="text-emerald-600" delay={80} />
          <StatCard icon="fa-chart-simple" label="อัตราเข้าเรียนสะสม" value={rate ? `${rate.rate}%` : "0%"} accent="text-teal-600" delay={160} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2 glass-panel rounded-3xl p-8 flex flex-col items-center text-center animate-fade-in-up">
            <h3 className="text-lg font-bold text-foreground mb-1">เซสชันเช็คชื่อวันนี้</h3>
            <p className="text-sm text-muted-foreground mb-6">
              {session ? "ให้นักเรียนสแกน QR Code นี้เพื่อเช็คชื่อ" : "ยังไม่ได้เปิดเซสชันสำหรับวันนี้"}
            </p>

            {session ? (
              <div className="p-4 bg-white rounded-2xl shadow-inner">
                <QRCodeSVG value={qrValue} size={200} fgColor="#065f46" level="M" />
              </div>
            ) : (
              <div className="w-[232px] h-[232px] rounded-2xl border-2 border-dashed border-border flex items-center justify-center">
                <i className="fa-solid fa-qrcode text-5xl text-muted-foreground/30" />
              </div>
            )}

            <button
              onClick={handleStartSession}
              disabled={starting}
              className="mt-6 w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-all shadow-lg shadow-primary/25 disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
            >
              {starting ? (
                <i className="fa-solid fa-circle-notch fa-spin" />
              ) : (
                <>
                  <i className="fa-solid fa-qrcode" />{" "}
                  {session ? "รีเฟรชเซสชัน" : "สร้างเซสชันเช็คชื่อวันนี้"}
                </>
              )}
            </button>
          </div>

          <div className="lg:col-span-3 glass-panel rounded-3xl p-8 animate-fade-in-up">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-foreground">รายชื่อผู้เช็คชื่อวันนี้</h3>
              <span className="text-sm font-semibold text-primary">{todayRate}% ของห้อง</span>
            </div>
            <div className="w-full h-2 rounded-full bg-muted mb-6 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-emerald-500 transition-all duration-700 rounded-full"
                style={{ width: `${todayRate}%` }}
              />
            </div>

            {!session ? (
              <p className="text-muted-foreground text-sm text-center py-10">
                เปิดเซสชันเช็คชื่อเพื่อเริ่มดูข้อมูลแบบเรียลไทม์
              </p>
            ) : attendance.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-10">
                ยังไม่มีนักเรียนเช็คชื่อในเซสชันนี้
              </p>
            ) : (
              <ul className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {attendance
                  .slice()
                  .sort((a, b) => b.checkedInAt.localeCompare(a.checkedInAt))
                  .map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center justify-between px-4 py-3 rounded-xl bg-background/50 border border-border/60"
                    >
                      <span className="flex items-center gap-3 font-medium text-foreground">
                        <i className="fa-solid fa-circle-check text-emerald-500" /> {a.studentName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(a.checkedInAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </div>

        {/* Student Roster & Manual Check-In Sheet */}
        <div className="mt-8 glass-panel rounded-3xl p-6 sm:p-8 animate-fade-in-up">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-6 border-b border-border/60">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-lg">
                  <i className="fa-solid fa-clipboard-user" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">
                    รายชื่อนักเรียน & เช็คชื่อรายบุคคล ({students.length} คน)
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    ครูสามารถกดติ๊กสถานะได้ทันที หรือเปิดโหมดให้นักเรียนกดเองเมื่อไม่มีโทรศัพท์
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleMarkAllPresent}
                disabled={markingAll || students.length === 0}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-md shadow-emerald-600/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                title="บันทึกว่าทุกคนมาเรียน"
              >
                {markingAll ? (
                  <>
                    <i className="fa-solid fa-circle-notch fa-spin text-xs" /> กำลังบันทึก...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-check-double text-xs" /> เช็คมาเรียนทุกคน
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setKioskSearch("");
                  setShowKioskModal(true);
                }}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition shadow-md shadow-primary/20 flex items-center gap-1.5 cursor-pointer"
              >
                <i className="fa-solid fa-tablet-screen-button text-xs" />
                โหมดให้นักเรียนกดเอง (Kiosk)
              </button>
            </div>
          </div>

          {/* Quick status summary tabs */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mb-6">
            <div className="p-3 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 text-center">
              <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">มาเรียน</div>
              <div className="text-xl font-black text-emerald-800 dark:text-emerald-300 mt-0.5">{statsBreakdown.present}</div>
            </div>
            <div className="p-3 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 text-center">
              <div className="text-xs font-semibold text-amber-700 dark:text-amber-400">มาสาย</div>
              <div className="text-xl font-black text-amber-800 dark:text-amber-300 mt-0.5">{statsBreakdown.late}</div>
            </div>
            <div className="p-3 rounded-2xl bg-sky-50/60 dark:bg-sky-950/20 border border-sky-200/60 dark:border-sky-900/40 text-center">
              <div className="text-xs font-semibold text-sky-700 dark:text-sky-400">ลา</div>
              <div className="text-xl font-black text-sky-800 dark:text-sky-300 mt-0.5">{statsBreakdown.excused}</div>
            </div>
            <div className="p-3 rounded-2xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40 text-center">
              <div className="text-xs font-semibold text-rose-700 dark:text-rose-400">ขาดเรียน</div>
              <div className="text-xl font-black text-rose-800 dark:text-rose-300 mt-0.5">{statsBreakdown.absent}</div>
            </div>
            <div className="col-span-2 sm:col-span-1 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 text-center">
              <div className="text-xs font-semibold text-slate-600 dark:text-slate-400">ยังไม่เช็ค</div>
              <div className="text-xl font-black text-slate-800 dark:text-slate-200 mt-0.5">{statsBreakdown.pending}</div>
            </div>
          </div>

          {/* Search bar */}
          <div className="mb-4 relative">
            <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหารหัส หรือชื่อ-นามสกุลนักเรียน..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {students.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <i className="fa-solid fa-users text-4xl opacity-30 mb-2" />
              <p className="text-sm">ยังไม่มีรายชื่อนักเรียนในห้องนี้</p>
              <p className="text-xs mt-1">สามารถกดปุ่ม "+ เพิ่มนักเรียนเข้าห้อง" หรือนำเข้าไฟล์รายชื่อที่เมนูผู้ดูแล</p>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              ไม่พบนักเรียนที่ตรงกับคำค้นหา "{searchQuery}"
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-border/70">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/60 text-xs font-semibold text-muted-foreground border-b border-border/70">
                  <tr>
                    <th className="py-3 px-4 w-12 text-center">#</th>
                    <th className="py-3 px-4">รหัสนักเรียน</th>
                    <th className="py-3 px-4">ชื่อ - นามสกุล</th>
                    <th className="py-3 px-4 text-center">สถานะ</th>
                    <th className="py-3 px-4 text-center">เวลา</th>
                    <th className="py-3 px-4 text-center">เช็คชื่อโดยครู (กดเพื่อเปลี่ยนสถานะ)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {filteredStudents.map((s, idx) => {
                    const att = attendanceMap.get(s.studentId || s.id);
                    const currentStatus = att?.status || "none";
                    const isMarking = markingStudentId === (s.studentId || s.id);

                    return (
                      <tr key={s.id || s.studentId || idx} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4 text-center text-xs text-muted-foreground font-mono">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs font-semibold text-foreground">
                          {s.studentId || "-"}
                        </td>
                        <td className="py-3 px-4 font-medium text-foreground">
                          {s.fullName}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {currentStatus === "present" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                              <i className="fa-solid fa-circle-check text-[10px]" /> มาเรียน
                            </span>
                          ) : currentStatus === "late" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                              <i className="fa-solid fa-clock text-[10px]" /> มาสาย
                            </span>
                          ) : currentStatus === "excused" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300">
                              <i className="fa-solid fa-notes-medical text-[10px]" /> ลา
                            </span>
                          ) : currentStatus === "absent" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                              <i className="fa-solid fa-circle-xmark text-[10px]" /> ขาดเรียน
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                              <i className="fa-regular fa-circle text-[10px]" /> ยังไม่เช็ค
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center text-xs text-muted-foreground font-mono">
                          {att?.checkedInAt
                            ? new Date(att.checkedInAt).toLocaleTimeString("th-TH", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "-"}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={isMarking}
                              onClick={() => handleSetStatus(s, "present")}
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer disabled:opacity-50 ${
                                currentStatus === "present"
                                  ? "bg-emerald-600 text-white shadow-sm"
                                  : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300"
                              }`}
                              title="มาเรียน"
                            >
                              มา
                            </button>
                            <button
                              type="button"
                              disabled={isMarking}
                              onClick={() => handleSetStatus(s, "late")}
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer disabled:opacity-50 ${
                                currentStatus === "late"
                                  ? "bg-amber-600 text-white shadow-sm"
                                  : "bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300"
                              }`}
                              title="มาสาย"
                            >
                              สาย
                            </button>
                            <button
                              type="button"
                              disabled={isMarking}
                              onClick={() => handleSetStatus(s, "excused")}
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer disabled:opacity-50 ${
                                currentStatus === "excused"
                                  ? "bg-sky-600 text-white shadow-sm"
                                  : "bg-sky-50 text-sky-700 hover:bg-sky-100 dark:bg-sky-950/40 dark:text-sky-300"
                              }`}
                              title="ลา"
                            >
                              ลา
                            </button>
                            <button
                              type="button"
                              disabled={isMarking}
                              onClick={() => handleSetStatus(s, "absent")}
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer disabled:opacity-50 ${
                                currentStatus === "absent"
                                  ? "bg-rose-600 text-white shadow-sm"
                                  : "bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300"
                              }`}
                              title="ขาดเรียน"
                            >
                              ขาด
                            </button>
                            {isMarking && (
                              <i className="fa-solid fa-circle-notch fa-spin text-xs text-primary ml-1" />
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-6">
          <RiskTable cls={cls} />
        </div>
        </>
        )}
      </main>

      <CreateStudentDialog
        open={showAddStudent}
        onClose={() => setShowAddStudent(false)}
        classId={cls.id}
        defaultClassName={cls.gradeLevel}
        onSuccess={async () => {
          const found = await getClassById(classId);
          setCls(found);
        }}
      />

      {/* Delete Class Confirmation Modal */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
          onClick={() => !deleting && setShowDeleteConfirm(false)}
        >
          <div
            className="rounded-3xl p-6 sm:p-8 w-full max-w-sm bg-card text-card-foreground border border-border shadow-2xl relative z-10 text-center space-y-4 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-950/50 mx-auto flex items-center justify-center text-2xl shadow-inner">
              <i className="fa-solid fa-trash-can" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">ต้องการลบห้องเรียนนี้?</h3>
              <p className="text-sm font-semibold text-primary mt-1">{cls.name}</p>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                ระดับชั้น: {cls.gradeLevel || "-"} &middot; นักเรียน {cls.studentIds?.length || 0} คน<br />
                การลบห้องเรียนจะไม่ลบรายชื่อนักเรียนออกจากโรงเรียน แต่จะยกเลิกห้องเรียนนี้และสถิติต่างๆ ทันที
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setShowDeleteConfirm(false)}
                className="py-2.5 px-4 rounded-xl border border-border text-foreground hover:bg-muted text-xs font-semibold transition cursor-pointer disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDeleteClass}
                className="py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-md shadow-rose-600/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {deleting ? (
                  <>
                    <i className="fa-solid fa-circle-notch fa-spin text-xs" /> กำลังลบ...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-trash-can text-xs" /> ยืนยันลบ
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Kiosk Mode Modal for Students without phones */}
      {showKioskModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
          onClick={() => setShowKioskModal(false)}
        >
          <div
            className="rounded-3xl p-6 sm:p-8 w-full max-w-3xl bg-card text-card-foreground border border-border shadow-2xl relative z-10 space-y-5 animate-scale-in max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-2xl font-bold">
                  <i className="fa-solid fa-tablet-screen-button" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-foreground">
                    เช็คชื่อด้วยตนเอง (Kiosk Self Check-in)
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    สำหรับนักเรียนที่ไม่มีโทรศัพท์: ค้นหาชื่อหรือรหัสของคุณ แล้วกดปุ่ม "กดเช็คชื่อ" ได้เลย
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowKioskModal(false)}
                className="w-10 h-10 rounded-xl bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground flex items-center justify-center transition cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-lg" />
              </button>
            </div>

            <div className="relative">
              <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm" />
              <input
                type="text"
                autoFocus
                value={kioskSearch}
                onChange={(e) => setKioskSearch(e.target.value)}
                placeholder="พิมพ์ชื่อ นามสกุล หรือรหัสนักเรียน เพื่อค้นหา..."
                className="w-full pl-11 pr-4 py-3.5 rounded-2xl border-2 border-primary/30 focus:border-primary bg-background text-base text-foreground placeholder:text-muted-foreground focus:outline-none shadow-sm"
              />
            </div>

            <div className="overflow-y-auto flex-1 pr-1 space-y-2.5 max-h-[50vh]">
              {kioskFilteredStudents.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  ไม่พบนักเรียนตามคำค้นหา "{kioskSearch}"
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {kioskFilteredStudents.map((s) => {
                    const att = attendanceMap.get(s.studentId || s.id);
                    const isChecked = att && att.status === "present";
                    const isMarking = markingStudentId === (s.studentId || s.id);

                    return (
                      <div
                        key={s.id || s.studentId}
                        className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                          isChecked
                            ? "bg-emerald-500/10 border-emerald-500/30"
                            : "bg-background/80 border-border hover:border-primary/50"
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-muted text-foreground">
                              {s.studentId || "-"}
                            </span>
                            <span className="text-sm font-bold text-foreground truncate">
                              {s.fullName}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {isChecked ? (
                              <span className="text-emerald-600 font-semibold flex items-center gap-1">
                                <i className="fa-solid fa-circle-check" /> เช็คชื่อแล้ว (
                                {new Date(att.checkedInAt).toLocaleTimeString("th-TH", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                                )
                              </span>
                            ) : att ? (
                              <span className="text-amber-600 font-medium">
                                สถานะ: {att.status}
                              </span>
                            ) : (
                              <span>ยังไม่เช็คชื่อ</span>
                            )}
                          </div>
                        </div>

                        {isChecked ? (
                          <div className="shrink-0 w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center text-lg shadow-md shadow-emerald-500/25">
                            <i className="fa-solid fa-check" />
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={isMarking}
                            onClick={() => handleSetStatus(s, "present")}
                            className="shrink-0 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition shadow-md shadow-primary/25 cursor-pointer disabled:opacity-60 flex items-center gap-1.5"
                          >
                            {isMarking ? (
                              <>
                                <i className="fa-solid fa-circle-notch fa-spin text-xs" /> บันทึก...
                              </>
                            ) : (
                              <>
                                <i className="fa-solid fa-check text-xs" /> กดเช็คชื่อ
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-border flex justify-end">
              <button
                type="button"
                onClick={() => setShowKioskModal(false)}
                className="px-6 py-2.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-semibold text-xs transition cursor-pointer"
              >
                เสร็จสิ้น / ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: string;
  label: string;
  value: string;
  accent: string;
  delay?: number;
}) {
  return (
    <div className="glass-panel rounded-2xl p-6 flex items-center gap-4 animate-fade-in-up">
      <div className={`w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-xl ${accent}`}>
        <i className={`fa-solid ${icon}`} />
      </div>
      <div>
        <p className="text-2xl font-extrabold text-foreground leading-tight">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
