-- Receiving: bank incoming, cash payout less service charge. Existing rows retain sending.
alter table public.bank_transfer_transactions add column if not exists direction text not null default 'sending';
alter table public.bank_transfer_transactions add constraint chk_bank_transfer_direction check (direction in ('sending','receiving'));
alter table public.bank_transfer_transactions add constraint chk_bank_receiving_fee check (direction <> 'receiving' or coalesce(service_charge,0) < principal);
create or replace function ledger_internal.require_source_posting() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare eid uuid; linked uuid; amount numeric; expected numeric; row_exists boolean;
begin
 execute format('select exists(select 1 from public.%I where id=$1)',tg_table_name) into row_exists using new.id;
 if not row_exists then return new; end if;
 select entry_id into eid from journal_entry_sources where source_table=tg_table_name and source_row_id=new.id;
 if eid is null then raise exception 'Source requires a posted ledger in the same transaction: %',tg_table_name; end if;
 if tg_table_name in ('load_transactions','bank_transfer_transactions') then
   if tg_table_name='bank_transfer_transactions' then
     select journal_entry_id, principal + case when direction='sending' then coalesce(service_charge,0) else 0 end into linked,expected from bank_transfer_transactions where id=new.id;
   else
     select journal_entry_id,principal+coalesce(service_charge,0) into linked,expected from load_transactions where id=new.id;
   end if;
   if linked is distinct from eid then raise exception 'Source ledger link mismatch'; end if;
   select sum(debit) into amount from journal_lines where entry_id=eid;
   if amount is distinct from expected then raise exception 'Source amount does not match posted ledger'; end if;
 else
   select p.amount into expected from supplier_payments p where id=new.id;
   select sum(debit) into amount from journal_lines where entry_id=eid and account_code='2000' and party_type='supplier' and party_id=new.supplier_id;
   if amount is distinct from expected then raise exception 'Supplier payment does not match posted ledger'; end if;
 end if;
 return new;
end $$;
revoke all on function ledger_internal.require_source_posting() from public,anon,authenticated;

drop trigger if exists trg_require_bank_posting on public.bank_transfer_transactions;
create constraint trigger trg_require_bank_posting after insert or update of journal_entry_id,principal,service_charge,direction on public.bank_transfer_transactions deferrable initially deferred for each row execute function ledger_internal.require_source_posting();
