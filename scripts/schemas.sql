create table public.ans_data (
  id uuid not null default gen_random_uuid (),
  upload_id bigint not null,
  issue_id uuid null,
  catalog_number text null,
  inscription_raw text null,
  reverse_inscription text null,
  hierarchy_id uuid null,
  mint_id uuid null,
  state_id uuid null,
  inscription_id uuid null,
  created_at timestamp with time zone not null default now(),
  constraint ans_data_pkey1 primary key (id),
  constraint ans_data_upload_id_key unique (upload_id),
  constraint ans_data_issue_id_fkey foreign KEY (issue_id) references coin_issues (id),
  constraint ans_data_mint_id_fkey foreign KEY (mint_id) references mints (id),
  constraint ans_data_inscription_id_fkey foreign KEY (inscription_id) references inscriptions (id),
  constraint ans_data_state_id_fkey foreign KEY (state_id) references states (id),
  constraint ans_data_upload_id_fkey foreign KEY (upload_id) references ans_data_upload (id),
  constraint ans_data_hierarchy_id_fkey foreign KEY (hierarchy_id) references coin_type_hierarchy (id)
) TABLESPACE pg_default;

create index IF not exists ans_data_issue_id_idx on public.ans_data using btree (issue_id) TABLESPACE pg_default;

create index IF not exists ans_data_hierarchy_id_idx on public.ans_data using btree (hierarchy_id) TABLESPACE pg_default;


