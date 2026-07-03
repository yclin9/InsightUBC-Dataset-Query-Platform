import JSZip from "jszip";
import { InsightError } from "./IInsightFacade";
import * as parse5 from "parse5";
import { DatasetProcessor } from "./DatasetProcessor";

type HtmlNode = any;

interface RoomInfo {
  fullname: string;
  shortname: string;
  number: string;
  name: string;
  address: string;
  lat: number;
  lon: number;
  seats: number;
  type: string;
  furniture: string;
  href: string;
}

interface BuildingInfo {
  shortname: string;
  fullname: string;
  address: string;
  href: string;
}

interface GeoResponse {
  lat?: number;
  lon?: number;
  error?: string;
}

export class RoomsProcessor implements DatasetProcessor {
  public async process(content: string): Promise<RoomInfo[]> {
    let zip: JSZip;

    try {
      zip = await JSZip.loadAsync(content, { base64: true });
    } catch {
      throw new InsightError("Invalid zip content");
    }

    const indexFile = zip.file("index.htm");
    if (indexFile === null) {
      throw new InsightError("Missing index.htm");
    }

    const indexContent = await indexFile.async("string");
    const indexDocument = parse5.parse(indexContent);
    const buildings = this.extractBuildingsFromIndex(indexDocument);

    if (buildings.length === 0) {
      throw new InsightError("No valid buildings found");
    }

    const rooms: RoomInfo[] = [];

    for (const building of buildings) {
      const buildingPath = this.normalizeBuildingPath(building.href);
      const buildingFile = zip.file(buildingPath);

      if (buildingFile === null) {
        continue;
      }

      const buildingContent = await buildingFile.async("string");
      const buildingDocument = parse5.parse(buildingContent);
      const roomCandidates = this.extractRoomsFromBuilding(
        buildingDocument,
        building,
      );

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
      throw new InsightError("No valid rooms found");
    }

    return rooms;
  }

  private extractBuildingsFromIndex(document: HtmlNode): BuildingInfo[] {
    const rows = this.findAllNodes(document, "tr");
    const buildings: BuildingInfo[] = [];

    for (const row of rows) {
      const titleCell = this.findFirstNodeWithClass(
        row,
        "td",
        "views-field-title",
      );
      const addressCell = this.findFirstNodeWithClass(
        row,
        "td",
        "views-field-field-building-address",
      );
      const codeCell = this.findFirstNodeWithClass(
        row,
        "td",
        "views-field-field-building-code",
      );

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
      } else {
        shortname = this.getText(link).trim();
      }

      if (
        href === "" ||
        address === "" ||
        fullname === "" ||
        shortname === ""
      ) {
        continue;
      }

      buildings.push({ shortname, fullname, address, href });
    }

    return buildings;
  }

  private extractRoomsFromBuilding(
    document: HtmlNode,
    building: BuildingInfo,
  ): RoomInfo[] {
    const rows = this.findAllNodes(document, "tr");
    const rooms: RoomInfo[] = [];

    for (const row of rows) {
      const numberCell = this.findFirstNodeWithClass(
        row,
        "td",
        "views-field-field-room-number",
      );
      const seatsCell = this.findFirstNodeWithClass(
        row,
        "td",
        "views-field-field-room-capacity",
      );
      const furnitureCell = this.findFirstNodeWithClass(
        row,
        "td",
        "views-field-field-room-furniture",
      );
      const typeCell = this.findFirstNodeWithClass(
        row,
        "td",
        "views-field-field-room-type",
      );

      if (
        numberCell === null ||
        seatsCell === null ||
        furnitureCell === null ||
        typeCell === null
      ) {
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

  private normalizeBuildingPath(href: string): string {
    return href.replace(/^\.\//, "").replace(/^\/+/, "");
  }

  private async getGeolocation(
    address: string,
  ): Promise<{ lat: number; lon: number } | null> {
    const encodedAddress = encodeURIComponent(address);
    const url = `http://cs310.students.cs.ubc.ca:11316/api/v1/project_team078/${encodedAddress}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        return null;
      }

      const geo = (await response.json()) as GeoResponse;

      if (typeof geo.lat !== "number" || typeof geo.lon !== "number") {
        return null;
      }

      return { lat: geo.lat, lon: geo.lon };
    } catch {
      return null;
    }
  }

  private findAllNodes(node: HtmlNode, tagName: string): HtmlNode[] {
    const result: HtmlNode[] = [];
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

  private findFirstNode(node: HtmlNode, tagName: string): HtmlNode | null {
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

  private findFirstNodeWithClass(
    node: HtmlNode,
    tagName: string,
    className: string,
  ): HtmlNode | null {
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

  private hasClass(node: HtmlNode, className: string): boolean {
    const classAttr = this.getAttribute(node, "class");
    return classAttr.split(/\s+/).includes(className);
  }

  private getAttribute(node: HtmlNode, attrName: string): string {
    if (node.attrs === undefined) {
      return "";
    }
    const attr = node.attrs.find(
      (a: { name: string; value: string }) => a.name === attrName,
    );
    return attr === undefined ? "" : attr.value;
  }

  private getText(node: HtmlNode): string {
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
