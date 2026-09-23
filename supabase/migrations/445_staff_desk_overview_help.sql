-- AgriBridge — Migration 445: Shop desk aur customer khata ki rehnumai
--
-- Code adds compact, tabbed staff workspaces and a read-only customer
-- receivable view. No new ledger or balance is stored here.

update public.feature_help
set purpose = 'My Work shop staff ka ek safha hai: assigned shop ki POS sale, payment methods aur FIFO stock value; tasks aur authorized work links. Jis amount ki shop-level attribution ya reconciliation nahi, usay combined cash balance keh kar nahi dikhaya jata.',
    who_uses = 'Shop ka assigned sales staff; har figure apni authorized scope tak.',
    when_use = 'Roz ka kaam shuru karte waqt, shop ki POS activity aur stock value dekhne ke liye.',
    how_steps = array[
      'Shop Overview mein aaj ki POS sale, received payment aur Khata sale alag dekhein.',
      'POS Payment Methods mein har method ki sale, mapped approved expense/wapsi aur period movement dekhein.',
      'Stock Value FIFO cost par hai; yeh selling price ya cash nahi.',
      'Load/Bill aur Recovery ko unke apne safhe par dekhein; unhein shop balance mein tab tak na milayein jab tak shop attribution reconcile na ho.',
      'Tasks ya My Departments tab se agla authorized kaam kholein.'
    ],
    next_step = 'Customer ki baqi raqam dekhne ke liye Paisa & Khata mein Customer Khata tab kholein.',
    mistakes = array[
      'Stock value ko cash ya selling value samajhna.',
      'POS Khata sale ko wasool shuda cash mein shamil karna.',
      'Payment method ka period net ko closing balance samajhna.',
      'Doosri shop ya branch ke ledger ko apne shop ka hisaab samajhna.'
    ],
    related = array['load-bill', 'kharche', 'inventory'],
    updated_at = now()
where feature_key = 'my-work' and lang = 'rm';

update public.feature_help
set purpose = 'Customer Khata shows posted customer receivables, total debits, credits, outstanding amount and recorded payment promises within the caller''s authorized ledger scope.',
    who_uses = 'Staff with CRM view permission and an authorized ledger scope.',
    when_use = 'When checking who owes the business, recorded payment commitments, or a customer''s ledger history.',
    how_steps = array[
      'Open the Customer Khata tab and search by customer name or phone.',
      'Use the filters for outstanding, due today, next seven days, overdue promises, or all customers.',
      'Open View to inspect the posted debit and credit entries with their source and reference.',
      'Use the recorded promise date as a follow-up date; invoice due dates are not inferred here.',
      'Record a received payment through the existing Load & Bill / Payment Receive workflow.'
    ],
    next_step = 'After recording a payment, revisit the customer ledger to confirm the posted balance.',
    mistakes = array[
      'Treating credits as payment only: returns and adjustments may also credit the receivable.',
      'Treating a recorded payment promise as a contractual invoice due date.',
      'Assuming an unavailable or unauthorized shop ledger means the customer owes zero.'
    ],
    updated_at = now()
where feature_key = 'kharche' and lang = 'rm';

update public.feature_help
set purpose = 'Load and Bill now has four work tabs: Mobile Load, Bill Payment, Udhaar, and Payment Receive. Each records its own customer/provider details and proof status.',
    how_steps = array[
      'Choose Mobile Load, Bill Payment, Udhaar, or Payment Receive.',
      'Enter the customer, amount, account, and provider or reference details shown for that work type.',
      'Use Save as Pending Proof when the customer has not paid or provider evidence is still missing.',
      'After a successful save, use the receipt controls for the saved transaction.',
      'Use Today’s Transactions to review recent entries without leaving the page.'
    ],
    next_step = 'Reconcile provider float at shift end; review customer receivables in Paisa & Khata.',
    updated_at = now()
where feature_key = 'load-bill' and lang = 'rm';
