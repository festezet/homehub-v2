#!/usr/bin/env python3
"""Generate PDF: Ennui & Inertie autistique — strategies basees sur la recherche."""

import weasyprint
import os

OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))
PDF_PATH = os.path.join(OUTPUT_DIR, "Ennui_Inertie_Autistique_Strategies.pdf")

# --- DATA (mirrored from autism.js getEnnuiData()) ---

INTRO = {
    "title": "Ennui & Inertie autistique",
    "desc": (
        "L'ennui autistique n'est pas un simple \"manque de motivation\" ou un d\u00e9soeuvrement passager. "
        "C'est un \u00e9tat neurologique qualitativement diff\u00e9rent de l'ennui neurotypique, souvent d\u00e9crit "
        "comme physiquement douloureux. Des recherches en neuroimagerie (Danckert et al., Journal of Boredom "
        "Studies, 2024) montrent que les zones c\u00e9r\u00e9brales associ\u00e9es \u00e0 la douleur \u2014 insula "
        "ant\u00e9rieure, cortex cingulaire ant\u00e9rieur \u2014 s'activent pendant l'ennui chez les personnes "
        "neurodivergentes. Trois m\u00e9canismes neurologiques se combinent : le monotropisme, l'inertie "
        "autistique, et une dysr\u00e9gulation dopaminergique. Les approches ci-dessous sont valid\u00e9es par "
        "la recherche scientifique (Buckle 2021, Rapaport 2024, Heasman 2024) et par le v\u00e9cu de la "
        "communaut\u00e9 autiste."
    )
}

