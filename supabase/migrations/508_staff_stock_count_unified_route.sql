-- AgriBridge: point the existing stock-count permission at the unified warehouse count screen.
-- Navigation-only: count records, staff permissions, and stock history are preserved.
update public.features
   set route = '/admin/product-cycles?tab=warehouse'
 where key = 'stock-count'
   and is_active = true;
