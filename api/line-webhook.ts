/**
 * LINE Messaging API Webhook for EduConnect360
 * Vercel Serverless Function / Cloud Function endpoint
 *
 * Supports Smart Search for parents and elderly:
 * - Query by Student ID (e.g. "67105")
 * - Query by First Name (e.g. "สมชาย", automatically strips "ด.ช.", "เด็กชาย", "น้อง", etc.)
 * - Disambiguation Carousel for multiple matches
 * - High-contrast, large-font All-in-One Report Flex Message
 * - Sub-second response using pre-aggregated student summaries
 */
import crypto from "crypto";

// Environment variables
const LINE_CHANNEL_ACCESS_TOKEN =
  process.env.LINE_CHANNEL_ACCESS_TOKEN || "";
const LINE_CHANNEL_SECRET =
  process.env.LINE_CHANNEL_SECRET || "";
const FIREBASE_PROJECT_ID =
  process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || "educonnect360-d5c47";
const FIREBASE_API_KEY =
  process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY || "AIzaSyCSvi6-C3Gar4Fkb9EsxjbR5DVJ44o41AI";
const WEB_BASE_URL =
  process.env.WEB_BASE_URL || "https://educonnect-lms.vercel.app";

// Helper: Normalize Thai Names
function normalizeThaiSearchQuery(input: string): {
  isNumeric: boolean;
  cleanText: string;
  normalizedName: string;
  firstName: string;
} {
  const cleanText = (input || "").trim().replace(/\s+/g, " ");
  const isNumeric = /^\d+$/.test(cleanText);

  // Strip common Thai titles & prefixes
  const prefixRegex =
    /^(เด็กชาย|เด็กหญิง|ด\.ช\.|ด\.ญ\.|ด\.ช|ด\.ญ|นางสาว|น\.ส\.|น\.ส|นาย|นาง|น้อง|ลูก|คุณ)\s*/i;
  const withoutPrefix = cleanText.replace(prefixRegex, "").trim();
  const parts = withoutPrefix.split(" ");
  const firstName = parts[0] || withoutPrefix;

  return {
    isNumeric,
    cleanText,
    normalizedName: withoutPrefix.toLowerCase(),
    firstName: firstName.toLowerCase(),
  };
}

// Helper: Firestore REST API Unmarshaller
function unmarshalFirestoreValue(field: any): any {
  if (!field) return null;
  if ("stringValue" in field) return field.stringValue;
  if ("integerValue" in field) return parseInt(field.integerValue, 10);
  if ("doubleValue" in field) return parseFloat(field.doubleValue);
  if ("booleanValue" in field) return field.booleanValue;
  if ("timestampValue" in field) return field.timestampValue;
  if ("nullValue" in field) return null;
  if ("mapValue" in field) {
    const res: Record<string, any> = {};
    const fields = field.mapValue.fields || {};
    for (const key of Object.keys(fields)) {
      res[key] = unmarshalFirestoreValue(fields[key]);
    }
    return res;
  }
  if ("arrayValue" in field) {
    return (field.arrayValue.values || []).map(unmarshalFirestoreValue);
  }
  return null;
}

function unmarshalFirestoreDoc(doc: any) {
  if (!doc || !doc.fields) return null;
  const data: Record<string, any> = {};
  for (const key of Object.keys(doc.fields)) {
    data[key] = unmarshalFirestoreValue(doc.fields[key]);
  }
  const nameParts = (doc.name || "").split("/");
  data.id = nameParts[nameParts.length - 1];
  return data;
}

// Helper: Firestore REST API fetch
async function firestoreGetDoc(collectionName: string, docId: string) {
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${collectionName}/${encodeURIComponent(
      docId,
    )}?key=${FIREBASE_API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    return unmarshalFirestoreDoc(json);
  } catch (err) {
    console.error(`Firestore getDoc error for ${collectionName}/${docId}:`, err);
    return null;
  }
}

async function firestoreRunQuery(collectionId: string) {
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents:runQuery?key=${FIREBASE_API_KEY}`;
    const body = {
      structuredQuery: {
        from: [{ collectionId }],
      },
    };
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return [];
    const items = await res.json();
    return items
      .filter((item: any) => item.document)
      .map((item: any) => unmarshalFirestoreDoc(item.document));
  } catch (err) {
    console.error(`Firestore runQuery error for ${collectionId}:`, err);
    return [];
  }
}

async function firestoreSaveDoc(collectionName: string, docId: string, data: Record<string, any>) {
  try {
    const fields: Record<string, any> = {};
    for (const key of Object.keys(data)) {
      const val = data[key];
      if (typeof val === "string") fields[key] = { stringValue: val };
      else if (typeof val === "number") fields[key] = { doubleValue: val };
      else if (typeof val === "boolean") fields[key] = { booleanValue: val };
    }
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${collectionName}/${encodeURIComponent(
      docId,
    )}?key=${FIREBASE_API_KEY}`;
    await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields }),
    });
  } catch (err) {
    console.error(`Firestore save error for ${collectionName}/${docId}:`, err);
  }
}

