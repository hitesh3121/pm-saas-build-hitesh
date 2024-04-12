import { settings } from "../config/settings.js";
import bcrypt from "bcrypt";
export function encrypt(value) {
    return bcrypt.hash(value, settings.encryption.saltRound);
}
export function compareEncryption(value, encryptedValue) {
    return bcrypt.compare(value, encryptedValue);
}
