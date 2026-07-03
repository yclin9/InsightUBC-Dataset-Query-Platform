import {
  IInsightFacade,
  InsightDataset,
  InsightDatasetKind,
  InsightResult,
  InsightError,
  NotFoundError,
  ResultTooLargeError,
} from "./IInsightFacade";
import { RoomsProcessor } from "./RoomsProcessor";
import { SectionsProcessor } from "./SectionsProcessor";
import { DatasetProcessor } from "./DatasetProcessor";
import fs from "fs-extra";
import Decimal from "decimal.js";

interface StoredDataset {
  kind: InsightDatasetKind;
  rows: any[];
  buildings?: BuildingInfo[];
}

interface BuildingInfo {
  shortname: string;
  fullname: string;
  address: string;
  href: string;
}

/**
 * This is the main programmatic entry point for the project.
 * Method documentation is in IInsightFacade
 *
 */
export default class InsightFacade implements IInsightFacade {
  private datasets: Map<string, InsightDataset> = new Map();
  private datasetLoaded = false;

  private async ensureDatasetLoaded(): Promise<void> {
    if (this.datasetLoaded) {
      return;
    }

    try {
      const files = await fs.readdir("data");

      for (const file of files) {
        if (!file.endsWith(".json")) {
          continue;
        }

        const id = file.replace(".json", "");
        const data = await fs.readJson(`data/${file}`);

        if (Array.isArray(data)) {
          this.datasets.set(id, {
            id: id,
            kind: InsightDatasetKind.Sections,
            numRows: data.length,
          });
        } else {
          const stored = data as StoredDataset;
          this.datasets.set(id, {
            id: id,
            kind: stored.kind,
            numRows: Array.isArray(stored.rows) ? stored.rows.length : 0,
          });
        }
      }
    } catch {
      // data/ doesn't exist
    }

    this.datasetLoaded = true;
  }

  public async addDataset(
    id: string,
    content: string,
    kind: InsightDatasetKind,
  ): Promise<string[]> {
    await this.ensureDatasetLoaded();

    if (id.trim() === "") {
      throw new InsightError("Invalid id: id cannot be only whitespace");
    }
    if (id.includes("_")) {
      throw new InsightError("Invalid id: id cannot include underscore");
    }

    const processor = this.getProcessor(kind);

    if (this.datasets.has(id)) {
      throw new InsightError("Dataset already exist");
    }

    const rows = await processor.process(content);

    await fs.outputJSON(`data/${id}.json`, { kind, rows });

    this.datasets.set(id, {
      id: id,
      kind: kind,
      numRows: rows.length,
    });

    return Array.from(this.datasets.keys());
  }

  private getProcessor(kind: InsightDatasetKind): DatasetProcessor {
    const processors: Record<string, DatasetProcessor> = {
      [InsightDatasetKind.Sections]: new SectionsProcessor(),
      [InsightDatasetKind.Rooms]: new RoomsProcessor(),
    };

    const processor = processors[kind];
    if (processor === undefined) {
      throw new InsightError("Invalid kind");
    }
    return processor;
  }

  public async removeDataset(id: string): Promise<string> {
    if (id.trim() === "") {
      throw new InsightError("Invalid id: id cannot be only whitespace");
    }
    if (id.includes("_")) {
      throw new InsightError("Invalid id: id cannot include underscore");
    }

    await this.ensureDatasetLoaded();

    if (!this.datasets.has(id)) {
      throw new NotFoundError("Can't find the id");
    }

    this.datasets.delete(id);
    await fs.remove(`data/${id}.json`);

    return id;
  }

