/** One bill or invoice extracted from an image (in-memory UI only). */
export type FinanceDocumentRow = {
  id: string;
  shopName: string;
  date: string;
  total: string;
  /** Summary of line items, tax, notes, etc. */
  data: string;
};

export type InvoiceExtraction = Omit<FinanceDocumentRow, "id">;
