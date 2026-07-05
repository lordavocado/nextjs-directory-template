"use server"

import "server-only"
import { revalidatePath } from "next/cache"
import { createClient } from "@/db/supabase/server"
import { anthropic } from "@ai-sdk/anthropic"
import { generateObject } from "ai"

import { getClient, initDb } from "@/db/turso/client"
import { enrichmentSchema, schema } from "./schema"
import { getAIEnrichmentPrompt } from "./prompt"

const config = {
  aiEnrichmentEnabled: false,
  aiModel: anthropic("claude-3-haiku-20240307"),
  storageBucket: "product-logos",
  cacheControl: "3600",
  allowNewTags: true,
  allowNewLabels: true,
  allowNewCategories: true,
}

export type FormState = {
  message: string
  fields?: Record<string, string>
  issues: string[]
}

type Enrichment = {
  tags: string[]
  labels: string[]
}

function isErrorWithMessage(error: unknown): error is Error {
  return typeof error === "object" && error !== null && "message" in error
}

async function uploadLogoFile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  logoFile: File,
  codename: string
): Promise<string> {
  const fileExt = logoFile.name.split(".").pop()
  const fileName = `${Date.now()}.${fileExt}`
  const filePath = `${codename}/${fileName}`
  const fileBuffer = await logoFile.arrayBuffer()

  const { error: uploadError } = await supabase.storage
    .from(config.storageBucket)
    .upload(filePath, Buffer.from(fileBuffer), {
      cacheControl: config.cacheControl,
      upsert: false,
    })

  if (uploadError) {
    console.error(`Error uploading file: ${uploadError.message}`)
    throw new Error(uploadError.message)
  }

  const { data } = supabase.storage
    .from(config.storageBucket)
    .getPublicUrl(filePath)
  console.log(`Logo file uploaded. Public URL: ${data.publicUrl}`)
  return data.publicUrl
}

async function insertFilterIfNotExists(
  table: "categories" | "labels" | "tags",
  name: string
): Promise<void> {
  const db = getClient()
  const id = crypto.randomUUID()
  try {
    await db.execute({
      sql: `INSERT OR IGNORE INTO ${table} (id, name) VALUES (?, ?)`,
      args: [id, name],
    })
    console.log(`${name} inserted or already exists in ${table}`)
  } catch (error) {
    console.error(`Error inserting into ${table}:`, error)
    throw error
  }
}

export async function onSubmitToolAction(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const data = Object.fromEntries(formData.entries())
  const parsed = schema.safeParse(data)

  if (!parsed.success) {
    const fields: Record<string, string> = {}
    for (const key of Object.keys(data)) {
      fields[key] = data[key].toString()
    }
    return {
      message: "Invalid form data",
      fields,
      issues: parsed.error.issues.map((issue) => issue.message),
    }
  }

  try {
    await initDb()

    // Auth + storage still use Supabase
    const supabase = createClient()
    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData.user) {
      throw new Error("User authentication failed")
    }
    const user = authData.user

    let logoUrl = ""
    const logoFile = formData.get("images") as File
    if (logoFile && logoFile.size > 0) {
      logoUrl = await uploadLogoFile(supabase, logoFile, parsed.data.codename)
    }

    let tags: Enrichment["tags"] = []
    let labels: Enrichment["labels"] = ["unlabeled"]

    if (config.aiEnrichmentEnabled) {
      const enrichmentPrompt = getAIEnrichmentPrompt(
        parsed.data.codename,
        parsed.data.categories,
        parsed.data.description
      )
      const { object: enrichment } = await generateObject({
        model: config.aiModel,
        schema: enrichmentSchema,
        prompt: enrichmentPrompt,
      })

      tags = enrichment.tags
      labels = enrichment.labels ?? ["unlabeled"]

      if (config.allowNewTags) {
        for (const tag of tags) {
          await insertFilterIfNotExists("tags", tag)
        }
      }
      if (config.allowNewLabels) {
        for (const label of labels) {
          await insertFilterIfNotExists("labels", label)
        }
      }
    }

    if (config.allowNewCategories) {
      await insertFilterIfNotExists("categories", parsed.data.categories)
    }

    // Product data goes into Turso
    const db = getClient()
    const id = crypto.randomUUID()
    await db.execute({
      sql: `INSERT INTO products
        (id, full_name, email, twitter_handle, product_website, codename, punchline, description, logo_src, categories, user_id, approved, tags, labels)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      args: [
        id,
        parsed.data.fullName,
        parsed.data.email,
        parsed.data.twitterHandle,
        parsed.data.productWebsite,
        parsed.data.codename,
        parsed.data.punchline,
        parsed.data.description,
        logoUrl,
        parsed.data.categories,
        user.id,
        JSON.stringify(tags),
        JSON.stringify(labels),
      ],
    })

    revalidatePath("/", "layout")
    revalidatePath("/products", "page")

    console.log("Product data successfully inserted")
    return { message: "Tool submitted successfully", issues: [] }
  } catch (error) {
    const msg = isErrorWithMessage(error) ? error.message : "Unknown error occurred"
    console.error(`Submission failed: ${msg}`)
    return {
      message: `Submission failed: ${msg}`,
      issues: [msg],
    }
  }
}
