import { PrismaClient, UserStatusEnum, UserRoleEnum } from "@prisma/client";
import { RegisterSocketServices } from "../services/socket.services.js";
import { settings } from "./settings.js";
import { calculateWorkingDays } from "../utils/removeNonWorkingDays.js";
const rootPrismaClient = generatePrismaClient();
const prismaClients = {
    root: rootPrismaClient,
};
function generatePrismaClient(datasourceUrl) {
    let prismaClientParams = [];
    if (typeof datasourceUrl === "string") {
        prismaClientParams = [
            {
                datasourceUrl,
            },
        ];
    }
    const client = new PrismaClient(...prismaClientParams).$extends({
        result: {
            task: {
                endDate: {
                    compute(task) {
                        let endDate = new Date();
                        if (task &&
                            task.startDate &&
                            task.duration !== null &&
                            task.duration !== undefined) {
                            endDate = client.task.calculateEndDate(task.startDate, task.duration);
                        }
                        // @ts-ignore
                        if (task && task.subtasks) {
                            // @ts-ignore
                            task.subtasks.forEach((subtask) => {
                                if (subtask.endDate &&
                                    (!endDate || subtask.endDate > endDate)) {
                                    endDate = new Date(subtask.endDate);
                                }
                                else if (subtask.dueDate &&
                                    (!endDate || subtask.dueDate > endDate)) {
                                    endDate = new Date(subtask.dueDate);
                                }
                            });
                        }
                        return endDate;
                    },
                },
            },
        },
        model: {
            notification: {
                async sendNotification(notificationType, details, sentTo, sentBy, referenceId) {
                    const responseNotification = await client.notification.create({
                        data: {
                            type: notificationType,
                            details: details,
                            sentTo: sentTo,
                            sentBy: sentBy,
                            referenceId: referenceId,
                        },
                    });
                    RegisterSocketServices.io
                        .in(responseNotification.sentTo)
                        .emit("notification", responseNotification);
                    return responseNotification;
                },
            },
            history: {
                async createHistory(userId, historyType, historyMesage, historyData, historyRefrenceId) {
                    const history = await client.history.create({
                        data: {
                            type: historyType,
                            data: historyData,
                            createdBy: userId,
                            referenceId: historyRefrenceId,
                            message: historyMesage,
                        },
                    });
                    return history;
                },
            },
            userOrganisation: {
                async findAdministrator(organisationId) {
                    return await client.userOrganisation.findMany({
                        where: {
                            organisationId,
                            role: UserRoleEnum.ADMINISTRATOR,
                            user: {
                                status: UserStatusEnum.ACTIVE,
                            },
                            deletedAt: null,
                        },
                    });
                },
            },
            project: {
                async projectProgression(projectId, tenantId, organisationId) {
                    const parentTasks = await client.task.findMany({
                        where: {
                            projectId,
                            deletedAt: null,
                        },
                    });
                    let completionPecentageOrDuration = 0;
                    let averagesSumOfDuration = 0;
                    for (const value of parentTasks) {
                        const endDate = value.milestoneIndicator ? value.dueDate : value.endDate;
                        const duration = await calculateWorkingDays(value.startDate, endDate, tenantId, organisationId);
                        completionPecentageOrDuration +=
                            Number(value.completionPecentage) *
                                (duration * settings.hours);
                        averagesSumOfDuration += duration * settings.hours * 100;
                    }
                    return (completionPecentageOrDuration / averagesSumOfDuration);
                },
            },
            task: {
                // create action (comment-attachment-dependencies)
                async canCreate(taskId, userId) {
                    const task = await client.task.getTaskById(taskId);
                    const userRoles = await client.user.getUserRoles(userId);
                    const allowedRoles = [
                        UserRoleEnum.ADMINISTRATOR,
                        UserRoleEnum.PROJECT_MANAGER,
                    ];
                    const isAssignedToTask = task.assignedUsers.some((assignedUser) => assignedUser.user.userId === userId);
                    return (userId === task.createdByUserId ||
                        userRoles.some((role) => allowedRoles.includes(role)) ||
                        isAssignedToTask);
                },
                async canEditOrDelete(taskId, userId) {
                    const task = await client.task.getTaskById(taskId);
                    const userRoles = await client.user.getUserRoles(userId);
                    const allowedRoles = [
                        UserRoleEnum.ADMINISTRATOR,
                        UserRoleEnum.PROJECT_MANAGER,
                    ];
                    const isTaskAuthor = task.createdByUserId === userId;
                    const canPerformAction = userRoles.some((role) => allowedRoles.includes(role)) ||
                        isTaskAuthor;
                    return canPerformAction;
                },
                async getTaskById(taskId) {
                    return client.task.findFirstOrThrow({
                        where: { taskId, deletedAt: null },
                        include: {
                            assignedUsers: {
                                where: { deletedAt: null },
                                include: {
                                    user: true,
                                },
                            },
                        },
                    });
                },
                async calculateSubTask(startingTaskId) {
                    let currentTaskId = startingTaskId;
                    let count = 0;
                    while (currentTaskId) {
                        const currentTask = (await client.task.findFirst({
                            where: { taskId: currentTaskId, deletedAt: null },
                            select: { parentTaskId: true },
                        }));
                        if (currentTask) {
                            count += 1;
                            currentTaskId = currentTask.parentTaskId;
                        }
                        else {
                            break;
                        }
                    }
                    return count;
                },
                calculateEndDate(startDate, duration) {
                    const startDateObj = new Date(startDate);
                    const endDate = new Date(startDateObj);
                    const integerPart = Math.floor(duration);
                    endDate.setDate(startDateObj.getDate() + integerPart);
                    const fractionalPartInHours = (duration % 1) * 24;
                    endDate.setHours(startDateObj.getHours() + fractionalPartInHours);
                    return endDate;
                },
                async findMaxEndDateAmongTasks(projectId) {
                    const tasks = await client.task.findMany({
                        where: { projectId: projectId, deletedAt: null },
                        select: {
                            startDate: true,
                            duration: true,
                            dueDate: true,
                            milestoneIndicator: true,
                        },
                    });
                    let maxEndDate = null;
                    tasks.forEach((task) => {
                        if (task.startDate &&
                            task.duration !== null &&
                            task.duration !== undefined) {
                            // Check if milestone is true and use dueDate in that case
                            const endDate = task.milestoneIndicator && task.dueDate
                                ? new Date(task.dueDate)
                                : client.task.calculateEndDate(task.startDate, task.duration);
                            if (!maxEndDate || endDate > maxEndDate) {
                                maxEndDate = endDate;
                            }
                        }
                    });
                    return maxEndDate;
                },
                async getSubtasksTimeline(taskId) {
                    const task = await client.task.findFirst({
                        where: { taskId },
                        include: {
                            subtasks: true,
                        },
                    });
                    if (!task) {
                        return { earliestStartDate: null, lowestEndDate: null };
                    }
                    let earliestStartDate = task.startDate;
                    let lowestEndDate = task.milestoneIndicator
                        ? task.dueDate
                        : new Date(task.startDate);
                    if (!task.milestoneIndicator && task.duration) {
                        const endDate = new Date(task.startDate);
                        endDate.setDate(task.startDate.getDate() + task.duration);
                        lowestEndDate = endDate;
                    }
                    if (task.subtasks.length > 0) {
                        task.subtasks.forEach((subtask) => {
                            if (subtask.startDate < earliestStartDate) {
                                earliestStartDate = subtask.startDate;
                            }
                            if (subtask.dueDate &&
                                (lowestEndDate === null || subtask.dueDate < lowestEndDate)) {
                                lowestEndDate = subtask.dueDate;
                            }
                        });
                    }
                    return { earliestStartDate, lowestEndDate };
                },
                async calculateTaskPlannedProgression(task, tenantId, organisationId) {
                    const currentDate = new Date().getTime();
                    const taskStartDate = new Date(task.startDate).getTime();
                    const taskEndDate = client.task
                        .calculateEndDate(task.startDate, task.duration);
                    const effectiveCurrentDate = Math.min(currentDate, (taskEndDate).getTime()); // Use task end date if currentDate is greater
                    const newDuration = await calculateWorkingDays(task.startDate, taskEndDate, tenantId, organisationId);
                    const plannedProgression = (effectiveCurrentDate - taskStartDate + 1) /
                        (newDuration * settings.hours);
                    return plannedProgression;
                },
            },
            comments: {
                async canEditOrDelete(commentId, userId) {
                    const comment = await client.comments.findFirstOrThrow({
                        where: { commentId, deletedAt: null },
                        include: {
                            commentByUser: true,
                        },
                    });
                    const userRoles = await client.user.getUserRoles(userId);
                    const allowedRoles = [
                        UserRoleEnum.ADMINISTRATOR,
                        UserRoleEnum.PROJECT_MANAGER,
                    ];
                    const isCommentAuthor = comment.commentByUser.userId === userId;
                    const canPerformAction = userRoles.some((role) => allowedRoles.includes(role)) ||
                        isCommentAuthor;
                    return canPerformAction;
                },
            },
            taskAttachment: {
                async canDelete(attachmentId, userId) {
                    const attachment = await client.taskAttachment.findFirstOrThrow({
                        where: { attachmentId: attachmentId, deletedAt: null },
                        include: {
                            task: {
                                include: {
                                    assignedUsers: {
                                        where: { deletedAt: null },
                                        include: {
                                            user: true,
                                        },
                                    },
                                },
                            },
                        },
                    });
                    const userRoles = await client.user.getUserRoles(userId);
                    const allowedRoles = [
                        UserRoleEnum.ADMINISTRATOR,
                        UserRoleEnum.PROJECT_MANAGER,
                    ];
                    const isAttachmentAuthor = attachment.uploadedBy === userId;
                    const canPerformAction = userRoles.some((role) => allowedRoles.includes(role)) ||
                        isAttachmentAuthor;
                    return canPerformAction;
                },
            },
            taskDependencies: {
                async canDelete(taskDependenciesId, userId) {
                    const dependencies = await client.taskDependencies.findFirstOrThrow({
                        where: {
                            taskDependenciesId: taskDependenciesId,
                            deletedAt: null,
                        },
                    });
                    const userRoles = await client.user.getUserRoles(userId);
                    const allowedRoles = [
                        UserRoleEnum.ADMINISTRATOR,
                        UserRoleEnum.PROJECT_MANAGER,
                    ];
                    const isAdminOrProjectManager = userRoles.some((role) => allowedRoles.includes(role));
                    const isDependenciesAuthor = dependencies.dependenciesAddedBy === userId;
                    const canPerformAction = userRoles.some((role) => allowedRoles.includes(role)) ||
                        isDependenciesAuthor;
                    return canPerformAction;
                },
            },
            user: {
                async getUserRoles(userId) {
                    const user = await client.user.findFirstOrThrow({
                        include: {
                            userOrganisation: {
                                where: { deletedAt: null },
                                select: {
                                    role: true,
                                },
                            },
                        },
                        where: {
                            userId: userId,
                            deletedAt: null,
                        },
                    });
                    return user.userOrganisation.map((org) => org.role);
                },
            },
        },
    });
    return client;
}
export async function getClientByTenantId(tenantId) {
    if (!tenantId) {
        return prismaClients.root;
    }
    const findTenant = await prismaClients.root?.tenant.findUnique({
        where: { tenantId: tenantId },
    });
    if (!findTenant) {
        return prismaClients.root;
    }
    prismaClients[tenantId] = generatePrismaClient(findTenant.connectionString);
    return prismaClients[tenantId];
}
