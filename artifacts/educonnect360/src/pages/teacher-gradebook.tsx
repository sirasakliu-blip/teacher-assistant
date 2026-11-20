import { useEffect, useState, useRef } from "react";
import { Link, useParams } from "wouter";
import { useToast } from "@/hooks/use-toast";
import {
  getAssignmentById,
  getClassById,
  getSubmissionsForAssignment,
  getUsersByIds,
  deriveSubmissionStatus,
  recordOrUpdateStudentScore,
  bulkRecordScores,
} from "@/lib/firestore";
import { parseExcelOrCsv, exportToExcel } from "@/lib/excel-helper";
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [cls, setCls] = useState<Class | null>(null);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [students, setStudents] = useState<User[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [scoreDrafts, setScoreDrafts] = useState<Record<string, string>>({});
  const [savingStudentId, setSavingStudentId] = useState<string | null>(null);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [uploadingExcel, setUploadingExcel] = useState(false);

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

  async function handleSaveScore(studentId: string, maxScore: number) {
    const raw = scoreDrafts[studentId];
    const score = Number(raw);
    if (raw === undefined || raw === "" || Number.isNaN(score) || score < 0 || score > maxScore) {
      toast({
        variant: "destructive",
        title: "คะแนนไม่ถูกต้อง",
        description: `กรุณากรอกคะแนนระหว่าง 0 ถึง ${maxScore}`,
      });
      return;
    }

    setSavingStudentId(studentId);
    try {
      await recordOrUpdateStudentScore(assignmentId, studentId, score);
      toast({ title: "บันทึกคะแนนสำเร็จ" });
      setEditingStudentId(null);
      await load();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "บันทึกคะแนนไม่สำเร็จ",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSavingStudentId(null);
    }
  }

  // Export template with students for teachers to grade in Excel
  async function handleDownloadExcelTemplate() {
    if (!students || students.length === 0) {
      toast({
        variant: "destructive",
        title: "ไม่มีรายชื่อนักเรียน",
        description: "ยังไม่มีนักเรียนในห้องเรียนนี้",
      });
      return;
    }

    const submissionByStudent = new Map(submissions.map((s) => [s.studentId, s]));
    const data = students.map((s, idx) => {
      const sub = submissionByStudent.get(s.id);
      return {
        "ลำดับ": idx + 1,
        "รหัสนักเรียน": s.studentId || s.id,
        "ชื่อ-นามสกุล": s.displayName || s.fullName || "",
        "ระดับชั้น/ห้อง": s.gradeLevel || cls?.gradeLevel || "",
        [`คะแนน (เต็ม ${assignment?.maxScore || 100})`]: sub?.score !== null && sub?.score !== undefined ? sub.score : "",
      };
    });

    try {
      await exportToExcel(
        data,
        `คะแนน_${assignment?.title || "การบ้าน"}_${cls?.name || "ห้องเรียน"}`,
        "คะแนนเก็บ",
      );
      toast({
        title: "ดาวน์โหลดแม่แบบ Excel สำเร็จ",
        description: "คุณสามารถกรอกคะแนนแล้วอัปโหลดกลับเข้าสู่ระบบได้ทันที",
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "ดาวน์โหลดไม่สำเร็จ",
        description: err instanceof Error ? err.message : "กรุณาลองใหม่อีกครั้ง",
      });
    }
  }

  // Handle uploading Excel file with scores
  async function handleExcelUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingExcel(true);
    try {
      const rows = await parseExcelOrCsv(file);
      if (!rows || rows.length === 0) {
        throw new Error("ไม่พบข้อมูลในไฟล์ที่อัปโหลด");
      }

      // Map rows to student scores
      const idToStudent = new Map<string, User>();
      students.forEach((s) => {
        if (s.studentId) idToStudent.set(s.studentId.trim(), s);
        if (s.id) idToStudent.set(s.id.trim(), s);
        const name = (s.displayName || s.fullName || "").trim();
        if (name) idToStudent.set(name, s);
      });

      const gradesToSave: Array<{ studentId: string; score: number }> = [];

      for (const row of rows) {
        // Find student ID or Name column
        const rawId = (row["รหัสนักเรียน"] || row["studentId"] || row["ID"] || row["รหัส"] || "").toString().trim();
        const rawName = (row["ชื่อ-นามสกุล"] || row["ชื่อ"] || row["fullName"] || row["name"] || "").toString().trim();

        const student = (rawId && idToStudent.get(rawId)) || (rawName && idToStudent.get(rawName));
        if (!student) continue;

        // Find score column
        let rawScore = "";
        for (const key of Object.keys(row)) {
          if (key.includes("คะแนน") || key.toLowerCase().includes("score") || key.toLowerCase().includes("point")) {
            rawScore = row[key];
            break;
          }
        }

        if (rawScore !== "" && rawScore !== undefined && rawScore !== null) {
          const numScore = Number(rawScore);
          if (!Number.isNaN(numScore) && numScore >= 0 && numScore <= (assignment?.maxScore || 100)) {
            gradesToSave.push({
              studentId: student.id,
              score: numScore,
            });
          }
        }
      }

      if (gradesToSave.length === 0) {
        throw new Error("ไม่พบคะแนนที่ตรงกับรายชื่อนักเรียนในห้องนี้ กรุณาตรวจสอบหัวตาราง (รหัสนักเรียน / คะแนน)");
      }

      const result = await bulkRecordScores(assignmentId, gradesToSave);
      toast({
        title: "นำเข้าคะแนนสำเร็จ!",
        description: `อัปเดตคะแนนให้นักเรียนแล้ว ${result.successCount} คน`,
      });

      await load();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "อัปโหลดคะแนนไม่สำเร็จ",
        description: err instanceof Error ? err.message : "กรุณาตรวจสอบรูปแบบไฟล์ Excel",
      });
    } finally {
      setUploadingExcel(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
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
  const gradedCount = submissions.filter((s) => s.score !== null && s.score !== undefined).length;
  const submittedCount = submissions.length;

  return (
    <div className="min-h-[100dvh] w-full bg-background relative overflow-hidden font-sans pb-16">
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[55%] h-[55%] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />

      <TeacherNav />

      <main className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 md:px-10 py-8">
        <Link
          href={`/teacher/classes/${cls.id}`}
          className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-primary transition-colors mb-6"
        >
          <i className="fa-solid fa-arrow-left" /> {cls.name}
        </Link>

        {/* Assignment Header Card */}
        <div className="glass-panel rounded-3xl p-6 sm:p-8 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary">
                  {cls.name} ({cls.gradeLevel})
                </span>
                <span className="text-xs text-muted-foreground">
                  ตรวจแล้ว {gradedCount}/{students.length} คน
                </span>
              </div>
              <h1 className="text-2xl font-extrabold text-foreground">{assignment.title}</h1>
              {assignment.description && (
                <p className="text-sm text-muted-foreground mt-1">{assignment.description}</p>
              )}
            </div>

            {/* Excel Actions for Teachers */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                onClick={handleDownloadExcelTemplate}
                className="px-3.5 py-2 rounded-xl bg-card border border-border hover:bg-muted text-foreground text-xs font-semibold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                title="ดาวน์โหลดแม่แบบ Excel ที่มีรายชื่อนักเรียนในห้องนี้พร้อมกรอกคะแนน"
              >
                <i className="fa-solid fa-file-excel text-emerald-600" />
                <span>ดาวน์โหลด Excel</span>
              </button>

              <label className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-xs cursor-pointer">
                {uploadingExcel ? (
                  <i className="fa-solid fa-circle-notch fa-spin" />
                ) : (
                  <i className="fa-solid fa-file-import" />
                )}
                <span>{uploadingExcel ? "กำลังนำเข้า..." : "อัปโหลดคะแนน Excel"}</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  className="hidden"
                  onChange={handleExcelUpload}
                  disabled={uploadingExcel}
                />
              </label>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 text-xs sm:text-sm pt-4 border-t border-border/40">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <i className="fa-solid fa-calendar text-primary/70" /> กำหนดส่ง{" "}
              {new Date(assignment.dueDate + "T00:00:00").toLocaleDateString("th-TH", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <i className="fa-solid fa-star text-amber-500" /> คะแนนเต็ม {assignment.maxScore} คะแนน
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <i className="fa-solid fa-users text-primary/70" /> ส่งแล้วในระบบ {submittedCount}/{students.length} คน
            </span>
          </div>
        </div>

        {/* Gradebook Table */}
        <div className="glass-panel rounded-3xl overflow-hidden shadow-sm">
          <div className="grid grid-cols-[1.5fr_1fr_1.5fr] sm:grid-cols-[2fr_1fr_1fr_1.5fr] gap-3 px-6 py-3.5 text-xs font-bold text-muted-foreground uppercase tracking-wide border-b border-border/60 bg-muted/30">
            <span>นักเรียน</span>
            <span className="hidden sm:block">สถานะการส่ง</span>
            <span>หลักฐานงาน</span>
            <span className="text-right sm:text-left">บันทึกคะแนน</span>
          </div>

          <ul className="divide-y divide-border/60">
            {students.length === 0 ? (
              <li className="p-8 text-center text-muted-foreground text-sm">
                ยังไม่มีนักเรียนในห้องเรียนนี้
              </li>
            ) : (
              students.map((student) => {
                const submission = submissionByStudent.get(student.id);
                const status = deriveSubmissionStatus(assignment, submission);
                const meta = STATUS_META[status];
                const currentScore = submission?.score;
                const isEditing = editingStudentId === student.id;

                return (
                  <li
                    key={student.id}
                    className="grid grid-cols-[1.5fr_1fr_1.5fr] sm:grid-cols-[2fr_1fr_1fr_1.5fr] gap-3 px-6 py-4 items-center hover:bg-muted/20 transition-colors"
                  >
                    <div>
                      <span className="font-semibold text-foreground text-sm block truncate">
                        {student.displayName || student.fullName}
                      </span>
                      {student.studentId && (
                        <span className="text-[11px] text-muted-foreground font-mono">
                          รหัส: {student.studentId}
                        </span>
                      )}
                    </div>

                    <span
                      className={`hidden sm:inline-flex w-fit items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${meta.className}`}
                    >
                      <i className={`fa-solid ${meta.icon}`} /> {meta.label}
                    </span>

                    <span className="text-xs text-muted-foreground truncate max-w-[10rem]">
                      {submission?.fileName ? (
                        <span className="inline-flex items-center gap-1.5 text-primary hover:underline">
                          <i className="fa-solid fa-paperclip" /> {submission.fileName}
                        </span>
                      ) : submission?.content ? (
                        <span className="italic">"{submission.content.slice(0, 20)}"</span>
                      ) : (
                        <span className="text-muted-foreground/60">— ยังไม่มีไฟล์ —</span>
                      )}
                    </span>

                    {/* Direct Score Entry (works for all students with or without online submission) */}
                    <div className="flex items-center justify-end sm:justify-start gap-2">
                      {currentScore !== null && currentScore !== undefined && !isEditing ? (
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-primary text-sm px-2.5 py-1 rounded-lg bg-primary/10">
                            {currentScore} / {assignment.maxScore}
                          </span>
                          <button
                            onClick={() => {
                              setScoreDrafts((prev) => ({ ...prev, [student.id]: String(currentScore) }));
                              setEditingStudentId(student.id);
                            }}
                            className="text-xs text-muted-foreground hover:text-primary transition-colors p-1 cursor-pointer"
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
                            value={scoreDrafts[student.id] ?? (currentScore !== null && currentScore !== undefined ? String(currentScore) : "")}
                            onChange={(e) =>
                              setScoreDrafts((prev) => ({ ...prev, [student.id]: e.target.value }))
                            }
                            className="w-16 px-2.5 py-1.5 rounded-lg bg-background/80 border border-border text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/80"
                          />
                          <button
                            onClick={() => handleSaveScore(student.id, assignment.maxScore)}
                            disabled={savingStudentId === student.id}
                            className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all disabled:opacity-60 cursor-pointer shadow-xs"
                          >
                            {savingStudentId === student.id ? (
                              <i className="fa-solid fa-circle-notch fa-spin text-xs" />
                            ) : (
                              "บันทึก"
                            )}
                          </button>
                          {isEditing && (
                            <button
                              onClick={() => setEditingStudentId(null)}
                              className="px-2 py-1.5 rounded-lg text-muted-foreground hover:bg-muted text-xs transition-colors cursor-pointer"
                            >
                              ยกเลิก
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      </main>
    </div>
  );
}
