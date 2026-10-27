-- Beat schema. Safe to run more than once. Every business row belongs to one distributor account.

create table if not exists distributors (
  id             serial primary key,
  name           text not null,                -- business name the agent says, e.g. "Sri Ganesh Distributors"
  owner_name     text not null,
  email          text not null unique,         -- stored lowercase
  password_hash  text not null,                -- scrypt$<salt hex>$<key hex>
  city           text not null default 'Bengaluru',
  phone_number   text unique,                  -- the Bolna number shops ring; routes inbound calls to this account
  delivery_note  text not null default 'Tomorrow before 11 AM, cash or UPI on delivery',
  created_at     timestamptz not null default now()
);

create table if not exists sessions (
  token_hash     text primary key,             -- sha256 of the cookie value; the raw token is never stored
  distributor_id integer not null references distributors(id) on delete cascade,
  expires_at     timestamptz not null,
  created_at     timestamptz not null default now()
);

create table if not exists shops (
  id               serial primary key,
  distributor_id   integer not null references distributors(id) on delete cascade,
  name             text not null,
  owner_name       text not null default '',
  phone            text,                       -- last 10 digits, no country code
  area             text not null default '',
  language         text not null default 'kn', -- kn | hi | te | ta | ml | en
  credit_due       integer not null default 0, -- rupees
  credit_due_since date,
  status           text not null default 'active', -- active | new (rang in, not yet checked) | paused
  notes            text,
  created_at       timestamptz not null default now(),
  unique (distributor_id, phone)
);
create index if not exists shops_phone_idx on shops(phone);

create table if not exists products (
  id                serial primary key,
  distributor_id    integer not null references distributors(id) on delete cascade,
  code              text not null,             -- short code the agent passes back, e.g. MG70
  name              text not null,             -- how a shopkeeper says it
  pack              text not null,             -- what one unit means, e.g. "case of 96"
  price             integer not null,          -- rupees per unit
  scheme_min_qty    integer,                   -- trade scheme kicks in at this qty
  scheme_off        integer,                   -- rupees off per unit once it kicks in
  scheme_note       text,
  is_new            boolean not null default false,
  in_stock          boolean not null default true,
  substitute        text,                      -- code to offer when out of stock
  unique (distributor_id, code)
);

create table if not exists calls (
  execution_id   text primary key,
  distributor_id integer references distributors(id) on delete cascade,
  shop_id        integer references shops(id) on delete cascade,
  direction      text,                         -- inbound | outbound
  purpose        text not null default 'beat', -- beat | callback
  status         text not null default 'in-progress',
  started_at     timestamptz not null default now(),
  ended_at       timestamptz,
  duration_sec   integer,
  transcript     text,
  recording_url  text,
  outcome        text                          -- ordered | promised | callback | no_order
);
create index if not exists calls_distributor_idx on calls(distributor_id, started_at desc);

create table if not exists orders (
  id             serial primary key,
  distributor_id integer not null references distributors(id) on delete cascade,
  shop_id        integer not null references shops(id) on delete cascade,
  execution_id   text,                         -- one order per call; re-placing replaces it
  lines          jsonb not null,               -- [{code,name,pack,qty,price,off,total}]
  subtotal       integer not null,
  discount       integer not null default 0,
  total          integer not null,
  source         text not null default 'call', -- call | salesman
  status         text not null default 'new',  -- new | packed | dispatched | delivered | cancelled
  paid_by        text,                         -- cash | credit, set on delivery
  delivered_at   timestamptz,
  created_at     timestamptz not null default now()
);
create unique index if not exists orders_execution_uq on orders(execution_id) where execution_id is not null;
create index if not exists orders_distributor_idx on orders(distributor_id, created_at desc);

create table if not exists payment_promises (
  id             serial primary key,
  distributor_id integer not null references distributors(id) on delete cascade,
  shop_id        integer not null references shops(id) on delete cascade,
  execution_id   text,
  amount         integer not null,
  promise_date   date not null,
  status         text not null default 'open', -- open | kept (missed = open and past its date)
  created_at     timestamptz not null default now()
);

create table if not exists payments (
  id             serial primary key,
  distributor_id integer not null references distributors(id) on delete cascade,
  shop_id        integer not null references shops(id) on delete cascade,
  amount         integer not null,
  method         text not null default 'cash', -- cash | upi | cheque
  note           text,
  received_at    timestamptz not null default now()
);

create table if not exists callbacks (
  id             serial primary key,
  distributor_id integer not null references distributors(id) on delete cascade,
  shop_id        integer not null references shops(id) on delete cascade,
  execution_id   text,                         -- the call where it was asked for
  callback_at    timestamptz,
  note           text,
  status         text not null default 'pending', -- pending | dialled | done | cancelled
  dialled_execution_id text,
  created_at     timestamptz not null default now()
);
