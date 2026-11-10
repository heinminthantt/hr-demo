// Self-check for CSV escaping: `npm run check:csv` in apps/web
import { toCsv } from "../lib/csv.ts"

let failed = 0
function eq(actual: unknown, expected: unknown, label: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    failed++
    console.error(`FAIL ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  } else {
    console.log(`ok   ${label}`)
  }
}

eq(toCsv(["name", "amount"], [["Aung Ko", 900000]]), "name,amount\r\nAung Ko,900000", "plain cells")
eq(toCsv(["name"], [['A, "B"']]), 'name\r\n"A, ""B"""', "quotes and commas")
eq(toCsv(["note"], [["line 1\nline 2"]]), 'note\r\n"line 1\nline 2"', "newlines")
eq(toCsv(["value"], [[null], [undefined], [true]]), "value\r\n\r\n\r\ntrue", "empty and boolean")

if (failed) {
  console.error(`${failed} CSV check(s) failed`)
  process.exit(1)
}
console.log("\nAll CSV checks passed")
