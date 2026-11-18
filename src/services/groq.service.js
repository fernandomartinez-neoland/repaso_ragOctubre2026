import dotenv from "dotenv";
import { ChatGroq } from "@langchain/groq";

dotenv.config();

const groq = new ChatGroq({
  model: "openai/gpt-oss-120b",
  temperature: 0,
  maxTokens: undefined,
  maxRetries: 2,
  apiKey: process.env.GROQ_API_KEY,
  // other params...
});

/**
 * Servicio para clasificar la intención del usuario mediante el LLM de Groq.
 *
 * @param {string} userText - Texto de la solicitud del usuario.
 * @param {Object} [payload] - Datos adicionales enviados en la petición.
 * @returns {Promise<{ status: number, message: { action: string, search_query?: string, product_data?: Object }|string }>}
 */
export const classifyIntent = async (userText, payload = {}) => {
  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return {
        status: 500,
        message: "No se encontró la variable de entorno 'GROQ_API_KEY'.",
      };
    }

    const systemPrompt = `
Eres un agente clasificador para una tienda con catálogo y búsqueda RAG.
Analiza la solicitud del usuario y responde ÚNICAMENTE con un JSON con la estructura:
{
  "action": "list_all" | "search" | "create" | "unknown",
  "search_query": string o null,
  "product_data": {
    "nombre": string o null,
    "precio": number o null,
    "cantidad": number o null,
    "descripcion": string o null
  }
}

Reglas:
1. "list_all": El usuario pide ver, listar o consultar TODOS los productos o el catálogo completo (ej: "ver todos los productos", "qué productos hay", "lista de productos").
2. "search": El usuario busca, pregunta por o describe un tipo de producto específico o características deseadas (ej: "auriculares para música", "algo para la espalda", "pantalla para jugar").
3. "create": El usuario quiere registrar, agregar o crear un producto nuevo. Extrae nombre, precio, cantidad y descripcion.
4. "unknown": Petición que no encaja con ninguna de las 3 anteriores o faltan indicaciones claras.
`;

    const contextContent = JSON.stringify({
      mensaje_usuario: userText,
      datos_adicionales: payload,
    });

    const completion = await groq.invoke([
      { role: "system", content: systemPrompt },
      { role: "user", content: contextContent },
    ]);

    const content = completion.content;
    if (!content) {
      return {
        status: 500,
        message: "La IA de Groq no devolvió ninguna respuesta.",
      };
    }

    return {
      status: 200,
      message: JSON.parse(content),
    };
  } catch (error) {
    return {
      status: 500,
      message: `Error al clasificar intención con Groq: ${error.message || "Error desconocido"}`,
    };
  }
};

/**
 * Genera una respuesta amigable, cercana y personalizada en lenguaje natural
 * para presentarle al usuario el resultado de su petición sin exponer detalles técnicos.
 *
 * @param {Object} params
 * @param {string} params.userText - Petición original del usuario.
 * @param {string} params.action - Acción ejecutada (list_all, search, create, unknown).
 * @param {any} [params.results] - Datos de productos o resultado obtenido (sin vectores).
 * @param {any} [params.errorDetails] - Detalles de error o campos faltantes si los hubo.
 * @returns {Promise<string>} Mensaje conversacional redactado por la IA.
 */
export const generateFriendlyResponse = async ({
  userText,
  action,
  results,
  errorDetails,
}) => {
  try {
    const systemPrompt = `
Eres un asistente comercial amigable, servicial y profesional de una tienda de tecnología.
Tu tarea es responderle al cliente en español con un tono cercano, claro y empático en base a su consulta y a los datos obtenidos.

Reglas clave:
- NUNCA menciones vectores, embeddings, algoritmos, bases de datos ni términos técnicos internos.
- Si es una lista de todos los productos ("list_all"): saluda amablemente, presenta un resumen atractivo del catálogo invitando al usuario a preguntar por cualquiera de ellos.
- Si es una búsqueda ("search"): explica de forma cercana por qué las opciones encontradas encajan con lo que el usuario busca, destacando sus nombres, precios y beneficios.
- Si es una creación exitosa ("create"): felicita y confirma que el producto quedó registrado en el catálogo.
- Si faltan datos para crear un producto: explícale de forma comprensible qué datos específicos faltan (nombre, precio, cantidad, descripción) para poder agregarlo.
- Si es desconocido ("unknown"): orienta al cliente con calidez sobre qué cosas puede pedirte (ver el catálogo, buscar productos por necesidad o registrar uno nuevo).
- Mantén la respuesta clara y bien estructurada.
- La respuesta debe ser corta pero amable
`;

    const userPrompt = JSON.stringify({
      consulta_del_cliente: userText,
      accion_realizada: action,
      datos_relevantes: results,
      detalles_adicionales: errorDetails,
    });

    const completion = await groq.invoke([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);

    return (
      completion.content ||
      "¡Hola! Aquí tienes la información sobre los productos solicitados."
    );
  } catch (error) {
    // Si la llamada falla por cualquier motivo, fallback elegante
    return "¡Hola! Hemos procesado tu solicitud. A continuación encontrarás la información correspondiente.";
  }
};
