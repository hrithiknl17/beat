-- Beat schema. Safe to run more than once.

create table if not exists shops (
  id               serial primary key,
  name             text not null,
  owner_name       text not null,
  phone            text unique,              -- last 10 digits, no country code
  area             text not null,
  language         text not null default 'kn', -- kn | hi | en
  credit_due       integer not null default 0, -- rupees
  credit_due_since date,
  is_demo_caller   boolean not null default false,
  created_at       timestamptz not null default now()
);

create table if not exists skus (
  code              text primary key,          -- short code the agent passes back, e.g. MG70
  name              text not null,             -- how a shopkeeper says it
  pack              text not null,             -- what one unit means, e.g. "case of 96"
  price             integer not null,          -- rupees per unit
  scheme_min_qty    integer,                   -- trade scheme kicks in at this qty
  scheme_off        integer,                   -- rupees off per unit once it kicks in
  scheme_note       text,
  is_new            boolean not null default false,
  in_stock          boolean not null default true,
  substitute        text                       -- code to offer when out of stock
);

create table if not exists calls (
  execution_id   text primary key,
  shop_id        integer references shops(id) on delete cascade,
  direction      text,                         -- inbound | outbound
  status         text not null default 'in-progress',
  started_at     timestamptz not null default now(),
  ended_at       timestamptz,
  duration_sec   integer,
  transcript     text,
  recording_url  text,
  outcome        text                          -- ordered | promised | callback | no_order
);

create table if not exists orders (
  id             serial primary key,
  shop_id        integer not null references shops(id) on delete cascade,
  execution_id   text,                         -- one order per call; re-placing replaces it
  lines          jsonb not null,               -- [{code,name,pack,qty,price,off,total}]
  subtotal       integer not null,
  discount       integer not null default 0,
  total          integer not null,
  source         text not null default 'call', -- call | salesman
  status         text not null default 'confirmed',
  created_at     timestamptz not null default now()
);
create unique index if not exists orders_execution_uq on orders(execution_id) where execution_id is not null;

create table if not exists payment_promises (
  id             serial primary key,
  shop_id        integer not null references shops(id) on delete cascade,
  execution_id   text,
  amount         integer not null,
  promise_date   date not null,
  created_at     timestamptz not null default now()
);

create table if not exists callbacks (
  id             serial primary key,
  shop_id        integer not null references shops(id) on delete cascade,
  execution_id   text,
  callback_at    timestamptz,
  note           text,
  created_at     timestamptz not null default now()
);
