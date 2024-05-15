import cron from "node-cron";
import { NotificationTypeEnum, TaskStatusEnum } from "@prisma/client";
import { getClientByTenantId } from "../config/db.js";
import { EmailService } from "./email.services.js";
import { taskEndDate } from "../utils/calcualteTaskEndDate.js";
export class CronService {
    static async oneMonthCron() {
        cron.schedule("0 0 1 * *", async () => {
            try {
                console.log("called-this oneMonthCron");
            }
            catch (error) {
                console.error("Error in oneMonthCron:", error);
            }
        }, {
            scheduled: true,
        });
    }
    static async sendNotificationAndEmailToTaskDueDate() {
        cron.schedule("0 0 * * *", async () => {
            try {
                const currentDate = new Date();
                const prisma = await getClientByTenantId("root");
                const assignedUsers = await prisma.taskAssignUsers.findMany({
                    where: { deletedAt: null },
                    select: {
                        assginedToUserId: true,
                        taskId: true,
                    },
                });
                const userAndAssignedTasks = new Map();
                for (let assignedUser of assignedUsers) {
                    if (userAndAssignedTasks.has(assignedUser.assginedToUserId)) {
                        let tasksAssigned = userAndAssignedTasks.get(assignedUser.assginedToUserId);
                        tasksAssigned.push(assignedUser.taskId);
                        userAndAssignedTasks.set(assignedUser.assginedToUserId, tasksAssigned);
                    }
                    else {
                        userAndAssignedTasks.set(assignedUser.assginedToUserId, [
                            assignedUser.taskId,
                        ]);
                    }
                }
                for (let userAndTasks of userAndAssignedTasks) {
                    const user = await prisma.user.findUnique({
                        where: {
                            userId: userAndTasks[0],
                            deletedAt: null,
                        },
                    });
                    if (!user) {
                        return null;
                    }
                    let dueTodayTasks = [];
                    const nameOfUser = user.firstName && user.lastName
                        ? `${user.firstName} ${user.lastName}`
                        : user.email;
                    for (const taskId of userAndTasks[1]) {
                        const dueTask = await prisma.task.findFirst({
                            where: {
                                taskId,
                                deletedAt: null,
                                status: {
                                    in: [
                                        TaskStatusEnum.NOT_STARTED,
                                        TaskStatusEnum.IN_PROGRESS,
                                    ],
                                },
                            },
                            include: {
                                assignedUsers: {
                                    where: { deletedAt: null },
                                    include: {
                                        user: true,
                                    },
                                },
                                project: {
                                    select: {
                                        organisationId: true,
                                    },
                                },
                            },
                        });
                        if (dueTask) {
                            const endDate = await taskEndDate(dueTask, "root", dueTask.project.organisationId);
                            const taskEndDateObj = new Date(endDate);
                            if (currentDate.getDate() === taskEndDateObj.getDate() &&
                                currentDate.getMonth() === taskEndDateObj.getMonth() &&
                                currentDate.getFullYear() === taskEndDateObj.getFullYear()) {
                                dueTodayTasks.push(dueTask.taskName);
                                const notificationMessage = `${dueTask.taskName} is due today.`;
                                try {
                                    await prisma.notification.sendNotification(NotificationTypeEnum.TASK, notificationMessage, user.userId, user.userId, dueTask.taskId);
                                }
                                catch (error) {
                                    console.error("Error while sending duetask notification", error);
                                }
                            }
                        }
                    }
                    let taskNamesString = "";
                    for (let i = 0; i < dueTodayTasks.length; i++) {
                        taskNamesString += `${i + 1}. ${dueTodayTasks[i]}`;
                        if (i < dueTodayTasks.length - 1) {
                            taskNamesString += `, `;
                        }
                    }
                    if (dueTodayTasks.length > 0) {
                        const email = user.email;
                        try {
                            await EmailService.sendDueTaskTemplate(email, nameOfUser, taskNamesString);
                        }
                        catch (error) {
                            console.error("Error while sending duetask email", error);
                        }
                    }
                }
            }
            catch (error) {
                console.error("Error in Console Due date", error);
            }
        }, { scheduled: true });
    }
}
