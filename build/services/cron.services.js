import cron from "node-cron";
import { getClientByTenantId } from "../config/db.js";
import { EmailService } from "./email.services.js";
import { NotificationTypeEnum } from "@prisma/client";
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
    // static async sendNotificationAndEmailToTaskDueDateOldCode() {
    //   cron.schedule(
    //     "0 0 * * *",
    //     async () => {
    //       try {
    //         const currentDate = new Date();
    //         const prisma = await getClientByTenantId("root");
    //         const tasks = await prisma.task.findMany({
    //           where: {
    //             deletedAt: null,
    //           },
    //           include: {
    //             assignedUsers: {
    //               where: { deletedAt: null },
    //               include: {
    //                 user: true,
    //               },
    //             },
    //             project: {
    //               select: {
    //                 organisationId: true,
    //               },
    //             },
    //           },
    //         });
    //         for (const task of tasks) {
    //           const endDate = await taskEndDate(
    //             task,
    //             "root",
    //             task.project.organisationId
    //           );
    //           // Convert endDate to date object
    //           const taskEndDateObj = new Date(endDate);
    //           if (
    //             currentDate.getDate() === taskEndDateObj.getDate() &&
    //             currentDate.getMonth() === taskEndDateObj.getMonth() &&
    //             currentDate.getFullYear() === taskEndDateObj.getFullYear()
    //           ) {
    //             let message = `
    //               Hello,
    //               Please note that these tasks are due today:
    //               Task '${task.taskName}' is due today.
    //               Best Regards,
    //               ProjectChef Support Team
    //             `;
    //             const assignedUsers = task.assignedUsers.map((user) => user);
    //             for (const user of assignedUsers) {
    //               const email = user.user.email;
    //               const userId = user.assginedToUserId;
    //               const subjectMessage = `ProjectChef: Task Due Today`;
    //               //Send Notification
    //               await prisma.notification.sendNotification(
    //                 NotificationTypeEnum.TASK,
    //                 message,
    //                 userId,
    //                 userId,
    //                 task.taskId
    //               );
    //               // Send Email
    //               await EmailService.sendEmail(email, subjectMessage, message);
    //             }
    //           }
    //         }
    //       } catch (error) {
    //         console.error(
    //           "Error in sendNotificationAndEmailToTaskDueDate:",
    //           error
    //         );
    //       }
    //     },
    //     { scheduled: true }
    //   );
    // }
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
                    let dueTasksName = "";
                    let message = `
              Hello, ${user.firstName}

              Please note that these tasks are due today:
              Task ${dueTasksName} is due today.

              Best Regards,
              ProjectChef Support Team
            `;
                    for (const taskId of userAndTasks[1]) {
                        const dueTask = await prisma.task.findFirst({
                            where: {
                                taskId,
                                deletedAt: null,
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
                                dueTasksName = dueTask.taskName;
                                await prisma.notification.sendNotification(NotificationTypeEnum.TASK, message, user.userId, user.userId, dueTask.taskId);
                            }
                        }
                    }
                    let taskNamesString = "";
                    for (let i = 0; i < dueTodayTasks.length; i++) {
                        taskNamesString += `'${dueTodayTasks[i]}'`;
                        if (i < dueTodayTasks.length - 1) {
                            taskNamesString += ", ";
                        }
                    }
                    dueTasksName = taskNamesString;
                    if (dueTodayTasks.length > 0) {
                        const email = user.email;
                        const subjectMessage = `ProjectChef: Task Due Today`;
                        // Send Email
                        await EmailService.sendEmail(email, subjectMessage, message);
                    }
                }
            }
            catch (error) {
                console.error("Error in Console Due date", error);
            }
        }, { scheduled: true });
    }
}
