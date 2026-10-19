"""Portal one-screen layout check (browser). Server chalta ho, phir:
    python3 tests/portal-one-screen-layout.py http://localhost:3000 [--shots DIR]
Login: FARMER_LOGIN / CUSTOMER_LOGIN / PORTAL_TEST_PASSWORD env (sirf local/test data).
Jaanch:
  * 1366x768, 1280x720, 1920x1080: page (document) scroll nahi; badle hue safhon par
    <main> ke andar bhi overflow nahi -- lambi cheezein apne panel ke andar scroll.
  * 1366x600 (640 se kam oonchai): normal scroll wapas (fit band).
  * 390x844 phone: normal page scroll, sideways scroll nahi.
  * Urdu: dir=rtl, light + dark mein bhi page scroll nahi.
"""
import os, sys
from playwright.sync_api import sync_playwright

B = sys.argv[1].rstrip("/") if len(sys.argv) > 1 and not sys.argv[1].startswith("--") else "http://localhost:3000"
SHOTS = sys.argv[sys.argv.index("--shots") + 1] if "--shots" in sys.argv else None
PW = os.environ.get("PORTAL_TEST_PASSWORD", "Test1234!")
FARMER = os.environ.get("FARMER_LOGIN", "03226275476")
CUSTOMER = os.environ.get("CUSTOMER_LOGIN", "ali.cust@test.local")
FARMER_PAGES = {"dashboard": "/portal/dashboard", "wallet": "/portal/wallet", "campaigns": "/portal/campaigns", "demand": "/portal/demand", "dairy": "/portal/dairy"}
CUSTOMER_PAGES = {"orders": "/portal/c/orders"}
# Baqi safhe: pf-main ki wajah se page scroll nahi (andar scroll ho sakta hai).
OTHER = ["/portal/profile", "/portal/farms", "/portal/dairy/animals", "/portal/dairy/hisaab", "/portal/dairy/breeding", "/portal/crops", "/portal/harvest"]
fails = []; oks = 0

def check(cond, msg):
    global oks
    if cond: oks += 1; print("  ok ", msg)
    else: fails.append(msg); print("  FAIL", msg)

def theme(pg, t):
    pg.evaluate(f"localStorage.setItem('agribridge-theme','{t}'); document.documentElement.classList.toggle('dark','{t}'=='dark')"); pg.wait_for_timeout(400)

def metrics(pg):
    return pg.evaluate("""() => { const d=document.documentElement, m=document.querySelector('main.pf-main')||document.querySelector('main');
      return {docH:d.scrollHeight, winH:innerHeight, docW:d.scrollWidth, winW:innerWidth, mainS:m?m.scrollHeight:0, mainC:m?m.clientHeight:0,
              dir:(document.querySelector('.portal-shell[dir]')||d).getAttribute('dir'), dark:d.classList.contains('dark'), fit:matchMedia('(min-width: 1024px) and (min-height: 640px)').matches} }""")

def session(p, who, vp, mobile=False, lang="rm"):
    b = p.chromium.launch(executable_path=os.environ.get("CHROME", "/usr/bin/google-chrome"), args=["--no-sandbox"])
    c = b.new_context(viewport={"width": vp[0], "height": vp[1]}, is_mobile=mobile, has_touch=mobile)
    c.add_cookies([{"name": "agribridge_lang", "value": lang, "url": B}])
    pg = c.new_page(); pg.goto(B + "/login"); pg.wait_for_timeout(3000)
    pg.locator("#unified-identifier, #identifier").first.fill(who)
    pg.locator("input[name=password]").first.fill(PW); pg.locator("input[name=password]").first.press("Enter")
    pg.wait_for_url(lambda u: "/login" not in u, timeout=60000); return b, c, pg

def go(pg, u):
    pg.goto(B + u, wait_until="networkidle", timeout=120000); pg.wait_for_timeout(1200)

def desk(p, who, pages):
    for vp in [(1366, 768), (1280, 720), (1920, 1080)]:
        b, c, pg = session(p, who, vp)
        for name, u in pages.items():
            go(pg, u)
            for t in ("light", "dark"):
                theme(pg, t); m = metrics(pg)
                check(m["docH"] <= m["winH"] + 1, f"{vp} {name} {t}: no page scroll ({m['docH']}<= {m['winH']})")
                check(m["mainS"] <= m["mainC"] + 2, f"{vp} {name} {t}: fits in main ({m['mainS']}<= {m['mainC']})")
                if SHOTS and vp == (1366, 768): pg.screenshot(path=f"{SHOTS}/built_{name}_{t}.png"); print("  saved", name, t)
            theme(pg, "light")
        b.close()

with sync_playwright() as p:
    desk(p, FARMER, FARMER_PAGES)
    desk(p, CUSTOMER, CUSTOMER_PAGES)
    b, c, pg = session(p, FARMER, (1366, 768))
    for u in OTHER:
        go(pg, u); m = metrics(pg); check(m["docH"] <= m["winH"] + 1, f"other {u}: no page scroll")
    go(pg, "/portal/services/livestock"); check(pg.url.rstrip("/").endswith("/portal/dairy"), "/portal/services/livestock -> /portal/dairy")
    check(pg.locator('aside a[href="/portal/services/livestock"]').count() == 0, "sidebar: no Livestock item")
    check(pg.locator('[data-testid=milk-sale-panel]').count() == 1 and pg.locator('[data-testid=livestock-loan-panel]').count() == 1, "dairy: milk-sale + livestock-loan panels")
    go(pg, "/portal/campaigns"); pg.wait_for_timeout(2500)
    tiles = pg.evaluate("[...document.querySelectorAll('img')].filter(i=>/tile/.test(i.src)).map(i=>i.referrerPolicy)")
    check(all(t != "no-referrer" for t in tiles), f"map tiles send Referer ({len(tiles)} tiles on season booking)")
    b.close()
    # oonchai 640 se kam: normal scroll
    b, c, pg = session(p, FARMER, (1366, 600)); go(pg, "/portal/wallet"); m = metrics(pg)
    check(not m["fit"] and m["docH"] > m["winH"], "1366x600: fit off, normal page scroll"); b.close()
    # phone
    b, c, pg = session(p, FARMER, (390, 844), mobile=True)
    for name in ("dashboard", "wallet", "dairy"):
        go(pg, FARMER_PAGES[name]); m = metrics(pg)
        check(not m["fit"] and m["docH"] > m["winH"] and m["docW"] <= m["winW"] + 1, f"phone {name}: normal scroll, no sideways")
        if SHOTS and name == "dashboard": pg.screenshot(path=f"{SHOTS}/built_phone_{name}.png")
    b.close()
    # Urdu RTL light + dark
    b, c, pg = session(p, FARMER, (1366, 768), lang="ur")
    for name in ("dashboard", "wallet", "dairy"):
        go(pg, FARMER_PAGES[name])
        for t in ("light", "dark"):
            theme(pg, t); m = metrics(pg)
            check(m["dir"] == "rtl" and m["dark"] == (t == "dark") and m["docH"] <= m["winH"] + 1, f"urdu {name} {t}: rtl, no page scroll")
            if SHOTS: pg.screenshot(path=f"{SHOTS}/built_urdu_{name}_{t}.png")
        theme(pg, "light")
    b.close()

print(f"\nportal-one-screen-layout: {oks} ok, {len(fails)} failed")
sys.exit(1 if fails else 0)
