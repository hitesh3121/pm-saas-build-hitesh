import { TaskDependenciesEnum, TaskStatusEnum } from "@prisma/client";
import { getClientByTenantId } from "../config/db.js";
import { getNextWorkingDay, taskEndDate } from "./calcualteTaskEndDate.js";
import { calculateDurationAndPercentage, updateSubtasks, updateSubtasksDependencies, } from "./taskRecursion.js";
import { BadRequestError } from "../config/apiError.js";
export const dependenciesManage = async (tenantId, organisationId, taskId, endDateCurr, userId) => {
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
    const endDate = await getNextWorkingDay(endDateCurr, tenantId, organisationId);
    if (findTask && findTask.dependencies.length > 0) {
        const taskUpdateDB = await prisma.task.update({
            where: { taskId: findTask.taskId },
            data: {
                startDate: new Date(endDate),
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
        for (let task of taskUpdateDB.subtasks) {
            await updateSubtasksDependencies(task.taskId, endDate, userId, tenantId);
        }
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
    if (dependentType == TaskDependenciesEnum.SUCCESSORS &&
        dependencyOnTask &&
        (dependencyOnTask.status == TaskStatusEnum.IN_PROGRESS ||
            dependencyOnTask.status == TaskStatusEnum.COMPLETED)) {
        throw new BadRequestError("You can not add on going or completed dependent task as successor dependency.");
    }
    if (dependentType === TaskDependenciesEnum.PREDECESSORS) {
        if (latestTask.dependencies.some((obj) => obj.dependentType === TaskDependenciesEnum.PREDECESSORS)) {
            throw new BadRequestError("Already have Predecessors dependencies on this task, you only add one!!");
        }
        await detectCycleInDependency(dependendentOnTaskId, tenantId, organisationId, taskId);
    }
    else {
        if (dependencyOnTask.dependencies.some((obj) => obj.dependentType === TaskDependenciesEnum.PREDECESSORS)) {
            throw new BadRequestError("Already have Predecessors dependencies on dependent task!!");
        }
        await detectCycleInDependency(taskId, tenantId, organisationId, dependendentOnTaskId);
    }
    const endDateLatestTask_curr = await taskEndDate(latestTask, tenantId, organisationId);
    const endDateLatestTask = await getNextWorkingDay(new Date(endDateLatestTask_curr), tenantId, organisationId);
    const endDateDependentTask_curr = await taskEndDate(dependencyOnTask, tenantId, organisationId);
    const endDateDependentTask = await getNextWorkingDay(new Date(endDateDependentTask_curr), tenantId, organisationId);
    let updatedTask;
    let addDependencies1;
    let addDependencies2;
    if (dependentType == TaskDependenciesEnum.PREDECESSORS) {
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
                },
            }),
        ]);
        addDependencies1 = value1;
        addDependencies2 = value2;
        updatedTask = value3;
        const endDateUpdatedTask = await taskEndDate(updatedTask, tenantId, organisationId);
        if (value3 && value3.subtasks) {
            await updateSubtasks(value3.subtasks, value3.startDate, userId, tenantId);
        }
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
                            },
                        });
                    }
                }
            }
        }
    }
    else {
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
                },
            }),
        ]);
        addDependencies1 = value1;
        addDependencies2 = value2;
        updatedTask = value3;
        const endDateUpdatedTask = await taskEndDate(updatedTask, tenantId, organisationId);
        if (value3 && value3.subtasks) {
            await updateSubtasks(value3.subtasks, updatedTask.startDate, userId, tenantId);
        }
        if (updatedTask.dependencies.length > 0) {
            for (let obj of updatedTask.dependencies) {
                if (obj.dependentType === TaskDependenciesEnum.SUCCESSORS) {
                    await dependenciesManage(tenantId, organisationId, obj.dependendentOnTaskId, new Date(endDateUpdatedTask), userId);
                }
            }
        }
    }
    return [addDependencies1, addDependencies2];
};
export const handleSubTaskUpdation = async (tenantId, organisationId, taskId, completionPecentage, currentTaskId, startDate) => {
    const prisma = await getClientByTenantId(tenantId);
    const task = await prisma.task.findFirst({
        where: {
            taskId: taskId,
        },
        include: {
            dependencies: {
                include: {
                    dependentOnTask: true,
                },
            },
            parent: true,
        },
    });
    if (task && task.dependencies && task.dependencies.length > 0) {
        for (let obj of task.dependencies) {
            if (obj.dependentType === TaskDependenciesEnum.PREDECESSORS) {
                const dependencyTask = await prisma.task.findFirst({
                    where: { taskId: obj.dependendentOnTaskId, deletedAt: null },
                });
                if (completionPecentage &&
                    dependencyTask &&
                    dependencyTask.status !== TaskStatusEnum.COMPLETED) {
                    throw new BadRequestError("You can not change the progress percentage of this task as it have predecessors dependency.");
                }
                if (dependencyTask) {
                    const endDateDependencyTask = new Date(await taskEndDate(dependencyTask, tenantId, organisationId));
                    if (startDate && endDateDependencyTask >= new Date(startDate)) {
                        if (currentTaskId === taskId) {
                            throw new BadRequestError(`This task has an end to start dependency with ${dependencyTask.taskName}. Would you like to remove the dependency?`);
                        }
                        else {
                            throw new BadRequestError(`This task or it's parent task has an end to start dependency with ${dependencyTask.taskName}. You can not chnage start date.`);
                        }
                    }
                }
            }
        }
    }
    if (task && task.parent && task.parent.taskId) {
        await handleSubTaskUpdation(tenantId, organisationId, task.parent.taskId, completionPecentage, currentTaskId, startDate);
    }
};
export const detectCycleInDependency = async (taskId, tenantId, organisationId, givenTaskId) => {
    const prisma = await getClientByTenantId(tenantId);
    const task = await prisma.task.findFirstOrThrow({
        where: { taskId: taskId, deletedAt: null },
        include: {
            dependencies: {
                where: { deletedAt: null },
            },
        },
    });
    if (task.dependencies && task.dependencies.length > 0) {
        for (let obj of task.dependencies) {
            if (obj.dependentType === TaskDependenciesEnum.PREDECESSORS) {
                if (obj.dependendentOnTaskId === givenTaskId) {
                    throw new BadRequestError("You can not add cyclic dependency!");
                }
                else {
                    await detectCycleChild(obj.dependendentOnTaskId, tenantId, givenTaskId);
                    await detectCycleInDependency(obj.dependendentOnTaskId, tenantId, organisationId, givenTaskId);
                }
            }
        }
    }
};
export const detectCycleChild = async (taskId, tenantId, givenId) => {
    const prisma = await getClientByTenantId(tenantId);
    const task = await prisma.task.findFirst({
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
        },
    });
    if (task && task.subtasks && task.subtasks.length > 0) {
        for (let sub of task.subtasks) {
            if (sub.taskId == givenId) {
                throw new BadRequestError("You can not add cyclic dependency!");
            }
            if (sub.subtasks && sub.subtasks.length > 0) {
                await detectCycleChild(sub.taskId, tenantId, givenId);
            }
        }
    }
};