CATEGORIES = [
    {
        "title": "Comprendre le m\u00e9canisme",
        "icon": "\U0001f9e0",
        "color": "#818cf8",
        "strategies": [
            {"name": "Monotropisme", "source": "Murray, Lawson & Lesser 2005 ; Dwyer et al. 2024", "tag": "th\u00e9orie",
             "desc": "Le cerveau autistique concentre son attention de mani\u00e8re intense sur un nombre restreint de sujets \u00e0 la fois. Contrairement au fonctionnement \u00abpolytropique\u00bb neurotypique o\u00f9 l'attention se r\u00e9partit facilement, l'attention autistique fonctionne comme un projecteur puissant mais \u00e9troit. Quand un tunnel attentionnel est actif, l'engagement est total. Mais quand AUCUN tunnel n'est actif, le r\u00e9sultat est un vide attentionnel profond\u00e9ment inconfortable, presque douloureux."},
            {"name": "Inertie autistique", "source": "Buckle et al. 2021, Frontiers in Psychology", "tag": "th\u00e9orie",
             "desc": "Ph\u00e9nom\u00e8ne neurologique distinct de la procrastination. L'\u00e9tude fondatrice de Buckle et al. (2021) identifie deux p\u00f4les : l'inertie au repos (impossibilit\u00e9 de D\u00c9MARRER une action m\u00eame quand on veut) et l'inertie en mouvement (impossibilit\u00e9 de S'ARR\u00caTER une fois lanc\u00e9). Le facteur le plus efficace pour la d\u00e9bloquer est l'intervention externe."},
            {"name": "Interoc\u00e9ption alt\u00e9r\u00e9e", "source": "Trudel & Danckert 2024 ; Goodall 2019", "tag": "th\u00e9orie",
             "desc": "La capacit\u00e9 \u00e0 percevoir les signaux internes du corps est alt\u00e9r\u00e9e chez beaucoup de personnes autistes. Ce qu'on vit comme \u00abje m'ennuie\u00bb est souvent un signal interoc\u00e9ptif mal d\u00e9cod\u00e9 \u2014 faim, d\u00e9shydratation, fatigue, ou besoin sensoriel non satisfait."},
            {"name": "\u00abJe vis dans les extr\u00eames\u00bb", "source": "Rapaport et al. 2024, Autism", "tag": "v\u00e9cu",
             "desc": "Les participants ne vivent pas l'ennui comme un \u00e9tat interm\u00e9diaire mais comme un p\u00f4le extr\u00eame, oppos\u00e9 au flow total. Soit le cerveau est compl\u00e8tement absorb\u00e9, soit il est compl\u00e8tement \u00e9teint. Les strat\u00e9gies doivent viser \u00e0 ALLUMER le projecteur."},
        ]
    },
    {
        "title": "Surmonter le monotropisme",
        "icon": "\U0001f52e",
        "color": "#a78bfa",
        "strategies": [
            {"name": "Tunnels, pas t\u00e2ches", "source": "Jamie Knight, Monotropism.org", "tag": "outil",
             "desc": "Organiser sa journ\u00e9e en \u00abtunnels\u00bb th\u00e9matiques (blocs d'immersion dans un seul flux) au lieu de \u00abt\u00e2ches\u00bb qui pr\u00e9supposent la capacit\u00e9 \u00e0 switcher entre sujets. Regrouper les activit\u00e9s par th\u00e8me minimise les transitions co\u00fbteuses."},
            {"name": "R\u00e9duire la complexit\u00e9 simultan\u00e9e", "source": "Murray, Lawson & Lesser 2005", "tag": "outil",
             "desc": "Le multitasking est neurologiquement incompatible avec le cerveau monotropique. R\u00e9duire syst\u00e9matiquement les stimuli pendant les t\u00e2ches exigeantes : un seul \u00e9cran, notifications d\u00e9sactiv\u00e9es, bruit blanc."},
            {"name": "Inventaire d'int\u00e9r\u00eats et amor\u00e7age", "source": "Fergus Murray, Monotropism.org ; Murray et al. 2005", "tag": "outil",
             "desc": "Maintenir un inventaire visible de ses int\u00e9r\u00eats actifs et \u00abamorcer\u00bb l'environnement : livre ouvert, projet visible sur l'\u00e9cran, instrument sorti de son \u00e9tui. Le cerveau monotropique a besoin d'un point d'accroche pour \u00aballumer\u00bb le tunnel."},
            {"name": "Rampes de transition", "source": "Dwyer et al. 2024 ; Life Skills Advocate", "tag": "outil",
             "desc": "Alertes avanc\u00e9es (15/10/5 min), rituels de transition (micro-activit\u00e9 de 2-3 min comme sas), instructions s\u00e9quentielles. Le co\u00fbt d'une transition non pr\u00e9par\u00e9e est souvent un shutdown."},
            {"name": "Exploiter le flow comme force", "source": "Heasman et al. 2024 ; Mantzalas et al. 2022", "tag": "int\u00e9r\u00eat",
             "desc": "Le monotropisme est aussi la source d'une capacit\u00e9 unique \u00e0 atteindre des \u00e9tats de flow profonds. Identifier ses d\u00e9clencheurs de flow, prot\u00e9ger les p\u00e9riodes de flow, pr\u00e9server l'acc\u00e8s aux int\u00e9r\u00eats sp\u00e9ciaux m\u00eame sous pression."},
            {"name": "Simplifier pour conserver l'\u00e9nergie", "source": "Jamie Knight ; Murray et al. 2005", "tag": "environnement",
             "desc": "Automatiser tout ce qui peut l'\u00eatre (m\u00eames repas, m\u00eames v\u00eatements, m\u00eames trajets). Chaque d\u00e9cision \u00e9limin\u00e9e lib\u00e8re de l'attention pour le tunnel actif."},
        ]
    },
    {
        "title": "Surmonter l'inertie",
        "icon": "\u26a1",
        "color": "#f59e0b",
        "strategies": [
            {"name": "Body doubling (strat\u00e9gie #1)", "source": "Buckle et al. 2021, Frontiers in Psychology", "tag": "outil",
             "desc": "L'intervention externe est le facteur le plus efficace contre l'inertie. La simple pr\u00e9sence d'une autre personne fournit un \u00abancrage externe\u00bb par co-r\u00e9gulation du syst\u00e8me nerveux. Formes : en personne, virtuel (Focusmate, Discord), ou passif (livestreams)."},
            {"name": "\u00abStuck buddy\u00bb \u2014 support par texto", "source": "Buckle et al. 2021, Frontiers in Psychology", "tag": "outil",
             "desc": "Variante pour les moments seuls. Un ami accepte d'\u00eatre disponible par texto avec des micro-instructions (\u00abest-ce que tu peux bouger un doigt?\u00bb). \u00c9tablir l'accord AVANT les crises avec une phrase code convenue."},
            {"name": "Micro-step self-talk", "source": "Buckle et al. 2021, Frontiers in Psychology", "tag": "corps",
             "desc": "Se donner \u00e0 voix haute des instructions ultra-fines, une \u00e0 la fois. \u00abBouge le petit doigt.\u00bb \u00abMaintenant la main.\u00bb La verbalisation utilise le canal auditif pour contourner le blocage du canal moteur."},
            {"name": "Barri\u00e8res environnementales strat\u00e9giques", "source": "Buckle et al. 2021, Frontiers in Psychology", "tag": "environnement",
             "desc": "Contre l'inertie de mouvement : installer des barri\u00e8res physiques (t\u00e9l\u00e9phone dans une autre pi\u00e8ce, bloqueurs d'apps). Contre l'inertie au repos : \u00e9liminer toutes les barri\u00e8res (mat\u00e9riel pr\u00eat, livre ouvert). L'inertie suit le chemin de moindre r\u00e9sistance."},
            {"name": "Cha\u00eenes d'activit\u00e9 continues", "source": "Buckle et al. 2021, Frontiers in Psychology", "tag": "corps",
             "desc": "Ne jamais \u00abs'arr\u00eater\u00bb compl\u00e8tement entre deux activit\u00e9s. Encha\u00eener directement. La pause entre deux activit\u00e9s est le moment o\u00f9 l'inertie au repos capture."},
            {"name": "Protocole d'ignition 7 minutes", "source": "Carmen ADHD ; Rapaport et al. 2024", "tag": "outil",
             "desc": "\u00abJe fais \u00e7a pendant 7 minutes seulement.\u00bb La friction d'initiation est le vrai obstacle. La permission d'arr\u00eater d\u00e9sactive l'anxi\u00e9t\u00e9 de l'engagement infini."},
            {"name": "Lieux publics vs priv\u00e9", "source": "Rapaport et al. 2024, Autism", "tag": "environnement",
             "desc": "L'inertie est plus faible dans les espaces publics (biblioth\u00e8que, caf\u00e9, coworking) : pression sociale l\u00e9g\u00e8re, d\u00e9placement comme starter step, stimulation de fond r\u00e9guli\u00e8re."},
            {"name": "Prompts externes consentis", "source": "Buckle et al. 2021, Frontiers in Psychology", "tag": "outil",
             "desc": "Convenir \u00e0 l'avance avec un proche de phrases et moments sp\u00e9cifiques. Exemples qui marchent : \u00abC'est l'heure qu'on avait pr\u00e9vue\u00bb (factuel). Exemples qui NE marchent PAS : \u00abT'as pass\u00e9 toute la journ\u00e9e \u00e0 rien faire\u00bb (culpabilisant)."},
        ]
    },
    {
        "title": "Strat\u00e9gies corporelles",
        "icon": "\U0001f9d8",
        "color": "#34d399",
        "strategies": [
            {"name": "Body scan (5 min)", "source": "Bien-\u00eatre Autiste ; Reframing Autism", "tag": "corps",
             "desc": "Parcourir syst\u00e9matiquement chaque partie du corps en notant les sensations. V\u00e9rifier : soif, faim, v\u00eatements, m\u00e2choire crisp\u00e9e, temp\u00e9rature. L'\u00abennui\u00bb est fr\u00e9quemment un besoin physiologique non identifi\u00e9."},
            {"name": "Heavy work / pression profonde", "source": "The Autistic Burnout ; clinique OT", "tag": "corps",
             "desc": "Input proprioceptif profond : pousser les mains contre un mur, compressions articulaires, couverture lest\u00e9e. Active le parasympathique et contre l'\u00e9tat de figement. Ne n\u00e9cessite aucune d\u00e9cision cognitive."},
            {"name": "Suivi du rythme cardiaque", "source": "Bien-\u00eatre Autiste ; Autism Level UP", "tag": "corps",
             "desc": "Poser la main sur la poitrine et sentir les battements pendant 60 secondes. Exercice d'interoc\u00e9ption qui am\u00e9liore la capacit\u00e9 \u00e0 d\u00e9coder les signaux internes."},
            {"name": "Mouvement conscient", "source": "Reframing Autism ; Life Skills Advocate", "tag": "corps",
             "desc": "Yoga, tai chi, marche lente, \u00e9tirements. Le mouvement change l'\u00e9tat physiologique avant de solliciter le cerveau. Technique des micro-mouvements : un seul doigt, puis une main, puis un bras."},
            {"name": "Respiration ventrale", "source": "Autism of PA ; clinique OT", "tag": "corps",
             "desc": "Inspirer 4 temps (ventre), expirer 6 temps (bouche). 3 minutes. L'expiration plus longue d\u00e9clenche la r\u00e9ponse parasympathique. Fait basculer du figement vers le calme actif."},
        ]
    },
    {
        "title": "Int\u00e9r\u00eats sp\u00e9ciaux comme levier",
        "icon": "\u2b50",
        "color": "#fbbf24",
        "strategies": [
            {"name": "Explorer une nouvelle facette", "source": "Heasman et al. 2024 ; Reframing Autism", "tag": "int\u00e9r\u00eat",
             "desc": "Quand un int\u00e9r\u00eat sp\u00e9cial sature, explorer un angle inexplor\u00e9 : passer de \u00abregarder\u00bb \u00e0 \u00abcr\u00e9er\u00bb, de la pratique \u00e0 l'histoire. On redirige le tunnel existant vers un angle qui relance la dopamine."},
            {"name": "Micro-immersion (10 min)", "source": "Asperger Experts ; communaut\u00e9 autiste", "tag": "int\u00e9r\u00eat",
             "desc": "10 minutes d'int\u00e9r\u00eat sp\u00e9cial comme rampe de lancement avant une t\u00e2che moins motivante. Strat\u00e9gie d\u00e9lib\u00e9r\u00e9e de pr\u00e9-activation dopaminergique, pas de la procrastination."},
            {"name": "Int\u00e9grer l'IS dans le quotidien", "source": "Learn Play Thrive ; communaut\u00e9 autiste", "tag": "int\u00e9r\u00eat",
             "desc": "Cr\u00e9er un pont entre activit\u00e9 ennuyeuse et domaine d'int\u00e9r\u00eat : finances en tableur \u00e9labor\u00e9, m\u00e9nage en \u00e9coutant un podcast sur l'IS, rangement par couleur si IS = design."},
            {"name": "Flow mapping", "source": "Heasman et al. 2024 ; Wain et al. 2026", "tag": "int\u00e9r\u00eat",
             "desc": "Lister les 3-5 activit\u00e9s qui d\u00e9clenchent le flow. Les garder physiquement accessibles. Consulter la liste quand l'ennui frappe au lieu de chercher (chercher = friction = inertie)."},
        ]
    },
    {
        "title": "Outils & structure",
        "icon": "\U0001f6e0\ufe0f",
        "color": "#60a5fa",
        "strategies": [
            {"name": "Body doubling (virtuel)", "source": "Buckle et al. 2021 ; NeuronNav", "tag": "outil",
             "url": "https://focusmate.com",
             "desc": "Travailler \u00e0 c\u00f4t\u00e9 de quelqu'un, m\u00eame silencieusement. Plateformes : Focusmate (sessions 25/50/75 min), Flown, Discord. La pr\u00e9sence r\u00e9gule le syst\u00e8me nerveux par co-r\u00e9gulation."},
            {"name": "Tiimo (app)", "source": "Tiimo ; clinique OT ; TEACCH", "tag": "outil",
             "url": "https://tiimo.dk",
             "desc": "Planificateur visuel pour neurodivergents. Timelines avec codes couleur, rappels doux, templates de routines. iPhone App of the Year 2025. Rend le temps concret au lieu d'abstrait."},
            {"name": "Goblin Tools", "source": "Goblin Tools ; communaut\u00e9 ND", "tag": "outil",
             "url": "https://goblin.tools",
             "desc": "Suite IA cr\u00e9\u00e9e par un d\u00e9veloppeur autiste. \u00abMagic ToDo\u00bb d\u00e9compose automatiquement les t\u00e2ches en micro-\u00e9tapes avec estimation de difficult\u00e9."},
            {"name": "Alarmes ext\u00e9rieures", "source": "The Autistic Burnout ; Buckle 2021", "tag": "outil",
             "desc": "Externaliser les rappels que le corps ne fournit pas : manger (3-4h), boire (1h), bouger (45 min). Combiner avec un starter step pr\u00e9-pr\u00e9par\u00e9 (verre d'eau d\u00e9j\u00e0 sur le bureau)."},
            {"name": "D\u00e9composer la premi\u00e8re \u00e9tape", "source": "Life Skills Advocate ; Buckle 2021", "tag": "outil",
             "desc": "La premi\u00e8re action doit \u00eatre faisable en 30-120 secondes. Pas \u00abtravailler sur le projet\u00bb mais \u00abouvrir le fichier\u00bb. Pas \u00abranger\u00bb mais \u00abposer le stylo sur le bureau\u00bb."},
            {"name": "Task stacking", "source": "Buckle et al. 2021 ; communaut\u00e9 ADHD/autiste", "tag": "outil",
             "desc": "Combiner t\u00e2che ennuyeuse + activit\u00e9 r\u00e9gulatrice qui fournit la dopamine : lessive + podcast, m\u00e9nage + musique BPM, emails + chewing-gum. \u00abEteins la musique et concentre-toi\u00bb est contre-productif."},
            {"name": "Menu dopamine", "source": "ADDitude Magazine ; communaut\u00e9 ADHD/autiste", "tag": "outil",
             "desc": "Liste pr\u00e9par\u00e9e d'activit\u00e9s class\u00e9es par intensit\u00e9 : Entr\u00e9es (<5 min), Accompagnements (combinables), Plats (15-60 min), Desserts (plaisir pur), Sp\u00e9cials (planification). Si TOUT semble ennuyeux, commencer par le corporel."},
        ]
    },
    {
        "title": "Environnement",
        "icon": "\U0001f3e0",
        "color": "#2dd4bf",
        "strategies": [
            {"name": "Zone low-demand", "source": "The Autistic Burnout ; clinique OT", "tag": "environnement",
             "desc": "Espace d\u00e9di\u00e9 \u00e0 la r\u00e9cup\u00e9ration : textures douces, lumi\u00e8re tamis\u00e9e, ZERO attentes. Inclure outils de stimming, fidgets, couverture lest\u00e9e, casque anti-bruit."},
            {"name": "R\u00e9duire la friction sensorielle", "source": "Sensory diet OT ; communaut\u00e9 autiste", "tag": "environnement",
             "desc": "Lumi\u00e8re : lampes chaudes, variateurs. Son : bouchons Loop, casque ANC, bruit blanc. V\u00eatements : \u00e9liminer \u00e9tiquettes, coutures, synth\u00e9tiques. Espace : d\u00e9sencombrer le champ visuel."},
            {"name": "Routines-ancres", "source": "Autisme Info Service ; clinique adapt\u00e9e", "tag": "environnement",
             "desc": "2-3 routines fixes (matin/apr\u00e8s-midi/soir) souples avec zones de choix int\u00e9gr\u00e9es. Eliminient la friction de d\u00e9cision tout en pr\u00e9servant l'autonomie."},
            {"name": "Stimming autoris\u00e9", "source": "Autistic Scholar ; \u00e9tude sur 31 adultes", "tag": "environnement",
             "desc": "Fidgets tactiles, stimming auditif, vestibulaire, oral. Supprimer le stimming AUGMENTE l'inertie et la surcharge. S'autoriser \u00e0 stimmer librement est th\u00e9rapeutique."},
            {"name": "Reset corporel (eau froide)", "source": "Danckert et al. 2024 ; clinique OT", "tag": "corps",
             "desc": "Eau froide sur poignets/visage 30 secondes. Active le nerf vague (dive reflex), interrompt le figement physiquement sans d\u00e9cision cognitive. Alternatives : menthe forte, th\u00e9 br\u00fblant."},
        ]
    },
    {
        "title": "Ce qui NE marche PAS",
        "icon": "\U0001f6ab",
        "color": "#f87171",
        "strategies": [
            {"name": "\u00abMotive-toi\u00bb", "source": "Asperger Experts ; recherche sur la motivation", "tag": "pi\u00e8ge",
             "desc": "Le syst\u00e8me de motivation autistique est \u00abinterest-based\u00bb, pas \u00abimportance-based\u00bb. On ne peut pas cr\u00e9er de motivation pour une t\u00e2che qui n'active pas les circuits d'int\u00e9r\u00eat. C'est comme dire \u00abvois mieux\u00bb \u00e0 une personne myope."},
            {"name": "R\u00e9compenses externes", "source": "Learn Play Thrive ; Asperger Experts", "tag": "pi\u00e8ge",
             "desc": "Les r\u00e9compenses externes peuvent R\u00c9DUIRE la motivation intrins\u00e8que. La promesse future ne fournit pas la dopamine MAINTENANT. Mieux : rendre la t\u00e2che elle-m\u00eame plus stimulante."},
            {"name": "Forcer le d\u00e9marrage", "source": "Buckle et al. 2021, Frontiers in Psychology", "tag": "pi\u00e8ge",
             "desc": "L'inertie n'est PAS de la paresse. Forcer augmente le stress, aggrave le shutdown, \u00e9puise les r\u00e9serves. Mieux : changer l'environnement, offrir un body doubling, ou attendre un moment plus propice."},
            {"name": "Techniques NT standards", "source": "communaut\u00e9 autiste ; Carmen ADHD", "tag": "pi\u00e8ge",
             "desc": "Pomodoro, GTD, to-do lists pr\u00e9supposent que l'initiation est facile. Le Pomodoro impose des interruptions qui brisent le flow. Ces techniques n\u00e9cessitent adaptation (dur\u00e9es flexibles, d\u00e9composition ultra-fine, body doubling)."},
            {"name": "Ignorer le burnout", "source": "The Autistic Burnout ; communaut\u00e9 autiste", "tag": "pi\u00e8ge",
             "desc": "L'ennui chronique (RIEN ne motive, m\u00eame les IS, pendant des semaines) peut \u00eatre un burnout autistique. Signes : perte d'int\u00e9r\u00eat pour les IS, r\u00e9gression des comp\u00e9tences, fatigue qui ne s'am\u00e9liore pas. R\u00e9duire les demandes, consulter un pro inform\u00e9 sur l'autisme."},
        ]
    },
]

