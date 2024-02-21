import { TaskStatusEnum } from "@prisma/client";
import { getClientByTenantId } from "../config/db.js";
import { calculateWorkingDays } from "./removeNonWorkingDays.js";
export async function calculationTPI(task, tenantId, organisationId) {
    const prisma = await getClientByTenantId(tenantId);
    let { duration, completionPecentage, startDate, status } = task;
    const endDate = prisma.task.calculateEndDate(startDate, duration);
    const newDuration = await calculateWorkingDays(startDate, endDate, tenantId, organisationId);
    if (status === TaskStatusEnum.NOT_STARTED) {
        return {
            tpiValue: 0,
            tpiFlag: "Green",
        };
    }
    const currentDate = new Date();
    const startDateObj = new Date(startDate);
    const elapsedDays = Math.ceil((currentDate.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24));
    const plannedProgress = elapsedDays / newDuration;
    if (!completionPecentage) {
        completionPecentage = 0;
    }
    const tpi = completionPecentage / plannedProgress;
    let flag = "";
    if (tpi < 0.8) {
        flag = "Red";
    }
    else if (tpi >= 0.8 && tpi < 0.95) {
        flag = "Orange";
    }
    else {
        flag = "Green";
    }
    return {
        tpiValue: tpi,
        tpiFlag: flag,
    };
}
export async function taskFlag(task, tenantId, organisationId) {
    const { milestoneIndicator } = task;
    const tpi = await calculationTPI(task, tenantId, organisationId);
    if (milestoneIndicator) {
        return tpi.tpiValue < 1 ? "Red" : "Green";
    }
    else {
        return tpi.tpiFlag;
    }
}
