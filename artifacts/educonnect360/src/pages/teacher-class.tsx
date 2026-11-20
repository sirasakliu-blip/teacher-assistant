import { useEffect, useState } from "react";
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
} from "@/lib/firestore";
import { coverGradient } from "@/lib/covers";
import { RiskTable } from "@/components/risk-table";
import { TeacherAssignmentsPanel } from "@/components/assignments-panel";
import { CreateStudentDialog } from "@/components/create-student-dialog";
import type { Attendance, Class, ClassSession } from "@/types";

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

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    async function load() {
      setLoading(true);
      try {
        const found = await getClassById(classId);
        setCls(found);
        if (found) {
          const [stats, todaySession] = await Promise.all([
            getClassAttendanceRate(found.id, found.studentIds.length),
            getTodaySessionForClass(found.id),
          ]);
          setRate(stats);
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

  const rosterSize = cls.studentIds.length;
  const checkedInToday = attendance.length;
  const todayRate = rosterSize > 0 ? Math.round((checkedInToday / rosterSize) * 100) : 0;
  const qrValue = session ? `EDUCONNECT360:${cls.id}:${session.id}` : "";

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