RESOURCES = [
    {"name": "Monotropism.org", "url": "https://monotropism.org", "desc": "Th\u00e9orie du monotropisme de Murray, Lawson et Lesser"},
    {"name": "The Autistic Burnout (Substack)", "url": "https://theautisticburnout.substack.com/p/the-diy-sensory-diet-for-autistic", "desc": "Guide DIY r\u00e9gime sensoriel adulte autiste"},
    {"name": "Focusmate", "url": "https://focusmate.com", "desc": "Body doubling virtuel (sessions 25/50/75 min)"},
    {"name": "Boredom Lab (Waterloo)", "url": "https://uwaterloo.ca/boredom-lab/", "desc": "Recherche neurocognitive sur l'ennui (Danckert)"},
    {"name": "Autism Level UP", "url": "https://autismlevelup.com/interoception/", "desc": "Ressources interoc\u00e9ption adapt\u00e9es"},
    {"name": "Asperger Experts", "url": "https://www.aspergerexperts.com/topics/motivation/", "desc": "Motivation interest-based vs importance-based"},
    {"name": "Thrive Autism Coaching", "url": "https://www.thriveautismcoaching.com/post/autism-and-motivation", "desc": "Guide pratique motivation et inertie"},
    {"name": "Goblin Tools", "url": "https://goblin.tools", "desc": "Suite IA pour dysfonction ex\u00e9cutive"},
    {"name": "Bien-\u00eatre Autiste (FR)", "url": "https://bienetreautiste.com", "desc": "Blog francophone interoc\u00e9ption et sensorialit\u00e9"},
    {"name": "Autisme Mont\u00e9r\u00e9gie (FR)", "url": "https://autismemonteregie.com", "desc": "Strat\u00e9gies propos\u00e9es par des adultes autistes"},
    {"name": "Time Timer", "url": "https://www.timetimer.com", "desc": "Timer visuel pour interoc\u00e9ption temporelle"},
]

