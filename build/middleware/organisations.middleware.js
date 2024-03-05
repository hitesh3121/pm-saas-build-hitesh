import { BadRequestError } from "../config/apiError.js";
export const organisationMiddleware = async (req, res, next) => {
    if (req.organisationId) {
        next();
    }
    else {
        throw new BadRequestError("organisationId not found!!");
    }
};
