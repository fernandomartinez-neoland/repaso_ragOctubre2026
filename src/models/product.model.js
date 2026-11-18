import { db } from '../prisma/db.ts';   // La conexión única del paso 3

// Guardar un producto nuevo
export const createProductModel = async (data) => {
    console.log("estos son los datos a guardar: ",data)
  return await db.orm.public.Producto.create(data);
};

// Traer todos los productos
export const getProductsModel = async () => {
  return await db.orm.public.Producto.all().toArray();
};

// ⭐ Traer los productos MÁS PARECIDOS a un vector
export const getNearestProductsModel = async (vector, limit = 10) => {
  return await db.orm.public.Producto.using
    .embedding_nearest(vector)   // "ordénalos por cercanía a este vector"
    .limit(limit)                // "solo los N primeros"
    .all()
    .toArray();
};