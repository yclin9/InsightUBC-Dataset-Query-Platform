import JSZip from "jszip";
import { InsightError } from "./IInsightFacade";
import { DatasetProcessor } from "./DatasetProcessor";

export class SectionsProcessor implements DatasetProcessor {
  public async process(content: string): Promise<any[]> {
    let zip: JSZip;
    try {
      zip = await JSZip.loadAsync(content, { base64: true });
    } catch {
      throw new InsightError("Invalid zip content");
    }

    const courseFolder = zip.folder("courses");
    if (courseFolder === null) {
      throw new InsightError("No courses/ folder");
    }

    const sectionPromises: Promise<any[]>[] = [];

    courseFolder.forEach((relativePath, file) => {
      if (!file.dir) {
        const promise = file.async("string").then((fileContent) => {
          try {
            const json = JSON.parse(fileContent);
            if (!Array.isArray(json.result)) {
              return [];
            }
            return json.result.filter((section: any) =>
              this.isValidSection(section),
            );
          } catch {
            return [];
          }
        });
        sectionPromises.push(promise);
      }
    });

    const nestedSections = await Promise.all(sectionPromises);
    const validSections = nestedSections.flat();

    if (validSections.length === 0) {
      throw new InsightError("No valid sections found");
    }

    return validSections.map((section: any) => ({
      ...section,
      Year: section.Section === "overall" ? 1900 : parseInt(section.Year, 10),
      id: String(section.id),
    }));
  }

  private isValidSection(section: any): boolean {
    return (
      section.id !== undefined &&
      section.Course !== undefined &&
      section.Title !== undefined &&
      section.Professor !== undefined &&
      section.Subject !== undefined &&
      section.Year !== undefined &&
      section.Avg !== undefined &&
      section.Pass !== undefined &&
      section.Fail !== undefined &&
      section.Audit !== undefined
    );
  }
}
