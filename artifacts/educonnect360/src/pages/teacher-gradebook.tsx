import { useEffect, useState } from "react";
import { Link, useParams } from "wouter";
import { useToast } from "@/hooks/use-toast";
import {
  getAssignmentById,
  getClassById,
  getSubmissionsForAssignment,
  getUsersByIds,
  gradeSubmission,
  deriveSubmissionStatus,
} from "@/lib/firestore";
import { TeacherNav } from "@/components/teacher-nav";
import type { Assignment, Class, Submission, User } from "@/types";

const STATUS_META: Record<string, { label: string; className: string; icon: string }> = {
  submitted: { label: "ส่งแล้ว", className: "bg-emerald-500/10 text-emerald-600", icon: "fa-circle-check" },
  late: { label: "ส่งช้า", className: "bg-amber-500/10 text-amber-600", icon: "fa-triangle-exclamation" },
  missing: { label: "ยังไม่ส่ง", className: "bg-red-500/10 text-red-600", icon: "fa-circle-xmark" },
  pending: { label: "รอกำหนดส่ง", className: "bg-muted text-muted-foreground", icon: "fa-hourglass-half" },
};

export default function TeacherGradebook() {
  const { classId, assignmentId } = useParams<{ classId: string; assignmentId: string }>();
  const { toast } = useToast();
  const [cls, setCls] = useState<Class | null>(null);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [students, setStudents] = useState<User[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [scoreDrafts, setScoreDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [foundClass, foundAssignment] = await Promise.all([
        getClassById(classId),
        getAssignmentById(assignmentId),
      ]);
      setCls(foundClass);
      setAssignment(foundAssignment);
      if (foundClass) {
        const [rosterUsers, subs] = await Promise.all([
          getUsersByIds(foundClass.studentIds),
          getSubmissionsForAssignment(assignmentId),
        ]);
        setStudents(rosterUsers);
        setSubmissions(subs);
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "โหลดสมุดคะแนนไม่สำเร็จ",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, assignmentId]);

  async function handleGrade(submission: Submission, maxScore: number) {
    const raw = scoreDrafts[submission.id];
    const score = Number(raw);
    if (raw === undefined || raw === "" || Number.isNaN(score) || score < 0 || score > maxScore) {
      toast({
        variant: "destructive",
        title: "คะแนนไม่ถูกต้อง",
        description: `กรุณากรอกคะแนนระหว่าง 0 - ${maxScore}`,
      });
      return;
    }
    setSavingId(submission.id);
    try {
      await gradeSubmission(submission.id, score);
      toast({ title: "บันทึกคะแนนสำเร็จ" });
      setEditingId(null);
      await load();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "บันทึกคะแนนไม่สำเร็จ",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSavingId(null);
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

  if (!cls || !assignment) {
    return (
      <div className="min-h-[100dvh] w-full bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">ไม่พบข้อมูลการบ้านนี้</p>
        <Link href="/teacher" className="text-primary font-semibold hover:underline">
          กลับหน้าห้องเรียน
        </Link>
      </div>
    );
  }

  const submissionByStudent = new Map(submissions.map((s) => [s.studentId, s]));
  const submittedCount = submissions.length;

  return (
    <div className="min-h-[100dvh] w-full bg-background relative overflow-hidden font-sans">
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[55%] h-[55%] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />

      <TeacherNav />

      <main className="relative z-10 max-w-4xl mx-auto px-6 md:px-10 py-10">
        <Link
          href={`/teacher/classes/${cls.id}`}
          className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-primary transition-colors mb-6"
        >
          <i className="fa-solid fa-arrow-left" /> {cls.name}
        </Link>

        <div className="glass-panel rounded-3xl p-6 sm:p-8 mb-6">
          <h1 className="text-2xl font-extrabold text-foreground mb-1">{assignment.title}</h1>
          <p className="text-sm text-muted-foreground mb-4">{assignment.description}</p>
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <i className="fa-solid fa-calendar text-primary/70" /> กำหนดส่ง{" "}
              {new Date(assignment.dueDate + "T00:00:00").toLocaleDateString("th-TH", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <i className="fa-solid fa-star text-primary/70" /> คะแนนเต็ม {assignment.maxScore}
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <i className="fa-solid fa-users text-primary/70" /> ส่งแล้ว {submittedCount}/{students.length} คน
            </span>
          </div>
        </div>

        <div className="glass-panel rounded-3xl overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto] sm:grid-cols-[2fr_1fr_1fr_auto] gap-3 px-6 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wide border-b border-border/60">
            <span>นักเรียน</span>
            <span className="hidden sm:block">สถานะ</span>
            <span>งานที่ส่ง</span>
            <span>คะแนน</span>
          </div>
          <ul className="divide-y divide-border/60">
            {students.map((student) => {
              const submission = submissionByStudent.get(student.id);
              const status = deriveSubmissionStatus(assignment, submission);
              const meta = STATUS_META[status];
              return (
                <li
                  key={student.id}
                  className="grid grid-cols-[1fr_auto_auto] sm:grid-cols-[2fr_1fr_1fr_auto] gap-3 px-6 py-4 items-center"
                >
                  <span className="font-medium text-foreground truncate">{student.displayName}</span>
                  <span
                    className={`hidden sm:inline-flex w-fit items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${meta.className}`}
                  >
                    <i className={`fa-solid ${meta.icon}`} /> {meta.label}
                  </span>
                  <span className="text-sm text-muted-foreground truncate max-w-[10rem]">
                    {submission?.fileName ? (
                      <span className="inline-flex items-center gap-1.5">
                        <i className="fa-solid fa-paperclip" /> {submission.fileName}
                      </span>
                    ) : submission?.content ? (
                      <span className="italic">"{submission.content.slice(0, 24)}"</span>
                    ) : (
                      "—"
                    )}
                  </span>
                  {submission ? (
                    submission.score !== null && editingId !== submission.id ? (
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-primary text-sm">
                          {submission.score}/{assignment.maxScore}
                        </span>
                        <button
                          onClick={() => {
                            setScoreDrafts((prev) => ({ ...prev, [submission.id]: String(submission.score) }));
                            setEditingId(submission.id);
                          }}
                          className="text-xs text-muted-foreground hover:text-primary transition-colors p-1"
                          title="แก้ไขคะแนน"
                        >
                          <i className="fa-solid fa-pen-to-square" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min={0}
                          max={assignment.maxScore}
                          placeholder="0"
                          value={scoreDrafts[submission.id] ?? ""}
                          onChange={(e) =>
                            setScoreDrafts((prev) => ({ ...prev, [submission.id]: e.target.value }))
                          }
                          className="w-16 px-2 py-1.5 rounded-lg bg-background/60 border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                        <button
                          onClick={() => handleGrade(submission, assignment.maxScore)}
                          disabled={savingId === submission.id}
                          className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition-all disabled:opacity-60"
                        >
                          {savingId === submission.id ? (
                            <i className="fa-solid fa-circle-notch fa-spin" />
                          ) : (
                            "บันทึก"
                          )}
                        </button>
                        {editingId === submission.id && (
                          <button
                            onClick={() => setEditingId(null)}
                            className="px-2 py-1.5 rounded-lg text-muted-foreground hover:bg-muted text-xs transition-colors"
                          >
                            ยกเลิก
                          </button>
                        )}
                      </div>
                    )
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </main>
    </div>
  );
}
