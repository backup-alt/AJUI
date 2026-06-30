import { Router } from "express";
import * as ctrl from "../controllers/entities.controller.js";
import { validate } from "../middleware/validation.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import {
  createClientSchema,
  updateClientSchema,
  listClientsSchema,
  createSiteSchema,
  updateSiteSchema,
  createProjectSchema,
  updateProjectSchema,
  listProjectsSchema,
  createSupervisorSchema,
  updateSupervisorSchema,
  createCustomFieldSchema,
  updateCustomFieldSchema,
  getCustomFieldsSchema,
} from "../schemas/entities.schema.js";

const router = Router();
router.use(requireAuth);

/**
 * @openapi
 * /api/clients:
 *   get:
 *     tags: [Clients]
 *     summary: List clients (scoped to user role)
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [Active, On Hold, Completed] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200: { description: OK }
 *   post:
 *     tags: [Clients]
 *     summary: Create client (Admin + PM)
 */
router.post("/clients", validate(createClientSchema), requireRole("admin", "project_manager"), ctrl.createClient);
router.get("/clients", validate(listClientsSchema, "query"), ctrl.listClients);
router.get("/clients/:id/summary", ctrl.getClientSummary);
router.get("/clients/:id", ctrl.getClient);
router.patch("/clients/:id", validate(updateClientSchema), requireRole("admin", "project_manager"), ctrl.updateClient);
router.delete("/clients/:id", requireRole("admin"), ctrl.deleteClient);

/**
 * @openapi
 * /api/projects:
 *   get:
 *     tags: [Projects]
 *     summary: List projects (scoped to user role)
 *   post:
 *     tags: [Projects]
 *     summary: Create project (Admin + PM)
 */
router.post("/projects", validate(createProjectSchema), requireRole("admin", "project_manager"), ctrl.createProject);
router.get("/projects", validate(listProjectsSchema, "query"), ctrl.listProjects);
router.get("/projects/summary", ctrl.getProjectsSummary);
router.get("/projects/:id/ledger", ctrl.getProjectLedger);
router.get("/projects/:id", ctrl.getProject);
router.patch("/projects/:id", validate(updateProjectSchema), requireRole("admin", "project_manager"), ctrl.updateProject);
router.delete("/projects/:id", requireRole("admin"), ctrl.deleteProject);

/**
 * @openapi
 * /api/sites:
 *   get:
 *     tags: [Sites]
 *     summary: List sites
 *   post:
 *     tags: [Sites]
 *     summary: Create site (Admin + PM)
 */
router.post("/sites", validate(createSiteSchema), requireRole("admin", "project_manager"), ctrl.createSite);
router.get("/sites", ctrl.listSites);
router.get("/sites/:id", ctrl.getSite);
router.patch("/sites/:id", validate(updateSiteSchema), requireRole("admin", "project_manager"), ctrl.updateSite);
router.delete("/sites/:id", requireRole("admin"), ctrl.deleteSite);

/**
 * @openapi
 * /api/supervisors:
 *   get:
 *     tags: [Supervisors]
 *     summary: List supervisors (Admin)
 *   post:
 *     tags: [Supervisors]
 *     summary: Create supervisor profile (Admin)
 */
router.post("/supervisors", validate(createSupervisorSchema), requireRole("admin"), ctrl.createSupervisor);
router.get("/supervisors", ctrl.listSupervisors);
router.get("/supervisors/:id", ctrl.getSupervisor);
router.patch("/supervisors/:id", validate(updateSupervisorSchema), requireRole("admin"), ctrl.updateSupervisor);
router.delete("/supervisors/:id", requireRole("admin"), ctrl.deleteSupervisor);

/**
 * @openapi
 * /api/custom-fields:
 *   get:
 *     tags: [Custom Fields]
 *     summary: List custom fields for an entity
 *   post:
 *     tags: [Custom Fields]
 *     summary: Upsert custom field
 */
router.post("/custom-fields", validate(createCustomFieldSchema), ctrl.createCustomField);
router.get("/custom-fields", validate(getCustomFieldsSchema, "query"), ctrl.listCustomFields);
router.patch("/custom-fields/:id", validate(updateCustomFieldSchema), ctrl.updateCustomField);
router.delete("/custom-fields/:id", ctrl.deleteCustomField);

export default router;
