import { getClientByTenantId } from "../config/db.js";
import { BadRequestError, UnAuthorizedError } from "../config/apiError.js";
export const roleMiddleware = (allowedRoles) => {
    return async (req, res, next) => {
        if (!req.userId) {
            throw new BadRequestError("userId not found!!");
        }
        const prisma = await getClientByTenantId(req.tenantId);
        const userRoles = await prisma.user.getUserRoles(req.userId);
        const hasAccess = allowedRoles.some((role) => userRoles.includes(role));
        if (!hasAccess) {
            throw new UnAuthorizedError();
        }
        next();
    };
};
