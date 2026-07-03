"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jszip_1 = __importDefault(require("jszip"));
const IInsightFacade_1 = require("./IInsightFacade");
const fs_extra_1 = __importDefault(require("fs-extra"));
const decimal_js_1 = __importDefault(require("decimal.js"));
const parse5 = __importStar(require("parse5"));
class InsightFacade {
    datasets = new Map();
    datasetLoaded = false;
    async ensureDatasetLoaded() {
        if (this.datasetLoaded) {
            return;
        }
        try {
            const files = await fs_extra_1.default.readdir("data");
            for (const file of files) {
                if (!file.endsWith(".json")) {
                    continue;
                }
                const id = file.replace(".json", "");
                const data = await fs_extra_1.default.readJson(`data/${file}`);
                if (Array.isArray(data)) {
                    this.datasets.set(id, {
                        id: id,
                        kind: IInsightFacade_1.InsightDatasetKind.Sections,
                        numRows: data.length,
                    });
                }
                else {
                    const stored = data;
                    this.datasets.set(id, {
                        id: id,
                        kind: stored.kind,
                        numRows: Array.isArray(stored.rows) ? stored.rows.length : 0,
                    });
                }
            }
        }
        catch {
        }
        this.datasetLoaded = true;
    }
    async addDataset(id, content, kind) {
        await this.ensureDatasetLoaded();
        if (id.trim() === "") {
            throw new IInsightFacade_1.InsightError("Invalid id: id cannot be only whitespace");
        }
        if (id.includes("_")) {
            throw new IInsightFacade_1.InsightError("Invalid id: id cannot include underscore");
        }
        if (kind !== IInsightFacade_1.InsightDatasetKind.Sections && kind !== IInsightFacade_1.InsightDatasetKind.Rooms) {
            throw new IInsightFacade_1.InsightError("Invalid kind");
        }
        if (this.datasets.has(id)) {
            throw new IInsightFacade_1.InsightError("Dataset already exist");
        }
        if (kind === IInsightFacade_1.InsightDatasetKind.Rooms) {
            return this.addRoomsDataset(id, content, kind);
        }
        let zip;
        try {
            zip = await jszip_1.default.loadAsync(content, { base64: true });
        }
        catch (err) {
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
        const processedSections = validSections.map((section) => ({
            ...section,
            Year: section.Section === "overall" ? 1900 : parseInt(section.Year, 10),
            id: String(section.id),
        }));
        await fs_extra_1.default.outputJSON(`data/${id}.json`, processedSections);
        this.datasets.set(id, {
            id: id,
            kind: kind,
            numRows: validSections.length,
        });
        return Array.from(this.datasets.keys());
    }
    async addRoomsDataset(id, content, kind) {
        let zip;
        try {
            zip = await jszip_1.default.loadAsync(content, { base64: true });
        }
        catch {
            throw new IInsightFacade_1.InsightError("Invalid zip content");
        }
        const indexFile = zip.file("index.htm");
        if (indexFile === null) {
            throw new IInsightFacade_1.InsightError("Missing index.htm");
        }
        const indexContent = await indexFile.async("string");
        const indexDocument = parse5.parse(indexContent);
        const buildings = this.extractBuildingsFromIndex(indexDocument);
        if (buildings.length === 0) {
            throw new IInsightFacade_1.InsightError("No valid buildings found");
        }
        const rooms = [];
        for (const building of buildings) {
            const buildingPath = this.normalizeBuildingPath(building.href);
            const buildingFile = zip.file(buildingPath);
            if (buildingFile === null) {
                continue;
            }
            const buildingContent = await buildingFile.async("string");
            const buildingDocument = parse5.parse(buildingContent);
            const roomCandidates = this.extractRoomsFromBuilding(buildingDocument, building);
            if (roomCandidates.length === 0) {
                continue;
            }
            const geo = await this.getGeolocation(building.address);
            if (geo === null) {
                continue;
            }
            for (const room of roomCandidates) {
                rooms.push({
                    ...room,
                    lat: geo.lat,
                    lon: geo.lon,
                });
            }
        }
        if (rooms.length === 0) {
            throw new IInsightFacade_1.InsightError("No valid rooms found");
        }
        await fs_extra_1.default.outputJSON(`data/${id}.json`, {
            kind: kind,
            buildings: buildings,
            rows: rooms,
        });
        this.datasets.set(id, {
            id: id,
            kind: kind,
            numRows: rooms.length,
        });
        return Array.from(this.datasets.keys());
    }
    extractBuildingsFromIndex(document) {
        const rows = this.findAllNodes(document, "tr");
        const buildings = [];
        for (const row of rows) {
            const titleCell = this.findFirstNodeWithClass(row, "td", "views-field-title");
            const addressCell = this.findFirstNodeWithClass(row, "td", "views-field-field-building-address");
            const codeCell = this.findFirstNodeWithClass(row, "td", "views-field-field-building-code");
            if (titleCell === null || addressCell === null) {
                continue;
            }
            const link = this.findFirstNode(titleCell, "a");
            if (link === null) {
                continue;
            }
            const href = this.getAttribute(link, "href");
            const address = this.getText(addressCell).trim();
            const fullname = this.getText(titleCell).trim();
            let shortname = "";
            if (codeCell !== null) {
                shortname = this.getText(codeCell).trim();
            }
            else {
                shortname = this.getText(link).trim();
            }
            if (href === "" || address === "" || fullname === "" || shortname === "") {
                continue;
            }
            buildings.push({
                shortname,
                fullname,
                address,
                href,
            });
        }
        return buildings;
    }
    extractRoomsFromBuilding(document, building) {
        const rows = this.findAllNodes(document, "tr");
        const rooms = [];
        for (const row of rows) {
            const numberCell = this.findFirstNodeWithClass(row, "td", "views-field-field-room-number");
            const seatsCell = this.findFirstNodeWithClass(row, "td", "views-field-field-room-capacity");
            const furnitureCell = this.findFirstNodeWithClass(row, "td", "views-field-field-room-furniture");
            const typeCell = this.findFirstNodeWithClass(row, "td", "views-field-field-room-type");
            if (numberCell === null || seatsCell === null || furnitureCell === null || typeCell === null) {
                continue;
            }
            const number = this.getText(numberCell).trim();
            const seatsText = this.getText(seatsCell).trim();
            const furniture = this.getText(furnitureCell).trim();
            const type = this.getText(typeCell).trim();
            const seats = Number(seatsText);
            if (Number.isNaN(seats)) {
                continue;
            }
            const link = this.findFirstNode(numberCell, "a");
            const href = link === null ? "" : this.getAttribute(link, "href");
            rooms.push({
                fullname: building.fullname,
                shortname: building.shortname,
                number: number,
                name: `${building.shortname}_${number}`,
                address: building.address,
                lat: 0,
                lon: 0,
                seats: seats,
                type: type,
                furniture: furniture,
                href: href,
            });
        }
        return rooms;
    }
    normalizeBuildingPath(href) {
        return href.replace(/^\.\//, "").replace(/^\/+/, "");
    }
    async getGeolocation(address) {
        const encodedAddress = encodeURIComponent(address);
        const url = `http://cs310.students.cs.ubc.ca:11316/api/v1/project_team078/${encodedAddress}`;
        try {
            const response = await fetch(url);
            if (!response.ok) {
                return null;
            }
            const geo = (await response.json());
            if (typeof geo.lat !== "number" || typeof geo.lon !== "number") {
                return null;
            }
            return {
                lat: geo.lat,
                lon: geo.lon,
            };
        }
        catch {
            return null;
        }
    }
    findAllNodes(node, tagName) {
        const result = [];
        if (node.tagName === tagName) {
            result.push(node);
        }
        if (node.childNodes !== undefined) {
            for (const child of node.childNodes) {
                result.push(...this.findAllNodes(child, tagName));
            }
        }
        return result;
    }
    findFirstNode(node, tagName) {
        if (node.tagName === tagName) {
            return node;
        }
        if (node.childNodes !== undefined) {
            for (const child of node.childNodes) {
                const found = this.findFirstNode(child, tagName);
                if (found !== null) {
                    return found;
                }
            }
        }
        return null;
    }
    findFirstNodeWithClass(node, tagName, className) {
        if (node.tagName === tagName && this.hasClass(node, className)) {
            return node;
        }
        if (node.childNodes !== undefined) {
            for (const child of node.childNodes) {
                const found = this.findFirstNodeWithClass(child, tagName, className);
                if (found !== null) {
                    return found;
                }
            }
        }
        return null;
    }
    hasClass(node, className) {
        const classAttr = this.getAttribute(node, "class");
        return classAttr.split(/\s+/).includes(className);
    }
    getAttribute(node, attrName) {
        if (node.attrs === undefined) {
            return "";
        }
        const attr = node.attrs.find((a) => a.name === attrName);
        return attr === undefined ? "" : attr.value;
    }
    getText(node) {
        let text = "";
        if (node.nodeName === "#text" && typeof node.value === "string") {
            text += node.value;
        }
        if (node.childNodes !== undefined) {
            for (const child of node.childNodes) {
                text += this.getText(child);
            }
        }
        return text;
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
    async removeDataset(id) {
        if (id.trim() === "") {
            throw new IInsightFacade_1.InsightError("Invalid id: id cannot be only whitespace");
        }
        if (id.includes("_")) {
            throw new IInsightFacade_1.InsightError("Invalid id: id cannot include underscore");
        }
        await this.ensureDatasetLoaded();
        if (!this.datasets.has(id)) {
            throw new IInsightFacade_1.NotFoundError("Can't find the id");
        }
        this.datasets.delete(id);
        await fs_extra_1.default.remove(`data/${id}.json`);
        return id;
    }
    async performQuery(query) {
        if (typeof query !== "object" || query === null || Array.isArray(query)) {
            throw new IInsightFacade_1.InsightError("Query must be an object");
        }
        const queryObj = query;
        if (queryObj["WHERE"] === undefined) {
            throw new IInsightFacade_1.InsightError("Query missing WHERE");
        }
        if (queryObj["OPTIONS"] === undefined) {
            throw new IInsightFacade_1.InsightError("Query missing OPTIONS");
        }
        const options = queryObj["OPTIONS"];
        const columns = options["COLUMNS"];
        if (columns === undefined) {
            throw new IInsightFacade_1.InsightError("Query missing COLUMNS");
        }
        if (!Array.isArray(columns)) {
            throw new IInsightFacade_1.InsightError("COLUMNS must be an array");
        }
        if (columns.length === 0) {
            throw new IInsightFacade_1.InsightError("COLUMNS cannot be empty");
        }
        for (const col of columns) {
            if (typeof col !== "string") {
                throw new IInsightFacade_1.InsightError("Invalid key in COLUMNS");
            }
        }
        const transformations = queryObj["TRANSFORMATIONS"];
        let groupKeys = [];
        let applyRules = [];
        if (transformations !== undefined) {
            if (typeof transformations !== "object" || transformations === null) {
                throw new IInsightFacade_1.InsightError("TRANSFORMATIONS must be an object");
            }
            const transObj = transformations;
            if (!Array.isArray(transObj["GROUP"]) || transObj["GROUP"].length === 0) {
                throw new IInsightFacade_1.InsightError("GROUP must be a non-empty array");
            }
            groupKeys = transObj["GROUP"];
            const validFields = Object.keys(this.getFieldMap());
            for (const key of groupKeys) {
                if (!key.includes("_")) {
                    throw new IInsightFacade_1.InsightError("GROUP key must contain underscore");
                }
                const field = key.split("_")[1];
                if (!validFields.includes(field)) {
                    throw new IInsightFacade_1.InsightError(`Invalid field in GROUP: ${field}`);
                }
            }
            if (!Array.isArray(transObj["APPLY"])) {
                throw new IInsightFacade_1.InsightError("APPLY must be an array");
            }
            applyRules = transObj["APPLY"];
            const applyKeys = applyRules.map((rule) => Object.keys(rule)[0]);
            if (new Set(applyKeys).size !== applyKeys.length) {
                throw new IInsightFacade_1.InsightError("Duplicate APPLY keys");
            }
            for (const key of applyKeys) {
                if (key.includes("_")) {
                    throw new IInsightFacade_1.InsightError("APPLY key cannot contain underscore");
                }
            }
            for (const col of columns) {
                if (!groupKeys.includes(col) && !applyKeys.includes(col)) {
                    throw new IInsightFacade_1.InsightError("COLUMNS must be in GROUP or APPLY");
                }
            }
        }
        else {
            for (const col of columns) {
                if (!col.includes("_")) {
                    throw new IInsightFacade_1.InsightError("Invalid key in COLUMNS");
                }
            }
        }
        const order = options["ORDER"];
        if (order !== undefined) {
            if (typeof order === "string") {
                if (!columns.includes(order)) {
                    throw new IInsightFacade_1.InsightError("ORDER must be in COLUMNS");
                }
            }
            else if (typeof order === "object" && order !== null) {
                const orderObj = order;
                const dir = orderObj["dir"];
                const keys = orderObj["keys"];
                if (dir !== "UP" && dir !== "DOWN") {
                    throw new IInsightFacade_1.InsightError("ORDER dir must be UP or DOWN");
                }
                if (!Array.isArray(keys) || keys.length === 0) {
                    throw new IInsightFacade_1.InsightError("ORDER keys must be a non-empty array");
                }
                for (const key of keys) {
                    if (!columns.includes(key)) {
                        throw new IInsightFacade_1.InsightError("ORDER keys must be in COLUMNS");
                    }
                }
            }
            else {
                throw new IInsightFacade_1.InsightError("ORDER must be a string or object");
            }
        }
        const datasetId = columns[0].split("_")[0];
        for (const col of columns) {
            if (col.includes("_")) {
                if (col.split("_")[0] !== datasetId) {
                    throw new IInsightFacade_1.InsightError("Query references multiple datasets");
                }
            }
        }
        await this.ensureDatasetLoaded();
        if (!this.datasets.has(datasetId)) {
            throw new IInsightFacade_1.InsightError("Dataset not found");
        }
        const sections = await this.getDatasetRows(datasetId);
        const where = queryObj["WHERE"];
        const filteredSections = sections.filter((section) => this.applyFilter(section, where));
        const fieldMap = this.getFieldMap();
        let processedResults;
        if (transformations !== undefined) {
            processedResults = this.applyTransformations(filteredSections, groupKeys, applyRules, columns);
        }
        else {
            if (filteredSections.length > 5000) {
                throw new IInsightFacade_1.ResultTooLargeError("Result too large");
            }
            processedResults = filteredSections.map((section) => {
                const result = {};
                for (const col of columns) {
                    const field = col.split("_")[1];
                    result[col] = section[fieldMap[field]];
                }
                return result;
            });
        }
        if (order !== undefined) {
            if (typeof order === "string") {
                processedResults.sort((a, b) => {
                    if (a[order] < b[order])
                        return -1;
                    if (a[order] > b[order])
                        return 1;
                    return 0;
                });
            }
            else {
                const orderObj = order;
                const dir = orderObj["dir"];
                const keys = orderObj["keys"];
                processedResults.sort((a, b) => {
                    for (const key of keys) {
                        if (a[key] < b[key])
                            return dir === "UP" ? -1 : 1;
                        if (a[key] > b[key])
                            return dir === "UP" ? 1 : -1;
                    }
                    return 0;
                });
            }
        }
        return processedResults;
    }
    applyTransformations(sections, groupKeys, applyRules, columns) {
        const fieldMap = this.getFieldMap();
        const mfields = ["avg", "pass", "fail", "audit", "year", "lat", "lon", "seats"];
        const groups = new Map();
        for (const section of sections) {
            const key = groupKeys.map((k) => section[fieldMap[k.split("_")[1]]]).join("_");
            if (!groups.has(key)) {
                groups.set(key, []);
            }
            groups.get(key).push(section);
        }
        const results = [];
        for (const [, group] of groups) {
            const result = {};
            for (const key of groupKeys) {
                const field = key.split("_")[1];
                result[key] = group[0][fieldMap[field]];
            }
            for (const rule of applyRules) {
                const applyKey = Object.keys(rule)[0];
                const applyObj = rule[applyKey];
                const token = Object.keys(applyObj)[0];
                const field = applyObj[token];
                const fieldName = fieldMap[field.split("_")[1]];
                const currentField = field.split("_")[1];
                if (token !== "COUNT" && !mfields.includes(currentField)) {
                    throw new IInsightFacade_1.InsightError(`${token} can only be used on numeric fields`);
                }
                switch (token) {
                    case "MAX":
                        result[applyKey] = Math.max(...group.map((s) => s[fieldName]));
                        break;
                    case "MIN":
                        result[applyKey] = Math.min(...group.map((s) => s[fieldName]));
                        break;
                    case "AVG": {
                        const total = group.reduce((sum, s) => sum.add(new decimal_js_1.default(s[fieldName])), new decimal_js_1.default(0));
                        result[applyKey] = Number((total.toNumber() / group.length).toFixed(2));
                        break;
                    }
                    case "SUM": {
                        const total = group.reduce((sum, s) => sum.add(new decimal_js_1.default(s[fieldName])), new decimal_js_1.default(0));
                        result[applyKey] = Number(total.toFixed(2));
                        break;
                    }
                    case "COUNT": {
                        const unique = new Set(group.map((s) => s[fieldName]));
                        result[applyKey] = unique.size;
                        break;
                    }
                    default:
                        throw new IInsightFacade_1.InsightError(`Invalid APPLY token: ${token}`);
                }
            }
            results.push(result);
        }
        if (results.length > 5000) {
            throw new IInsightFacade_1.ResultTooLargeError("Result too large");
        }
        return results;
    }
    getFieldMap() {
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
    async getDatasetRows(id) {
        const data = await fs_extra_1.default.readJson(`data/${id}.json`);
        if (Array.isArray(data)) {
            return data;
        }
        if (Array.isArray(data.rows)) {
            return data.rows;
        }
        return [];
    }
    applyFilter(section, filter) {
        const fieldMap = this.getFieldMap();
        const filterKey = Object.keys(filter)[0];
        if (filterKey === undefined) {
            return true;
        }
        if (filterKey === "AND") {
            const andFilters = filter[filterKey];
            if (!Array.isArray(andFilters) || andFilters.length === 0) {
                throw new IInsightFacade_1.InsightError("AND must have at least one filter");
            }
            return andFilters.every((f) => this.applyFilter(section, f));
        }
        if (filterKey === "OR") {
            const orFilters = filter[filterKey];
            if (!Array.isArray(orFilters) || orFilters.length === 0) {
                throw new IInsightFacade_1.InsightError("OR must have at least one filter");
            }
            return orFilters.some((f) => this.applyFilter(section, f));
        }
        if (filterKey === "NOT") {
            const notFilter = filter[filterKey];
            return !this.applyFilter(section, notFilter);
        }
        const filterValue = filter[filterKey];
        const field = Object.keys(filterValue)[0];
        if (field === undefined) {
            throw new IInsightFacade_1.InsightError("Filter must have a key");
        }
        const value = filterValue[field];
        const sectionField = fieldMap[field.split("_")[1]];
        const mfields = ["avg", "pass", "fail", "audit", "year", "lat", "lon", "seats"];
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
                    throw new IInsightFacade_1.InsightError("GT/LT/EQ can only be used on number fields");
                }
                if (typeof value !== "number") {
                    throw new IInsightFacade_1.InsightError("GT/LT/EQ value must be a number");
                }
                if (filterKey === "GT")
                    return section[sectionField] > value;
                if (filterKey === "LT")
                    return section[sectionField] < value;
                return section[sectionField] === value;
            }
            case "IS": {
                if (!sfields.includes(currentField)) {
                    throw new IInsightFacade_1.InsightError("IS can only be used on string fields");
                }
                if (typeof value !== "string") {
                    throw new IInsightFacade_1.InsightError("IS value must be a number");
                }
                const innerValue = value.slice(1, -1);
                if (innerValue.includes("*")) {
                    throw new IInsightFacade_1.InsightError("Wildcard cannot be in the middle");
                }
                return this.applyIS(section[sectionField], value);
            }
            case "AND": {
                const andFilters = filter[filterKey];
                return andFilters.every((f) => this.applyFilter(section, f));
            }
            case "OR": {
                const orFilters = filter[filterKey];
                return orFilters.some((f) => this.applyFilter(section, f));
            }
            case "NOT":
                return !this.applyFilter(section, filterValue);
            default:
                throw new IInsightFacade_1.InsightError("Invalid filter key");
        }
    }
    applyIS(sectionValue, pattern) {
        if (pattern.startsWith("*") && pattern.endsWith("*")) {
            return sectionValue.includes(pattern.slice(1, -1));
        }
        else if (pattern.startsWith("*")) {
            return sectionValue.endsWith(pattern.slice(1));
        }
        else if (pattern.endsWith("*")) {
            return sectionValue.startsWith(pattern.slice(0, -1));
        }
        else {
            return sectionValue === pattern;
        }
    }
    async listDatasets() {
        await this.ensureDatasetLoaded();
        return Array.from(this.datasets.values());
    }
}
exports.default = InsightFacade;
//# sourceMappingURL=InsightFacade.js.map