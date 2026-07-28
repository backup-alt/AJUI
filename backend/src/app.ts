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
          // 'unsafe-inline' is required because reset-password.html and signup.html
          // use inline <script> tags and onclick= handlers (served as raw HTML
          // strings from this backend). These auth pages are served from the same
          // origin so there's no cross-origin XSS risk from these specific inline
          // scripts/handlers.
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

  app.get("/health", (_req: express.Request, res: express.Response) => {
    res.json({
      status: "ok",
      env: env.NODE_ENV,
      timestamp: new Date().toISOString(),
      https: env.NODE_ENV === "production" ? "enforced" : "disabled",
      backendUrl: env.BACKEND_PUBLIC_URL || null,
      deploy: "fix-materials",
    });
  });

  app.get("/", (_req, res) => {
    res.redirect(302, env.FRONTEND_URL);
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
  await connectDatabase();
  initEmail();
  await verifyEmailConnection();
  initFirebase();
  await ensureDefaultPermissions();
  const { migrateMaterialStatus } = await import("./services/material.service.js");
  await migrateMaterialStatus();
  const { seedDefaultReports } = await import("./utils/seed-reports.js");
  await seedDefaultReports();
  const { seedDefaultAdmin } = await import("./utils/seed-admin.js");
  await seedDefaultAdmin();
  const { ensureWorkersCollection } = await import("./utils/ensure-collections.js");
  await ensureWorkersCollection();
  const { migrateCompanyName } = await import("./services/company-profile.service.js");
  await migrateCompanyName();

  const { backfillApprovedMaterialsToInventory, backfillMaterialSiteIds } = await import("./services/inventory.service.js");
  backfillMaterialSiteIds().catch((err: any) =>
    console.error("[Startup] backfill material siteIds failed (non-fatal):", err?.message || err)
  );
  backfillApprovedMaterialsToInventory({}).catch((err: any) =>
    console.error("[Startup] backfill inventory failed (non-fatal):", err?.message || err)
  );

  try {
    const { Material } = await import("./models/Material.js");
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
    console.log("[Startup] Expense compound indexes ensured");
  } catch (e: any) {
    console.error("[Startup] Expense index creation failed (non-fatal):", e?.message || e);
  }

  try {
    const { Labour } = await import("./models/Labour.js");
    await Labour.collection.createIndex({ siteId: 1, status: 1, createdAt: -1 }, { background: true });
    await Labour.collection.createIndex({ projectId: 1, createdAt: -1 }, { background: true });
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

if (require.main === module) {
  bootstrap().catch((err) => {
    console.error("[Fatal] Bootstrap failed:", err);
    process.exit(1);
  });
}