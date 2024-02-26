import { settings } from "../config/settings.js";
export async function calculationSubTaskProgression(task, tenantId, organisationId) {
    if (task.subtasks && task.subtasks.length > 0) {
        let completionPecentageOrDurationTask = 0;
        let averagesSumOfDurationTask = 0;
        for (const value of task.subtasks) {
            const percentage = await calculationSubTaskProgression(value, tenantId, organisationId);
            completionPecentageOrDurationTask +=
                Number(percentage) * (value.duration * settings.hours);
            averagesSumOfDurationTask += value.duration * settings.hours * 100;
        }
        return ((completionPecentageOrDurationTask / averagesSumOfDurationTask) * 100);
    }
    else {
        return task.completionPecentage;
    }
}
