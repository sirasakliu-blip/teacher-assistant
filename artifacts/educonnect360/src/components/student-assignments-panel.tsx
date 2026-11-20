import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  deriveSubmissionStatus,
  getAssignmentsForClass,
  getSubmissionForStudent,
  submitAssignment,
} from "@/lib/firestore";
import type { Assignment, Submission } from "@/types";

const STATUS_META: Record<string, { label: string; className: string; icon: string }> = {
  submitted: { label: "ส่งแล้ว", className: "bg-emerald-500/10 text-emerald-600", icon: "fa-circle-check" },
  late: { label: "ส่งช้า", className: "bg-amber-500/10 text-amber-600", icon: "fa-triangle-exclamation" },
  missing: { label: "ยังไม่ส่ง", className: "bg-red-500/10 text-red-600", icon: "fa-circle-xmark" },
  pending: { label: "รอส่ง", className: "bg-muted text-muted-foreground", icon: "fa-hourglass-half" },
};

function formatDueDate(dueDate: string): string {
  return new Date(dueDate + "T00:00:00").toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function StudentAssignmentsPanel({
  classId,
  studentId,
  studentName,
}: {
  classId: string;
  studentId: string;
  studentName: string;
}) {
  const { toast } = useToast();
  const [assignments, setAssignments] = useState<Assignment[] | null>(null);
  const [submissions, setSubmissions] = useState<Record<string, Submission | null>>({});
  const [activeAssignment, setActiveAssignment] = useState<Assignment | null>(null);

  async function refresh() {
    try {
      const list = await getAssignmentsForClass(classId);
      setAssignments(list);
      const entries = await Promise.all(
        list.map(async (a) => [a.id, await getSubmissionForStudent(a.id, studentId)] as const),
      );
      setSubmissions(Object.fromEntries(entries));
    } catch (err) {
      toast({
        variant: "destructive",
        title: "โหลดรายการการบ้านไม่สำเร็จ",
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, studentId]);

  if (assignments === null) {
    return (
      <div className="flex items-center justify-center py-10 text-muted-foreground gap-2">
        <i className="fa-solid fa-circle-notch fa-spin text-primary" /> กำลังโหลดการบ้าน...
      </div>
    );
  }

  if (assignments.length === 0) {
    return (
      <div className="glass-panel rounded-3xl p-10 text-center w-full">
        <i className="fa-solid fa-file-pen text-3xl text-primary/40 mb-3" />
        <p className="text-muted-foreground">ยังไม่มีการบ้านในห้องเรียนนี้</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-3">
      {assignments.map((a) => {
        const submission = submissions[a.id] ?? null;
        const status = deriveSubmissionStatus(a, submission ?? undefined);
        const meta = STATUS_META[status];
        return (
          <div key={a.id} className="glass-panel rounded-2xl p-5 text-left">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="min-w-0">
                <p className="font-bold text-foreground truncate">{a.title}</p>
                <p className="text-sm text-muted-foreground line-clamp-2">{a.description}</p>
              </div>
              <span className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${meta.className}`}>
                <i className={`fa-solid ${meta.icon}`} /> {meta.label}
              </span>
            </div>
            <div className="flex items-center justify-between mt-3">
              <p className="text-xs text-muted-foreground">
                กำหนดส่ง {formatDueDate(a.dueDate)} &middot; คะแนนเต็ม {a.maxScore}
                {submission?.score != null && (
                  <span className="text-primary font-bold"> &middot; ได้ {submission.score}/{a.maxScore}</span>
                )}
              </p>
              <button
                onClick={() => setActiveAssignment(a)}
                className="px-4 py-2 rounded-lg bg-primary/10 text-primary text-sm font-semibold hover:bg-primary/20 transition-all"
              >
                {submission ? "ดู/ส่งใหม่" : "ส่งงาน"}
              </button>
            </div>
          </div>
        );
      })}

      {activeAssignment && (
        <SubmitAssignmentModal
          assignment={activeAssignment}
          studentId={studentId}
          studentName={studentName}
          existing={submissions[activeAssignment.id] ?? null}
          onClose={() => setActiveAssignment(null)}
          onSubmitted={() => {
            setActiveAssignment(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function SubmitAssignmentModal({
  assignment,
  studentId,
  studentName,
  existing,
  onClose,
  onSubmitted,
}: {
  assignment: Assignment;
  studentId: string;
  studentName: string;
  existing: Submission | null;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const { toast } = useToast();
  const [content, setContent] = useState(existing?.content ?? "");
  const [fileName, setFileName] = useState(existing?.fileName ?? "");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!content.trim() && !fileName.trim()) {
      toast({ variant: "destructive", title: "กรุณาพิมพ์คำตอบหรือแนบไฟล์ก่อนส่งงาน" });
      return;
    }
    setSubmitting(true);
    try {
      await submitAssignment({
        assignmentId: assignment.id,
        classId: assignment.classId,
        studentId,
        studentName,
        dueDate: assignment.dueDate,
        content: content.trim() || null,
        fileName: fileName.trim() || null,
      });
      toast({ title: "ส่งงานสำเร็จ" });
      onSubmitted();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "ส่งงานไม่สำเร็จ",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSubmitting(false);
    }
  }

  function handleMockAttach() {
    setFileName(`${assignment.title.slice(0, 12).replace(/\s+/g, "_")}_งานของ${studentName}.pdf`);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm animate-fade-in-up">
      <div className="glass-panel rounded-3xl p-8 w-full max-w-lg bg-card/95 text-left">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-foreground">{assignment.title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground mb-5">{assignment.description}</p>

        <label className="block text-sm font-semibold text-foreground mb-2">พิมพ์คำตอบ</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={4}
          placeholder="พิมพ์คำตอบของคุณที่นี่..."
          className="w-full px-4 py-3 rounded-xl bg-background/60 border border-border focus:outline-none focus:ring-2 focus:ring-ring text-foreground resize-none mb-4"
        />

        <label className="block text-sm font-semibold text-foreground mb-2">หรือแนบไฟล์ (จำลอง)</label>
        <div className="flex items-center gap-3 mb-6">
          <button
            type="button"
            onClick={handleMockAttach}
            className="px-4 py-2.5 rounded-xl glass-panel text-sm font-semibold text-foreground hover:bg-white/60 dark:hover:bg-black/20 transition-all flex items-center gap-2"
          >
            <i className="fa-solid fa-paperclip" /> แนบไฟล์
          </button>
          {fileName && (
            <span className="text-sm text-muted-foreground truncate flex items-center gap-1.5">
              <i className="fa-solid fa-file" /> {fileName}
            </span>
          )}
        </div>

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-all shadow-lg shadow-primary/25 disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {submitting ? <i className="fa-solid fa-circle-notch fa-spin" /> : "ส่งงาน"}
        </button>
      </div>
    </div>
  );
}
