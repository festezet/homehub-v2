/**
 * Crypto Module - Crypto Tracker with TradingView Widgets
 */

const CRYPTOS = [
    { id: 'xrp',   symbol: 'BINANCE:XRPUSDT',  name: 'XRP (Ripple)' },
    { id: 'eth',   symbol: 'BITSTAMP:ETHUSD',   name: 'Ethereum (ETH)' },
    { id: 'sol',   symbol: 'BINANCE:SOLUSDT',   name: 'Solana (SOL)' },
    { id: 'ada',   symbol: 'BINANCE:ADAUSDT',   name: 'Cardano (ADA)' },
    { id: 'link',  symbol: 'BINANCE:LINKUSDT',  name: 'Chainlink (LINK)' },
    { id: 'avax',  symbol: 'BINANCE:AVAXUSDT',  name: 'Avalanche (AVAX)' },
    { id: 'dot',   symbol: 'BINANCE:DOTUSDT',   name: 'Polkadot (DOT)' },
    { id: 'xlm',   symbol: 'BINANCE:XLMUSDT',   name: 'Stellar (XLM)' },
    { id: 'hbar',  symbol: 'BINANCE:HBARUSDT',  name: 'Hedera (HBAR)' },
    { id: 'ltc',   symbol: 'BITSTAMP:LTCUSD',   name: 'Litecoin (LTC)' },
    { id: 'doge',  symbol: 'BINANCE:DOGEUSDT',  name: 'Dogecoin (DOGE)' },
    { id: 'shib',  symbol: 'BINANCE:SHIBUSDT',  name: 'Shiba Inu (SHIB)' },
    { id: 'xtz',   symbol: 'BINANCE:XTZUSDT',   name: 'Tezos (XTZ)' },
    { id: 'bch',   symbol: 'BITSTAMP:BCHUSD',   name: 'Bitcoin Cash (BCH)' },
    { id: 'apt',   symbol: 'BINANCE:APTUSDT',   name: 'Aptos (APT)' },
    { id: 'algo',  symbol: 'BINANCE:ALGOUSDT',  name: 'Algorand (ALGO)' },
    { id: 'hype',  symbol: 'BYBIT:HYPEUSDT',    name: 'Hyperliquid (HYPE)' },
];

class CryptoModule {
    constructor() {
        this.widgetsLoaded = false;
        this.theme = 'dark';
        this.currentInterval = 'D';
    }

    async load() {
        console.log('🪙 Loading Crypto module...');

        if (!this.widgetsLoaded) {
            await this.loadTradingViewScript();
            this.initTickerTape();
            this.initCharts();
            this.bindIntervalButtons();
            this.widgetsLoaded = true;
        }
    }

    loadTradingViewScript() {
        return new Promise((resolve, reject) => {
            if (document.querySelector('script[src*="tradingview.com/tv.js"]')) {
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = 'https://s3.tradingview.com/tv.js';
            script.async = true;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    initTickerTape() {
        const container = document.getElementById('tradingview-crypto-ticker');
        if (!container) return;

        container.innerHTML = '';
        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js';
        script.async = true;
        script.innerHTML = JSON.stringify({
            symbols: CRYPTOS.map(c => ({ description: c.name, proName: c.symbol })),
            showSymbolLogo: true,
            colorTheme: this.theme,
            isTransparent: false,
            displayMode: 'adaptive',
            locale: 'fr'
        });
        container.appendChild(script);
    }

    initCharts() {
        const grid = document.getElementById('crypto-charts-grid');
        if (!grid) return;

        grid.innerHTML = '';

        CRYPTOS.forEach(crypto => {
            const wrapper = document.createElement('div');
            wrapper.className = 'crypto-chart-container';

            const label = document.createElement('div');
            label.className = 'crypto-chart-label';
            label.textContent = crypto.name;

            const chartDiv = document.createElement('div');
            chartDiv.id = 'tv-crypto-' + crypto.id;

            wrapper.appendChild(label);
            wrapper.appendChild(chartDiv);
            grid.appendChild(wrapper);
        });

        // Wait for TradingView lib to be available
        this._waitForTradingView(() => {
            CRYPTOS.forEach(crypto => {
                this.createChart('tv-crypto-' + crypto.id, crypto.symbol);
            });
        });
    }

    _waitForTradingView(callback) {
        if (typeof TradingView !== 'undefined') {
            callback();
        } else {
            setTimeout(() => this._waitForTradingView(callback), 200);
        }
    }

    createChart(containerId, symbol) {
        const container = document.getElementById(containerId);
        if (!container) return;

        new TradingView.widget({
            width: '100%',
            height: 500,
            symbol: symbol,
            interval: this.currentInterval,
            timezone: 'Europe/Paris',
            theme: this.theme,
            style: '1',
            locale: 'fr',
            toolbar_bg: '#1e293b',
            enable_publishing: false,
            withdateranges: true,
            hide_side_toolbar: false,
            allow_symbol_change: true,
            save_image: false,
            container_id: containerId,
            studies: ['STD;SMA'],
            show_popup_button: true,
            popup_width: '1000',
            popup_height: '650'
        });
    }

    bindIntervalButtons() {
        const buttons = document.querySelectorAll('.crypto-interval-btns .btn-interval');
        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                buttons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentInterval = btn.dataset.interval;
                this.initCharts();
            });
        });
    }

    reload() {
        console.log('🔄 Reloading Crypto widgets...');
        this.widgetsLoaded = false;
        this.load();
    }
}

const cryptoModule = new CryptoModule();
window.CryptoModule = cryptoModule;

export default cryptoModule;
