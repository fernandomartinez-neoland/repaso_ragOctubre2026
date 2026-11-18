import dotenv from 'dotenv';

dotenv.config();

/**
 * Servicio para reordenar documentos según relevancia semántica usando la API de Jina Reranker.
 * Retorna siempre una estructura JSON fija con 'status' y 'message'.
 *
 * @param {Object} params
 * @param {string} params.query - Consulta o texto del usuario.
 * @param {string[]} params.documents - Lista de textos de los productos o documentos a rankear.
 * @param {number} [params.top_n] - Cantidad máxima de resultados a retornar.
 * @returns {Promise<{ status: number, message: Array<{ index: number, relevance_score: number, document: string }>|string }>}
 */
export const rerankerService = async ({ query, documents, top_n }) => {
  try {
    if (!query || typeof query !== 'string' || !query.trim()) {
      return {
        status: 400,
        message: "No se proporcionó una consulta válida para el reranker.",
      };
    }

    if (!Array.isArray(documents) || documents.length === 0) {
      return {
        status: 400,
        message: "No se proporcionó una lista de documentos válida para reordenar.",
      };
    }

    const apiKey = process.env.jinaApiKey;
    if (!apiKey) {
      return {
        status: 500,
        message: "No se encontró la variable de entorno 'jinaApiKey'.",
      };
    }

    const response = await fetch('https://api.jina.ai/v1/rerank', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'jina-reranker-v2-base-multilingual',
        query: query.trim(),
        documents: documents.map(d => String(d)),
        top_n: top_n || documents.length,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.results) {
      return {
        status: response.status || 500,
        message: data.message || data.detail || "Error al comunicarse con la API de Jina Reranker.",
      };
    }

    return {
      status: 200,
      message: data.results,
    };
  } catch (error) {
    return {
      status: 500,
      message: `Error interno en el servicio reranker: ${error.message || 'Error desconocido'}`,
    };
  }
};