TAG_COLORS = {
    "th\u00e9orie": ("#818cf8", "#1e1b4b"),
    "v\u00e9cu": ("#c084fc", "#3b0764"),
    "corps": ("#34d399", "#064e3b"),
    "int\u00e9r\u00eat": ("#fbbf24", "#78350f"),
    "outil": ("#60a5fa", "#1e3a5f"),
    "environnement": ("#2dd4bf", "#134e4a"),
    "pi\u00e8ge": ("#f87171", "#7f1d1d"),
    "env": ("#2dd4bf", "#134e4a"),
}


def build_html():
    """Build the HTML content for the PDF."""
    tag_badges = ""
    for tag, (bg, text) in TAG_COLORS.items():
        tag_badges += f'.tag-{tag.replace("é","e").replace("è","e").replace("ê","e")} {{ background: {bg}20; color: {bg}; border: 1px solid {bg}40; }}\n'

    html_parts = [f"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<style>
@page {{
    size: A4;
    margin: 20mm 18mm 20mm 18mm;
    @bottom-center {{
        content: counter(page) " / " counter(pages);
        font-size: 9px;
        color: #666;
    }}
}}
body {{
    font-family: 'DejaVu Sans', 'Noto Sans', sans-serif;
    font-size: 10.5pt;
    line-height: 1.55;
    color: #1a1a2e;
}}
h1 {{
    font-size: 22pt;
    color: #312e81;
    margin-bottom: 5px;
    text-align: center;
}}
.subtitle {{
    text-align: center;
    color: #6b7280;
    font-size: 9pt;
    margin-bottom: 20px;
}}
.intro-box {{
    background: #f0f0ff;
    border-left: 4px solid #818cf8;
    padding: 12px 16px;
    margin-bottom: 25px;
    border-radius: 0 8px 8px 0;
    font-size: 10pt;
    line-height: 1.6;
}}
h2 {{
    font-size: 15pt;
    color: #312e81;
    border-bottom: 2px solid #e5e7eb;
    padding-bottom: 4px;
    margin-top: 22px;
    margin-bottom: 10px;
    page-break-after: avoid;
}}
.category-icon {{
    font-size: 14pt;
    margin-right: 6px;
}}
.strategy {{
    margin-bottom: 12px;
    padding: 10px 14px;
    background: #fafafa;
    border-radius: 8px;
    border: 1px solid #e5e7eb;
    page-break-inside: avoid;
}}
.strategy-header {{
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 5px;
}}
.strategy-name {{
    font-weight: 700;
    font-size: 11pt;
    color: #1e1b4b;
}}
.tag {{
    font-size: 7.5pt;
    padding: 2px 7px;
    border-radius: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}}
{tag_badges}
.strategy-desc {{
    font-size: 10pt;
    color: #374151;
    line-height: 1.55;
}}
.strategy-source {{
    font-size: 8.5pt;
    color: #6b7280;
    margin-top: 4px;
    font-style: italic;
}}
.strategy-url {{
    font-size: 8.5pt;
    color: #818cf8;
    margin-top: 2px;
}}
h3 {{
    font-size: 13pt;
    color: #312e81;
    margin-top: 20px;
    margin-bottom: 8px;
}}
.resource {{
    margin-bottom: 8px;
    padding: 6px 12px;
    background: #f8fafc;
    border-radius: 6px;
    border: 1px solid #e2e8f0;
    page-break-inside: avoid;
}}
.resource-name {{
    font-weight: 700;
    font-size: 10pt;
    color: #1e1b4b;
}}
.resource-url {{
    font-size: 8.5pt;
    color: #818cf8;
}}
.resource-desc {{
    font-size: 9.5pt;
    color: #4b5563;
}}
.toc {{
    margin-bottom: 20px;
    padding: 12px 16px;
    background: #fafafa;
    border-radius: 8px;
    border: 1px solid #e5e7eb;
}}
.toc-title {{
    font-weight: 700;
    font-size: 11pt;
    color: #312e81;
    margin-bottom: 6px;
}}
.toc-item {{
    font-size: 10pt;
    color: #374151;
    padding: 2px 0;
}}
.toc-count {{
    color: #9ca3af;
    font-size: 9pt;
}}
</style>
</head>
<body>
<h1>Ennui & Inertie autistique</h1>
<p class="subtitle">Strat\u00e9gies valid\u00e9es par la recherche scientifique &mdash; Avril 2026</p>

<div class="intro-box">{INTRO['desc']}</div>

<div class="toc">
<div class="toc-title">Sommaire</div>
"""]

    # Table of contents
    for cat in CATEGORIES:
        n = len(cat["strategies"])
        html_parts.append(f'<div class="toc-item">{cat["icon"]} {cat["title"]} <span class="toc-count">({n} strat\u00e9gies)</span></div>')
    html_parts.append(f'<div class="toc-item">\U0001f517 Ressources <span class="toc-count">({len(RESOURCES)} liens)</span></div>')
    html_parts.append('</div>')

    # Categories
    for cat in CATEGORIES:
        html_parts.append(f'<h2><span class="category-icon">{cat["icon"]}</span> {cat["title"]}</h2>')
        for s in cat["strategies"]:
            tag = s.get("tag", "")
            tag_cls = f"tag-{tag.replace('é','e').replace('è','e').replace('ê','e')}"
            tag_label = tag.capitalize()
            url_line = ""
            if s.get("url"):
                url_line = f'<div class="strategy-url">\U0001f517 {s["url"]}</div>'
            html_parts.append(f"""<div class="strategy">
<div class="strategy-header">
    <span class="strategy-name">{s['name']}</span>
    <span class="tag {tag_cls}">{tag_label}</span>
</div>
<div class="strategy-desc">{s['desc']}</div>
<div class="strategy-source">{s['source']}</div>
{url_line}
</div>""")

    # Resources
    html_parts.append('<h3>\U0001f517 Ressources</h3>')
    for r in RESOURCES:
        html_parts.append(f"""<div class="resource">
<span class="resource-name">{r['name']}</span>
<span class="resource-url"> \u2014 {r['url']}</span>
<div class="resource-desc">{r['desc']}</div>
</div>""")

    html_parts.append('</body></html>')
    return '\n'.join(html_parts)


def main():
    print(f"Generating PDF...")
    html = build_html()
    doc = weasyprint.HTML(string=html)
    doc.write_pdf(PDF_PATH)
    print(f"PDF saved: {PDF_PATH}")


if __name__ == "__main__":
    main()
