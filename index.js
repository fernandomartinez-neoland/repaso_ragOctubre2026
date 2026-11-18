import express from 'express';    // La herramienta para montar el servidor
import dotenv from 'dotenv';      // La herramienta para leer el .env

dotenv.config();                  // ⭐ Leer los secretos AHORA, antes de usarlos

import ragRouter from './src/routes/rag.router.js'; // Traer el "cartel de direcciones"

const app = express();                    // Crear la tienda
const PORT = process.env.PORT || 3000;    // Puerta: la del .env o, si no hay, la 3000

app.use(express.json());   // ⭐ Enseñar a la tienda a leer mensajes en formato JSON

app.use('/api/rag', ragRouter);  // Si llegan a /api/rag → mandar al cartel
app.use('/rag', ragRouter);      // Si llegan a /rag      → mandar al mismo cartel

app.get('/', (req, res) => {     // Si entran a la raíz → "estoy vivo"
  res.json({ status: 200, message: 'API RAG en funcionamiento' });
});

if (process.env.NODE_ENV !== 'test') {   // Solo abrir la puerta si NO estamos en modo pruebas
  app.listen(PORT, () => {
    console.log(`Servidor RAG iniciado en http://localhost:${PORT}`);
  });
}

