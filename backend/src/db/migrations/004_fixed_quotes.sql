-- Workers quote one fixed price, or a fixed visit charge when they must see the job first.
alter table quotes drop constraint quotes_price_type_check;
update quotes set price_min = coalesce(price_max, price_min), price_type = 'fixed' where price_type = 'range';
alter table quotes rename column price_min to price;
alter table quotes drop column price_max;
alter table quotes add constraint quotes_price_type_check check (price_type in ('fixed', 'visit_only'));
alter table quotes add constraint quotes_fixed_has_price check (price_type <> 'fixed' or price is not null);
