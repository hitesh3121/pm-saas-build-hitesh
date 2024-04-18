import { StatusCodes } from "http-status-codes";
import moment from "moment";
import { ZodError } from "zod";
import { NotificationTypeEnum, ProjectStatusEnum, TaskStatusEnum, UserProviderTypeEnum, UserRoleEnum, UserStatusEnum, } from "@prisma/client";
import { getClientByTenantId } from "../config/db.js";
import { BadRequestError, ForbiddenError, NotFoundError, SuccessResponse, } from "../config/apiError.js";
import { createOrganisationSchema, organisationIdSchema, updateOrganisationSchema, addMemberToOrgSchema, memberRoleSchema, reAssginedTaskSchema, assignProjectAndRoleToUserSchema, organisationUserBlockUnblockSchema, roleChangePmToTmSchema, } from "../schemas/organisationSchema.js";
import { encrypt } from "../utils/encryption.js";
import { uuidSchema } from "../schemas/commonSchema.js";
import { EmailService } from "../services/email.services.js";
import { generateRandomPassword } from "../utils/generateRandomPassword.js";
import { selectUserFields } from "../utils/selectedFieldsOfUsers.js";
import { HistoryTypeEnumValue } from "../schemas/enums.js";
import { AwsUploadService } from "../services/aws.services.js";
import { generateOTP } from "../utils/otpHelper.js";
import { createDemoProjectsCommon } from "../utils/demoProjects.js";
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
                },
                select: {
                    userOrganisationId: true,
                    jobTitle: true,
                    role: true,
                    taskColour: true,
                    user: {
                        select: selectUserFields,
                    },
                },
                orderBy: {
                    createdAt: "asc",
                },
            },
        },
    });
    return new SuccessResponse(StatusCodes.OK, organisations, "Organisation selected").send(res);
};
export const createOrganisation = async (req, res) => {
    const { organisationName, industry, status, country, nonWorkingDays, phoneNumber, countryCode, createDemoProjects, } = createOrganisationSchema.parse(req.body);
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
            nonWorkingDays: nonWorkingDays ?? [],
        },
    });
    if (organisation && createDemoProjects) {
        try {
            await createDemoProjectsCommon(req.tenantId, req.userId, organisation.organisationId);
        }
        catch (error) {
            console.error(error);
        }
    }
    const findUser = await prisma.user.findFirst({
        where: { userId: req.userId },
    });
    if (findUser) {
        await prisma.user.update({
            where: { userId: req.userId },
            data: {
                country: findUser?.country === null ? country : findUser?.country,
                phoneNumber: phoneNumber,
                countryCode: countryCode,
            },
        });
    }
    return new SuccessResponse(StatusCodes.CREATED, organisation, "Organisation created successfully").send(res);
};
export const updateOrganisation = async (req, res) => {
    if (!req.userId) {
        throw new BadRequestError("userId not found!");
    }
    const organisationId = organisationIdSchema.parse(req.params.organisationId);
    const { phoneNumber, countryCode, userId, ...withoutCountryAndCode } = updateOrganisationSchema.parse(req.body);
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
    let updateObj = { ...withoutCountryAndCode, updatedByUserId: req.userId };
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
    if (userId) {
        await prisma.user.update({
            where: {
                userId,
            },
            data: {
                countryCode,
                phoneNumber,
            },
        });
    }
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
                        providerType: UserProviderTypeEnum.EMAIL,
                    },
                },
                userOrganisation: {
                    create: {
                        organisationId: organisationId,
                    },
                },
            },
            include: {
                userOrganisation: {
                    include: {
                        organisation: {
                            include: {
                                createdByUser: true,
                            },
                        },
                    },
                },
            },
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
            const organisationName = newUserOrg?.organisation?.organisationName;
            await EmailService.sendEmailForAddUserToOrganisationTemplate(organisationName, adminName, newUser.email, randomPassword);
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
        include: { user: true },
    });
    const findAssignedTask = await prisma.task.findMany({
        where: {
            deletedAt: null,
            status: {
                in: [TaskStatusEnum.NOT_STARTED, TaskStatusEnum.IN_PROGRESS],
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
            deletedAt: null,
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
    const otpValue = generateOTP();
    // await prisma.$transaction([
    await prisma.userOrganisation.update({
        where: { userOrganisationId },
        data: {
            deletedAt: new Date(),
            user: {
                update: {
                    provider: {
                        updateMany: {
                            where: {
                                userId: findUserOrg.userId,
                            },
                            data: {
                                deletedAt: new Date(),
                            },
                        },
                    },
                    projectAssignUsers: {
                        deleteMany: {
                            assginedToUserId: findUserOrg.userId,
                        },
                    },
                    taskAssignUsers: {
                        deleteMany: {
                            assginedToUserId: findUserOrg.userId,
                        },
                    },
                    deletedAt: new Date(),
                    email: `${findUserOrg.user?.email}_deleted_${otpValue}`,
                },
            },
        },
    });
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
                status: {
                    in: [TaskStatusEnum.IN_PROGRESS, TaskStatusEnum.NOT_STARTED],
                },
            },
        },
        include: {
            task: true,
        },
    });
    const oldUsersProjects = await prisma.projectAssignUsers.findMany({
        where: {
            assginedToUserId: oldUserId,
            project: {
                status: {
                    in: [ProjectStatusEnum.ACTIVE],
                },
            },
        },
        include: {
            project: true,
        },
    });
    for (const oldUsersTask of oldUsersTasks) {
        const deletedUser = await prisma.taskAssignUsers.delete({
            where: {
                taskAssignUsersId: oldUsersTask.taskAssignUsersId,
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
        const userExistInTask = await prisma.taskAssignUsers.findFirst({
            where: {
                assginedToUserId: newUserId,
                taskId: oldUsersTask.taskId,
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
    for (const oldUserOfProject of oldUsersProjects) {
        const deletedProjectUser = await prisma.projectAssignUsers.delete({
            where: {
                projectAssignUsersId: oldUserOfProject.projectAssignUsersId,
                projectId: oldUserOfProject.projectId,
            },
        });
        const userExists = await prisma.projectAssignUsers.findFirst({
            where: {
                assginedToUserId: newUserId,
                projectId: oldUserOfProject.projectId,
            },
        });
        if (!userExists) {
            const updatedNewUser = await prisma.projectAssignUsers.create({
                data: {
                    assginedToUserId: newUserId,
                    projectId: oldUserOfProject.projectId,
                    projectRole: oldUserOfProject.projectRole,
                },
            });
        }
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
    const fileExtension = fileName.split(".").pop();
    if (fileExtension !== "csv") {
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
    const avatarImgURL = await AwsUploadService.uploadFileWithContent(`${findUploadedCSV.organisationName}-${fileName}`, file.data, "organisation-csv");
    await prisma.$transaction(async (prisma) => {
        await Promise.all([
            prisma.organisationHolidays.deleteMany({
                where: { organisationId },
            }),
            prisma.organisation.update({
                where: { organisationId },
                data: {
                    holidayCsvUrl: avatarImgURL,
                },
            }),
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
                    createdByUser: true,
                },
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
        const organisationName = findMember?.organisation?.organisationName;
        await EmailService.sendEmailForAddUserToOrganisationTemplate(organisationName, adminName, findMember.user.email, randomPassword);
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
    const { arrayOfRoleAndProjectId, isRoleChangePmToTm } = assignProjectAndRoleToUserSchema.parse(req.body);
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
        select: {
            projectAssignUsersId: true,
            projectId: true,
            projectRole: true,
        },
    });
    const bodyProjectIds = arrayOfRoleAndProjectId.map((item) => item.projectId);
    const assignmentsToDelete = existingAssignments.filter((assignment) => !bodyProjectIds.includes(assignment.projectId));
    // Get IDs of assignments to delete
    const assignmentsIdsToDelete = assignmentsToDelete.map((assignment) => assignment.projectAssignUsersId);
    // Batch delete assignments
    await prisma.$transaction(assignmentsIdsToDelete.map((userId) => prisma.projectAssignUsers.delete({
        where: {
            projectAssignUsersId: userId,
        },
    })));
    for (const item of arrayOfRoleAndProjectId) {
        const findPM = await prisma.projectAssignUsers.findFirst({
            where: {
                projectRole: UserRoleEnum.PROJECT_MANAGER,
                projectId: item.projectId,
            },
        });
        if (findPM &&
            item.projectRoleForUser === UserRoleEnum.PROJECT_MANAGER &&
            !isRoleChangePmToTm &&
            findPM.assginedToUserId !== findUserOrg.userId) {
            throw new BadRequestError("Project Manager already exists!!");
        }
        else if (findPM &&
            item.projectRoleForUser === UserRoleEnum.PROJECT_MANAGER &&
            isRoleChangePmToTm) {
            try {
                await prisma.projectAssignUsers.update({
                    where: {
                        projectId: item.projectId,
                        projectAssignUsersId: findPM.projectAssignUsersId,
                    },
                    data: {
                        projectRole: UserRoleEnum.TEAM_MEMBER,
                    },
                });
                const checkPMExistsOrNot = await prisma.projectAssignUsers.findFirst({
                    where: {
                        assginedToUserId: findUserOrg.userId,
                        projectId: item.projectId,
                        projectRole: UserRoleEnum.PROJECT_MANAGER,
                    },
                });
                if (!checkPMExistsOrNot) {
                    await prisma.projectAssignUsers.create({
                        data: {
                            projectRole: UserRoleEnum.PROJECT_MANAGER,
                            assginedToUserId: findUserOrg.userId,
                            projectId: item.projectId,
                        },
                    });
                }
                else {
                    await prisma.projectAssignUsers.update({
                        where: {
                            projectAssignUsersId: checkPMExistsOrNot.projectAssignUsersId,
                            projectId: item.projectId,
                        },
                        data: {
                            projectRole: UserRoleEnum.PROJECT_MANAGER,
                        },
                    });
                }
            }
            catch (error) {
                console.error(error);
            }
        }
        const checkUserExistsOrNot = await prisma.projectAssignUsers.findFirst({
            where: {
                assginedToUserId: findUserOrg.userId,
                projectId: item.projectId,
            },
        });
        if (checkUserExistsOrNot) {
            const updateUserDetails = await prisma.projectAssignUsers.update({
                where: {
                    projectAssignUsersId: checkUserExistsOrNot.projectAssignUsersId,
                },
                data: {
                    projectId: item.projectId,
                    projectRole: item.projectRoleForUser,
                    assginedToUserId: findUserOrg.userId,
                },
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
export const organisationUserBlockUnblock = async (req, res) => {
    const prisma = await getClientByTenantId(req.tenantId);
    if (!req.userId) {
        throw new BadRequestError("userId not found!!");
    }
    const { organisationId, userOrganisationId } = organisationUserBlockUnblockSchema.parse(req.body);
    const findUserOrg = await prisma.userOrganisation.findFirstOrThrow({
        where: {
            userOrganisationId,
            organisationId,
            deletedAt: null,
        },
        include: {
            user: {
                select: {
                    status: true,
                },
            },
        },
    });
    await prisma.user.update({
        data: {
            status: findUserOrg.user?.status === UserStatusEnum.INACTIVE
                ? UserStatusEnum.ACTIVE
                : UserStatusEnum.INACTIVE,
        },
        where: { userId: findUserOrg.userId },
    });
    return new SuccessResponse(StatusCodes.OK, null, "Status updated successfully.").send(res);
};
export const changePmToTm = async (req, res) => {
    if (!req.userId) {
        throw new BadRequestError("Please provide userId!!");
    }
    const { projectId, newProjectManagerUserId } = roleChangePmToTmSchema.parse(req.body);
    const prisma = await getClientByTenantId(req.tenantId);
    const findPm = await prisma.projectAssignUsers.findFirst({
        where: { projectId, projectRole: UserRoleEnum.PROJECT_MANAGER },
    });
    await prisma.$transaction([
        prisma.projectAssignUsers.update({
            where: {
                projectId,
                projectAssignUsersId: findPm?.projectAssignUsersId,
            },
            data: {
                projectRole: UserRoleEnum.TEAM_MEMBER,
            },
        }),
        prisma.projectAssignUsers.create({
            data: {
                projectRole: UserRoleEnum.PROJECT_MANAGER,
                assginedToUserId: newProjectManagerUserId,
                projectId,
            },
        }),
    ]);
    return new SuccessResponse(StatusCodes.OK, null, "Role updated successfully.").send(res);
};
export const createDemoProject = async (req, res) => {
    if (!req.userId) {
        throw new BadRequestError("Please provide userId!!");
    }
    const organisationId = uuidSchema.parse(req.params.organisationId);
    try {
        await createDemoProjectsCommon(req.tenantId, req.userId, organisationId);
    }
    catch (error) {
        console.error(error);
    }
    return new SuccessResponse(StatusCodes.CREATED, null, "Demo project created successfully.").send(res);
};
