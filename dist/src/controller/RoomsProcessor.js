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
exports.RoomsProcessor = void 0;
const jszip_1 = __importDefault(require("jszip"));
const IInsightFacade_1 = require("./IInsightFacade");
const parse5 = __importStar(require("parse5"));
class RoomsProcessor {
    async process(content) {
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
        return rooms;
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
            if (href === "" ||
                address === "" ||
                fullname === "" ||
                shortname === "") {
                continue;
            }
            buildings.push({ shortname, fullname, address, href });
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
            if (numberCell === null ||
                seatsCell === null ||
                furnitureCell === null ||
                typeCell === null) {
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
            return { lat: geo.lat, lon: geo.lon };
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
}
exports.RoomsProcessor = RoomsProcessor;
//# sourceMappingURL=RoomsProcessor.js.map