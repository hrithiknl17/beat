-- Demo data: one Bengaluru distributor, five kirana shops on its beat.
-- Prices are illustrative trade prices for the demo, not real quotes.

truncate callbacks, payment_promises, orders, calls, shops, skus restart identity cascade;

insert into skus (code, name, pack, price, scheme_min_qty, scheme_off, scheme_note, is_new) values
  ('PG100', 'Parle-G 100g',                 'box of 48',      450,  null, null, null, false),
  ('PGG',   'Parle-G Gold 200g',            'box of 24',      600,  null, null, null, false),
  ('HNS',   'Hide & Seek 120g',             'box of 24',      720,  null, null, null, false),
  ('MRG',   'Britannia Marie Gold 250g',    'box of 24',      840,  null, null, null, false),
  ('GDY',   'Good Day Cashew 200g',         'box of 24',      960,  null, null, null, false),
  ('MG70',  'Maggi Masala 70g',             'case of 96',     1250, 3,    40,   'Rs 40 off per case on 3 or more cases this week', false),
  ('MG4',   'Maggi Masala 4-pack',          'case of 24',     1140, null, null, null, false),
  ('YPE',   'Yippee Noodles 60g',           'case of 96',     1100, null, null, null, false),
  ('AA5',   'Aashirvaad Atta 5kg',          'bag',            255,  10,   10,   'Rs 10 off per bag on 10 or more bags', false),
  ('AA10',  'Aashirvaad Atta 10kg',         'bag',            495,  null, null, null, false),
  ('FSO',   'Fortune Sunflower Oil 1L',     'carton of 10',   1450, null, null, null, false),
  ('GWO',   'Gold Winner Sunflower Oil 1L', 'carton of 10',   1400, null, null, null, false),
  ('TSALT', 'Tata Salt 1kg',                'bag of 25',      600,  null, null, null, false),
  ('TTP',   'Tata Tea Premium 250g',        'carton of 12',   1560, null, null, null, false),
  ('RLT',   'Red Label Tea 250g',           'carton of 12',   1620, null, null, null, false),
  ('BRU',   'Bru Instant Coffee 50g',       'carton of 12',   1500, null, null, null, false),
  ('CLG',   'Colgate Strong Teeth 100g',    'carton of 24',   1250, null, null, null, false),
  ('LBY',   'Lifebuoy Soap 4x100g',         'carton of 12',   1300, null, null, null, false),
  ('SRF',   'Surf Excel Easy Wash 1kg',     'carton of 10',   1300, null, null, null, false),
  ('VIM',   'Vim Bar 300g',                 'carton of 24',   680,  null, null, null, false),
  ('KRK',   'Kurkure Masala Munch Rs 10',   'box of 30',      270,  null, null, null, false),
  ('LAYS',  'Lays Magic Masala Rs 10',      'box of 30',      270,  null, null, null, false),
  ('KPC',   'Kurkure Puffcorn Rs 10',       'box of 30',      270,  null, null, 'New on our list this month', true),
  ('THU',   'Thums Up 750ml',               'crate of 24',    960,  null, null, null, false),
  ('DMK',   'Dairy Milk Rs 20',             'box of 24',      450,  null, null, null, false);

-- Gold Winner is short this week; the agent offers Fortune instead.
update skus set in_stock = false, substitute = 'FSO' where code = 'GWO';

insert into shops (name, owner_name, phone, area, language, credit_due, credit_due_since) values
  ('Sri Lakshmi Stores',     'Ramesh Gowda',   '9000000001', 'Basavanagudi',      'kn', 4800,  current_date - 18),
  ('Balaji Provision Store', 'Venkatesh',      '9000000002', 'Jayanagar 4th Block','kn', 0,     null),
  ('Sharma General Store',   'Rajesh Sharma',  '9000000003', 'BTM Layout',        'hi', 0,     null),
  ('Al-Ameen Kirana',        'Imran',          '9000000004', 'Shivajinagar',      'hi', 12300, current_date - 34),
  ('Annapoorna Super Mart',  'Lakshmamma',     '9000000005', 'Malleshwaram',      'kn', 2150,  current_date - 9);

-- Last week's orders, taken by the salesman. The agent reads these back on the call.
insert into orders (shop_id, lines, subtotal, discount, total, source, created_at) values
  (1, '[{"code":"PG100","name":"Parle-G 100g","pack":"box of 48","qty":10,"price":450,"off":0,"total":4500},
        {"code":"MG70","name":"Maggi Masala 70g","pack":"case of 96","qty":2,"price":1250,"off":0,"total":2500},
        {"code":"TSALT","name":"Tata Salt 1kg","pack":"bag of 25","qty":2,"price":600,"off":0,"total":1200}]',
      8200, 0, 8200, 'salesman', now() - interval '7 days'),
  (2, '[{"code":"AA5","name":"Aashirvaad Atta 5kg","pack":"bag","qty":12,"price":255,"off":10,"total":2940},
        {"code":"FSO","name":"Fortune Sunflower Oil 1L","pack":"carton of 10","qty":2,"price":1450,"off":0,"total":2900}]',
      5960, 120, 5840, 'salesman', now() - interval '7 days'),
  (3, '[{"code":"TTP","name":"Tata Tea Premium 250g","pack":"carton of 12","qty":1,"price":1560,"off":0,"total":1560},
        {"code":"KRK","name":"Kurkure Masala Munch Rs 10","pack":"box of 30","qty":4,"price":270,"off":0,"total":1080},
        {"code":"LAYS","name":"Lays Magic Masala Rs 10","pack":"box of 30","qty":4,"price":270,"off":0,"total":1080}]',
      3720, 0, 3720, 'salesman', now() - interval '6 days'),
  (4, '[{"code":"MG70","name":"Maggi Masala 70g","pack":"case of 96","qty":3,"price":1250,"off":40,"total":3630},
        {"code":"THU","name":"Thums Up 750ml","pack":"crate of 24","qty":2,"price":960,"off":0,"total":1920},
        {"code":"DMK","name":"Dairy Milk Rs 20","pack":"box of 24","qty":2,"price":450,"off":0,"total":900}]',
      6570, 120, 6450, 'salesman', now() - interval '8 days'),
  (5, '[{"code":"MRG","name":"Britannia Marie Gold 250g","pack":"box of 24","qty":3,"price":840,"off":0,"total":2520},
        {"code":"RLT","name":"Red Label Tea 250g","pack":"carton of 12","qty":1,"price":1620,"off":0,"total":1620},
        {"code":"SRF","name":"Surf Excel Easy Wash 1kg","pack":"carton of 10","qty":1,"price":1300,"off":0,"total":1300}]',
      5440, 0, 5440, 'salesman', now() - interval '7 days');
