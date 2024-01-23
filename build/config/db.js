import { PrismaClient, UserRoleEnum, UserStatusEnum, } from "@prisma/client";
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
                    needs: { startDate: true, duration: true },
                    compute(task) {
                        const { startDate, duration } = task;
                        const startDateObj = new Date(startDate);
                        const endDate = startDateObj;
                        const integerPart = Math.floor(duration);
                        endDate.setDate(startDateObj.getDate() + integerPart); // Duration as days
                        const fractionalPartInHours = (duration % 1) * 24; // Duration as hours
                        endDate.setHours(startDateObj.getHours() + fractionalPartInHours);
                        return endDate;
                    },
                },
                flag: {
                    needs: { milestoneIndicator: true },
                    compute(task) {
                        let { milestoneIndicator, duration, completionPecentage } = task;
                        //TODO: Need to change logic here
                        const plannedProgress = duration / duration;
                        if (!completionPecentage) {
                            completionPecentage = 100;
                        }
                        const tpi = completionPecentage / plannedProgress;
                        if (milestoneIndicator) {
                            return tpi < 1 ? "Red" : "Green";
                        }
                        else {
                            if (tpi < 0.8) {
                                return "Red";
                            }
                            else if (tpi >= 0.8 && tpi < 0.95) {
                                return "Orange";
                            }
                            else {
                                return "Green";
                            }
                        }
                    },
                },
            },
        },
        model: {
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
                        },
                    });
                },
            },
            project: {
                async projectProgression(projectId) {
                    const hours = 24;
                    const parentTasks = await client.task.findMany({
                        where: {
                            projectId,
                            parentTaskId: null,
                        },
                    });
                    let completionPecentageOrDuration = 0;
                    let averagesSumOfDuration = 0;
                    for (const value of parentTasks) {
                        completionPecentageOrDuration +=
                            Number(value.completionPecentage) * (value.duration * hours);
                    }
                    for (const secondValue of parentTasks) {
                        averagesSumOfDuration += secondValue.duration * hours * 100;
                    }
                    return completionPecentageOrDuration / averagesSumOfDuration;
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
                        where: { taskId },
                        include: {
                            assignedUsers: {
                                include: {
                                    user: true,
                                },
                            },
                        },
                    });
                },
                calculationSubTaskProgression(task) {
                    if (task.subtasks && task.subtasks.length > 0) {
                        const hours = 24;
                        let completionPecentageOrDurationTask = 0;
                        let averagesSumOfDurationTask = 0;
                        for (const value of task.subtasks) {
                            const percentage = client.task.calculationSubTaskProgression(value);
                            completionPecentageOrDurationTask +=
                                Number(percentage) * (value.duration * hours);
                            averagesSumOfDurationTask += value.duration * hours * 100;
                        }
                        return ((completionPecentageOrDurationTask / averagesSumOfDurationTask) *
                            100);
                    }
                    else {
                        return task.completionPecentage;
                    }
                },
                async calculateSubTask(startingTaskId) {
                    let currentTaskId = startingTaskId;
                    let count = 0;
                    while (currentTaskId) {
                        const currentTask = (await client.task.findFirst({
                            where: { taskId: currentTaskId },
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
            },
            comments: {
                async canEditOrDelete(commentId, userId) {
                    const comment = await client.comments.findFirstOrThrow({
                        where: { commentId },
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
                        where: { attachmentId: attachmentId },
                        include: {
                            task: {
                                include: {
                                    assignedUsers: {
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
                                select: {
                                    role: true,
                                },
                            },
                        },
                        where: {
                            userId: userId,
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
