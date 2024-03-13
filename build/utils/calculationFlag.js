import { TaskStatusEnum } from "@prisma/client";
import { getClientByTenantId } from "../config/db.js";
import { getDayAbbreviation } from "./getDatAbbreviation.js";
import { isHoliday } from "./checkIsHoliday.js";
export async function calculationTPI(task, tenantId, organisationId) {
    let { duration, completionPecentage, startDate, status } = task;
    if (status === TaskStatusEnum.NOT_STARTED) {
        return {
            tpiValue: 0,
            tpiFlag: "Green",
        };
    }
    if (!completionPecentage) {
        completionPecentage = 0;
    }
    const currentDate = new Date();
    const taskStartDate = new Date(startDate);
    const effectiveDate = currentDate < taskStartDate ? taskStartDate : currentDate;
    effectiveDate.setUTCHours(0, 0, 0, 0);
    taskStartDate.setUTCHours(0, 0, 0, 0);
    const remainingDuration = await excludeNonWorkingDays(effectiveDate, taskStartDate, tenantId, organisationId);
    const plannedProgress = remainingDuration / duration;
    const tpi = plannedProgress !== 0 ? completionPecentage / plannedProgress : 0;
    let flag;
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
export const excludeNonWorkingDays = async (currentDate, startDate, tenantId, organisationId) => {
    const prisma = await getClientByTenantId(tenantId);
    const orgDetails = await prisma.organisation.findFirst({
        where: {
            organisationId,
            deletedAt: null,
        },
        select: {
            nonWorkingDays: true,
            orgHolidays: true,
        },
    });
    const nonWorkingDays = orgDetails?.nonWorkingDays ?? [];
    const holidays = orgDetails?.orgHolidays ?? [];
    let remainingDuration = 0;
    for (let date = new Date(startDate); date <= currentDate; date.setDate(date.getDate() + 1)) {
        const dayOfWeek = date.getDay();
        const dayAbbreviation = getDayAbbreviation(dayOfWeek);
        // Check if it's a working day (not a holiday and not in non-working days)
        if (!nonWorkingDays.includes(dayAbbreviation) &&
            !isHoliday(date, holidays)) {
            remainingDuration++;
        }
    }
    return remainingDuration;
};
