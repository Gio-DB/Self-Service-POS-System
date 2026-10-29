import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import { Prisma } from "./generated/prisma/client.js";
import { HttpError } from "./errors.js";
import { createApiRouter, type RealtimeEvents } from "./routes.js";
import { prisma } from "./db.js";

export function createApp(events: RealtimeEvents) {
  const app = express();
  const webOrigin = process.env.WEB_ORIGIN ?? "http://127.0.0.1:5173";

  app.use(cors({ origin: webOrigin }));
  app.use(express.json({ limit: "100kb" }));

  app.get("/health", async (_request, response) => {
    await prisma.$queryRaw`SELECT 1`;
    response.json({ status: "ok", database: "connected" });
  });

  app.use("/api", createApiRouter(prisma, events));

  const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
    if (error instanceof HttpError) {
      response.status(error.status).json({ error: error.message });
      return;
    }
    if (error instanceof SyntaxError && "body" in error) {
      response.status(400).json({ error: "Request body must contain valid JSON." });
      return;
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      response.status(404).json({ error: "Requested record was not found." });
      return;
    }
    console.error("Unhandled API error:", error);
    response.status(500).json({ error: "An unexpected server error occurred." });
  };
  app.use(errorHandler);

  return app;
}
