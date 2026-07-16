import { Request, Response, NextFunction } from "express";
import * as clientService from "../services/client.service.js";
import * as siteService from "../services/site.service.js";
import * as projectService from "../services/project.service.js";
import * as supervisorService from "../services/supervisor.service.js";
import * as customFieldService from "../services/custom-fields.service.js";
import { getScopedClientQuery, getScopedProjectIds, getScopedProjectQuery } from "../middleware/rbac.js";

// =================== CLIENTS ===================
export async function createClient(req: Request, res: Response, next: NextFunction) {
  try {
    const client = await clientService.createClient(req.body);
    res.status(201).json({ client });
  } catch (e) { next(e); }
}

export async function listClients(req: Request, res: Response, next: NextFunction) {
  try {
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
    const scopeQuery = await getScopedClientQuery(req);
    const client = await clientService.getClientById(req.params.id, scopeQuery);
    res.json({ client });
  } catch (e) { next(e); }
}

export async function updateClient(req: Request, res: Response, next: NextFunction) {
  try {
    const scopeQuery = await getScopedClientQuery(req);
    const client = await clientService.updateClient(req.params.id, req.body, scopeQuery);
    res.json({ client });
  } catch (e) { next(e); }
}

export async function deleteClient(req: Request, res: Response, next: NextFunction) {
  try {
    const scopeQuery = await getScopedClientQuery(req);
    await clientService.deleteClient(req.params.id, scopeQuery);
    res.json({ success: true });
  } catch (e) { next(e); }
}

export async function getClientSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const scopeQuery = await getScopedClientQuery(req);
    const scopeProjectIds = await getScopedProjectIds(req);
    const summary = await clientService.getClientSummary(req.params.id, scopeQuery, scopeProjectIds);
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
    const scopeProjectIds = await getScopedProjectIds(req);
    const sites = await siteService.listSites({
      status: req.query.status as string | undefined,
      search: req.query.search as string | undefined,
      scopeProjectIds,
    });
    res.json({ sites });
  } catch (e) { next(e); }
}

export async function getSite(req: Request, res: Response, next: NextFunction) {
  try {
    const scopeProjectIds = await getScopedProjectIds(req);
    const site = await siteService.getSiteById(req.params.id, scopeProjectIds);
    res.json({ site });
  } catch (e) { next(e); }
}

export async function updateSite(req: Request, res: Response, next: NextFunction) {
  try {
    const scopeProjectIds = await getScopedProjectIds(req);
    const site = await siteService.updateSite(req.params.id, req.body, scopeProjectIds);
    res.json({ site });
  } catch (e) { next(e); }
}

export async function deleteSite(req: Request, res: Response, next: NextFunction) {
  try {
    const scopeProjectIds = await getScopedProjectIds(req);
    await siteService.deleteSite(req.params.id, scopeProjectIds);
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
    const scopeProjectIds = await getScopedProjectIds(req);
    const project = await projectService.getProjectById(req.params.id, scopeProjectIds);
    res.json({ project });
  } catch (e) { next(e); }
}

export async function updateProject(req: Request, res: Response, next: NextFunction) {
  try {
    const scopeProjectIds = await getScopedProjectIds(req);
    const project = await projectService.updateProject(req.params.id, req.body, scopeProjectIds);
    res.json({ project });
  } catch (e) { next(e); }
}

export async function deleteProject(req: Request, res: Response, next: NextFunction) {
  try {
    const scopeProjectIds = await getScopedProjectIds(req);
    await projectService.deleteProject(req.params.id, scopeProjectIds);
    res.json({ success: true });
  } catch (e) { next(e); }
}

export async function getProjectLedger(req: Request, res: Response, next: NextFunction) {
  try {
    const scopeProjectIds = await getScopedProjectIds(req);
    const ledger = await projectService.getProjectLedger(req.params.id, scopeProjectIds);
    res.json({ ledger });
  } catch (e) { next(e); }
}

export async function getProjectsSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const scopeProjectIds = await getScopedProjectIds(req);
    const summary = await projectService.getProjectsSummary(scopeProjectIds);
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
    const scopeProjectIds = await getScopedProjectIds(req);
    const supervisors = await supervisorService.listSupervisors({
      status: req.query.status as string | undefined,
      search: req.query.search as string | undefined,
      scopeProjectIds,
    });
    res.json({ supervisors });
  } catch (e) { next(e); }
}

export async function getSupervisor(req: Request, res: Response, next: NextFunction) {
  try {
    const scopeProjectIds = await getScopedProjectIds(req);
    const supervisor = await supervisorService.getSupervisorById(req.params.id, scopeProjectIds);
    res.json({ supervisor });
  } catch (e) { next(e); }
}

export async function updateSupervisor(req: Request, res: Response, next: NextFunction) {
  try {
    const scopeProjectIds = await getScopedProjectIds(req);
    const supervisor = await supervisorService.updateSupervisor(req.params.id, req.body, scopeProjectIds);
    res.json({ supervisor });
  } catch (e) { next(e); }
}

export async function deleteSupervisor(req: Request, res: Response, next: NextFunction) {
  try {
    const scopeProjectIds = await getScopedProjectIds(req);
    await supervisorService.deleteSupervisor(req.params.id, scopeProjectIds);
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
    const includeSupervisorOnly = req.query.supervisorOnly === "true";
    const fields = await customFieldService.listCustomFields(
      req.query.entityType as never,
      req.query.entityId as string,
      includeSupervisorOnly
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
