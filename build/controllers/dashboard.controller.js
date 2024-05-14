import { StatusCodes } from "http-status-codes";
import { ProjectStatusEnum, TaskStatusEnum, UserRoleEnum, } from "@prisma/client";
import { BadRequestError, SuccessResponse } from "../config/apiError.js";
import { getClientByTenantId } from "../config/db.js";
import { uuidSchema } from "../schemas/commonSchema.js";
import { calculationSPI } from "../utils/calculateSPI.js";
import { calculationCPI } from "../utils/calculateCPI.js";
import { calculationTPI } from "../utils/calculationFlag.js";
import { calculateProjectDuration } from "../utils/calculateProjectDuration.js";
import { calculateEndDateFromStartDateAndDuration } from "../utils/calculateEndDateFromDuration.js";
export const dashboardAPI = async (req, res) => {
    if (!req.organisationId) {
        throw new BadRequestError("OrganisationId not found!");
    }
    const userId = req.userId;
    const organisationId = req.organisationId;
    const prisma = await getClientByTenantId(req.tenantId);
    let projectManagersProjects;
    let role = req.role;
    if (!role) {
        return new SuccessResponse(StatusCodes.OK, [], "get all project successfully").send(res);
    }
    if (role === UserRoleEnum.PROJECT_MANAGER) {
        projectManagersProjects = await prisma.project.findMany({
            where: {
                OR: [
                    {
                        organisationId: req.organisationId,
                        deletedAt: null,
                        assignedUsers: {
                            some: {
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
            include: {
                tasks: true,
                createdByUser: {
                    select: {
                        firstName: true,
                        lastName: true,
                        email: true,
                        avatarImg: true,
                    },
                },
                organisation: {
                    include: {
                        userOrganisation: {
                            include: {
                                user: true,
                            },
                        },
                    },
                },
                assignedUsers: {
                    where: {
                        user: {
                            deletedAt: null,
                        },
                    },
                    include: {
                        user: {
                            include: {
                                userOrganisation: {
                                    where: { deletedAt: null },
                                    select: {
                                        role: true,
                                        userOrganisationId: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });
    }
    else if (role === UserRoleEnum.TEAM_MEMBER) {
        projectManagersProjects = await prisma.project.findMany({
            where: {
                organisationId: req.organisationId,
                deletedAt: null,
                assignedUsers: {
                    some: {
                        assginedToUserId: userId,
                    },
                },
            },
            include: {
                tasks: true,
                createdByUser: {
                    select: {
                        firstName: true,
                        lastName: true,
                        email: true,
                        avatarImg: true,
                    },
                },
                organisation: {
                    include: {
                        userOrganisation: {
                            include: {
                                user: true,
                            },
                        },
                    },
                },
                assignedUsers: {
                    where: {
                        user: {
                            deletedAt: null,
                        },
                    },
                    include: {
                        user: {
                            include: {
                                userOrganisation: {
                                    where: { deletedAt: null },
                                    select: {
                                        role: true,
                                        userOrganisationId: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });
    }
    else {
        projectManagersProjects = await prisma.project.findMany({
            where: {
                organisationId: req.organisationId,
                deletedAt: null,
            },
            include: {
                tasks: true,
                createdByUser: {
                    select: {
                        firstName: true,
                        lastName: true,
                        email: true,
                        avatarImg: true,
                    },
                },
                organisation: {
                    include: {
                        userOrganisation: {
                            include: {
                                user: true,
                            },
                        },
                    },
                },
                assignedUsers: {
                    where: {
                        user: {
                            deletedAt: null,
                        },
                    },
                    include: {
                        user: {
                            include: {
                                userOrganisation: {
                                    where: { deletedAt: null },
                                    select: {
                                        role: true,
                                        userOrganisationId: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });
    }
    // Calculate Number of Portfolio Projects per Status
    const allStatusValues = [
        ProjectStatusEnum.NOT_STARTED,
        ProjectStatusEnum.ACTIVE,
        ProjectStatusEnum.ON_HOLD,
        ProjectStatusEnum.CLOSED,
    ];
    const statusCounts = allStatusValues.reduce((acc, status) => {
        acc[status] = 0;
        return acc;
    }, {});
    projectManagersProjects.forEach((project) => {
        const status = project.status;
        statusCounts[status]++;
    });
    // Calculate Number of Portfolio Projects per Overall Situation
    const overallSituationCounts = projectManagersProjects.reduce((acc, project) => {
        const overallSituation = project.overallTrack;
        acc[overallSituation] = (acc[overallSituation] || 0) + 1;
        return acc;
    }, {});
    // Data for the status chart
    const statusChartData = {
        labels: Object.keys(statusCounts),
        data: Object.values(statusCounts),
    };
    // Data for the overall situation chart
    const overallSituationChartData = {
        labels: Object.keys(overallSituationCounts),
        data: Object.values(overallSituationCounts),
    };
    const labels = ["Significant delay", "On time", "Moderate delay"];
    const data = [0, 0, 0];
    const projects = await Promise.all(projectManagersProjects.map(async (project) => {
        const CPI = await calculationCPI(project, req.tenantId, organisationId);
        const spi = await calculationSPI(req.tenantId, organisationId, project.projectId);
        const progressionPercentage = await prisma.project.projectProgression(project.projectId, req.tenantId, organisationId);
        if (project.status === ProjectStatusEnum.ACTIVE) {
            if (spi < 0.8) {
                data[0]++;
            }
            else if (spi < 0.95) {
                data[2]++;
            }
            else {
                data[1]++;
            }
        }
        const actualDuration = project.tasks.length != 0 && project.actualEndDate
            ? await calculateProjectDuration(project.startDate, project.actualEndDate, req.tenantId, organisationId)
            : 0;
        const estimatedDuration = project.estimatedEndDate
            ? await calculateProjectDuration(project.startDate, project.estimatedEndDate, req.tenantId, organisationId)
            : null;
        const completedTasksCount = await prisma.task.count({
            where: {
                projectId: project.projectId,
                status: TaskStatusEnum.COMPLETED,
            },
        });
        return {
            ...project,
            CPI,
            spi,
            completedTasksCount,
            actualDuration,
            estimatedDuration,
            progressionPercentage,
        };
    }));
    const spiData = { labels, data };
    const response = {
        projects,
        statusChartData,
        overallSituationChartData,
        spiData,
    };
    return new SuccessResponse(StatusCodes.OK, response, "Portfolio projects of PM").send(res);
};
export const projectDashboardByprojectId = async (req, res) => {
    if (!req.organisationId) {
        throw new BadRequestError("organisationId not found!!");
    }
    const organisationId = req.organisationId;
    const projectId = uuidSchema.parse(req.params.projectId);
    // Fetch projects created by the user
    const prisma = await getClientByTenantId(req.tenantId);
    const projectWithTasks = await prisma.project.findFirstOrThrow({
        where: {
            projectId,
            deletedAt: null,
        },
        include: {
            tasks: {
                where: {
                    deletedAt: null,
                },
                include: {
                    assignedUsers: true,
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
            },
        },
    });
    // Count the number of task for the project
    const numTasks = projectWithTasks.tasks.length;
    // Calculate the number of milestones for the project
    const numMilestones = projectWithTasks.tasks.reduce((acc, task) => acc + (task.milestoneIndicator ? 1 : 0), 0);
    const budgetTrack = projectWithTasks.budgetTrack;
    const projectOverAllSituation = projectWithTasks.overallTrack;
    const consumedBudget = projectWithTasks.consumedBudget;
    const estimatedBudget = projectWithTasks.estimatedBudget;
    const actualCost = projectWithTasks.actualCost;
    const scheduleTrend = projectWithTasks.scheduleTrend;
    const budgetTrend = projectWithTasks.budgetTrend;
    const projectProgression = await prisma.project.projectProgression(projectId, req.tenantId, organisationId);
    // CPI
    const cpi = await calculationCPI(projectWithTasks, req.tenantId, organisationId);
    // SPI
    const spi = await calculationSPI(req.tenantId, organisationId, projectWithTasks.projectId);
    // Project Date's
    const actualDuration = projectWithTasks.tasks.length != 0 && projectWithTasks.actualEndDate
        ? await calculateProjectDuration(projectWithTasks.startDate, projectWithTasks.actualEndDate, req.tenantId, organisationId)
        : 0;
    const estimatedDuration = projectWithTasks.estimatedEndDate
        ? await calculateProjectDuration(projectWithTasks.startDate, projectWithTasks.estimatedEndDate, req.tenantId, organisationId)
        : null;
    const projectDates = {
        startDate: projectWithTasks.startDate,
        estimatedEndDate: projectWithTasks.estimatedEndDate,
        actualEndDate: projectWithTasks.tasks.length === 0
            ? null
            : projectWithTasks.actualEndDate,
        projectCreatedAt: projectWithTasks.createdAt,
        actualDuration,
        estimatedDuration,
    };
    // Calculate Number of Portfolio Projects per Overall Situation
    const statusCounts = projectWithTasks.tasks.reduce((acc, task) => {
        const status = task.status;
        acc[status] = (acc[status] || 0) + 1;
        return acc;
    }, {});
    // Data for the task status chart
    const taskStatusChartData = {
        labels: Object.keys(statusCounts),
        data: Object.values(statusCounts),
    };
    // Calculate TPI and Deley for each task in the project
    const taskDelayChartDataPromises = projectWithTasks.tasks.map(async (task) => {
        const flag = await calculationTPI(task, req.tenantId, organisationId);
        return {
            taskId: task.taskId,
            taskName: task.taskName,
            tpiValue: flag.tpiValue,
            tpiFlag: flag.tpiFlag,
        };
    });
    const taskDelayChartData = await Promise.all(taskDelayChartDataPromises);
    // Count of working users in this project
    const numTeamMembersWorkingOnTasks = await prisma.projectAssignUsers.count({
        where: {
            projectId,
            user: {
                userOrganisation: {
                    some: {
                        role: {
                            in: [UserRoleEnum.PROJECT_MANAGER, UserRoleEnum.TEAM_MEMBER],
                        },
                    },
                },
            },
        },
    });
    const reCalculateBudget = cpi !== 0 ? Number(projectWithTasks.estimatedBudget) / cpi : 0;
    const budgetVariation = cpi !== 0
        ? Number(reCalculateBudget) - Number(projectWithTasks.estimatedBudget)
        : null;
    const reCalculatedDuration = spi !== 0 && estimatedDuration ? Math.round(estimatedDuration / spi) : 0;
    const reCalculateEndDate = reCalculatedDuration !== 0
        ? await calculateEndDateFromStartDateAndDuration(projectWithTasks.startDate, reCalculatedDuration - 1, req.tenantId, req.organisationId)
        : null;
    const keyPerformanceIndicator = {
        reCalculateBudget,
        budgetVariation,
        reCalculateEndDate,
        reCalculatedDuration,
    };
    const currency = projectWithTasks.currency;
    const response = {
        numTasks,
        numMilestones,
        projectDates,
        budgetTrack,
        taskStatusChartData,
        taskDelayChartData,
        numTeamMembersWorkingOnTasks,
        projectOverAllSituation,
        projectStatus: projectWithTasks.status,
        projectName: projectWithTasks.projectName,
        spi,
        cpi,
        budgetTrend,
        scheduleTrend,
        actualCost,
        consumedBudget,
        estimatedBudget,
        projectProgression,
        keyPerformanceIndicator,
        currency,
    };
    return new SuccessResponse(StatusCodes.OK, response, "Portfolio for selected project").send(res);
};
