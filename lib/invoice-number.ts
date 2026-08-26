export function formatInvoiceNumber(sequence: number, date = new Date(), prefix = "WZXU"): string {
  const year = date.getFullYear();
  const paddedSequence = String(sequence).padStart(4, "0");
  return `${prefix}-${year}-${paddedSequence}`;
}
