import { OrgStatusEnum, UserProviderTypeEnum, UserRoleEnum, UserStatusEnum } from "@prisma/client";
import { getClientByTenantId } from "../config/db.js";
import { settings } from "../config/settings.js";
import { createJwtToken, verifyJwtToken } from "../utils/jwtHelper.js";
import { compareEncryption, encrypt } from "../utils/encryption.js";
import { BadRequestError, InternalServerError, NotFoundError, SuccessResponse, UnAuthorizedError, } from "../config/apiError.js";
import { StatusCodes } from "http-status-codes";
import { authLoginSchema, authRefreshTokenSchema, authSignUpSchema, forgotPasswordSchema, resetPasswordTokenSchema, resetTokenSchema, } from "../schemas/authSchema.js";
import { generateOTP } from "../utils/otpHelper.js";
import { EmailService } from "../services/email.services.js";
import { OtpService } from "../services/userOtp.services.js";
import { generateRandomToken } from "../utils/generateRandomToken.js";
import { cookieConfig } from "../utils/setCookies.js";
export const signUp = async (req, res) => {
    const { firstName, lastName, email, password } = authSignUpSchema.parse(req.body);
    const hashedPassword = await encrypt(password);
    const prisma = await getClientByTenantId(req.tenantId);
    const findUserIfExists = await prisma.user.findUnique({
        where: { email, deletedAt: null },
    });
    let newCreatedUser;
    if (!findUserIfExists) {
        newCreatedUser = await prisma.user.create({
            data: {
                firstName,
                lastName,
                email,
                status: UserStatusEnum.ACTIVE,
                provider: {
                    create: {
                        idOrPassword: hashedPassword,
                        providerType: UserProviderTypeEnum.EMAIL,
                    },
                },
            },
        });
    }
    else {
        const findEmailProvider = await prisma.userProvider.findFirst({
            where: {
                userId: findUserIfExists.userId,
                providerType: { in: [UserProviderTypeEnum.EMAIL] },
                deletedAt: null,
            },
        });
        if (findEmailProvider) {
            throw new BadRequestError("User already exists with this email");
        }
        else {
            try {
                await prisma.userProvider.create({
                    data: {
                        providerType: UserProviderTypeEnum.EMAIL,
                        userId: findUserIfExists.userId,
                        idOrPassword: hashedPassword,
                    },
                });
            }
            catch (error) {
                console.error(error);
            }
        }
    }
    const userId = findUserIfExists
        ? findUserIfExists.userId
        : newCreatedUser?.userId;
    const user = findUserIfExists ? findUserIfExists : newCreatedUser;
    const tokenPayload = {
        userId,
        email: email,
        tenantId: req.tenantId ?? "root",
    };
    const token = createJwtToken(tokenPayload);
    const refreshToken = createJwtToken(tokenPayload, true);
    const otpValue = generateOTP();
    const subjectMessage = `Login OTP`;
    const expiresInMinutes = 10;
    const bodyMessage = `Here is your login OTP : ${otpValue}, OTP is valid for ${expiresInMinutes} minutes`;
    await OtpService.saveOTP(otpValue, userId, req.tenantId, expiresInMinutes * 60);
    try {
        await EmailService.sendEmail(email, subjectMessage, bodyMessage);
    }
    catch (error) {
        console.error("Failed to send email", error);
    }
    res.cookie(settings.jwt.tokenCookieKey, token, {
        ...cookieConfig,
        maxAge: cookieConfig.maxAgeToken,
    });
    res.cookie(settings.jwt.refreshTokenCookieKey, refreshToken, {
        ...cookieConfig,
        maxAge: cookieConfig.maxAgeRefreshToken,
    });
    return new SuccessResponse(StatusCodes.CREATED, user, "Sign up successfully").send(res);
};
export const login = async (req, res) => {
    const { email, password } = authLoginSchema.parse(req.body);
    const prisma = await getClientByTenantId(req.tenantId);
    const user = await prisma.user.findUniqueOrThrow({
        where: { email, deletedAt: null },
        include: {
            userOrganisation: {
                where: { deletedAt: null },
                include: {
                    organisation: {
                        where: { deletedAt: null },
                    },
                },
            },
            provider: true,
        },
    });
    if (user.status === UserStatusEnum.INACTIVE) {
        const errorMessage = user.userOrganisation[0]?.role === UserRoleEnum.ADMINISTRATOR
            ? "Your account is blocked, please contact our support at support@projectchef.io"
            : "Your account is blocked, please contact your administrator";
        throw new BadRequestError(errorMessage);
    }
    if (user.userOrganisation.length > 0 &&
        user.userOrganisation[0]?.organisation?.status === OrgStatusEnum.DEACTIVE) {
        throw new BadRequestError("Organisation is DEACTIVE");
    }
    const findUserProvider = await prisma.userProvider.findFirst({
        where: { userId: user.userId, providerType: UserProviderTypeEnum.EMAIL },
    });
    if (user &&
        findUserProvider?.providerType == UserProviderTypeEnum.EMAIL &&
        (await compareEncryption(password, findUserProvider.idOrPassword))) {
        const tokenPayload = {
            userId: user.userId,
            email: email,
            tenantId: req.tenantId ?? "root",
        };
        const token = createJwtToken(tokenPayload);
        res.cookie(settings.jwt.tokenCookieKey, token, {
            ...cookieConfig,
            maxAge: cookieConfig.maxAgeToken
        });
        const refreshToken = createJwtToken(tokenPayload, true);
        res.cookie(settings.jwt.refreshTokenCookieKey, refreshToken, {
            ...cookieConfig,
            maxAge: cookieConfig.maxAgeRefreshToken
        });
        const { provider, ...userWithoutProvider } = user;
        // Generate and save verify otp
        if (!user.isVerified) {
            const otpValue = generateOTP();
            const subjectMessage = `Login OTP`;
            const expiresInMinutes = 5;
            const bodyMessage = `Here is your login OTP : ${otpValue}, OTP is valid for ${expiresInMinutes} minutes`;
            try {
                await OtpService.saveOTP(otpValue, user.userId, req.tenantId, expiresInMinutes * 60);
                await EmailService.sendEmail(user.email, subjectMessage, bodyMessage);
            }
            catch (error) {
                console.error('Failed to send otp email', error);
            }
        }
        return new SuccessResponse(StatusCodes.OK, { user: userWithoutProvider }, "Login successfully").send(res);
    }
    throw new UnAuthorizedError();
};
export const getAccessToken = (req, res) => {
    const refreshTokenCookie = authRefreshTokenSchema.parse(req.cookies[settings.jwt.refreshTokenCookieKey]);
    const decoded = verifyJwtToken(refreshTokenCookie);
    const tokenPayload = {
        userId: decoded.userId,
        email: decoded.email,
        tenantId: decoded.tenantId,
    };
    const token = createJwtToken(tokenPayload);
    res.cookie(settings.jwt.tokenCookieKey, token, {
        ...cookieConfig,
        maxAge: cookieConfig.maxAgeToken
    });
    const refreshToken = createJwtToken(tokenPayload, true);
    res.cookie(settings.jwt.refreshTokenCookieKey, refreshToken, {
        ...cookieConfig,
        maxAge: cookieConfig.maxAgeRefreshToken
    });
    return new SuccessResponse(StatusCodes.OK, null, "Access token retrived successfully").send(res);
};
export const verifyRoot = (req, res) => {
    const username = req.body.username;
    const password = req.body.password;
    if (username == settings.user.username &&
        password == settings.user.password) {
        return new SuccessResponse(StatusCodes.OK, null, "Ok").send(res);
    }
    else {
        throw new BadRequestError();
    }
};
export const forgotPassword = async (req, res) => {
    const { email } = forgotPasswordSchema.parse(req.body);
    const token = generateRandomToken();
    const prisma = await getClientByTenantId(req.tenantId);
    const findUser = await prisma.user.findFirst({ where: { email: email, deletedAt: null } });
    if (!findUser)
        throw new NotFoundError("User not found");
    const expiryTimeInMinutes = 10;
    const expirationTime = new Date(Date.now() + expiryTimeInMinutes * 60 * 1000);
    const subjectMessage = `Forgot password`;
    const bodyMessage = `
    We received a request to reset the password for this account : ${email}. To proceed with the password reset, 
    please click on the following link:
    URL: ${settings.appURL}/reset-password/?token=${token}`;
    try {
        await EmailService.sendEmail(email, subjectMessage, bodyMessage);
        await prisma.resetPassword.create({
            data: {
                isUsed: false,
                token: token,
                userId: findUser.userId,
                expiryTime: expirationTime,
            },
        });
    }
    catch (error) {
        throw new InternalServerError();
    }
    return new SuccessResponse(StatusCodes.OK, null, "Sent email successfully").send(res);
};
export const resetPassword = async (req, res) => {
    const token = resetTokenSchema.parse(req.params.token);
    const { password } = resetPasswordTokenSchema.parse(req.body);
    const prisma = await getClientByTenantId(req.tenantId);
    let resetPasswordRecord = await prisma.resetPassword.findFirst({
        where: {
            token: token,
            deletedAt: null,
            expiryTime: {
                gt: new Date(),
            },
        },
    });
    if (!resetPasswordRecord)
        throw new BadRequestError("Invalid token");
    const hashedPassword = await encrypt(password);
    const findUserProvider = await prisma.userProvider.findFirst({
        where: {
            userId: resetPasswordRecord.userId,
            providerType: UserProviderTypeEnum.EMAIL
        }
    });
    await prisma.$transaction([
        prisma.resetPassword.update({
            where: {
                resetPasswordId: resetPasswordRecord.resetPasswordId,
                userId: resetPasswordRecord.userId,
            },
            data: {
                isUsed: true
            }
        }),
        prisma.userProvider.update({
            where: {
                userProviderId: findUserProvider?.userProviderId
            },
            data: {
                idOrPassword: hashedPassword
            }
        })
    ]);
    return new SuccessResponse(StatusCodes.OK, null, "Reset password successfully").send(res);
};
export const logout = (req, res) => {
    res.clearCookie(settings.jwt.tokenCookieKey);
    res.clearCookie(settings.jwt.refreshTokenCookieKey);
    return new SuccessResponse(StatusCodes.OK, null, "Logout successfully").send(res);
};
