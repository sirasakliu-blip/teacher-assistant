import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { getClassesForTeacher, deleteClass } from "@/lib/firestore";
import { coverGradient } from "@/lib/covers";
import { TeacherNav } from "@/components/teacher-nav";
import { CreateStudentDialog } from "@/components/create-student-dialog";
import { CreateClassModal } from "@/components/create-class-modal";
import { TeacherProfileModal } from "@/components/teacher-profile-modal";
import { StudentSchedulePanel } from "@/components/student-schedule-panel";
import { CreateAnnouncementModal } from "@/components/create-announcement-modal";
import type { Class } from "@/types";

export default function TeacherHome() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showCreateClass, setShowCreateClass] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [scheduleViewTab, setScheduleViewTab] = useState<"teaching" | "advisor">("teaching");
  const [classToDelete, setClassToDelete] = useState<Class | null>(null);
  const [deletingClass, setDeletingClass] = useState(false);

  const advisorRoom = profile?.advisorRoom || profile?.gradeLevel || "ม.2/1";

  async function handleConfirmDeleteClass() {
    if (!classToDelete) return;
    setDeletingClass(true);
    try {
      await deleteClass(classToDelete.id);
      toast({
        title: "ลบห้องเรียนสำเร็จ",
        description: `ลบห้องเรียน "${classToDelete.name}" ออกจากระบบเรียบร้อยแล้ว`,
      });
      setClassToDelete(null);
      await refresh();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "ลบห้องเรียนไม่สำเร็จ",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setDeletingClass(false);
    }
  }

  async function refresh() {
    if (!profile) return;
    setLoading(true);
    try {
      const list = await getClassesForTeacher(profile.id);
      setClasses(list.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
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
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  return (
    <div className="min-h-[100dvh] w-full bg-background relative overflow-hidden font-sans">
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[55%] h-[55%] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />

      <TeacherNav />

      <main className="relative z-10 max-w-6xl mx-auto px-6 md:px-10 py-10">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8 animate-fade-in-up">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-3xl font-extrabold text-foreground">ห้องเรียนของฉัน</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                จัดสรรตามชั้นเรียน
              </span>
              {advisorRoom && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-50 text-teal-800 border border-teal-200 flex items-center gap-1 shadow-2xs">
                  <i className="fa-solid fa-chalkboard-user text-teal-600" />
                  ที่ปรึกษา {advisorRoom}
                </span>
              )}
            </div>
            <p className="text-muted-foreground text-sm">
              ห้องเรียนและรายชื่อนักเรียน &middot; จัดการเช็คชื่อ การบ้าน และใบลา
            </p>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => setShowAnnouncementModal(true)}
              className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs transition flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <i className="fa-solid fa-bullhorn" /> พิมพ์ประกาศถึงผู้ปกครอง
            </button>
            <button
              onClick={() => setShowCreateClass(true)}
              className="px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs transition flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <i className="fa-solid fa-plus" /> สร้างห้องเรียนใหม่
            </button>
            <button
              onClick={() => setShowAddStudent(true)}
              className="px-4 py-2.5 rounded-xl border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary font-semibold text-xs transition flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <i className="fa-solid fa-user-plus" /> เพิ่มบัญชีนักเรียน
            </button>
            <button
              onClick={refresh}
              className="px-3.5 py-2.5 rounded-xl border border-border bg-card hover:bg-muted text-foreground font-semibold text-xs transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="รีเฟรชข้อมูลห้องเรียน"
            >
              <i className="fa-solid fa-arrows-rotate text-primary" /> รีเฟรช
            </button>
          </div>
        </div>

        {/* Teacher Teaching Schedule & Advisor Student Schedule Section */}
        <div className="mb-10 animate-fade-in-up space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Tab switch between Teacher Teaching Timetable and Advisor Student Timetable */}
            <div className="flex items-center gap-2 p-1.5 bg-muted rounded-2xl border border-border w-fit">
              <button
                onClick={() => setScheduleViewTab("teaching")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                  scheduleViewTab === "teaching"
                    ? "bg-card text-foreground shadow-xs border border-border"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <i className="fa-solid fa-chalkboard-user text-amber-500" />
                <span>ตารางสอนของฉัน (ตารางสอนครู)</span>
              </button>

              <button
                onClick={() => setScheduleViewTab("advisor")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                  scheduleViewTab === "advisor"
                    ? "bg-card text-foreground shadow-xs border border-border"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <i className="fa-solid fa-graduation-cap text-teal-600" />
                <span>ตารางเรียนห้องที่ปรึกษา ({advisorRoom})</span>
              </button>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
              <button
                onClick={() => setShowAnnouncementModal(true)}
                className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-xs font-semibold text-rose-800 transition flex items-center gap-1.5 cursor-pointer"
              >
                <i className="fa-solid fa-bullhorn text-rose-600" />
                <span>พิมพ์ประกาศห้อง {advisorRoom}</span>
              </button>

              <button
                onClick={() => setShowContactModal(true)}
                className="px-3.5 py-2 rounded-xl border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground transition flex items-center gap-1.5 cursor-pointer"
              >
                <i className="fa-solid fa-pen-to-square text-teal-600" />
                <span>แก้ไขห้องที่ปรึกษา</span>
              </button>
            </div>
          </div>

          {scheduleViewTab === "teaching" ? (
            <StudentSchedulePanel
              teacherId={profile?.id || profile?.uid}
              teacherName={profile?.displayName || profile?.fullName}
              studentClasses={classes}
              isTeacherTeachingSchedule={true}
            />
          ) : (
            <StudentSchedulePanel
              gradeLevel={advisorRoom}
              studentClasses={classes}
            />
          )}
        </div>

        {/* Classes Section Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-sm">
              <i className="fa-solid fa-chalkboard text-xs" />
            </span>
            <h2 className="text-lg font-bold text-foreground">รายชื่อห้องเรียนที่รับผิดชอบ</h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground font-semibold">
              {classes.length} ห้อง
            </span>
          </div>

          <button
            onClick={() => setShowCreateClass(true)}
            className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
          >
            <i className="fa-solid fa-plus text-[10px]" /> เพิ่มห้องเรียน
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
            <i className="fa-solid fa-circle-notch fa-spin text-primary" /> กำลังโหลด...
          </div>
        ) : classes.length === 0 ? (
          <div className="glass-panel rounded-3xl p-12 sm:p-16 text-center animate-fade-in-up border border-border/80">
            <div className="w-20 h-20 rounded-3xl bg-primary/10 text-primary flex items-center justify-center text-4xl mx-auto mb-4 shadow-inner">
              <i className="fa-solid fa-chalkboard" />
            </div>
            <h3 className="text-2xl font-bold text-foreground mb-2">ยังไม่มีห้องเรียนในระบบ</h3>
            <p className="text-muted-foreground text-sm max-w-md mx-auto mb-6 leading-relaxed">
              คุณครูสามารถกดปุ่มสร้างห้องเรียนใหม่ได้ทันที หรือสร้างห้องเรียนประจำชั้นที่ปรึกษา ({advisorRoom}) อัตโนมัติด้วย 1 คลิก
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <button
                onClick={() => setShowCreateClass(true)}
                className="px-6 py-3.5 rounded-2xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-all cursor-pointer inline-flex items-center gap-2.5 shadow-lg shadow-primary/25 hover:-translate-y-0.5 active:translate-y-0"
              >
                <i className="fa-solid fa-plus text-base" />
                <span>สร้างห้องเรียนใหม่</span>
              </button>

              {advisorRoom && (
                <button
                  onClick={async () => {
                    const teacherId = profile?.id || profile?.uid;
                    const teacherName = profile?.displayName || profile?.fullName || "คุณครู";
                    if (!teacherId) return;
                    setLoading(true);
                    try {
                      await createClass({
                        name: `ห้องเรียนประจำชั้น ${advisorRoom}`,
                        gradeLevel: advisorRoom,
                        cover: "emerald",
                        teacherId,
                        teacherName,
                      });
                      toast({
                        title: "สร้างห้องเรียนสำเร็จ",
                        description: `สร้างห้องเรียนประจำชั้น ${advisorRoom} เรียบร้อยแล้ว`,
                      });
                      await refresh();
                    } catch (err) {
                      toast({
                        variant: "destructive",
                        title: "สร้างห้องเรียนไม่สำเร็จ",
                        description: err instanceof Error ? err.message : undefined,
                      });
                    } finally {
                      setLoading(false);
                    }
                  }}
                  className="px-6 py-3.5 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm transition-all cursor-pointer inline-flex items-center gap-2.5 shadow-lg shadow-teal-600/25 hover:-translate-y-0.5 active:translate-y-0"
                >
                  <i className="fa-solid fa-wand-magic-sparkles text-base" />
                  <span>สร้างห้องเรียน {advisorRoom} ทันที (1-Click)</span>
                </button>
              )}

              <button
                onClick={refresh}
                className="px-4 py-3.5 rounded-2xl border border-border bg-card text-foreground font-semibold text-sm hover:bg-muted transition-all cursor-pointer inline-flex items-center gap-2"
              >
                <i className="fa-solid fa-arrows-rotate text-primary" />
                <span>ตรวจสอบห้องเรียนอีกครั้ง</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {classes.map((cls, idx) => (
              <Link
                key={cls.id}
                href={`/teacher/classes/${cls.id}`}
                className="glass-panel rounded-3xl overflow-hidden group hover:-translate-y-1.5 transition-all duration-500 hover:shadow-2xl hover:shadow-primary/10 animate-fade-in-up block"
                style={{ animationDelay: `${idx * 80}ms`, animationFillMode: "both" } as React.CSSProperties}
              >
                <div className={`h-24 w-full bg-gradient-to-br ${coverGradient(cls.cover)} relative`}>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <i className="fa-solid fa-graduation-cap text-3xl text-white/30 group-hover:scale-110 transition-transform duration-500" />
                  </div>
                  {/* Delete class button on top-left of card */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setClassToDelete(cls);
                    }}
                    title="ลบห้องเรียนนี้"
                    className="absolute top-3 left-3 w-8 h-8 rounded-full bg-black/40 hover:bg-rose-600 text-white flex items-center justify-center transition backdrop-blur-md cursor-pointer opacity-80 hover:opacity-100 shadow-sm"
                  >
                    <i className="fa-solid fa-trash-can text-xs" />
                  </button>
                  <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-black/20 backdrop-blur-md text-white text-[11px] font-mono font-medium">
                    {cls.code}
                  </div>
                </div>

                <div className="p-6">
                  <div className="text-xs font-semibold text-primary mb-1">
                    {cls.gradeLevel || "ห้องเรียนรวม"}
                  </div>
                  <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors mb-2 truncate">
                    {cls.name}
                  </h3>
                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-4 border-t border-border/50">
                    <span className="flex items-center gap-1.5">
                      <i className="fa-solid fa-users" />
                      {cls.studentIds?.length || 0} คน
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setClassToDelete(cls);
                        }}
                        className="p-1 rounded-md text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                        title="ลบห้องเรียนนี้"
                      >
                        <i className="fa-solid fa-trash-can text-xs" />
                      </button>
                      <span className="font-semibold text-primary flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                        จัดการห้องเรียน <i className="fa-solid fa-arrow-right text-[10px]" />
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      {/* Delete Class Confirmation Modal */}
      {classToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
          onClick={() => !deletingClass && setClassToDelete(null)}
        >
          <div
            className="rounded-3xl p-6 sm:p-8 w-full max-w-sm bg-card text-card-foreground border border-border shadow-2xl relative z-10 text-center space-y-4 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-950/50 mx-auto flex items-center justify-center text-2xl shadow-inner">
              <i className="fa-solid fa-trash-can" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">ต้องการลบห้องเรียน?</h3>
              <p className="text-sm font-semibold text-primary mt-1">{classToDelete.name}</p>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                ระดับชั้น: {classToDelete.gradeLevel || "-"} &middot; นักเรียน {classToDelete.studentIds?.length || 0} คน<br />
                การลบห้องเรียนจะไม่ลบรายชื่อนักเรียนออกจากโรงเรียน แต่จะยกเลิกห้องเรียนนี้ทันที
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
              <button
                type="button"
                disabled={deletingClass}
                onClick={() => setClassToDelete(null)}
                className="py-2.5 px-4 rounded-xl border border-border text-foreground hover:bg-muted text-xs font-semibold transition cursor-pointer disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={deletingClass}
                onClick={handleConfirmDeleteClass}
                className="py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-md shadow-rose-600/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {deletingClass ? (
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

      <CreateClassModal
        open={showCreateClass}
        onClose={() => setShowCreateClass(false)}
        onSuccess={refresh}
        defaultGrade={advisorRoom}
      />

      <CreateStudentDialog
        open={showAddStudent}
        onClose={() => setShowAddStudent(false)}
        onSuccess={refresh}
      />

      <TeacherProfileModal
        open={showContactModal}
        onClose={() => setShowContactModal(false)}
        onSuccess={refresh}
      />

      <CreateAnnouncementModal
        open={showAnnouncementModal}
        onClose={() => setShowAnnouncementModal(false)}
        onSuccess={refresh}
        defaultRoom={advisorRoom}
        classes={classes}
      />
    </div>
  );
}
