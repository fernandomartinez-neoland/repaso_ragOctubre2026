import dotenv from 'dotenv';

dotenv.config();

/**
 * Servicio para generar embeddings utilizando la API de Google (gemini-embedding-001).
 * Recibe los datos a vectorizar y retorna siempre la estructura fija { status, message }.
 * En caso de éxito, 'message' contiene el vector numérico de 768 dimensiones.
 *
 * @param {string|Object} data - Texto o estructura de datos a vectorizar.
 * @returns {Promise<{ status: number, message: number[]|string }>}
 */
export const embeddingService = async (data) => {
  try {
    let textToVectorize = '';

    if (typeof data === 'string') {
      textToVectorize = data.trim();
    } else if (data && typeof data === 'object') {
      if (data.text) textToVectorize = String(data.text).trim();
      else if (data.descripcion) {
        textToVectorize = data.nombre
          ? `${data.nombre}: ${data.descripcion}`
          : String(data.descripcion).trim();
      } else if (data.prompt) textToVectorize = String(data.prompt).trim();
      else if (data.query) textToVectorize = String(data.query).trim();
      else textToVectorize = JSON.stringify(data);
    }

    if (!textToVectorize) {
      return {
        status: 400,
        message: "No se proporcionaron datos válidos o texto para vectorizar.",
      };
    }

    const apiKey = process.env.googleApiKey;
    if (!apiKey) {
      return {
        status: 500,
        message: "No se encontró la variable de entorno 'googleApiKey'.",
      };
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'models/gemini-embedding-001',
        content: {
          parts: [{ text: textToVectorize }],
        },
        outputDimensionality: 768,
      }),
    });

    const result = await response.json();

    if (!response.ok || !result.embedding?.values) {
      return {
        status: response.status || 500,
        message: result.error?.message || "Error al generar el embedding con Google API.",
      };
    }

    return {
      status: 200,
      message: result.embedding.values,
    };
  } catch (error) {
    return {
      status: 500,
      message: `Error interno en el servicio de embedding: ${error.message || 'Error desconocido'}`,
    };
  }
};