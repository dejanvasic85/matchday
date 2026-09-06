// Column-aligned plain-text tables, shared by every `mday` read command's renderer. Layout only:
// what each column says stays with the command that prints it.

const columnGap = "  ";

/** Placeholder for a cell with nothing to show, so an empty column still lines up. */
export const emptyCell = "-";

function padRow(cells: string[], widths: number[]): string {
  return cells
    .map((cell, index) => (index === cells.length - 1 ? cell : cell.padEnd(widths[index] ?? 0)))
    .join(columnGap)
    .trimEnd();
}

/** Widths come from the header and every body row, so a long value widens its column rather than
 * pushing the rest of the line out of alignment. */
export function renderTable(header: string[], body: string[][]): string {
  const rows = [header, ...body];
  const widths = header.map((_, index) =>
    Math.max(...rows.map((row) => (row[index] ?? "").length)),
  );
  return rows.map((row) => padRow(row, widths)).join("\n");
}
