# Kis mehkame ki mail kis pate se jati hai

Malik ka usool (5 September):
*"machinery ki mail machinery se jani chahiye, job Al Rana Traders se nahi —
sirf job ke hawale se mail job se jayein, HR ke hawale se HR se jayein."*

Pehle **har** mail `job@alranatraders.pk` se jati thi — kisan ko machinery
ki slip bhi wahin se milti. Jawab dene wala jawab usi pate par bhejta, aur
wo naukriyon ke inbox mein ja kar gum ho jata.

Ab har mehkame ka apna pata hai. Code ek hi jagah hai: `src/lib/mailer.ts`.

## Fehrist

| Mehkama     | Pata                          | Kya jata hai                                   | env                                    |
|-------------|-------------------------------|------------------------------------------------|----------------------------------------|
| `jobs`      | job@alranatraders.pk          | Application, interview, offer letter            | `JOB_SMTP_USER` / `JOB_SMTP_PASS`             |
| `hr`        | hr@alranatraders.pk           | Welcome, official login, password reset         | `HR_SMTP_USER` / `HR_SMTP_PASS`               |
| `machinery` | machinery@alranatraders.pk    | Booking slip, bookings list                     | `MACHINERY_SMTP_USER` / `MACHINERY_SMTP_PASS` |
| `grain`     | grain@alranatraders.pk        | Anaj ki payment slip                            | `GRAIN_SMTP_USER` / `GRAIN_SMTP_PASS`         |
| `accounts`  | accounts@alranatraders.pk     | Farmer wallet statement                         | `ACCOUNTS_SMTP_USER` / `ACCOUNTS_SMTP_PASS`   |
| `rent`      | rent@alranatraders.pk         | Kiraye ka muahida (signing link)                | `RENT_SMTP_USER` / `RENT_SMTP_PASS`           |
| `sales`     | sales@alranatraders.pk        | POS ki raseed                                   | `SALES_SMTP_USER` / `SALES_SMTP_PASS`         |

Sab ke liye sanjha: `SMTP_HOST` (default `mail.alranatraders.pk`), `SMTP_PORT` (default 587).

## Jis ka mailbox abhi nahi bana

Us ki mail **rukti nahi** — purane `job@` khate se chali jati hai, aur
`from` mein bhi wohi likha hota hai.

Ye jaan boojh kar hai: `from` mein sirf wo pata ja sakta hai jis se hum ne
**login** kiya. cPanel kisi aur ka naam le kar bhejne nahi deta, aur agar de
bhi de to SPF/DMARC us mail ko spam mein daal dete hain. Is liye mehkame ka
naam mail par lag sakta hai, magar **pata nahi**.

Kaun sa mehkama abhi purane khate se ja raha hai, ye dekhne ke liye:
**Admin → Email Templates** — safhe ke upar fehrist hai (`apna pata` /
`purana khata`).

## Naya mailbox banane ka tareeqa

1. cPanel → **Email Accounts** → *Create* → e.g. `machinery@alranatraders.pk`
2. Password rakhein (mazboot).
3. cPanel → **Setup Node.js App** → apni app → **Environment variables**:
   - `MACHINERY_SMTP_USER` = `machinery@alranatraders.pk`
   - `MACHINERY_SMTP_PASS` = wohi password
4. App **Restart**.
5. Admin → Email Templates par jaa kar dekhein — us qatar par ab `apna pata`
   likha hona chahiye.

Code badalne ki zaroorat **nahi**.
