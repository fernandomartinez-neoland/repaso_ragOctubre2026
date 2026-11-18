import {
  createProductModel,
  getProductsModel,
  getNearestProductsModel,
} from '../models/product.model.js';
import { embeddingService } from './embedding.service.js';
import { rerankerService } from './reranker.service.js';

/**
 * Limpia el objeto producto removiendo campos internos como vectores de embedding.
 *
 * @param {Object} product
 * @returns {Object} Producto limpio para el usuario final.
 */
const cleanProductData = (product) => {
  if (!product || typeof product !== 'object') return product;
  const { embedding, vectorSimilarity, ...clean } = product;
  return clean;
};

/**
 * Servicio para registrar un nuevo producto.
 * Valida los datos, genera el embedding correspondiente y lo guarda usando el modelo.
 *
 * @param {Object} productData
 * @returns {Promise<{ status: number, message: Object|string }>}
 */
export const createProductService = async (productData) => {
  try {
    if (
      !productData ||
      !productData.nombre ||
      productData.precio === undefined ||
      productData.cantidad === undefined ||
      !productData.descripcion
    ) {
      return {
        status: 400,
        message: "Datos incompletos. Se requieren: nombre, precio, cantidad y descripcion.",
      };
    }

    let vector = productData.embedding;

    // Si no se envió vector, se genera con embeddingService
    if (!vector) {
      const embeddingResult = await embeddingService({
        nombre: productData.nombre,
        descripcion: productData.descripcion,
      });

      if (embeddingResult.status !== 200 || !Array.isArray(embeddingResult.message)) {
        return {
          status: embeddingResult.status || 500,
          message:
            typeof embeddingResult.message === 'string'
              ? embeddingResult.message
              : "Error al generar el vector de embedding.",
        };
      }

      vector = embeddingResult.message;
    }

    const newProduct = await createProductModel({
      nombre: String(productData.nombre).trim(),
      precio: Number(productData.precio),
      cantidad: Number(productData.cantidad),
      descripcion: String(productData.descripcion).trim(),
      embedding: vector,
    });

    return {
      status: 201,
      message: cleanProductData(newProduct),
    };
  } catch (error) {
    console.log(error)
    return {
      status: 500,
      message: `Error interno al crear el producto: ${error.message || 'Error desconocido'}`,
    };
  }
};

/**
 * Servicio para obtener la lista de todos los productos desde la base de datos (sin vectores).
 *
 * @returns {Promise<{ status: number, message: Array<Object>|string }>}
 */
export const getProductsService = async () => {
  try {
    const products = await getProductsModel();
    const cleanList = products.map(cleanProductData);

    return {
      status: 200,
      message: cleanList,
    };
  } catch (error) {
    return {
      status: 500,
      message: `Error interno al consultar productos: ${error.message || 'Error desconocido'}`,
    };
  }
};

/**
 * Servicio para búsqueda semántica de productos con reordenamiento (Reranker).
 * Vectoriza la consulta, busca en la BD con .using.embedding_nearest() (pgvector),
 * reordena los candidatos con Jina Reranker y limpia la información.
 *
 * @param {string} query - Consulta en lenguaje natural.
 * @param {number} [limit=5] - Cantidad máxima de productos a devolver.
 * @returns {Promise<{ status: number, message: Array<Object>|string }>}
 */
export const searchProductsService = async (query, limit = 5) => {
  try {
    if (!query || typeof query !== 'string' || !query.trim()) {
      return {
        status: 400,
        message: "Se requiere un texto o consulta válida para realizar la búsqueda.",
      };
    }

    // 1. Vectorizar la consulta
    const embeddingResult = await embeddingService(query.trim());
    if (embeddingResult.status !== 200 || !Array.isArray(embeddingResult.message)) {
      return {
        status: embeddingResult.status || 500,
        message:
          typeof embeddingResult.message === 'string'
            ? embeddingResult.message
            : "Error al generar embedding para la consulta.",
      };
    }

    const queryVector = embeddingResult.message;

    // 2. Búsqueda vectorial nativa en Supabase usando pgvector (.using.embedding_nearest)
    const candidatePoolSize = Math.max(limit * 2, 10);
    const candidates = await getNearestProductsModel(queryVector, candidatePoolSize);

    if (!candidates || candidates.length === 0) {
      return {
        status: 200,
        message: [],
      };
    }

    // 3. Preparar textos de los candidatos para el reranker
    const documents = candidates.map(
      p => `${p.nombre}: ${p.descripcion}. Precio: $${p.precio}. Stock: ${p.cantidad}`
    );

    // 4. Reordenamiento fino con Jina Reranker
    const rerankResult = await rerankerService({
      query: query.trim(),
      documents,
      top_n: limit,
    });

    if (rerankResult.status === 200 && Array.isArray(rerankResult.message)) {
      const rankedProducts = rerankResult.message.map(item => ({
        ...cleanProductData(candidates[item.index]),
        relevanceScore: item.relevance_score,
      }));

      return {
        status: 200,
        message: rankedProducts,
      };
    }

    // Fallback: si falla el reranker, retorna candidatos limpios de la búsqueda vectorial
    return {
      status: 200,
      message: candidates.slice(0, limit).map(cleanProductData),
    };
  } catch (error) {
    return {
      status: 500,
      message: `Error interno en la búsqueda de productos: ${error.message || 'Error desconocido'}`,
    };
  }
};