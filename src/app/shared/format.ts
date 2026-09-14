export const formatMoney = (value: number | null | undefined) => {
  const safe = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(safe);
};

export const formatNumber = (value: number | null | undefined) => {
  const safe = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat("en-IN").format(safe);
};

export const statusClass = (status: string) => status.toLowerCase().replace(/\s+/g, "-");

export const projectSupervisorLabel = (project: {
  supervisor?: string;
  lastAssignedSupervisor?: string;
}): string => {
  const supervisor = String(project?.supervisor || "").trim();
  if (supervisor) return supervisor;
  const lastAssigned = String(project?.lastAssignedSupervisor || "").trim();
  if (lastAssigned) return `${lastAssigned} has been unassigned for this project`;
  return "—";
};
