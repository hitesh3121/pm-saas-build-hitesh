import express from "express";
import { UserRoleEnum } from "@prisma/client";
import * as TaskController from "../controllers/task.controller.js";
import { roleMiddleware } from "../middleware/role.middleware.js";
let router = express.Router();
router.get("/taskAssignUsers/:projectId", roleMiddleware([
    UserRoleEnum.ADMINISTRATOR,
    UserRoleEnum.PROJECT_MANAGER,
    UserRoleEnum.TEAM_MEMBER,
]), TaskController.taskAssignToUser);
router.put("/status/completed/:projectId", roleMiddleware([UserRoleEnum.ADMINISTRATOR, UserRoleEnum.PROJECT_MANAGER]), TaskController.statusCompletedAllTAsk);
router.put("/status/:taskId", roleMiddleware([
    UserRoleEnum.ADMINISTRATOR,
    UserRoleEnum.PROJECT_MANAGER,
    UserRoleEnum.TEAM_MEMBER,
]), TaskController.statusChangeTask);
router.put("/comment/:commentId", roleMiddleware([
    UserRoleEnum.ADMINISTRATOR,
    UserRoleEnum.PROJECT_MANAGER,
    UserRoleEnum.TEAM_MEMBER,
]), TaskController.updateComment);
router.delete("/comment/:commentId", roleMiddleware([
    UserRoleEnum.ADMINISTRATOR,
    UserRoleEnum.PROJECT_MANAGER,
    UserRoleEnum.TEAM_MEMBER,
]), TaskController.deleteComment);
router.post("/comment/:taskId", TaskController.addComment);
router.post("/attachment/:taskId", roleMiddleware([
    UserRoleEnum.ADMINISTRATOR,
    UserRoleEnum.PROJECT_MANAGER,
    UserRoleEnum.TEAM_MEMBER,
]), TaskController.addAttachment);
router.delete("/attachment/:attachmentId", roleMiddleware([
    UserRoleEnum.ADMINISTRATOR,
    UserRoleEnum.PROJECT_MANAGER,
    UserRoleEnum.TEAM_MEMBER,
]), TaskController.deleteAttachment);
router.post("/member/:taskId", roleMiddleware([
    UserRoleEnum.ADMINISTRATOR,
    UserRoleEnum.PROJECT_MANAGER,
    UserRoleEnum.TEAM_MEMBER,
]), TaskController.addMemberToTask);
router.delete("/member/:taskAssignUsersId", roleMiddleware([
    UserRoleEnum.ADMINISTRATOR,
    UserRoleEnum.PROJECT_MANAGER,
    UserRoleEnum.TEAM_MEMBER,
]), TaskController.deleteMemberFromTask);
router.post("/dependencies/:taskId", roleMiddleware([
    UserRoleEnum.ADMINISTRATOR,
    UserRoleEnum.PROJECT_MANAGER,
    UserRoleEnum.TEAM_MEMBER,
]), TaskController.addDependencies);
router.delete("/dependencies/:taskDependenciesId", roleMiddleware([
    UserRoleEnum.ADMINISTRATOR,
    UserRoleEnum.PROJECT_MANAGER,
    UserRoleEnum.TEAM_MEMBER,
]), TaskController.removeDependencies);
router.post("/milestone/:taskId", roleMiddleware([
    UserRoleEnum.ADMINISTRATOR,
    UserRoleEnum.PROJECT_MANAGER,
    UserRoleEnum.TEAM_MEMBER,
]), TaskController.addOrRemoveMilesstone);
router.get("/byId/:taskId", roleMiddleware([
    UserRoleEnum.ADMINISTRATOR,
    UserRoleEnum.PROJECT_MANAGER,
    UserRoleEnum.TEAM_MEMBER,
]), TaskController.getTaskById);
router.get("/:projectId", roleMiddleware([
    UserRoleEnum.ADMINISTRATOR,
    UserRoleEnum.PROJECT_MANAGER,
    UserRoleEnum.TEAM_MEMBER,
]), TaskController.getTasks);
router.put("/:taskId", roleMiddleware([
    UserRoleEnum.ADMINISTRATOR,
    UserRoleEnum.PROJECT_MANAGER,
    UserRoleEnum.TEAM_MEMBER,
]), TaskController.updateTask);
router.delete("/:taskId", roleMiddleware([
    UserRoleEnum.ADMINISTRATOR,
    UserRoleEnum.PROJECT_MANAGER,
    UserRoleEnum.TEAM_MEMBER,
]), TaskController.deleteTask);
router.post("/:projectId/:parentTaskId?", roleMiddleware([
    UserRoleEnum.ADMINISTRATOR,
    UserRoleEnum.PROJECT_MANAGER,
    UserRoleEnum.TEAM_MEMBER,
]), TaskController.createTask);
router.put("/reAssignTaskToOtherUser/:projectId", roleMiddleware([
    UserRoleEnum.ADMINISTRATOR,
    UserRoleEnum.PROJECT_MANAGER,
]), TaskController.reAssignTaskToOtherUser);
export default router;
