-- Applied using Supabase migration repair_plush_purchase_validation.
-- Retains the existing nickname-only model; this is not authentication.
CREATE OR REPLACE FUNCTION public.plush_buy(p_name text, p_items jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare p record; r record; c integer; subtotal numeric:=0; result_items jsonb:='[]'::jsonb; oid bigint;
begin
if jsonb_typeof(p_items) is distinct from 'array' then raise exception 'Invalid cart'; end if;
if jsonb_array_length(p_items)<1 or jsonb_array_length(p_items)>30 then raise exception 'Invalid cart'; end if;
if exists(select 1 from jsonb_array_elements(p_items) x where jsonb_typeof(x->'id') is distinct from 'number' or jsonb_typeof(x->'qty') is distinct from 'number' or (x->>'id')!~'^[0-9]+$' or (x->>'qty')!~'^[0-9]+$') then raise exception 'Invalid item';end if;
if exists(select 1 from (select (x->>'id')::integer id from jsonb_array_elements(p_items) x) z group by id having count(*)>1) then raise exception 'Duplicate item';end if;
select name,coins into p from public.plush_players where name=p_name for update;
if not found then raise exception 'Please sign in';end if;
for r in select id,name,price,stock from public.plush_products where id in(select(x->>'id')::integer from jsonb_array_elements(p_items)x) order by id for update loop
select(x->>'qty')::integer into c from jsonb_array_elements(p_items)x where(x->>'id')::integer=r.id;
if c<1 or c>50 or c>r.stock then raise exception 'Not enough stock for %',r.name;end if;
if r.price is null or r.price<0 or r.price<>trunc(r.price) then raise exception 'Product prices must use whole coins'; end if;
subtotal:=subtotal+r.price*c;
result_items:=result_items||jsonb_build_array(jsonb_build_object('id',r.id,'name',r.name,'price',r.price,'qty',c,'emoji','🧸'));
end loop;
if jsonb_array_length(result_items)<>jsonb_array_length(p_items) then raise exception 'Product not found';end if;
if subtotal>p.coins then raise exception 'Not enough coins. Spin the wheel to earn more!';end if;
update public.plush_players set coins=coins-subtotal::integer where name=p_name returning coins into p.coins;
for r in select id,stock from public.plush_products where id in(select(x->>'id')::integer from jsonb_array_elements(p_items)x) loop
select(x->>'qty')::integer into c from jsonb_array_elements(p_items)x where(x->>'id')::integer=r.id;
update public.plush_products set stock=stock-c where id=r.id;
insert into public.plush_collections(owner,product_id,quantity) values(p_name,r.id,c) on conflict(owner,product_id) do update set quantity=public.plush_collections.quantity+excluded.quantity;
end loop;
insert into public.plush_orders(items,total) values(result_items,subtotal) returning id into oid;
return jsonb_build_object('number',oid,'total',subtotal,'coins',p.coins);
end $function$
;
CREATE OR REPLACE FUNCTION public.plush_join(p_name text, p_avatar text DEFAULT '🧸'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare n text:=left(btrim(p_name),35); a text:=left(coalesce(nullif(btrim(p_avatar),''),'🧸'),8); player record;
begin
if n is null or length(n)<1 then raise exception 'Please enter a name'; end if;
if not (a=any(array['🧸','🐰','🦄','🐼','🐱','🐶','🐸','🦊','🐨','🐧'])) then a:='🧸'; end if;
insert into public.plush_players(name,avatar) values(n,a) on conflict(name) do update set avatar=excluded.avatar;
select name,avatar,coins into player from public.plush_players where name=n;
return jsonb_build_object('name',player.name,'avatar',player.avatar,'coins',player.coins);
end $function$
;

