import express from "express";
import path from "path";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { env } from "./config/env.js";
import { connectDatabase } from "./config/db.js";
import { initEmail, verifyEmailConnection } from "./config/email.js";
import { initFirebase } from "./config/firebase.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import { setupSwagger } from "./config/swagger.js";
import authRoutes from "./routes/auth.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import entitiesRoutes from "./routes/entities.routes.js";
import financialRoutes from "./routes/financial.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import mobileRoutes from "./routes/mobile.routes.js";
import rbacRoutes from "./routes/rbac.routes.js";
import vendorExtraRoutes from "./routes/vendor-extra.routes.js";
import quotationRoutes from "./routes/quotation.routes.js";
import invoiceRoutes from "./routes/invoice.routes.js";
import companyProfileRoutes from "./routes/company-profile.routes.js";
import mediaRoutes from "./routes/media.routes.js";
import { ensureDefaultPermissions } from "./models/RolePermission.js";
import { RESET_PASSWORD_HTML, SIGNUP_HTML } from "./config/pages.js";

export function createApp(): express.Application {
  const app = express();

  app.set("trust proxy", 1);

  if (env.NODE_ENV === "production") {
    app.use((req, res, next) => {
      const proto = req.headers["x-forwarded-proto"] as string;
      if (proto === "http") {
        return res.redirect(301, `https://${req.headers.host}${req.url}`);
      }
      next();
    });
  }

  app.use(
    helmet({
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          scriptSrcAttr: ["'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
        },
      },
      crossOriginResourcePolicy: env.NODE_ENV === "production" ? { policy: "same-origin" } : { policy: "cross-origin" },
      crossOriginEmbedderPolicy: false,
    })
  );

  app.use(
    cors({
      origin: (origin, callback) => {
        const normalize = (url: string) => url.replace(/\/+$/, "");
        const allowedOrigins = [
          env.FRONTEND_URL,
          ...(env.MOBILE_APP_URL !== "*" ? [env.MOBILE_APP_URL] : []),
        ]
          .filter(Boolean)
          .map(normalize);
        const requestOrigin = origin ? normalize(origin) : null;
        if (
          !origin ||
          (requestOrigin && allowedOrigins.includes(requestOrigin)) ||
          env.MOBILE_APP_URL === "*"
        ) {
          callback(null, true);
        } else {
          callback(new Error(`Origin ${origin} not allowed by CORS policy`));
        }
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
      exposedHeaders: ["X-Request-Id"],
      maxAge: 86400,
    })
  );

  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please try again later" },
  });
  app.use(globalLimiter);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Global HTTP request timeout — 5 minutes for M0 free tier cold starts.
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  res.setTimeout(300_000, () => {
    if (!res.headersSent) {
      res.status(503).json({ error: "Request timeout, please try again" });
    }
  });
  next();
});

