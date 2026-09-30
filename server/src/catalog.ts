// Каталог товаров: читаем ../shared/catalog.json при старте. Цены — только отсюда, клиенту не доверяем.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { SERVER_ROOT } from './env.ts'

const ProductSchema = z.object({
  sku: z.string().regex(/^[a-z0-9_]{1,40}$/),
  title: z.string().min(1),
  subtitle: z.string().default(''),
  price: z.number().int().positive(),
  grants: z.array(z.string().min(1)),
  credits: z.number().int().min(0),
  coins: z.number().int().min(0),
  perks: z.array(z.string()),
})

const CatalogSchema = z.object({
  currency: z.literal('RUB'),
  products: z.array(ProductSchema).min(1),
})

export type Product = z.infer<typeof ProductSchema>

export const CATALOG_PATH = path.resolve(SERVER_ROOT, '..', 'shared', 'catalog.json')

function load() {
  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(CATALOG_PATH, 'utf8'))
  } catch (e) {
    throw new Error(`Не удалось прочитать каталог ${CATALOG_PATH}: ${e instanceof Error ? e.message : e}`)
  }
  const parsed = CatalogSchema.safeParse(raw)
  if (!parsed.success) throw new Error(`Каталог некорректен: ${parsed.error.message}`)
  const bySku = new Map<string, Product>()
  for (const p of parsed.data.products) {
    if (bySku.has(p.sku)) throw new Error(`Каталог: повторяется sku ${p.sku}`)
    bySku.set(p.sku, p)
  }
  return { currency: parsed.data.currency, bySku }
}

export const catalog = load()

export function getProduct(sku: string): Product | undefined {
  return catalog.bySku.get(sku)
}

export const SKUS = [...catalog.bySku.keys()]
