import express, { Application, Request, Response } from "express";
import cors from "cors";
import InsightFacade from "../controller/InsightFacade";
import { InsightDatasetKind, InsightError, NotFoundError, ResultTooLargeError } from "../controller/IInsightFacade";

export default class Server {
	private readonly port: number;
	private express: Application;
	private facade: InsightFacade;

	constructor(port: number) {
		this.port = port;
		this.express = express();
		this.facade = new InsightFacade();
		this.registerMiddleware();
		this.registerRoutes();
	}

	public start(): Promise<void> {
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

	private registerMiddleware(): void {
		this.express.use(express.json({ limit: "50mb" }));
		this.express.use(cors());
		this.express.use(express.static("frontend"));
	}

	private registerRoutes(): void {
		this.express.put("/dataset/:id/:kind", this.addDataset.bind(this));
		this.express.delete("/dataset/:id", this.removeDataset.bind(this));
		this.express.get("/datasets", this.listDatasets.bind(this));
		this.express.post("/query", this.performQuery.bind(this));
	}

	private async addDataset(req: Request, res: Response): Promise<void> {
		try {
			const { id, kind } = req.params;
			const content = req.body.content;
			const datasetKind = kind === "rooms" ? InsightDatasetKind.Rooms : InsightDatasetKind.Sections;
			const result = await this.facade.addDataset(id, content, datasetKind);
			res.status(200).json({ result });
		} catch (err) {
			if (err instanceof InsightError) {
				res.status(400).json({ error: (err as Error).message });
			} else {
				res.status(500).json({ error: "Internal server error" });
			}
		}
	}

	private async removeDataset(req: Request, res: Response): Promise<void> {
		try {
			const { id } = req.params;
			const result = await this.facade.removeDataset(id);
			res.status(200).json({ result });
		} catch (err) {
			if (err instanceof NotFoundError) {
				res.status(404).json({ error: (err as Error).message });
			} else if (err instanceof InsightError) {
				res.status(400).json({ error: (err as Error).message });
			} else {
				res.status(500).json({ error: "Internal server error" });
			}
		}
	}

	private async listDatasets(req: Request, res: Response): Promise<void> {
		try {
			const result = await this.facade.listDatasets();
			res.status(200).json({ result });
		} catch (err) {
			res.status(500).json({ error: "Internal server error" });
		}
	}

	private async performQuery(req: Request, res: Response): Promise<void> {
		try {
			const result = await this.facade.performQuery(req.body);
			res.status(200).json({ result });
		} catch (err) {
			if (err instanceof InsightError) {
				res.status(400).json({ error: (err as Error).message });
			} else if (err instanceof ResultTooLargeError) {
				res.status(400).json({ error: (err as Error).message });
			} else {
				res.status(500).json({ error: "Internal server error" });
			}
		}
	}
}

const server = new Server(4321);
server.start().catch(console.error);
