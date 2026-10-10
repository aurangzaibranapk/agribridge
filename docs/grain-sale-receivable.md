# Grain bikri ka gahak khata (migration 527)

| Waqia | Journal |
|---|---|
| Khareed (stock) | Dr 1220 / Cr 5020 (batch cost) |
| Khareed (payable, 524) | Dr 5020 / Cr 2040 (kisan/party) |
| Bikri (naya) | Dr 1100 (gahak) / Cr 4010 — hamesha, har tareekh, fail ho to error |
| Bikri lagat | Dr 5020 / Cr 1220 (FIFO batch cost) |
| Wusooli (naya) | Dr bank GL / Cr 1100 (gahak) |

**Same-day khareed-farokht:** khareed 1220 ko batch cost se barhati hai, bikri usi batch ki FIFO lagat se 1220 ghatati hai. 1220 wapas sifar par aa jata hai, 5020 mein lagat sirf ek dafa rehti hai, aur 4010 mein bikri ek dafa. Wusooli 4010 ko nahi chhooti, is liye bikri dobara nahi gini jati.

**Gahak:** form par chuna hua gahak, ya "+ Naya gahak", ya buyer se jura (`buyers.customer_id`). Kuch na ho to buyer ke naam se gahak ban kar buyer se jor diya jata hai (purani/offline bikriyan bhi chalti hain). Purani bikriyon ki `customer_id` NULL hai: un ki wusooli tab tak error degi jab tak buyer ya bikri se gahak na joda jaye. Purani entries ki durusti alag, manzoor shuda backfill se hogi.
