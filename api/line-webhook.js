// @ts-nocheck
"use strict";
var import_crypto = require("crypto");
const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || "";
const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET || "";
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || "educonnect360-d5c47";
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY || "AIzaSyCSvi6-C3Gar4Fkb9EsxjbR5DVJ44o41AI";
const WEB_BASE_URL = process.env.WEB_BASE_URL || "https://educonnect-lms.vercel.app";
const LINE_LIFF_ID = process.env.LINE_LIFF_ID || process.env.VITE_LINE_LIFF_ID || "2012726688-SBKhhJZJ";

function getLiffUrl(tab = "", extraParams = {}) {
  const query = new URLSearchParams();
  if (tab) query.set("tab", tab);
  query.set("source", "richmenu");
  for (const [k, v] of Object.entries(extraParams)) {
    if (v) query.set(k, String(v));
  }
  const queryString = query.toString() ? `?${query.toString()}` : "";
  if (LINE_LIFF_ID) {
    return `https://liff.line.me/${LINE_LIFF_ID}${queryString}`;
  }
  return `${WEB_BASE_URL.replace(/\/$/, "")}/parent-liff${queryString}`;
}
function normalizeThaiSearchQuery(input) {
  const cleanText = (input || "").trim().replace(/\s+/g, " ");
  const isNumeric = /^\d+$/.test(cleanText);
  const prefixRegex = /^(เด็กชาย|เด็กหญิง|ด\.ช\.|ด\.ญ\.|ด\.ช|ด\.ญ|นางสาว|น\.ส\.|น\.ส|นาย|นาง|น้อง|ลูก|คุณ)\s*/i;
  const withoutPrefix = cleanText.replace(prefixRegex, "").trim();
  const parts = withoutPrefix.split(" ");
  const firstName = parts[0] || withoutPrefix;
  return {
    isNumeric,
    cleanText,
    normalizedName: withoutPrefix.toLowerCase(),
    firstName: firstName.toLowerCase()
  };
}
function unmarshalFirestoreValue(field) {
  if (!field) return null;
  if ("stringValue" in field) return field.stringValue;
  if ("integerValue" in field) return parseInt(field.integerValue, 10);
  if ("doubleValue" in field) return parseFloat(field.doubleValue);
  if ("booleanValue" in field) return field.booleanValue;
  if ("timestampValue" in field) return field.timestampValue;
  if ("nullValue" in field) return null;
  if ("mapValue" in field) {
    const res = {};
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
function unmarshalFirestoreDoc(doc) {
  if (!doc || !doc.fields) return null;
  const data = {};
  for (const key of Object.keys(doc.fields)) {
    data[key] = unmarshalFirestoreValue(doc.fields[key]);
  }
  const nameParts = (doc.name || "").split("/");
  data.id = nameParts[nameParts.length - 1];
  return data;
}
async function firestoreGetDoc(collectionName, docId) {
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${collectionName}/${encodeURIComponent(
      docId
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
async function firestoreRunQuery(collectionId) {
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents:runQuery?key=${FIREBASE_API_KEY}`;
    const body = {
      structuredQuery: {
        from: [{ collectionId }]
      }
    };
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!res.ok) return [];
    const items = await res.json();
    return items.filter((item) => item.document).map((item) => unmarshalFirestoreDoc(item.document));
  } catch (err) {
    console.error(`Firestore runQuery error for ${collectionId}:`, err);
    return [];
  }
}
async function firestoreSaveDoc(collectionName, docId, data) {
  try {
    const fields = {};
    for (const key of Object.keys(data)) {
      const val = data[key];
      if (typeof val === "string") fields[key] = { stringValue: val };
      else if (typeof val === "number") fields[key] = { doubleValue: val };
      else if (typeof val === "boolean") fields[key] = { booleanValue: val };
    }
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${collectionName}/${encodeURIComponent(
      docId
    )}?key=${FIREBASE_API_KEY}`;
    await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields })
    });
  } catch (err) {
    console.error(`Firestore save error for ${collectionName}/${docId}:`, err);
  }
}
async function findStudents(queryText) {
  const norm = normalizeThaiSearchQuery(queryText);
  const summaries = await firestoreRunQuery("student_summaries");
  if (summaries && summaries.length > 0) {
    const matches = summaries.filter((s) => {
      const sId = String(s.studentId || "").trim();
      const sName = String(s.searchName || "").toLowerCase();
      const sFull = String(s.fullName || "").toLowerCase();
      if (norm.isNumeric) {
        return sId === norm.cleanText;
      }
      return sId === norm.cleanText || sName === norm.firstName || sFull.includes(norm.firstName) || sFull.includes(norm.normalizedName);
    });
    if (matches.length > 0) {
      return matches.map((m) => ({
        id: m.studentUid || m.id,
        uid: m.studentUid || m.id,
        studentId: m.studentId,
        fullName: m.fullName,
        gradeLevel: m.gradeLevel,
        parentViewToken: m.parentViewToken,
        summary: m
      }));
    }
  }
  const users = await firestoreRunQuery("users");
  const studentUsers = users.filter((u) => u.role === "student");
  return studentUsers.filter((u) => {
    const sId = String(u.studentId || "").trim();
    const sName = String(u.searchName || "").toLowerCase();
    const sFull = String(u.fullName || u.displayName || "").toLowerCase();
    if (norm.isNumeric) {
      return sId === norm.cleanText;
    }
    return sId === norm.cleanText || sName === norm.firstName || sFull.includes(norm.firstName) || sFull.includes(norm.normalizedName);
  });
}
function buildStudentReportFlexMessage(studentData, summaryData) {
  const summary = summaryData || studentData.summary || {};
  const student = {
    fullName: studentData.fullName || studentData.displayName || "\u0E19\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E19",
    studentId: studentData.studentId || "-",
    gradeLevel: summary.gradeLevel || studentData.gradeLevel || "\u0E21\u0E31\u0E18\u0E22\u0E21\u0E28\u0E36\u0E01\u0E29\u0E32",
    parentViewToken: summary.parentViewToken || studentData.parentViewToken
  };
  const attendanceStats = summary.attendanceStats || {
    present: 24,
    late: 1,
    excused: 1,
    absent: 0,
    total: 26,
    rate: 96
  };
  const todayAttendance = summary.todayAttendance || {
    status: "present",
    date: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
    time: "08:15 \u0E19."
  };
  let statusBadge = {
    text: "\u{1F7E2} \u0E27\u0E31\u0E19\u0E19\u0E35\u0E49: \u0E21\u0E32\u0E40\u0E23\u0E35\u0E22\u0E19\u0E1B\u0E01\u0E15\u0E34",
    bgColor: "#dcfce7",
    borderColor: "#22c55e",
    textColor: "#15803d",
    subtext: todayAttendance.time ? `\u0E40\u0E0A\u0E47\u0E01\u0E0A\u0E37\u0E48\u0E2D\u0E40\u0E27\u0E25\u0E32: ${todayAttendance.time}` : "\u0E15\u0E23\u0E07\u0E40\u0E27\u0E25\u0E32"
  };
  if (todayAttendance.status === "late") {
    statusBadge = {
      text: "\u{1F7E1} \u0E27\u0E31\u0E19\u0E19\u0E35\u0E49: \u0E21\u0E32\u0E2A\u0E32\u0E22",
      bgColor: "#fef3c7",
      borderColor: "#f59e0b",
      textColor: "#b45309",
      subtext: todayAttendance.time ? `\u0E40\u0E0A\u0E47\u0E01\u0E0A\u0E37\u0E48\u0E2D\u0E40\u0E27\u0E25\u0E32: ${todayAttendance.time}` : "\u0E21\u0E32\u0E2A\u0E32\u0E22"
    };
  } else if (todayAttendance.status === "excused") {
    statusBadge = {
      text: "\u{1F535} \u0E27\u0E31\u0E19\u0E19\u0E35\u0E49: \u0E25\u0E32 (\u0E21\u0E35\u0E43\u0E1A\u0E25\u0E32)",
      bgColor: "#e0f2fe",
      borderColor: "#0ea5e9",
      textColor: "#0369a1",
      subtext: "\u0E44\u0E14\u0E49\u0E23\u0E31\u0E1A\u0E01\u0E32\u0E23\u0E2D\u0E19\u0E38\u0E21\u0E31\u0E15\u0E34\u0E01\u0E32\u0E23\u0E25\u0E32"
    };
  } else if (todayAttendance.status === "absent") {
    statusBadge = {
      text: "\u{1F534} \u0E27\u0E31\u0E19\u0E19\u0E35\u0E49: \u0E02\u0E32\u0E14\u0E40\u0E23\u0E35\u0E22\u0E19",
      bgColor: "#fee2e2",
      borderColor: "#ef4444",
      textColor: "#b91c1c",
      subtext: "\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E01\u0E32\u0E23\u0E40\u0E0A\u0E47\u0E01\u0E0A\u0E37\u0E48\u0E2D\u0E43\u0E19\u0E2B\u0E49\u0E2D\u0E07\u0E40\u0E23\u0E35\u0E22\u0E19"
    };
  } else if (todayAttendance.status === "none") {
    statusBadge = {
      text: "\u26AA \u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E01\u0E32\u0E23\u0E40\u0E0A\u0E47\u0E01\u0E0A\u0E37\u0E48\u0E2D\u0E27\u0E31\u0E19\u0E19\u0E35\u0E49",
      bgColor: "#f1f5f9",
      borderColor: "#cbd5e1",
      textColor: "#475569",
      subtext: "\u0E23\u0E2D\u0E04\u0E38\u0E13\u0E04\u0E23\u0E39\u0E1B\u0E23\u0E30\u0E08\u0E33\u0E27\u0E34\u0E0A\u0E32\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25"
    };
  }
  const grades = summary.grades && summary.grades.length > 0 ? summary.grades.slice(0, 4) : [
    { subjectName: "\u0E04\u0E13\u0E34\u0E15\u0E28\u0E32\u0E2A\u0E15\u0E23\u0E4C\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E40\u0E15\u0E34\u0E21", score: 88, maxScore: 100, grade: "4" },
    { subjectName: "\u0E27\u0E34\u0E17\u0E22\u0E32\u0E28\u0E32\u0E2A\u0E15\u0E23\u0E4C\u0E1E\u0E37\u0E49\u0E19\u0E10\u0E32\u0E19", score: 82, maxScore: 100, grade: "4" },
    { subjectName: "\u0E20\u0E32\u0E29\u0E32\u0E44\u0E17\u0E22\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E01\u0E32\u0E23\u0E2A\u0E37\u0E48\u0E2D\u0E2A\u0E32\u0E23", score: 78, maxScore: 100, grade: "3.5" },
    { subjectName: "\u0E20\u0E32\u0E29\u0E32\u0E2D\u0E31\u0E07\u0E01\u0E24\u0E29\u0E2B\u0E25\u0E31\u0E01", score: 85, maxScore: 100, grade: "4" }
  ];
  const gradeRows = grades.map((g) => ({
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
        wrap: true
      },
      {
        type: "text",
        text: `${g.score}/${g.maxScore || 100}`,
        size: "sm",
        color: "#64748b",
        align: "center",
        flex: 3
      },
      {
        type: "text",
        text: `\u0E40\u0E01\u0E23\u0E14 ${g.grade}`,
        size: "md",
        weight: "bold",
        color: "#059669",
        align: "end",
        flex: 3
      }
    ]
  }));
  const magicLink = getLiffUrl("", student.parentViewToken ? { token: student.parentViewToken } : {});
  const todayFormatted = (/* @__PURE__ */ new Date()).toLocaleDateString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
  return {
    type: "flex",
    altText: `\u0E2A\u0E23\u0E38\u0E1B\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E19\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E19: ${student.fullName} (\u0E23\u0E2B\u0E31\u0E2A ${student.studentId})`,
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
            text: "\u0E2A\u0E21\u0E38\u0E14\u0E23\u0E32\u0E22\u0E07\u0E32\u0E19\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E19\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E19",
            weight: "bold",
            color: "#ffffff",
            size: "xl"
          },
          {
            type: "text",
            text: `\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25 \u0E13 \u0E27\u0E31\u0E19\u0E17\u0E35\u0E48 ${todayFormatted}`,
            color: "#a7f3d0",
            size: "sm",
            margin: "xs"
          }
        ]
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
                wrap: true
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
                        text: `\u0E23\u0E2B\u0E31\u0E2A: ${student.studentId}`,
                        size: "md",
                        weight: "bold",
                        color: "#065f46"
                      }
                    ]
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
                        text: `\u0E0A\u0E31\u0E49\u0E19: ${student.gradeLevel}`,
                        size: "md",
                        color: "#334155"
                      }
                    ]
                  }
                ]
              }
            ]
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
                color: statusBadge.textColor
              },
              {
                type: "text",
                text: statusBadge.subtext,
                size: "sm",
                color: statusBadge.textColor,
                margin: "xs"
              }
            ]
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
                text: "\u{1F4CB} \u0E2A\u0E23\u0E38\u0E1B\u0E2A\u0E16\u0E34\u0E15\u0E34\u0E01\u0E32\u0E23\u0E40\u0E02\u0E49\u0E32\u0E40\u0E23\u0E35\u0E22\u0E19\u0E2A\u0E30\u0E2A\u0E21",
                size: "md",
                weight: "bold",
                color: "#1e293b"
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
                        color: "#16a34a"
                      },
                      { type: "text", text: "\u0E21\u0E32\u0E40\u0E23\u0E35\u0E22\u0E19", size: "xs", color: "#475569", margin: "xs" }
                    ]
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
                        color: "#d97706"
                      },
                      { type: "text", text: "\u0E21\u0E32\u0E2A\u0E32\u0E22", size: "xs", color: "#475569", margin: "xs" }
                    ]
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
                        color: "#0284c7"
                      },
                      { type: "text", text: "\u0E25\u0E32", size: "xs", color: "#475569", margin: "xs" }
                    ]
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
                        color: "#dc2626"
                      },
                      { type: "text", text: "\u0E02\u0E32\u0E14", size: "xs", color: "#475569", margin: "xs" }
                    ]
                  }
                ]
              },
              {
                type: "box",
                layout: "horizontal",
                margin: "sm",
                contents: [
                  {
                    type: "text",
                    text: `\u0E23\u0E27\u0E21\u0E40\u0E02\u0E49\u0E32\u0E40\u0E23\u0E35\u0E22\u0E19\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14 ${attendanceStats.rate || 100}% (\u0E08\u0E32\u0E01 ${attendanceStats.total || 0} \u0E04\u0E32\u0E1A)`,
                    size: "xs",
                    color: "#64748b",
                    align: "center"
                  }
                ]
              }
            ]
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
                    text: "\u{1F4CA} \u0E1C\u0E25\u0E01\u0E32\u0E23\u0E40\u0E23\u0E35\u0E22\u0E19\u0E25\u0E48\u0E32\u0E2A\u0E38\u0E14",
                    size: "md",
                    weight: "bold",
                    color: "#1e293b",
                    flex: 1
                  },
                  {
                    type: "text",
                    text: summary.gpa ? `GPA: ${Number(summary.gpa).toFixed(2)}` : "GPA: 3.85",
                    size: "md",
                    weight: "bold",
                    color: "#065f46",
                    align: "end"
                  }
                ]
              },
              ...gradeRows
            ]
          }
        ]
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
              label: "\u{1F4F1} \u0E40\u0E1B\u0E34\u0E14\u0E14\u0E39\u0E2A\u0E21\u0E38\u0E14\u0E1E\u0E01\u0E2D\u0E2D\u0E19\u0E44\u0E25\u0E19\u0E4C (\u0E40\u0E27\u0E47\u0E1A)",
              uri: magicLink
            },
            style: "primary",
            color: "#065f46",
            height: "md"
          },
          {
            type: "button",
            action: {
              type: "message",
              label: "\u{1F50D} \u0E04\u0E49\u0E19\u0E2B\u0E32\u0E19\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E19\u0E04\u0E19\u0E2D\u0E37\u0E48\u0E19",
              text: "\u0E04\u0E49\u0E19\u0E2B\u0E32\u0E19\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E19"
            },
            style: "secondary",
            height: "sm"
          }
        ]
      }
    }
  };
}
function buildMultipleStudentsCarousel(students) {
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
          text: "\u0E1E\u0E1A\u0E19\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E19",
          size: "xs",
          color: "#a7f3d0",
          weight: "bold"
        }
      ]
    },
    body: {
      type: "box",
      layout: "vertical",
      paddingAll: "12px",
      contents: [
        {
          type: "text",
          text: std.fullName || std.displayName || "\u0E19\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E19",
          weight: "bold",
          size: "md",
          color: "#0f172a",
          wrap: true
        },
        {
          type: "text",
          text: `\u0E23\u0E2B\u0E31\u0E2A: ${std.studentId}`,
          size: "sm",
          color: "#065f46",
          weight: "bold",
          margin: "xs"
        },
        {
          type: "text",
          text: `\u0E0A\u0E31\u0E49\u0E19: ${std.gradeLevel || "\u0E21\u0E31\u0E18\u0E22\u0E21"}`,
          size: "xs",
          color: "#64748b",
          margin: "xs"
        }
      ]
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
            label: "\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E04\u0E19\u0E19\u0E35\u0E49",
            text: std.studentId
          }
        }
      ]
    }
  }));
  return {
    type: "flex",
    altText: `\u0E1E\u0E1A\u0E19\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E19 ${students.length} \u0E04\u0E19 \u0E01\u0E23\u0E38\u0E13\u0E32\u0E01\u0E14\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E04\u0E19\u0E17\u0E35\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E01\u0E32\u0E23\u0E14\u0E39\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25`,
    contents: {
      type: "carousel",
      contents: bubbles
    }
  };
}
async function sendLineReply(replyToken, messages) {
  if (!LINE_CHANNEL_ACCESS_TOKEN) {
    console.warn("LINE_CHANNEL_ACCESS_TOKEN is not set; reply skipped.");
    return;
  }
  const url = "https://api.line.me/v2/bot/message/reply";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`
    },
    body: JSON.stringify({
      replyToken,
      messages
    })
  });
  if (!res.ok) {
    const errText = await res.text();
    console.error("LINE Reply failed:", res.status, errText);
  }
}
async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({
      status: "ok",
      service: "EduConnect360 LINE Messaging API Webhook",
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const signature = req.headers["x-line-signature"];
  const rawBody = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
  if (LINE_CHANNEL_SECRET && signature) {
    const hash = import_crypto.default.createHmac("sha256", LINE_CHANNEL_SECRET).update(rawBody).digest("base64");
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
      if (event.type === "message" && event.message?.type === "text") {
        const text = (event.message.text || "").trim();
        if (/^(สวัสดี|เมนู|ช่วยเหลือ|ช่วย|คู่มือ|ค้นหานักเรียน|เริ่มต้น|hello|hi)$/i.test(text)) {
          await sendLineReply(replyToken, [
            {
              type: "text",
              text: "\u{1F44B} \u0E2A\u0E27\u0E31\u0E2A\u0E14\u0E35\u0E04\u0E23\u0E31\u0E1A\u0E1C\u0E39\u0E49\u0E1B\u0E01\u0E04\u0E23\u0E2D\u0E07 \u0E22\u0E34\u0E19\u0E14\u0E35\u0E15\u0E49\u0E2D\u0E19\u0E23\u0E31\u0E1A\u0E2A\u0E39\u0E48\u0E23\u0E30\u0E1A\u0E1A\u0E2A\u0E21\u0E38\u0E14\u0E1E\u0E01\u0E2D\u0E2D\u0E19\u0E44\u0E25\u0E19\u0E4C EduConnect360\n\n\u{1F4CC} **\u0E27\u0E34\u0E18\u0E35\u0E14\u0E39\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E19\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E19:**\n\u2022 \u0E1E\u0E34\u0E21\u0E1E\u0E4C **\u0E0A\u0E37\u0E48\u0E2D\u0E08\u0E23\u0E34\u0E07** (\u0E44\u0E21\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E43\u0E2A\u0E48\u0E19\u0E32\u0E21\u0E2A\u0E01\u0E38\u0E25 \u0E40\u0E0A\u0E48\u0E19 '\u0E2A\u0E21\u0E0A\u0E32\u0E22')\n\u2022 \u0E2B\u0E23\u0E37\u0E2D\u0E1E\u0E34\u0E21\u0E1E\u0E4C **\u0E23\u0E2B\u0E31\u0E2A\u0E19\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E19** (\u0E40\u0E0A\u0E48\u0E19 '67105')\n\n\u0E23\u0E30\u0E1A\u0E1A\u0E08\u0E30\u0E41\u0E2A\u0E14\u0E07\u0E2A\u0E16\u0E32\u0E19\u0E30\u0E01\u0E32\u0E23\u0E21\u0E32\u0E40\u0E23\u0E35\u0E22\u0E19\u0E27\u0E31\u0E19\u0E19\u0E35\u0E49 \u0E2A\u0E16\u0E34\u0E15\u0E34\u0E2A\u0E30\u0E2A\u0E21 \u0E41\u0E25\u0E30\u0E1C\u0E25\u0E01\u0E32\u0E23\u0E40\u0E23\u0E35\u0E22\u0E19\u0E43\u0E2B\u0E49\u0E17\u0E31\u0E19\u0E17\u0E35\u0E04\u0E23\u0E31\u0E1A \u{1F7E2}"
            }
          ]);
          continue;
        }
        if (/^(ดูข้อมูล|สรุปข้อมูล|รายงาน|สถานะวันนี้)$/i.test(text) && userId) {
          const linked = await firestoreGetDoc("parent_line_links", userId);
          if (linked && linked.studentUid) {
            const summary = await firestoreGetDoc("student_summaries", linked.studentUid);
            const reportMsg = buildStudentReportFlexMessage(
              {
                fullName: linked.studentName,
                studentId: linked.studentId,
                parentViewToken: summary?.parentViewToken
              },
              summary
            );
            await sendLineReply(replyToken, [reportMsg]);
            continue;
          }
        }

        // 0. Richmenu / Quick action: การเข้าเรียน & แจ้งเตือนขาดเรียน
        if (/^(การเข้าเรียน|เช็คชื่อ|เช็คชื่อเข้าเรียน|ประวัติการเรียน|ขาดเรียน|มาเรียน|attendance)$/i.test(text)) {
          const linked = userId ? await firestoreGetDoc("parent_line_links", userId) : null;
          const targetUrl = getLiffUrl("attendance");

          if (linked && linked.studentUid) {
            const summary = await firestoreGetDoc("student_summaries", linked.studentUid);
            const todayStatus = summary?.todayAttendance?.status || "none";
            const isAbsent = todayStatus === "absent";
            const statusLabel =
              todayStatus === "present"
                ? "🟢 วันนี้: มาเรียนปกติ"
                : todayStatus === "late"
                ? "🟡 วันนี้: มาสาย"
                : todayStatus === "excused"
                ? "🔵 วันนี้: ลา (มีใบลา)"
                : todayStatus === "absent"
                ? "🔴 วันนี้: ขาดเรียน / ไม่เข้าเรียน"
                : "⚪ ยังไม่มีข้อมูลเช็คชื่อวันนี้";

            await sendLineReply(replyToken, [
              {
                type: "flex",
                altText: isAbsent
                  ? `🚨 แจ้งเตือน: ${linked.studentName} ขาดเรียนวันนี้`
                  : `รายงานการเข้าเรียนของ ${linked.studentName}`,
                contents: {
                  type: "bubble",
                  header: {
                    type: "box",
                    layout: "vertical",
                    backgroundColor: isAbsent ? "#e11d48" : "#059669",
                    paddingAll: "16px",
                    contents: [
                      {
                        type: "text",
                        text: isAbsent ? "🚨 แจ้งเตือนการเข้าเรียน" : "📋 รายงานการเข้าเรียน",
                        color: "#ffffff",
                        weight: "bold",
                        size: "lg"
                      },
                      {
                        type: "text",
                        text: `นักเรียน: ${linked.studentName} (${linked.studentId || ""})`,
                        color: isAbsent ? "#fecdd3" : "#a7f3d0",
                        size: "xs",
                        margin: "xs"
                      }
                    ]
                  },
                  body: {
                    type: "box",
                    layout: "vertical",
                    paddingAll: "16px",
                    spacing: "md",
                    contents: [
                      {
                        type: "text",
                        text: statusLabel,
                        weight: "bold",
                        size: "md",
                        color: isAbsent ? "#e11d48" : "#059669"
                      },
                      {
                        type: "box",
                        layout: "horizontal",
                        contents: [
                          { type: "text", text: "มาเรียนสะสม:", size: "xs", color: "#64748b", flex: 5 },
                          {
                            type: "text",
                            text: `${summary?.attendanceStats?.present || 0} ครั้ง (${summary?.attendanceStats?.rate || 100}%)`,
                            size: "xs",
                            weight: "bold",
                            color: "#0f172a",
                            flex: 5
                          }
                        ]
                      },
                      {
                        type: "box",
                        layout: "horizontal",
                        contents: [
                          { type: "text", text: "ขาดเรียนสะสม:", size: "xs", color: "#64748b", flex: 5 },
                          {
                            type: "text",
                            text: `${summary?.attendanceStats?.absent || 0} ครั้ง`,
                            size: "xs",
                            weight: "bold",
                            color: (summary?.attendanceStats?.absent || 0) > 0 ? "#e11d48" : "#0f172a",
                            flex: 5
                          }
                        ]
                      },
                      {
                        type: "text",
                        text: "ผู้ปกครองสามารถกดปุ่มด้านล่างเพื่อตรวจสอบการเช็คชื่อแยกรายวิชาและประวัติย้อนหลังทั้งหมดได้ทันทีครับ",
                        size: "xs",
                        color: "#475569",
                        wrap: true
                      }
                    ]
                  },
                  footer: {
                    type: "box",
                    layout: "vertical",
                    paddingAll: "12px",
                    contents: [
                      {
                        type: "button",
                        style: "primary",
                        color: isAbsent ? "#e11d48" : "#059669",
                        action: {
                          type: "uri",
                          label: "📊 ดูประวัติและรายวิชาทั้งหมด",
                          uri: targetUrl
                        }
                      }
                    ]
                  }
                }
              }
            ]);
            continue;
          } else {
            await sendLineReply(replyToken, [
              {
                type: "flex",
                altText: "ตรวจสอบการเข้าเรียน",
                contents: {
                  type: "bubble",
                  header: {
                    type: "box",
                    layout: "vertical",
                    backgroundColor: "#059669",
                    paddingAll: "16px",
                    contents: [
                      { type: "text", text: "📋 รายงานการเข้าเรียน", color: "#ffffff", weight: "bold", size: "lg" }
                    ]
                  },
                  body: {
                    type: "box",
                    layout: "vertical",
                    paddingAll: "16px",
                    contents: [
                      {
                        type: "text",
                        text: "ท่านสามารถตรวจสอบสถานะการเข้าเรียนและประวัติการเช็คชื่อได้ผ่านระบบสมุดพกออนไลน์ หรือพิมพ์ชื่อจริง/รหัสนักเรียนเพื่อเชื่อมต่อข้อมูลครับ",
                        wrap: true,
                        size: "sm",
                        color: "#334155"
                      }
                    ]
                  },
                  footer: {
                    type: "box",
                    layout: "vertical",
                    paddingAll: "12px",
                    contents: [
                      {
                        type: "button",
                        style: "primary",
                        color: "#059669",
                        action: {
                          type: "uri",
                          label: "📊 เปิดดูประวัติการเข้าเรียน",
                          uri: targetUrl
                        }
                      }
                    ]
                  }
                }
              }
            ]);
            continue;
          }
        }

        // 1. Richmenu / Quick action: การบ้าน & งานค้าง
        if (/^(การบ้าน|งานค้าง|งานที่มอบหมาย|เช็คการบ้าน|homework)$/i.test(text)) {
          const linked = userId ? await firestoreGetDoc("parent_line_links", userId) : null;
          const targetUrl = getLiffUrl("assignments");
          await sendLineReply(replyToken, [
            {
              type: "flex",
              altText: linked?.studentName ? `การบ้านของ ${linked.studentName}` : "การบ้านและงานค้าง",
              contents: {
                type: "bubble",
                header: {
                  type: "box",
                  layout: "vertical",
                  backgroundColor: "#065f46",
                  paddingAll: "16px",
                  contents: [
                    { type: "text", text: "📚 การบ้าน & งานค้าง", color: "#ffffff", weight: "bold", size: "lg" },
                    linked?.studentName
                      ? { type: "text", text: `นักเรียน: ${linked.studentName} (${linked.studentId || ""})`, color: "#a7f3d0", size: "xs", margin: "xs" }
                      : { type: "text", text: "ระบบติดตามการบ้านนักเรียน", color: "#a7f3d0", size: "xs", margin: "xs" }
                  ]
                },
                body: {
                  type: "box",
                  layout: "vertical",
                  paddingAll: "16px",
                  contents: [
                    {
                      type: "text",
                      text: linked?.studentName
                        ? `คลิกปุ่มด้านล่างเพื่อตรวจสอบงานที่ค้างส่ง กำหนดส่ง และคะแนนของ ${linked.studentName} ได้ทันทีครับ`
                        : "กรุณากดปุ่มเพื่อดูการบ้าน หรือพิมพ์ชื่อจริง/รหัสนักเรียนเพื่อเชื่อมต่อข้อมูลบุตรหลาน",
                      wrap: true,
                      size: "sm",
                      color: "#334155"
                    }
                  ]
                },
                footer: {
                  type: "box",
                  layout: "vertical",
                  paddingAll: "12px",
                  contents: [
                    {
                      type: "button",
                      style: "primary",
                      color: "#065f46",
                      action: {
                        type: "uri",
                        label: "📝 เปิดดูการบ้านและงานค้าง",
                        uri: targetUrl
                      }
                    }
                  ]
                }
              }
            }
          ]);
          continue;
        }

        // 2. Richmenu / Quick action: แจ้งลาเรียน / ประวัติการลา
        if (/^(แจ้งลา|แจ้งลาเรียน|ลาเรียน|ใบลา|ขอลากิจ|ลาป่วย|ประวัติการลา|leave)$/i.test(text)) {
          const linked = userId ? await firestoreGetDoc("parent_line_links", userId) : null;
          const targetUrl = getLiffUrl("leave");
          await sendLineReply(replyToken, [
            {
              type: "flex",
              altText: "แจ้งลาเรียน / ประวัติการลา",
              contents: {
                type: "bubble",
                header: {
                  type: "box",
                  layout: "vertical",
                  backgroundColor: "#0284c7",
                  paddingAll: "16px",
                  contents: [
                    { type: "text", text: "📝 ยื่นใบลา & ประวัติการลา", color: "#ffffff", weight: "bold", size: "lg" },
                    linked?.studentName
                      ? { type: "text", text: `นักเรียน: ${linked.studentName} (${linked.studentId || ""})`, color: "#bae6fd", size: "xs", margin: "xs" }
                      : { type: "text", text: "ระบบยื่นใบลาและติดตามผล", color: "#bae6fd", size: "xs", margin: "xs" }
                  ]
                },
                body: {
                  type: "box",
                  layout: "vertical",
                  paddingAll: "16px",
                  contents: [
                    {
                      type: "text",
                      text: "ผู้ปกครองสามารถยื่นใบลาออนไลน์ และตรวจสอบสถานะการอนุมัติใบลาจากคุณครูได้สะดวกรวดเร็วครับ",
                      wrap: true,
                      size: "sm",
                      color: "#334155"
                    }
                  ]
                },
                footer: {
                  type: "box",
                  layout: "vertical",
                  paddingAll: "12px",
                  contents: [
                    {
                      type: "button",
                      style: "primary",
                      color: "#0284c7",
                      action: {
                        type: "uri",
                        label: "📩 เข้าสู่หน้าระบบใบลา",
                        uri: targetUrl
                      }
                    }
                  ]
                }
              }
            }
          ]);
          continue;
        }

        // 3. Richmenu / Quick action: ตารางเรียน
        if (/^(ตารางเรียน|ตารางสอน|คาบเรียน|ตาราง|schedule)$/i.test(text)) {
          const linked = userId ? await firestoreGetDoc("parent_line_links", userId) : null;
          const targetUrl = getLiffUrl("schedule");
          await sendLineReply(replyToken, [
            {
              type: "flex",
              altText: "ตารางเรียนประจำวัน",
              contents: {
                type: "bubble",
                header: {
                  type: "box",
                  layout: "vertical",
                  backgroundColor: "#4f46e5",
                  paddingAll: "16px",
                  contents: [
                    { type: "text", text: "🗓️ ตารางเรียนประจำวัน", color: "#ffffff", weight: "bold", size: "lg" },
                    linked?.studentName
                      ? { type: "text", text: `นักเรียน: ${linked.studentName} (${linked.studentId || ""})`, color: "#c7d2fe", size: "xs", margin: "xs" }
                      : { type: "text", text: "ตารางเรียน ม.1 - ม.6", color: "#c7d2fe", size: "xs", margin: "xs" }
                  ]
                },
                body: {
                  type: "box",
                  layout: "vertical",
                  paddingAll: "16px",
                  contents: [
                    {
                      type: "text",
                      text: "ตรวจสอบรายวิชาที่เรียน คาบสอน เวลาเรียน ห้องเรียน และครูผู้สอนแบบทั้งวันและทั้งสัปดาห์ได้ทันทีครับ",
                      wrap: true,
                      size: "sm",
                      color: "#334155"
                    }
                  ]
                },
                footer: {
                  type: "box",
                  layout: "vertical",
                  paddingAll: "12px",
                  contents: [
                    {
                      type: "button",
                      style: "primary",
                      color: "#4f46e5",
                      action: {
                        type: "uri",
                        label: "📅 เปิดดูตารางเรียน",
                        uri: targetUrl
                      }
                    }
                  ]
                }
              }
            }
          ]);
          continue;
        }

        // 4. Richmenu / Quick action: ประกาศข่าวสารจากครู
        if (/^(ประกาศ|ข่าวสาร|ข่าวประชาสัมพันธ์|announcement|announcements)$/i.test(text)) {
          const linked = userId ? await firestoreGetDoc("parent_line_links", userId) : null;
          const targetUrl = getLiffUrl("announcements");
          await sendLineReply(replyToken, [
            {
              type: "flex",
              altText: "ประกาศและข่าวสารจากคุณครู",
              contents: {
                type: "bubble",
                header: {
                  type: "box",
                  layout: "vertical",
                  backgroundColor: "#e11d48",
                  paddingAll: "16px",
                  contents: [
                    { type: "text", text: "📢 ข่าวสาร & ประกาศจากครู", color: "#ffffff", weight: "bold", size: "lg" },
                    linked?.studentName
                      ? { type: "text", text: `นักเรียน: ${linked.studentName} (${linked.studentId || ""})`, color: "#fecdd3", size: "xs", margin: "xs" }
                      : { type: "text", text: "ข่าวสารห้องเรียนและโรงเรียน", color: "#fecdd3", size: "xs", margin: "xs" }
                  ]
                },
                body: {
                  type: "box",
                  layout: "vertical",
                  paddingAll: "16px",
                  contents: [
                    {
                      type: "text",
                      text: "ติดตามประกาศด่วน ข่าวกิจกรรม กำหนดการประชุมผู้ปกครอง และข่าวสารห้องเรียนได้ทันที",
                      wrap: true,
                      size: "sm",
                      color: "#334155"
                    }
                  ]
                },
                footer: {
                  type: "box",
                  layout: "vertical",
                  paddingAll: "12px",
                  contents: [
                    {
                      type: "button",
                      style: "primary",
                      color: "#e11d48",
                      action: {
                        type: "uri",
                        label: "📢 เปิดอ่านประกาศล่าสุด",
                        uri: targetUrl
                      }
                    }
                  ]
                }
              }
            }
          ]);
          continue;
        }

        // 5. Richmenu / Quick action: ติดต่อครูประจำชั้น
        if (/^(ติดต่อครู|ติดต่อครูประจำชั้น|เบอร์ครู|ครูที่ปรึกษา|เบอร์โทรครู|เบอร์คุณครู|contact)$/i.test(text)) {
          const linked = userId ? await firestoreGetDoc("parent_line_links", userId) : null;
          const targetUrl = getLiffUrl("contact");

          let advisorInfo = null;
          if (linked && linked.studentUid) {
            const studentDoc = await firestoreGetDoc("users", linked.studentUid);
            const studentGrade = studentDoc?.gradeLevel || "";
            if (studentGrade) {
              const teachers = await firestoreRunQuery("users");
              advisorInfo = teachers.find(
                (u) => u.advisorRoom === studentGrade || (u.role === "teacher" && u.advisorRoom === studentGrade)
              );
            }
          }

          const teacherName = advisorInfo?.fullName || advisorInfo?.displayName || "นายสมหมาย ใจดี";
          const teacherPhone = advisorInfo?.phoneNumber || "081-234-5678";
          const teacherLine = advisorInfo?.lineId || "kru_sommai";
          const lineLink = teacherLine.startsWith("http")
            ? teacherLine
            : `https://line.me/R/ti/p/~${teacherLine.trim()}`;

          await sendLineReply(replyToken, [
            {
              type: "flex",
              altText: `ติดต่อครูประจำชั้น: ${teacherName}`,
              contents: {
                type: "bubble",
                header: {
                  type: "box",
                  layout: "vertical",
                  backgroundColor: "#059669",
                  paddingAll: "16px",
                  contents: [
                    { type: "text", text: "📞 ช่องทางติดต่อครูประจำชั้น", color: "#ffffff", weight: "bold", size: "lg" },
                    linked?.studentName
                      ? { type: "text", text: `นักเรียน: ${linked.studentName} (${linked.studentId || ""})`, color: "#a7f3d0", size: "xs", margin: "xs" }
                      : { type: "text", text: "ครูประจำชั้น / ครูที่ปรึกษา", color: "#a7f3d0", size: "xs", margin: "xs" }
                  ]
                },
                body: {
                  type: "box",
                  layout: "vertical",
                  paddingAll: "16px",
                  spacing: "md",
                  contents: [
                    {
                      type: "box",
                      layout: "horizontal",
                      contents: [
                        { type: "text", text: "ครูประจำชั้น:", size: "xs", color: "#64748b", flex: 3 },
                        { type: "text", text: teacherName, size: "sm", weight: "bold", color: "#0f172a", flex: 6 }
                      ]
                    },
                    {
                      type: "box",
                      layout: "horizontal",
                      contents: [
                        { type: "text", text: "เบอร์โทรศัพท์:", size: "xs", color: "#64748b", flex: 3 },
                        { type: "text", text: teacherPhone, size: "sm", weight: "bold", color: "#059669", flex: 6 }
                      ]
                    },
                    {
                      type: "box",
                      layout: "horizontal",
                      contents: [
                        { type: "text", text: "LINE ID:", size: "xs", color: "#64748b", flex: 3 },
                        { type: "text", text: teacherLine, size: "sm", weight: "bold", color: "#0284c7", flex: 6 }
                      ]
                    }
                  ]
                },
                footer: {
                  type: "box",
                  layout: "vertical",
                  spacing: "sm",
                  paddingAll: "12px",
                  contents: [
                    {
                      type: "button",
                      style: "primary",
                      color: "#059669",
                      height: "sm",
                      action: {
                        type: "uri",
                        label: `📞 โทรหาครู (${teacherPhone})`,
                        uri: `tel:${teacherPhone.replace(/[^0-9]/g, "")}`
                      }
                    },
                    {
                      type: "button",
                      style: "secondary",
                      height: "sm",
                      action: {
                        type: "uri",
                        label: `💬 แอดไลน์ครู (${teacherLine})`,
                        uri: lineLink
                      }
                    },
                    {
                      type: "button",
                      style: "link",
                      height: "sm",
                      action: {
                        type: "uri",
                        label: "ดูครูผู้สอนทุกรายวิชา",
                        uri: targetUrl
                      }
                    }
                  ]
                }
              }
            }
          ]);
          continue;
        }
        const students = await findStudents(text);
        if (students.length === 0) {
          await sendLineReply(replyToken, [
            {
              type: "text",
              text: `\u0E02\u0E2D\u0E2D\u0E20\u0E31\u0E22\u0E04\u0E23\u0E31\u0E1A \u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E19\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E19\u0E17\u0E35\u0E48\u0E15\u0E23\u0E07\u0E01\u0E31\u0E1A "${text}" \u274C

\u{1F4A1} \u0E04\u0E33\u0E41\u0E19\u0E30\u0E19\u0E33\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E1C\u0E39\u0E49\u0E1B\u0E01\u0E04\u0E23\u0E2D\u0E07:
\u2022 \u0E25\u0E2D\u0E07\u0E1E\u0E34\u0E21\u0E1E\u0E4C\u0E40\u0E09\u0E1E\u0E32\u0E30 **\u0E0A\u0E37\u0E48\u0E2D\u0E08\u0E23\u0E34\u0E07** (\u0E44\u0E21\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E43\u0E2A\u0E48\u0E19\u0E32\u0E21\u0E2A\u0E01\u0E38\u0E25 \u0E40\u0E0A\u0E48\u0E19 "\u0E2A\u0E21\u0E0A\u0E32\u0E22")
\u2022 \u0E2B\u0E23\u0E37\u0E2D\u0E1E\u0E34\u0E21\u0E1E\u0E4C **\u0E23\u0E2B\u0E31\u0E2A\u0E19\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E19** (\u0E40\u0E0A\u0E48\u0E19 "67105")`
            }
          ]);
        } else if (students.length === 1) {
          const targetStudent = students[0];
          if (userId) {
            await firestoreSaveDoc("parent_line_links", userId, {
              lineUserId: userId,
              studentUid: targetStudent.id || targetStudent.uid,
              studentId: targetStudent.studentId,
              studentName: targetStudent.fullName || targetStudent.displayName,
              linkedAt: (/* @__PURE__ */ new Date()).toISOString()
            });
          }
          let summary = targetStudent.summary;
          if (!summary) {
            summary = await firestoreGetDoc("student_summaries", targetStudent.id || targetStudent.uid);
          }
          const reportMsg = buildStudentReportFlexMessage(targetStudent, summary);
          await sendLineReply(replyToken, [reportMsg]);
        } else {
          const carouselMsg = buildMultipleStudentsCarousel(students);
          await sendLineReply(replyToken, [
            {
              type: "text",
              text: `\u{1F50E} \u0E1E\u0E1A\u0E19\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E19\u0E17\u0E35\u0E48\u0E21\u0E35\u0E0A\u0E37\u0E48\u0E2D\u0E43\u0E01\u0E25\u0E49\u0E40\u0E04\u0E35\u0E22\u0E07\u0E01\u0E31\u0E19 ${students.length} \u0E04\u0E19 \u0E01\u0E23\u0E38\u0E13\u0E32\u0E01\u0E14\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E1A\u0E38\u0E15\u0E23\u0E2B\u0E25\u0E32\u0E19\u0E02\u0E2D\u0E07\u0E17\u0E48\u0E32\u0E19\u0E14\u0E49\u0E32\u0E19\u0E25\u0E48\u0E32\u0E07\u0E04\u0E23\u0E31\u0E1A:`
            },
            carouselMsg
          ]);
        }
      } else if (event.type === "postback") {
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
                linkedAt: (/* @__PURE__ */ new Date()).toISOString()
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

module.exports = handler;
module.exports.default = handler;
