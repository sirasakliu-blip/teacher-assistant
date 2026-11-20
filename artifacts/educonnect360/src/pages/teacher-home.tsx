import { useEffect, useState, type FormEvent } from "react";
import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { createClass, getClassesForTeacher } from "@/lib/firestore";
import { CLASS_COVERS, coverGradient } from "@/lib/covers";
import { TeacherNav } from "@/components/teacher-nav";
import type { Class, ClassCover } from "@/types";

export default function TeacherHome() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

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
        <div className="flex items-center justify-between mb-8 animate-fade-in-up">
          <div>
            <h1 className="text-3xl font-extrabold text-foreground">ห้องเรียนของฉัน</h1>
            <p className="text-muted-foreground mt-1">
              จัดการห้องเรียนและเช็คชื่อนักเรียนแบบเรียลไทม์
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="px-5 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all duration-300 shadow-lg shadow-primary/25 hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-2"
          >
            <i className="fa-solid fa-plus" /> สร้างห้องเรียน
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
            <i className="fa-solid fa-circle-notch fa-spin text-primary" /> กำลังโหลด...
          </div>
        ) : classes.length === 0 ? (
          <div className="glass-panel rounded-3xl p-16 text-center animate-fade-in-up">
            <i className="fa-solid fa-chalkboard text-4xl text-primary/50 mb-4" />
            <h3 className="text-xl font-bold text-foreground mb-2">ยังไม่มีห้องเรียน</h3>
            <p className="text-muted-foreground mb-6">
              เริ่มต้นด้วยการสร้างห้องเรียนแรกของคุณ
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all"
            >
              สร้างห้องเรียน
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {classes.map((cls, idx) => (
              <Link
                key={cls.id}
                href={`/teacher/classes/${cls.id}`}
                className="glass-panel rounded-3xl overflow-hidden group hover:-translate-y-1.5 transition-all duration-500 hover:shadow-2xl hover:shadow-primary/10 animate-fade-in-up"
                style={{ animationDelay: `${idx * 80}ms`, animationFillMode: "both" } as React.CSSProperties}
              >
                <div className={`h-24 w-full bg-gradient-to-br ${coverGradient(cls.cover)} relative`}>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <i className="fa-solid fa-book text-3xl text-white/90" />
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="text-lg font-bold text-foreground mb-1">{cls.name}</h3>
                  <p className="text-sm text-muted-foreground mb-4">{cls.gradeLevel}</p>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <i className="fa-solid fa-users text-primary/70" /> {cls.studentIds.length} คน
                    </span>
                    <span className="font-mono font-bold text-primary tracking-widest">
                      {cls.joinCode}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      {showCreate && (
        <CreateClassModal
          teacherId={profile?.id ?? ""}
          teacherName={profile?.displayName ?? ""}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function CreateClassModal({
  teacherId,
  teacherName,
  onClose,
  onCreated,
}: {
  teacherId: string;
  teacherName: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [cover, setCover] = useState<ClassCover>("emerald");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createClass({ name, gradeLevel, cover, teacherId, teacherName });
      toast({ title: "สร้างห้องเรียนสำเร็จ" });
      onCreated();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "สร้างห้องเรียนไม่สำเร็จ",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm animate-fade-in-up">
      <div className="glass-panel rounded-3xl p-8 w-full max-w-lg bg-card/95">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-foreground">สร้างห้องเรียนใหม่</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">
              ชื่อวิชา
            </label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="เช่น คณิตศาสตร์พื้นฐาน"
              className="w-full px-4 py-3 rounded-xl bg-background/60 border border-border focus:outline-none focus:ring-2 focus:ring-ring text-foreground"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">
              ระดับชั้น
            </label>
            <input
              required
              value={gradeLevel}
              onChange={(e) => setGradeLevel(e.target.value)}
              placeholder="เช่น มัธยมศึกษาปีที่ 3"
              className="w-full px-4 py-3 rounded-xl bg-background/60 border border-border focus:outline-none focus:ring-2 focus:ring-ring text-foreground"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">
              รูปปก
            </label>
            <div className="grid grid-cols-6 gap-2">
              {CLASS_COVERS.map((c) => (
                <button
                  type="button"
                  key={c.value}
                  onClick={() => setCover(c.value)}
                  className={`h-12 rounded-xl bg-gradient-to-br ${c.gradient} transition-all ${
                    cover === c.value ? "ring-2 ring-offset-2 ring-primary ring-offset-card scale-105" : "opacity-80 hover:opacity-100"
                  }`}
                  title={c.label}
                />
              ))}
            </div>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-all shadow-lg shadow-primary/25 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {submitting ? <i className="fa-solid fa-circle-notch fa-spin" /> : "สร้างห้องเรียน"}
          </button>
        </form>
      </div>
    </div>
  );
}
