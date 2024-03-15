import { getClientByTenantId } from "../config/db.js";
export async function calculationCPI(project, tenantId, organisationId) {
    const prisma = await getClientByTenantId(tenantId);
    const progressionPercentage = await prisma.project.projectProgression(project.projectId, tenantId, organisationId);
    const consumedBudget = project.consumedBudget === "0" ? NaN : Number(project.consumedBudget);
    const estimatedBudgetNumber = Math.round(Number(project.estimatedBudget));
    const finalValue = (progressionPercentage * estimatedBudgetNumber) /
        Math.round(consumedBudget);
    return finalValue;
}
