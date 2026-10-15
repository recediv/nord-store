import { ContainerRegistrationKeys, MedusaError } from '@medusajs/framework/utils'
import type { MedusaStoreRequest } from '@medusajs/framework/http'
import type { CatalogQuery, CatalogResult, Facet, Product } from '../catalog-contract'
import { catalogPrices } from './catalog-prices'

type CatalogRow = Omit<CatalogResult, 'facets' | 'price' | 'products'> & {
  facets: Record<Facet, { value: string; hex?: string; count: number }[]>
  minimum: number | null
  maximum: number | null
  priceCount: number
  buckets: { index: number; count: number }[]
  products: (Product & {
    metadata: Partial<Product> | null
    title: string
    thumbnail: string
    category_handles: string[]
    compare_price: number | null
    is_new: boolean
  })[]
}
const facetTitles: Record<Facet, string> = {
  category: 'Категория',
  material: 'Материал',
  room: 'Комната',
  color: 'Цвет',
}
const sortOrders: Record<string, string> = {
  popular: 'featured DESC, reviews DESC, id',
  'price-asc': 'price ASC, id',
  'price-desc': 'price DESC, id',
  new: 'is_new DESC, created_at DESC, id',
  rating: 'rating DESC, reviews DESC, id',
}

function list(value: string | undefined) {
  return [...new Set((value || '').split(',').filter(Boolean))].slice(0, 200)
}
function number(value: string | undefined, fallback: number, max: number) {
  if (value === undefined || value === '') return fallback
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > max)
    throw new MedusaError(MedusaError.Types.INVALID_DATA, 'Недопустимое числовое значение фильтра.')
  return parsed
}

