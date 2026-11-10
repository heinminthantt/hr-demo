export type CsvValue = string | number | boolean | null | undefined

function csvCell(value: CsvValue) {
  const text = String(value ?? "")
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function toCsv(header: string[], rows: CsvValue[][]) {
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")
}

export function downloadCsv(filename: string, header: string[], rows: CsvValue[][]) {
  const blob = new Blob(["\uFEFF", toCsv(header, rows)], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
