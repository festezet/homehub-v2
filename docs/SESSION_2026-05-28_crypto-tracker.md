# SESSION 2026-05-28 — Crypto Tracker (PRJ-010)

**Date** : 2026-05-28
**Projet** : HomeHub v2 (PRJ-010)
**Durée** : ~45 min
**Type** : Feature (nouvelle page)

## Objectif

Créer une page dédiée au suivi de cryptomonnaies dans HomeHub, similaire à la page "Marchés" existante, avec 17 cryptos : XRP, Ethereum, Solana, Cardano, Chainlink, Avalanche, Polkadot, Stellar, Hedera, Litecoin, Dogecoin, Shiba Inu, Tezos, Bitcoin Cash, Aptos, Algorand, Hyperliquid.

## Réalisations

### Page native HomeHub (non dynamic page)

Premier essai avec le système de dynamic pages (`mcp__homehub-pages__create_page`) échoué : les scripts JavaScript TradingView ne s'exécutent pas dans les dynamic pages (sanitization HTML). Migration vers une vraie page native avec template + module JS.

### Fichiers créés

1. **`frontend/templates/crypto.html`** (127 lignes)
   - Ticker tape container (`#tradingview-crypto-ticker`)
   - Grid de charts (`#crypto-charts-grid`)
   - Boutons de timeframe (1m/5m/15m/1H/4H/1J/1S)
   - CSS scoped (`.crypto-charts-grid`, `.crypto-chart-container`, `.btn-interval`)

2. **`frontend/static/js/crypto.js`** (168 lignes)
   - Module `CryptoModule` singleton
   - Array `CRYPTOS` (17 entrées : id, symbol TradingView, name)
   - `loadTradingViewScript()` : charge `tv.js` en async
   - `initTickerTape()` : ticker tape widget
   - `initCharts()` : grid de 17 widgets TradingView
   - `bindIntervalButtons()` : switch timeframe
   - Pattern `_waitForTradingView()` pour attendre chargement lib

### Fichiers modifiés

3. **`frontend/templates/base.html`**
   - Ajout include `{% include 'crypto.html' %}` dans `<div id="crypto-page">`
   - Import script `crypto.js` après `markets.js`

4. **`frontend/static/js/app.js`**
   - Import `cryptoModule`
   - Ajout loader `'crypto': () => cryptoModule.load()`

5. **Sidebar DB** (`/data/projects/homehub-v2/data/sidebar.db`)
   - Nouvelle entrée `sidebar_tabs` (id=33)
   - Section 2 (Outils), position 5 (après Marchés)
   - Icon 🪙, label "Crypto Tracker", subtitle "Suivi XRP, ETH, SOL, ADA et 13 autres cryptos"

### Configuration TradingView

**Symboles** (préférence liquidité) :
- Binance USDT pairs : XRP, SOL, ADA, LINK, AVAX, DOT, XLM, HBAR, DOGE, SHIB, XTZ, APT, ALGO
- Bitstamp USD pairs : ETH, LTC, BCH (plus grande liquidité historique)
- Bybit USDT : HYPE (seul exchange supportant Hyperliquid)

**Widgets config** :
- Timezone: `Europe/Paris`
- Locale: `fr`
- Theme: `dark`
- Interval par défaut: `D` (journalier)
- Studies: `SMA` (Simple Moving Average)
- Height charts: 500px

### Pattern technique

Réutilisation du pattern `markets.js` :
1. Lazy loading du script TradingView (`<script src="https://s3.tradingview.com/tv.js">`)
2. Widgets créés via `new TradingView.widget()` (pas embed `<script>` inline)
3. Containers DOM créés dynamiquement par JS
4. Singleton module exposé sur `window.CryptoModule`

### Déploiement

- Serveur HomeHub relancé (PID 8734 → nouveau PID)
- URL : `http://localhost:5000/#crypto`
- Tab visible dans sidebar section Outils

## Décisions

1. **Native page vs Dynamic page** : abandon du système dynamic pages pour les widgets externes nécessitant JavaScript
2. **Symboles Binance/Bitstamp** : préférence Binance USDT pour liquidité, sauf ETH/LTC/BCH (Bitstamp historique)
3. **17 cryptos** : liste fournie par l'utilisateur + Hyperliquid ajouté (nouveau, BYBIT seul exchange)
4. **Timeframe par défaut journalier (D)** : comme page Marchés

## Prochaines étapes

- [auto] Aucune action technique requise — page fonctionnelle

## Fichiers modifiés

```
frontend/templates/crypto.html         (new, 127 lignes)
frontend/static/js/crypto.js           (new, 168 lignes)
frontend/templates/base.html           (+6 lignes)
frontend/static/js/app.js              (+2 lignes)
data/sidebar.db                        (+1 row)
.claude/PROJECT_STATUS.md              (+4 lignes)
```

## Métriques

- Temps session : ~45 min
- Code ajouté : ~300 lignes (HTML + JS)
- Code modifié : ~10 lignes (intégration)
- Builds : 0 (pas de build step)
- Tests : manuel (chargement page, widgets, timeframe)
