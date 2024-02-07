import { BadRequestError, SuccessResponse } from "../config/apiError.js";
import { StatusCodes } from "http-status-codes";
import { getClientByTenantId } from "../config/db.js";
import { uuidSchema } from "../schemas/commonSchema.js";
export const projectManagerProjects = async (req, res) => {
    const userId = req.userId;
    const prisma = await getClientByTenantId(req.tenantId);
    const projectManagersProjects = await prisma.project.findMany({
        where: {
            createdByUserId: userId,
        },
    });
    // Calculate Number of Portfolio Projects per Status
    const statusCounts = projectManagersProjects.reduce((acc, project) => {
        const status = project.status;
        acc[status] = (acc[status] || 0) + 1;
        return acc;
    }, {});
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
    // TODO: Deley calculation as per SPI logic
    const response = {
        projectManagersProjects,
        statusChartData,
        overallSituationChartData,
    };
    return new SuccessResponse(StatusCodes.OK, response, "Portfolio projects of PM").send(res);
};
export const administartorProjects = async (req, res) => {
    if (!req.organisationId) {
        throw new BadRequestError("organisationId not found!");
    }
    const prisma = await getClientByTenantId(req.tenantId);
    const orgCreatedByUser = await prisma.organisation.findFirstOrThrow({
        where: {
            createdByUserId: req.userId,
            organisationId: req.organisationId,
        },
        include: {
            projects: true,
        },
    });
    // Calculate Number of Portfolio Projects per Status
    const statusCounts = orgCreatedByUser.projects.reduce((acc, project) => {
        const status = project.status;
        acc[status] = (acc[status] || 0) + 1;
        return acc;
    }, {});
    // Calculate Number of Portfolio Projects per Overall Situation
    const overallSituationCounts = orgCreatedByUser.projects.reduce((acc, project) => {
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
    // TODO: Deley calculation as per SPI logic
    const response = {
        orgCreatedByUser,
        statusChartData,
        overallSituationChartData,
    };
    return new SuccessResponse(StatusCodes.OK, response, "Portfolio projects of Administartor").send(res);
};
export const allOrganisationsProjects = async (req, res) => {
    const prisma = await getClientByTenantId(req.tenantId);
    // Fetch all organizations with their projects
    const allOrganisationsWithProjects = await prisma.organisation.findMany({
        include: {
            projects: true,
        },
    });
    const allProjects = allOrganisationsWithProjects.flatMap((org) => org.projects);
    // Calculate Number of Projects per Status
    const statusCounts = allProjects.reduce((acc, project) => {
        const status = project.status;
        acc[status] = (acc[status] || 0) + 1;
        return acc;
    }, {});
    // Calculate Number of Projects per Overall Situation
    const overallSituationCounts = allProjects.reduce((acc, project) => {
        const overallSituation = project.overallTrack;
        acc[overallSituation] = (acc[overallSituation] || 0) + 1;
        return acc;
    }, {});
    // Prepare data for the status chart
    const statusChartData = {
        labels: Object.keys(statusCounts),
        data: Object.values(statusCounts),
    };
    // Prepare data for the overall situation chart
    const overallSituationChartData = {
        labels: Object.keys(overallSituationCounts),
        data: Object.values(overallSituationCounts),
    };
    const response = {
        allOrganisationsWithProjects,
        statusChartData,
        overallSituationChartData,
    };
    return new SuccessResponse(StatusCodes.OK, response, "Portfolio projects of all Organisations").send(res);
};
export const projectDashboardByprojectId = async (req, res) => {
    const userId = req.userId;
    const projectId = uuidSchema.parse(req.params.projectId);
    // Fetch projects created by the user
    const prisma = await getClientByTenantId(req.tenantId);
    const projectWithTasks = await prisma.project.findFirstOrThrow({
        where: {
            projectId,
        },
        include: {
            tasks: {
                include: {
                    assignedUsers: true,
                },
            },
        },
    });
    // Count the number of task for the project
    const numTasks = projectWithTasks.tasks.length;
    // Calculate the number of milestones for the project
    const numMilestones = projectWithTasks.tasks.reduce((acc, task) => acc + (task.milestoneIndicator ? 1 : 0), 0);
    const projectBudgetTrend = projectWithTasks.budgetTrack;
    const projectOverAllSituation = projectWithTasks.overallTrack;
    // Project Date's
    const projectDates = {
        startDate: projectWithTasks.startDate,
        estimatedEndDate: projectWithTasks.estimatedEndDate,
    };
    // Todo: Need to handle KPI-SPI-CPI
    // TODO: Schedule trend
    // TODO: Risks severity
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
        const tpiObj = prisma.task.tpiCalculation(task);
        return {
            taskId: task.taskId,
            taskName: task.taskName,
            tpiValue: tpiObj.tpiValue,
            tpiFlag: tpiObj.tpiFlag,
        };
    });
    const taskDelayChartData = await Promise.all(taskDelayChartDataPromises);
    // Collect unique user IDs from assigned users of tasks
    const assignedUsersSet = new Set();
    projectWithTasks.tasks.forEach((task) => {
        task.assignedUsers.forEach((assignUser) => {
            assignedUsersSet.add(assignUser.assginedToUserId);
        });
    });
    const numTeamMembersWorkingOnTasks = assignedUsersSet.size;
    const response = {
        numTasks,
        numMilestones,
        projectDates,
        projectBudgetTrend,
        taskStatusChartData,
        taskDelayChartData,
        numTeamMembersWorkingOnTasks,
        projectOverAllSituation,
    };
    return new SuccessResponse(StatusCodes.OK, response, "Portfolio for selected project").send(res);
};
