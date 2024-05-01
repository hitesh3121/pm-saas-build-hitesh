import { getClientByTenantId } from "../config/db.js";
import { getDayAbbreviation } from "./getDatAbbreviation.js";
import { isHoliday } from "./checkIsHoliday.js";
export async function taskEndDate(task, tenantId, organisationId) {
    let endDate = new Date();
    if (task &&
        task.startDate &&
        task.duration !== null &&
        task.duration !== undefined) {
        endDate = await calculateEndDate(task.startDate, task.duration, tenantId, organisationId);
        // @ts-ignore
        if (task && task.subtasks) {
            // @ts-ignore
            if (task.subtasks && task.subtasks.length > 0) {
                let parentEndDate = endDate;
                // @ts-ignore
                for (const subtask of task.subtasks) {
                    if (subtask.startDate && subtask.duration) {
                        const subtaskEndDate = await calculateEndDate(subtask.startDate, subtask.duration, tenantId, organisationId);
                        if (subtaskEndDate > parentEndDate) {
                            parentEndDate = subtaskEndDate;
                        }
                    }
                }
                if (parentEndDate > endDate) {
                    endDate = parentEndDate;
                }
            }
            endDate.setUTCHours(0, 0, 0, 0);
            return endDate.toISOString();
        }
    }
    endDate.setUTCHours(0, 0, 0, 0);
    return endDate.toISOString();
}
export const calculateEndDate = async (startDate, duration, tenantId, organisationId) => {
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
    const startDateObj = new Date(startDate);
    let endDate = new Date(startDateObj);
    endDate.setUTCHours(0, 0, 0, 0);
    let remainingDuration = duration;
    const startDayOfWeek = endDate.getUTCDay();
    const startDayAbbreviation = getDayAbbreviation(startDayOfWeek).toUpperCase();
    if (!nonWorkingDays.includes(startDayAbbreviation) &&
        !isHoliday(endDate, holidays)) {
        remainingDuration--;
    }
    while (remainingDuration > 0) {
        endDate.setDate(endDate.getDate() + 1);
        const dayOfWeek = endDate.getUTCDay();
        const dayAbbreviation = getDayAbbreviation(dayOfWeek).toUpperCase();
        if (!nonWorkingDays.includes(dayAbbreviation) &&
            !isHoliday(endDate, holidays)) {
            remainingDuration--;
        }
    }
    return endDate;
};
export const calculateDuration = async (startDate, endDate, tenantId, organisationId) => {
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
    const start = new Date(startDate);
    const end = new Date(endDate);
    start.setUTCHours(0, 0, 0, 0);
    end.setUTCHours(0, 0, 0, 0);
    let duration = 0;
    while (start <= end) {
        const dayOfWeek = start.getUTCDay();
        const dayAbbreviation = getDayAbbreviation(dayOfWeek).toUpperCase();
        if (!nonWorkingDays.includes(dayAbbreviation) &&
            !isHoliday(start, holidays)) {
            duration++;
        }
        start.setDate(start.getDate() + 1);
    }
    return duration;
};
export const getNextWorkingDay = async (inputDate, tenantId, organisationId) => {
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
    let endDate = new Date(inputDate);
    endDate.setDate(endDate.getDate() + 1);
    endDate.setUTCHours(0, 0, 0, 0);
    let startDayOfWeek = endDate.getUTCDay();
    let startDayAbbreviation = getDayAbbreviation(startDayOfWeek).toUpperCase();
    while (nonWorkingDays.includes(startDayAbbreviation) ||
        isHoliday(endDate, holidays)) {
        endDate.setDate(endDate.getDate() + 1);
        endDate.setUTCHours(0, 0, 0, 0);
        startDayOfWeek = endDate.getUTCDay();
        startDayAbbreviation = getDayAbbreviation(startDayOfWeek).toUpperCase();
    }
    return endDate;
};
