import { useState } from "react";
import { openAgent, copyToClipboard } from "@/lib/ai-assistant";
import { useToast } from "@/hooks/use-toast";
import type { LeaveRequest } from "@/types";

interface Props {
  leave: LeaveRequest;
  initialFormat?: "student" | "teacher";
  onClose: () => void;
  onApprove?: () => void;
  onReject?: () => void;
  canManage?: boolean;
}

function parseThaiDate(isoDate: string) {
  if (!isoDate) return { day: "", month: "", year: "" };
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return { day: "", month: "", year: "" };
  const thMonths = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
  ];
  return {
    day: String(d.getDate()),
    month: thMonths[d.getMonth()],
    year: String(d.getFullYear() + 543),
  };
}

export function LeaveDocumentModal({
  leave,
  initialFormat = "student",
  onClose,
  onApprove,
  onReject,
  canManage = false,
}: Props) {
  const [format, setFormat] = useState<"student" | "teacher">(initialFormat);
  const [showBlank, setShowBlank] = useState(false);

  const writtenDate = parseThaiDate(leave.date);
  const startDate = parseThaiDate(leave.startDate);
  const endDate = parseThaiDate(leave.endDate);
  const { toast } = useToast();

  async function handleAiDraftDocument() {
    const leaveTypeTh = leave.type === "sick" ? "ป่วย" : "กิจส่วนตัว";
    const startStr = leave.startDate || (writtenDate.day ? `${writtenDate.day} ${writtenDate.month} ${writtenDate.year}` : "วันนี้");
    const endStr = leave.endDate || startStr;
    const reasonStr = leave.reason || (leave.type === "sick" ? "มีอาการป่วย" : "มีกิจธุระจำเป็น");
    const promptText = `ช่วยร่างใบลา${leaveTypeTh} ตั้งแต่ ${startStr} ถึง ${endStr} เหตุผล ${reasonStr} ตามระเบียบสำนักนายกรัฐมนตรีว่าด้วยการลาของข้าราชการ พ.ศ. 2555 และออกเป็นไฟล์ Word`;

    await copyToClipboard(promptText);
    openAgent("docs", promptText);
    toast({
      title: "คัดลอกคำสั่งแล้ว",
      description: "นำไปวาง (Ctrl+V) ในหน้าต่างแชต LangMind ที่เปิดขึ้นได้ทันทีครับ",
      duration: 3000,
    });
  }

  function handlePrint() {
    window.print();
  }

  const isSick = leave.type === "sick";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-card w-full max-w-4xl rounded-2xl sm:rounded-3xl shadow-2xl border border-border overflow-hidden my-auto animate-fade-in-up">
        {/* Top Control Bar (Hidden when printing) */}
        <div className="no-print px-5 py-3.5 bg-muted/70 border-b border-border flex flex-wrap items-center justify-between gap-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground mr-1">รูปแบบเอกสาร:</span>
            <button
              onClick={() => setFormat("student")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                format === "student"
                  ? "bg-primary text-primary-foreground shadow"
                  : "bg-background text-muted-foreground hover:text-foreground"
              }`}
            >
              ภาพที่ 1: แบบของนักเรียน (ใบลานักเรียน)
            </button>
            <button
              onClick={() => setFormat("teacher")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                format === "teacher"
                  ? "bg-primary text-primary-foreground shadow"
                  : "bg-background text-muted-foreground hover:text-foreground"
              }`}
            >
              ภาพที่ 2: แบบของครู (ใบลา)
            </button>

            <button
              onClick={() => setShowBlank((prev) => !prev)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                showBlank
                  ? "bg-amber-500/10 text-amber-700 border-amber-500/30 font-bold"
                  : "bg-background text-muted-foreground border-border hover:text-foreground"
              }`}
              title="สลับมุมมองระหว่างแบบฟอร์มเปล่าเหมือนต้นฉบับเป๊ะ และแบบกรอกข้อมูลแล้ว"
            >
              <i className={`fa-solid ${showBlank ? "fa-file-lines" : "fa-signature"} mr-1`} />
              {showBlank ? "มุมมอง: ฟอร์มเปล่า (แบบในรูป)" : "มุมมอง: กรอกข้อมูลลงฟอร์ม"}
            </button>
          </div>

          <div className="flex items-center gap-2">
            {canManage && leave.status === "pending" && (
              <>
                <button
                  onClick={onApprove}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-all flex items-center gap-1 shadow-sm"
                >
                  <i className="fa-solid fa-check" /> อนุมัติ
                </button>
                <button
                  onClick={onReject}
                  className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition-all flex items-center gap-1 shadow-sm"
                >
                  <i className="fa-solid fa-xmark" /> ไม่อนุมัติ
                </button>
              </>
            )}
            <button
              onClick={handlePrint}
              className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all flex items-center gap-1.5 shadow-sm"
            >
              <i className="fa-solid fa-print" /> สั่งพิมพ์ (TH Sarabun A4)
            </button>
            <button
              onClick={handleAiDraftDocument}
              className="px-3.5 py-1.5 rounded-lg border border-[#1e7a4f] text-[#1e7a4f] hover:bg-[#1e7a4f]/10 dark:text-emerald-400 dark:border-emerald-500 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="ให้ AI ช่วยร่างใบลาเป็นไฟล์ Word ตามระเบียบสำนักนายกรัฐมนตรี"
            >
              <span>✨ ให้ AI ช่วยร่าง</span>
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
            >
              <i className="fa-solid fa-xmark" />
            </button>
          </div>
        </div>

        {/* Printable Document Sheet (A4 styled strictly to TH Sarabun PSK standards) */}
        <div className="p-4 sm:p-10 bg-white text-black overflow-x-auto flex justify-center">
          <div
            id="leave-printable-area"
            className="leave-document-print font-sarabun bg-white text-black w-[210mm] min-h-[297mm] p-[20mm] sm:p-[25mm] border border-gray-200 shadow-sm leading-[2.1] text-[18px] sm:text-[19px] selection:bg-gray-200"
            style={{
              fontFamily: "'TH Sarabun PSK', 'TH Sarabun New', 'Sarabun', 'Cordia New', sans-serif",
            }}
          >
            {/* 1. Header Title */}
            <div className="text-center font-bold text-[24px] sm:text-[26px] mb-8">
              {format === "student" ? (
                <u className="tracking-wide">ใบลานักเรียน</u>
              ) : (
                <u className="tracking-wide">ใบลา</u>
              )}
            </div>

            {/* 2. Written At and Date Block (Aligned to center-right at ~50%) */}
            <div className="ml-[45%] sm:ml-[50%] mb-6 space-y-1">
              <div>
                เขียนที่{" "}
                <span className="inline-block border-b border-dotted border-black min-w-[210px] text-center font-normal">
                  {showBlank ? "" : leave.writtenAt || "โรงเรียน"}
                </span>
              </div>
              <div>
                วันที่{" "}
                <span className="inline-block border-b border-dotted border-black min-w-[35px] text-center">
                  {showBlank ? "" : writtenDate.day}
                </span>{" "}
                เดือน{" "}
                <span className="inline-block border-b border-dotted border-black min-w-[120px] text-center">
                  {showBlank ? "" : writtenDate.month}
                </span>{" "}
                พ.ศ.{" "}
                <span className="inline-block border-b border-dotted border-black min-w-[60px] text-center">
                  {showBlank ? "" : writtenDate.year}
                </span>
              </div>
            </div>

            {/* 3. เรื่อง & เรียน */}
            <div className="space-y-2 mb-6">
              {/* เรื่อง */}
              {format === "student" ? (
                <div>
                  <span className="font-normal">เรื่อง</span>{" "}
                  <span>ขอลากิจ / ลาป่วย</span>
                  {!showBlank && (
                    <span className="ml-2 font-bold text-[17px] text-gray-800">
                      ({isSick ? "ขอลาป่วย" : "ขอลากิจ"})
                    </span>
                  )}
                </div>
              ) : (
                <div>
                  <span className="font-normal">เรื่อง</span>{" "}
                  <span className="inline-block border-b border-dotted border-black min-w-[320px] pl-2 font-normal">
                    {showBlank
                      ? ""
                      : isSick
                      ? `ขอลาป่วย${leave.reason ? ` (${leave.reason})` : ""}`
                      : `ขอลากิจ${leave.reason ? ` (${leave.reason})` : ""}`}
                  </span>
                </div>
              )}

              {/* เรียน */}
              {format === "student" ? (
                <div>
                  <span className="font-normal">เรียน</span> ครูที่ปรึกษา{" "}
                  <span className="inline-block border-b border-dotted border-black min-w-[320px] text-center font-normal">
                    {showBlank ? "" : leave.advisorName || ""}
                  </span>
                </div>
              ) : (
                <div>
                  <span className="font-normal">เรียน</span> ครูที่ปรึกษาประจำชั้น{" "}
                  <span className="inline-block border-b border-dotted border-black min-w-[140px] text-center font-normal">
                    {showBlank ? "" : leave.advisorName || ""}
                  </span>{" "}
                  /ครูผู้สอนวิชา{" "}
                  <span className="inline-block border-b border-dotted border-black min-w-[190px] text-center font-normal">
                    {showBlank ? "" : leave.subjectTeacherName || leave.className || ""}
                  </span>
                </div>
              )}
            </div>

            {/* 4. Body Paragraph */}
            <div className="text-justify leading-[2.2] space-y-1 mb-6">
              {/* บรรทัดที่ 1 (ย่อหน้า) */}
              <div className="indent-14 sm:indent-16">
                ด้วยกระผม/ดิฉัน (เด็กชาย ,เด็กหญิง ,นาย ,นางสาว )
                <span className="inline-block border-b border-dotted border-black min-w-[280px] text-center font-bold">
                  {showBlank ? "" : `${leave.prefix} ${leave.studentName}`}
                </span>
              </div>

              {/* บรรทัดที่ 2 */}
              <div>
                นักเรียนชั้น{" "}
                <span className="inline-block border-b border-dotted border-black min-w-[70px] text-center">
                  {showBlank ? "" : leave.studentGrade || ""}
                </span>{" "}
                เลขที่{" "}
                <span className="inline-block border-b border-dotted border-black min-w-[45px] text-center">
                  {showBlank ? "" : leave.studentNumber || ""}
                </span>{" "}
                ไม่สามารถมาเรียนได้ตามปกติ เนื่องจาก{" "}
                <span className="inline-block border-b border-dotted border-black min-w-[240px] text-center">
                  {showBlank ? "" : leave.reason || ""}
                </span>
              </div>

              {/* บรรทัดที่ 3: ความแตกต่างระหว่างภาพ 1 กับ ภาพ 2 */}
              {format === "student" ? (
                // ภาพที่ 1: บรรทัดจุดประยาวสำหรับเหตุผล
                <div>
                  <span className="inline-block border-b border-dotted border-black w-full min-h-[1.4em]"></span>
                </div>
              ) : (
                // ภาพที่ 2: บรรทัดระบุ "(บอกสาเหตุลา หากป่วยให้แจ้งอาการด้วย)"
                <div>
                  <span className="inline-block border-b border-dotted border-black w-[35%] min-h-[1.4em]"></span>{" "}
                  <span className="text-[17px]">(บอกสาเหตุลา หากป่วยให้แจ้งอาการด้วย)</span>{" "}
                  <span className="inline-block border-b border-dotted border-black w-[32%] min-h-[1.4em]"></span>
                </div>
              )}

              {/* บรรทัดที่ 4 & 5: การขออนุญาตหยุดเรียน */}
              {format === "student" ? (
                // ภาพที่ 1: "ตั้งแต่วันที่... พ.ศ. ... ถึงวันที่ (ขึ้นบรรทัดใหม่)"
                <>
                  <div className="indent-10">
                    .........................................กระผม,ดิฉัน จึงขออนุญาตหยุดเรียนตั้งแต่วันที่{" "}
                    <span className="inline-block border-b border-dotted border-black min-w-[35px] text-center">
                      {showBlank ? "" : startDate.day}
                    </span>{" "}
                    เดือน{" "}
                    <span className="inline-block border-b border-dotted border-black min-w-[100px] text-center">
                      {showBlank ? "" : startDate.month}
                    </span>{" "}
                    พ.ศ.{" "}
                    <span className="inline-block border-b border-dotted border-black min-w-[60px] text-center">
                      {showBlank ? "" : startDate.year}
                    </span>
                  </div>
                  <div>
                    ถึงวันที่{" "}
                    <span className="inline-block border-b border-dotted border-black min-w-[35px] text-center">
                      {showBlank ? "" : endDate.day}
                    </span>{" "}
                    เดือน{" "}
                    <span className="inline-block border-b border-dotted border-black min-w-[100px] text-center">
                      {showBlank ? "" : endDate.month}
                    </span>{" "}
                    พ.ศ.{" "}
                    <span className="inline-block border-b border-dotted border-black min-w-[60px] text-center">
                      {showBlank ? "" : endDate.year}
                    </span>{" "}
                    เป็นเวลา{" "}
                    <span className="inline-block border-b border-dotted border-black min-w-[45px] text-center font-bold">
                      {showBlank ? "" : leave.daysCount}
                    </span>{" "}
                    วัน เมื่อครบกำหนดแล้วกระผม,ดิฉัน
                  </div>
                  <div>จะมาเรียนตามปกติ</div>
                </>
              ) : (
                // ภาพที่ 2: "...พ.ศ. ... ถึง (คำว่า 'ถึง' อยู่ท้ายบรรทัด)"
                <>
                  <div className="indent-10">
                    .........................................กระผม,ดิฉัน จึงขออนุญาตหยุดเรียนตั้งแต่วันที่{" "}
                    <span className="inline-block border-b border-dotted border-black min-w-[35px] text-center">
                      {showBlank ? "" : startDate.day}
                    </span>{" "}
                    เดือน{" "}
                    <span className="inline-block border-b border-dotted border-black min-w-[100px] text-center">
                      {showBlank ? "" : startDate.month}
                    </span>{" "}
                    พ.ศ.{" "}
                    <span className="inline-block border-b border-dotted border-black min-w-[60px] text-center">
                      {showBlank ? "" : startDate.year}
                    </span>
                    ถึง
                  </div>
                  <div>
                    วันที่{" "}
                    <span className="inline-block border-b border-dotted border-black min-w-[35px] text-center">
                      {showBlank ? "" : endDate.day}
                    </span>{" "}
                    เดือน{" "}
                    <span className="inline-block border-b border-dotted border-black min-w-[100px] text-center">
                      {showBlank ? "" : endDate.month}
                    </span>{" "}
                    พ.ศ.{" "}
                    <span className="inline-block border-b border-dotted border-black min-w-[60px] text-center">
                      {showBlank ? "" : endDate.year}
                    </span>{" "}
                    เป็นเวลา{" "}
                    <span className="inline-block border-b border-dotted border-black min-w-[45px] text-center font-bold">
                      {showBlank ? "" : leave.daysCount}
                    </span>{" "}
                    วัน เมื่อครบกำหนดแล้วกระผม,ดิฉัน
                  </div>
                  <div>จะมาเรียนตามปกติ</div>
                </>
              )}
            </div>

            {/* 5. จึงเรียนมาเพื่อโปรดพิจารณาอนุญาต */}
            <div className="indent-14 sm:indent-16 my-8">
              จึงเรียนมาเพื่อโปรดพิจารณาอนุญาต
            </div>

            {/* 6. Signatures (Positioned strictly in the right column ~50% like in the photos) */}
            <div className="ml-[45%] sm:ml-[50%] my-8 space-y-8 text-center">
              {/* ลายเซ็นนักเรียน */}
              <div className="space-y-1">
                <div className="mb-3">ด้วยความเคารพอย่างสูง</div>
                <div>
                  ลงชื่อ{" "}
                  <span className="inline-block border-b border-dotted border-black min-w-[180px] text-center">
                    ............................................................
                  </span>
                </div>
                <div>
                  (
                  <span className="inline-block border-b border-dotted border-black min-w-[180px] text-center font-normal">
                    {showBlank ? "............................................................" : leave.studentName}
                  </span>
                  )
                </div>
                <div className="font-normal pt-1">นักเรียน</div>
              </div>

              {/* ลายเซ็นผู้ปกครอง */}
              <div className="space-y-1 pt-4">
                <div className="mb-3">ข้าพเจ้าขอรับรองว่าเป็นจริง</div>
                <div>
                  ลงชื่อ{" "}
                  <span className="inline-block border-b border-dotted border-black min-w-[180px] text-center">
                    ............................................................
                  </span>
                </div>
                <div>
                  (
                  <span className="inline-block border-b border-dotted border-black min-w-[180px] text-center font-normal">
                    {showBlank ? "............................................................" : leave.parentName || "............................................................"}
                  </span>
                  )
                </div>
                <div className="font-normal pt-1">ผู้ปกครอง</div>
              </div>
            </div>

            {/* 7. หมายเหตุเฉพาะภาพที่ 2 (แบบของครู) */}
            {format === "teacher" && (
              <div className="mt-14 pt-2 text-[15px] sm:text-[16px] leading-relaxed text-black">
                <span className="font-bold underline tracking-wide">หมายเหตุ</span>
                <span className="inline-block w-6"></span>
                นักเรียนจะต้องส่งใบลาทันทีในวันที่มาเรียนตามปกติ มิฉะนั้นจะถือว่าขาดเรียนและมีผลต่อคะแนนความ
                ประพฤติ และหากมีใบรับรองแพทย์ให้แนบมาพร้อมกับใบลาด้วย
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
