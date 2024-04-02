import { getClientByTenantId } from "../config/db.js";
import { BadRequestError, ForbiddenError, NotFoundError, SuccessResponse, } from "../config/apiError.js";
import { StatusCodes } from "http-status-codes";
import { createOrganisationSchema, organisationIdSchema, updateOrganisationSchema, addMemberToOrgSchema, memberRoleSchema, reAssginedTaskSchema, assignProjectAndRoleToUserSchema, } from "../schemas/organisationSchema.js";
import { NotificationTypeEnum, ProjectStatusEnum, TaskStatusEnum, UserProviderTypeEnum, UserRoleEnum, UserStatusEnum } from "@prisma/client";
import { encrypt } from "../utils/encryption.js";
import { uuidSchema } from "../schemas/commonSchema.js";
import { ZodError } from "zod";
import { EmailService } from "../services/email.services.js";
import { settings } from "../config/settings.js";
import { generateRandomPassword } from "../utils/generateRandomPassword.js";
import { selectUserFields } from "../utils/selectedFieldsOfUsers.js";
import { HistoryTypeEnumValue } from "../schemas/enums.js";
import moment from 'moment';
import { AwsUploadService } from "../services/aws.services.js";
export const getOrganisationById = async (req, res) => {
    const organisationId = organisationIdSchema.parse(req.params.organisationId);
    const prisma = await getClientByTenantId(req.tenantId);
    const organisations = await prisma.organisation.findFirstOrThrow({
        where: {
            organisationId: organisationId,
            deletedAt: null,
        },
        include: {
            userOrganisation: {
                where: {
                    deletedAt: null,
                    user: {
                        status: UserStatusEnum.ACTIVE,
                    },
                },
                select: {
                    userOrganisationId: true,
                    jobTitle: true,
                    role: true,
                    taskColour: true,
                    user: {
                        where: {
                            status: UserStatusEnum.ACTIVE
                        },
                        select: selectUserFields,
                    },
                },
                orderBy: {
                    createdAt: 'asc',
                }
            },
        },
    });
    return new SuccessResponse(StatusCodes.OK, organisations, "Organisation selected").send(res);
};
export const createOrganisation = async (req, res) => {
    const { organisationName, industry, status, country, nonWorkingDays } = createOrganisationSchema.parse(req.body);
    if (!req.userId) {
        throw new BadRequestError("userId not found!!");
    }
    const prisma = await getClientByTenantId(req.tenantId);
    // CASE : One user can create only one organisation
    const findOrganisation = await prisma.userOrganisation.findFirst({
        where: { userId: req.userId, deletedAt: null },
    });
    if (findOrganisation) {
        throw new BadRequestError("Organisation is already created");
    }
    const organisation = await prisma.organisation.create({
        data: {
            organisationName: organisationName,
            industry: industry,
            status: status,
            country: country,
            tenantId: req.tenantId,
            createdByUserId: req.userId,
            updatedByUserId: req.userId,
            userOrganisation: {
                create: {
                    userId: req.userId,
                    role: UserRoleEnum.ADMINISTRATOR,
                },
            },
            nonWorkingDays: nonWorkingDays,
        },
    });
    const findUser = await prisma.user.findFirst({
        where: { userId: req.userId },
    });
    if (findUser?.country === null) {
        await prisma.user.update({
            where: { userId: req.userId },
            data: {
                country: country,
            },
        });
    }
    ;
    return new SuccessResponse(StatusCodes.CREATED, organisation, "Organisation created successfully").send(res);
};
export const updateOrganisation = async (req, res) => {
    if (!req.userId) {
        throw new BadRequestError("userId not found!");
    }
    const organisationId = organisationIdSchema.parse(req.params.organisationId);
    const updateOrganisationValue = updateOrganisationSchema.parse(req.body);
    const prisma = await getClientByTenantId(req.tenantId);
    const organisation = await prisma.organisation.findFirst({
        where: {
            organisationId: organisationId,
            deletedAt: null,
        },
        include: {
            userOrganisation: true,
        },
    });
    if (!organisation)
        throw new NotFoundError("Organisation not found");
    if (!organisation.userOrganisation.some((uo) => uo.userId === req.userId && UserRoleEnum.ADMINISTRATOR == uo.role)) {
        throw new ForbiddenError();
    }
    let updateObj = { ...updateOrganisationValue, updatedByUserId: req.userId };
    const organisationUpdate = await prisma.organisation.update({
        where: {
            organisationId: organisationId,
            userOrganisation: {
                some: {
                    role: UserRoleEnum.ADMINISTRATOR,
                },
            },
        },
        data: { ...updateObj },
    });
    return new SuccessResponse(StatusCodes.OK, organisationUpdate, "Organisation updated successfully").send(res);
};
export const addOrganisationMember = async (req, res) => {
    if (!req.userId) {
        throw new BadRequestError("userId not found!!");
    }
    const bodyValue = addMemberToOrgSchema.parse(req.body);
    const organisationId = uuidSchema.parse(req.params.organisationId);
    const prisma = await getClientByTenantId(req.tenantId);
    const user = await prisma.user.findFirst({
        where: {
            email: bodyValue.email,
        },
        include: {
            userOrganisation: {
                include: {
                    organisation: true,
                },
            },
        },
    });
    if (!user) {
        const randomPassword = generateRandomPassword();
        const hashedPassword = await encrypt(randomPassword);
        const newUser = await prisma.user.create({
            data: {
                email: bodyValue.email,
                status: UserStatusEnum.ACTIVE,
                provider: {
                    create: {
                        idOrPassword: hashedPassword,
                        providerType: UserProviderTypeEnum.EMAIL
                    }
                },
                userOrganisation: {
                    create: {
                        organisationId: organisationId
                    }
                }
            },
            include: {
                userOrganisation: {
                    include: {
                        organisation: {
                            include: {
                                createdByUser: true
                            }
                        }
                    }
                }
            }
        });
        try {
            const newUserOrg = newUser.userOrganisation.find((org) => org.organisationId === organisationId);
            let adminName;
            if (newUserOrg?.organisation?.createdByUser.firstName &&
                newUserOrg?.organisation?.createdByUser.lastName) {
                adminName =
                    newUserOrg?.organisation?.createdByUser.firstName +
                        " " +
                        newUserOrg?.organisation?.createdByUser.lastName;
            }
            else {
                adminName = newUserOrg?.organisation?.createdByUser.email;
            }
            const subjectMessage = `You've been Invited to ${newUserOrg?.organisation?.organisationName} organization `;
            const bodyMessage = `
      Hello,

      ${adminName} invited you to his/her Organization 
      ${newUserOrg?.organisation?.organisationName} on ProjectChef.
      Please use the information bellow to login:
      
      URL: ${settings.appURL}/login
      LOGIN: ${newUser.email}
      PASSWORD: ${randomPassword}

      Best Regards,
      ProjectChef Support Team

      `;
            await EmailService.sendEmail(newUser.email, subjectMessage, bodyMessage);
        }
        catch (error) {
            console.error("Failed to sign up email", error);
        }
        return new SuccessResponse(StatusCodes.OK, newUser, "Added member successfully").send(res);
    }
    else {
        const userOrgDetails = user.userOrganisation.find((uo) => uo.organisationId === organisationId);
        if (userOrgDetails) {
            try {
                await prisma.user.update({
                    where: { userId: user.userId },
                    data: {
                        deletedAt: null,
                        userOrganisation: {
                            update: {
                                where: {
                                    userOrganisationId: userOrgDetails.userOrganisationId,
                                    organisationId,
                                },
                                data: {
                                    deletedAt: null,
                                },
                            },
                        },
                    },
                });
            }
            catch (error) {
                console.error(error);
            }
        }
        else {
            await prisma.userOrganisation.create({
                data: {
                    userId: user.userId,
                    organisationId,
                },
            });
        }
        if (userOrgDetails?.organisationId !== organisationId &&
            user.userOrganisation.length !== 0) {
            throw new ZodError([
                {
                    code: "invalid_string",
                    message: "User is part of another organisation",
                    path: ["email"],
                    validation: "email",
                },
            ]);
        }
        return new SuccessResponse(StatusCodes.OK, user, "Added member successfully").send(res);
    }
};
export const removeOrganisationMember = async (req, res) => {
    if (!req.userId) {
        throw new BadRequestError("userId not found!");
    }
    const prisma = await getClientByTenantId(req.tenantId);
    const userOrganisationId = uuidSchema.parse(req.params.userOrganisationId);
    const findUserOrg = await prisma.userOrganisation.findFirstOrThrow({
        where: { userOrganisationId },
        include: { user: true, },
    });
    const findAssignedTask = await prisma.task.findMany({
        where: {
            deletedAt: null,
            status: {
                notIn: [TaskStatusEnum.COMPLETED],
            },
            assignedUsers: {
                some: {
                    deletedAt: null,
                    assginedToUserId: findUserOrg.userId,
                },
            },
        },
    });
    const findAssignedProject = await prisma.project.findMany({
        where: {
            status: {
                in: [ProjectStatusEnum.ACTIVE],
            },
            assignedUsers: {
                some: {
                    assginedToUserId: findUserOrg.userId,
                },
            },
        },
    });
    if (findAssignedProject.length > 0) {
        throw new BadRequestError("Active projects is already exists for this user!");
    }
    if (findAssignedTask.length > 0) {
        throw new BadRequestError("Pending tasks is already exists for this user!");
    }
    await prisma.$transaction([
        prisma.userOrganisation.update({
            where: { userOrganisationId },
            data: {
                deletedAt: new Date(),
                user: {
                    update: {
                        provider: {
                            updateMany: {
                                where: {
                                    userId: findUserOrg.userId
                                },
                                data: {
                                    deletedAt: new Date(),
                                }
                            }
                        },
                        deletedAt: new Date(),
                    },
                },
            },
        }),
        prisma.user.update({
            where: { userId: findUserOrg.userId },
            data: {
                deletedAt: new Date(),
            },
            include: {
                comment: true,
                userOrganisation: true,
                userResetPassword: true,
                createdOrganisations: true,
                updatedOrganisations: true,
                createdProject: true,
                updatedProject: true,
                provider: true,
                createdTask: true,
                updatedTask: true,
                taskAssignUsers: true,
                createdKanbanColumn: true,
                updatedKanbanColumn: true,
                history: true,
                uploadedAttachment: true,
                addedDependencies: true,
                sentNotifications: true,
                receivedNotifications: true,
                projectAssignUsers: true
            },
        }),
    ]);
    return new SuccessResponse(StatusCodes.OK, null, "Member removed successfully").send(res);
};
export const changeMemberRole = async (req, res) => {
    if (!req.userId) {
        throw new BadRequestError("userId not found!");
    }
    const userOrganisationId = uuidSchema.parse(req.params.userOrganisationId);
    const { role } = memberRoleSchema.parse(req.body);
    const prisma = await getClientByTenantId(req.tenantId);
    await prisma.userOrganisation.update({
        where: { userOrganisationId: userOrganisationId },
        data: {
            role: role,
        },
    });
    return new SuccessResponse(StatusCodes.OK, null, "Member role changed successfully").send(res);
};
export const reassignTasksAndProjects = async (req, res) => {
    const userId = req.userId;
    if (!userId) {
        throw new BadRequestError("userId not found!");
    }
    const prisma = await getClientByTenantId(req.tenantId);
    const { oldUserId, newUserId } = reAssginedTaskSchema.parse(req.body);
    const oldUsersTasks = await prisma.taskAssignUsers.findMany({
        where: {
            assginedToUserId: oldUserId,
            deletedAt: null,
            task: {
                status: TaskStatusEnum.IN_PROGRESS
            }
        },
        include: {
            task: true,
        },
    });
    const oldUsersProjects = await prisma.projectAssignUsers.findMany({
        where: {
            assginedToUserId: oldUserId,
            project: {
                status: ProjectStatusEnum.ACTIVE
            }
        },
        include: {
            project: true,
        }
    });
    for (const oldUserOfProject of oldUsersProjects) {
        const existingAssignment = await prisma.projectAssignUsers.findFirst({
            where: {
                assginedToUserId: newUserId,
                projectId: oldUserOfProject.project.projectId
            },
        });
        await prisma.projectAssignUsers.delete({
            where: { projectAssignUsersId: oldUserOfProject.projectAssignUsersId },
        });
        if (!existingAssignment) {
            await prisma.projectAssignUsers.create({
                data: {
                    assginedToUserId: newUserId,
                    projectId: oldUserOfProject.project.projectId,
                    projectRole: oldUserOfProject.projectRole
                },
            });
        }
    }
    for (const oldUsersTask of oldUsersTasks) {
        const existingAssignmentTask = await prisma.taskAssignUsers.findUnique({
            where: {
                taskAssignUsersId: newUserId,
            },
            include: {
                user: {
                    select: {
                        email: true,
                    },
                },
            },
        });
        const deletedUser = await prisma.taskAssignUsers.delete({
            where: { taskAssignUsersId: oldUsersTask.taskAssignUsersId },
            include: {
                user: {
                    select: {
                        email: true,
                    },
                },
            },
        });
        let newCreatedUser;
        if (!existingAssignmentTask) {
            newCreatedUser = await prisma.taskAssignUsers.create({
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
        }
        //Send notification
        const message = `Task reassigned to you`;
        await prisma.notification.sendNotification(NotificationTypeEnum.TASK, message, newUserId, userId, oldUsersTask.taskId);
        // History-Manage
        const historyMessage = "Task's assignee changed from";
        const historyData = {
            oldValue: deletedUser?.user?.email,
            newValue: newCreatedUser
                ? newCreatedUser.user.email
                : existingAssignmentTask?.user.email,
        };
        await prisma.history.createHistory(userId, HistoryTypeEnumValue.TASK, historyMessage, historyData, oldUsersTask.taskId);
    }
    return new SuccessResponse(StatusCodes.OK, null, "Tasks reassigned successfully.").send(res);
};
export const uploadHolidayCSV = async (req, res) => {
    const userId = req.userId;
    const organisationId = uuidSchema.parse(req.params.organisationId);
    if (!userId) {
        throw new BadRequestError("userId not found!");
    }
    const file = req.files?.csv;
    if (!file) {
        throw new BadRequestError("No CSV file uploaded!");
    }
    const fileName = file.name;
    const fileExtension = fileName.split('.').pop();
    if (fileExtension !== 'csv') {
        throw new BadRequestError("Please upload a CSV file.");
    }
    const csvString = file.data.toString("utf-8");
    const csvRows = csvString
        .split("\n")
        .map((row, index) => {
        if (index === 0)
            return null;
        const columns = row.split(";").map((col) => col.trim());
        if (columns.length < 4)
            return null;
        return {
            Date: moment.utc(columns[0], "DD.MM.YYYY").toDate(),
            Designation: columns[1] ? columns[1].replace(/[\ufffd"]/g, "") : "",
            DayOfWeek: columns[2] ? columns[2].replace(/[\ufffd"]/g, "") : "",
            CalendarWeek: columns[3] ? columns[3].replace(/[\ufffd"]/g, "") : "",
        };
    })
        .filter((row) => row !== null);
    const prisma = await getClientByTenantId(req.tenantId);
    const findUploadedCSV = await prisma.organisation.findFirstOrThrow({
        where: {
            organisationId,
        },
        select: {
            organisationName: true,
            holidayCsvUrl: true,
        },
    });
    const avatarImgURL = await AwsUploadService.uploadFileWithContent(`${findUploadedCSV.organisationName}-${fileName}`, file.data, 'organisation-csv');
    await prisma.$transaction(async (prisma) => {
        await Promise.all([
            prisma.organisationHolidays.deleteMany({
                where: { organisationId },
            }),
            prisma.organisation.update({
                where: { organisationId },
                data: {
                    holidayCsvUrl: avatarImgURL
                }
            })
        ]);
        const holidayRecords = csvRows.map(async (value) => {
            if (value?.Date) {
                const findHoliday = await prisma.organisationHolidays.findFirst({
                    where: {
                        organisationId,
                        holidayStartDate: value.Date,
                        holidayReason: value.Designation,
                    },
                });
                if (!findHoliday) {
                    return prisma.organisationHolidays.create({
                        data: {
                            holidayStartDate: value.Date,
                            holidayEndDate: null,
                            holidayReason: value.Designation,
                            organisationId: organisationId,
                        },
                    });
                }
            }
        });
        await Promise.all(holidayRecords);
    });
    return new SuccessResponse(StatusCodes.OK, csvRows, "Successfully uploaded holidays").send(res);
};
export const resendInvitationToMember = async (req, res) => {
    const userOrganisationId = uuidSchema.parse(req.params.userOrganisationId);
    const prisma = await getClientByTenantId(req.tenantId);
    const findMember = await prisma.userOrganisation.findFirstOrThrow({
        where: {
            userOrganisationId,
        },
        include: {
            organisation: {
                include: {
                    createdByUser: true
                }
            },
            user: {
                select: {
                    userId: true,
                    email: true,
                    isVerified: true,
                    firstName: true,
                    lastName: true,
                },
            },
        },
    });
    if (findMember.user?.isVerified) {
        throw new BadRequestError("Organisation member is already verified!");
    }
    if (!findMember.user) {
        throw new BadRequestError("Member not found!");
    }
    const randomPassword = generateRandomPassword();
    const hashedPassword = await encrypt(randomPassword);
    try {
        let adminName;
        if (findMember?.organisation?.createdByUser.firstName &&
            findMember?.organisation?.createdByUser.lastName) {
            adminName =
                findMember?.organisation?.createdByUser.firstName +
                    " " +
                    findMember?.organisation?.createdByUser.lastName;
        }
        else {
            adminName = findMember?.organisation?.createdByUser.email;
        }
        const subjectMessage = `You’ve been Invited to ${findMember?.organisation?.organisationName} organization `;
        const bodyMessage = `
      Hello,

      ${adminName} invited you to his/her Organization 
      ${findMember?.organisation?.organisationName} on ProjectChef.
      Please use the information bellow to login:
      
      URL: ${settings.appURL}/login
      LOGIN: ${findMember.user.email}
      PASSWORD: ${randomPassword}

      Best Regards,
      ProjectChef Support Team

      `;
        const findProvider = await prisma.userProvider.findFirstOrThrow({
            where: {
                userId: findMember.user.userId,
                providerType: UserProviderTypeEnum.EMAIL,
            },
        });
        await prisma.userProvider.update({
            where: {
                userProviderId: findProvider.userProviderId,
            },
            data: {
                idOrPassword: hashedPassword,
                providerType: UserProviderTypeEnum.EMAIL,
            },
        });
        await EmailService.sendEmail(findMember.user.email, subjectMessage, bodyMessage);
    }
    catch (error) {
        console.error("Failed resend email", error);
    }
    return new SuccessResponse(StatusCodes.OK, null, "Resend Invitation").send(res);
};
export const assignProjectAndRoleToUser = async (req, res) => {
    if (!req.userId) {
        throw new BadRequestError("userId not found!!");
    }
    const userOrganisationId = uuidSchema.parse(req.params.userOrganisationId);
    const prisma = await getClientByTenantId(req.tenantId);
    const bodyValue = assignProjectAndRoleToUserSchema.parse(req.body);
    const findUserOrg = await prisma.userOrganisation.findFirstOrThrow({
        where: {
            userOrganisationId,
            deletedAt: null,
        },
        include: {
            user: true,
            organisation: true,
        },
    });
    const existingAssignments = await prisma.projectAssignUsers.findMany({
        where: {
            assginedToUserId: findUserOrg.userId,
        },
    });
    const bodyProjectIds = bodyValue.map(item => item.projectId);
    const assignmentsToDelete = existingAssignments.filter(assignment => !bodyProjectIds.includes(assignment.projectId));
    for (const assignment of assignmentsToDelete) {
        await prisma.projectAssignUsers.delete({
            where: {
                projectAssignUsersId: assignment.projectAssignUsersId,
            },
        });
    }
    for (const item of bodyValue) {
        const checkUserExistsOrNot = await prisma.projectAssignUsers.findFirst({
            where: {
                assginedToUserId: findUserOrg.userId,
                projectId: item.projectId,
            }
        });
        if (checkUserExistsOrNot) {
            const updateUserDetails = await prisma.projectAssignUsers.update({
                where: {
                    projectAssignUsersId: checkUserExistsOrNot.projectAssignUsersId
                },
                data: {
                    projectId: item.projectId,
                    projectRole: item.projectRoleForUser,
                    assginedToUserId: findUserOrg.userId
                }
            });
        }
        else {
            const member = await prisma.projectAssignUsers.create({
                data: {
                    assginedToUserId: findUserOrg.userId,
                    projectId: item.projectId,
                    projectRole: item.projectRoleForUser,
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
            const message = `Project assigned to you`;
            await prisma.notification.sendNotification(NotificationTypeEnum.PROJECT, message, findUserOrg.userId, req.userId, item.projectId);
        }
    }
    return new SuccessResponse(StatusCodes.CREATED, null, "Project & role successfully assgined to user").send(res);
};
