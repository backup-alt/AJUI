import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { Express } from "express";
import { env } from "./env";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.3",
    info: {
      title: "AJUI Backend API",
      version: "1.0.0",
      description:
        "Annai Golden Builders operations platform backend. Powers both web (Admin/PM/Accountant) and mobile (Supervisor) apps.",
      contact: { name: "AJUI Dev Team" },
      license: { name: "Proprietary" },
    },
    servers: [
      { url: `http://localhost:${env.PORT}`, description: "Local development" },
      { url: "https://ajui-backend.onrender.com", description: "Production (Render)" },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "JWT access token from /api/auth/login",
        },
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            error: { type: "string" },
            code: { type: "string" },
            details: { type: "object" },
          },
        },
        User: {
          type: "object",
          properties: {
            _id: { type: "string" },
            name: { type: "string" },
            email: { type: "string" },
            phone: { type: "string" },
            role: { type: "string", enum: ["admin", "accountant", "project_manager", "supervisor"] },
            status: { type: "string", enum: ["active", "inactive", "on_leave"] },
            createdAt: { type: "string", format: "date-time" },
            lastLoginAt: { type: "string", format: "date-time", nullable: true },
          },
        },
        Client: {
          type: "object",
          properties: {
            _id: { type: "string" },
            clientId: { type: "string", example: "CLI-001" },
            name: { type: "string" },
            initials: { type: "string" },
            mobile: { type: "string" },
            address: { type: "string" },
            gstNumber: { type: "string" },
            status: { type: "string", enum: ["Active", "On Hold", "Completed"] },
            supervisor: { type: "string" },
            projectIds: { type: "array", items: { type: "string" } },
            totalProjectValue: { type: "number" },
            amountReceived: { type: "number" },
            pendingBalance: { type: "number" },
          },
        },
        Project: {
          type: "object",
          properties: {
            _id: { type: "string" },
            projectId: { type: "string", example: "AB-1024" },
            name: { type: "string" },
            client: { type: "string" },
            clientId: { type: "string" },
            supervisor: { type: "string" },
            supervisorId: { type: "string" },
            siteIds: { type: "array", items: { type: "string" } },
            siteNames: { type: "array", items: { type: "string" } },
            status: { type: "string", enum: ["Active", "On Hold", "Completed"] },
            startDate: { type: "string" },
            totalValue: { type: "number" },
            estimatedValue: { type: "number" },
            receivedAmount: { type: "number" },
            pendingBalance: { type: "number" },
            materialSpend: { type: "number" },
            labourPayable: { type: "number" },
            expenseBalance: { type: "number" },
            completion: { type: "number" },
          },
        },
        Material: {
          type: "object",
          properties: {
            materialId: { type: "string", example: "MAT-001" },
            projectId: { type: "string" },
            site: { type: "string" },
            name: { type: "string" },
            unit: { type: "string" },
            requestedQuantity: { type: "number" },
            approvedQuantity: { type: "number" },
            purchasedQuantity: { type: "number" },
            consumedQuantity: { type: "number" },
            remainingStock: { type: "number" },
            vendor: { type: "string" },
            vendorId: { type: "string" },
            poNumber: { type: "string" },
            status: { type: "string", enum: ["Pending", "Approved", "Rejected"] },
          },
        },
        Labour: {
          type: "object",
          properties: {
            labourId: { type: "string" },
            projectId: { type: "string" },
            site: { type: "string" },
            partyName: { type: "string" },
            category: { type: "string" },
            attendanceDate: { type: "string" },
            presentCount: { type: "number" },
            dailyWage: { type: "number" },
            laborTypes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  dailyWage: { type: "number" },
                  staffCount: { type: "number" },
                },
              },
            },
            status: { type: "string", enum: ["Pending", "Approved", "Rejected"] },
          },
        },
        Expense: {
          type: "object",
          properties: {
            expenseId: { type: "string" },
            type: { type: "string", enum: ["site", "general"] },
            projectId: { type: "string" },
            site: { type: "string" },
            amount: { type: "number" },
            runningBalance: { type: "number" },
            reference: { type: "string" },
            department: { type: "string" },
            category: { type: "string" },
            status: { type: "string", enum: ["Pending", "Approved", "Rejected"] },
          },
        },
        Payment: {
          type: "object",
          properties: {
            paymentId: { type: "string" },
            projectId: { type: "string" },
            clientId: { type: "string" },
            amount: { type: "number" },
            mode: { type: "string", enum: ["Cash", "Bank Transfer", "Cheque", "UPI", "NEFT"] },
            receiptNumber: { type: "string" },
            transactionReference: { type: "string" },
            collectedBy: { type: "string" },
            status: { type: "string", enum: ["Pending", "Approved", "Rejected"] },
          },
        },
        Vendor: {
          type: "object",
          properties: {
            vendorId: { type: "string" },
            name: { type: "string" },
            materialType: { type: "string" },
            phone: { type: "string" },
            address: { type: "string" },
            gstNumber: { type: "string" },
            rating: { type: "number" },
          },
        },
        Approval: {
          type: "object",
          properties: {
            approvalId: { type: "string" },
            type: { type: "string", enum: ["material", "labour", "expense", "payment", "subcontract"] },
            title: { type: "string" },
            projectName: { type: "string" },
            site: { type: "string" },
            amount: { type: "number" },
            status: { type: "string", enum: ["Pending", "Approved", "Rejected"] },
            sourceCollection: { type: "string" },
            sourceId: { type: "string" },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: "Health", description: "Service health check" },
      { name: "Auth", description: "Login, logout, refresh, password reset, supervisor signup" },
      { name: "Admin", description: "Admin-only: create users, generate QR invites" },
      { name: "Clients", description: "Client CRUD (Admin + PM)" },
      { name: "Sites", description: "Site CRUD (Admin + PM)" },
      { name: "Projects", description: "Project CRUD (Admin + PM)" },
      { name: "Supervisors", description: "Supervisor profile CRUD (Admin)" },
      { name: "Custom Fields", description: "EAV custom fields per entity" },
      { name: "Materials", description: "Material CRUD with auto-approval (Admin + PM + Supervisor)" },
      { name: "Labour", description: "Labour CRUD with dynamic laborTypes (Admin + PM + Supervisor)" },
      { name: "Expenses", description: "Site + General expense CRUD (Admin + Accountant + Supervisor)" },
      { name: "Payments", description: "Payment CRUD (Admin + Accountant)" },
      { name: "Vendors", description: "Vendor CRUD + purchase history (Admin + PM)" },
      { name: "Subcontractors", description: "Subcontractor CRUD (Admin + PM)" },
      { name: "Approvals", description: "Central approval queue" },
      { name: "Dashboard", description: "KPIs + universal dashboard" },
      { name: "Reports", description: "Report catalog + generation" },
      { name: "RBAC", description: "Role-based access control configuration" },
      { name: "Supervisor Mobile", description: "Mobile-specific endpoints (Supervisor only)" },
    ],
  },
  apis: ["./src/routes/*.ts", "./dist/routes/*.js"],
};

const swaggerSpec = swaggerJsdoc(options);

export function setupSwagger(app: Express): void {
  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customSiteTitle: "AJUI Backend API",
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
    },
  }));
  app.get("/api/docs.json", (_req, res) => {
    res.json(swaggerSpec);
  });
}
