import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { env } from "./config/env";
import { connectDatabase } from "./config/db";
import { initSendGrid } from "./config/sendgrid";
import { initFirebase } from "./config/firebase";
import { errorHandler, notFound } from "./middleware/errorHandler";
import { setupSwagger } from "./config/swagger";
import authRoutes from "./routes/auth.routes";
import adminRoutes from "./routes/admin.routes";
import entitiesRoutes from "./routes/entities.routes";
import financialRoutes from "./routes/financial.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import mobileRoutes from "./routes/mobile.routes";
import rbacRoutes from "./routes/rbac.routes";
import { ensureDefaultPermissions } from "./models/RolePermission";

export function createApp(): express.Application {
  const app = express();

  // Trust first proxy (Render's load balancer) for correct client IP + HTTPS detection
  app.set("trust proxy", 1);

  // Force HTTPS redirect in production (Render provides HTTPS automatically)
  if (env.NODE_ENV === "production") {
    app.use((req, res, next) => {
      const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol;
      if (proto !== "https") {
        return res.redirect(301, `https://${req.headers.host}${req.url}`);
      }
      next();
    });
  }

  app.use(
    helmet({
      // Allow cross-origin resource sharing for dev (different ports for frontend/backend).
      // In production, both frontend and backend are on the same domain (Render),
      // so this defaults to 'same-origin' which is more secure.
      crossOriginResourcePolicy: env.NODE_ENV === "production" ? { policy: "same-origin" } : { policy: "cross-origin" },
    })
  );
  app.use(
    cors({
      origin: env.MOBILE_APP_URL === "*" ? true : [env.FRONTEND_URL, env.MOBILE_APP_URL],
      credentials: true,
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      env: env.NODE_ENV,
      timestamp: new Date().toISOString(),
      https: env.NODE_ENV === "production" ? "enforced" : "disabled",
      backendUrl: env.BACKEND_PUBLIC_URL || null,
    });
  });

  // API documentation (Swagger UI)
  setupSwagger(app);

  app.use("/api/auth", authRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api", entitiesRoutes);
  app.use("/api", financialRoutes);
  app.use("/api", dashboardRoutes);
  app.use("/api", mobileRoutes);
  app.use("/api", rbacRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export async function bootstrap(): Promise<void> {
  await connectDatabase();
  initSendGrid();
  initFirebase();
  await ensureDefaultPermissions();
  const { seedDefaultReports } = await import("./utils/seed-reports");
  await seedDefaultReports();

  const app = createApp();
  app.listen(env.PORT, () => {
    console.log(`[Server] AJUI backend listening on port ${env.PORT} (${env.NODE_ENV})`);
  });
}

async function seedDefaultReports(): Promise<void> {
  // Moved to utils/seed-reports.ts
}

if (require.main === module) {
  bootstrap().catch((err) => {
    console.error("[Fatal] Bootstrap failed:", err);
    process.exit(1);
  });
}
