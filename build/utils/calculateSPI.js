import { getClientByTenantId } from "../config/db.js";
import { taskEndDate } from "./calcualteTaskEndDate.js";
import { calculationSubTaskProgression } from "./calculationSubTaskProgression.js";
export async function calculationSPI(tenantId, organisationId, projectId) {
    const prisma = await getClientByTenantId(tenantId);
    const findTask = await prisma.task.findMany({
        where: { projectId, deletedAt: null, parentTaskId: null },
        include: {
            subtasks: {
                where: { deletedAt: null },
                include: {
                    subtasks: {
                        where: { deletedAt: null },
                        include: {
                            subtasks: true,
                        },
                    },
                },
            },
        }
    });
    let sumOfTotalActualProgressionAndDuration = 0;
    let totalPlannedProgression = 0;
    for (const task of findTask) {
        const taskStartDate = new Date(task.startDate);
        const currentDate = new Date() < taskStartDate ? taskStartDate : new Date(); // Use task end date if currentDate is greater
        const completionPercentage = (await calculationSubTaskProgression(task, tenantId, organisationId)) ?? 0;
        const sumOfDurationAndProgression = Number(completionPercentage) * task.duration;
        sumOfTotalActualProgressionAndDuration += sumOfDurationAndProgression;
        let startDate = new Date(task.startDate);
        startDate.setUTCHours(0, 0, 0, 0);
        const endDate = await taskEndDate(task, tenantId, organisationId);
        let effectiveDate = currentDate > new Date(endDate) ? new Date(endDate) : currentDate;
        effectiveDate.setUTCHours(0, 0, 0, 0);
        const daysDiff = ((effectiveDate.getUTCDate() - startDate.getUTCDate()) + 1);
        const plannedProgression = (daysDiff / task.duration);
        const finalPlannedProgression = plannedProgression * 100; //completionPercentage
        totalPlannedProgression += finalPlannedProgression;
    }
    const finalValue = Math.round(sumOfTotalActualProgressionAndDuration) /
        Math.round(totalPlannedProgression);
    return Number((finalValue).toFixed(2));
}
