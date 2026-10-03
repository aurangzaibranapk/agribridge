-- Offline inventory entries must be safe to retry after a lost response.
-- Existing rows keep working because the key is optional and the partial
-- unique indexes only cover new offline actions.
alter table stock_movements add column if not exists client_action_id uuid;
create unique index if not exists stock_movements_client_action_id_uidx
  on stock_movements (client_action_id) where client_action_id is not null;

alter table stock_transfers add column if not exists client_action_id uuid;
create unique index if not exists stock_transfers_client_action_id_uidx
  on stock_transfers (client_action_id) where client_action_id is not null;