// Scope catalog reads to the publishable key; native workflows handle writes.
export async function queryCatalog(
  req: MedusaStoreRequest,
  query: CatalogQuery,
): Promise<CatalogResult> {
  const channels = req.publishable_key_context.sales_channel_ids
  if (!channels.length)
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, 'Не выбран канал продаж.')
  const min = number(query.minPrice, 0, 1e9)
  const max = number(query.maxPrice, 1e9, 1e9)
  const limit = Math.min(24, Math.max(1, Math.floor(number(query.limit, 12, 24))))
  const offset = Math.floor(number(query.offset, 0, 1e7))
  const db = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const handles = query.handles ? list(query.handles) : undefined
  const prices = await catalogPrices(req, handles)
  const bindings: (string | number | string[])[] = []
  const bind = (value: string | number | string[]) => {
    bindings.push(value)
    return '?'
  }
  const scopedProducts = `p.deleted_at IS NULL AND p.status = 'published'
    AND EXISTS (SELECT 1 FROM product_sales_channel sc WHERE sc.product_id = p.id
      AND sc.deleted_at IS NULL AND sc.sales_channel_id = ANY(${bind(channels)}::text[]))
    ${handles ? `AND p.handle = ANY(${bind(handles)}::text[])` : ''}`
  const inventoryChannels = bind(channels)
  const calculatedPrices = bind(JSON.stringify(prices))
  const scope = [`TRUE`]
  if (query.q?.trim()) {
    const term = query.q
      .trim()
      .slice(0, 200)
      .toLocaleLowerCase('ru')
      .replace(/[\\%_]/g, '\\$&')
    // C collation does not fold Cyrillic; normalize it explicitly for search.
    scope.push(`lower(translate(concat_ws(' ', title, subtitle, description, metadata->>'material'),
      'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ', 'абвгдеёжзийклмнопрстуфхцчшщъыьэюя')) LIKE ${bind('%' + term + '%')}`)
  }
  if (query.exclude) scope.push(`handle <> ALL(${bind(list(query.exclude))}::text[])`)
  if (query.similarTo)
    scope.push(
      `category_handles && coalesce((SELECT category_handles FROM base WHERE handle = ${bind(query.similarTo)} LIMIT 1), category_handles)`,
    )
  if (query.collection === 'favorites')
    scope.push(`handle = ANY(${bind(list(query.favorites))}::text[])`)
  else if (query.collection === 'new') scope.push('is_new')
  else if (query.collection === 'sale') scope.push('compare_price > price')
  else if (query.collection === 'featured') scope.push('featured')

  const facetPredicates = new Map<Facet, string>()
  for (const facet of Object.keys(facetTitles) as Facet[]) {
    const selected = list(query[facet])
    if (!selected.length) continue
    facetPredicates.set(
      facet,
      facet === 'color'
        ? `EXISTS (SELECT 1 FROM jsonb_array_elements(colors) c WHERE c->>'name' = ANY(${bind(selected)}::text[]))`
        : facet === 'category'
          ? `category_handles && ${bind(selected)}::text[]`
          : `metadata->>'${facet}' = ANY(${bind(selected)}::text[])`,
    )
  }
  const pricePredicate = `price >= ${bind(min)} AND price <= ${bind(max)}`

  // Boolean CTE columns avoid repeating Knex positional bindings.
  const predicates = [...facetPredicates].map(
    ([facet, predicate]) => `${predicate} AS matches_${facet}`,
  )
  predicates.push(`${pricePredicate} AS matches_price`, `stock > 0 AS matches_stock`)
  function matches(omit?: Facet | 'price' | 'stock') {
    return (
      [
        'matches_scope',
        ...[...facetPredicates.keys()]
          .filter((facet) => facet !== omit)
          .map((facet) => `matches_${facet}`),
        ...(omit === 'price' ? [] : ['matches_price']),
        ...(query.inStock === 'true' && omit !== 'stock' ? ['matches_stock'] : []),
      ].join(' AND ') || 'TRUE'
    )
  }
  const facetQueries = (Object.keys(facetTitles) as Facet[])
    .map((facet) => {
      const value =
        facet === 'color'
          ? `c->>'name'`
          : facet === 'category'
            ? 'category_value'
            : `metadata->>'${facet}'`
      const join =
        facet === 'color'
          ? `CROSS JOIN LATERAL (SELECT DISTINCT ON (c->>'name') c FROM jsonb_array_elements(colors) c) color_values`
          : facet === 'category'
            ? 'CROSS JOIN LATERAL unnest(category_handles) category_value'
            : ''
      const hex = facet === 'color' ? `max(c->>'hex')` : 'NULL'
      return `'${facet}', (SELECT COALESCE(jsonb_agg(option ORDER BY option->>'value'), '[]'::jsonb) FROM (
      SELECT jsonb_build_object('value', ${value}, 'hex', ${hex}, 'count', count(*) FILTER (WHERE ${matches(facet)})) AS option
      FROM matched ${join} WHERE ${value} IS NOT NULL GROUP BY ${value}) options)`
    })
    .join(',')
  const sort = sortOrders[query.sort || 'popular'] || sortOrders.popular
  // Match the card's first available variant, falling back to the first when sold out.
  const sql = `WITH published AS MATERIALIZED (
    SELECT p.id, p.handle, p.title, p.subtitle, p.description, p.thumbnail, p.metadata, p.created_at,
      coalesce(category.handles, ARRAY[]::text[]) AS category_handles, coalesce(category.name, '') AS "categoryName"
    FROM product p LEFT JOIN LATERAL (
      SELECT array_agg(c.handle ORDER BY c.rank, c.name) AS handles, (array_agg(c.name ORDER BY c.rank, c.name))[1] AS name
      FROM product_category_product cp JOIN product_category c ON c.id = cp.product_category_id
      WHERE cp.product_id = p.id AND c.deleted_at IS NULL AND c.is_active AND NOT c.is_internal
    ) category ON TRUE WHERE ${scopedProducts}
  ), inventory AS (
    SELECT vi.variant_id, min(greatest(0, floor(coalesce(level.quantity, 0) / greatest(1, vi.required_quantity)))) AS stock
    FROM product_variant_inventory_item vi
    JOIN product_variant v ON v.id = vi.variant_id AND v.deleted_at IS NULL
    JOIN published p ON p.id = v.product_id
    LEFT JOIN LATERAL (
      SELECT sum(greatest(0, il.stocked_quantity - il.reserved_quantity)) AS quantity
      FROM inventory_level il WHERE il.inventory_item_id = vi.inventory_item_id AND il.deleted_at IS NULL
        AND EXISTS (SELECT 1 FROM sales_channel_stock_location sl WHERE sl.stock_location_id = il.location_id
          AND sl.deleted_at IS NULL AND sl.sales_channel_id = ANY(${inventoryChannels}::text[]))
    ) level ON TRUE
    WHERE vi.deleted_at IS NULL GROUP BY vi.variant_id
  ), native_prices AS (SELECT * FROM jsonb_to_recordset(${calculatedPrices}::jsonb) AS price(id text, amount numeric, original numeric)), variant_rows AS (
    SELECT v.product_id, v.id, v.variant_rank, v.created_at, pr.amount AS price, pr.original AS compare_price,
      coalesce(color.value, v.title) AS color,
      CASE WHEN NOT v.manage_inventory OR v.allow_backorder THEN 99999 ELSE coalesce(i.stock, 0) END AS stock
    FROM product_variant v JOIN published p ON p.id = v.product_id
    JOIN product_variant_price_set ps ON ps.variant_id = v.id AND ps.deleted_at IS NULL
    JOIN native_prices pr ON pr.id = ps.price_set_id
    LEFT JOIN inventory i ON i.variant_id = v.id
    LEFT JOIN LATERAL (SELECT ov.value FROM product_variant_option vo JOIN product_option_value ov ON ov.id = vo.option_value_id
      JOIN product_option po ON po.id = ov.option_id WHERE vo.variant_id = v.id AND po.title = 'Цвет'
      AND ov.deleted_at IS NULL AND po.deleted_at IS NULL LIMIT 1) color ON TRUE
    WHERE v.deleted_at IS NULL
  ), variants AS (
    SELECT product_id,
      (array_agg(price ORDER BY (stock > 0) DESC, variant_rank, created_at, id))[1] AS price,
      (array_agg(compare_price ORDER BY (stock > 0) DESC, variant_rank, created_at, id))[1] AS compare_price,
      max(stock) AS stock,
      jsonb_agg(jsonb_build_object('id', id, 'color', color, 'price', price, 'comparePrice', compare_price, 'stock', stock)
        ORDER BY variant_rank, created_at, id) AS variants
    FROM variant_rows GROUP BY product_id
  ), base AS MATERIALIZED (
    SELECT p.*, v.price, v.stock, v.variants,
      (SELECT coalesce(jsonb_agg(jsonb_build_object('name', vv->>'color', 'hex', coalesce(color->>'hex', '#dddddd')) ORDER BY entry.ordinal), '[]'::jsonb)
        FROM jsonb_array_elements(v.variants) WITH ORDINALITY AS entry(vv, ordinal) LEFT JOIN LATERAL (
          SELECT color FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p.metadata->'colors') = 'array' THEN p.metadata->'colors' ELSE '[]'::jsonb END) color
          WHERE color->>'name' = vv->>'color' LIMIT 1
        ) swatch ON TRUE) AS colors,
      v.compare_price,
      coalesce(p.metadata->>'featured' = 'true', FALSE) AS featured,
      coalesce(p.metadata->>'isNew' = 'true', FALSE) AS is_new,
      CASE WHEN p.metadata->>'reviews' ~ '^\\d{1,7}$' THEN (p.metadata->>'reviews')::integer ELSE 0 END AS reviews,
      CASE WHEN p.metadata->>'rating' ~ '^\\d(\\.\\d+){0,1}$' THEN least(5, (p.metadata->>'rating')::numeric) ELSE 0 END AS rating
    FROM published p JOIN variants v ON v.product_id = p.id
  ), matched AS MATERIALIZED (SELECT *, ${scope.join(' AND ')} AS matches_scope, ${predicates.join(', ')} FROM base),
  filtered AS (SELECT * FROM matched WHERE ${matches()}),
  price_range AS (SELECT min(price) AS minimum, max(price) AS maximum, count(*) AS count FROM matched WHERE ${matches('price')}),
  buckets AS (SELECT CASE WHEN r.maximum = r.minimum THEN 0 ELSE least(11, floor(12 * (price - r.minimum) / (r.maximum - r.minimum)))::integer END AS index, count(*) AS count
    FROM matched, price_range r WHERE ${matches('price')} GROUP BY index),
  page AS (SELECT * FROM filtered ORDER BY ${sort} LIMIT ${bind(limit)} OFFSET ${bind(offset)})
  SELECT (SELECT count(*)::integer FROM filtered) AS count,
    (SELECT count(*)::integer FROM matched WHERE ${matches('stock')} AND matches_stock) AS "availableCount",
    (SELECT greatest(80000, coalesce(max(price), 0)) FROM base) AS "priceLimit",
    (SELECT coalesce(jsonb_object_agg(category, count), '{}'::jsonb) FROM (
      SELECT category, count(*)::integer AS count FROM base CROSS JOIN LATERAL unnest(category_handles) category
      GROUP BY category) counts) AS "categoryCounts",
    (SELECT coalesce(jsonb_agg(jsonb_build_object('id', handle, 'name', name, 'description', coalesce(description, ''), 'image', coalesce(metadata->>'image', '')) ORDER BY rank, name), '[]'::jsonb)
      FROM product_category WHERE deleted_at IS NULL AND is_active AND NOT is_internal) AS categories,
    (SELECT COALESCE(jsonb_agg(to_jsonb(page)), '[]'::jsonb) FROM page) AS products,
    jsonb_build_object(${facetQueries}) AS facets,
    r.minimum, r.maximum, r.count::integer AS "priceCount",
    (SELECT COALESCE(jsonb_agg(to_jsonb(buckets)), '[]'::jsonb) FROM buckets) AS buckets
  FROM price_range r`
  const { rows } = await db.raw<{ rows: CatalogRow[] }>(sql, bindings)
  const row = rows[0]
  const minimum = Number(row.minimum || 0)
  const maximum = Number(row.maximum || 0)
  const bins = minimum === maximum ? 1 : 12
  const width = (maximum - minimum) / bins
  const buckets = new Map(row.buckets.map((bucket) => [bucket.index, Number(bucket.count)]))
  const facets = (Object.keys(facetTitles) as Facet[]).map((id) => ({
    id,
    title: facetTitles[id],
    options: row.facets[id].map((option) => ({
      ...option,
      count: Number(option.count),
      label:
        id === 'category'
          ? row.categories?.find((c) => c.id === option.value)?.name || option.value
          : option.value,
    })),
  }))
  return {
    generatedAt: Date.now(),
    products: row.products.map((remote) => {
      const metadata = remote.metadata || {}
      return {
        ...metadata,
        handle: remote.handle,
        name: remote.title,
        subtitle: remote.subtitle || '',
        description: remote.description || '',
        image: remote.thumbnail || '',
        category: remote.category_handles[0] || '',
        categoryName: remote.categoryName,
        material: metadata.material || '',
        room: metadata.room || '',
        colors: remote.colors,
        specs: metadata.specs || {},
        comparePrice: remote.compare_price == null ? null : Number(remote.compare_price),
        isNew: remote.is_new,
        featured: remote.featured,
        rating: Number(remote.rating),
        reviews: Number(remote.reviews),
        price: Number(remote.price),
        stock: Number(remote.stock),
        variants: remote.variants,
      }
    }),
    count: Number(row.count),
    limit,
    offset,
    facets,
    availableCount: Number(row.availableCount),
    priceLimit: Number(row.priceLimit),
    categoryCounts: row.categoryCounts,
    categories: row.categories,
    price: {
      min: minimum,
      max: maximum,
      count: row.priceCount,
      bins: Array.from({ length: bins }, (_, index) => ({
        from: Math.round(minimum + width * index),
        to: index === bins - 1 ? maximum : Math.round(minimum + width * (index + 1)),
        count: buckets.get(index) || 0,
      })),
    },
  }
}
