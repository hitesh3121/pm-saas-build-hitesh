import { getClientByTenantId } from "../config/db.js";
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
            deletedAt: null
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
    while (remainingDuration > 0) {
        endDate.setDate(endDate.getDate() + 1);
        const dayOfWeek = endDate.getUTCDay();
        const dayAbbreviation = getDayAbbreviation(dayOfWeek);
        if (!nonWorkingDays.includes(dayAbbreviation) && !isHoliday(endDate, holidays)) {
            remainingDuration--;
        }
    }
    return endDate;
};
export const getDayAbbreviation = (dayOfWeek) => {
    const days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
    return days[dayOfWeek] ?? "0";
};
export const isHoliday = (date, holidays) => {
    const holidayDates = holidays.map(holiday => new Date(holiday.holidayStartDate).setUTCHours(0, 0, 0, 0));
    const dateToCheck = date.setUTCHours(0, 0, 0, 0);
    return holidayDates.includes(dateToCheck);
};