  public async performQuery(query: unknown): Promise<InsightResult[]> {
    if (typeof query !== "object" || query === null || Array.isArray(query)) {
      throw new InsightError("Query must be an object");
    }

    const queryObj = query as Record<string, unknown>;

    if (queryObj["WHERE"] === undefined) {
      throw new InsightError("Query missing WHERE");
    }

    if (queryObj["OPTIONS"] === undefined) {
      throw new InsightError("Query missing OPTIONS");
    }

    const options = queryObj["OPTIONS"] as Record<string, unknown>;
    const columns = options["COLUMNS"];

    if (columns === undefined) {
      throw new InsightError("Query missing COLUMNS");
    }

    if (!Array.isArray(columns)) {
      throw new InsightError("COLUMNS must be an array");
    }

    if (columns.length === 0) {
      throw new InsightError("COLUMNS cannot be empty");
    }

    for (const col of columns) {
      if (typeof col !== "string") {
        throw new InsightError("Invalid key in COLUMNS");
      }
    }

    const transformations = queryObj["TRANSFORMATIONS"];
    let groupKeys: string[] = [];
    let applyRules: Record<string, unknown>[] = [];

    if (transformations !== undefined) {
      if (typeof transformations !== "object" || transformations === null) {
        throw new InsightError("TRANSFORMATIONS must be an object");
      }

      const transObj = transformations as Record<string, unknown>;

      // Validate GROUP
      if (!Array.isArray(transObj["GROUP"]) || transObj["GROUP"].length === 0) {
        throw new InsightError("GROUP must be a non-empty array");
      }
      groupKeys = transObj["GROUP"] as string[];
      const validFields = Object.keys(this.getFieldMap());

      for (const key of groupKeys) {
        if (!key.includes("_")) {
          throw new InsightError("GROUP key must contain underscore");
        }
        const field = key.split("_")[1];
        if (!validFields.includes(field)) {
          throw new InsightError(`Invalid field in GROUP: ${field}`);
        }
      }

      // Validate APPLY
      if (!Array.isArray(transObj["APPLY"])) {
        throw new InsightError("APPLY must be an array");
      }
      applyRules = transObj["APPLY"] as Record<string, unknown>[];

      // Check duplicate apply keys
      const applyKeys = applyRules.map((rule) => Object.keys(rule)[0]);
      if (new Set(applyKeys).size !== applyKeys.length) {
        throw new InsightError("Duplicate APPLY keys");
      }

      // Check applykey cannot contain underscore
      for (const key of applyKeys) {
        if (key.includes("_")) {
          throw new InsightError("APPLY key cannot contain underscore");
        }
      }

      // Check COLUMNS only contains GROUP keys or applykeys
      for (const col of columns) {
        if (
          !groupKeys.includes(col as string) &&
          !applyKeys.includes(col as string)
        ) {
          throw new InsightError("COLUMNS must be in GROUP or APPLY");
        }
      }
    } else {
      for (const col of columns) {
        if (!(col as string).includes("_")) {
          throw new InsightError("Invalid key in COLUMNS");
        }
      }
    }

    const order = options["ORDER"];
    if (order !== undefined) {
      if (typeof order === "string") {
        if (!columns.includes(order)) {
          throw new InsightError("ORDER must be in COLUMNS");
        }
      } else if (typeof order === "object" && order !== null) {
        const orderObj = order as Record<string, unknown>;
        const dir = orderObj["dir"];
        const keys = orderObj["keys"];
        if (dir !== "UP" && dir !== "DOWN") {
          throw new InsightError("ORDER dir must be UP or DOWN");
        }
        if (!Array.isArray(keys) || keys.length === 0) {
          throw new InsightError("ORDER keys must be a non-empty array");
        }
        for (const key of keys) {
          if (!columns.includes(key)) {
            throw new InsightError("ORDER keys must be in COLUMNS");
          }
        }
      } else {
        throw new InsightError("ORDER must be a string or object");
      }
    }

    const datasetId = (columns[0] as string).split("_")[0];

    for (const col of columns) {
      if ((col as string).includes("_")) {
        if ((col as string).split("_")[0] !== datasetId) {
          throw new InsightError("Query references multiple datasets");
        }
      }
    }

    await this.ensureDatasetLoaded();

    if (!this.datasets.has(datasetId)) {
      throw new InsightError("Dataset not found");
    }

    const sections = await this.getDatasetRows(datasetId);

    const where = queryObj["WHERE"] as Record<string, unknown>;
    const filteredSections = sections.filter((section: any) =>
      this.applyFilter(section, where),
    );

    const fieldMap = this.getFieldMap();

    let processedResults: Record<string, string | number>[];

    if (transformations !== undefined) {
      processedResults = this.applyTransformations(
        filteredSections,
        groupKeys,
        applyRules,
        columns as string[],
      );
    } else {
      if (filteredSections.length > 5000) {
        throw new ResultTooLargeError("Result too large");
      }
      processedResults = filteredSections.map((section: any) => {
        const result: Record<string, string | number> = {};
        for (const col of columns) {
          const field = (col as string).split("_")[1];
          result[col as string] = section[fieldMap[field]];
        }
        return result;
      });
    }

    if (order !== undefined) {
      if (typeof order === "string") {
        processedResults.sort((a, b) => {
          if (a[order] < b[order]) return -1;
          if (a[order] > b[order]) return 1;
          return 0;
        });
      } else {
        const orderObj = order as Record<string, unknown>;
        const dir = orderObj["dir"] as string;
        const keys = orderObj["keys"] as string[];
        processedResults.sort((a, b) => {
          for (const key of keys) {
            if (a[key] < b[key]) return dir === "UP" ? -1 : 1;
            if (a[key] > b[key]) return dir === "UP" ? 1 : -1;
          }
          return 0;
        });
      }
    }

    return processedResults;
  }

