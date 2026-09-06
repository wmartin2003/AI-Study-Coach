import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { errorHandler } from "./middlewares/error-handler";

const app: Express = express();

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
// In production, only origins explicitly listed in ALLOWED_ORIGINS (a
// comma-separated env var) may call this API with credentials — an open
// `cors()` would let any site's JavaScript ride a visitor's session.
// Development keeps a permissive localhost fallback so the Vite dev server
// (whatever port it lands on) always works without extra setup.
const allowedOrigins = (process.env["ALLOWED_ORIGINS"] ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const isDevelopment = process.env["NODE_ENV"] !== "production";

app.use(
  cors({
    origin(origin, callback) {
      // No Origin header (server-to-server, curl, health checks) — allow.
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      if (isDevelopment && /^https?:\/\/localhost(:\d+)?$/.test(origin)) return callback(null, true);
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);
app.use(errorHandler);

export default app;
