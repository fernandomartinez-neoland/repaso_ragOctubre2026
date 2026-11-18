import express from 'express';
import { ragController } from '../controllers/rag.controller.js';

const router = express.Router();     // Crear un "cartel" vacío

router.post('/', ragController);     // "Si alguien ENVÍA (POST) algo aquí → al recepcionista"

export default router;