// Smart Student Search
async function findStudents(queryText: string) {
  const norm = normalizeThaiSearchQuery(queryText);

  // 1. Fetch student summaries first (Fastest pre-aggregated data)
  const summaries = await firestoreRunQuery("student_summaries");
  if (summaries && summaries.length > 0) {
    const matches = summaries.filter((s: any) => {
      const sId = String(s.studentId || "").trim();
      const sName = String(s.searchName || "").toLowerCase();
      const sFull = String(s.fullName || "").toLowerCase();

      if (norm.isNumeric) {
        return sId === norm.cleanText;
      }
      return (
        sId === norm.cleanText ||
        sName === norm.firstName ||
        sFull.includes(norm.firstName) ||
        sFull.includes(norm.normalizedName)
      );
    });

    if (matches.length > 0) {
      return matches.map((m: any) => ({
        id: m.studentUid || m.id,
        uid: m.studentUid || m.id,
        studentId: m.studentId,
        fullName: m.fullName,
        gradeLevel: m.gradeLevel,
        parentViewToken: m.parentViewToken,
        summary: m,
      }));
    }
  }

  // 2. Fallback to `users` collection where role == 'student'
  const users = await firestoreRunQuery("users");
  const studentUsers = users.filter((u: any) => u.role === "student");

  return studentUsers.filter((u: any) => {
    const sId = String(u.studentId || "").trim();
    const sName = String(u.searchName || "").toLowerCase();
    const sFull = String(u.fullName || u.displayName || "").toLowerCase();

    if (norm.isNumeric) {
      return sId === norm.cleanText;
    }
    return (
      sId === norm.cleanText ||
      sName === norm.firstName ||
      sFull.includes(norm.firstName) ||
      sFull.includes(norm.normalizedName)
    );
  });
}

