import { getClientByTenantId } from "../config/db.js";
const demoProjects = [
    {
        projectName: "House building",
        startDate: new Date(),
        currency: "USD",
        tasks: [
            {
                taskName: "Permit approved",
                type: "task",
                isMilestone: true,
                startDate: new Date(),
                duration: 5,
            },
            {
                taskName: "Project Initiation Phase",
                isMilestone: false,
                startDate: new Date(),
                duration: 5,
                subTask: [
                    {
                        taskName: "Define Project Scope and Objectives",
                        isMilestone: false,
                        startDate: new Date(),
                        duration: 5,
                    },
                    {
                        taskName: "Conduct Site Survey",
                        isMilestone: false,
                        startDate: new Date(),
                        duration: 5,
                    },
                    {
                        taskName: "Obtain Permits and Approvals",
                        isMilestone: false,
                        startDate: new Date(),
                        duration: 5,
                    },
                ],
            },
            {
                taskName: "Design Phase",
                type: "task",
                isMilestone: false,
                startDate: new Date(),
                duration: 5,
                subTask: [
                    {
                        taskName: "Architectural Design",
                        isMilestone: false,
                        startDate: new Date(),
                        duration: 5,
                    },
                    {
                        taskName: "Structural Design",
                        isMilestone: false,
                        startDate: new Date(),
                        duration: 5,
                    },
                    {
                        taskName: "Electrical and Plumbing Design",
                        isMilestone: false,
                        startDate: new Date(),
                        duration: 5,
                    },
                ],
            },
            {
                taskName: "Plan approved",
                type: "task",
                isMilestone: true,
                startDate: new Date(),
                duration: 5,
            },
            {
                taskName: "Pre-Construction Phase",
                type: "task",
                isMilestone: false,
                startDate: new Date(),
                duration: 5,
                subTask: [
                    {
                        taskName: "Finalize Material and Equipment Procurement",
                        isMilestone: false,
                        startDate: new Date(),
                        duration: 5,
                    },
                    {
                        taskName: "Hire Contractors and Construction Crew",
                        isMilestone: false,
                        startDate: new Date(),
                        duration: 5,
                    },
                    {
                        taskName: "Prepare Construction Site",
                        isMilestone: false,
                        startDate: new Date(),
                        duration: 5,
                    },
                ],
            },
            {
                taskName: "All inspection finished",
                type: "task",
                isMilestone: true,
                startDate: new Date(),
                duration: 5,
            },
            {
                taskName: "Construction Phase",
                type: "task",
                isMilestone: false,
                startDate: new Date(),
                duration: 5,
                subTask: [
                    {
                        taskName: "Foundation Construction",
                        isMilestone: false,
                        startDate: new Date(),
                        duration: 5,
                    },
                    {
                        taskName: "Framing and Roofing",
                        isMilestone: false,
                        startDate: new Date(),
                        duration: 5,
                    },
                    {
                        taskName: "Electrical and Plumbing Installation",
                        isMilestone: false,
                        startDate: new Date(),
                        duration: 5,
                    },
                    {
                        taskName: "Interior Finishing",
                        isMilestone: false,
                        startDate: new Date(),
                        duration: 5,
                    },
                    {
                        taskName: "Exterior Finishing",
                        isMilestone: false,
                        startDate: new Date(),
                        duration: 5,
                    },
                ],
            },
            {
                taskName: "Substantial completion",
                type: "task",
                isMilestone: true,
                startDate: new Date(),
                duration: 5,
            },
            {
                taskName: "Post-Construction Phase",
                type: "task",
                isMilestone: false,
                startDate: new Date(),
                duration: 5,
                subTask: [
                    {
                        taskName: "Final Inspections and Quality Checks",
                        isMilestone: false,
                        startDate: new Date(),
                        duration: 5,
                    },
                    {
                        taskName: "Landscaping and Exterior Works",
                        isMilestone: false,
                        startDate: new Date(),
                        duration: 5,
                    },
                    {
                        taskName: "Clean-up",
                        isMilestone: false,
                        startDate: new Date(),
                        duration: 5,
                    },
                ],
            },
            {
                taskName: "Client Walkthrough and Handover",
                type: "task",
                isMilestone: true,
                startDate: new Date(),
                duration: 5,
            },
        ],
    },
    {
        projectName: "Developement of 'The ONE' web application",
        startDate: new Date(),
        currency: "USD",
        tasks: [
            {
                taskName: "Initiation phase",
                type: "task",
                isMilestone: false,
                startDate: new Date(),
                duration: 3,
                subTask: [
                    {
                        taskName: "Define project scope",
                        isMilestone: false,
                        startDate: new Date(),
                        duration: 3,
                    },
                    {
                        taskName: "Conduct stakeholder interviews",
                        isMilestone: false,
                        startDate: new Date(),
                        duration: 3,
                    },
                    {
                        taskName: "Project proposal finalized",
                        isMilestone: true,
                        startDate: new Date(),
                        duration: 3,
                    },
                    {
                        taskName: "Conduct user research",
                        isMilestone: false,
                        startDate: new Date(),
                        duration: 3,
                    },
                    {
                        taskName: "Gather requirements",
                        isMilestone: false,
                        startDate: new Date(),
                        duration: 3,
                    },
                    {
                        taskName: "Requirements validated",
                        isMilestone: true,
                        startDate: new Date(),
                        duration: 3,
                    },
                    {
                        taskName: "Kickoff meeting",
                        isMilestone: true,
                        startDate: new Date(),
                        duration: 3,
                    },
                ],
            },
            {
                taskName: "Design",
                type: "task",
                isMilestone: false,
                startDate: new Date(),
                duration: 3,
                subTask: [
                    {
                        taskName: "High-level design including flow charts",
                        type: "task",
                        isMilestone: false,
                        startDate: new Date(),
                        duration: 3,
                    },
                    {
                        taskName: "Design validation",
                        type: "task",
                        isMilestone: true,
                        startDate: new Date(),
                        duration: 3,
                    },
                    {
                        taskName: "Mockups deelopment",
                        type: "task",
                        isMilestone: false,
                        startDate: new Date(),
                        duration: 3,
                    },
                    {
                        taskName: "Deliver final design",
                        type: "task",
                        isMilestone: true,
                        startDate: new Date(),
                        duration: 3,
                    },
                ],
            },
            {
                taskName: "Environment Setup",
                type: "task",
                isMilestone: false,
                startDate: new Date(),
                duration: 3,
                subTask: [
                    {
                        taskName: "Staging environment",
                        type: "task",
                        isMilestone: false,
                        startDate: new Date(),
                        duration: 3,
                    },
                    {
                        taskName: "Production environment",
                        type: "task",
                        isMilestone: false,
                        startDate: new Date(),
                        duration: 3,
                    },
                    {
                        taskName: "QA environment",
                        type: "task",
                        isMilestone: false,
                        startDate: new Date(),
                        duration: 3,
                    },
                ],
            },
            {
                taskName: "Sprint 1",
                type: "task",
                isMilestone: false,
                startDate: new Date(),
                duration: 3,
                subTask: [
                    {
                        taskName: "Sprint 1 planning",
                        isMilestone: false,
                        startDate: new Date(),
                        duration: 3,
                    },
                    {
                        taskName: "Sprint 1 start",
                        isMilestone: true,
                        startDate: new Date(),
                        duration: 3,
                    },
                    {
                        taskName: "Sprint 1 period",
                        isMilestone: false,
                        startDate: new Date(),
                        duration: 3,
                    },
                    {
                        taskName: "Testing after sprint 1",
                        isMilestone: false,
                        startDate: new Date(),
                        duration: 3,
                    },
                    {
                        taskName: "Sprint 1 Stakeholder review",
                        isMilestone: false,
                        startDate: new Date(),
                        duration: 3,
                    },
                    {
                        taskName: "Sprint 1 Fix period",
                        isMilestone: false,
                        startDate: new Date(),
                        duration: 3,
                    },
                    {
                        taskName: "Deployment of Sprint 1 results",
                        isMilestone: true,
                        startDate: new Date(),
                        duration: 3,
                    },
                ],
            },
            {
                taskName: "Sprint 2",
                type: "task",
                isMilestone: false,
                startDate: new Date(),
                duration: 3,
                subTask: [
                    {
                        taskName: "Backlog grooming",
                        isMilestone: false,
                        startDate: new Date(),
                        duration: 3,
                    },
                    {
                        taskName: "Sprint 1 retrospective",
                        isMilestone: true,
                        startDate: new Date(),
                        duration: 3,
                    },
                    {
                        taskName: "Sprint 2 planning",
                        isMilestone: false,
                        startDate: new Date(),
                        duration: 3,
                    },
                    {
                        taskName: "Sprint 2 start",
                        isMilestone: true,
                        startDate: new Date(),
                        duration: 3,
                    },
                    {
                        taskName: "Sprint 2 period",
                        isMilestone: false,
                        startDate: new Date(),
                        duration: 3,
                    },
                    {
                        taskName: "Testing after sprint 2",
                        isMilestone: false,
                        startDate: new Date(),
                        duration: 3,
                    },
                    {
                        taskName: "Sprint 2 Stakeholder review",
                        isMilestone: false,
                        startDate: new Date(),
                        duration: 3,
                    },
                    {
                        taskName: "Sprint 2 Fix period",
                        isMilestone: false,
                        startDate: new Date(),
                        duration: 3,
                    },
                    {
                        taskName: "Deployment of Sprint 2 results",
                        isMilestone: true,
                        startDate: new Date(),
                        duration: 3,
                    },
                ],
            },
            {
                taskName: "Backlog",
                type: "task",
                isMilestone: false,
                startDate: new Date(),
                duration: 3,
                subTask: [
                    {
                        taskName: "Feature 1 developement",
                        type: "task",
                        isMilestone: false,
                        startDate: new Date(),
                        duration: 3,
                    },
                    {
                        taskName: "Feature 2 developement",
                        type: "task",
                        isMilestone: false,
                        startDate: new Date(),
                        duration: 3,
                    },
                    {
                        taskName: "Feature 3 developement",
                        type: "task",
                        isMilestone: false,
                        startDate: new Date(),
                        duration: 3,
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
            if (!findProject) {
                const createProject = await prisma.project.create({
                    data: {
                        organisationId: organisationId,
                        projectName: project.projectName,
                        startDate: project.startDate,
                        currency: project.currency,
                        createdByUserId: createdByUserId,
                    },
                });
                if (createProject && project.tasks) {
                    const taskCreationPromises = project.tasks.map(async (task) => {
                        const createParentTask = await prisma.task.create({
                            data: {
                                projectId: createProject.projectId,
                                taskName: task.taskName,
                                startDate: task.startDate,
                                duration: task.duration,
                                parentTaskId: null,
                                milestoneIndicator: task.isMilestone,
                                createdByUserId: createdByUserId,
                            },
                        });
                        if (createParentTask && task.subTask) {
                            await Promise.all(task.subTask.map(async (sub) => {
                                await prisma.task.create({
                                    data: {
                                        projectId: createProject.projectId,
                                        taskName: sub.taskName,
                                        startDate: sub.startDate,
                                        duration: sub.duration,
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
