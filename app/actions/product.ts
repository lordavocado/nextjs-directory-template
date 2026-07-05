"use server"

import "server-only"
import { cache } from "react"
import { revalidatePath } from "next/cache"

import { getClient, initDb, parseProduct } from "@/db/turso/client"

export const getProducts = cache(
  async (
    searchTerm?: string,
    category?: string,
    label?: string,
    tag?: string
  ) => {
    try {
      await initDb()
      const db = getClient()

      let sql = "SELECT * FROM products WHERE 1=1"
      const args: string[] = []

      if (searchTerm) {
        sql +=
          " AND (LOWER(codename) LIKE ? OR LOWER(description) LIKE ? OR LOWER(punchline) LIKE ?)"
        const term = `%${searchTerm.toLowerCase()}%`
        args.push(term, term, term)
      }

      if (category) {
        sql += " AND categories = ?"
        args.push(category)
      }

      if (label) {
        sql +=
          " AND EXISTS (SELECT 1 FROM json_each(labels) WHERE value = ?)"
        args.push(label)
      }

      if (tag) {
        sql +=
          " AND EXISTS (SELECT 1 FROM json_each(tags) WHERE value = ?)"
        args.push(tag)
      }

      const { rows } = await db.execute({ sql, args })
      return rows.map((r) => parseProduct(r as Record<string, unknown>))
    } catch (error) {
      console.error("Error fetching products:", error)
      return []
    }
  }
)

export async function getProductById(id?: string) {
  if (!id) return []
  try {
    await initDb()
    const db = getClient()
    const { rows } = await db.execute({
      sql: "SELECT * FROM products WHERE id = ?",
      args: [id],
    })
    return rows.map((r) => parseProduct(r as Record<string, unknown>))
  } catch (error) {
    console.error("Error fetching product:", error)
    return []
  }
}

export async function incrementClickCount(id: string) {
  try {
    await initDb()
    const db = getClient()
    await db.execute({
      sql: "UPDATE products SET view_count = view_count + 1 WHERE id = ?",
      args: [id],
    })
    revalidatePath("/products", "page")
  } catch (error) {
    console.error("Error incrementing click count:", error)
  }
}
