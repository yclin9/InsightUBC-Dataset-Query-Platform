export interface DatasetProcessor {
  process(content: string): Promise<any[]>;
}
