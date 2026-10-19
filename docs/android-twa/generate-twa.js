const {TwaManifest, TwaGenerator, ConsoleLog} = require('/workspace/mobile-release/tools/node_modules/@bubblewrap/core');
(async () => {
  const m = new TwaManifest({
    packageId: 'pk.alranatraders.agribridge',
    host: 'alranatraders.pk',
    name: 'AgriBridge — Al Rana Traders',
    launcherName: 'AgriBridge',
    display: 'standalone',
    orientation: 'portrait',
    themeColor: '#0B1426', themeColorDark: '#0B1426',
    navigationColor: '#0B1426', navigationColorDark: '#0B1426',
    navigationDividerColor: '#0B1426', navigationDividerColorDark: '#0B1426',
    backgroundColor: '#0B1426',
    enableNotifications: false,
    startUrl: '/login',
    iconUrl: 'http://127.0.0.1:8765/icon.png',
    maskableIconUrl: 'http://127.0.0.1:8765/maskable-512.png',
    splashScreenFadeOutDuration: 300,
    signingKey: {path: '/workspace/mobile-release/upload-keystore.jks', alias: 'upload'},
    appVersionName: '1.0.0', appVersion: '1.0.0', appVersionCode: 1,
    shortcuts: [],
    generatorApp: 'bubblewrap-core',
    webManifestUrl: 'https://alranatraders.pk/manifest.json',
    fallbackType: 'customtabs',
    features: {},
    enableSiteSettingsShortcut: true,
    isChromeOSOnly: false, isMetaQuest: false,
    fullScopeUrl: 'https://alranatraders.pk/',
    minSdkVersion: 24,
  });
  console.log('validate:', await m.validate?.());
  await m.saveToFile('/workspace/mobile-release/twa/twa-manifest.json').catch(async e => { require('fs').mkdirSync('/workspace/mobile-release/twa',{recursive:true}); await m.saveToFile('/workspace/mobile-release/twa/twa-manifest.json'); });
  await new TwaGenerator().createTwaProject('/workspace/mobile-release/twa', m, new ConsoleLog('gen'));
  console.log('GENERATED');
})().catch(e => { console.error(e); process.exit(1); });
