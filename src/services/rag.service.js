import { classifyIntent, generateFriendlyResponse } from './groq.service.js';
import {
  createProductService,
  getProductsService,
  searchProductsService,
} from './product.service.js';

/**
 * Servicio orquestador RAG con agente de IA (Groq).
 * Procesa la petición del usuario, determina la intención, interactúa con la BD
 * y genera una respuesta amigable en lenguaje natural con la información reordenada y limpia (sin vectores).
 *
 * @param {Object} payload - Datos de la petición HTTP.
 * @returns {Promise<{ status: number, message: Object }>}
 */
export const ragService = async (payload) => {
  try {
    const userText =
      payload?.prompt ||
      payload?.query ||
      payload?.message ||
      payload?.mensaje ||
      payload?.text ||
      (typeof payload === 'string' ? payload : '');

    // Caso 1: Petición vacía
    if (!userText && Object.keys(payload || {}).length === 0) {
      const friendlyGuide = await generateFriendlyResponse({
        userText: "Petición vacía",
        action: "unknown",
        errorDetails: "No se proporcionó ningún texto o instrucción.",
      });

      return {
        status: 400,
        message: {
          respuesta: friendlyGuide,
          opciones_disponibles: [
            "1. Consultar todos los productos (ej: 'muéstrame todos los productos')",
            "2. Búsqueda semántica (ej: 'busco auriculares con cancelación de ruido')",
            "3. Agregar producto (requiere: nombre, precio, cantidad y descripcion)",
          ],
        },
      };
    }

    // 1. Clasificar intención con el LLM de Groq
    const classificationRes = await classifyIntent(userText, payload);
    if (classificationRes.status !== 200 || !classificationRes.message) {
      return {
        status: classificationRes.status || 500,
        message: {
          error: classificationRes.message || "Error al clasificar la intención con la IA.",
        },
      };
    }

    const { action, search_query, product_data } = classificationRes.message;

    // 2. Acción: Consultar todos los productos
    if (action === 'list_all') {
      const listRes = await getProductsService();
      if (listRes.status !== 200) {
        return listRes;
      }

      const allProducts = listRes.message;
      const friendlyText = await generateFriendlyResponse({
        userText,
        action: "list_all",
        results: allProducts,
      });

      return {
        status: 200,
        message: {
          respuesta: friendlyText,
          total: allProducts.length,
          productos: allProducts,
        },
      };
    }

    // 3. Acción: Búsqueda semántica con Reranker
    if (action === 'search') {
      const queryToSearch = search_query || userText;
      const searchRes = await searchProductsService(queryToSearch, 5);

      if (searchRes.status !== 200) {
        return searchRes;
      }

      const foundProducts = searchRes.message;
      const friendlyText = await generateFriendlyResponse({
        userText,
        action: "search",
        results: foundProducts,
      });

      return {
        status: 200,
        message: {
          respuesta: friendlyText,
          total_encontrados: foundProducts.length,
          productos: foundProducts,
        },
      };
    }
    // 4. Acción: Crear / Agregar un producto
    if (action === 'create') {
      const nombre = payload?.nombre || product_data?.nombre;
      const precio = payload?.precio !== undefined ? Number(payload.precio) : product_data?.precio;
      const cantidad = payload?.cantidad !== undefined ? Number(payload.cantidad) : product_data?.cantidad;
      const descripcion = payload?.descripcion || product_data?.descripcion;
      
  
      const faltantes = [];
      if (!nombre) faltantes.push('nombre');
      if (precio === undefined || isNaN(precio)) faltantes.push('precio');
      if (cantidad === undefined || isNaN(cantidad)) faltantes.push('cantidad');
      if (!descripcion) faltantes.push('descripcion');

      if (faltantes.length > 0) {
        const friendlyGuide = await generateFriendlyResponse({
          userText,
          action: "create",
          errorDetails: `Faltan campos obligatorios: ${faltantes.join(', ')}`,
        });

        return {
          status: 400,
          message: {
            respuesta: friendlyGuide,
            campos_faltantes: faltantes,
            campos_requeridos: [
              "nombre (string)",
              "precio (number)",
              "cantidad (number)",
              "descripcion (string)",
            ],
            ejemplo: {
              prompt: "Crear producto",
              nombre: "Monitor 27 pulgadas",
              precio: 199.99,
              cantidad: 15,
              descripcion: "Monitor IPS Full HD con bordes delgados",
            },
          },
        };
      }

      const createRes = await createProductService({
        nombre,
        precio,
        cantidad,
        descripcion,
      });
      if (createRes.status !== 201) {
        return createRes;
      }
      
      const createdProduct = createRes.message;
      const friendlyText = await generateFriendlyResponse({
        userText,
        action: "create",
        results: createdProduct,
      });
      
      return {
        status: 201,
        message: {
          respuesta: friendlyText,
          producto: createdProduct,
        },
      };
    }

    // 5. Acción 'unknown' o no coincidente
    const friendlyGuide = await generateFriendlyResponse({
      userText,
      action: "unknown",
      errorDetails: "La solicitud no coincide con listar productos, buscar o registrar uno nuevo.",
    });

    return {
      status: 400,
      message: {
        respuesta: friendlyGuide,
        opciones_disponibles: [
          "1. Consultar todos los productos (ej: 'muéstrame todos los productos')",
          "2. Búsqueda semántica (ej: 'busco auriculares con cancelación de ruido')",
          "3. Agregar producto (requiere: nombre, precio, cantidad y descripcion)",
        ],
      },
    };
  } catch (error) {
    return {
      status: 500,
      message: {
        error: `Error interno en el servicio RAG: ${error.message || 'Error desconocido'}`,
      },
    };
  }
};