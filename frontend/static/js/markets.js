/**
 * Markets Module - Financial Markets with TradingView Widgets
 */

import Utils from './utils.js';

class MarketsModule {
    constructor() {
        this.widgetsLoaded = false;
        this.theme = 'dark'; // Match HomeHub dark theme
    }

    /**
     * Load markets page with TradingView widgets
     */
    async load() {
        console.log('📈 Loading Markets module...');

        if (!this.widgetsLoaded) {
            // Load TradingView library
            await this.loadTradingViewScript();

            // Initialize all widgets
            this.initTickerTape();
            this.initMainCharts();

            this.widgetsLoaded = true;
        }
    }

    /**
     * Load TradingView external script
     */
    loadTradingViewScript() {
        return new Promise((resolve, reject) => {
            // Check if already loaded
            if (document.querySelector('script[src*="tradingview.com"]')) {
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

    /**
     * Initialize Ticker Tape widget (bande défilante)
     */
    initTickerTape() {
        const container = document.getElementById('tradingview-ticker-tape');
        if (!container) return;

        // Clear container first
        container.innerHTML = '';

        // Create script element for ticker tape
        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js';
        script.async = true;
        script.innerHTML = JSON.stringify({
            "symbols": [
                {
                    "description": "Bitcoin",
                    "proName": "BITSTAMP:BTCUSD"
                },
                {
                    "proName": "OANDA:XAUUSD",
                    "title": "Or (XAU/USD)"
                },
                {
                    "proName": "OANDA:XAGUSD",
                    "title": "Argent (XAG/USD)"
                },
                {
                    "proName": "COMEX:HG1!",
                    "title": "Cuivre"
                },
                {
                    "proName": "OANDA:XPTUSD",
                    "title": "Platine (XPT/USD)"
                },
                {
                    "description": "EUR/USD",
                    "proName": "FX:EURUSD"
                },
                {
                    "description": "NASDAQ",
                    "proName": "NASDAQ:IXIC"
                },
                {
                    "description": "S&P 500",
                    "proName": "FOREXCOM:SPXUSD"
                },
                {
                    "description": "Ethereum",
                    "proName": "BITSTAMP:ETHUSD"
                },
                {
                    "proName": "NASDAQ:MSFT",
                    "title": "Microsoft"
                },
                {
                    "proName": "NASDAQ:AMZN",
                    "title": "Amazon"
                },
                {
                    "proName": "NASDAQ:GOOGL",
                    "title": "Google"
                },
                {
                    "proName": "NASDAQ:TSLA",
                    "title": "Tesla"
                },
                {
                    "description": "Pétrole Brut",
                    "proName": "TVC:USOIL"
                }
            ],
            "showSymbolLogo": true,
            "colorTheme": this.theme,
            "isTransparent": false,
            "displayMode": "adaptive",
            "locale": "fr"
        });

        container.appendChild(script);
    }

    /**
     * Initialize main charts (8 charts total)
     * Order: BTC, Métaux (Or, Argent, Cuivre, Platine), EUR/USD, Indices (NASDAQ, S&P 500)
     */
    initMainCharts() {
        // 1. Bitcoin
        this.createAdvancedChart('tradingview-gold', 'BITSTAMP:BTCUSD', 'Bitcoin / USD');

        // 2. Or (XAU/USD)
        this.createAdvancedChart('tradingview-btc', 'OANDA:XAUUSD', 'Or (XAU/USD)');

        // 3. Argent (XAG/USD)
        this.createAdvancedChart('tradingview-eurusd', 'OANDA:XAGUSD', 'Argent (XAG/USD)');

        // 4. Cuivre
        this.createAdvancedChart('tradingview-copper', 'OANDA:XCUUSD', 'Cuivre (XCU/USD)');

        // 5. Platine (XPT/USD)
        this.createAdvancedChart('tradingview-silver', 'OANDA:XPTUSD', 'Platine (XPT/USD)');

        // 6. EUR/USD
        this.createAdvancedChart('tradingview-nasdaq', 'FX:EURUSD', 'EUR / USD');

        // 7. NASDAQ
        this.createAdvancedChart('tradingview-sp500', 'PEPPERSTONE:NAS100', 'NASDAQ 100');

        // 8. S&P 500
        this.createAdvancedChart('tradingview-platinum', 'FOREXCOM:SPXUSD', 'S&P 500');

        // 9. Google (GOOGL)
        this.createAdvancedChart('tradingview-google', 'NASDAQ:GOOGL', 'Google (Alphabet)');

        // 10. Pétrole Brut (WTI)
        this.createAdvancedChart('tradingview-oil', 'TVC:USOIL', 'Pétrole Brut (WTI)');

        // 11. NVIDIA
        this.createAdvancedChart('tradingview-nvidia', 'NASDAQ:NVDA', 'NVIDIA');
    }

    /**
     * Create a single advanced chart widget
     */
    createAdvancedChart(containerId, symbol, title) {
        const container = document.getElementById(containerId);
        if (!container) return;

        new TradingView.widget({
            "width": "100%",
            "height": 600,
            "symbol": symbol,
            "interval": "D",
            "timezone": "Europe/Paris",
            "theme": this.theme,
            "style": "1",
            "locale": "fr",
            "toolbar_bg": "#f1f3f6",
            "enable_publishing": false,
            "withdateranges": true,
            "hide_side_toolbar": false,
            "allow_symbol_change": true,
            "save_image": false,
            "container_id": containerId,
            "studies": [
                "STD;SMA"
            ],
            "show_popup_button": true,
            "popup_width": "1000",
            "popup_height": "650"
        });
    }

    /**
     * Reload all widgets
     */
    reload() {
        console.log('🔄 Reloading Markets widgets...');

        // Clear containers
        const containers = [
            'tradingview-ticker-tape',
            'tradingview-gold',
            'tradingview-btc',
            'tradingview-eurusd',
            'tradingview-copper',
            'tradingview-silver',
            'tradingview-nasdaq',
            'tradingview-sp500',
            'tradingview-platinum',
            'tradingview-google',
            'tradingview-oil',
            'tradingview-nvidia'
        ];

        containers.forEach(id => {
            const container = document.getElementById(id);
            if (container) {
                container.innerHTML = '';
            }
        });

        // Reload
        this.widgetsLoaded = false;
        this.load();
    }
}

// Create singleton instance
const marketsModule = new MarketsModule();

// Make available globally
window.MarketsModule = marketsModule;

export default marketsModule;
