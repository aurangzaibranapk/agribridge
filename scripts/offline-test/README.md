# Offline queue ka asal test

Phase 17 ka acceptance test. Ye banawati naql par nahi chalta --
`src/lib/offline/queue.ts` ko esbuild se bundle kar ke ASAL Chromium
mein chalata hai, aur profile disk par rakhta hai taake "app band kar ke
phone restart" waqai wohi cheez ho.

## Chalane ka tareeqa

```
npm i --no-save playwright-core esbuild
npx esbuild src/lib/offline/queue.ts --bundle --format=esm \
  --outfile=scripts/offline-test/queue.bundle.js --platform=browser
node scripts/offline-test/queue-restart.test.mjs scripts/offline-test
```

## Kya saabit karta hai

1. Internet band -- entry aur 2 MB ki tasveer device par mehfooz
2. App band, profile se dobara khula -- dono maujood, wohi chaabi,
   wohi device ka nishan
3. Internet aane par sync -- qatar aur tasveer dono saaf
4. Dobara sync -- kuch nahi jata (chaabi ka taala)

Server ki taraf ka "theek ek qatar" wala saboot alag hai: wo SQL se
liya jata hai (unique partial index par, migration 189).
