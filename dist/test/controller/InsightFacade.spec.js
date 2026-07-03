"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jszip_1 = __importDefault(require("jszip"));
const IInsightFacade_1 = require("../../src/controller/IInsightFacade");
const InsightFacade_1 = __importDefault(require("../../src/controller/InsightFacade"));
const TestUtil_1 = require("../TestUtil");
const chai_1 = require("chai");
const chai_as_promised_1 = __importDefault(require("chai-as-promised"));
(0, chai_1.use)(chai_as_promised_1.default);
describe("InsightFacade", function () {
    let facade;
    let sections;
    let noCoursesFolder;
    let invalidSection;
    let validSection;
    let smallDataset;
    async function makeRoomsDatasetZip(options) {
        const zip = new jszip_1.default();
        if (options?.missingIndex) {
            zip.file("some-file.htm", "<html></html>");
            return zip.generateAsync({ type: "base64" });
        }
        if (options?.invalidIndex) {
            zip.file("index.htm", "<html><body><table><tr><td>bad row</td></tr></table></body></html>");
            return zip.generateAsync({ type: "base64" });
        }
        const buildingPath = "campus/discover/buildings-and-classrooms/DMP.htm";
        const codeCell = `<td class="views-field views-field-field-building-code">DMP</td>`;
        const indexHtml = `
		<html>
			<body>
				<table>
					<tr>
						<td class="views-field views-field-title">
							<a href="./${buildingPath}">DMP</a>
						</td>
						<td class="views-field views-field-field-building-address">
							6245 Agronomy Road
						</td>
						${codeCell}
					</tr>
				</table>
			</body>
		</html>
	`;
        zip.file("index.htm", indexHtml);
        if (options?.missingBuildingFile) {
            return zip.generateAsync({ type: "base64" });
        }
        const roomLink = `<a href="http://example.com/rooms/DMP_110">110</a>`;
        const roomHtml = options?.invalidRoom
            ? `
			<html>
				<body>
					<table>
						<tr>
							<td class="views-field views-field-field-room-number">110</td>
						</tr>
					</table>
				</body>
			</html>
		`
            : `
			<html>
				<body>
					<table>
						<tr>
							<td class="views-field views-field-field-room-number">${roomLink}</td>
							<td class="views-field views-field-field-room-capacity">not-a-number</td>
							<td class="views-field views-field-field-room-furniture">Classroom-Movable Tables & Chairs</td>
							<td class="views-field views-field-field-room-type">Small Group</td>
						</tr>
						<tr>
							<td class="views-field views-field-field-room-number">
								<a href="http://example.com/rooms/DMP_201">201</a>
							</td>
							<td class="views-field views-field-field-room-capacity">not-a-number</td>
							<td class="views-field views-field-field-room-furniture">Classroom-Fixed Tables</td>
							<td class="views-field views-field-field-room-type">Tiered Large Group</td>
						</tr>
					</table>
				</body>
			</html>
		`;
        zip.file(buildingPath, roomHtml);
        return zip.generateAsync({ type: "base64" });
    }
    before(async function () {
        sections = await (0, TestUtil_1.getContentFromArchives)("pair.zip");
        noCoursesFolder = await (0, TestUtil_1.getContentFromArchives)("no_courses_folder.zip");
        invalidSection = await (0, TestUtil_1.getContentFromArchives)("invalid_section_folder.zip");
        validSection = await (0, TestUtil_1.getContentFromArchives)("valid_section_folder.zip");
        smallDataset = await (0, TestUtil_1.getContentFromArchives)("small_dataset.zip");
        await (0, TestUtil_1.clearDisk)();
    });
    beforeEach(async function () {
        await (0, TestUtil_1.clearDisk)();
        facade = new InsightFacade_1.default();
    });
    describe("AddDataset", function () {
        it("should reject with a blank dataset id", async function () {
            try {
                await facade.addDataset("   ", sections, IInsightFacade_1.InsightDatasetKind.Sections);
                chai_1.expect.fail("Should have thrown!");
            }
            catch (err) {
                (0, chai_1.expect)(err).to.be.an.instanceOf(IInsightFacade_1.InsightError);
            }
        });
        it("should reject with an empty id", async function () {
            try {
                await facade.addDataset("", sections, IInsightFacade_1.InsightDatasetKind.Sections);
                chai_1.expect.fail("Should have thrown!");
            }
            catch (err) {
                (0, chai_1.expect)(err).to.be.an.instanceOf(IInsightFacade_1.InsightError);
            }
        });
        it("should reject with an id with an underscore", async function () {
            try {
                await facade.addDataset("my_dataset", sections, IInsightFacade_1.InsightDatasetKind.Sections);
                chai_1.expect.fail("Should have thrown!");
            }
            catch (err) {
                (0, chai_1.expect)(err).to.be.an.instanceOf(IInsightFacade_1.InsightError);
            }
        });
        it("should reject duplicate id", async function () {
            await facade.addDataset("my-dataset", sections, IInsightFacade_1.InsightDatasetKind.Sections);
            try {
                await facade.addDataset("my-dataset", sections, IInsightFacade_1.InsightDatasetKind.Sections);
                chai_1.expect.fail("Should have thrown!");
            }
            catch (err) {
                (0, chai_1.expect)(err).to.be.an.instanceOf(IInsightFacade_1.InsightError);
            }
        });
        it("should accept this valid id", async function () {
            const result = await facade.addDataset("my-dataset", sections, IInsightFacade_1.InsightDatasetKind.Sections);
            (0, chai_1.expect)(result).to.be.an("array");
            (0, chai_1.expect)(result).to.include("my-dataset");
        });
        it("should reject a rooms dataset with invalid zip content", async function () {
            try {
                await facade.addDataset("rooms", "not-a-zip", IInsightFacade_1.InsightDatasetKind.Rooms);
                chai_1.expect.fail("Should have thrown!");
            }
            catch (err) {
                (0, chai_1.expect)(err).to.be.an.instanceOf(IInsightFacade_1.InsightError);
            }
        });
        it("should reject a rooms dataset with missing index.htm", async function () {
            const rooms = await makeRoomsDatasetZip({ missingIndex: true });
            try {
                await facade.addDataset("rooms", rooms, IInsightFacade_1.InsightDatasetKind.Rooms);
                chai_1.expect.fail("Should have thrown!");
            }
            catch (err) {
                (0, chai_1.expect)(err).to.be.an.instanceOf(IInsightFacade_1.InsightError);
            }
        });
        it("should reject a rooms dataset with no valid buildings", async function () {
            const rooms = await makeRoomsDatasetZip({ invalidIndex: true });
            try {
                await facade.addDataset("rooms", rooms, IInsightFacade_1.InsightDatasetKind.Rooms);
                chai_1.expect.fail("Should have thrown!");
            }
            catch (err) {
                (0, chai_1.expect)(err).to.be.an.instanceOf(IInsightFacade_1.InsightError);
            }
        });
        it("should reject a rooms dataset when the building file is missing", async function () {
            const rooms = await makeRoomsDatasetZip({ missingBuildingFile: true });
            try {
                await facade.addDataset("rooms", rooms, IInsightFacade_1.InsightDatasetKind.Rooms);
                chai_1.expect.fail("Should have thrown!");
            }
            catch (err) {
                (0, chai_1.expect)(err).to.be.an.instanceOf(IInsightFacade_1.InsightError);
            }
        });
        it("should reject a rooms dataset with no valid room rows", async function () {
            const rooms = await makeRoomsDatasetZip({ invalidRoom: true });
            try {
                await facade.addDataset("rooms", rooms, IInsightFacade_1.InsightDatasetKind.Rooms);
                chai_1.expect.fail("Should have thrown!");
            }
            catch (err) {
                (0, chai_1.expect)(err).to.be.an.instanceOf(IInsightFacade_1.InsightError);
            }
        });
        it("should reject invalid zip file", async function () {
            try {
                await facade.addDataset("my-dataset", "not-a-zip", IInsightFacade_1.InsightDatasetKind.Sections);
                chai_1.expect.fail("Should have thrown!");
            }
            catch (err) {
                (0, chai_1.expect)(err).to.be.an.instanceOf(IInsightFacade_1.InsightError);
            }
        });
        it("should reject with no courses/ folder", async function () {
            try {
                await facade.addDataset("my-dataset", noCoursesFolder, IInsightFacade_1.InsightDatasetKind.Sections);
                chai_1.expect.fail("Should have thrown!");
            }
            catch (err) {
                (0, chai_1.expect)(err).to.be.an.instanceOf(IInsightFacade_1.InsightError);
            }
        });
        it("should reject with invalid section", async function () {
            try {
                await facade.addDataset("my-dataset", invalidSection, IInsightFacade_1.InsightDatasetKind.Sections);
                chai_1.expect.fail("Should have thrown!");
            }
            catch (err) {
                (0, chai_1.expect)(err).to.be.an.instanceOf(IInsightFacade_1.InsightError);
            }
        });
        it("should accept with valid section", async function () {
            await facade.addDataset("my-dataset1", validSection, IInsightFacade_1.InsightDatasetKind.Sections);
            const result = await facade.addDataset("my-dataset2", validSection, IInsightFacade_1.InsightDatasetKind.Sections);
            (0, chai_1.expect)(result).to.have.members(["my-dataset1", "my-dataset2"]);
        });
        it("should persist dataset across new InsightFacade instances", async function () {
            await facade.addDataset("my-dataset", validSection, IInsightFacade_1.InsightDatasetKind.Sections);
            const newFacade = new InsightFacade_1.default();
            const datasets = await newFacade.listDatasets();
            (0, chai_1.expect)(datasets).to.have.length(1);
            (0, chai_1.expect)(datasets[0].id).to.equal("my-dataset");
        });
    });
    describe("RemoteDataset", function () {
        it("should reject with invalid id (empty)", async function () {
            try {
                await facade.removeDataset("");
                chai_1.expect.fail("Should have thrown!");
            }
            catch (err) {
                (0, chai_1.expect)(err).to.be.an.instanceOf(IInsightFacade_1.InsightError);
            }
        });
        it("should reject with invalid id (whitespace)", async function () {
            try {
                await facade.removeDataset("   ");
                chai_1.expect.fail("Should have thrown!");
            }
            catch (err) {
                (0, chai_1.expect)(err).to.be.an.instanceOf(IInsightFacade_1.InsightError);
            }
        });
        it("should reject with invalid id (underscore)", async function () {
            try {
                await facade.removeDataset("_");
                chai_1.expect.fail("Should have thrown!");
            }
            catch (err) {
                (0, chai_1.expect)(err).to.be.an.instanceOf(IInsightFacade_1.InsightError);
            }
        });
        it("should reject with id that doesn't exist", async function () {
            try {
                await facade.removeDataset("my-dataset");
                chai_1.expect.fail("Should have thrown!");
            }
            catch (err) {
                (0, chai_1.expect)(err).to.be.an.instanceOf(IInsightFacade_1.NotFoundError);
            }
        });
        it("should remove the existing dataset", async function () {
            try {
                await facade.addDataset("my-dataset", validSection, IInsightFacade_1.InsightDatasetKind.Sections);
                const result = await facade.removeDataset("my-dataset");
                (0, chai_1.expect)(result).to.equal("my-dataset");
                const list = await facade.listDatasets();
                (0, chai_1.expect)(list).to.have.length(0);
            }
            catch (err) {
                chai_1.expect.fail("Should not have thrown!");
            }
        });
        it("should persist removal across new InsightFacade instances", async function () {
            await facade.addDataset("my-dataset", validSection, IInsightFacade_1.InsightDatasetKind.Sections);
            await facade.removeDataset("my-dataset");
            const newFacade = new InsightFacade_1.default();
            const datasets = await newFacade.listDatasets();
            (0, chai_1.expect)(datasets).to.have.length(0);
        });
    });
    describe("ListDataset", function () {
        it("should return empty array when no dataset added", async function () {
            try {
                const datasetList = await facade.listDatasets();
                (0, chai_1.expect)(datasetList).to.be.an("array");
                (0, chai_1.expect)(datasetList).to.have.length(0);
            }
            catch (err) { }
        });
        it("should return an array with length of one when adding one dataset", async function () {
            try {
                await facade.addDataset("my-dataset", validSection, IInsightFacade_1.InsightDatasetKind.Sections);
                const datasetList = await facade.listDatasets();
                (0, chai_1.expect)(datasetList).to.be.an("array");
                (0, chai_1.expect)(datasetList).to.have.length(1);
                (0, chai_1.expect)(datasetList[0].id).to.equal("my-dataset");
                (0, chai_1.expect)(datasetList[0].kind).to.equal(IInsightFacade_1.InsightDatasetKind.Sections);
                (0, chai_1.expect)(datasetList[0].numRows).to.equal(1);
            }
            catch (err) { }
        });
        it("should return an array with length of two when adding two dataset", async function () {
            try {
                await facade.addDataset("my-dataset1", validSection, IInsightFacade_1.InsightDatasetKind.Sections);
                await facade.addDataset("my-dataset2", validSection, IInsightFacade_1.InsightDatasetKind.Sections);
                const datasetList = await facade.listDatasets();
                (0, chai_1.expect)(datasetList).to.be.an("array");
                (0, chai_1.expect)(datasetList).to.have.length(2);
                (0, chai_1.expect)(datasetList[0].id).to.equal("my-dataset1");
                (0, chai_1.expect)(datasetList[1].id).to.equal("my-dataset2");
            }
            catch (err) { }
        });
        it("should list all datasets across new InsightFacade instances", async function () {
            try {
                await facade.addDataset("my-dataset", validSection, IInsightFacade_1.InsightDatasetKind.Sections);
                const newFacade = new InsightFacade_1.default();
                const datasetList = await newFacade.listDatasets();
                (0, chai_1.expect)(datasetList).to.be.an("array");
                (0, chai_1.expect)(datasetList).to.have.length(1);
                (0, chai_1.expect)(datasetList[0].id).to.equal("my-dataset");
                (0, chai_1.expect)(datasetList[0].kind).to.equal(IInsightFacade_1.InsightDatasetKind.Sections);
                (0, chai_1.expect)(datasetList[0].numRows).to.equal(1);
            }
            catch (err) { }
        });
    });
    describe("PerformQuery", function () {
        async function checkQuery() {
            if (!this.test) {
                throw new Error("Invalid call to checkQuery." +
                    "Usage: 'checkQuery' must be passed as the second parameter of Mocha's it(..) function." +
                    "Do not invoke the function directly.");
            }
            const { input, expected, errorExpected } = await (0, TestUtil_1.loadTestQuery)(this.test.title);
            let result = [];
            try {
                result = await facade.performQuery(input);
            }
            catch (err) {
                if (!errorExpected) {
                    chai_1.expect.fail(`performQuery threw unexpected error: ${err}`);
                }
                if (expected === "InsightError") {
                    (0, chai_1.expect)(err).to.be.an.instanceOf(IInsightFacade_1.InsightError);
                }
                else if (expected === "ResultTooLargeError") {
                    (0, chai_1.expect)(err).to.be.an.instanceOf(IInsightFacade_1.ResultTooLargeError);
                }
                return;
            }
            if (errorExpected) {
                chai_1.expect.fail(`performQuery resolved when it should have rejected with ${expected}`);
            }
            (0, chai_1.expect)(result).to.deep.equal(expected);
        }
        beforeEach(async function () {
            await facade.addDataset("small", smallDataset, IInsightFacade_1.InsightDatasetKind.Sections);
        });
        before(async function () {
            facade = new InsightFacade_1.default();
        });
        after(async function () {
            await (0, TestUtil_1.clearDisk)();
        });
        it("[invalid/no_where.json] Query missing WHERE", checkQuery);
        it("[invalid/no_options.json] Query missing OPTIONS", checkQuery);
        it("[invalid/no_columns.json] Query missing COLUMNS", checkQuery);
        it("[invalid/columns_empty.json] Query with empty COLUMNS", checkQuery);
        it("[invalid/not_query.json] Not a query", checkQuery);
        it("[invalid/not_exist.json] Query referencing non-existent dataset", checkQuery);
        it("[invalid/order_key_not_in_columns.json] Query with ORDER key not in COLUMNS", checkQuery);
        it("[invalid/wildcard_middle.json] Wildcard in the middle", checkQuery);
        it("[invalid/is_on_mfield.json] IS used on number field", checkQuery);
        it("[invalid/eq_on_sfield.json] EQ used on string field", checkQuery);
        it("[valid/test_gt.json] SELECT dept, course, avg WHERE avg > 73", checkQuery);
        it("[valid/test_lt.json] SELECT dept, course, avg WHERE avg < 74", checkQuery);
        it("[valid/test_eq.json] SELECT dept, avg WHERE avg = 78.69", checkQuery);
        it('[valid/test_is.json] SELECT course, avg WHERE dept = "cpsc"', checkQuery);
        it('[valid/test_wildcard_start.json] SELECT dept, course, avg WHERE dept = "cp*"', checkQuery);
        it('[valid/test_wildcard_end.json] SELECT dept, course, avg WHERE dept = "*en"', checkQuery);
        it('[valid/test_wildcard_contain.json] SELECT dept, course, pass WHERE dept = "*t*"', checkQuery);
        it("[valid/test_no_filter.json] SELECT dept, course, no filter", checkQuery);
        it('[valid/test_and.json] SELECT dept, course, year WHERE avg > 73 AND Year = "2014"', checkQuery);
        it("[valid/test_or.json] SELECT dept, course, avg WHERE avg > 80 OR avg < 72", checkQuery);
        it('[valid/test_not.json] SELECT dept, course, avg WHERE dept IS NOT "cpsc"', checkQuery);
        it("[invalid/too_large.json] Query exceeding 5000 results", async function () {
            await facade.addDataset("sections", sections, IInsightFacade_1.InsightDatasetKind.Sections);
            return checkQuery.call(this);
        });
        it("[invalid/and_empty.json] AND with empty array", checkQuery);
        it("[invalid/or_empty.json] OR with empty array", checkQuery);
        it("[invalid/and_not_array.json] AND is not an array", checkQuery);
        it("[invalid/or_not_array.json] OR is not an array", checkQuery);
        it("[invalid/gt_value_not_number.json] GT value is not a number", checkQuery);
        it("[invalid/gt_not_object.json] GT value is not an object", checkQuery);
        it("[invalid/group_apply/missing_group.json] TRANSFORMATIONS missing GROUP", checkQuery);
        it("[invalid/group_apply/group_empty.json] GROUP is empty array", checkQuery);
        it("[invalid/invalid_column_key.json] COLUMNS key with invalid format", checkQuery);
        it("[invalid/group_apply/group_invalid_field.json] GROUP key references invalid field", checkQuery);
        it("[invalid/invalid_filter_key.json] Invalid filter key", checkQuery);
        it("[invalid/sorting/invalid_order_dir.json] Invalid ORDER direction", checkQuery);
        it("[invalid/sorting/order_missing_dir.json] ORDER object missing dir", checkQuery);
        it("[invalid/sorting/order_missing_keys.json] ORDER object missing keys", checkQuery);
        it("[valid/sorting/test_sort_up.json] Sort results ascending", checkQuery);
        it("[valid/sorting/test_sort_down.json] Sort results descending", checkQuery);
        it("[valid/sorting/test_sort_multi.json] Sort by multiple keys", checkQuery);
        it("[invalid/group_apply/columns_not_in_group_or_apply.json] COLUMNS are not included in GROUP or APPLY", checkQuery);
        it("[invalid/group_apply/invalid_apply_key.json] Invalid APPLY key", checkQuery);
        it("[invalid/group_apply/duplicate_apply_key.json] Duplicate APPLY key", checkQuery);
        it("[invalid/group_apply/avg_on_sfield.json] AVG used on string field", checkQuery);
        it("[valid/group_apply/test_avg_rounding.json] GROUP by dept and AVG avg result (rounded to two decimal places)", checkQuery);
        it("[valid/group_apply/test_sum_rounding.json] GROUP by dept and SUM avg result (rounded to two decimal places)", checkQuery);
        it("[valid/group_apply/test_max.json] GROUP by dept and MAX avg result", checkQuery);
        it("[valid/group_apply/test_min.json] GROUP by dept and MIN avg result", checkQuery);
        it("[valid/group_apply/test_count.json] GROUP by dept and COUNT unique values", checkQuery);
        it("[valid/group_apply/test_sum_large.json] SUM with large dataset", async function () {
            await facade.addDataset("sections", sections, IInsightFacade_1.InsightDatasetKind.Sections);
            return checkQuery.call(this);
        });
    });
});
//# sourceMappingURL=InsightFacade.spec.js.map