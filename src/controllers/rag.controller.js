import { ragService } from '../services/rag.service.js';

export const ragController = async (req, res) => {
  const result = await ragService(req.body);           // 1. "Servicio, toma el pedido"
  res.status(result.status).send(result.message);      // 2. Entregar lo que me dieron
};