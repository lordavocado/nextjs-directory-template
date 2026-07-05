"use server"

import "server-only"
import { unstable_cache } from "next/cache"

import { getClient, initDb } from "@/db/turso/client"

type FilterData = {
  categories: string[]
  labels: string[]
  tags: string[]
}

async function getFilters(): Promise<FilterData> {
  try {
    await initDb()
    const db = getClient()

    const [{ rows: catRows }, { rows: labelRows }, { rows: tagRows }] =
      await Promise.all([
        db.execute("SELECT name FROM categories ORDER BY name"),
        db.execute("SELECT name FROM labels ORDER BY name"),
        db.execute("SELECT name FROM tags ORDER BY name"),
      ])

    const unique = (arr: string[]) => [...new Set(arr)]

    return {
      categories: unique(catRows.map((r) => r.name as string).filter(Boolean)),
      labels: unique(labelRows.map((r) => r.name as string).filter(Boolean)),
      tags: unique(tagRows.map((r) => r.name as string).filter(Boolean)),
    }
  } catch (error) {
    console.error("Error fetching filters:", error)
    return { categories: [], labels: [], tags: [] }
  }
}

export const getCachedFilters = unstable_cache(
  async (): Promise<FilterData> => getFilters(),
  ["product-filters"],
  { tags: ["product_filters"], revalidate: 9000 }
)
