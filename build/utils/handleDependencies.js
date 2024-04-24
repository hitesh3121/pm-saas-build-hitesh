import { TaskDependenciesEnum } from "@prisma/client";
import { getClientByTenantId } from "../config/db.js";
import { taskEndDate } from "./calcualteTaskEndDate.js";
import { calculateDurationAndPercentage } from "./taskRecursion.js";
import { BadRequestError } from "../config/apiError.js";
export const dependenciesManage = async (tenantId, organisationId, taskId, endDate, userId) => {
    const prisma = await getClientByTenantId(tenantId);
    const findTask = await prisma.task.findFirst({
        where: { taskId, deletedAt: null },
        include: {
            parent: true,
            subtasks: true,
            dependencies: {
                where: { deletedAt: null },
                include: {
                    dependentOnTask: true,
                },
            },
        },
    });
    if (findTask && findTask.dependencies.length > 0) {
        const taskUpdateDB = await prisma.task.update({
            where: { taskId: findTask.taskId },
            data: {
                startDate: findTask.startDate < endDate ? endDate : findTask.startDate,
                updatedByUserId: userId,
            },
            include: {
                documentAttachments: true,
                assignedUsers: true,
                dependencies: {
                    include: {
                        dependentOnTask: true,
                    },
                },
                project: true,
                parent: true,
                subtasks: true,
            },
        });
        const endDateOfOne = await taskEndDate(taskUpdateDB, tenantId, organisationId);
        if (taskUpdateDB.parent?.taskId) {
            await calculateDurationAndPercentage(taskUpdateDB.parent?.taskId, tenantId, organisationId);
        }
        if (taskUpdateDB.dependencies && taskUpdateDB.dependencies.length > 0) {
            for (let singleTask of taskUpdateDB.dependencies) {
                if (singleTask.dependentType === TaskDependenciesEnum.SUCCESSORS) {
                    await dependenciesManage(tenantId, organisationId, singleTask.dependendentOnTaskId, new Date(endDateOfOne), userId);
                }
            }
        }
    }
    return;
};
export const addDependenciesHelper = async (taskId, dependendentOnTaskId, tenantId, organisationId, userId, dependentType) => {
    const prisma = await getClientByTenantId(tenantId);
    const latestTask = await prisma.task.findFirstOrThrow({
        where: { taskId: taskId, deletedAt: null },
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
            dependencies: {
                where: { deletedAt: null },
                include: {
                    dependentOnTask: true,
                },
            },
        },
    });
    const dependencyOnTask = await prisma.task.findFirstOrThrow({
        where: { taskId: dependendentOnTaskId, deletedAt: null },
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
            dependencies: {
                where: { deletedAt: null },
                include: {
                    dependentOnTask: true,
                },
            },
        },
    });
    if (dependentType === TaskDependenciesEnum.PREDECESSORS) {
        if (latestTask.dependencies.some((obj) => obj.dependentType === TaskDependenciesEnum.PREDECESSORS)) {
            throw new BadRequestError("Already have Predecessors dependencies on this task, you only add one!!");
        }
    }
    else {
        if (dependencyOnTask.dependencies.some((obj) => obj.dependentType === TaskDependenciesEnum.PREDECESSORS)) {
            throw new BadRequestError("Already have Predecessors dependencies on dependent task!!");
        }
    }
    const endDateLatestTask = await taskEndDate(latestTask, tenantId, organisationId);
    const endDateDependentTask = await taskEndDate(dependencyOnTask, tenantId, organisationId);
    let updatedTask;
    let addDependencies1;
    let addDependencies2;
    if (dependentType == TaskDependenciesEnum.PREDECESSORS) {
        if (latestTask &&
            dependencyOnTask &&
            latestTask.startDate < new Date(endDateDependentTask)) {
            const [value1, value2, value3] = await prisma.$transaction([
                prisma.taskDependencies.create({
                    data: {
                        dependentType: dependentType,
                        dependentTaskId: taskId,
                        dependendentOnTaskId: dependendentOnTaskId,
                        dependenciesAddedBy: userId,
                    },
                    include: {
                        dependentOnTask: {
                            select: {
                                taskName: true,
                            },
                        },
                    },
                }),
                prisma.taskDependencies.create({
                    data: {
                        dependentType: TaskDependenciesEnum.SUCCESSORS,
                        dependentTaskId: dependendentOnTaskId,
                        dependendentOnTaskId: taskId,
                        dependenciesAddedBy: userId,
                    },
                    include: {
                        dependentOnTask: {
                            select: {
                                taskName: true,
                            },
                        },
                    },
                }),
                prisma.task.update({
                    where: { taskId: taskId },
                    data: {
                        startDate: new Date(endDateDependentTask),
                        updatedByUserId: userId,
                    },
                    include: {
                        documentAttachments: true,
                        assignedUsers: true,
                        dependencies: true,
                        project: true,
                        parent: true,
                        subtasks: true,
                    },
                }),
            ]);
            addDependencies1 = value1;
            addDependencies2 = value2;
            updatedTask = value3;
            const endDateUpdatedTask = await taskEndDate(updatedTask, tenantId, organisationId);
            if (updatedTask.dependencies.length > 0) {
                for (let obj of updatedTask.dependencies) {
                    if (obj.dependentType === TaskDependenciesEnum.SUCCESSORS) {
                        const successorsTaskToUpdate = await prisma.task.findFirstOrThrow({
                            where: { taskId: obj.dependendentOnTaskId, deletedAt: null },
                            include: {
                                documentAttachments: {
                                    where: { deletedAt: null },
                                },
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
                                dependencies: {
                                    where: { deletedAt: null },
                                    include: {
                                        dependentOnTask: true,
                                    },
                                },
                            },
                        });
                        if (successorsTaskToUpdate.startDate < new Date(endDateUpdatedTask)) {
                            await prisma.task.update({
                                where: {
                                    taskId: obj.dependendentOnTaskId,
                                },
                                data: {
                                    startDate: new Date(endDateUpdatedTask),
                                    updatedByUserId: userId,
                                },
                                include: {
                                    documentAttachments: true,
                                    assignedUsers: true,
                                    dependencies: true,
                                    project: true,
                                    parent: true,
                                    subtasks: true,
                                },
                            });
                        }
                    }
                }
            }
        }
        else {
            const [value1, value2] = await prisma.$transaction([
                prisma.taskDependencies.create({
                    data: {
                        dependentType: dependentType,
                        dependentTaskId: taskId,
                        dependendentOnTaskId: dependendentOnTaskId,
                        dependenciesAddedBy: userId,
                    },
                    include: {
                        dependentOnTask: {
                            select: {
                                taskName: true,
                            },
                        },
                    },
                }),
                prisma.taskDependencies.create({
                    data: {
                        dependentType: TaskDependenciesEnum.SUCCESSORS,
                        dependentTaskId: dependendentOnTaskId,
                        dependendentOnTaskId: taskId,
                        dependenciesAddedBy: userId,
                    },
                    include: {
                        dependentOnTask: {
                            select: {
                                taskName: true,
                            },
                        },
                    },
                }),
            ]);
            addDependencies1 = value1;
            addDependencies2 = value2;
        }
    }
    else {
        if (latestTask &&
            dependencyOnTask &&
            dependencyOnTask.startDate < new Date(endDateLatestTask)) {
            const [value1, value2, value3] = await prisma.$transaction([
                prisma.taskDependencies.create({
                    data: {
                        dependentType: dependentType,
                        dependentTaskId: taskId,
                        dependendentOnTaskId: dependendentOnTaskId,
                        dependenciesAddedBy: userId,
                    },
                    include: {
                        dependentOnTask: {
                            select: {
                                taskName: true,
                            },
                        },
                    },
                }),
                prisma.taskDependencies.create({
                    data: {
                        dependentType: TaskDependenciesEnum.PREDECESSORS,
                        dependentTaskId: dependendentOnTaskId,
                        dependendentOnTaskId: taskId,
                        dependenciesAddedBy: userId,
                    },
                    include: {
                        dependentOnTask: {
                            select: {
                                taskName: true,
                            },
                        },
                    },
                }),
                prisma.task.update({
                    where: { taskId: dependendentOnTaskId },
                    data: {
                        startDate: new Date(endDateLatestTask),
                        updatedByUserId: userId,
                    },
                    include: {
                        documentAttachments: true,
                        assignedUsers: true,
                        dependencies: true,
                        project: true,
                        parent: true,
                        subtasks: true,
                    },
                }),
            ]);
            addDependencies1 = value1;
            addDependencies2 = value2;
            updatedTask = value3;
            const endDateUpdatedTask = await taskEndDate(updatedTask, tenantId, organisationId);
            if (updatedTask.dependencies.length > 0) {
                for (let obj of updatedTask.dependencies) {
                    if (obj.dependentType === TaskDependenciesEnum.SUCCESSORS) {
                        await dependenciesManage(tenantId, organisationId, obj.dependendentOnTaskId, new Date(endDateUpdatedTask), userId);
                    }
                }
            }
        }
        else {
            const [value1, value2] = await prisma.$transaction([
                prisma.taskDependencies.create({
                    data: {
                        dependentType: dependentType,
                        dependentTaskId: taskId,
                        dependendentOnTaskId: dependendentOnTaskId,
                        dependenciesAddedBy: userId,
                    },
                    include: {
                        dependentOnTask: {
                            select: {
                                taskName: true,
                            },
                        },
                    },
                }),
                prisma.taskDependencies.create({
                    data: {
                        dependentType: TaskDependenciesEnum.PREDECESSORS,
                        dependentTaskId: dependendentOnTaskId,
                        dependendentOnTaskId: taskId,
                        dependenciesAddedBy: userId,
                    },
                    include: {
                        dependentOnTask: {
                            select: {
                                taskName: true,
                            },
                        },
                    },
                }),
                prisma.task.update({
                    where: { taskId: dependendentOnTaskId },
                    data: {
                        startDate: new Date(endDateLatestTask),
                        updatedByUserId: userId,
                    },
                    include: {
                        documentAttachments: true,
                        assignedUsers: true,
                        dependencies: true,
                        project: true,
                        parent: true,
                        subtasks: true,
                    },
                }),
            ]);
            addDependencies1 = value1;
            addDependencies2 = value2;
        }
    }
    return [addDependencies1, addDependencies2];
};
