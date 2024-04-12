import { ApiError } from "../config/apiError.js";
export class ErrorHandlerMiddleware {
    static handler(error, request, response, next) {
        ApiError.handle(error, response);
    }
}
