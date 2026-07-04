import {
  Filter,
  GTFilter,
  LTFilter,
  EQFilter,
  ISFilter,
  ANDFilter,
  ORFilter,
  NOTFilter,
  EmptyFilter,
} from "./Filter";
import { InsightError } from "./IInsightFacade";

export class FilterParser {
  private fieldMap: Record<string, string>;
  private mfields: string[];
  private sfields: string[];

  constructor(fieldMap: Record<string, string>) {
    this.fieldMap = fieldMap;
    this.mfields = [
      "avg",
      "pass",
      "fail",
      "audit",
      "year",
      "lat",
      "lon",
      "seats",
    ];
    this.sfields = [
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
  }

  public parse(filter: Record<string, unknown>): Filter {
    const filterKey = Object.keys(filter)[0];

    if (filterKey === undefined) {
      return new EmptyFilter();
    }

    if (filterKey === "AND") {
      const andFilters = filter[filterKey] as Record<string, unknown>[];
      if (!Array.isArray(andFilters) || andFilters.length === 0) {
        throw new InsightError("AND must have at least one filter");
      }
      return new ANDFilter(andFilters.map((f) => this.parse(f)));
    }

    if (filterKey === "OR") {
      const orFilters = filter[filterKey] as Record<string, unknown>[];
      if (!Array.isArray(orFilters) || orFilters.length === 0) {
        throw new InsightError("OR must have at least one filter");
      }
      return new ORFilter(orFilters.map((f) => this.parse(f)));
    }

    if (filterKey === "NOT") {
      const notFilter = filter[filterKey] as Record<string, unknown>;
      return new NOTFilter(this.parse(notFilter));
    }

    const filterValue = filter[filterKey] as Record<string, unknown>;
    const field = Object.keys(filterValue)[0];

    if (field === undefined) {
      throw new InsightError("Filter must have a key");
    }

    const value = filterValue[field];
    const currentField = field.split("_")[1];
    const sectionField = this.fieldMap[currentField];

    switch (filterKey) {
      case "GT":
      case "LT":
      case "EQ": {
        if (!this.mfields.includes(currentField)) {
          throw new InsightError("GT/LT/EQ can only be used on number fields");
        }
        if (typeof value !== "number") {
          throw new InsightError("GT/LT/EQ value must be a number");
        }
        if (filterKey === "GT") return new GTFilter(sectionField, value);
        if (filterKey === "LT") return new LTFilter(sectionField, value);
        return new EQFilter(sectionField, value);
      }
      case "IS": {
        if (!this.sfields.includes(currentField)) {
          throw new InsightError("IS can only be used on string fields");
        }
        if (typeof value !== "string") {
          throw new InsightError("IS value must be a string");
        }
        const stripped = value.replace(/^\*/, "").replace(/\*$/, "");
        if (stripped.includes("*")) {
          throw new InsightError("Wildcard cannot be in the middle");
        }
        return new ISFilter(sectionField, value);
      }
      default:
        throw new InsightError("Invalid filter key");
    }
  }
}