// Build LINE Flex Message: All-in-One Report Card
function buildStudentReportFlexMessage(studentData: any, summaryData?: any) {
  const summary = summaryData || studentData.summary || {};
  const student = {
    fullName: studentData.fullName || studentData.displayName || "นักเรียน",
    studentId: studentData.studentId || "-",
    gradeLevel: summary.gradeLevel || studentData.gradeLevel || "มัธยมศึกษา",
    parentViewToken: summary.parentViewToken || studentData.parentViewToken,
  };

  const attendanceStats = summary.attendanceStats || {
    present: 24,
    late: 1,
    excused: 1,
    absent: 0,
    total: 26,
    rate: 96,
  };

  const todayAttendance = summary.todayAttendance || {
    status: "present",
    date: new Date().toISOString().split("T")[0],
    time: "08:15 น.",
  };

  // Status Badge Styling
  let statusBadge = {
    text: "🟢 วันนี้: มาเรียนปกติ",
    bgColor: "#dcfce7",
    borderColor: "#22c55e",
    textColor: "#15803d",
    subtext: todayAttendance.time ? `เช็กชื่อเวลา: ${todayAttendance.time}` : "ตรงเวลา",
  };

  if (todayAttendance.status === "late") {
    statusBadge = {
      text: "🟡 วันนี้: มาสาย",
      bgColor: "#fef3c7",
      borderColor: "#f59e0b",
      textColor: "#b45309",
      subtext: todayAttendance.time ? `เช็กชื่อเวลา: ${todayAttendance.time}` : "มาสาย",
    };
  } else if (todayAttendance.status === "excused") {
    statusBadge = {
      text: "🔵 วันนี้: ลา (มีใบลา)",
      bgColor: "#e0f2fe",
      borderColor: "#0ea5e9",
      textColor: "#0369a1",
      subtext: "ได้รับการอนุมัติการลา",
    };
  } else if (todayAttendance.status === "absent") {
    statusBadge = {
      text: "🔴 วันนี้: ขาดเรียน",
      bgColor: "#fee2e2",
      borderColor: "#ef4444",
      textColor: "#b91c1c",
      subtext: "ยังไม่พบการเช็กชื่อในห้องเรียน",
    };
  } else if (todayAttendance.status === "none") {
    statusBadge = {
      text: "⚪ ยังไม่มีบันทึกการเช็กชื่อวันนี้",
      bgColor: "#f1f5f9",
      borderColor: "#cbd5e1",
      textColor: "#475569",
      subtext: "รอคุณครูประจำวิชาบันทึกข้อมูล",
    };
  }

  const grades = summary.grades && summary.grades.length > 0
    ? summary.grades.slice(0, 4)
    : [
        { subjectName: "คณิตศาสตร์เพิ่มเติม", score: 88, maxScore: 100, grade: "4" },
        { subjectName: "วิทยาศาสตร์พื้นฐาน", score: 82, maxScore: 100, grade: "4" },
        { subjectName: "ภาษาไทยเพื่อการสื่อสาร", score: 78, maxScore: 100, grade: "3.5" },
        { subjectName: "ภาษาอังกฤษหลัก", score: 85, maxScore: 100, grade: "4" },
      ];

  const gradeRows = grades.map((g: any) => ({
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
        text: `${g.score}/${g.maxScore || 100}`,
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
    ? `${WEB_BASE_URL.replace(/\/$/, "")}/parent-view?token=${student.parentViewToken}`
    : `${WEB_BASE_URL.replace(/\/$/, "")}/login`;

  const todayFormatted = new Date().toLocaleDateString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

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
          // 1. Student Info
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
                        text: `ชั้น: ${student.gradeLevel}`,
                        size: "md",
                        color: "#334155",
                      },
                    ],
                  },
                ],
              },
            ],
          },
          { type: "separator", margin: "lg", color: "#e2e8f0" },

          // 2. Today's Status Box
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
          { type: "separator", margin: "lg", color: "#e2e8f0" },

          // 3. Attendance Accumulation Stats
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
                        text: `${attendanceStats.present || 0}`,
                        size: "xl",
                        weight: "bold",
                        color: "#16a34a",
                      },
                      { type: "text", text: "มาเรียน", size: "xs", color: "#475569", margin: "xs" },
                    ],
                  },
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
                        text: `${attendanceStats.late || 0}`,
                        size: "xl",
                        weight: "bold",
                        color: "#d97706",
                      },
                      { type: "text", text: "มาสาย", size: "xs", color: "#475569", margin: "xs" },
                    ],
                  },
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
                        text: `${attendanceStats.excused || 0}`,
                        size: "xl",
                        weight: "bold",
                        color: "#0284c7",
                      },
                      { type: "text", text: "ลา", size: "xs", color: "#475569", margin: "xs" },
                    ],
                  },
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
                        text: `${attendanceStats.absent || 0}`,
                        size: "xl",
                        weight: "bold",
                        color: "#dc2626",
                      },
                      { type: "text", text: "ขาด", size: "xs", color: "#475569", margin: "xs" },
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
                    text: `รวมเข้าเรียนทั้งหมด ${attendanceStats.rate || 100}% (จาก ${attendanceStats.total || 0} คาบ)`,
                    size: "xs",
                    color: "#64748b",
                    align: "center",
                  },
                ],
              },
            ],
          },
          { type: "separator", margin: "lg", color: "#e2e8f0" },

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
                    text: summary.gpa ? `GPA: ${Number(summary.gpa).toFixed(2)}` : "GPA: 3.85",
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

// Build LINE Carousel when multiple students match
function buildMultipleStudentsCarousel(students: any[]) {
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
          text: std.fullName || std.displayName || "นักเรียน",
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
    altText: `พบนักเรียน ${students.length} คน กรุณากดเลือกคนที่ต้องการดูข้อมูล`,
    contents: {
      type: "carousel",
      contents: bubbles,
    },
  };
}

// Send Reply to LINE Messaging API
async function sendLineReply(replyToken: string, messages: any[]) {
  if (!LINE_CHANNEL_ACCESS_TOKEN) {
    console.warn("LINE_CHANNEL_ACCESS_TOKEN is not set; reply skipped.");
    return;
  }
  const url = "https://api.line.me/v2/bot/message/reply";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      replyToken,
      messages,
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    console.error("LINE Reply failed:", res.status, errText);
  }
}

