import express from "express";
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
import { ensureDefaultPermissions } from "./models/RolePermission.js";

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
          scriptSrc: ["'self'"],
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
  const { seedDefaultReports } = await import("./utils/seed-reports.js");
  await seedDefaultReports();
  const { seedDefaultAdmin } = await import("./utils/seed-admin.js");
  await seedDefaultAdmin();
  const { ensureWorkersCollection } = await import("./utils/ensure-collections.js");
  await ensureWorkersCollection();

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