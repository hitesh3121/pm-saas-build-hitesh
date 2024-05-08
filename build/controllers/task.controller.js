import { StatusCodes } from "http-status-codes";
import { NotificationTypeEnum, TaskStatusEnum, UserStatusEnum, MilestoneIndicatorStatusEnum, TaskDependenciesEnum, } from "@prisma/client";
import { getClientByTenantId } from "../config/db.js";
import { BadRequestError, NotFoundError, SuccessResponse, UnAuthorizedError, } from "../config/apiError.js";
import { projectIdSchema } from "../schemas/projectSchema.js";
import { createCommentTaskSchema, createTaskSchema, attachmentTaskSchema, taskStatusSchema, updateTaskSchema, assginedToUserIdSchema, dependenciesTaskSchema, milestoneTaskSchema, } from "../schemas/taskSchema.js";
import { AwsUploadService } from "../services/aws.services.js";
import { uuidSchema } from "../schemas/commonSchema.js";
import { HistoryTypeEnumValue } from "../schemas/enums.js";
import { removeProperties } from "../types/removeProperties.js";
import { taskEndDate } from "../utils/calcualteTaskEndDate.js";
import { selectUserFields } from "../utils/selectedFieldsOfUsers.js";
import { calculationSubTaskProgression } from "../utils/calculationSubTaskProgression.js";
import { taskFlag } from "../utils/calculationFlag.js";
import { calculateProjectEndDate } from "../utils/calculateProjectEndDate.js";
import { calculateDurationAndPercentage, checkTaskStatus, deleteSubtasks, } from "../utils/taskRecursion.js";
import { generateOTP } from "../utils/otpHelper.js";
import { attachmentAddOrRemove, commentEditorDelete, dependenciesAddOrRemove, taskUpdateOrDelete, } from "../middleware/role.middleware.js";
import { enumToString } from "../utils/enumToString.js";
import { addDependenciesHelper, handleSubTaskUpdation, helper } from "../utils/handleDependencies.js";
import { reAssginedTaskSchema } from "../schemas/organisationSchema.js";
export const getTasks = async (req, res) => {
    if (!req.organisationId) {
        throw new BadRequestError("organisationId not found!!");
    }
    const organisationId = req.organisationId;
    const projectId = projectIdSchema.parse(req.params.projectId);
    const prisma = await getClientByTenantId(req.tenantId);
    const tasks = await prisma.task.findMany({
        where: { projectId: projectId, deletedAt: null },
        orderBy: { createdAt: "desc" },
        include: {
            assignedUsers: {
                where: { deletedAt: null },
                select: {
                    taskAssignUsersId: true,
                    user: {
                        select: selectUserFields,
                    },
                },
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
            dependencies: true,
        },
    });
    const finalArray = await Promise.all(tasks.map(async (task) => {
        const endDate = await taskEndDate(task, req.tenantId, organisationId);
        const completionPecentage = (await calculationSubTaskProgression(task, req.tenantId, organisationId)) ?? 0;
        const { flag, delay } = await taskFlag(task, req.tenantId, organisationId);
        const updatedTask = {
            ...task,
            flag,
            delay,
            endDate,
            completionPecentage,
        };
        return updatedTask;
    }));
    return new SuccessResponse(StatusCodes.OK, finalArray, "get all task successfully").send(res);
};
export const getTaskById = async (req, res) => {
    if (!req.organisationId) {
        throw new BadRequestError("organisationId not found!!");
    }
    const taskId = uuidSchema.parse(req.params.taskId);
    const prisma = await getClientByTenantId(req.tenantId);
    const task = await prisma.task.findFirstOrThrow({
        where: { taskId: taskId, deletedAt: null },
        include: {
            comments: {
                where: { parentCommentId: null },
                orderBy: { createdAt: "desc" },
                include: {
                    childComments: {
                        include: {
                            commentByUser: {
                                select: selectUserFields,
                            },
                        },
                    },
                    commentByUser: {
                        select: selectUserFields,
                    },
                },
            },
            assignedUsers: {
                where: { deletedAt: null },
                select: {
                    taskAssignUsersId: true,
                    user: {
                        select: selectUserFields,
                    },
                },
            },
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
            histories: {
                orderBy: { createdAt: "desc" },
                include: {
                    createdByUser: {
                        select: selectUserFields,
                    },
                },
            },
        },
    });
    const endDate = await taskEndDate(task, req.tenantId, req.organisationId);
    const completionPecentage = (await calculationSubTaskProgression(task, req.tenantId, req.organisationId)) ?? 0;
    const { flag, delay } = await taskFlag(task, req.tenantId, req.organisationId);
    const finalResponse = { ...task, completionPecentage, flag, endDate, delay };
    return new SuccessResponse(StatusCodes.OK, finalResponse, "task selected").send(res);
};
export const createTask = async (req, res) => {
    if (!req.userId) {
        throw new BadRequestError("userId not found!!");
    }
    if (!req.organisationId) {
        throw new BadRequestError("organisationId not found!!");
    }
    const { taskName, taskDescription, startDate, duration, completionPecentage, kanbanColumnId, } = createTaskSchema.parse(req.body);
    const projectId = projectIdSchema.parse(req.params.projectId);
    const prisma = await getClientByTenantId(req.tenantId);
    const parentTaskId = req.params.parentTaskId;
    const findTask = await prisma.task.findFirst({
        where: {
            projectId,
            taskName,
        },
    });
    if (findTask) {
        throw new BadRequestError("A task with a similar name already exists!");
    }
    if (parentTaskId) {
        const parentTask = await prisma.task.findUnique({
            where: { taskId: parentTaskId, deletedAt: null },
        });
        if (!parentTask) {
            throw new NotFoundError("Parent task not found");
        }
        if (parentTask && parentTask.milestoneIndicator) {
            throw new NotFoundError("Cannot add subtasks to a milestone task.");
        }
        // Handle subtask not more then 3
        const countOfSubTasks = await prisma.task.calculateSubTask(parentTaskId);
        if (countOfSubTasks > 3) {
            throw new BadRequestError("Maximum limit of sub tasks reached");
        }
    }
    const task = await prisma.task.create({
        data: {
            projectId: projectId,
            taskName: taskName,
            taskDescription: taskDescription,
            duration: duration,
            startDate: startDate,
            parentTaskId: parentTaskId ? parentTaskId : null,
            createdByUserId: req.userId,
            updatedByUserId: req.userId,
            completionPecentage,
            kanbanColumnId,
        },
        include: {
            documentAttachments: true,
            assignedUsers: true,
            dependencies: true,
        },
    });
    const fieldEntries = [];
    if (parentTaskId) {
        fieldEntries.push({
            message: `Subtask was created`,
            value: { oldValue: null, newValue: taskName },
        });
    }
    else {
        fieldEntries.push({
            message: `Task was created`,
            value: { oldValue: null, newValue: taskName },
        });
    }
    const excludedFields = ["taskName", "taskDescription", "kanbanColumnId"];
    for (const [fieldName, fieldValue] of Object.entries(createTaskSchema.parse(req.body))) {
        if (!excludedFields.includes(fieldName)) {
            if (fieldValue !== undefined && fieldValue !== null) {
                if (!(fieldName === "duration" && (fieldValue === 0 || fieldValue === 1))) {
                    const message = parentTaskId
                        ? `Subtask's ${fieldName} was added`
                        : `Task's ${fieldName} was added`;
                    fieldEntries.push({
                        message: message,
                        value: { oldValue: null, newValue: fieldValue },
                    });
                }
            }
        }
    }
    for (const entry of fieldEntries) {
        await prisma.history.createHistory(req.userId, HistoryTypeEnumValue.TASK, entry.message, entry.value, parentTaskId ? parentTaskId : task.taskId);
    }
    const statusHandle = await checkTaskStatus(task.taskId, req.tenantId, req.organisationId);
    const finalResponse = { ...task };
    return new SuccessResponse(StatusCodes.CREATED, finalResponse, "task created successfully").send(res);
};
export const updateTask = async (req, res) => {
    if (!req.userId) {
        throw new BadRequestError("userId not found!!");
    }
    if (!req.organisationId) {
        throw new BadRequestError("organisationId not found!!");
    }
    const taskId = uuidSchema.parse(req.params.taskId);
    const taskUpdateValue = updateTaskSchema.parse(req.body);
    const prisma = await getClientByTenantId(req.tenantId);
    const { hasAccessIf, findtask } = await taskUpdateOrDelete(taskId, req.role, req.userId, req.tenantId);
    if (!hasAccessIf) {
        throw new UnAuthorizedError("You are not authorized to edit tasks which are not assigned to you");
    }
    if (taskUpdateValue.startDate ||
        (taskUpdateValue.completionPecentage &&
            taskUpdateValue.completionPecentage > 0)) {
        await handleSubTaskUpdation(req.tenantId, req.organisationId, findtask.taskId, taskUpdateValue.completionPecentage ? true : false, taskId, taskUpdateValue.startDate);
    }
    const taskUpdateDB = await prisma.task.update({
        where: { taskId: taskId },
        data: {
            ...taskUpdateValue,
            updatedByUserId: req.userId,
        },
        include: {
            documentAttachments: { where: { deletedAt: null } },
            assignedUsers: {
                where: { deletedAt: null },
            },
            dependencies: {
                include: {
                    dependentOnTask: true,
                },
            },
            project: true,
            parent: {
                where: { deletedAt: null },
            },
            subtasks: {
                where: { deletedAt: null },
            },
        },
    });
    const endDateNew = await taskEndDate(taskUpdateDB, req.tenantId, req.organisationId);
    // const dependentTaskStartDate = await getNextWorkingDay
    if (taskUpdateDB &&
        taskUpdateDB.dependencies &&
        taskUpdateDB.dependencies.length > 0) {
        for (let dependantTask of taskUpdateDB.dependencies) {
            try {
                if (dependantTask.dependentType === TaskDependenciesEnum.SUCCESSORS) {
                    await helper(dependantTask.dependendentOnTaskId, req.tenantId, req.organisationId, req.userId, new Date(endDateNew));
                }
            }
            catch (error) {
                console.log(error, "while dependent recustion");
            }
        }
    }
    // Handle - parent- duration and end date
    if (taskUpdateDB.parent?.taskId) {
        await calculateDurationAndPercentage(taskUpdateDB.parent.taskId, req.tenantId, req.organisationId);
        await helper(taskUpdateDB.parent?.taskId, req.tenantId, req.organisationId, req.userId, new Date(endDateNew), false);
    }
    // Project End Date  -  If any task's end date will be greater then It's own
    const maxEndDate = await calculateProjectEndDate(taskUpdateDB.projectId, req.tenantId, req.organisationId);
    if (maxEndDate) {
        await prisma.project.update({
            where: {
                projectId: taskUpdateDB.project.projectId,
            },
            data: {
                actualEndDate: maxEndDate,
            },
        });
    }
    // History-Manage
    const updatedValueWithoutOtherTable = removeProperties(taskUpdateDB, [
        "documentAttachments",
        "assignedUsers",
        "dependencies",
        "milestoneIndicator",
        "kanbanColumnId",
    ]);
    const findTaskWithoutOtherTable = removeProperties(findtask, [
        "documentAttachments",
        "assignedUsers",
        "dependencies",
        "milestoneIndicator",
        "kanbanColumnId",
    ]);
    for (const key in taskUpdateValue) {
        if (updatedValueWithoutOtherTable[key] !== findTaskWithoutOtherTable[key]) {
            const historyMessage = `Task's ${key} was changed`;
            const historyData = {
                oldValue: key === "completionPecentage" && !findTaskWithoutOtherTable[key]
                    ? 0
                    : findTaskWithoutOtherTable[key],
                newValue: updatedValueWithoutOtherTable[key],
            };
            if (key === "startDate" &&
                historyData.newValue instanceof Date &&
                historyData.oldValue instanceof Date &&
                historyData.newValue.getTime() !== historyData.oldValue.getTime()) {
                await prisma.history.createHistory(req.userId, HistoryTypeEnumValue.TASK, historyMessage, historyData, taskId);
            }
            else if (key !== "startDate") {
                await prisma.history.createHistory(req.userId, HistoryTypeEnumValue.TASK, historyMessage, historyData, taskId);
            }
        }
    }
    const statusHandle = await checkTaskStatus(taskId, req.tenantId, req.organisationId);
    const returnUpdatedTask = await prisma.task.update({
        where: { taskId: taskId },
        data: {
            ...taskUpdateValue,
            updatedByUserId: req.userId,
        },
        include: {
            documentAttachments: { where: { deletedAt: null } },
            assignedUsers: {
                where: { deletedAt: null },
            },
            dependencies: {
                include: {
                    dependentOnTask: true,
                },
            },
            project: true,
            parent: {
                where: { deletedAt: null },
            },
            subtasks: {
                where: { deletedAt: null },
            },
        },
    });
    const endDate = await taskEndDate(returnUpdatedTask, req.tenantId, req.organisationId);
    let finalResponse = { ...returnUpdatedTask, endDate };
    if (returnUpdatedTask.parent) {
        const parentEndDate = await taskEndDate(returnUpdatedTask.parent, req.tenantId, req.organisationId);
        finalResponse = {
            ...finalResponse,
            parent: {
                ...returnUpdatedTask.parent,
                endDate: parentEndDate,
            },
        };
    }
    return new SuccessResponse(StatusCodes.OK, finalResponse, "task updated successfully").send(res);
};
export const deleteTask = async (req, res) => {
    if (!req.userId) {
        throw new BadRequestError("userId not found!!");
    }
    const taskId = uuidSchema.parse(req.params.taskId);
    const prisma = await getClientByTenantId(req.tenantId);
    const { hasAccessIf, findtask } = await taskUpdateOrDelete(taskId, req.role, req.userId, req.tenantId);
    if (!hasAccessIf) {
        throw new UnAuthorizedError("You are not authorized to delete task");
    }
    const otpValue = generateOTP();
    await prisma.task.update({
        where: { taskId },
        data: {
            deletedAt: new Date(),
            taskName: `${findtask.taskName}_deleted_${otpValue}`,
            assignedUsers: {
                deleteMany: {
                    taskId,
                },
            },
            dependentOnTask: {
                deleteMany: {
                    dependendentOnTaskId: taskId,
                },
            },
            dependencies: {
                deleteMany: {
                    dependentTaskId: taskId,
                },
            },
        },
        include: {
            comments: true,
            documentAttachments: true,
            subtasks: true,
            dependencies: true,
        },
    });
    if (findtask.subtasks.length > 0) {
        for (const subTask of findtask.subtasks) {
            await deleteSubtasks(subTask.taskId, subTask.taskName, otpValue, req.tenantId);
        }
    }
    return new SuccessResponse(StatusCodes.OK, null, "task deleted successfully").send(res);
};
export const statusChangeTask = async (req, res) => {
    if (!req.userId) {
        throw new BadRequestError("userId not found!!");
    }
    if (!req.organisationId) {
        throw new BadRequestError("organisationId not found!!");
    }
    const taskId = uuidSchema.parse(req.params.taskId);
    const statusBody = taskStatusSchema.parse(req.body);
    const prisma = await getClientByTenantId(req.tenantId);
    const { hasAccessIf, findtask } = await taskUpdateOrDelete(taskId, req.role, req.userId, req.tenantId);
    if (!hasAccessIf) {
        throw new UnAuthorizedError("You are not authorized to edit tasks which are not assigned to you");
    }
    if (statusBody.status === TaskStatusEnum.IN_PROGRESS ||
        statusBody.status === TaskStatusEnum.COMPLETED) {
        for (let obj of findtask.dependencies) {
            if (obj.dependentType === TaskDependenciesEnum.PREDECESSORS) {
                const dependencyTask = await prisma.task.findFirst({
                    where: { taskId: obj.dependendentOnTaskId, deletedAt: null },
                });
                if (dependencyTask &&
                    dependencyTask.status !== TaskStatusEnum.COMPLETED) {
                    throw new BadRequestError("You can not change the status of this task as it have predecessors dependency.");
                }
            }
        }
    }
    let completionPercentage = 0;
    if (statusBody.status === TaskStatusEnum.COMPLETED) {
        completionPercentage = 100;
    }
    else if (findtask.milestoneIndicator &&
        statusBody.status === TaskStatusEnum.NOT_STARTED) {
        completionPercentage = 0;
    }
    else if (statusBody.status === TaskStatusEnum.IN_PROGRESS) {
        completionPercentage = 50;
    }
    let updatedTask = await prisma.task.update({
        where: { taskId: taskId },
        data: {
            status: statusBody.status,
            milestoneStatus: statusBody.status === TaskStatusEnum.COMPLETED
                ? MilestoneIndicatorStatusEnum.COMPLETED
                : MilestoneIndicatorStatusEnum.NOT_STARTED,
            completionPecentage: completionPercentage,
            updatedByUserId: req.userId,
        },
    });
    // History-Manage
    const historyMessage = "Task’s status was changed";
    const historyData = {
        oldValue: enumToString(findtask.status),
        newValue: enumToString(statusBody.status),
    };
    await prisma.history.createHistory(req.userId, HistoryTypeEnumValue.TASK, historyMessage, historyData, taskId);
    const statusHandle = await checkTaskStatus(taskId, req.tenantId, req.organisationId);
    return new SuccessResponse(StatusCodes.OK, updatedTask, "task status change successfully").send(res);
};
export const statusCompletedAllTAsk = async (req, res) => {
    if (!req.userId) {
        throw new BadRequestError("userId not found!!");
    }
    const projectId = projectIdSchema.parse(req.params.projectId);
    const prisma = await getClientByTenantId(req.tenantId);
    const findAllTaskByProjectId = await prisma.task.findMany({
        where: { projectId: projectId, deletedAt: null },
    });
    if (findAllTaskByProjectId.length > 0) {
        await prisma.task.updateMany({
            where: { projectId: projectId },
            data: {
                status: TaskStatusEnum.COMPLETED,
                completionPecentage: 100,
                updatedByUserId: req.userId,
            },
        });
        // History-Manage
        for (const task of findAllTaskByProjectId) {
            const historyMessage = "Task’s status was changed";
            const historyNewValue = {
                oldValue: enumToString(task.status),
                newValue: enumToString(TaskStatusEnum.COMPLETED),
            };
            await prisma.history.createHistory(req.userId, HistoryTypeEnumValue.TASK, historyMessage, historyNewValue, task.taskId);
        }
        return new SuccessResponse(StatusCodes.OK, null, "all task status change to completed successfully").send(res);
    }
    throw new NotFoundError("Tasks not found!");
};
export const addComment = async (req, res) => {
    if (!req.userId) {
        throw new BadRequestError("userId not found!!");
    }
    const taskId = uuidSchema.parse(req.params.taskId);
    const { commentText, parentCommentId } = createCommentTaskSchema.parse(req.body);
    const prisma = await getClientByTenantId(req.tenantId);
    const comment = await prisma.comments.create({
        data: {
            taskId: taskId,
            commentByUserId: req.userId,
            commentText: commentText,
            parentCommentId: parentCommentId,
        },
    });
    return new SuccessResponse(StatusCodes.CREATED, comment, "comment added successfully").send(res);
};
export const updateComment = async (req, res) => {
    if (!req.userId) {
        throw new BadRequestError("userId not found!!");
    }
    const commentId = uuidSchema.parse(req.params.commentId);
    const { commentText } = createCommentTaskSchema.parse(req.body);
    const prisma = await getClientByTenantId(req.tenantId);
    const { hasAccessIf, findComment } = await commentEditorDelete(commentId, req.role, req.userId, req.tenantId);
    if (!hasAccessIf) {
        throw new UnAuthorizedError("You are not authorized to edit comment");
    }
    const updated = await prisma.comments.update({
        where: { commentId: commentId },
        data: { commentText: commentText },
    });
    return new SuccessResponse(StatusCodes.OK, updated, "comment updated successfully").send(res);
};
export const deleteComment = async (req, res) => {
    if (!req.userId) {
        throw new BadRequestError("userId not found!!");
    }
    const commentId = uuidSchema.parse(req.params.commentId);
    const prisma = await getClientByTenantId(req.tenantId);
    const { hasAccessIf, findComment } = await commentEditorDelete(commentId, req.role, req.userId, req.tenantId);
    if (!hasAccessIf) {
        throw new UnAuthorizedError("You are not authorized to delete comment");
    }
    await prisma.comments.delete({ where: { commentId } });
    return new SuccessResponse(StatusCodes.OK, null, "comment deleted successfully").send(res);
};
export const addAttachment = async (req, res) => {
    if (!req.userId) {
        throw new BadRequestError("userId not found!!");
    }
    const taskId = uuidSchema.parse(req.params.taskId);
    const prisma = await getClientByTenantId(req.tenantId);
    const { hasAccessIf, findAttchment } = await attachmentAddOrRemove(taskId, req.role, req.userId, req.tenantId, "Add");
    if (!hasAccessIf) {
        throw new UnAuthorizedError("You are not authorized to add attachment");
    }
    let files = [];
    const taskAttachmentFiles = attachmentTaskSchema.parse(req.files?.taskAttachment);
    if (Array.isArray(taskAttachmentFiles)) {
        files = taskAttachmentFiles;
    }
    else {
        files.push(taskAttachmentFiles);
    }
    for (const singleFile of files) {
        const taskAttachmentURL = await AwsUploadService.uploadFileWithContent(`${req.userId}-${singleFile?.name}`, singleFile?.data, "task-attachment");
        await prisma.taskAttachment.create({
            data: {
                taskId: taskId,
                url: taskAttachmentURL,
                name: singleFile.name,
                uploadedBy: req.userId,
            },
        });
        // History-Manage
        const historyMessage = "Task's attachment was added";
        const historyData = { oldValue: null, newValue: singleFile.name };
        await prisma.history.createHistory(req.userId, HistoryTypeEnumValue.TASK, historyMessage, historyData, taskId);
    }
    const findTask = await prisma.task.findFirst({
        where: { taskId: taskId, deletedAt: null },
        include: { documentAttachments: true },
    });
    return new SuccessResponse(StatusCodes.CREATED, findTask, "Add attachment successfully").send(res);
};
export const deleteAttachment = async (req, res) => {
    if (!req.userId) {
        throw new BadRequestError("userId not found!!");
    }
    const attachmentId = uuidSchema.parse(req.params.attachmentId);
    const prisma = await getClientByTenantId(req.tenantId);
    const { hasAccessIf, findAttchment } = await attachmentAddOrRemove(attachmentId, req.role, req.userId, req.tenantId, "Delete");
    if (!hasAccessIf) {
        throw new UnAuthorizedError("You are not authorized to delete attachment");
    }
    //TODO: If Delete require on S3
    if (findAttchment) {
        try {
            const name = `${findAttchment.uploadedBy}-${findAttchment.name}`;
            await AwsUploadService.deleteFile(name, "task-attachment");
        }
        catch (error) {
            console.error("Error while deleting file from s3", error);
        }
    }
    const deletedAttachment = await prisma.taskAttachment.delete({
        where: { attachmentId },
    });
    // History-Manage
    const historyMessage = "Task's attachment was removed";
    const historyData = { oldValue: deletedAttachment.name, newValue: null };
    await prisma.history.createHistory(req.userId, HistoryTypeEnumValue.TASK, historyMessage, historyData, deletedAttachment.taskId);
    return new SuccessResponse(StatusCodes.OK, null, "Attachment deleted successfully").send(res);
};
export const taskAssignToUser = async (req, res) => {
    if (!req.organisationId) {
        throw new BadRequestError("organisationId not found!");
    }
    const projectId = uuidSchema.parse(req.params.projectId);
    const prisma = await getClientByTenantId(req.tenantId);
    const usersOfOrganisation = await prisma.projectAssignUsers.findMany({
        where: {
            projectId,
            user: {
                status: UserStatusEnum.ACTIVE,
                deletedAt: null,
            },
        },
        select: {
            projectId: true,
            assginedToUserId: true,
            projectAssignUsersId: true,
            user: {
                select: {
                    ...selectUserFields,
                    userOrganisation: {
                        select: {
                            role: true,
                        },
                    },
                },
            },
        },
    });
    return new SuccessResponse(StatusCodes.OK, usersOfOrganisation, "Get project's users successfully").send(res);
};
export const addMemberToTask = async (req, res) => {
    if (!req.userId) {
        throw new BadRequestError("userId not found!!");
    }
    const taskId = uuidSchema.parse(req.params.taskId);
    const prisma = await getClientByTenantId(req.tenantId);
    const { hasAccessIf, findtask } = await taskUpdateOrDelete(taskId, req.role, req.userId, req.tenantId);
    if (!hasAccessIf) {
        throw new UnAuthorizedError("You are not authorized to add member to task");
    }
    const { assginedToUserId } = assginedToUserIdSchema.parse(req.body);
    const member = await prisma.taskAssignUsers.create({
        data: {
            assginedToUserId: assginedToUserId,
            taskId: taskId,
        },
        include: {
            user: {
                select: {
                    email: true,
                },
            },
        },
    });
    //Send notification
    const message = `Task assigned to you`;
    await prisma.notification.sendNotification(NotificationTypeEnum.TASK, message, assginedToUserId, req.userId, taskId);
    // History-Manage
    const historyMessage = "Task's assignee was added";
    const historyData = { oldValue: null, newValue: member.user?.email };
    await prisma.history.createHistory(req.userId, HistoryTypeEnumValue.TASK, historyMessage, historyData, member.taskId);
    return new SuccessResponse(StatusCodes.CREATED, member, "Member added successfully").send(res);
};
export const deleteMemberFromTask = async (req, res) => {
    if (!req.userId) {
        throw new BadRequestError("userId not found!!");
    }
    const taskAssignUsersId = uuidSchema.parse(req.params.taskAssignUsersId);
    const prisma = await getClientByTenantId(req.tenantId);
    const findMember = await prisma.taskAssignUsers.findFirstOrThrow({
        where: {
            taskAssignUsersId: taskAssignUsersId,
        },
        include: {
            user: {
                select: {
                    email: true,
                },
            },
        },
    });
    const { hasAccessIf, findtask } = await taskUpdateOrDelete(findMember.taskId, req.role, req.userId, req.tenantId);
    if (!hasAccessIf) {
        throw new UnAuthorizedError("You are not authorized to remove member from task");
    }
    await prisma.taskAssignUsers.delete({
        where: {
            taskAssignUsersId: taskAssignUsersId,
        },
    });
    // History-Manage
    const historyMessage = "Task's assignee was removed";
    const historyData = { oldValue: findMember.user?.email, newValue: null };
    await prisma.history.createHistory(req.userId, HistoryTypeEnumValue.TASK, historyMessage, historyData, findMember.taskId);
    return new SuccessResponse(StatusCodes.OK, null, "Member deleted successfully").send(res);
};
export const addDependencies = async (req, res) => {
    if (!req.userId) {
        throw new BadRequestError("userId not found!!");
    }
    if (!req.organisationId) {
        throw new BadRequestError("organisationId not found!!");
    }
    const taskId = uuidSchema.parse(req.params.taskId);
    const prisma = await getClientByTenantId(req.tenantId);
    const { hasAccessIf, dependencies, findTask } = await dependenciesAddOrRemove(taskId, req.role, req.userId, req.tenantId, "Add");
    if (!hasAccessIf) {
        throw new UnAuthorizedError("You are not authorized to add dependenices");
    }
    const { dependentType, dependendentOnTaskId } = dependenciesTaskSchema.parse(req.body);
    if (findTask &&
        (findTask.status == TaskStatusEnum.IN_PROGRESS ||
            findTask.status == TaskStatusEnum.COMPLETED) &&
        dependentType == TaskDependenciesEnum.PREDECESSORS) {
        throw new BadRequestError("You can not add predecessors dependencies to Ongoing or Completed task.");
    }
    const findDependencies = await prisma.taskDependencies.findFirst({
        where: {
            dependendentOnTaskId,
            dependentTaskId: taskId,
        },
    });
    if (findDependencies) {
        throw new BadRequestError("Already have dependencies on this task!!");
    }
    const [addDependencies1, addDependencies2] = await addDependenciesHelper(taskId, dependendentOnTaskId, req.tenantId, req.organisationId, req.userId, dependentType);
    const historyMessage1 = "Task's dependency was added";
    const historyData1 = {
        oldValue: null,
        newValue: addDependencies1.dependentOnTask.taskName,
    };
    await prisma.history.createHistory(req.userId, HistoryTypeEnumValue.TASK, historyMessage1, historyData1, addDependencies1.dependentTaskId);
    const historyMessage2 = "Task's dependency was added";
    const historyData2 = {
        oldValue: null,
        newValue: addDependencies2.dependentOnTask.taskName,
    };
    await prisma.history.createHistory(req.userId, HistoryTypeEnumValue.TASK, historyMessage2, historyData2, addDependencies1.dependendentOnTaskId);
    return new SuccessResponse(StatusCodes.OK, null, "Dependencies added successfully").send(res);
};
export const removeDependencies = async (req, res) => {
    if (!req.userId) {
        throw new BadRequestError("userId not found!!");
    }
    const taskDependenciesId = uuidSchema.parse(req.params.taskDependenciesId);
    const prisma = await getClientByTenantId(req.tenantId);
    const { hasAccessIf, dependencies } = await dependenciesAddOrRemove(taskDependenciesId, req.role, req.userId, req.tenantId, "Delete");
    if (!hasAccessIf) {
        throw new UnAuthorizedError("You are not authorized to remove dependencies");
    }
    const findOneDependent = await prisma.taskDependencies.findFirst({
        where: {
            taskDependenciesId: taskDependenciesId,
        },
    });
    const findSecondDependent = await prisma.taskDependencies.findFirst({
        where: {
            dependendentOnTaskId: findOneDependent?.dependentTaskId,
            dependentTaskId: findOneDependent?.dependendentOnTaskId,
        },
    });
    const [deleteOne, deleteTwo] = await prisma.$transaction([
        prisma.taskDependencies.delete({
            where: {
                taskDependenciesId: taskDependenciesId,
            },
            include: {
                dependentOnTask: {
                    select: {
                        taskName: true,
                    },
                },
            },
        }),
        prisma.taskDependencies.delete({
            where: {
                taskDependenciesId: findSecondDependent?.taskDependenciesId,
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
    // History-Manage
    const historyMessage1 = "Task’s dependency was removed";
    const historyData1 = {
        oldValue: deleteOne.dependentOnTask.taskName,
        newValue: null,
    };
    await prisma.history.createHistory(req.userId, HistoryTypeEnumValue.TASK, historyMessage1, historyData1, deleteOne.dependentTaskId);
    const historyMessage2 = "Task’s dependency was removed";
    const historyData2 = {
        oldValue: deleteTwo.dependentOnTask.taskName,
        newValue: null,
    };
    await prisma.history.createHistory(req.userId, HistoryTypeEnumValue.TASK, historyMessage2, historyData2, deleteTwo.dependentTaskId);
    return new SuccessResponse(StatusCodes.OK, null, "Dependencies removed successfully").send(res);
};
export const addOrRemoveMilesstone = async (req, res) => {
    if (!req.userId) {
        throw new BadRequestError("userId not found!!");
    }
    if (!req.organisationId) {
        throw new BadRequestError("organisationId not found!!");
    }
    const taskId = uuidSchema.parse(req.params.taskId);
    const prisma = await getClientByTenantId(req.tenantId);
    const { hasAccessIf, findtask } = await taskUpdateOrDelete(taskId, req.role, req.userId, req.tenantId);
    if (!hasAccessIf) {
        throw new UnAuthorizedError("You are not authorized to add or remove milestone for this task");
    }
    const { milestoneIndicator } = milestoneTaskSchema.parse(req.body);
    const duration = 1; // If milestone then duration will be 1 : 23-02-2024 - dev_hitesh
    const milestone = await prisma.task.update({
        data: {
            milestoneIndicator: milestoneIndicator,
            duration,
            completionPecentage: 0, // If milestone then percentage will be 0 : 05-03-2024 - dev_hitesh,
            parentTaskId: milestoneIndicator && findtask.parentTaskId
                ? null
                : findtask.parentTaskId, // If milestone then parentTaskId will be null : 06-05-2024 - dev_hitesh,
        },
        where: {
            taskId: taskId,
        },
        include: { parent: { select: { taskId: true } } },
    });
    // Handle-auto-duration
    if (milestone && milestone.parent?.taskId) {
        const updatedParent = await prisma.task.findFirst({
            where: {
                taskId: milestone.parent.taskId,
            },
            include: { subtasks: true },
        });
        const subtaskDurations = updatedParent?.subtasks.map((subtask) => subtask.duration) ?? [];
        const maxSubtaskDuration = Math.max(...subtaskDurations);
        await prisma.task.update({
            where: {
                taskId: milestone.parent.taskId,
            },
            data: {
                duration: maxSubtaskDuration,
            },
        });
    }
    // History-Manage
    const milestoneMessage = milestoneIndicator ? "converted" : "reverted";
    const historyMessage = `Task was ${milestoneMessage} as a milestone`;
    const isMilestone = milestoneIndicator;
    const historyData = {
        oldValue: "",
        newValue: "",
    };
    await prisma.history.createHistory(req.userId, HistoryTypeEnumValue.TASK, historyMessage, historyData, taskId);
    return new SuccessResponse(StatusCodes.OK, milestone, "Milestone updated successfully").send(res);
};
export const reAssignTaskToOtherUser = async (req, res) => {
    const userId = req.userId;
    if (!userId) {
        throw new BadRequestError("userId not found!");
    }
    const prisma = await getClientByTenantId(req.tenantId);
    const projectId = uuidSchema.parse(req.params.projectId);
    const { oldUserId, newUserId } = reAssginedTaskSchema.parse(req.body);
    const oldUsersTasks = await prisma.taskAssignUsers.findMany({
        where: {
            assginedToUserId: oldUserId,
            deletedAt: null,
            task: {
                projectId,
            },
        },
        include: {
            task: true,
        },
    });
    for (const oldUsersTask of oldUsersTasks) {
        const deletedUser = await prisma.taskAssignUsers.delete({
            where: {
                taskAssignUsersId: oldUsersTask.taskAssignUsersId,
                taskId: oldUsersTask.taskId,
                task: {
                    projectId,
                },
            },
            include: {
                user: {
                    select: {
                        email: true,
                    },
                },
            },
        });
        const userExistInTask = await prisma.taskAssignUsers.findFirst({
            where: {
                assginedToUserId: newUserId,
                taskId: oldUsersTask.taskId,
                task: {
                    projectId,
                },
                deletedAt: null,
            },
        });
        if (!userExistInTask) {
            const newCreatedUser = await prisma.taskAssignUsers.create({
                data: {
                    assginedToUserId: newUserId,
                    taskId: oldUsersTask.taskId,
                },
                include: {
                    user: {
                        select: {
                            email: true,
                        },
                    },
                },
            });
            //Send notification
            const message = `Task reassigned to you`;
            await prisma.notification.sendNotification(NotificationTypeEnum.TASK, message, newUserId, userId, oldUsersTask.taskId);
            // History-Manage
            const historyMessage = "Task's assignee changed from";
            const historyData = {
                oldValue: deletedUser?.user?.email,
                newValue: newCreatedUser
                    ? newCreatedUser.user.email
                    : deletedUser?.user.email,
            };
            await prisma.history.createHistory(userId, HistoryTypeEnumValue.TASK, historyMessage, historyData, oldUsersTask.taskId);
        }
    }
    return new SuccessResponse(StatusCodes.OK, null, "Tasks reassigned successfully.").send(res);
};
export const allTaskOfUser = async (req, res) => {
    const userId = req.userId;
    const organisationId = req.organisationId;
    if (!userId) {
        throw new BadRequestError("userId not found!");
    }
    if (!organisationId) {
        throw new BadRequestError("organisationId not found!!");
    }
    const prisma = await getClientByTenantId(req.tenantId);
    const tasks = await prisma.task.findMany({
        where: {
            deletedAt: null,
            OR: [
                {
                    assignedUsers: {
                        some: {
                            deletedAt: null,
                            assginedToUserId: userId,
                        },
                    },
                },
                {
                    createdByUserId: userId,
                    deletedAt: null,
                },
            ],
        },
        orderBy: { createdAt: "desc" },
        include: {
            assignedUsers: {
                where: { deletedAt: null },
                select: {
                    taskAssignUsersId: true,
                    user: {
                        select: selectUserFields,
                    },
                },
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
            dependencies: true,
        },
    });
    const finalArray = await Promise.all(tasks.map(async (task) => {
        const endDate = await taskEndDate(task, req.tenantId, organisationId);
        const completionPecentage = (await calculationSubTaskProgression(task, req.tenantId, organisationId)) ?? 0;
        const { flag, delay } = await taskFlag(task, req.tenantId, organisationId);
        const updatedTask = {
            ...task,
            flag,
            delay,
            endDate,
            completionPecentage,
        };
        return updatedTask;
    }));
    return new SuccessResponse(StatusCodes.OK, finalArray, "get users task successfully").send(res);
};
