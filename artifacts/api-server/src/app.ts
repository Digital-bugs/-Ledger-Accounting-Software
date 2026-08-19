import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
// Initialize SQLite database on startup (creates tables + seeds partners)
import "./lib/database";
import { initBackupScheduler } from "./routes/backup";

const app: Express = express();

// API responses must always include their JSON body. Express's default ETag
// handling can turn repeated GETs into 304 responses, but the shared client
// treats 304 as an empty response because it cannot restore the cached body
// outside the browser cache. Disabling ETags keeps list data available after
// navigation, refreshes, and query invalidation.
app.disable("etag");

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Start auto-backup scheduler (reads persisted settings)
initBackupScheduler();

export default app;