  private applyTransformations(
    sections: any[],
    groupKeys: string[],
    applyRules: Record<string, unknown>[],
    columns: string[],
  ): Record<string, string | number>[] {
    const fieldMap = this.getFieldMap();
    const mfields = [
      "avg",
      "pass",
      "fail",
      "audit",
      "year",
      "lat",
      "lon",
      "seats",
    ];

    // Group sections
    const groups = new Map<string, any[]>();
    for (const section of sections) {
      const key = groupKeys
        .map((k) => section[fieldMap[k.split("_")[1]]])
        .join("_");
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(section);
    }

    // Apply rules to each group
    const results: Record<string, string | number>[] = [];
    for (const [, group] of groups) {
      const result: Record<string, string | number> = {};

      // Add GROUP keys
      for (const key of groupKeys) {
        const field = key.split("_")[1];
        result[key] = group[0][fieldMap[field]];
      }

      // Apply APPLY rules
      for (const rule of applyRules) {
        const applyKey = Object.keys(rule)[0];
        const applyObj = rule[applyKey] as Record<string, string>;
        const token = Object.keys(applyObj)[0];
        const field = applyObj[token];
        const fieldName = fieldMap[field.split("_")[1]];
        const currentField = field.split("_")[1];

        if (token !== "COUNT" && !mfields.includes(currentField)) {
          throw new InsightError(`${token} can only be used on numeric fields`);
        }

        switch (token) {
          case "MAX":
            result[applyKey] = Math.max(...group.map((s) => s[fieldName]));
            break;
          case "MIN":
            result[applyKey] = Math.min(...group.map((s) => s[fieldName]));
            break;
          case "AVG": {
            const total = group.reduce(
              (sum, s) => sum.add(new Decimal(s[fieldName])),
              new Decimal(0),
            );
            result[applyKey] = Number(
              (total.toNumber() / group.length).toFixed(2),
            );
            break;
          }
          case "SUM": {
            const total = group.reduce(
              (sum, s) => sum.add(new Decimal(s[fieldName])),
              new Decimal(0),
            );
            result[applyKey] = Number(total.toFixed(2));
            break;
          }
          case "COUNT": {
            const unique = new Set(group.map((s) => s[fieldName]));
            result[applyKey] = unique.size;
            break;
          }
          default:
            throw new InsightError(`Invalid APPLY token: ${token}`);
        }
      }
      results.push(result);
    }

    if (results.length > 5000) {
      throw new ResultTooLargeError("Result too large");
    }

    return results;
  }

  private getFieldMap(): Record<string, string> {
    return {
      avg: "Avg",
      pass: "Pass",
      fail: "Fail",
      audit: "Audit",
      year: "Year",
      dept: "Subject",
      id: "Course",
      instructor: "Professor",
      title: "Title",
      uuid: "id",

      fullname: "fullname",
      shortname: "shortname",
      number: "number",
      name: "name",
      address: "address",
      lat: "lat",
      lon: "lon",
      seats: "seats",
      type: "type",
      furniture: "furniture",
      href: "href",
    };
  }

