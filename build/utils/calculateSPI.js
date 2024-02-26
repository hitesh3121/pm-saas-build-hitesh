import { getClientByTenantId } from "../config/db.js";
import { settings } from "../config/settings.js";
export async function calculationSPI(tasks, tenantId, organisationId) {
    const prisma = await getClientByTenantId(tenantId);
    const actualProgression = tasks.completionPecentage ?? 0;
    const plannedProgression = await prisma.task.calculateTaskPlannedProgression(tasks, tenantId, organisationId);
    const value = (actualProgression * (tasks.duration * settings.hours)) /
        (plannedProgression * (tasks.duration * settings.hours));
    return value;
}
