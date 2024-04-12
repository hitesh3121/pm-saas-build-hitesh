import { ReasonPhrases, StatusCodes, getStatusCode } from "http-status-codes";
import { ZodError } from "zod";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library.js";
import { PRISMA_ERROR_CODE } from "../constants/prismaErrorCodes.js";
class ApiResponse {
    status;
    message;
    code;
    constructor(status, message, code) {
        this.status = status;
        this.message = message;
        this.code = code;
    }
    prepare(res, response) {
        return res.status(this.status).send(ApiResponse.sanitize(response));
    }
    send(res) {
        return this.prepare(res, this);
    }
    static sanitize(response) {
        const clone = {};
        Object.assign(clone, response);
        // @ts-ignore
        delete clone.status;
        for (const i in clone)
            if (typeof clone[i] === "undefined")
                delete clone[i];
        return clone;
    }
}
export class SuccessResponse extends ApiResponse {
    data;
    constructor(code, data, message = "Success", returnCode = code) {
        super(code, message, returnCode);
        this.data = data;
    }
    send(res) {
        return super.prepare(res, this);
    }
}
export class ErrorResponse extends ApiResponse {
    data;
    constructor(code, data, message = "Error", returnCode = code) {
        super(code, message, returnCode);
        this.data = data;
    }
    send(res) {
        return super.prepare(res, this);
    }
}
export class ZodResponse extends ApiResponse {
    errors;
    constructor(code, errors, errorMsg = "Error", returnCode = code) {
        super(code, errorMsg, returnCode);
        this.errors = errors;
    }
    send(res) {
        return super.prepare(res, this);
    }
}
export class ApiError extends Error {
    type;
    message;
    data;
    code;
    constructor(type, message = "error", data, code) {
        super(type);
        this.type = type;
        this.message = message;
        this.data = data;
        this.code = code;
    }
    static handle(err, res) {
        if (err.type) {
            try {
                const code = getStatusCode(err.type);
                return new ErrorResponse(code, err.data, err.message).send(res);
            }
            catch (e) {
                throw new GenericError(ReasonPhrases.INTERNAL_SERVER_ERROR, err.message, err.data);
            }
        }
        else if (err instanceof ZodError) {
            return new ZodResponse(StatusCodes.BAD_REQUEST, err.issues).send(res);
        }
        else if (err instanceof PrismaClientKnownRequestError) {
            let code = StatusCodes.INTERNAL_SERVER_ERROR;
            let message = ReasonPhrases.INTERNAL_SERVER_ERROR;
            switch (err.code) {
                case PRISMA_ERROR_CODE.UNIQUE_CONSTRAINT:
                    message = `There is a unique constraint violation, a new data cannot be created or updated`;
                    break;
                case PRISMA_ERROR_CODE.FOREIGN_CONSTRAINT:
                    message = `Foreign key constraint failed`;
                    break;
                case PRISMA_ERROR_CODE.NOT_FOUND:
                    message =
                        typeof err.meta?.cause == "string" ? err.meta.cause : err.message;
                    code = StatusCodes.NOT_FOUND;
                    break;
            }
            return new ErrorResponse(code, undefined, message).send(res);
        }
        else {
            console.error(err);
            return new ErrorResponse(StatusCodes.INTERNAL_SERVER_ERROR, err.data, err.message).send(res);
        }
    }
}
export class GenericError extends ApiError {
    constructor(type, message = "Bad Request", data) {
        super(type, message, data);
    }
}
export class BadRequestError extends ApiError {
    constructor(message = ReasonPhrases.BAD_REQUEST) {
        super(ReasonPhrases.BAD_REQUEST, message);
    }
}
export class InternalServerError extends ApiError {
    constructor(message = ReasonPhrases.INTERNAL_SERVER_ERROR) {
        super(ReasonPhrases.INTERNAL_SERVER_ERROR, message);
    }
}
export class UnAuthorizedError extends ApiError {
    constructor(message) {
        super(ReasonPhrases.UNAUTHORIZED, message ? message : ReasonPhrases.UNAUTHORIZED);
    }
}
export class ForbiddenError extends ApiError {
    constructor() {
        super(ReasonPhrases.FORBIDDEN, ReasonPhrases.FORBIDDEN);
    }
}
export class NotFoundError extends ApiError {
    constructor(message = ReasonPhrases.NOT_FOUND) {
        super(ReasonPhrases.NOT_FOUND, message);
    }
}
