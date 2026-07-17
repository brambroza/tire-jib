-- Image similarity search (MVP) with pgvector.
-- Apply in Supabase SQL Editor.

create extension if not exists vector;

create table if not exists public.sku_image_embeddings (
  id bigserial primary key,
  sku_id uuid not null references public.skus(id) on delete cascade,
  image_url text null,
  source text not null default 'manual',
  embedding vector not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sku_image_embeddings_sku_image_uniq unique (sku_id, image_url)
);

create index if not exists sku_image_embeddings_sku_idx
  on public.sku_image_embeddings (sku_id);

create index if not exists sku_image_embeddings_embedding_cosine_idx
  on public.sku_image_embeddings
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

alter table public.sku_image_embeddings enable row level security;
revoke all on public.sku_image_embeddings from public;
grant all on public.sku_image_embeddings to service_role;

create or replace function public.search_similar_skus_by_embedding(
  p_embedding vector,
  p_match_count int default 12,
  p_site_code text default 'car_retail',
  p_group_code text default 'general'
)
returns table (
  sku_id uuid,
  similarity double precision,
  distance double precision
)
language sql
security definer
set search_path = public
as $$
  with site_cte as (
    select s.id
    from sites s
    where s.code::text = coalesce(nullif(p_site_code, ''), 'car_retail')
    limit 1
  ),
  group_cte as (
    select cg.id
    from customer_groups cg
    where cg.code::text = coalesce(nullif(p_group_code, ''), 'general')
    limit 1
  ),
  base as (
    select
      sie.sku_id,
      min(sie.embedding <=> p_embedding) as min_distance
    from sku_image_embeddings sie
    where vector_dims(sie.embedding) = vector_dims(p_embedding)
    group by sie.sku_id
  )
  select
    b.sku_id,
    greatest(0::double precision, least(1::double precision, (1 - b.min_distance))) as similarity,
    b.min_distance::double precision as distance
  from base b
  join skus sku on sku.id = b.sku_id
  join products p on p.id = sku.product_id
  left join group_cte g on true
  where coalesce(p.active, true) = true
    and (
      not exists (select 1 from site_cte)
      or p.site_id = (select id from site_cte)
    )
    and (
      g.id is null
      or exists (
        select 1
        from prices pr
        where pr.sku_id = sku.id
          and pr.group_id = g.id
      )
    )
  order by b.min_distance asc
  limit greatest(1, least(coalesce(p_match_count, 12), 50));
$$;

revoke all on function public.search_similar_skus_by_embedding(vector, int, text, text) from public;
grant execute on function public.search_similar_skus_by_embedding(vector, int, text, text)
  to authenticated, service_role;
