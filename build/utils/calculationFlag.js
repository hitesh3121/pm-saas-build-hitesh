import { TaskStatusEnum } from "@prisma/client";
import { getClientByTenantId } from "../config/db.js";
import { getDayAbbreviation } from "./getDatAbbreviation.js";
import { isHoliday } from "./checkIsHoliday.js";
import { taskEndDate } from "./calcualteTaskEndDate.js";
import { calculationSubTaskProgression } from "./calculationSubTaskProgression.js";
export async function calculationTPI(task, tenantId, organisationId) {
    let { duration, startDate, status } = task;
    const completionPecentage = (await calculationSubTaskProgression(task, tenantId, organisationId)) ?? 0;
    const currentDate = new Date();
    const taskStartDate = new Date(startDate);
    if (currentDate <= taskStartDate || status == TaskStatusEnum.NOT_STARTED) {
        return {
            tpiValue: 1,
            tpiFlag: "Green",
            plannedProgression: 100,
        };
    }
    const endDate = await taskEndDate(task, tenantId, organisationId);
    const effectiveDate = currentDate > new Date(endDate) ? new Date(endDate) : currentDate;
    effectiveDate.setUTCHours(0, 0, 0, 0);
    taskStartDate.setUTCHours(0, 0, 0, 0);
    const remainingDuration = await excludeNonWorkingDays(effectiveDate, taskStartDate, tenantId, organisationId);
    const plannedProgress = (remainingDuration / duration) * 100;
    const tpi = Number(completionPecentage) / plannedProgress;
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
        plannedProgression: plannedProgress,
    };
}
export async function taskFlag(task, tenantId, organisationId) {
    const { milestoneIndicator } = task;
    const tpi = await calculationTPI(task, tenantId, organisationId);
    let delay = 100 - tpi.tpiValue * 100;
    if (tpi.tpiFlag == "Green") {
        delay = 0;
    }
    if (milestoneIndicator) {
        return { flag: tpi.tpiValue < 1 ? "Red" : "Green", delay: delay };
    }
    else {
        return { flag: tpi.tpiFlag, delay: delay };
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
