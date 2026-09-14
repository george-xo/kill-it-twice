export type StructuredLogFields = Record<
  string,
  string | number | boolean | null
>;

export interface StructuredLogEntry {
  timestamp: string;
  component: string;
  event: string;
  fields: StructuredLogFields;
}
