import { File, FileSpreadsheet, FileText, type LucideIcon } from "lucide-react"

export type FileTypeInfo = {
  label: string
  Icon: LucideIcon
  iconClassName: string
}

// Визначає тип файлу для іконки/бейджа. Майбутні формати (xlsx/pdf) уже
// підтримані на рівні UI — достатньо, щоб вони з'явилися в mimeType/назві.
export function getFileType(mimeType: string, fileName: string): FileTypeInfo {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? ""
  const mime = mimeType.toLowerCase()

  if (
    ext === "docx" ||
    ext === "doc" ||
    mime.includes("wordprocessingml") ||
    mime === "application/msword"
  ) {
    return {
      label: "WORD",
      Icon: FileText,
      iconClassName: "text-blue-500 bg-blue-500/10 ring-blue-500/20",
    }
  }

  if (
    ext === "xlsx" ||
    ext === "xls" ||
    mime.includes("spreadsheetml") ||
    mime.includes("ms-excel")
  ) {
    return {
      label: "EXCEL",
      Icon: FileSpreadsheet,
      iconClassName: "text-emerald-500 bg-emerald-500/10 ring-emerald-500/20",
    }
  }

  if (ext === "pdf" || mime === "application/pdf") {
    return {
      label: "PDF",
      Icon: FileText,
      iconClassName: "text-red-500 bg-red-500/10 ring-red-500/20",
    }
  }

  return {
    label: ext ? ext.toUpperCase() : "FILE",
    Icon: File,
    iconClassName: "text-muted-foreground bg-muted ring-border",
  }
}
