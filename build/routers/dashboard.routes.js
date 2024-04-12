import express from "express";
import { UserRoleEnum } from "@prisma/client";
import * as DashboardController from "../controllers/dashboard.controller.js";
import { roleMiddleware } from "../middleware/role.middleware.js";
let router = express.Router();
router.get("/projectManagerProjects", roleMiddleware([
    UserRoleEnum.PROJECT_MANAGER,
    UserRoleEnum.ADMINISTRATOR,
    UserRoleEnum.TEAM_MEMBER,
]), DashboardController.dashboardAPI);
router.get("/dashboardByProjectId/:projectId", DashboardController.projectDashboardByprojectId);
export default router;
