import { Request, Response, NextFunction } from "express";
import * as clientService from "../services/client.service.js";
import * as siteService from "../services/site.service.js";
import * as projectService from "../services/project.service.js";
import * as supervisorService from "../services/supervisor.service.js";
import * as customFieldService from "../services/custom-fields.service.js";

// =================== CLIENTS ===================
export async function createClient(req: Request, res: Response, next: NextFunction) {
  try {
    const client = await clientService.createClient(req.body);
    res.status(201).json({ client });
  } catch (e) { next(e); }
}

export async function listClients(req: Request, res: Response, next: NextFunction) {
  try {
    const { getScopedClientQuery } = await import("../middleware/rbac.js");
    const scopeQuery = await getScopedClientQuery(req);
    const result = await clientService.listClients({
      search: req.query.search as string | undefined,
      status: req.query.status as string | undefined,
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
      scopeQuery,
    });
    res.json(result);
  } catch (e) { next(e); }
}

export async function getClient(req: Request, res: Response, next: NextFunction) {
  try {
    const client = await clientService.getClientById(req.params.id);
    res.json({ client });
  } catch (e) { next(e); }
}

export async function updateClient(req: Request, res: Response, next: NextFunction) {
  try {
    const client = await clientService.updateClient(req.params.id, req.body);
    res.json({ client });
  } catch (e) { next(e); }
}

export async function deleteClient(req: Request, res: Response, next: NextFunction) {
  try {
    await clientService.deleteClient(req.params.id);
    res.json({ success: true });
  } catch (e) { next(e); }
}

export async function getClientSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const summary = await clientService.getClientSummary(req.params.id);
    res.json(summary);
  } catch (e) { next(e); }
}

// =================== SITES ===================
export async function createSite(req: Request, res: Response, next: NextFunction) {
  try {
    const site = await siteService.createSite(req.body);
    res.status(201).json({ site });
  } catch (e) { next(e); }
}

export async function listSites(req: Request, res: Response, next: NextFunction) {
  try {
    const sites = await siteService.listSites({
      status: req.query.status as string | undefined,
      search: req.query.search as string | undefined,
    });
    res.json({ sites });
  } catch (e) { next(e); }
}

export async function getSite(req: Request, res: Response, next: NextFunction) {
  try {
    const site = await siteService.getSiteById(req.params.id);
    res.json({ site });
  } catch (e) { next(e); }
}

export async function updateSite(req: Request, res: Response, next: NextFunction) {
  try {
    const site = await siteService.updateSite(req.params.id, req.body);
    res.json({ site });
  } catch (e) { next(e); }
}

export async function deleteSite(req: Request, res: Response, next: NextFunction) {
  try {
    await siteService.deleteSite(req.params.id);
    res.json({ success: true });
  } catch (e) { next(e); }
}

// =================== PROJECTS ===================
export async function createProject(req: Request, res: Response, next: NextFunction) {
  try {
    const project = await projectService.createProject(req.body);
    res.status(201).json({ project });
  } catch (e) { next(e); }
}

export async function listProjects(req: Request, res: Response, next: NextFunction) {
  try {
    const { getScopedProjectQuery } = await import("../middleware/rbac.js");
    const scopeQuery = await getScopedProjectQuery(req);
    const result = await projectService.listProjects({
      search: req.query.search as string | undefined,
      status: req.query.status as string | undefined,
      clientId: req.query.clientId as string | undefined,
      siteId: req.query.siteId as string | undefined,
      supervisorId: req.query.supervisorId as string | undefined,
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
      scopeQuery,
    });
    res.json(result);
  } catch (e) { next(e); }
}

export async function getProject(req: Request, res: Response, next: NextFunction) {
  try {
    const project = await projectService.getProjectById(req.params.id);
    res.json({ project });
  } catch (e) { next(e); }
}

export async function updateProject(req: Request, res: Response, next: NextFunction) {
  try {
    const project = await projectService.updateProject(req.params.id, req.body);
    res.json({ project });
  } catch (e) { next(e); }
}

export async function deleteProject(req: Request, res: Response, next: NextFunction) {
  try {
    await projectService.deleteProject(req.params.id);
    res.json({ success: true });
  } catch (e) { next(e); }
}

export async function getProjectLedger(req: Request, res: Response, next: NextFunction) {
  try {
    const ledger = await projectService.getProjectLedger(req.params.id);
    res.json({ ledger });
  } catch (e) { next(e); }
}

export async function getProjectsSummary(_req: Request, res: Response, next: NextFunction) {
  try {
    const summary = await projectService.getProjectsSummary();
    res.json(summary);
  } catch (e) { next(e); }
}

// =================== SUPERVISORS ===================
export async function createSupervisor(req: Request, res: Response, next: NextFunction) {
  try {
    const supervisor = await supervisorService.createSupervisor(req.body);
    res.status(201).json({ supervisor });
  } catch (e) { next(e); }
}

export async function listSupervisors(req: Request, res: Response, next: NextFunction) {
  try {
    const supervisors = await supervisorService.listSupervisors({
      status: req.query.status as string | undefined,
      search: req.query.search as string | undefined,
    });
    res.json({ supervisors });
  } catch (e) { next(e); }
}

export async function getSupervisor(req: Request, res: Response, next: NextFunction) {
  try {
    const supervisor = await supervisorService.getSupervisorById(req.params.id);
    res.json({ supervisor });
  } catch (e) { next(e); }
}

export async function updateSupervisor(req: Request, res: Response, next: NextFunction) {
  try {
    const supervisor = await supervisorService.updateSupervisor(req.params.id, req.body);
    res.json({ supervisor });
  } catch (e) { next(e); }
}

export async function deleteSupervisor(req: Request, res: Response, next: NextFunction) {
  try {
    await supervisorService.deleteSupervisor(req.params.id);
    res.json({ success: true });
  } catch (e) { next(e); }
}

// =================== CUSTOM FIELDS ===================
export async function createCustomField(req: Request, res: Response, next: NextFunction) {
  try {
    const field = await customFieldService.createCustomField(req.body);
    res.status(201).json({ field });
  } catch (e) { next(e); }
}

export async function listCustomFields(req: Request, res: Response, next: NextFunction) {
  try {
    const fields = await customFieldService.listCustomFields(
      req.query.entityType as never,
      req.query.entityId as string
    );
    res.json({ fields });
  } catch (e) { next(e); }
}

export async function updateCustomField(req: Request, res: Response, next: NextFunction) {
  try {
    const field = await customFieldService.updateCustomField(req.params.id, req.body);
    res.json({ field });
  } catch (e) { next(e); }
}

export async function deleteCustomField(req: Request, res: Response, next: NextFunction) {
  try {
    await customFieldService.deleteCustomField(req.params.id);
    res.json({ success: true });
  } catch (e) { next(e); }
}