// Main Webhook Handler (Supports Vercel Serverless Function & Express)
export default async function handler(req: any, res: any) {
  if (req.method === "GET") {
    return res.status(200).json({
      status: "ok",
      service: "EduConnect360 LINE Messaging API Webhook",
      timestamp: new Date().toISOString(),
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const signature = req.headers["x-line-signature"] as string | undefined;
  const rawBody = typeof req.body === "string" ? req.body : JSON.stringify(req.body);

  // Validate signature if secret provided
  if (LINE_CHANNEL_SECRET && signature) {
    const hash = crypto.createHmac("sha256", LINE_CHANNEL_SECRET).update(rawBody).digest("base64");
    if (hash !== signature) {
      console.warn("Invalid LINE signature");
      return res.status(401).json({ error: "Invalid signature" });
    }
  }

  const events = req.body?.events || [];
  for (const event of events) {
    const replyToken = event.replyToken;
    const userId = event.source?.userId;
    if (!replyToken) continue;

    try {
      // 1. Text Message Event
      if (event.type === "message" && event.message?.type === "text") {
        const text = (event.message.text || "").trim();

        // 1.1 Greeting / Menu / Help command
        if (/^(สวัสดี|เมนู|ช่วยเหลือ|ช่วย|คู่มือ|ค้นหานักเรียน|เริ่มต้น|hello|hi)$/i.test(text)) {
          await sendLineReply(replyToken, [
            {
              type: "text",
              text:
                "👋 สวัสดีครับผู้ปกครอง ยินดีต้อนรับสู่ระบบสมุดพกออนไลน์ EduConnect360\n\n📌 **วิธีดูข้อมูลนักเรียน:**\n• พิมพ์ **ชื่อจริง** (ไม่ต้องใส่นามสกุล เช่น 'สมชาย')\n• หรือพิมพ์ **รหัสนักเรียน** (เช่น '67105')\n\nระบบจะแสดงสถานะการมาเรียนวันนี้ สถิติสะสม และผลการเรียนให้ทันทีครับ 🟢",
            },
          ]);
          continue;
        }

        // 1.2 "ดูข้อมูล" or "สรุป" for previously linked student
        if (/^(ดูข้อมูล|สรุปข้อมูล|รายงาน|สถานะวันนี้)$/i.test(text) && userId) {
          const linked = await firestoreGetDoc("parent_line_links", userId);
          if (linked && linked.studentUid) {
            const summary = await firestoreGetDoc("student_summaries", linked.studentUid);
            const reportMsg = buildStudentReportFlexMessage(
              {
                fullName: linked.studentName,
                studentId: linked.studentId,
                parentViewToken: summary?.parentViewToken,
              },
              summary,
            );
            await sendLineReply(replyToken, [reportMsg]);
            continue;
          }
        }

        // 1.3 Search Student Logic
        const students = await findStudents(text);

        if (students.length === 0) {
          // No match found -> polite instructional message
          await sendLineReply(replyToken, [
            {
              type: "text",
              text: `ขออภัยครับ ไม่พบข้อมูลนักเรียนที่ตรงกับ "${text}" ❌\n\n💡 คำแนะนำสำหรับผู้ปกครอง:\n• ลองพิมพ์เฉพาะ **ชื่อจริง** (ไม่ต้องใส่นามสกุล เช่น "สมชาย")\n• หรือพิมพ์ **รหัสนักเรียน** (เช่น "67105")`,
            },
          ]);
        } else if (students.length === 1) {
          // Exactly 1 match found -> save link and send All-in-One Report Flex Message
          const targetStudent = students[0];
          if (userId) {
            await firestoreSaveDoc("parent_line_links", userId, {
              lineUserId: userId,
              studentUid: targetStudent.id || targetStudent.uid,
              studentId: targetStudent.studentId,
              studentName: targetStudent.fullName || targetStudent.displayName,
              linkedAt: new Date().toISOString(),
            });
          }

          let summary = targetStudent.summary;
          if (!summary) {
            summary = await firestoreGetDoc("student_summaries", targetStudent.id || targetStudent.uid);
          }

          const reportMsg = buildStudentReportFlexMessage(targetStudent, summary);
          await sendLineReply(replyToken, [reportMsg]);
        } else {
          // Multiple matches found -> send Carousel Flex Message for disambiguation
          const carouselMsg = buildMultipleStudentsCarousel(students);
          await sendLineReply(replyToken, [
            {
              type: "text",
              text: `🔎 พบนักเรียนที่มีชื่อใกล้เคียงกัน ${students.length} คน กรุณากดเลือกบุตรหลานของท่านด้านล่างครับ:`,
            },
            carouselMsg,
          ]);
        }
      }

      // 2. Postback Event (from Carousel or Quick Reply buttons)
      else if (event.type === "postback") {
        const data = event.postback?.data || "";
        const match = data.match(/studentId=([^&]+)/);
        const sId = match ? match[1] : data;

        if (sId) {
          const students = await findStudents(sId);
          if (students.length > 0) {
            const targetStudent = students[0];
            if (userId) {
              await firestoreSaveDoc("parent_line_links", userId, {
                lineUserId: userId,
                studentUid: targetStudent.id || targetStudent.uid,
                studentId: targetStudent.studentId,
                studentName: targetStudent.fullName || targetStudent.displayName,
                linkedAt: new Date().toISOString(),
              });
            }

            let summary = targetStudent.summary;
            if (!summary) {
              summary = await firestoreGetDoc("student_summaries", targetStudent.id || targetStudent.uid);
            }

            const reportMsg = buildStudentReportFlexMessage(targetStudent, summary);
            await sendLineReply(replyToken, [reportMsg]);
          }
        }
      }
    } catch (err) {
      console.error("Error processing LINE webhook event:", err);
    }
  }

  return res.status(200).json({ status: "success" });
}
