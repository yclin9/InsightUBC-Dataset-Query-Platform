"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const InsightFacade_1 = __importDefault(require("../controller/InsightFacade"));
const IInsightFacade_1 = require("../controller/IInsightFacade");
class Server {
    port;
    express;
    facade;
    constructor(port) {
        this.port = port;
        this.express = (0, express_1.default)();
        this.facade = new InsightFacade_1.default();
        this.registerMiddleware();
        this.registerRoutes();
    }
    start() {
        return new Promise((resolve, reject) => {
            this.express
                .listen(this.port, () => {
                console.log(`Server running on port ${this.port}`);
                resolve();
            })
                .on("error", (err) => {
                reject(err);
            });
        });
    }
    registerMiddleware() {
        this.express.use(express_1.default.json({ limit: "50mb" }));
        this.express.use((0, cors_1.default)());
        this.express.use(express_1.default.static("frontend"));
    }
    registerRoutes() {
        this.express.put("/dataset/:id/:kind", this.addDataset.bind(this));
        this.express.delete("/dataset/:id", this.removeDataset.bind(this));
        this.express.get("/datasets", this.listDatasets.bind(this));
        this.express.post("/query", this.performQuery.bind(this));
    }
    async addDataset(req, res) {
        try {
            const { id, kind } = req.params;
            const content = req.body.content;
            const datasetKind = kind === "rooms"
                ? IInsightFacade_1.InsightDatasetKind.Rooms
                : IInsightFacade_1.InsightDatasetKind.Sections;
            const result = await this.facade.addDataset(id, content, datasetKind);
            res.status(200).json({ result });
        }
        catch (err) {
            if (err instanceof IInsightFacade_1.InsightError) {
                res.status(400).json({ error: err.message });
            }
            else {
                res.status(500).json({ error: "Internal server error" });
            }
        }
    }
    async removeDataset(req, res) {
        try {
            const { id } = req.params;
            const result = await this.facade.removeDataset(id);
            res.status(200).json({ result });
        }
        catch (err) {
            if (err instanceof IInsightFacade_1.NotFoundError) {
                res.status(404).json({ error: err.message });
            }
            else if (err instanceof IInsightFacade_1.InsightError) {
                res.status(400).json({ error: err.message });
            }
            else {
                res.status(500).json({ error: "Internal server error" });
            }
        }
    }
    async listDatasets(req, res) {
        try {
            const result = await this.facade.listDatasets();
            res.status(200).json({ result });
        }
        catch (err) {
            res.status(500).json({ error: "Internal server error" });
        }
    }
    async performQuery(req, res) {
        try {
            const result = await this.facade.performQuery(req.body);
            res.status(200).json({ result });
        }
        catch (err) {
            if (err instanceof IInsightFacade_1.InsightError) {
                res.status(400).json({ error: err.message });
            }
            else if (err instanceof IInsightFacade_1.ResultTooLargeError) {
                res.status(400).json({ error: err.message });
            }
            else {
                res.status(500).json({ error: "Internal server error" });
            }
        }
    }
}
exports.default = Server;
const server = new Server(4321);
server.start().catch(console.error);
//# sourceMappingURL=server.js.map