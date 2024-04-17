import { getClientByTenantId } from "../config/db.js";
function calculateEndDateAndDurationFromWeek(startWeek, endWeek, nonWorkingDays) {
    const daysPerWeek = 7 - nonWorkingDays.length;
    const totalDays = (endWeek - startWeek + 1) * daysPerWeek;
    const millisecondsPerDay = 24 * 60 * 60 * 1000;
    const currentDate = new Date();
    const estimatedEndDate = new Date(currentDate.getTime() + totalDays * millisecondsPerDay);
    return {
        initialStartDate: new Date(currentDate),
        initialEstimatedEndDate: new Date(estimatedEndDate),
        intialDurationInDays: totalDays,
    };
}
const demoProjects = [
    {
        projectName: "House building",
        startDateInWeek: 1,
        estimatedEndDateInWeek: 31,
        currency: "USD",
        type: "project",
        tasks: [
            {
                taskName: "Permit approved",
                type: "task",
                startDateInWeek: 5,
                estimatedEndDateInWeek: 5,
                duration: 1,
                isMilestone: true,
            },
            {
                taskName: "Project Initiation Phase",
                isMilestone: false,
                startDateInWeek: 1,
                estimatedEndDateInWeek: 4,
                duration: null,
                subTask: [
                    {
                        taskName: "Define Project Scope and Objectives",
                        isMilestone: false,
                        startDateInWeek: 1,
                        estimatedEndDateInWeek: 2,
                        duration: null,
                    },
                    {
                        taskName: "Conduct Site Survey",
                        isMilestone: false,
                        startDateInWeek: 2,
                        estimatedEndDateInWeek: 3,
                        duration: null,
                    },
                    {
                        taskName: "Obtain Permits and Approvals",
                        isMilestone: false,
                        startDateInWeek: 3,
                        estimatedEndDateInWeek: 4,
                        duration: null,
                    },
                ],
            },
            {
                taskName: "Design Phase",
                type: "task",
                isMilestone: false,
                startDateInWeek: 5,
                estimatedEndDateInWeek: 10,
                duration: null,
                subTask: [
                    {
                        taskName: "Architectural Design",
                        isMilestone: false,
                        startDateInWeek: 5,
                        estimatedEndDateInWeek: 6,
                        duration: null,
                    },
                    {
                        taskName: "Structural Design",
                        isMilestone: false,
                        startDateInWeek: 6,
                        estimatedEndDateInWeek: 9,
                        duration: null,
                    },
                    {
                        taskName: "Electrical and Plumbing Design",
                        isMilestone: false,
                        startDateInWeek: 7,
                        estimatedEndDateInWeek: 10,
                        duration: null,
                    },
                ],
            },
            {
                taskName: "Plan approved",
                type: "task",
                isMilestone: true,
                startDateInWeek: 10,
                estimatedEndDateInWeek: 11,
                duration: 1,
            },
            {
                taskName: "Pre-Construction Phase",
                type: "task",
                isMilestone: false,
                startDateInWeek: 8,
                estimatedEndDateInWeek: 12,
                duration: null,
                subTask: [
                    {
                        taskName: "Finalize Material and Equipment Procurement",
                        isMilestone: false,
                        startDateInWeek: 8,
                        estimatedEndDateInWeek: 12,
                        duration: null,
                    },
                    {
                        taskName: "Hire Contractors and Construction Crew",
                        isMilestone: false,
                        startDateInWeek: 9,
                        estimatedEndDateInWeek: 12,
                        duration: null,
                    },
                    {
                        taskName: "Prepare Construction Site",
                        isMilestone: false,
                        startDateInWeek: 10,
                        estimatedEndDateInWeek: 12,
                        duration: null,
                    },
                ],
            },
            {
                taskName: "All inspection finished",
                type: "task",
                isMilestone: true,
                startDateInWeek: 12,
                estimatedEndDateInWeek: 12,
                duration: 1,
            },
            {
                taskName: "Construction Phase",
                type: "task",
                isMilestone: false,
                startDateInWeek: 13,
                estimatedEndDateInWeek: 27,
                duration: null,
                subTask: [
                    {
                        taskName: "Foundation Construction",
                        isMilestone: false,
                        startDateInWeek: 13,
                        estimatedEndDateInWeek: 15,
                        duration: null,
                    },
                    {
                        taskName: "Framing and Roofing",
                        isMilestone: false,
                        startDateInWeek: 16,
                        estimatedEndDateInWeek: 18,
                        duration: null,
                    },
                    {
                        taskName: "Electrical and Plumbing Installation",
                        isMilestone: false,
                        startDateInWeek: 19,
                        estimatedEndDateInWeek: 21,
                        duration: null,
                    },
                    {
                        taskName: "Interior Finishing",
                        isMilestone: false,
                        startDateInWeek: 22,
                        estimatedEndDateInWeek: 24,
                        duration: null,
                    },
                    {
                        taskName: "Exterior Finishing",
                        isMilestone: false,
                        startDateInWeek: 25,
                        estimatedEndDateInWeek: 27,
                        duration: null,
                    },
                ],
            },
            {
                taskName: "Substantial completion",
                type: "task",
                isMilestone: true,
                startDateInWeek: 27,
                estimatedEndDateInWeek: 27,
                duration: 1,
            },
            {
                taskName: "Post-Construction Phase",
                type: "task",
                isMilestone: false,
                startDateInWeek: 8,
                estimatedEndDateInWeek: 12,
                duration: null,
                subTask: [
                    {
                        taskName: "Final Inspections and Quality Checks",
                        isMilestone: false,
                        startDateInWeek: 28,
                        estimatedEndDateInWeek: 29,
                        duration: null,
                    },
                    {
                        taskName: "Landscaping and Exterior Works",
                        isMilestone: false,
                        startDateInWeek: 29,
                        estimatedEndDateInWeek: 31,
                        duration: null,
                    },
                    {
                        taskName: "Clean-up",
                        isMilestone: false,
                        startDateInWeek: 31,
                        estimatedEndDateInWeek: 31,
                        duration: null,
                    },
                ],
            },
            {
                taskName: "Client Walkthrough and Handover",
                type: "task",
                isMilestone: true,
                startDateInWeek: 31,
                estimatedEndDateInWeek: 31,
                duration: 1,
            },
        ],
    },
    {
        projectName: "Developement of 'The ONE' web application",
        startDateInWeek: 1,
        estimatedEndDateInWeek: 2,
        currency: "USD",
        type: "project",
        tasks: [
            {
                taskName: "Initiation phase",
                type: "task",
                isMilestone: false,
                startDateInWeek: 1,
                estimatedEndDateInWeek: 1,
                duration: 3,
                subTask: [
                    {
                        taskName: "Define project scope",
                        isMilestone: false,
                        startDateInWeek: 1,
                        estimatedEndDateInWeek: 1,
                        duration: 3,
                    },
                    {
                        taskName: "Conduct stakeholder interviews",
                        isMilestone: false,
                        startDateInWeek: 1,
                        estimatedEndDateInWeek: 1,
                        duration: 3,
                    },
                    {
                        taskName: "Project proposal finalized",
                        isMilestone: true,
                        startDateInWeek: 1,
                        estimatedEndDateInWeek: 1,
                        duration: 1,
                    },
                    {
                        taskName: "Conduct user research",
                        isMilestone: false,
                        startDate: new Date(),
                        startDateInWeek: 1,
                        estimatedEndDateInWeek: 1,
                        duration: 3,
                    },
                    {
                        taskName: "Gather requirements",
                        isMilestone: false,
                        startDateInWeek: 1,
                        estimatedEndDateInWeek: 1,
                        duration: 3,
                    },
                    {
                        taskName: "Requirements validated",
                        isMilestone: true,
                        startDateInWeek: 1,
                        estimatedEndDateInWeek: 1,
                        duration: 1,
                    },
                    {
                        taskName: "Kickoff meeting",
                        isMilestone: true,
                        startDateInWeek: 1,
                        estimatedEndDateInWeek: 1,
                        duration: 1,
                    },
                ],
            },
            {
                taskName: "Design",
                type: "task",
                isMilestone: false,
                startDateInWeek: 1,
                estimatedEndDateInWeek: 1,
                duration: 3,
                subTask: [
                    {
                        taskName: "High-level design including flow charts",
                        type: "task",
                        isMilestone: false,
                        startDateInWeek: 1,
                        estimatedEndDateInWeek: 1,
                        duration: 3,
                    },
                    {
                        taskName: "Design validation",
                        type: "task",
                        isMilestone: true,
                        startDateInWeek: 1,
                        estimatedEndDateInWeek: 1,
                        duration: 1,
                    },
                    {
                        taskName: "Mockups deelopment",
                        type: "task",
                        isMilestone: false,
                        startDateInWeek: 1,
                        estimatedEndDateInWeek: 1,
                        duration: 3,
                    },
                    {
                        taskName: "Deliver final design",
                        type: "task",
                        isMilestone: true,
                        startDateInWeek: 1,
                        estimatedEndDateInWeek: 1,
                        duration: 1,
                    },
                ],
            },
            {
                taskName: "Environment Setup",
                type: "task",
                isMilestone: false,
                startDateInWeek: 1,
                estimatedEndDateInWeek: 1,
                duration: 3,
                subTask: [
                    {
                        taskName: "Staging environment",
                        type: "task",
                        isMilestone: false,
                        startDateInWeek: 1,
                        estimatedEndDateInWeek: 1,
                        duration: 3,
                    },
                    {
                        taskName: "Production environment",
                        type: "task",
                        isMilestone: false,
                        startDateInWeek: 1,
                        estimatedEndDateInWeek: 1,
                        duration: 3,
                    },
                    {
                        taskName: "QA environment",
                        type: "task",
                        isMilestone: false,
                        startDateInWeek: 1,
                        estimatedEndDateInWeek: 1,
                        duration: 3,
                    },
                ],
            },
            {
                taskName: "Sprint 1",
                type: "task",
                isMilestone: false,
                startDateInWeek: 1,
                estimatedEndDateInWeek: 1,
                duration: 3,
                subTask: [
                    {
                        taskName: "Sprint 1 planning",
                        isMilestone: false,
                        startDateInWeek: 1,
                        estimatedEndDateInWeek: 1,
                        duration: 2,
                    },
                    {
                        taskName: "Sprint 1 start",
                        isMilestone: true,
                        startDateInWeek: 1,
                        estimatedEndDateInWeek: 1,
                        duration: 1,
                    },
                    {
                        taskName: "Sprint 1 period",
                        isMilestone: false,
                        startDateInWeek: 1,
                        estimatedEndDateInWeek: 1,
                        duration: 3,
                    },
                    {
                        taskName: "Testing after sprint 1",
                        isMilestone: false,
                        startDateInWeek: 1,
                        estimatedEndDateInWeek: 1,
                        duration: 1,
                    },
                    {
                        taskName: "Sprint 1 Stakeholder review",
                        isMilestone: false,
                        startDateInWeek: 1,
                        estimatedEndDateInWeek: 1,
                        duration: 1,
                    },
                    {
                        taskName: "Sprint 1 Fix period",
                        isMilestone: false,
                        startDateInWeek: 1,
                        estimatedEndDateInWeek: 1,
                        duration: 1,
                    },
                    {
                        taskName: "Deployment of Sprint 1 results",
                        isMilestone: true,
                        startDateInWeek: 1,
                        estimatedEndDateInWeek: 1,
                        duration: 1,
                    },
                ],
            },
            {
                taskName: "Sprint 2",
                type: "task",
                isMilestone: false,
                startDateInWeek: 1,
                estimatedEndDateInWeek: 1,
                duration: 3,
                subTask: [
                    {
                        taskName: "Backlog grooming",
                        isMilestone: false,
                        startDateInWeek: 1,
                        estimatedEndDateInWeek: 1,
                        duration: 3,
                    },
                    {
                        taskName: "Sprint 1 retrospective",
                        isMilestone: true,
                        startDateInWeek: 1,
                        estimatedEndDateInWeek: 1,
                        duration: 1,
                    },
                    {
                        taskName: "Sprint 2 planning",
                        isMilestone: false,
                        startDateInWeek: 1,
                        estimatedEndDateInWeek: 1,
                        duration: 1,
                    },
                    {
                        taskName: "Sprint 2 start",
                        isMilestone: true,
                        startDateInWeek: 1,
                        estimatedEndDateInWeek: 1,
                        duration: 1,
                    },
                    {
                        taskName: "Sprint 2 period",
                        isMilestone: false,
                        startDateInWeek: 1,
                        estimatedEndDateInWeek: 1,
                        duration: 1,
                    },
                    {
                        taskName: "Testing after sprint 2",
                        isMilestone: false,
                        startDateInWeek: 1,
                        estimatedEndDateInWeek: 1,
                        duration: 1,
                    },
                    {
                        taskName: "Sprint 2 Stakeholder review",
                        isMilestone: false,
                        startDateInWeek: 1,
                        estimatedEndDateInWeek: 1,
                        duration: 1,
                    },
                    {
                        taskName: "Sprint 2 Fix period",
                        isMilestone: false,
                        startDateInWeek: 1,
                        estimatedEndDateInWeek: 1,
                        duration: 1,
                    },
                    {
                        taskName: "Deployment of Sprint 2 results",
                        isMilestone: true,
                        startDateInWeek: 1,
                        estimatedEndDateInWeek: 1,
                        duration: 1,
                    },
                ],
            },
            {
                taskName: "Backlog",
                type: "task",
                isMilestone: false,
                startDateInWeek: 1,
                estimatedEndDateInWeek: 2,
                duration: 7,
                subTask: [
                    {
                        taskName: "Feature 1 developement",
                        type: "task",
                        isMilestone: false,
                        startDateInWeek: 1,
                        estimatedEndDateInWeek: 2,
                        duration: 7,
                    },
                    {
                        taskName: "Feature 2 developement",
                        type: "task",
                        isMilestone: false,
                        startDateInWeek: 1,
                        estimatedEndDateInWeek: 2,
                        duration: 7,
                    },
                    {
                        taskName: "Feature 3 developement",
                        type: "task",
                        isMilestone: false,
                        startDateInWeek: 1,
                        estimatedEndDateInWeek: 2,
                        duration: 7,
                    },
                ],
            },
        ],
    },
];
export const createDemoProjectsCommon = async (tenantId, createdByUserId, organisationId) => {
    const prisma = await getClientByTenantId(tenantId);
    if (demoProjects) {
        const projectCreationPromises = demoProjects.map(async (project) => {
            const findProject = await prisma.project.findFirst({
                where: {
                    organisationId: organisationId,
                    projectName: project.projectName,
                },
            });
            const findOrg = await prisma.organisation.findFirst({
                where: { organisationId, deletedAt: null },
            });
            if (!findProject && findOrg) {
                const nonWorkingDays = findOrg?.nonWorkingDays ?? [];
                const { initialStartDate, initialEstimatedEndDate, intialDurationInDays, } = calculateEndDateAndDurationFromWeek(project.startDateInWeek, project.estimatedEndDateInWeek, nonWorkingDays);
                const createProject = await prisma.project.create({
                    data: {
                        organisationId: organisationId,
                        projectName: project.projectName,
                        startDate: initialStartDate,
                        estimatedEndDate: initialEstimatedEndDate,
                        currency: project.currency,
                        createdByUserId: createdByUserId,
                    },
                });
                if (createProject && project.tasks) {
                    const taskCreationPromises = project.tasks.map(async (task) => {
                        const { initialStartDate, initialEstimatedEndDate, intialDurationInDays, } = calculateEndDateAndDurationFromWeek(task.startDateInWeek, task.estimatedEndDateInWeek, nonWorkingDays);
                        const createParentTask = await prisma.task.create({
                            data: {
                                projectId: createProject.projectId,
                                taskName: task.taskName,
                                startDate: initialStartDate,
                                duration: task.duration == null ? intialDurationInDays : task.duration,
                                parentTaskId: null,
                                milestoneIndicator: task.isMilestone,
                                createdByUserId: createdByUserId,
                            },
                        });
                        if (createParentTask && task.subTask) {
                            await Promise.all(task.subTask.map(async (sub) => {
                                const { initialStartDate, initialEstimatedEndDate, intialDurationInDays, } = calculateEndDateAndDurationFromWeek(sub.startDateInWeek, sub.estimatedEndDateInWeek, nonWorkingDays);
                                await prisma.task.create({
                                    data: {
                                        projectId: createProject.projectId,
                                        taskName: sub.taskName,
                                        startDate: initialStartDate,
                                        duration: sub.duration == null
                                            ? intialDurationInDays
                                            : sub.duration,
                                        parentTaskId: createParentTask.taskId,
                                        milestoneIndicator: sub.isMilestone,
                                        createdByUserId: createdByUserId,
                                    },
                                });
                            }));
                        }
                    });
                    await Promise.all(taskCreationPromises);
                }
            }
        });
        await Promise.all(projectCreationPromises);
    }
    return;
};
