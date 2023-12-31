import express from 'express';
import * as ProjectController from '../controllers/project.controller.js';
let router = express.Router();
router.get('/', ProjectController.getProjects);
router.get('/:projectId', ProjectController.getProjectById);
router.post('/', ProjectController.createProject);
router.delete('/:projectId', ProjectController.deleteProject);
router.put('/status/:projectId', ProjectController.statusChangeProject);
router.put('/:projectId', ProjectController.updateProject);
export default router;
