/**
 * Excel & CSV Helper using SheetJS (dynamically loaded on demand)
 * Supports parsing .xlsx, .xls, .csv and exporting to .xlsx / .csv
 */

let xlsxPromise: Promise<any> | null = null;

export function loadXLSX(): Promise<any> {
  if (typeof window !== "undefined" && (window as any).XLSX) {
    return Promise.resolve((window as any).XLSX);
  }
  if (xlsxPromise) return xlsxPromise;

  xlsxPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js";
    script.async = true;
    script.onload = () => {
      if ((window as any).XLSX) {
        resolve((window as any).XLSX);
      } else {
        reject(new Error("Failed to load SheetJS XLSX library"));
      }
    };
    script.onerror = () => reject(new Error("Failed to load SheetJS script"));
    document.head.appendChild(script);
  });

  return xlsxPromise;
}

/**
 * Parse an uploaded .xlsx, .xls, or .csv file into an array of objects
 */
export async function parseExcelOrCsv(file: File): Promise<any[]> {
  const XLSX = await loadXLSX();
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];
  const worksheet = workbook.Sheets[firstSheetName];
  const rows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
  return rows;
}

/**
 * Export data array to .xlsx file download
 */
export async function exportToExcel(
  data: any[],
  filename: string,
  sheetName = "Sheet1",
): Promise<void> {
  const XLSX = await loadXLSX();
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}

/**
 * Quick CSV export fallback
 */
export function exportToCsv(data: any[], filename: string): void {
  if (!data || data.length === 0) return;
  const headers = Object.keys(data[0]);
  const rows = data.map((row) =>
    headers.map((field) => JSON.stringify(row[field] ?? "")).join(","),
  );
  const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.setAttribute("download", filename.endsWith(".csv") ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
