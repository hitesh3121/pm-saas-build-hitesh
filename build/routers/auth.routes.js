import express from "express";
import * as AuthController from "../controllers/auth.controller.js";
import passport from "passport";
import { settings } from "../config/settings.js";
import { createJwtToken } from "../utils/jwtHelper.js";
import { cookieConfig } from "../utils/setCookies.js";
let router = express.Router();
router.put("/reset-password/:token", AuthController.resetPassword);
router.post("/forgot-password", AuthController.forgotPassword);
router.post("/sign-up", AuthController.signUp);
router.post("/login", AuthController.login);
router.post("/logout", AuthController.logout);
router.get("/access-token", AuthController.getAccessToken);
router.post("/root-auth", AuthController.verifyRoot);
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));
router.get("/google/callback", passport.authenticate("google", {
    failureRedirect: `${settings.appURL}/login`,
    session: false,
}), (req, res) => {
    const user = req.user;
    const tokenPayload = {
        userId: user.userId,
        email: user.email,
        tenantId: req.tenantId ?? "root",
    };
    // Token
    const token = createJwtToken(tokenPayload);
    res.cookie(settings.jwt.tokenCookieKey, token, {
        ...cookieConfig,
        maxAge: cookieConfig.maxAgeToken,
    });
    // Refresh-Token
    const refreshToken = createJwtToken(tokenPayload, true);
    res.cookie(settings.jwt.refreshTokenCookieKey, refreshToken, {
        ...cookieConfig,
        maxAge: cookieConfig.maxAgeRefreshToken,
    });
    res.redirect(`${settings.appURL}`);
});
export default router;
