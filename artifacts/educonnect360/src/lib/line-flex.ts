/**
 * LINE Flex Message Builders for EduConnect360
 * Specifically styled for high legibility, large fonts (lg, xl),
 * high contrast, and easy readability for parents and elderly users.
 */

export interface StudentReportData {
  student: {
    fullName: string;
    studentId: string;
    gradeLevel?: string;
    parentViewToken?: string;
  };
  attendance: {
    todayStatus: "present" | "late" | "excused" | "absent" | "none";
    todayDate?: string;
    todayTime?: string;
    presentCount: number;
    lateCount: number;
    excusedCount: number;
    absentCount: number;
    totalCount: number;
    rate: number;
  };
  grades: Array<{
    subjectName: string;
    score: number;
    maxScore: number;
    grade: string;
  }>;
  gpa?: number;
  webBaseUrl?: string;
}

/**
 * All-in-One LINE Flex Message Card
 */
export function buildStudentReportFlexMessage(data: StudentReportData) {
  const { student, attendance, grades, gpa, webBaseUrl = "https://educonnect-lms.vercel.app" } = data;

  // Determine Today's Status styling
  let statusBadge = {
    text: "🟢 วันนี้: มาเรียนปกติ",
    bgColor: "#dcfce7", // Light green
    borderColor: "#22c55e",
    textColor: "#15803d",
    subtext: attendance.todayTime ? `เช็กชื่อเวลา: ${attendance.todayTime}` : "ตรงเวลา",
  };

  if (attendance.todayStatus === "late") {
    statusBadge = {
      text: "🟡 วันนี้: มาสาย",
      bgColor: "#fef3c7", // Light yellow/amber
      borderColor: "#f59e0b",
      textColor: "#b45309",
      subtext: attendance.todayTime ? `เช็กชื่อเวลา: ${attendance.todayTime}` : "มาเรียนสาย",
    };
  } else if (attendance.todayStatus === "excused") {
    statusBadge = {
      text: "🔵 วันนี้: ลา (มีใบลา)",
      bgColor: "#e0f2fe", // Light sky/blue
      borderColor: "#0ea5e9",
      textColor: "#0369a1",
      subtext: "ได้รับการอนุมัติการลา",
    };
  } else if (attendance.todayStatus === "absent") {
    statusBadge = {
      text: "🔴 วันนี้: ขาดเรียน",
      bgColor: "#fee2e2", // Light red
      borderColor: "#ef4444",
      textColor: "#b91c1c",
      subtext: "ยังไม่พบการเข้าห้องเรียน",
    };
  } else if (attendance.todayStatus === "none") {
    statusBadge = {
      text: "⚪ ยังไม่มีบันทึกการเช็กชื่อวันนี้",
      bgColor: "#f1f5f9", // Light slate
      borderColor: "#cbd5e1",
      textColor: "#475569",
      subtext: "รอคุณครูประจำวิชาบันทึก",
    };
  }

  // Format today's Thai date string
  const todayFormatted = new Date().toLocaleDateString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  // Grade rows
  const gradeRows = (grades.length > 0 ? grades.slice(0, 4) : [
    { subjectName: "วิชาทั่วไป", score: 85, maxScore: 100, grade: "4" }
  ]).map((g) => ({
    type: "box",
    layout: "horizontal",
    margin: "md",
    contents: [
      {
        type: "text",
        text: g.subjectName,
        size: "md",
        weight: "bold",
        color: "#1e293b",
        flex: 5,
        wrap: true,
      },
      {
        type: "text",
        text: `${g.score}/${g.maxScore}`,
        size: "sm",
        color: "#64748b",
        align: "center",
        flex: 3,
      },
      {
        type: "text",
        text: `เกรด ${g.grade}`,
        size: "md",
        weight: "bold",
        color: "#059669",
        align: "end",
        flex: 3,
      },
    ],
  }));

  const magicLink = student.parentViewToken
    ? `${webBaseUrl.replace(/\/$/, "")}/parent-view?token=${student.parentViewToken}`
    : `${webBaseUrl.replace(/\/$/, "")}/login`;

  return {
    type: "flex",
    altText: `สรุปข้อมูลนักเรียน: ${student.fullName} (รหัส ${student.studentId})`,
    contents: {
      type: "bubble",
      size: "giga",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#065f46",
        paddingAll: "20px",
        contents: [
          {
            type: "text",
            text: "สมุดรายงานข้อมูลนักเรียน",
            weight: "bold",
            color: "#ffffff",
            size: "xl",
          },
          {
            type: "text",
            text: `ข้อมูล ณ วันที่ ${todayFormatted}`,
            color: "#a7f3d0",
            size: "sm",
            margin: "xs",
          },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "18px",
        contents: [
          // 1. Student Info Section
          {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "text",
                text: student.fullName,
                weight: "bold",
                size: "xxl",
                color: "#0f172a",
                wrap: true,
              },
              {
                type: "box",
                layout: "horizontal",
                margin: "sm",
                contents: [
                  {
                    type: "box",
                    layout: "horizontal",
                    backgroundColor: "#ecfdf5",
                    cornerRadius: "6px",
                    paddingAll: "4px",
                    paddingStart: "8px",
                    paddingEnd: "8px",
                    contents: [
                      {
                        type: "text",
                        text: `รหัส: ${student.studentId}`,
                        size: "md",
                        weight: "bold",
                        color: "#065f46",
                      },
                    ],
                  },
                  {
                    type: "box",
                    layout: "horizontal",
                    margin: "md",
                    backgroundColor: "#f1f5f9",
                    cornerRadius: "6px",
                    paddingAll: "4px",
                    paddingStart: "8px",
                    paddingEnd: "8px",
                    contents: [
                      {
                        type: "text",
                        text: `ชั้น: ${student.gradeLevel || "มัธยมศึกษา"}`,
                        size: "md",
                        color: "#334155",
                      },
                    ],
                  },
                ],
              },
            ],
          },

          {
            type: "separator",
            margin: "lg",
            color: "#e2e8f0",
          },

          // 2. Today's Status Box (High Prominence)
          {
            type: "box",
            layout: "vertical",
            margin: "lg",
            paddingAll: "14px",
            cornerRadius: "12px",
            backgroundColor: statusBadge.bgColor,
            borderWidth: "1.5px",
            borderColor: statusBadge.borderColor,
            contents: [
              {
                type: "text",
                text: statusBadge.text,
                size: "xl",
                weight: "bold",
                color: statusBadge.textColor,
              },
              {
                type: "text",
                text: statusBadge.subtext,
                size: "sm",
                color: statusBadge.textColor,
                margin: "xs",
              },
            ],
          },

          {
            type: "separator",
            margin: "lg",
            color: "#e2e8f0",
          },

          // 3. Attendance Accumulation Stats (4 Clear Boxes)
          {
            type: "box",
            layout: "vertical",
            margin: "lg",
            contents: [
              {
                type: "text",
                text: "📋 สรุปสถิติการเข้าเรียนสะสม",
                size: "md",
                weight: "bold",
                color: "#1e293b",
              },
              {
                type: "box",
                layout: "horizontal",
                margin: "md",
                spacing: "sm",
                contents: [
                  // Box 1: Present
                  {
                    type: "box",
                    layout: "vertical",
                    backgroundColor: "#f0fdf4",
                    cornerRadius: "8px",
                    paddingAll: "8px",
                    alignItems: "center",
                    contents: [
                      {
                        type: "text",
                        text: `${attendance.presentCount}`,
                        size: "xl",
                        weight: "bold",
                        color: "#16a34a",
                      },
                      {
                        type: "text",
                        text: "มาเรียน",
                        size: "xs",
                        color: "#475569",
                        margin: "xs",
                      },
                    ],
                  },
                  // Box 2: Late
                  {
                    type: "box",
                    layout: "vertical",
                    backgroundColor: "#fffbeb",
                    cornerRadius: "8px",
                    paddingAll: "8px",
                    alignItems: "center",
                    contents: [
                      {
                        type: "text",
                        text: `${attendance.lateCount}`,
                        size: "xl",
                        weight: "bold",
                        color: "#d97706",
                      },
                      {
                        type: "text",
                        text: "มาสาย",
                        size: "xs",
                        color: "#475569",
                        margin: "xs",
                      },
                    ],
                  },
                  // Box 3: Excused / Leave
                  {
                    type: "box",
                    layout: "vertical",
                    backgroundColor: "#f0f9ff",
                    cornerRadius: "8px",
                    paddingAll: "8px",
                    alignItems: "center",
                    contents: [
                      {
                        type: "text",
                        text: `${attendance.excusedCount}`,
                        size: "xl",
                        weight: "bold",
                        color: "#0284c7",
                      },
                      {
                        type: "text",
                        text: "ลา",
                        size: "xs",
                        color: "#475569",
                        margin: "xs",
                      },
                    ],
                  },
                  // Box 4: Absent
                  {
                    type: "box",
                    layout: "vertical",
                    backgroundColor: "#fef2f2",
                    cornerRadius: "8px",
                    paddingAll: "8px",
                    alignItems: "center",
                    contents: [
                      {
                        type: "text",
                        text: `${attendance.absentCount}`,
                        size: "xl",
                        weight: "bold",
                        color: "#dc2626",
                      },
                      {
                        type: "text",
                        text: "ขาด",
                        size: "xs",
                        color: "#475569",
                        margin: "xs",
                      },
                    ],
                  },
                ],
              },
              {
                type: "box",
                layout: "horizontal",
                margin: "sm",
                contents: [
                  {
                    type: "text",
                    text: `รวมเข้าเรียนทั้งหมด ${attendance.rate}% (จาก ${attendance.totalCount} คาบ)`,
                    size: "xs",
                    color: "#64748b",
                    align: "center",
                  },
                ],
              },
            ],
          },

          {
            type: "separator",
            margin: "lg",
            color: "#e2e8f0",
          },

          // 4. Grades & GPA Section
          {
            type: "box",
            layout: "vertical",
            margin: "lg",
            contents: [
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  {
                    type: "text",
                    text: "📊 ผลการเรียนล่าสุด",
                    size: "md",
                    weight: "bold",
                    color: "#1e293b",
                    flex: 1,
                  },
                  {
                    type: "text",
                    text: gpa !== undefined ? `GPA: ${gpa.toFixed(2)}` : "เกรดเฉลี่ย: ดี",
                    size: "md",
                    weight: "bold",
                    color: "#065f46",
                    align: "end",
                  },
                ],
              },
              ...gradeRows,
            ],
          },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        paddingAll: "16px",
        contents: [
          {
            type: "button",
            action: {
              type: "uri",
              label: "📱 เปิดดูสมุดพกออนไลน์ (เว็บ)",
              uri: magicLink,
            },
            style: "primary",
            color: "#065f46",
            height: "md",
          },
          {
            type: "button",
            action: {
              type: "message",
              label: "🔍 ค้นหานักเรียนคนอื่น",
              text: "ค้นหานักเรียน",
            },
            style: "secondary",
            height: "sm",
          },
        ],
      },
    },
  };
}

