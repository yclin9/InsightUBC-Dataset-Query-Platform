"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SectionsProcessor = void 0;
const jszip_1 = __importDefault(require("jszip"));
const IInsightFacade_1 = require("./IInsightFacade");
class SectionsProcessor {
    async process(content) {
        let zip;
        try {
            zip = await jszip_1.default.loadAsync(content, { base64: true });
        }
        catch {
            throw new IInsightFacade_1.InsightError("Invalid zip content");
        }
        const courseFolder = zip.folder("courses");
        if (courseFolder === null) {
            throw new IInsightFacade_1.InsightError("No courses/ folder");
        }
        const sectionPromises = [];
        courseFolder.forEach((relativePath, file) => {
            if (!file.dir) {
                const promise = file.async("string").then((fileContent) => {
                    try {
                        const json = JSON.parse(fileContent);
                        if (!Array.isArray(json.result)) {
                            return [];
                        }
                        return json.result.filter((section) => this.isValidSection(section));
                    }
                    catch {
                        return [];
                    }
                });
                sectionPromises.push(promise);
            }
        });
        const nestedSections = await Promise.all(sectionPromises);
        const validSections = nestedSections.flat();
        if (validSections.length === 0) {
            throw new IInsightFacade_1.InsightError("No valid sections found");
        }
        return validSections.map((section) => ({
            ...section,
            Year: section.Section === "overall" ? 1900 : parseInt(section.Year, 10),
            id: String(section.id),
        }));
    }
    isValidSection(section) {
        return (section.id !== undefined &&
            section.Course !== undefined &&
            section.Title !== undefined &&
            section.Professor !== undefined &&
            section.Subject !== undefined &&
            section.Year !== undefined &&
            section.Avg !== undefined &&
            section.Pass !== undefined &&
            section.Fail !== undefined &&
            section.Audit !== undefined);
    }
}
exports.SectionsProcessor = SectionsProcessor;
//# sourceMappingURL=SectionsProcessor.js.map