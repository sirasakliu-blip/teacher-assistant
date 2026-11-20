import type { ClassCover } from "@/types";

export const CLASS_COVERS: { value: ClassCover; label: string; gradient: string }[] = [
  { value: "emerald", label: "Emerald", gradient: "from-emerald-500 to-emerald-700" },
  { value: "teal", label: "Teal", gradient: "from-teal-500 to-teal-700" },
  { value: "lime", label: "Lime", gradient: "from-lime-500 to-emerald-600" },
  { value: "forest", label: "Forest", gradient: "from-green-700 to-emerald-900" },
  { value: "mint", label: "Mint", gradient: "from-emerald-300 to-teal-500" },
  { value: "moss", label: "Moss", gradient: "from-green-500 to-lime-700" },
];

export function coverGradient(cover: ClassCover): string {
  return CLASS_COVERS.find((c) => c.value === cover)?.gradient ?? CLASS_COVERS[0].gradient;
}
