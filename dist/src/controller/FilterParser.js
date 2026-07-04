"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FilterParser = void 0;
const Filter_1 = require("./Filter");
const IInsightFacade_1 = require("./IInsightFacade");
class FilterParser {
    fieldMap;
    mfields;
    sfields;
    constructor(fieldMap) {
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
    parse(filter) {
        const filterKey = Object.keys(filter)[0];
        if (filterKey === undefined) {
            return new Filter_1.EmptyFilter();
        }
        if (filterKey === "AND") {
            const andFilters = filter[filterKey];
            if (!Array.isArray(andFilters) || andFilters.length === 0) {
                throw new IInsightFacade_1.InsightError("AND must have at least one filter");
            }
            return new Filter_1.ANDFilter(andFilters.map((f) => this.parse(f)));
        }
        if (filterKey === "OR") {
            const orFilters = filter[filterKey];
            if (!Array.isArray(orFilters) || orFilters.length === 0) {
                throw new IInsightFacade_1.InsightError("OR must have at least one filter");
            }
            return new Filter_1.ORFilter(orFilters.map((f) => this.parse(f)));
        }
        if (filterKey === "NOT") {
            const notFilter = filter[filterKey];
            return new Filter_1.NOTFilter(this.parse(notFilter));
        }
        const filterValue = filter[filterKey];
        const field = Object.keys(filterValue)[0];
        if (field === undefined) {
            throw new IInsightFacade_1.InsightError("Filter must have a key");
        }
        const value = filterValue[field];
        const currentField = field.split("_")[1];
        const sectionField = this.fieldMap[currentField];
        switch (filterKey) {
            case "GT":
            case "LT":
            case "EQ": {
                if (!this.mfields.includes(currentField)) {
                    throw new IInsightFacade_1.InsightError("GT/LT/EQ can only be used on number fields");
                }
                if (typeof value !== "number") {
                    throw new IInsightFacade_1.InsightError("GT/LT/EQ value must be a number");
                }
                if (filterKey === "GT")
                    return new Filter_1.GTFilter(sectionField, value);
                if (filterKey === "LT")
                    return new Filter_1.LTFilter(sectionField, value);
                return new Filter_1.EQFilter(sectionField, value);
            }
            case "IS": {
                if (!this.sfields.includes(currentField)) {
                    throw new IInsightFacade_1.InsightError("IS can only be used on string fields");
                }
                if (typeof value !== "string") {
                    throw new IInsightFacade_1.InsightError("IS value must be a string");
                }
                const stripped = value.replace(/^\*/, "").replace(/\*$/, "");
                if (stripped.includes("*")) {
                    throw new IInsightFacade_1.InsightError("Wildcard cannot be in the middle");
                }
                return new Filter_1.ISFilter(sectionField, value);
            }
            default:
                throw new IInsightFacade_1.InsightError("Invalid filter key");
        }
    }
}
exports.FilterParser = FilterParser;
//# sourceMappingURL=FilterParser.js.map