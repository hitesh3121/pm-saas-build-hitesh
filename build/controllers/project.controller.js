import { getClientByTenantId } from '../config/db.js';
import { BadRequestError, NotFoundError, SuccessResponse } from '../config/apiError.js';
import { StatusCodes } from 'http-status-codes';
import { consumedBudgetSchema, createKanbanSchema, createProjectSchema, projectIdSchema, projectStatusSchema, updateKanbanSchema, updateProjectSchema } from '../schemas/projectSchema.js';
import { ProjectStatusEnum, TaskStatusEnum, UserRoleEnum } from '@prisma/client';
import { uuidSchema } from '../schemas/commonSchema.js';
export const getProjects = async (req, res) => {
    if (!req.organisationId) {
        throw new BadRequestError('organisationId not found!');
    }
    ;
    const prisma = await getClientByTenantId(req.tenantId);
    const projects = await prisma.project.findMany({
        where: {
            organisationId: req.organisationId
        },
        include: {
            createdByUser: {
                select: {
                    firstName: true,
                    lastName: true,
                    email: true,
                    avatarImg: true
                }
            }
        },
        orderBy: { createdAt: 'desc' }
    });
    // progressionPercentage for all projects
    const projectsWithProgression = [];
    for (const project of projects) {
        const progressionPercentage = await prisma.project.projectProgression(project.projectId);
        const projectManagerInfo = await prisma.userOrganisation.findMany({
            where: {
                organisationId: req.organisationId,
                role: UserRoleEnum.PROJECT_MANAGER,
            },
            select: {
                user: {
                    select: {
                        firstName: true,
                        lastName: true,
                        email: true,
                        avatarImg: true,
                    },
                },
            },
        });
        const projectWithProgression = {
            ...project,
            progressionPercentage,
            projectManagerInfo,
        };
        projectsWithProgression.push(projectWithProgression);
    }
    return new SuccessResponse(StatusCodes.OK, projectsWithProgression, 'get all project successfully').send(res);
};
export const getProjectById = async (req, res) => {
    if (!req.organisationId) {
        throw new BadRequestError('organisationId not found!');
    }
    ;
    const projectId = projectIdSchema.parse(req.params.projectId);
    const prisma = await getClientByTenantId(req.tenantId);
    const projects = await prisma.project.findFirstOrThrow({
        where: { organisationId: req.organisationId, projectId: projectId },
        include: {
            tasks: true,
            createdByUser: {
                select: {
                    firstName: true,
                    lastName: true,
                    email: true,
                    avatarImg: true
                }
            }
        }
    });
    const progressionPercentage = await prisma.project.projectProgression(projectId);
    const response = { ...projects, progressionPercentage };
    return new SuccessResponse(StatusCodes.OK, response, "project selected").send(res);
};
export const createProject = async (req, res) => {
    if (!req.organisationId) {
        throw new BadRequestError('organisationId not found!');
    }
    ;
    if (!req.userId) {
        throw new BadRequestError('userId not found!');
    }
    ;
    const { projectName, projectDescription, startDate, estimatedEndDate, estimatedBudget, defaultView, currency } = createProjectSchema.parse(req.body);
    const prisma = await getClientByTenantId(req.tenantId);
    const project = await prisma.project.create({
        data: {
            organisationId: req.organisationId,
            projectName: projectName,
            projectDescription: projectDescription,
            startDate: startDate,
            estimatedEndDate: estimatedEndDate,
            actualEndDate: estimatedEndDate,
            status: ProjectStatusEnum.NOT_STARTED,
            estimatedBudget: estimatedBudget,
            defaultView: defaultView,
            createdByUserId: req.userId,
            updatedByUserId: req.userId,
            currency: currency
        }
    });
    return new SuccessResponse(StatusCodes.CREATED, project, 'project created successfully').send(res);
};
export const deleteProject = async (req, res) => {
    if (!req.organisationId) {
        throw new BadRequestError('organisationId not found!');
    }
    ;
    const projectId = projectIdSchema.parse(req.params.projectId);
    const prisma = await getClientByTenantId(req.tenantId);
    const findProject = await prisma.project.findFirstOrThrow({ where: { projectId: projectId, organisationId: req.organisationId } });
    if (findProject) {
        await prisma.project.delete({ where: { projectId } });
        return new SuccessResponse(StatusCodes.OK, {}, 'project deleted successfully').send(res);
    }
};
export const updateProject = async (req, res) => {
    if (!req.organisationId) {
        throw new BadRequestError('organisationId not found!');
    }
    ;
    if (!req.userId) {
        throw new BadRequestError('userId not found!');
    }
    ;
    const projectUpdateValue = updateProjectSchema.parse(req.body);
    const projectId = projectIdSchema.parse(req.params.projectId);
    const prisma = await getClientByTenantId(req.tenantId);
    const findProject = await prisma.project.findFirstOrThrow({
        where: {
            projectId: projectId,
            organisationId: req.organisationId
        }
    });
    if (!findProject)
        throw new NotFoundError('Project not found');
    let updateObj = { ...projectUpdateValue, updatedByUserId: req.userId };
    const projectUpdate = await prisma.project.update({
        where: { projectId: projectId },
        data: { ...updateObj },
    });
    return new SuccessResponse(StatusCodes.OK, projectUpdate, 'project updated successfully').send(res);
};
export const getKanbanColumnById = async (req, res) => {
    const projectId = uuidSchema.parse(req.params.projectId);
    const prisma = await getClientByTenantId(req.tenantId);
    const kanbanColumn = await prisma.kanbanColumn.findMany({
        where: { projectId },
    });
    return new SuccessResponse(StatusCodes.OK, kanbanColumn, "kanban column selected").send(res);
};
export const statusChangeProject = async (req, res) => {
    if (!req.organisationId) {
        throw new BadRequestError('organisationId not found!');
    }
    ;
    if (!req.userId) {
        throw new BadRequestError('userId not found!');
    }
    ;
    const { status } = projectStatusSchema.parse(req.body);
    const projectId = projectIdSchema.parse(req.params.projectId);
    const prisma = await getClientByTenantId(req.tenantId);
    const findProject = await prisma.project.findFirstOrThrow({ where: { projectId: projectId, organisationId: req.organisationId } });
    if (findProject) {
        const findTaskWithIncompleteTask = await prisma.task.findMany({
            where: {
                projectId: projectId,
                status: {
                    in: [
                        TaskStatusEnum.TODO,
                        TaskStatusEnum.PLANNED,
                        TaskStatusEnum.IN_PROGRESS,
                    ],
                },
            },
        });
        if (findTaskWithIncompleteTask.length > 0 &&
            status === ProjectStatusEnum.CLOSED) {
            throw new BadRequestError("Incomplete tasks exists!");
        }
    }
    const updateProject = await prisma.project.update({
        where: { projectId: projectId },
        data: { status: status, updatedByUserId: req.userId },
    });
    return new SuccessResponse(StatusCodes.OK, updateProject, "project status change successfully").send(res);
};
export const createKanbanColumn = async (req, res) => {
    if (!req.userId) {
        throw new BadRequestError("userId not found!");
    }
    const projectId = uuidSchema.parse(req.params.projectId);
    const { name, percentage } = createKanbanSchema.parse(req.body);
    const prisma = await getClientByTenantId(req.tenantId);
    const kanbanColumn = await prisma.kanbanColumn.create({
        data: {
            projectId,
            name,
            percentage,
            createdByUserId: req.userId,
        },
    });
    return new SuccessResponse(StatusCodes.CREATED, kanbanColumn, "kanban column created successfully").send(res);
};
export const updatekanbanColumn = async (req, res) => {
    if (!req.userId) {
        throw new BadRequestError("userId not found!");
    }
    const kanbanColumnId = uuidSchema.parse(req.params.kanbanColumnId);
    const kanbanColumnUpdateValue = updateKanbanSchema.parse(req.body);
    const prisma = await getClientByTenantId(req.tenantId);
    const findKanbanColumn = await prisma.kanbanColumn.findFirstOrThrow({
        where: {
            kanbanColumnId,
        },
    });
    let updateObj = { ...kanbanColumnUpdateValue, updatedByUserId: req.userId };
    const kanbanColumnUpdate = await prisma.kanbanColumn.update({
        where: { kanbanColumnId },
        data: { ...updateObj },
    });
    return new SuccessResponse(StatusCodes.OK, kanbanColumnUpdate, "kanban column updated successfully").send(res);
};
export const deleteKanbanColumn = async (req, res) => {
    if (!req.userId) {
        throw new BadRequestError("userId not found!");
    }
    const kanbanColumnId = uuidSchema.parse(req.params.kanbanColumnId);
    const prisma = await getClientByTenantId(req.tenantId);
    const findKanbanColumn = await prisma.kanbanColumn.findFirstOrThrow({
        where: { kanbanColumnId },
    });
    if (findKanbanColumn) {
        await prisma.kanbanColumn.delete({ where: { kanbanColumnId } });
        return new SuccessResponse(StatusCodes.OK, null, "kanban column deleted successfully").send(res);
    }
};
export const addConsumedBudgetToProject = async (req, res) => {
    if (!req.userId) {
        throw new BadRequestError("userId not found!");
    }
    const projectId = uuidSchema.parse(req.params.projectId);
    const { consumedBudget } = consumedBudgetSchema.parse(req.body);
    const prisma = await getClientByTenantId(req.tenantId);
    const projectUpdate = await prisma.project.update({
        where: { projectId: projectId },
        data: {
            consumedBudget
        },
    });
    return new SuccessResponse(StatusCodes.OK, projectUpdate, 'consumed budget updated successfully').send(res);
};
