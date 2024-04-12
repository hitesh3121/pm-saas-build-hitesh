import crypto from "crypto";
export function generateRandomToken(length = 20) {
    return crypto.randomBytes(length).toString("hex");
}