  private async getDatasetRows(id: string): Promise<any[]> {
    const data = await fs.readJson(`data/${id}.json`);

    if (Array.isArray(data)) {
      return data;
    }

    if (Array.isArray(data.rows)) {
      return data.rows;
    }

    return [];
  }

  private applyFilter(section: any, filter: Record<string, unknown>): boolean {
    const fieldMap = this.getFieldMap();

    const filterKey = Object.keys(filter)[0];

    if (filterKey === undefined) {
      return true;
    }

    if (filterKey === "AND") {
      const andFilters = filter[filterKey] as Record<string, unknown>[];
      if (!Array.isArray(andFilters) || andFilters.length === 0) {
        throw new InsightError("AND must have at least one filter");
      }
      return andFilters.every((f) => this.applyFilter(section, f));
    }

    if (filterKey === "OR") {
      const orFilters = filter[filterKey] as Record<string, unknown>[];
      if (!Array.isArray(orFilters) || orFilters.length === 0) {
        throw new InsightError("OR must have at least one filter");
      }
      return orFilters.some((f) => this.applyFilter(section, f));
    }

    if (filterKey === "NOT") {
      const notFilter = filter[filterKey] as Record<string, unknown>;
      return !this.applyFilter(section, notFilter);
    }

    const filterValue = filter[filterKey] as Record<string, unknown>;
    const field = Object.keys(filterValue)[0];
    if (field === undefined) {
      throw new InsightError("Filter must have a key");
    }
    const value = filterValue[field];
    const sectionField = fieldMap[field.split("_")[1]];

    const mfields = [
      "avg",
      "pass",
      "fail",
      "audit",
      "year",
      "lat",
      "lon",
      "seats",
    ];
    const sfields = [
      "dept",
      "id",
      "instructor",
      "title",
      "uuid",
      "fullname",
      "shortname",
      "number",
      "name",
      "address",
      "type",
      "furniture",
      "href",
    ];
    const currentField = field.split("_")[1];

    switch (filterKey) {
      case "GT":
      case "LT":
      case "EQ": {
        if (!mfields.includes(currentField)) {
          throw new InsightError("GT/LT/EQ can only be used on number fields");
        }
        if (typeof value !== "number") {
          throw new InsightError("GT/LT/EQ value must be a number");
        }
        if (filterKey === "GT")
          return section[sectionField] > (value as number);
        if (filterKey === "LT")
          return section[sectionField] < (value as number);
        return section[sectionField] === (value as number);
      }
      case "IS": {
        if (!sfields.includes(currentField)) {
          throw new InsightError("IS can only be used on string fields");
        }
        if (typeof value !== "string") {
          throw new InsightError("IS value must be a number");
        }
        const innerValue = (value as string).slice(1, -1);
        if (innerValue.includes("*")) {
          throw new InsightError("Wildcard cannot be in the middle");
        }
        return this.applyIS(section[sectionField], value as string);
      }
      case "AND": {
        const andFilters = filter[filterKey] as Record<string, unknown>[];
        return andFilters.every((f) => this.applyFilter(section, f));
      }
      case "OR": {
        const orFilters = filter[filterKey] as Record<string, unknown>[];
        return orFilters.some((f) => this.applyFilter(section, f));
      }
      case "NOT":
        return !this.applyFilter(section, filterValue);
      default:
        throw new InsightError("Invalid filter key");
    }
  }

  private applyIS(sectionValue: string, pattern: string): boolean {
    if (pattern.startsWith("*") && pattern.endsWith("*")) {
      return sectionValue.includes(pattern.slice(1, -1));
    } else if (pattern.startsWith("*")) {
      return sectionValue.endsWith(pattern.slice(1));
    } else if (pattern.endsWith("*")) {
      return sectionValue.startsWith(pattern.slice(0, -1));
    } else {
      return sectionValue === pattern;
    }
  }

  public async listDatasets(): Promise<InsightDataset[]> {
    await this.ensureDatasetLoaded();
    return Array.from(this.datasets.values());
  }
}
