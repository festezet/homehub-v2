#!/usr/bin/env python3
"""
Migrate hardcoded internet links from internet.html to SQLite database.
Run once to populate the database.
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from services.internet_service import InternetService

DB_PATH = '/data/projects/homehub-v2/data/internet_links.db'

# Categories with their display info
CATEGORIES = [
    ('frequent-sites', 'Frequent uses', '&#x1f550;', 1),
    ('crypto', 'Crypto & Finance', '&#8383;', 2),
    ('news', 'Actualites', '&#x1f4f0;', 3),
    ('ai', 'Intelligence Artificielle', '&#x1f916;', 4),
    ('tools', 'Outils & Productivite', '&#x1f6e0;', 5),
    ('search', 'Moteurs de Recherche', '&#x1f50d;', 6),
    ('banks', 'Banques', '&#x1f3e6;', 7),
    ('weather', 'Day to Day', '&#x1f4c6;', 8),
    ('social', 'Reseaux Sociaux', '&#x1f465;', 9),
    ('music', 'Musique', '&#x1f3b5;', 10),
    ('real-estate', 'Immobilier', '&#x1f3e0;', 11),
    ('admin', 'Administratif', '&#x1f4cb;', 12),
    ('business', 'Entreprise', '&#x1f3e2;', 13),
    ('car', 'Voiture', '&#x1f697;', 14),
    ('leisure', 'Loisirs', '&#x1f3af;', 15),
    ('wind-energy', 'Eolien', '&#x1f300;', 16),
]

# All links extracted from internet.html
LINKS = [
    # Frequent uses
    ('YouTube', 'https://youtube.com', 'frequent-sites', 'YT', 1),
    ('GMail', 'https://mail.google.com/mail/?authuser=fabrice.estezet@gmail.com', 'frequent-sites', 'GM', 2),
    ('Claude AI', 'https://claude.ai/', 'frequent-sites', 'CL', 3),
    ('ChatGPT', 'https://chat.openai.com/', 'frequent-sites', 'GP', 4),
    ('Hostinger Mail', 'https://mail.hostinger.com/v2/mailboxes/INBOX', 'frequent-sites', 'HO', 5),
    ('LinkedIn', 'https://www.linkedin.com/', 'frequent-sites', 'LI', 6),

    # Crypto & Finance
    ('CoinGecko', 'https://www.coingecko.com/', 'crypto', 'CG', 1),
    ('CoinMarketcap', 'https://coinmarketcap.com/', 'crypto', 'CM', 2),
    ('Tradingview', 'https://fr.tradingview.com', 'crypto', 'TV', 3),
    ('Binance', 'https://www.binance.com/', 'crypto', 'BN', 4),
    ('KuCoin', 'https://www.kucoin.com/', 'crypto', 'KC', 5),
    ('Kraken', 'https://www.kraken.com/', 'crypto', 'KR', 6),

    # Actualites
    ('Les Echos', 'https://www.lesechos.fr/', 'news', 'LE', 1),
    ('Le Monde', 'https://www.lemonde.fr/', 'news', 'LM', 2),
    ('CNN', 'https://www.cnn.com/', 'news', 'CN', 3),
    ('Washington Post', 'https://www.washingtonpost.com/', 'news', 'WP', 4),
    ('BBC News', 'https://www.bbc.com/news', 'news', 'BBC', 5),
    ('France Info', 'https://www.franceinfo.fr/', 'news', 'FI', 6),

    # Intelligence Artificielle
    ('Mistral AI', 'https://chat.mistral.ai/chat', 'ai', 'MI', 1),
    ('ChatGPT', 'https://chatgpt.com/', 'ai', 'GP', 2),
    ('Claude AI', 'https://claude.ai/new', 'ai', 'CL', 3),
    ('Venice AI', 'https://venice.ai/chat', 'ai', 'VE', 4),
    ('Leonardo AI', 'https://leonardo.ai/', 'ai', 'LE', 5),
    ('Gemini Google', 'https://gemini.google.com/', 'ai', 'GE', 6),
    ('Runway', 'https://www.runway.ml/', 'ai', 'RU', 7),
    ('Civitai', 'https://civitai.com/', 'ai', 'CI', 8),

    # Outils & Productivite
    ('GitHub', 'https://github.com/', 'tools', 'GH', 1),
    ('Canva', 'https://www.canva.com/', 'tools', 'CV', 2),
    ('Amazon', 'https://www.amazon.com/', 'tools', 'AM', 3),
    ('Proton VPN', 'https://protonvpn.com/', 'tools', 'PV', 4),
    ('Hostinger', 'https://www.hostinger.fr/', 'tools', 'HO', 5),
    ('Leboncoin', 'https://www.leboncoin.fr/', 'tools', 'LB', 6),
    ('eBay', 'https://www.ebay.fr/', 'tools', 'EB', 7),
    ('SolarWeb', 'https://www.solarweb.com/', 'tools', 'SW', 8),
    ('Notion', 'https://www.notion.so/', 'tools', 'NO', 9),
    ('Microsoft 365', 'https://www.microsoft365.com/', 'tools', 'M3', 10),

    # Moteurs de Recherche
    ('Google', 'https://www.google.com/', 'search', 'G', 1),
    ('Qwant', 'https://www.qwant.fr/', 'search', 'Q', 2),

    # Banques
    ('Credit Cooperatif', 'https://www.credit-cooperatif.coop/particuliers/', 'banks', 'CC', 1),
    ('Fortuneo', 'https://www.fortuneo.fr/', 'banks', 'FO', 2),
    ('Monabanq', 'https://www.monabanq.com/', 'banks', 'MB', 3),
    ('Revolut', 'https://www.revolut.com/fr-FR/', 'banks', 'RE', 4),
    ('Trade Republic', 'https://traderepublic.com/fr-fr', 'banks', 'TR', 5),

    # Day to Day
    ('Meteo France', 'https://meteofrance.com/', 'weather', 'MF', 1),
    ('Info Route 05', 'https://www.inforoute05.fr/', 'weather', 'IR', 2),
    ('Google Maps', 'https://www.google.com/maps', 'weather', 'GM', 3),
    ('ShadowMap', 'https://app.shadowmap.org/', 'weather', 'SM', 4),

    # Reseaux Sociaux
    ('LinkedIn', 'https://www.linkedin.com/', 'social', 'LI', 1),
    ('Facebook', 'https://www.facebook.com/', 'social', 'FB', 2),

    # Musique
    ('Ultimate Guitar', 'https://www.ultimate-guitar.com/', 'music', 'UG', 1),
    ('Songsterr', 'https://www.songsterr.com/', 'music', 'SO', 2),
    ('Boite a Chansons', 'https://www.boiteachansons.net/', 'music', 'BC', 3),

    # Immobilier
    ('SeLoger', 'https://www.seloger.com/', 'real-estate', 'SL', 1),
    ('Queyras Immo', 'https://www.queyrasimmo.com/', 'real-estate', 'QU', 2),

    # Administratif
    ('France Travail', 'https://www.francetravail.fr/', 'admin', 'FT', 1),
    ('Ekwateur', 'https://www.ekwateur.fr/', 'admin', 'EK', 2),
    ('Dougs', 'https://www.dougs.fr/', 'admin', 'DG', 3),

    # Entreprise
    ('Infogreffe', 'https://www.infogreffe.fr/', 'business', 'IG', 1),
    ('Societe.com', 'https://www.societe.com/', 'business', 'SC', 2),
    ('URSSAF', 'https://www.urssaf.fr/', 'business', 'UR', 3),
    ('Impots', 'https://www.impots.gouv.fr/', 'business', 'IM', 4),

    # Voiture
    ('La Centrale', 'https://www.lacentrale.fr/', 'car', 'LC', 1),
    ('AutoScout24', 'https://www.autoscout24.fr/', 'car', 'AS', 2),
    ('Oscaro', 'https://www.oscaro.com/', 'car', 'OS', 3),
    ('ViaMichelin', 'https://www.viamichelin.fr/', 'car', 'VM', 4),

    # Loisirs
    ('AlloCine', 'https://www.allocine.fr/', 'leisure', 'AC', 1),
    ('Fnac', 'https://www.fnac.com/', 'leisure', 'FN', 2),
    ('Eventbrite', 'https://www.eventbrite.fr/', 'leisure', 'EB', 3),
    ('TripAdvisor', 'https://www.tripadvisor.fr/', 'leisure', 'TA', 4),

    # Eolien
    ('Windpower Monthly', 'https://www.windpowermonthly.com/', 'wind-energy', 'WP', 1),
    ('OffshoreWIND.biz', 'https://www.offshorewind.biz/', 'wind-energy', 'OW', 2),
    ('Recharge News', 'https://www.rechargenews.com/', 'wind-energy', 'RN', 3),
    ('North American Windpower', 'https://www.nawindpower.com/', 'wind-energy', 'NA', 4),
    ('4C Offshore', 'https://www.4coffshore.com/', 'wind-energy', '4C', 5),
    ('Wind Systems Magazine', 'https://www.windsystemsmag.com/', 'wind-energy', 'WS', 6),
]


def migrate():
    service = InternetService(DB_PATH)

    # Check if already migrated
    existing = service.get_link_count()
    if existing > 0:
        print(f"Database already has {existing} links. Skipping migration.")
        print("To force re-migration, delete the database first:")
        print(f"  rm {DB_PATH}")
        return

    # Create categories
    print("Creating categories...")
    for slug, name, icon, pos in CATEGORIES:
        service.create_category(slug, name, icon, pos)
    print(f"  {len(CATEGORIES)} categories created")

    # Create links
    print("Creating links...")
    for name, url, category, alt, pos in LINKS:
        service.create_link(name, url, category, favicon_alt=alt, position=pos)
    print(f"  {len(LINKS)} links created")

    print(f"\nMigration complete! Database: {DB_PATH}")


if __name__ == '__main__':
    migrate()