// Hydration endpoints (/api/*/all) — match global 5min timeout.
app.use("/api/materials/all", (_req, res, next) => { res.setTimeout(300_000); next(); });
app.use("/api/inventory/all", (_req, res, next) => { res.setTimeout(300_000); next(); });
app.use("/api/expenses/all", (_req, res, next) => { res.setTimeout(300_000); next(); });
app.use("/api/invoices/all", (_req, res, next) => { res.setTimeout(300_000); next(); });

  app.get("/health", (_req: express.Request, res: express.Response) => {
    res.json({
      status: "ok",
      env: env.NODE_ENV,
      timestamp: new Date().toISOString(),
      https: env.NODE_ENV === "production" ? "enforced" : "disabled",
      backendUrl: env.BACKEND_PUBLIC_URL || null,
      deploy: "add-existing-material-mobile-workflow-2026-07-30",
    });
  });

  app.get("/", (_req, res) => {
    res.redirect(302, env.FRONTEND_URL);
  });

  // Lightweight keep-alive endpoint — pings all 3 M0 collections to keep
  // the connection pool warm. Called every 10 min by the frontend to
  // prevent Render free-tier spin-down and M0 connection expiry.
  app.get("/keepalive", async (_req, res) => {
    try {
      const { Material } = await import("./models/Material.js");
      const { Inventory } = await import("./models/Inventory.js");
      const { Expense } = await import("./models/Expense.js");
      await Promise.all([
        Material.findOne().select("_id").lean().maxTimeMS(5000).catch(() => null),
        Inventory.findOne().select("_id").lean().maxTimeMS(5000).catch(() => null),
        Expense.findOne().select("_id").lean().maxTimeMS(5000).catch(() => null),
      ]);
      res.json({ ok: true });
    } catch {
      res.json({ ok: true });
    }
  });

  app.get("/favicon.ico", (_req, res) => {
    res.status(204).end();
  });

  app.get("/robots.txt", (_req, res) => {
    res.type("text/plain").send("User-agent: *\nDisallow: /\n");
  });

  if (
    env.NODE_ENV === "production" &&
    env.BACKEND_PUBLIC_URL &&
    env.FRONTEND_URL.replace(/\/+$/, "") === env.BACKEND_PUBLIC_URL.replace(/\/+$/, "")
  ) {
    console.error(
      "[FATAL] FRONTEND_URL points to the backend itself. Root redirect would cause an infinite loop."
    );
  }

  setupSwagger(app);

  app.use("/api", mediaRoutes);
  app.use("/api/auth", authRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api", entitiesRoutes);
  app.use("/api", financialRoutes);
  app.use("/api", dashboardRoutes);
  app.use("/api", mobileRoutes);
  app.use("/api", rbacRoutes);
  app.use("/api", vendorExtraRoutes);
  app.use("/api", quotationRoutes);
  app.use("/api/invoices", invoiceRoutes);
  app.use("/api", companyProfileRoutes);

  // Static assets (logo for email templates and auth pages)
  // Resolve relative to project root (process.cwd() = backend/ when running npm start)
  app.use("/assets", express.static(path.join(process.cwd(), "public/assets"), { maxAge: "7d" }));

  app.get("/reset-password.html", (_req, res) => {
    res.type("html").send(RESET_PASSWORD_HTML);
  });
  app.get("/signup.html", (_req, res) => {
    res.type("html").send(SIGNUP_HTML);
  });

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export async function bootstrap(): Promise<void> {
  // Each startup step is wrapped in its own try/catch so a single slow
  // query on M0 can't take down the entire service. If a migration or
  // seed fails, the app still comes up and serves requests; the failed
  // step can be retried manually or on the next deploy.
  try {
    await connectDatabase();
  } catch (err) {
    console.error("[Bootstrap] DB connection failed:", (err as Error).message);
    process.exit(1);
  }
  // Warm up the M0 connection pool with a simple query so the first
  // user request doesn't hang waiting for a cold connection.
  try {
    const { Material } = await import("./models/Material.js");
    const t0 = Date.now();
    await Material.findOne().lean().maxTimeMS(10000);
    console.log(`[Bootstrap] Connection warmup OK in ${Date.now() - t0}ms`);
  } catch (err) {
    console.warn("[Bootstrap] Connection warmup failed (non-fatal):", (err as Error).message);
  }
  try {
    initEmail();
    await verifyEmailConnection();
  } catch (err) {
    console.warn("[Bootstrap] Email init failed (non-fatal):", (err as Error).message);
  }
  try {
    initFirebase();
  } catch (err) {
    console.warn("[Bootstrap] Firebase init failed (non-fatal):", (err as Error).message);
  }
  try {
    const { verifyPCloudConnection } = await import("./services/pcloud.service.js");
    const status = await verifyPCloudConnection();
    if (status.ok) {
      console.log(`[pCloud] Connected: ${status.message} (folder=${status.folderId}, ${status.ms}ms)`);
    } else {
      console.warn(`[pCloud] Connection check failed: ${status.message} (folder=${status.folderId || "not configured"}, ${status.ms}ms)`);
    }
  } catch (err) {
    console.warn("[pCloud] Not configured or unavailable (non-fatal):", (err as Error).message);
  }
  try {
    await ensureDefaultPermissions();
  } catch (err) {
    console.warn("[Bootstrap] ensureDefaultPermissions failed (non-fatal):", (err as Error).message);
  }
  try {
    const { migrateMaterialStatus } = await import("./services/material.service.js");
    await migrateMaterialStatus();
  } catch (err) {
    console.warn("[Bootstrap] migrateMaterialStatus failed (non-fatal):", (err as Error).message);
  }
  try {
    const { seedDefaultReports } = await import("./utils/seed-reports.js");
    await seedDefaultReports();
  } catch (err) {
    console.warn("[Bootstrap] seedDefaultReports failed (non-fatal):", (err as Error).message);
  }
  try {
    const { seedDefaultAdmin } = await import("./utils/seed-admin.js");
    await seedDefaultAdmin();
  } catch (err) {
    console.warn("[Bootstrap] seedDefaultAdmin failed (non-fatal):", (err as Error).message);
  }
  try {
    const { ensureWorkersCollection } = await import("./utils/ensure-collections.js");
    await ensureWorkersCollection();
  } catch (err) {
    console.warn("[Bootstrap] ensureWorkersCollection failed (non-fatal):", (err as Error).message);
  }

  // Migrate the legacy `subcontractId_1` (unique) index off the
  // Subcontractor collection. Older builds declared a `subcontractId`
  // string field with `unique: true`, but the new model no longer
  // emits that field — the index now collides on every insert because
  // it sees `null`. Drop it once on startup so inserts work.
  try {
    const { Subcontractor } = await import("./models/Subcontractor.js");
    const indexes = await Subcontractor.collection.indexes();
    for (const idx of indexes) {
      if (idx.name === "subcontractId_1") {
        await Subcontractor.collection.dropIndex("subcontractId_1");
        console.log("[Startup] dropped legacy subcontractor subcontractId_1 index");
      }
    }
  } catch (err) {
    console.warn("[Bootstrap] legacy subcontractor index drop failed (non-fatal):", (err as Error).message);
  }
  try {
    const { migrateCompanyName } = await import("./services/company-profile.service.js");
    await migrateCompanyName();
  } catch (err) {
    console.warn("[Bootstrap] migrateCompanyName failed (non-fatal):", (err as Error).message);
  }

  // Backfill inventory records from materials — uses bulk operations now
  // (was N+1 queries before). Runs in the background after server start
  // so the first user request doesn't have to wait. Materials without
  // inventory records will be auto-populated, so the Inventory tab
  // shows all sites/projects visible to the user.
  try {
    const { backfillApprovedMaterialsToInventory } = await import("./services/inventory.service.js");
    // Fire-and-forget — the bootstrap() resolves immediately, the backfill
    // runs in the background. M0 may take 10-30s to process 50+ materials.
    setImmediate(() => {
      Promise.resolve().catch((err: any) =>
        console.error("[Startup] backfill inventory failed (non-fatal):", err?.message || err)
      );
    });
    console.log("[Startup] inventory backfill skipped; dashboard inventory is material-backed");
  } catch (err) {
    console.warn("[Bootstrap] backfill import failed (non-fatal):", (err as Error).message);
  }

  try {
    const { Material } = await import("./models/Material.js");
    await Material.collection.createIndex({ status: 1, _id: -1 }, { background: true });
    await Material.collection.createIndex({ projectId: 1, _id: -1 }, { background: true });
    await Material.collection.createIndex({ siteId: 1, _id: -1 }, { background: true });
    await Material.collection.createIndex({ projectId: 1, status: 1, _id: -1 }, { background: true });
    await Material.collection.createIndex({ siteId: 1, status: 1, _id: -1 }, { background: true });
    await Material.collection.createIndex({ projectId: 1, siteId: 1, createdAt: -1 }, { background: true });
    await Material.collection.createIndex({ siteId: 1, status: 1, createdAt: -1 }, { background: true });
    console.log("[Startup] Material compound indexes ensured");
  } catch (e: any) {
    console.error("[Startup] Material index creation failed (non-fatal):", e?.message || e);
  }

  try {
    const { Expense } = await import("./models/Expense.js");
    await Expense.collection.createIndex({ siteId: 1, type: 1, status: 1, date: -1 }, { background: true });
    await Expense.collection.createIndex({ siteId: 1, date: -1 }, { background: true });
    await Expense.collection.createIndex({ type: 1, _id: -1 }, { background: true });
    await Expense.collection.createIndex({ status: 1, _id: -1 }, { background: true });
    await Expense.collection.createIndex({ projectId: 1, _id: -1 }, { background: true });
    await Expense.collection.createIndex({ siteId: 1, _id: -1 }, { background: true });
    await Expense.collection.createIndex({ projectId: 1, type: 1, _id: -1 }, { background: true });
    await Expense.collection.createIndex({ siteId: 1, type: 1, _id: -1 }, { background: true });
    await Expense.collection.createIndex({ projectId: 1, status: 1, _id: -1 }, { background: true });
    await Expense.collection.createIndex({ siteId: 1, status: 1, _id: -1 }, { background: true });
    console.log("[Startup] Expense compound indexes ensured");
  } catch (e: any) {
    console.error("[Startup] Expense index creation failed (non-fatal):", e?.message || e);
  }

  try {
    const { Labour } = await import("./models/Labour.js");
    await Labour.collection.createIndex({ siteId: 1, status: 1, createdAt: -1 }, { background: true });
    await Labour.collection.createIndex({ projectId: 1, createdAt: -1 }, { background: true });
    await Labour.collection.createIndex({ status: 1, _id: -1 }, { background: true });
    await Labour.collection.createIndex({ projectId: 1, _id: -1 }, { background: true });
    await Labour.collection.createIndex({ siteId: 1, _id: -1 }, { background: true });
    await Labour.collection.createIndex({ projectId: 1, siteId: 1, _id: -1 }, { background: true });
    await Labour.collection.createIndex({ projectId: 1, status: 1, _id: -1 }, { background: true });
    await Labour.collection.createIndex({ siteId: 1, status: 1, _id: -1 }, { background: true });
    console.log("[Startup] Labour compound indexes ensured");
  } catch (e: any) {
    console.error("[Startup] Labour index creation failed (non-fatal):", e?.message || e);
  }

  try {
    const { Approval } = await import("./models/Approval.js");
    await Approval.collection.createIndex({ site: 1, status: 1, submittedAt: -1 }, { background: true });
    await Approval.collection.createIndex({ status: 1, submittedAt: -1 }, { background: true });
    console.log("[Startup] Approval compound indexes ensured");
  } catch (e: any) {
    console.error("[Startup] Approval index creation failed (non-fatal):", e?.message || e);
  }

  try {
    const { Inventory } = await import("./models/Inventory.js");
    await Inventory.collection.createIndex({ siteId: 1, createdAt: -1 }, { background: true });
    await Inventory.collection.createIndex({ projectId: 1, _id: -1 }, { background: true });
    await Inventory.collection.createIndex({ siteId: 1, _id: -1 }, { background: true });
    await Inventory.collection.createIndex({ projectId: 1, siteId: 1, _id: -1 }, { background: true });
    console.log("[Startup] Inventory compound index ensured");
  } catch (e: any) {
    console.error("[Startup] Inventory index creation failed (non-fatal):", e?.message || e);
  }

  const app = createApp();
  app.listen(env.PORT, () => {
    console.log(`[Server] AJUI backend listening on port ${env.PORT} (${env.NODE_ENV})`);
  });
}

async function seedDefaultReports(): Promise<void> {}

// Process-level safety nets. Without these, an unhandled rejection from
// a MongoDB timeout (e.g. WaitQueueTimeoutError) propagates out of the
// async chain and crashes the Node process. Render then returns 502
// Bad Gateway to every subsequent request until the service restarts.
//
// We log the error and KEEP THE PROCESS ALIVE. The failed request
// already gets its 503 response from the controller's catch block;
// the rejection bubbling out is just a symptom that the catch didn't
// swallow.
process.on("unhandledRejection", (reason: unknown) => {
  console.error(
    "[unhandledRejection]",
    reason instanceof Error ? `${reason.name}: ${reason.message}` : String(reason)
  );
});

process.on("uncaughtException", (err: Error) => {
  console.error("[uncaughtException]", err.name, err.message);
  // For truly fatal errors (e.g. out of memory), let Node exit. For
  // anything else, log and continue.
  if (err.name === "ERR_OUT_OF_MEMORY") {
    process.exit(1);
  }
});

if (require.main === module) {
  bootstrap().catch((err) => {
    console.error("[Fatal] Bootstrap failed:", err);
    process.exit(1);
  });
}