create table public.coin_items (
  id uuid not null default extensions.uuid_generate_v4 (),
  coin_item_code text not null,
  find_code text null,
  deprecated_coin_type_code text null,
  field_no text null,
  artifact_no text null,
  length_mm text null,
  width_mm text null,
  shoulder_width_mm text null,
  foot_width_mm text null,
  weight_g text null,
  condition_zh text null,
  condition_en text null,
  measurement_note_zh text null,
  measurement_note_en text null,
  description_zh text null,
  description_en text null,
  note_zh text null,
  note_en text null,
  created_at timestamp with time zone null default now(),
  coin_issues_id uuid null,
  constraint coin_items_pkey primary key (id),
  constraint coin_items_coin_item_code_key unique (coin_item_code),
  constraint coin_items_coin_issues_id_fkey foreign KEY (coin_issues_id) references coin_issues (id) on delete set null,
  constraint coin_items_find_code_fkey foreign KEY (find_code) references finds (find_code) on update CASCADE on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_coin_items_find_code on public.coin_items using btree (find_code) TABLESPACE pg_default;

create index IF not exists coin_items_coin_issues_id_idx on public.coin_items using btree (coin_issues_id) TABLESPACE pg_default;

create table public.coin_type_hierarchy (
  id uuid not null default gen_random_uuid (),
  level1_zh text null,
  level1_en text null,
  level2_zh text null,
  level2_en text null,
  level3_zh text null,
  level3_en text null,
  level4_zh text null,
  level4_en text null,
  level5_zh text null,
  level5_en text null,
  created_at timestamp with time zone not null default now(),
  img_acc_num text null,
  constraint coin_type_hierarchy_pkey primary key (id),
  constraint coin_type_hierarchy_path_unique unique (
    level1_zh,
    level2_zh,
    level3_zh,
    level4_zh,
    level5_zh
  )
) TABLESPACE pg_default;

create table public.contexts (
  id uuid not null default extensions.uuid_generate_v4 (),
  context_code text not null,
  site_code text not null,
  context_name_zh text not null,
  context_name_en text null,
  context_original_code text null,
  context_type_zh text null,
  context_type_en text null,
  period_zh text null,
  period_en text null,
  description_zh text null,
  description_en text null,
  source_code text null,
  note_zh text null,
  note_en text null,
  created_at timestamp with time zone null default now(),
  constraint contexts_pkey primary key (id),
  constraint contexts_context_code_key unique (context_code),
  constraint contexts_site_code_fkey foreign KEY (site_code) references sites (site_code) on update CASCADE on delete CASCADE,
  constraint contexts_source_code_fkey foreign KEY (source_code) references sources (source_code) on update CASCADE on delete set null
) TABLESPACE pg_default;

create index IF not exists idx_contexts_site_code on public.contexts using btree (site_code) TABLESPACE pg_default;

create table public.finds (
  id uuid not null default extensions.uuid_generate_v4 (),
  find_code text not null,
  context_code text not null,
  deprecated_coin_type_code text null,
  source_code text null,
  presence boolean null default true,
  quantity_total integer null,
  quantity_min integer null,
  quantity_max integer null,
  quantity_estimated integer null,
  quantity_is_estimated boolean null default false,
  total_weight_g numeric null,
  quantity_note_zh text null,
  quantity_note_en text null,
  description_zh text null,
  description_en text null,
  note_zh text null,
  note_en text null,
  created_at timestamp with time zone null default now(),
  coin_issues_id uuid null,
  constraint finds_pkey primary key (id),
  constraint finds_find_code_key unique (find_code),
  constraint finds_coin_issues_id_fkey foreign KEY (coin_issues_id) references coin_issues (id) on delete set null,
  constraint finds_context_code_fkey foreign KEY (context_code) references contexts (context_code) on update CASCADE on delete CASCADE,
  constraint finds_source_code_fkey foreign KEY (source_code) references sources (source_code) on update CASCADE on delete set null
) TABLESPACE pg_default;

create index IF not exists idx_finds_context_code on public.finds using btree (context_code) TABLESPACE pg_default;

create index IF not exists idx_finds_coin_type_code on public.finds using btree (deprecated_coin_type_code) TABLESPACE pg_default;

create index IF not exists finds_coin_issues_id_idx on public.finds using btree (coin_issues_id) TABLESPACE pg_default;

create table public.inscriptions (
  id uuid not null default gen_random_uuid (),
  inscription_zh text null,
  inscription_en text null,
  created_at timestamp with time zone not null default now(),
  constraint inscriptions_pkey primary key (id)
) TABLESPACE pg_default;

create index IF not exists idx_inscription_term_inscription_zh on public.inscriptions using btree (inscription_zh) TABLESPACE pg_default;

create table public.mints (
  id uuid not null default gen_random_uuid (),
  name_zh text not null,
  name_en text null,
  precision_level integer null,
  latitude numeric(10, 7) null,
  longitude numeric(10, 7) null,
  description_zh text null,
  description_en text null,
  citation text null,
  created_at timestamp with time zone not null default now(),
  constraint mints_pkey primary key (id),
  constraint mint_town_name_zh_unique unique (name_zh)
) TABLESPACE pg_default;

create table public.sites (
  id uuid not null default extensions.uuid_generate_v4 (),
  site_code text not null,
  site_name_zh text not null,
  site_name_en text null,
  province_zh text null,
  province_en text null,
  city_zh text null,
  city_en text null,
  county_zh text null,
  county_en text null,
  location_detail_zh text null,
  location_detail_en text null,
  lat double precision null,
  lng double precision null,
  precision_level integer null,
  site_type_zh text null,
  site_type_en text null,
  period_zh text null,
  period_en text null,
  description_zh text null,
  description_en text null,
  source_code text null,
  note_zh text null,
  note_en text null,
  created_at timestamp with time zone null default now(),
  constraint sites_pkey primary key (id),
  constraint sites_site_code_key unique (site_code),
  constraint sites_source_code_fkey foreign KEY (source_code) references sources (source_code) on update CASCADE on delete set null
) TABLESPACE pg_default;

create index IF not exists idx_sites_lat_lng on public.sites using btree (lat, lng) TABLESPACE pg_default;

create index IF not exists idx_sites_location on public.sites using btree (province_zh, city_zh, county_zh) TABLESPACE pg_default;

create table public.source_links (
  id uuid not null default extensions.uuid_generate_v4 (),
  source_link_code text not null,
  source_code text not null,
  target_type text not null,
  target_code text not null,
  page text null,
  note_zh text null,
  note_en text null,
  created_at timestamp with time zone null default now(),
  constraint source_links_pkey primary key (id),
  constraint source_links_source_link_code_key unique (source_link_code),
  constraint source_links_source_code_fkey foreign KEY (source_code) references sources (source_code) on update CASCADE on delete RESTRICT,
  constraint source_links_target_type_check check (
    (
      target_type = any (
        array[
          'site'::text,
          'context'::text,
          'find'::text,
          'coin_item'::text,
          'coin_type'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create unique INDEX IF not exists source_links_unique on public.source_links using btree (source_code, target_type, target_code) TABLESPACE pg_default;

create table public.source_links (
  id uuid not null default extensions.uuid_generate_v4 (),
  source_link_code text not null,
  source_code text not null,
  target_type text not null,
  target_code text not null,
  page text null,
  note_zh text null,
  note_en text null,
  created_at timestamp with time zone null default now(),
  constraint source_links_pkey primary key (id),
  constraint source_links_source_link_code_key unique (source_link_code),
  constraint source_links_source_code_fkey foreign KEY (source_code) references sources (source_code) on update CASCADE on delete RESTRICT,
  constraint source_links_target_type_check check (
    (
      target_type = any (
        array[
          'site'::text,
          'context'::text,
          'find'::text,
          'coin_item'::text,
          'coin_type'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create unique INDEX IF not exists source_links_unique on public.source_links using btree (source_code, target_type, target_code) TABLESPACE pg_default;

create table public.sources (
  id uuid not null default extensions.uuid_generate_v4 (),
  source_code text not null,
  author_zh text null,
  author_en text null,
  title_zh text null,
  title_en text null,
  language text null,
  year integer null,
  publication_zh text null,
  publication_en text null,
  page text null,
  citation_zh text null,
  citation_en text null,
  url text null,
  note_zh text null,
  note_en text null,
  created_at timestamp with time zone null default now(),
  constraint sources_pkey primary key (id),
  constraint sources_source_code_key unique (source_code)
) TABLESPACE pg_default;

create table public.coin_issues (
  id uuid not null default gen_random_uuid (),
  created_at timestamp with time zone not null default now(),
  coin_type_code text null,
  description_zh text null,
  description_en text null,
  note_zh text null,
  note_en text null,
  reverse_inscription text null,
  mint_id uuid null,
  state_id uuid null,
  inscription_id uuid null,
  coin_type_hierarchy_id uuid null,
  constraint coin_issues_pkey primary key (id),
  constraint coin_issues_coin_type_hierarchy_id_fkey foreign KEY (coin_type_hierarchy_id) references coin_type_hierarchy (id) on delete set null,
  constraint coin_issues_inscription_id_fkey foreign KEY (inscription_id) references inscriptions (id) on delete set null,
  constraint coin_issues_mint_id_fkey foreign KEY (mint_id) references mints (id) on delete set null,
  constraint coin_issues_state_id_fkey foreign KEY (state_id) references states (id) on delete set null
) TABLESPACE pg_default;

create unique INDEX IF not exists coin_issues_coin_type_code_key on public.coin_issues using btree (coin_type_code) TABLESPACE pg_default;

create index IF not exists coin_issues_mint_id_idx on public.coin_issues using btree (mint_id) TABLESPACE pg_default;

create index IF not exists coin_issues_state_id_idx on public.coin_issues using btree (state_id) TABLESPACE pg_default;

create index IF not exists coin_issues_inscription_id_idx on public.coin_issues using btree (inscription_id) TABLESPACE pg_default;

create index IF not exists coin_issues_coin_type_hierarchy_id_idx on public.coin_issues using btree (coin_type_hierarchy_id) TABLESPACE pg_default;

create table public.states (
  id uuid not null default gen_random_uuid (),
  created_at timestamp with time zone not null default now(),
  state_zh text not null,
  state_en text null,
  constraint states_pkey primary key (id),
  constraint states_state_key unique (state_zh)
) TABLESPACE pg_default;