/**
 * LINE Carousel Flex Message when multiple students match the search term
 */
export function buildMultipleStudentsCarousel(
  students: Array<{
    id: string;
    studentId: string;
    fullName: string;
    gradeLevel?: string;
  }>,
) {
  const bubbles = students.slice(0, 10).map((std) => ({
    type: "bubble",
    size: "micro",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: "#065f46",
      paddingAll: "12px",
      contents: [
        {
          type: "text",
          text: "พบนักเรียน",
          size: "xs",
          color: "#a7f3d0",
          weight: "bold",
        },
      ],
    },
    body: {
      type: "box",
      layout: "vertical",
      paddingAll: "12px",
      contents: [
        {
          type: "text",
          text: std.fullName,
          weight: "bold",
          size: "md",
          color: "#0f172a",
          wrap: true,
        },
        {
          type: "text",
          text: `รหัส: ${std.studentId}`,
          size: "sm",
          color: "#065f46",
          weight: "bold",
          margin: "xs",
        },
        {
          type: "text",
          text: `ชั้น: ${std.gradeLevel || "มัธยม"}`,
          size: "xs",
          color: "#64748b",
          margin: "xs",
        },
      ],
    },
    footer: {
      type: "box",
      layout: "vertical",
      paddingAll: "8px",
      contents: [
        {
          type: "button",
          style: "primary",
          color: "#065f46",
          height: "sm",
          action: {
            type: "message",
            label: "เลือกคนนี้",
            text: std.studentId,
          },
        },
      ],
    },
  }));

  return {
    type: "flex",
    altText: `พบนักเรียน ${students.length} คน กรุณากดเลือกคนต้องการดูข้อมูล`,
    contents: {
      type: "carousel",
      contents: bubbles,
    },
  };
}
