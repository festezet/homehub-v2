/**
 * Autism Companion Module - Ressources, Specialistes, Livres, Publications, Web
 * Data sourced from research_references.md (2026-04-08)
 */

class AutismModule {
    constructor() {
        this.activeTab = 'ressources';
        this.loaded = false;
        this.reviews = {};
        this._currentReviewId = null;
        this._wrapCounter = 0;
    }

    // --- Review helpers ---

    _slugify(text) {
        return text
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '')
            .substring(0, 60);
    }

    _loadReviews() {
        try {
            const stored = localStorage.getItem('autism-reviews');
            this.reviews = stored ? JSON.parse(stored) : {};
        } catch {
            this.reviews = {};
        }
    }

    _saveReview(id, status, comment) {
        if (!this.reviews[id]) this.reviews[id] = {};
        if (status !== undefined) this.reviews[id].status = status;
        if (comment !== undefined) this.reviews[id].comment = comment;
        try {
            localStorage.setItem('autism-reviews', JSON.stringify(this.reviews));
            this._showSaveFlash();
        } catch (e) { console.error('Failed to save review:', e); }
    }

    _showSaveFlash() {
        let flash = document.getElementById('autism-save-flash');
        if (!flash) {
            flash = document.createElement('div');
            flash.id = 'autism-save-flash';
            flash.className = 'autism-save-flash';
            document.body.appendChild(flash);
        }
        flash.textContent = '\u2713 Enregistre';
        flash.classList.remove('visible');
        // Force reflow to restart animation
        void flash.offsetWidth;
        flash.classList.add('visible');
    }

    _getReview(id) {
        return this.reviews[id] || null;
    }

    _wrapWithReview(entryId, innerHTML) {
        const review = this._getReview(entryId);
        const st = review?.status;
        const hasComment = review?.comment ? ' has-comment' : '';
        const commentText = review?.comment || '';
        const radioName = `rev-${this._wrapCounter++}`;
        return `<div class="autism-review-entry" data-review-id="${entryId}">
            <div class="autism-review-controls">
                <label class="autism-radio ok${st === 'ok' ? ' selected' : ''}">
                    <input type="radio" name="${radioName}" value="ok"${st === 'ok' ? ' checked' : ''}> \u2713</label>
                <label class="autism-radio nok${st === 'nok' ? ' selected' : ''}">
                    <input type="radio" name="${radioName}" value="nok"${st === 'nok' ? ' checked' : ''}> \u2717</label>
                <label class="autism-radio idk${st === 'idk' ? ' selected' : ''}">
                    <input type="radio" name="${radioName}" value="idk"${st === 'idk' ? ' checked' : ''}> ?</label>
                <button class="autism-comment-btn${hasComment}" data-review-id="${entryId}">\u{1F4AC}</button>
            </div>
            <div class="autism-review-body">
                <div class="autism-review-content">${innerHTML}</div>
                <div class="autism-inline-comment" style="display:none">
                    <textarea class="autism-inline-textarea" rows="2" placeholder="Commentaire...">${commentText}</textarea>
                </div>
            </div>
        </div>`;
    }

    _toggleComment(entryId) {
        const entry = document.querySelector(`.autism-review-entry[data-review-id="${entryId}"]`);
        if (!entry) return;
        const box = entry.querySelector('.autism-inline-comment');
        if (!box) return;
        const visible = box.style.display !== 'none';
        if (visible) {
            // Save on close
            const textarea = box.querySelector('textarea');
            const comment = textarea ? textarea.value.trim() : '';
            this._saveReview(entryId, undefined, comment);
            const btn = entry.querySelector('.autism-comment-btn');
            if (btn) btn.classList.toggle('has-comment', !!comment);
            box.style.display = 'none';
        } else {
            box.style.display = 'block';
            const textarea = box.querySelector('textarea');
            if (textarea) textarea.focus();
        }
    }

    _setupEventDelegation() {
        const container = document.querySelector('.autism-container');
        if (!container) return;

        // Use click instead of change to support toggle-off (deselect)
        container.addEventListener('click', (e) => {
            // Comment button click
            const btn = e.target.closest('.autism-comment-btn');
            if (btn) {
                e.preventDefault();
                e.stopPropagation();
                this._toggleComment(btn.dataset.reviewId);
                return;
            }
            // Radio toggle with deselect support
            const label = e.target.closest('.autism-radio');
            if (label) {
                e.preventDefault();
                e.stopPropagation();
                const input = label.querySelector('input');
                const entry = label.closest('.autism-review-entry');
                if (!input || !entry) return;
                const id = entry.dataset.reviewId;
                if (!id) return;
                const wasSelected = label.classList.contains('selected');
                // Deselect all radios in this entry
                entry.querySelectorAll('.autism-radio').forEach(lbl => {
                    lbl.classList.remove('selected');
                    const inp = lbl.querySelector('input');
                    if (inp) inp.checked = false;
                });
                if (wasSelected) {
                    // Toggle off — clear status
                    this._saveReview(id, '', undefined);
                } else {
                    // Select this one
                    label.classList.add('selected');
                    input.checked = true;
                    this._saveReview(id, input.value, undefined);
                }
                return;
            }
            // Prevent parent <a> from navigating when clicking controls
            const controls = e.target.closest('.autism-review-controls');
            if (controls) {
                e.stopPropagation();
            }
        });

        // Save comment on blur (mouse/focus leaves textarea)
        container.addEventListener('focusout', (e) => {
            const textarea = e.target.closest('.autism-inline-textarea');
            if (!textarea) return;
            const entry = textarea.closest('.autism-review-entry');
            if (!entry) return;
            const id = entry.dataset.reviewId;
            if (!id) return;
            const comment = textarea.value.trim();
            this._saveReview(id, undefined, comment);
            const btn = entry.querySelector('.autism-comment-btn');
            if (btn) btn.classList.toggle('has-comment', !!comment);
        });
    }

    // --- Data: Ressources (existing + enriched) ---

    getRessourcesData() {
        return {
            formations: [
                {
                    icon: '\u{1F393}',
                    title: 'Nicolas Galita - Formations',
                    desc: 'Formations autisme sur Podia (acces partage par Julie)',
                    url: 'https://nicolasgalita.podia.com/products/home#index',
                    tag: 'formation'
                },
                {
                    icon: '\u{1F465}',
                    title: 'Le Coin des Autistes',
                    desc: 'Communaute gratuite sur Skool',
                    url: 'https://www.skool.com/le-coin-des-autistes/about',
                    tag: 'community'
                },
                {
                    icon: '\u{1F4EC}',
                    title: "L'Atelier Galita",
                    desc: 'Newsletter Substack de Nicolas Galita',
                    url: 'https://www.ateliergalita.com',
                    tag: 'newsletter'
                }
            ],

            articles: [
                {
                    icon: '\u{1F4F0}',
                    title: '7 corrections pour voir l\'autisme',
                    meta: 'Nicolas Galita \u2014 Substack',
                    url: 'https://open.substack.com/pub/nicolasgalita/p/7-corrections-pour-voir-lautisme',
                    date: '2025-03-24'
                },
                {
                    icon: '\u{1F4F0}',
                    title: "L'enfer de la lethargie",
                    meta: 'Nicolas Galita \u2014 Substack',
                    url: 'https://open.substack.com/pub/nicolasgalita/p/lenfer-de-la-lethargie-bienvenue',
                    date: '2026-02-26'
                },
                {
                    icon: '\u{1F4F0}',
                    title: 'Mes strategies anti-depression (ep.1)',
                    meta: 'Nicolas Galita \u2014 Substack',
                    url: 'https://open.substack.com/pub/nicolasgalita/p/mes-strategies-anti-depression',
                    date: '2024-09-09'
                },
                {
                    icon: '\u{1F4F0}',
                    title: 'Une mission par jour (ep.2)',
                    meta: 'Nicolas Galita \u2014 Substack',
                    url: 'https://open.substack.com/pub/nicolasgalita/p/une-mission-par-jour',
                    date: '2024-09-10'
                },
                {
                    icon: '\u{1F4AC}',
                    title: 'Parler d\'oppression systemique (autisme, TDAH)',
                    meta: 'Medium \u2014 Depenser Repenser',
                    url: 'https://medium.com/depenser-repenser/je-suis-blanc-je-peux-parler-de-racisme-4e1060adc247',
                    date: '2026-02-27'
                },
                {
                    icon: '\u{1F9E0}',
                    title: 'L\'interoception expliquee : le sens cache',
                    meta: 'Hop\'Toys \u2014 Guide pratique',
                    url: 'https://www.bloghoptoys.fr/linteroception-notre-8%E1%B5%89-sens',
                    date: ''
                },
                {
                    icon: '\u{1F9E0}',
                    title: 'Monotropisme : comprendre l\'attention autiste',
                    meta: 'Monotropism.org \u2014 Fergus Murray',
                    url: 'https://monotropism.org/explanations/',
                    date: ''
                },
                {
                    icon: '\u{1F9E0}',
                    title: 'Autistic inertia: an overview',
                    meta: 'Autism Level UP',
                    url: 'https://autisticinertia.com/',
                    date: ''
                }
            ],

            references: [
                {
                    icon: '\u{1F52C}',
                    title: 'Legende noire du HPI',
                    meta: 'Franck Ramus \u2014 Ramus-Meninges',
                    url: 'https://ramus-meninges.fr/2023/04/27/legende-noire-fin/',
                    date: ''
                },
                {
                    icon: '\u{1F4CA}',
                    title: 'Depression resource PDF (OMS)',
                    meta: 'Document PDF \u2014 strategies anti-depression',
                    url: 'https://d3mh72llnfrpe6.cloudfront.net/wp-content/uploads/2018/02/09210226/asw-french.pdf',
                    date: ''
                },
                {
                    icon: '\u{1F4F0}',
                    title: 'Premier patient diagnostique autiste (deces a 89 ans)',
                    meta: 'Ouest-France',
                    url: 'https://www.ouest-france.fr/sante/handicaps/le-premier-patient-diagnostique-autiste-est-mort-a-lage-de-89-ans-6e5cad0e-11f0-11ee-a4e5-33c2589c0bc0',
                    date: ''
                }
            ],

            documents: [
                {
                    icon: '\u{1F4C4}',
                    title: 'Guilhem DOCS synthese',
                    meta: 'Google Doc \u2014 Questionnaires, traits, demarches',
                    url: 'https://docs.google.com/document/d/1aJDiETX7rWIT1vhfDMHIqgiIVSG1w6txK8hv9estzvE/edit',
                    date: '2026-03-18'
                }
            ],

            contacts: [
                {
                    icon: '\u{1F3E5}',
                    name: 'Service Accueil Handicap UGA',
                    role: 'Universite Grenoble Alpes',
                    detail: '<a href="https://handicap.univ-grenoble-alpes.fr/" target="_blank">Site web</a> \u00B7 accueil-sah@univ-grenoble-alpes.fr \u00B7 04 76 74 85 75'
                },
                {
                    icon: '\u{1F3E5}',
                    name: 'CMP Alliance Adolescents',
                    role: '74 rue des Allies, 38100 Grenoble',
                    detail: 'antenneado@ch-alpes-isere.fr \u00B7 04 56 58 82 01'
                },
                {
                    icon: '\u{1F3E5}',
                    name: 'CRA Rhone-Alpes',
                    role: 'Centre diagnostic regional',
                    detail: '<a href="https://cra-rhone-alpes.org" target="_blank">cra-rhone-alpes.org</a>'
                }
            ]
        };
    }

    // --- Data: Specialists ---

    getSpecialistsData() {
        return [
            {
                domain: 'Cognition & Theories fondamentales',
                specialists: [
                    { name: 'Simon Baron-Cohen', inst: 'Cambridge (UK)', contribution: 'Theorie empathising-systemising, mindblindness, AQ test', pubs: '780+ articles' },
                    { name: 'Francesca Happe', inst: 'King\'s College London', contribution: 'Weak central coherence, camouflage femmes', pubs: '300+ articles' },
                    { name: 'Laurent Mottron', inst: 'Univ. Montreal', contribution: 'Enhanced Perceptual Functioning, forces autistes', pubs: '200+ articles, Nature 2011' },
                    { name: 'Uta Frith', inst: 'UCL London', contribution: 'Theorie de l\'esprit, pionniere cognitive', pubs: 'Livres fondateurs' }
                ]
            },
            {
                domain: 'Genetique & Neurosciences',
                specialists: [
                    { name: 'Daniel Geschwind', inst: 'UCLA', contribution: 'Genomique de l\'autisme, #1 citations (18 127)', pubs: 'Lancet, Nature Genetics' },
                    { name: 'Joseph Buxbaum', inst: 'Mount Sinai, NY', contribution: 'SFARI Gene, 14 528 citations', pubs: 'Genetique moleculaire' },
                    { name: 'Matthew State', inst: 'UCSF', contribution: 'Variants genetiques, consortium SPARK', pubs: 'Nature, Cell' },
                    { name: 'Thomas Bourgeron', inst: 'Institut Pasteur, Paris', contribution: 'Genes synaptiques (SHANK, neuroligines)', pubs: 'Science, Nature' }
                ]
            },
            {
                domain: 'Diagnostic & Evaluation',
                specialists: [
                    { name: 'Catherine Lord', inst: 'UCLA', contribution: 'Creatrice de l\'ADOS (gold standard diagnostique)', pubs: '14 830 citations, #2 mondial' },
                    { name: 'Tony Attwood', inst: 'Brisbane, Australie', contribution: 'Complete Guide to Asperger\'s, 30+ ans clinique', pubs: 'Reference clinique mondiale' },
                    { name: 'Christopher Gillberg', inst: 'Univ. Gothenburg', contribution: 'Concept de ESSENCE, 206 publications', pubs: '3e auteur le plus prolifique' }
                ]
            },
            {
                domain: 'Camouflage, Genre & Diagnostic tardif',
                specialists: [
                    { name: 'Meng-Chuan Lai', inst: 'Univ. Toronto / Cambridge', contribution: 'Quantification du camouflage, biais de genre', pubs: 'Etudes pionnieres 2017-2024' },
                    { name: 'Sarah Cassidy', inst: 'Univ. Nottingham', contribution: 'Camouflage et sante mentale, suicide chez autistes', pubs: 'Publications impact eleve' },
                    { name: 'William Mandy', inst: 'UCL London', contribution: 'Autisme chez les filles, profils feminins', pubs: 'Developpement d\'outils' },
                    { name: 'Laura Hull', inst: 'UCL / Bristol', contribution: 'Creatrice du CAT-Q, camouflage et sante mentale', pubs: 'Hull et al. 2017, 2019, 2021' }
                ]
            },
            {
                domain: 'Burnout autistique & Sante mentale',
                specialists: [
                    { name: 'Dora Raymaker', inst: 'Portland State Univ.', contribution: 'Definition du burnout autistique (AASPIRE), mesure ABM', pubs: 'Etude fondatrice 2020' },
                    { name: 'Christina Nicolaidis', inst: 'OHSU Portland', contribution: 'Co-directrice AASPIRE, sante des adultes autistes', pubs: 'Recherche participative' },
                    { name: 'Monique Botha', inst: 'Stirling (UK)', contribution: 'Modele de stress minoritaire applique a l\'autisme', pubs: 'Botha & Frost 2020' }
                ]
            },
            {
                domain: 'Intervention precoce & Developpement',
                specialists: [
                    { name: 'Helen Tager-Flusberg', inst: 'Boston University', contribution: 'Langage et cognition sociale', pubs: 'Centre for Autism Research Excellence' },
                    { name: 'Sally Rogers', inst: 'UC Davis MIND', contribution: 'Co-creatrice Early Start Denver Model (ESDM)', pubs: 'Intervention precoce' },
                    { name: 'Lonnie Zwaigenbaum', inst: 'Univ. Alberta', contribution: 'Marqueurs de risque precoces', pubs: 'Detection avant 2 ans' },
                    { name: 'Ami Klin', inst: 'Emory / Marcus Center', contribution: 'Eye-tracking, attention sociale, detection precoce', pubs: 'Nature 2009, 500+ articles' }
                ]
            },
            {
                domain: 'Neurodiversite & Perspective autiste',
                specialists: [
                    { name: 'Temple Grandin', inst: 'Colorado State Univ.', contribution: 'Pionniere : perspective autiste en science, pensee visuelle', pubs: 'Thinking in Pictures' },
                    { name: 'Devon Price', inst: 'Loyola Univ. Chicago', contribution: 'Psychologue autiste, masking et unmasking', pubs: 'Unmasking Autism' },
                    { name: 'Nick Walker', inst: 'Californie', contribution: 'Theorie neuroqueer, philosophie de la neurodiversite', pubs: 'Neuroqueer Heresies' },
                    { name: 'Judy Singer', inst: 'Australie', contribution: 'A forge le terme "neurodiversite" (1998)', pubs: 'NeuroDiversity 2.0 (2023)' },
                    { name: 'Damian Milton', inst: 'Univ. Kent', contribution: 'Probleme de la double empathie (2012)', pubs: 'Disability & Society' }
                ]
            },
            {
                domain: 'Francophones',
                specialists: [
                    { name: 'Laurent Mottron', inst: 'Univ. Montreal', contribution: 'Forces autistes, critique du modele deficitaire', pubs: 'Nature 2011' },
                    { name: 'Thomas Bourgeron', inst: 'Institut Pasteur', contribution: 'Genetique synaptique de l\'autisme', pubs: 'Science, Nature' },
                    { name: 'Josef Schovanec', inst: 'Philosophe, autiste', contribution: 'Vulgarisation, droits des autistes en France', pubs: 'Je suis a l\'Est' },
                    { name: 'Julie Dachez', inst: 'Psychologue sociale', contribution: 'Experience autiste adulte, diagnostic tardif', pubs: 'Dans ta bulle' },
                    { name: 'Bernadette Roge', inst: 'Univ. Toulouse', contribution: 'Adaptation francaise ADOS-2, intervention precoce', pubs: 'Reference clinique FR' },
                    { name: 'Amaria Baghdadli', inst: 'CHU Montpellier', contribution: 'Cohorte ELENA (600+ enfants), trajectoires developpementales', pubs: 'Plus grande cohorte FR' }
                ]
            },
            {
                domain: 'Ennui, Inertie & Monotropisme',
                specialists: [
                    { name: 'Dinah Murray', inst: 'Univ. London (posthume)', contribution: 'Theorie du monotropisme (2005) — modele attentionnel de l\'autisme', pubs: 'Murray et al. 2005, Monotropism.org' },
                    { name: 'Fergus Murray', inst: 'Monotropism.org', contribution: 'Extension du monotropisme, vulgarisation, site de reference', pubs: 'Articles Monotropism.org' },
                    { name: 'James Danckert', inst: 'Univ. Waterloo (Canada)', contribution: 'Ennui comme deviation homeostatique cognitive, mecanismes neurocognitifs', pubs: 'Out of My Skull (2020), Danckert & Eastwood' },
                    { name: 'John Eastwood', inst: 'York Univ. (Canada)', contribution: 'Ennui comme probleme attentionnel, co-auteur modele Danckert-Eastwood', pubs: 'The Unengaged Mind (2012)' },
                    { name: 'Karen Leneh Buckle', inst: 'Chercheuse autiste', contribution: '1ere etude formelle de l\'inertie autistique (2021)', pubs: 'Buckle et al. 2021, Autism' },
                    { name: 'Brett Heasman', inst: 'Univ. Kent (UK)', contribution: 'Flow autistique, interets speciaux comme regulation', pubs: 'Heasman et al. 2024' }
                ]
            }
        ];
    }

    // --- Data: Books ---

    getBooksData() {
        return [
            {
                category: 'Comprendre l\'autisme \u2014 Fondamentaux',
                books: [
                    { title: 'The Complete Guide to Asperger\'s Syndrome', author: 'Tony Attwood', desc: 'Bible clinique, exhaustif, accessible. La reference mondiale.' },
                    { title: 'NeuroTribes', author: 'Steve Silberman (2015)', desc: 'Histoire de l\'autisme + neurodiversite. Samuel Johnson Prize.' },
                    { title: 'Thinking in Pictures', author: 'Temple Grandin', desc: 'Vue interieure d\'une autiste pionniere.' },
                    { title: 'The Pattern Seekers', author: 'Simon Baron-Cohen (2020)', desc: 'Theorie E-S vulgarisee, lien invention/autisme.' },
                    { title: 'Mindblindness', author: 'Simon Baron-Cohen', desc: 'Theorie de l\'esprit \u2014 ouvrage fondateur.' }
                ]
            },
            {
                category: 'Diagnostic tardif adulte',
                books: [
                    { title: 'Unmasking Autism', author: 'Devon Price (2022)', desc: 'Masking, unmasking \u2014 le livre de reference actuel. Cite par Nicolas Galita.' },
                    { title: 'I Think I Might Be Autistic', author: 'Cynthia Kim', desc: 'Guide pratique pour adultes en questionnement.' },
                    { title: 'The Electricity of Every Living Thing', author: 'Katherine May', desc: 'Autobiographie, decouverte tardive en marchant.' },
                    { title: 'Taking Off the Mask', author: 'Hannah Louise Belcher', desc: 'Exercices pratiques pour comprendre le camouflage.' },
                    { title: 'The Late Diagnosis Handbook', author: 'Alondra Rogers (2024)', desc: 'Guide recent pour le soutien post-diagnostic.' }
                ]
            },
            {
                category: 'Femmes & autisme',
                books: [
                    { title: 'Women and Girls on the Autism Spectrum', author: 'Sarah Hendrickx (2e ed.)', desc: 'De l\'enfance a la vieillesse, masking, trans/non-binaire.' },
                    { title: 'Divergent Mind', author: 'Jenara Nerenberg', desc: 'Neurodivergences chez les femmes, sensorialite.' },
                    { title: 'Autism and Girls', author: 'Attwood, Grandin + experts', desc: 'Collaboration multi-experts, defis specifiques.' }
                ]
            },
            {
                category: 'Sante mentale & autisme',
                books: [
                    { title: 'Look Me in the Eye', author: 'John Elder Robison', desc: 'Memoire, diagnostic tardif, resilience.' },
                    { title: 'Neuroqueer Heresies', author: 'Nick Walker', desc: 'Theorie neuroqueer, deconstruction des normes.' }
                ]
            },
            {
                category: 'Monotropisme, Inertie & Ennui',
                books: [
                    { title: 'Out of My Skull: The Psychology of Boredom', author: 'James Danckert & John Eastwood (2020)', desc: 'Modele neurocognitif de l\'ennui — reference scientifique sur les mecanismes de desengagement.' },
                    { title: 'Monotropism: An Interest-Based Account of Autism', author: 'Dinah Murray (ed.)', desc: 'Theorie monotropiste — l\'autisme comme style attentionnel en tunnel.' },
                    { title: 'The Autism-Friendly Guide to Periods', author: 'Robyn Steward', desc: 'Inclut une section sur l\'interoception et la conscience corporelle chez les autistes.' }
                ]
            },
            {
                category: 'En francais',
                books: [
                    { title: 'Dans ta bulle', author: 'Julie Dachez (2018, preface Schovanec)', desc: 'Temoignages d\'autistes adultes francais, accessible.' },
                    { title: 'Je suis a l\'Est', author: 'Josef Schovanec', desc: 'Autobiographie, philosophe autiste francais.' },
                    { title: 'Le syndrome d\'Asperger : guide complet', author: 'Tony Attwood (trad.)', desc: 'Reference clinique en francais.' },
                    { title: 'L\'autisme : de l\'enfance a l\'age adulte', author: 'Barthelemy & Bonnet-Brilhault', desc: 'Academique francais, transitions.' }
                ]
            }
        ];
    }

    // --- Data: Publications ---

    getPublicationsData() {
        return {
            themes: [
                {
                    theme: 'Fondamentales \u2014 Diagnostic & Cognition',
                    studies: [
                        { title: 'ADOS (Autism Diagnostic Observation Schedule)', authors: 'Lord et al. (1994)', journal: 'J. Autism Dev. Disorders', metric: '6 652 citations' },
                        { title: 'ADOS-G (version revisee)', authors: 'Lord et al. (2000)', journal: 'J. Autism Dev. Disorders', metric: '5 523 citations' },
                        { title: 'Empathy Quotient (EQ)', authors: 'Baron-Cohen & Wheelwright (2004)', journal: 'J. Autism Dev. Disorders', metric: '4 030 citations' },
                        { title: 'E-S theory validated on 600K participants', authors: 'Greenberg, Warrier, Baron-Cohen et al. (2018)', journal: 'PNAS', metric: 'Validation massive' },
                        { title: 'Enhanced Perceptual Functioning model', authors: 'Mottron et al. (2006)', journal: 'J. Autism Dev. Disorders', metric: 'Modele des forces perceptives' },
                        { title: 'The power of autism', authors: 'Mottron (2011)', journal: 'Nature', metric: 'Manifeste pour les forces autistes' }
                    ]
                },
                {
                    theme: 'Diagnostic tardif adulte',
                    studies: [
                        { title: 'Late, There and Missed: symptom recognition in adults on the autism spectrum', authors: 'Lewis (2016)', journal: 'J. Autism Dev. Disorders', metric: 'Reference diagnostic tardif' },
                        { title: 'Experiences of late-diagnosed women on the autism spectrum', authors: 'Leedham et al. (2020)', journal: 'J. Autism Dev. Disorders', metric: 'Vecu femmes diagnostiquees tard' },
                        { title: 'A systematic review of late diagnosis of autism', authors: 'Huang et al. (2020)', journal: 'Research in ASD', metric: 'Meta-analyse' },
                        { title: 'Understanding the reasons, contexts and costs of late diagnosis of autism', authors: 'Stagg & Belcher (2019)', journal: 'Research in ASD', metric: 'Raisons et couts du retard' }
                    ]
                },
                {
                    theme: 'Camouflage & Masking',
                    studies: [
                        { title: 'Quantifying and exploring camouflaging in men and women with autism', authors: 'Lai et al. (2017)', journal: 'Autism', metric: '1ere quantification du camouflage' },
                        { title: 'Putting on my best normal: social camouflaging in adults with ASD', authors: 'Hull et al. (2017)', journal: 'J. Autism Dev. Disorders', metric: '750+ citations' },
                        { title: 'Development and validation of the CAT-Q', authors: 'Hull et al. (2019)', journal: 'J. Autism Dev. Disorders', metric: 'Outil CAT-Q de reference' },
                        { title: 'Is social camouflaging associated with anxiety and depression?', authors: 'Hull et al. (2021)', journal: 'Molecular Autism', metric: 'Lien camouflage/sante mentale' },
                        { title: 'Camouflaging in autism: a systematic review', authors: 'Cook et al. (2021)', journal: 'Clinical Psychology Review', metric: 'Revue systematique' }
                    ]
                },
                {
                    theme: 'Burnout autistique & Sante mentale',
                    studies: [
                        { title: '"Having all of your internal resources exhausted" \u2014 Defining Autistic Burnout', authors: 'Raymaker et al. (2020)', journal: 'Autism in Adulthood', metric: '1ere definition formelle' },
                        { title: 'Mental health conditions in autistic adults: a rapid review', authors: 'Hollocks et al. (2019)', journal: 'Autism in Adulthood', metric: '70% troubles comorbides' },
                        { title: 'Depression and anxiety in autistic adults: a systematic review', authors: 'Lai et al. (2019)', journal: 'Molecular Autism', metric: 'Prevalence et specificites' },
                        { title: 'Suicidality in autistic youth: a systematic review and meta-analysis', authors: 'Hedley & Uljarevic (2018)', journal: 'Autism Research', metric: 'Risque suicidaire accru' }
                    ]
                },
                {
                    theme: 'TDAH & Autisme (overlap)',
                    studies: [
                        { title: 'ADHD and autism overlap: a review', authors: 'Leitner (2014)', journal: 'Autism Research', metric: '50-70% comorbidite' },
                        { title: 'Co-occurring conditions in autistic people: a systematic review', authors: 'Lai et al. (2019)', journal: 'Lancet Psychiatry', metric: 'Conditions co-occurentes' },
                        { title: 'Shared genetic effects on 5 psychiatric disorders', authors: 'Cross-Disorder Group (2013)', journal: 'The Lancet', metric: '#1 citations transversal' }
                    ]
                },
                {
                    theme: 'Double empathie & Neurodiversite',
                    studies: [
                        { title: 'On the ontological status of autism: the "double empathy problem"', authors: 'Milton (2012)', journal: 'Disability & Society', metric: 'Paradigme influent' },
                        { title: 'Autistic peer-to-peer information transfer is highly effective', authors: 'Crompton et al. (2020)', journal: 'Autism', metric: 'Preuve empirique double empathie' },
                        { title: 'Neurodiversity studies: a new critical paradigm', authors: 'Rosqvist et al. (2020)', journal: 'Livre/Routledge', metric: 'Cadre theorique neurodiversite' }
                    ]
                },
                {
                    theme: 'Perception sensorielle',
                    studies: [
                        { title: 'Sensory experiences of autistic people: a systematic review', authors: 'DeBrabander et al. (2019)', journal: 'Autism', metric: 'Revue sensorielle complete' },
                        { title: 'Sensory over-responsivity in toddlers with ASD', authors: 'Ben-Sasson et al. (2009)', journal: 'J. Autism Dev. Disorders', metric: 'Detection precoce sensorielle' }
                    ]
                },
                {
                    theme: 'Ennui, Inertie & Monotropisme',
                    studies: [
                        { title: 'Attention, monotropism and the diagnostic criteria for autism', authors: 'Murray, Lesser & Lawson (2005)', journal: 'Autism', metric: 'Theorie fondatrice du monotropisme' },
                        { title: 'The Unengaged Mind: defining boredom in terms of attention', authors: 'Eastwood et al. (2012)', journal: 'Perspectives on Psychological Science', metric: 'Definition cognitive de l\'ennui' },
                        { title: '"No Way Out Except From External Intervention" — Autistic Inertia', authors: 'Buckle et al. (2021)', journal: 'Autism', metric: '1ere etude formelle de l\'inertie autistique' },
                        { title: 'Boredom, flow, and autistic special interests', authors: 'Heasman et al. (2024)', journal: 'Autism in Adulthood', metric: 'Flow et interets speciaux comme regulation' },
                        { title: 'Boredom as homeostatic deviation: a neuro-cognitive model', authors: 'Danckert et al. (2025)', journal: 'Trends in Cognitive Sciences', metric: 'Modele homeostatique de l\'ennui' },
                        { title: 'Alexithymia, interoception, and emotional processing in autism', authors: 'Shah et al. (2016)', journal: 'Cortex', metric: 'Lien alexithymie/interoception dans TSA' },
                        { title: 'Interoception and emotion regulation in autism spectrum disorder', authors: 'Frontiers review (2025)', journal: 'Frontiers in Psychiatry', metric: 'Revue interoception et regulation emotionnelle' }
                    ]
                },
                {
                    theme: 'Recherche emergente (2024-2026)',
                    studies: [
                        { title: '4 biological subtypes of autism', authors: 'Princeton/Simons Collaboration (2025)', journal: 'Nature', metric: '4 sous-types biologiques' },
                        { title: '2500 autism-associated genes identified via ML', authors: 'Princeton team (2025)', journal: 'Nature', metric: 'Machine learning + genomique' },
                        { title: 'Reticular thalamic nucleus hyperactivity: reversible in mouse models', authors: 'Stanford (2025)', journal: 'Nature Neuroscience', metric: 'Hyperactivite noyau thalamique' },
                        { title: 'Brain organoids from autistic individuals reveal developmental divergence', authors: 'Stanford (2024)', journal: 'Nature', metric: 'Organo\u00efdes cerebraux' }
                    ]
                }
            ],
            journals: [
                { name: 'J. of Autism and Developmental Disorders', stat: '3 478 articles, 90 308 citations', tag: 'top' },
                { name: 'Autism (Sage)', stat: 'Recherche cognitive et sociale', tag: 'top' },
                { name: 'Autism Research (Wiley/INSAR)', stat: 'Recherche translationnelle', tag: 'top' },
                { name: 'Autism in Adulthood', stat: 'Focus adultes, haute qualite', tag: 'new' },
                { name: 'Molecular Autism', stat: 'IF: 6.2, open access', tag: 'new' },
                { name: 'Molecular Psychiatry', stat: 'IF: 13.4', tag: 'high-if' },
                { name: 'Biological Psychiatry', stat: 'IF: 12.8', tag: 'high-if' },
                { name: 'Lancet Psychiatry', stat: 'IF: 64.3', tag: 'high-if' }
            ]
        };
    }

    // --- Data: Web Resources ---

    getWebResourcesData() {
        return [
            {
                category: 'Recherche & Science',
                resources: [
                    { name: 'INSAR', url: 'https://autism-insar.org', desc: 'Societe internationale de recherche sur l\'autisme' },
                    { name: 'Autism Research Centre (Cambridge)', url: 'https://autismresearchcentre.com', desc: 'Labo de Baron-Cohen, tests AQ/EQ en ligne' },
                    { name: 'SFARI (Simons Foundation)', url: 'https://sfari.org', desc: 'Financement recherche, base genetique SFARI Gene' },
                    { name: 'AASPIRE', url: 'https://aaspire.org', desc: 'Recherche participative par/avec des autistes' },
                    { name: 'Spectrum News', url: 'https://spectrumnews.org', desc: 'Journalisme scientifique specialise autisme (finance par Simons Foundation)' }
                ]
            },
            {
                category: 'Organisations par/pour autistes',
                resources: [
                    { name: 'ASAN', url: 'https://autisticadvocacy.org', desc: 'Autistic Self Advocacy Network \u2014 "Nothing About Us Without Us"' },
                    { name: 'Autistic Women & Nonbinary Network', url: 'https://awnnetwork.org', desc: 'Ressources par et pour femmes/non-binaires autistes' },
                    { name: 'National Autistic Society (UK)', url: 'https://autism.org.uk', desc: 'Reference britannique, guides pratiques excellents' },
                    { name: 'Thinking Person\'s Guide to Autism', url: 'https://thinkingautismguide.com', desc: 'Articles par des autistes et chercheurs, pas de pseudo-science' }
                ]
            },
            {
                category: 'Diagnostic & Auto-evaluation',
                resources: [
                    { name: 'Embrace Autism', url: 'https://embrace-autism.com', desc: 'Dr. Natalie Engelbrecht \u2014 tests valides (AQ, CAT-Q, RAADS-R), articles de qualite' },
                    { name: 'ARC Tests (Cambridge)', url: 'https://autismresearchcentre.com', desc: 'AQ-10, EQ, SQ \u2014 tests scientifiques gratuits' },
                    { name: 'RAADS-R Online', url: 'https://embrace-autism.com/raads-r/', desc: 'Ritvo Autism Asperger Diagnostic Scale \u2014 test de reference adultes (80 questions)' },
                    { name: 'CAT-Q Online', url: 'https://embrace-autism.com/cat-q/', desc: 'Camouflaging Autistic Traits Questionnaire (Hull et al.) \u2014 mesure du masking' }
                ]
            },
            {
                category: 'Outils pratiques',
                resources: [
                    { name: 'Goblin Tools', url: 'https://goblin.tools', desc: 'IA pour decomposer les taches, estimer difficulte, reformuler \u2014 cree par un dev autiste' },
                    { name: 'Tiimo', url: 'https://tiimo.dk', desc: 'App de planification visuelle pour neurodivergents (routines, rappels)' },
                    { name: 'Autism Books by Autistic Authors', url: 'https://autismbooksbyautisticauthors.com', desc: 'Catalogue curate de livres par des auteurs autistes' }
                ]
            },
            {
                category: 'TDAH + Autisme (AuDHD)',
                resources: [
                    { name: 'How to ADHD (YouTube)', url: 'https://howtoadhd.com', desc: 'Jessica McCabe \u2014 reference TDAH, episodes AuDHD specifiques' },
                    { name: 'ADHD Alien', url: 'https://adhd-alien.com', desc: 'Comics illustrant le vecu TDAH/AuDHD (Pina Varnel)' },
                    { name: 'Neurodiverging', url: 'https://neurodiverging.com', desc: 'Danielle Sullivan \u2014 coaching et ressources AuDHD adultes' }
                ]
            },
            {
                category: 'Francophones',
                resources: [
                    { name: 'Autisme France', url: 'https://autisme-france.fr', desc: 'Reseau national, 10 000 familles, demarche diagnostique' },
                    { name: 'CRA reseau national (GNCRA)', url: 'https://gncra.fr', desc: 'Chaque region a son CRA \u2014 diagnostic adulte possible' },
                    { name: 'CLE Autistes', url: 'https://cle-autistes.fr', desc: 'Collectif autiste francais, autodetermination, pair-aidance' },
                    { name: 'AFFA (Femmes Autistes)', url: 'https://association-affa.fr', desc: 'Association Francophone de Femmes Autistes' },
                    { name: 'PAARI', url: 'https://pafranceautisme.org', desc: 'Personnes Autistes pour une Autodetermination Responsable et Innovante' },
                    { name: 'Le Coin des Autistes (Skool)', url: 'https://www.skool.com/le-coin-des-autistes', desc: 'Communaute francophone (Nicolas Galita)' },
                    { name: 'Julie Dachez', url: 'https://juliedachez.com', desc: 'Blog + TOP 13 livres autisme' },
                    { name: 'L\'Atelier Galita', url: 'https://ateliergalita.com', desc: 'Newsletter Substack (Nicolas Galita)' }
                ]
            },
            {
                category: 'Diagnostic tardif adulte',
                resources: [
                    { name: 'Late Diagnosed Autistic Adults', url: 'https://www.reddit.com/r/AutismInWomen/', desc: 'Subreddit actif \u2014 temoignages, questions, vecu femmes autistes' },
                    { name: 'Adult Autism Assessment (NAS)', url: 'https://www.autism.org.uk/advice-and-guidance/topics/diagnosis/pre-diagnosis/adults', desc: 'Guide pre-diagnostic adulte (National Autistic Society)' }
                ]
            },
            {
                category: 'Ennui, Inertie & Regulation',
                resources: [
                    { name: 'Monotropism.org', url: 'https://monotropism.org', desc: 'Site de reference sur le monotropisme (Fergus Murray) — theorie, articles, ressources' },
                    { name: 'Embrace Autism — Meltdowns & Shutdowns', url: 'https://embrace-autism.com/meltdowns-and-shutdowns/', desc: 'Guide detaille meltdowns/shutdowns et strategies de regulation' },
                    { name: 'NAS — Boredom and autism', url: 'https://community.autism.org.uk/f/adults-on-the-autism-spectrum/16756/boredom', desc: 'Forum NAS — temoignages autistes sur l\'ennui et ses mecanismes' },
                    { name: 'Boredom Lab (Waterloo)', url: 'https://uwaterloo.ca/boredom-lab/', desc: 'Labo de James Danckert — recherche neurocognitive sur l\'ennui' },
                    { name: 'Autism Level UP — Interoception', url: 'https://autismlevelup.com/interoception/', desc: 'Ressources pratiques sur l\'interoception pour autistes' }
                ]
            },
            {
                category: 'Isere / Grenoble (pour Guilhem)',
                resources: [
                    { name: 'Service Accueil Handicap UGA', url: 'https://handicap.univ-grenoble-alpes.fr', desc: 'Amenagements universitaires' },
                    { name: 'CRA Rhone-Alpes', url: 'https://cra-rhone-alpes.org', desc: 'Centre diagnostic regional' }
                ]
            }
        ];
    }

    // --- Ennui data ---

    getEnnuiData() {
        return {
            intro: {
                title: 'Ennui & Inertie autistique',
                desc: 'L\'ennui autistique n\'est pas un simple "manque de motivation" ou un desoeuvrement passager. C\'est un etat neurologique qualitativement different de l\'ennui neurotypique, souvent decrit comme physiquement douloureux. Des recherches en neuroimagerie (Danckert et al., Journal of Boredom Studies, 2024) montrent que les zones cerebrales associees a la douleur — insula anterieure, cortex cingulaire anterieur — s\'activent pendant l\'ennui chez les personnes neurodivergentes. Trois mecanismes neurologiques se combinent : le monotropisme (attention concentree en tunnel sur peu de sujets, creant un vide attentionnel douloureux quand rien ne capte l\'interet), l\'inertie autistique (difficulte neurologique a demarrer, arreter ou changer d\'activite, independante de la volonte), et une dysregulation dopaminergique qui prive le cerveau du "carburant motivationnel" quand l\'activite n\'est pas intrinsequement interessante. Les strategies neurotypiques classiques ("just do it", "recompense-toi apres", "fais une to-do list") sont non seulement inefficaces mais souvent contre-productives car elles ignorent ces mecanismes. Les approches ci-dessous sont validees par la recherche scientifique (Buckle 2021, Rapaport 2024, Heasman 2024) et par le vecu de la communaute autiste.'
            },
            categories: [
                {
                    title: 'Comprendre le mecanisme',
                    icon: '\u{1F9E0}',
                    strategies: [
                        {
                            name: 'Monotropisme',
                            desc: 'Le cerveau autistique concentre son attention de maniere intense sur un nombre restreint de sujets a la fois — c\'est ce que Murray, Lawson et Lesser (2005) appellent le monotropisme. Contrairement au fonctionnement "polytropique" neurotypique ou l\'attention se repartit facilement entre plusieurs centres d\'interet, l\'attention autistique fonctionne comme un projecteur puissant mais etroit. Quand un "tunnel attentionnel" est actif (interet special, tache absorbante), l\'engagement est total et profond — c\'est la source du flow autistique. Mais quand AUCUN tunnel n\'est actif, le resultat n\'est pas un ennui tranquille comme chez les NT : c\'est un vide attentionnel profondement inconfortable, presque douloureux. On ne "choisit" pas de s\'ennuyer — le cerveau ne trouve litteralement rien sur quoi se focaliser, et cette absence de focal point est vecue comme une forme de sous-stimulation cognitive aigue. C\'est pourquoi "trouve-toi quelque chose a faire" est un conseil inutile : le probleme n\'est pas l\'absence d\'options mais l\'incapacite du cerveau a s\'y accrocher.',
                            source: 'Murray, Lawson & Lesser 2005 ; Dwyer et al. 2024',
                            tag: 'theorie'
                        },
                        {
                            name: 'Inertie autistique',
                            desc: 'L\'inertie autistique est un phenomene neurologique distinct de la procrastination ou de la paresse. L\'etude fondatrice de Buckle et al. (2021), "No Way Out Except From External Intervention", basee sur des entretiens approfondis avec plus de 20 adultes autistes, identifie deux poles : l\'inertie au repos (impossibilite de DEMARRER une action meme quand on veut et sait comment faire — le corps ne repond pas a la commande consciente) et l\'inertie en mouvement (impossibilite de S\'ARRETER une fois lance, meme quand on sait qu\'on devrait — on reste "colle" a une activite pendant des heures). Les participants de l\'etude de Rapaport et al. (2024) decrivent l\'inertie comme "the single most disabling part of being Autistic". Le resultat cle de Buckle : l\'inertie n\'est PAS sous controle conscient, et le facteur le plus efficace pour la debloquer est l\'intervention externe (une autre personne, un changement d\'environnement, un declencheur sensoriel). La volonte seule ne suffit pas — il faut des strategies qui contournent le mecanisme au lieu de le combattre frontalement.',
                            source: 'Buckle et al. 2021, Frontiers in Psychology',
                            tag: 'theorie'
                        },
                        {
                            name: 'Interoception alteree',
                            desc: 'L\'interoception est la capacite a percevoir les signaux internes du corps : faim, soif, fatigue, temperature, rythme cardiaque, besoin d\'aller aux toilettes, emotions. Chez beaucoup de personnes autistes, cette perception est alteree — certains signaux sont amplifies, d\'autres sont invisibles. Consequence directe pour l\'ennui : ce qu\'on vit comme "je m\'ennuie" est souvent en realite un signal interoceptif mal decode. Ce qui est de la faim, de la deshydratation, de la fatigue physique, un besoin sensoriel non satisfait, ou meme une emotion non identifiee est "traduit" par le cerveau en ennui generalize parce que le signal original n\'est pas correctement interprete. L\'etude de Trudel, Budge, Pasqualini et Danckert (2024) dans le Journal of Boredom Studies etablit une correlation significative entre la mauvaise interoception et la propension a l\'ennui. Concretement : avant de chercher "quoi faire", verifier d\'abord si les besoins physiologiques de base sont couverts (eau, nourriture, mouvement, temperature). Dans beaucoup de cas, l\'"ennui" disparait quand le vrai besoin est satisfait.',
                            source: 'Trudel & Danckert 2024 ; Goodall 2019',
                            tag: 'theorie'
                        },
                        {
                            name: '"Je vis dans les extremes"',
                            desc: 'L\'etude qualitative de Rapaport et al. (2024) dans la revue Autism, menee aupres de 24 adultes autistes, revele un pattern frappant : les participants ne vivent pas l\'ennui comme un etat intermediaire mais comme un pole extreme, oppose au flow total. Il n\'y a pas de "zone tiede" confortable entre les deux. Soit le cerveau est completement absorbe (hyperfocus, flow, interet special — etat ou le temps disparait et la productivite explose), soit il est completement eteint (paralysie, vide, incapacite a initier quoi que ce soit). Ce fonctionnement binaire est lie au monotropisme : le "projecteur attentionnel" est soit a pleine puissance sur un sujet, soit completement eteint. Les strategies doivent donc viser a ALLUMER le projecteur (trouver un point d\'accroche, meme minuscule) plutot qu\'a "gerer l\'ennui" comme un etat stable. L\'inertie en mouvement (ne pas pouvoir s\'arreter quand on est en flow) est le revers positif de ce mecanisme — les deux sont lies neurologiquement.',
                            source: 'Rapaport et al. 2024, Autism',
                            tag: 'vecu'
                        }
                    ]
                },
                {
                    title: 'Surmonter le monotropisme',
                    icon: '\u{1F52E}',
                    strategies: [
                        {
                            name: 'Tunnels, pas taches',
                            desc: 'Approche de Jamie Knight (Monotropism.org) : au lieu d\'organiser sa journee en "taches" (un concept neurotypique qui presuppose la capacite a switcher entre sujets), organiser en "tunnels" — des blocs de temps ou l\'on s\'immerge dans un seul flux d\'activite liee. Par exemple, au lieu de "repondre aux emails, puis faire les courses, puis travailler sur le projet", regrouper : "matin = tunnel projet (tout ce qui touche au projet, y compris les emails lies), apres-midi = tunnel logistique (courses, admin, menage)". Le cerveau monotropique ne switche pas facilement entre sujets — chaque transition coute enormement d\'energie. En regroupant les activites par "tunnel thematique", on minimise les transitions et on exploite la capacite naturelle a s\'immerger profondement. Knight, lui-meme autiste, decrit cette methode comme la difference entre "nager avec le courant" et "nager contre".',
                            source: 'Jamie Knight, Monotropism.org',
                            tag: 'outil'
                        },
                        {
                            name: 'Reduire la complexite simultanee',
                            desc: 'Murray, Lawson et Lesser (2005) montrent que le cerveau monotropique distribue son attention sur peu de canaux mais avec une intensite elevee. Consequence pratique : le multitasking n\'est pas "difficile", il est neurologiquement incompatible. Chaque input simultane (musique avec paroles + tache cognitive, conversation + navigation GPS, ecran + bruit de fond imprevisible) divise un "projecteur" concu pour etre unique. Strategie : reduire systematiquement le nombre de stimuli pendant les taches exigeantes. Un seul ecran actif (pas deux moniteurs avec des contenus differents), des bouchons d\'oreilles ou du bruit blanc pour eliminer les sons imprevisibles, des notifications desactivees, un bureau degage. Si une tache requiert du multitasking (ex: reunion en visio + prise de notes), la decomposer en sequence : ecouter PUIS noter, pas les deux en meme temps. Accepter que "faire une chose a la fois" n\'est pas une limitation mais le mode de fonctionnement optimal du cerveau monotropique.',
                            source: 'Murray, Lawson & Lesser 2005',
                            tag: 'outil'
                        },
                        {
                            name: 'Inventaire d\'interets et amorcage environnemental',
                            desc: 'Le vide attentionnel monotropique survient quand le cerveau n\'a pas de "tunnel" disponible — aucun sujet ne capte le projecteur. La strategie preventive est double : (1) maintenir un inventaire visible de ses interets actifs (une liste physique, un tableau, des objets lies aux interets poses en evidence), et (2) "amorcer" l\'environnement pour que le cerveau tombe naturellement sur un declencheur. Fergus Murray (Monotropism.org) recommande le "seeding" : laisser deliberement un livre ouvert a la page en cours, un projet en cours visible sur l\'ecran, un instrument de musique sorti de son etui, du materiel de dessin sur la table. L\'idee est que le cerveau monotropique a besoin d\'un point d\'accroche visuel ou tactile pour "allumer" le tunnel — sans ce declencheur externe, il reste en mode veille douloureuse. L\'inventaire sert pendant les crises d\'ennui : au lieu de chercher quoi faire (processus cognitif bloque par l\'inertie), consulter la liste et laisser le regard accrocher.',
                            source: 'Fergus Murray, Monotropism.org ; Murray et al. 2005',
                            tag: 'outil'
                        },
                        {
                            name: 'Rampes de transition et alertes avancees',
                            desc: 'Dwyer et al. (2024) et Life Skills Advocate documentent une difficulte majeure du monotropisme : les transitions. Quand le cerveau est en tunnel, le sortir brutalement provoque une "rupture attentionnelle" douloureuse (comparable a etre reveille en sursaut). Les strategies qui fonctionnent utilisent des rampes progressives : (1) alertes avancees — prevenir 15 min, 10 min, 5 min avant un changement d\'activite (soi-meme via timer, ou demander a un proche de prevenir); (2) rituels de transition — une micro-activite de 2-3 min qui sert de "sas" entre deux tunnels (preparer un cafe, quelques etirements, noter ou l\'on en est); (3) instructions sequentielles, pas simultanees — Dwyer et al. montrent que "arrete ca et fais ca" est un double changement impossible, alors que "dans 5 min, tu pourras sauvegarder ton travail, puis on passera a autre chose" donne au cerveau le temps de se preparer. Le cout d\'une transition non preparee est souvent un shutdown ou une crise — ces 5 minutes de preparation en economisent des heures.',
                            source: 'Dwyer et al. 2024 ; Life Skills Advocate',
                            tag: 'outil'
                        },
                        {
                            name: 'Exploiter le flow comme force',
                            desc: 'Heasman et al. (2024) proposent une "theorie du flow autistique" qui renverse la perspective habituelle : le monotropisme n\'est pas qu\'un handicap, c\'est aussi la source d\'une capacite unique a atteindre des etats de flow profonds. Les personnes autistes rapportent des experiences de flow plus intenses, plus longues et plus immersives que les NT. La cle est de ne pas combattre ce fonctionnement mais de l\'exploiter. Strategies : (1) identifier ses "declencheurs de flow" personnels et les rendre facilement accessibles; (2) proteger les periodes de flow — pas d\'interruptions, pas de meetings au milieu; (3) utiliser l\'expertise approfondie que le monotropisme permet naturellement (Reframing Autism note que cette capacite mene a une expertise exceptionnelle dans les domaines d\'interet); (4) proteger contre le burnout en preservant l\'acces aux interets speciaux meme sous pression (Mantzalas et al. 2022 montrent que la suppression des interets speciaux est un facteur direct de burnout autistique). Le monotropisme est un superpouvoir quand l\'environnement est adapte.',
                            source: 'Heasman et al. 2024 ; Mantzalas et al. 2022 ; Reframing Autism',
                            tag: 'interet'
                        },
                        {
                            name: 'Simplifier pour conserver l\'energie',
                            desc: 'Jamie Knight decrit comment la vie quotidienne dans un monde polytropique (concu pour le multitasking NT) draine l\'energie monotropique a une vitesse disproportionnee. Chaque decision, chaque transition, chaque stimulus imprevu consomme une part du "budget attentionnel" limite. Sa strategie : simplifier radicalement. Automatiser tout ce qui peut l\'etre (memes repas, memes vetements, memes trajets — pas par paresse mais par conservation d\'energie cognitive). Deleguer les taches qui requierent du multitasking. Organiser l\'espace physique pour qu\'il y ait le moins de decisions a prendre (capsule wardrobe, meal prep, rangement identique chaque fois). Chaque decision eliminee libere de l\'attention pour ce qui compte vraiment : le tunnel actif, l\'interet special, la tache en cours. Cette approche est validee par Murray et al. (2005) : le cerveau monotropique fonctionne optimalement quand il peut diriger TOUTE son attention vers un seul point, sans fuites vers des micro-decisions parasites.',
                            source: 'Jamie Knight ; Murray et al. 2005',
                            tag: 'env'
                        }
                    ]
                },
                {
                    title: 'Surmonter l\'inertie',
                    icon: '\u{26A1}',
                    strategies: [
                        {
                            name: 'Body doubling (strategie #1)',
                            desc: 'L\'etude de Buckle et al. (2021) identifie clairement l\'intervention externe comme le facteur le plus efficace contre l\'inertie autistique. Le body doubling — la simple presence d\'une autre personne dans le meme espace — est la strategie la plus citee par les participants. Elle fonctionne par co-regulation : le systeme nerveux se synchronise avec la presence de l\'autre, fournissant un "ancrage externe" qui compense l\'incapacite du cerveau a generer le signal de demarrage en interne. Formes possibles : en personne (travailler au meme endroit qu\'un proche, meme en silence, meme sur des activites differentes), virtuel (Focusmate, sessions Discord "study with me"), ou meme passif (livestreams YouTube de gens qui travaillent). Buckle note que le body doubling fonctionne meme quand la personne n\'est pas consciente de son role — la simple presence suffit. C\'est la strategie a essayer EN PREMIER quand l\'inertie frappe.',
                            source: 'Buckle et al. 2021, Frontiers in Psychology',
                            tag: 'outil'
                        },
                        {
                            name: '"Stuck buddy" — support par texto',
                            desc: 'Variante du body doubling pour les moments ou personne n\'est physiquement present. Buckle et al. (2021) documentent cette strategie ou un ami/proche accepte d\'etre disponible par texto pendant les episodes d\'inertie. Le fonctionnement : quand l\'inertie frappe, envoyer un message "je suis bloque". Le buddy repond avec des micro-instructions concretes ("est-ce que tu peux bouger un doigt?", "est-ce que tu peux te lever?", "bois un verre d\'eau"). Ce n\'est pas du coaching ni de la motivation — c\'est de l\'intervention externe fractionnee. La voix externe (meme ecrite) fournit le signal de demarrage que le cerveau ne peut pas generer seul. Cle : etablir cet accord AVANT les crises (quand l\'inertie est active, envoyer un premier message est deja un effort enorme). Avoir un contact pre-designe avec une phrase code convenue simplifie l\'initiation au minimum.',
                            source: 'Buckle et al. 2021, Frontiers in Psychology',
                            tag: 'outil'
                        },
                        {
                            name: 'Micro-step self-talk',
                            desc: 'Quand aucune aide externe n\'est disponible, Buckle et al. (2021) identifient l\'auto-instruction decomposee comme la strategie d\'auto-assistance la plus efficace. Le principe : se donner a voix haute des instructions ultra-fines, une a la fois, exactement comme un buddy le ferait. "Bouge le petit doigt de la main droite." [fait] "Maintenant bouge la main." [fait] "Pose la main a plat." [fait] "Pousse pour te relever." [fait] La verbalisation a voix haute est importante — elle utilise le canal auditif pour contourner le blocage du canal moteur volontaire. Le niveau de decomposition semble absurde vu de l\'exterieur mais correspond a la realite neurologique de l\'inertie : le cerveau ne peut pas executer "leve-toi" comme instruction unique, mais il peut executer "bouge un doigt". Chaque micro-mouvement reussi cree un momentum qui facilite le suivant.',
                            source: 'Buckle et al. 2021, Frontiers in Psychology',
                            tag: 'corps'
                        },
                        {
                            name: 'Barrieres environnementales strategiques',
                            desc: 'Buckle et al. (2021) documentent l\'inertie de mouvement — l\'impossibilite de S\'ARRETER une fois en cours d\'activite, surtout le doomscrolling, jeux video, ou hyperfocus non productif. La strategie : installer des barrieres physiques qui interrompent le flux sans necessite de volonte. Exemples concrets : placer le telephone dans une autre piece (la friction de devoir se lever suffit souvent), utiliser des bloqueurs d\'apps avec timer (Forest, Cold Turkey), poser un timer physique visible (Time Timer), mettre le chargeur du telephone loin du lit. Pour l\'inertie au repos : l\'inverse — eliminer toutes les barrieres entre soi et l\'action souhaitee. Vetements de sport prets la veille, materiel de projet visible sur le bureau, livre ouvert sur le canape. Le principe est que l\'inertie suit le chemin de moindre resistance : en modifiant l\'environnement, on change ce que "ne rien faire" signifie physiquement.',
                            source: 'Buckle et al. 2021, Frontiers in Psychology',
                            tag: 'env'
                        },
                        {
                            name: 'Chaines d\'activite continues',
                            desc: 'Buckle et al. (2021) identifient un pattern cle : l\'inertie au repos est beaucoup plus difficile a briser que l\'inertie de mouvement a rediriger. Une fois en mouvement, le cerveau tend a rester en mouvement. Strategie : ne jamais "s\'arreter" completement entre deux activites. Enchainer directement d\'une activite a la suivante sans pause ou le corps s\'immobilise. Par exemple : finir de manger → se lever IMMEDIATEMENT pour ranger (pas s\'asseoir d\'abord) → enchainer sur la tache suivante. Alarm → se lever → aller directement a la douche (pas "rester 5 min au lit"). La pause entre deux activites est le moment ou l\'inertie au repos peut capturer — et une fois capture, le redemarrage peut prendre des heures. Si une pause est necessaire, la faire en mouvement (marcher, etirements, rangement leger) plutot qu\'assis ou couche. Le mouvement preserve le momentum.',
                            source: 'Buckle et al. 2021, Frontiers in Psychology',
                            tag: 'corps'
                        },
                        {
                            name: 'Protocole d\'ignition 7 minutes',
                            desc: 'Methode de Carmen (ADHD coach, @carmenADHD) validee par la communaute neurodivergente : se dire "je fais ca pendant 7 minutes seulement, et apres j\'arrete si je veux". 7 minutes specifiquement — pas 5 (trop court pour engager le cerveau), pas 10 (semble trop long quand l\'inertie est forte). Le mecanisme exploite deux principes : (1) la friction d\'initiation est le vrai obstacle, pas la tache elle-meme — une fois demarre, le cerveau bascule souvent en mode "inertie de mouvement" et continue naturellement; (2) la permission d\'arreter desactive l\'anxiete de l\'engagement infini qui amplifie la paralysie. Rapaport et al. (2024) confirment ce pattern : beaucoup de participants rapportent que "commencer est la partie la plus difficile — une fois lance, je peux continuer pendant des heures". Les 7 minutes servent de rampe de lancement, pas de duree de travail.',
                            source: 'Carmen ADHD ; Rapaport et al. 2024',
                            tag: 'outil'
                        },
                        {
                            name: 'Lieux publics vs prive',
                            desc: 'Rapaport et al. (2024) documentent un facteur surprenant : plusieurs participants rapportent que l\'inertie est significativement plus faible dans les espaces publics (bibliotheque, cafe, coworking) que chez soi. Le mecanisme est triple : (1) la pression sociale legere (meme non-dite) fournit l\'intervention externe que Buckle identifie comme cle; (2) le deplacement jusqu\'au lieu public est en soi un "starter step" qui brise l\'inertie au repos — une fois en mouvement, le momentum est preserve; (3) l\'environnement public offre une stimulation de fond reguliere (bruit de cafe, mouvement des gens) qui maintient le systeme nerveux au-dessus du seuil d\'activation sans surcharger. Strategie : quand l\'inertie est chronique a la maison, essayer systematiquement de travailler dans un lieu public, meme si l\'activite ne le "necessite" pas objectivement. Le changement de contexte seul peut debloquer ce que des heures de volonte a la maison ne debloquent pas.',
                            source: 'Rapaport et al. 2024, Autism',
                            tag: 'env'
                        },
                        {
                            name: 'Prompts externes consentis',
                            desc: 'Buckle et al. (2021) distinguent deux types d\'intervention externe : les prompts consentis (pre-convenus, bienveillants, respectueux de l\'autonomie) et les prompts non-consentis (interruptions imprevues, ordres, reproches). Seuls les premiers fonctionnent — les seconds aggravent l\'inertie par le stress. Strategie : convenir a l\'avance avec un proche de phrases et moments specifiques. Exemples de prompts qui fonctionnent : "C\'est l\'heure qu\'on avait prevue pour X" (factuel, pas de jugement), "Tu veux que je m\'assoie a cote de toi pendant que tu commences ?" (offre de body doubling), "Je fais du cafe, tu en veux ?" (pretexte pour bouger). Exemples de prompts qui NE fonctionnent PAS : "T\'as passe toute la journee a rien faire" (culpabilisant), "Allez, leve-toi" (imperatif), "Tu avais dit que tu le ferais" (reproche). La cle : etablir le protocole en dehors des periodes d\'inertie, quand la communication est plus facile.',
                            source: 'Buckle et al. 2021, Frontiers in Psychology',
                            tag: 'outil'
                        }
                    ]
                },
                {
                    title: 'Strategies corporelles',
                    icon: '\u{1F9D8}',
                    strategies: [
                        {
                            name: 'Body scan (5 min)',
                            desc: 'Exercice d\'interoception adaptee : deux fois par jour (idealement avec une alarme programmee), prendre 3 a 5 minutes pour parcourir systematiquement chaque partie du corps, de bas en haut, en notant les sensations presentes sans chercher a les modifier. Verifier specifiquement : ai-je soif ? faim ? les vetements serrent-ils ? la machoire est-elle crispee ? ai-je besoin d\'aller aux toilettes ? ai-je froid ou chaud ? Les personnes autistes ratent souvent ces signaux basiques a cause de l\'interoception alteree, et ce qui est interprete comme "ennui" est frequemment un besoin physiologique non identifie. Le body scan sert a decoder ces signaux. Avec la pratique reguliere, la conscience interoceptive s\'ameliore et l\'identification precoce des besoins devient plus naturelle, reduisant les episodes d\'"ennui" qui etaient en fait des besoins non satisfaits.',
                            source: 'Bien-etre Autiste ; Reframing Autism',
                            tag: 'corps'
                        },
                        {
                            name: 'Heavy work / pression profonde',
                            desc: 'Les exercices de "heavy work" fournissent un input proprioceptif profond qui calme le systeme nerveux et peut debloquer l\'inertie au repos. Techniques concretes : pousser fort les mains contre un mur pendant 10-15 secondes (wall push, fournit un input articulaire intense), faire des compressions articulaires en pressant fermement epaules, coudes et genoux, s\'enrouler serre dans une couverture lestee comme un burrito ("burrito wrap"), ou simplement serrer fort ses propres bras. La pression profonde active le systeme nerveux parasympathique (repos/digestion), ce qui contre l\'etat de "figement" souvent present dans l\'inertie. Ces techniques sont issues de l\'ergotherapie (OT) et validees cliniquement comme regime sensoriel pour adultes autistes. L\'avantage majeur : elles ne necessitent aucune decision cognitive (le frein principal de l\'inertie), seulement un geste physique simple et immediat.',
                            source: 'The Autistic Burnout (Substack) ; clinique OT',
                            tag: 'corps'
                        },
                        {
                            name: 'Suivi du rythme cardiaque',
                            desc: 'Exercice d\'interoception diagnostique et therapeutique : poser la main sur la poitrine ou le poignet et essayer de sentir ses battements cardiaques pendant 60 secondes. Cet exercice apparemment simple est en fait revelateur — beaucoup de personnes autistes ne percoivent pas leur rythme cardiaque, ce qui indique un deficit interoceptif significatif. Avec la pratique reguliere, la sensibilite s\'ameliore. La methode complete (adaptee du blog Bien-etre Autiste) inclut aussi : boire en pleine conscience (observer les sensations avant de boire, sentir le poids du verre, suivre le trajet du liquide dans la gorge et l\'estomac, noter le soulagement de la soif) et la localisation emotionnelle (rappeler un souvenir emotionnel, identifier OU dans le corps la sensation se manifeste — chaleur, tension, creux). Chaque exercice ameliore la capacite a decoder les signaux internes et donc a identifier ce dont le corps a vraiment besoin quand l\'"ennui" frappe.',
                            source: 'Bien-etre Autiste ; Autism Level UP',
                            tag: 'corps'
                        },
                        {
                            name: 'Mouvement conscient',
                            desc: 'Le mouvement peut servir d\'"ancre de demarrage" : une action physique simple qui initie la journee ou casse l\'inertie sans necessiter de motivation ni de decision. Yoga, tai chi, marche lente, etirements — toute activite qui combine mouvement et proprioception aide a sortir de l\'inertie au repos parce qu\'elle change l\'etat physiologique du corps avant de solliciter le cerveau. Quand l\'inertie est trop forte pour un mouvement complet, la technique des "micro-mouvements" fonctionne : commencer par bouger un seul doigt, puis une main, puis un bras, puis se lever. Le principe est d\'exploiter la physique de l\'inertie elle-meme — un objet au repos tend a rester au repos, mais une fois en mouvement, il tend a continuer. Chaque micro-mouvement augmente la probabilite du suivant. C\'est aussi pourquoi aller directement faire un etirement ou une marche en se levant le matin (avant meme que le cerveau "decide" quoi que ce soit) est une strategie efficace.',
                            source: 'Reframing Autism ; Life Skills Advocate',
                            tag: 'corps'
                        },
                        {
                            name: 'Respiration ventrale',
                            desc: 'Technique de reset vagal rapide : inspirer par le nez en 4 temps en gonflant le ventre comme un ballon (respiration diaphragmatique, pas thoracique), puis expirer par la bouche en 6 temps en laissant le ventre se degonfler naturellement. Repeter pendant 3 minutes (environ 10-12 cycles). Cette respiration active specifiquement le nerf vague et le systeme nerveux parasympathique, ce qui fait basculer le corps de l\'etat de "figement" (freeze response, souvent confondu avec de la paresse) vers un etat de calme actif ou l\'initiation d\'une action redevient possible. L\'expiration plus longue que l\'inspiration est la cle — c\'est ce ratio asymetrique qui declenche la reponse parasympathique. Peut se combiner avec la pression profonde (ex: mains appuyees sur les cuisses pendant l\'exercice) pour un effet double.',
                            source: 'Autism of PA ; clinique OT',
                            tag: 'corps'
                        }
                    ]
                },
                {
                    title: 'Interets speciaux comme levier',
                    icon: '\u{2B50}',
                    strategies: [
                        {
                            name: 'Explorer une nouvelle facette',
                            desc: 'Les interets speciaux ne sont pas un probleme a gerer — ce sont le moteur principal de l\'engagement autistique et une piece essentielle du bien-etre (Heasman et al. 2024). Quand un interet special commence a saturer ou quand l\'ennui s\'installe dans un domaine familier, explorer une facette inexploree peut relancer le flow : passer de "regarder" a "creer", de "consommer" a "enseigner", ou de la pratique a l\'histoire, la mecanique, la communaute. Par exemple, si l\'interet special est la musique, explorer la lutherie, l\'acoustique physique, l\'histoire d\'un genre, ou le mixage audio ouvre des tunnels attentionnels completement neufs a l\'interieur du meme domaine. Cette strategie exploite le fonctionnement monotropique : plutot que de forcer l\'attention vers un sujet qui ne "prend" pas, on redirige le tunnel existant vers un angle nouveau qui relance la dopamine.',
                            source: 'Heasman et al. 2024 ; Reframing Autism',
                            tag: 'interet'
                        },
                        {
                            name: 'Micro-immersion (10 min)',
                            desc: 'S\'autoriser 10 minutes d\'interet special comme "rampe de lancement" avant une tache moins motivante. Le principe est neurologique : l\'interet special genere de la dopamine et de l\'engagement, ce qui "chauffe" le moteur cognitif. Une fois en mouvement (inertie de mouvement), la transition vers une tache adjacente est plus facile que depuis l\'etat d\'inertie au repos. Ce n\'est pas de la procrastination — c\'est une strategie deliberee de pre-activation dopaminergique. L\'important est de definir la duree a l\'avance (timer de 10 min) pour ne pas basculer en hyperfocus incontrole. La micro-immersion peut aussi servir de "recompense-pont" : 10 min d\'IS entre deux blocs de taches difficiles. Savoir qu\'on y reviendra reduit l\'anxiete de devoir quitter l\'interet special pour une tache obligatoire.',
                            source: 'Asperger Experts ; communaute autiste',
                            tag: 'interet'
                        },
                        {
                            name: 'Integrer l\'IS dans le quotidien',
                            desc: 'Transformer les corvees et taches quotidiennes en les reliant a l\'interet special. C\'est la strategie des "passerelles" : creer un pont entre une activite ennuyeuse et un domaine d\'interet. Exemples concrets : documenter ses finances dans un tableur elabore si on aime les systemes et les donnees, faire le menage en ecoutant du contenu sur l\'interet special (podcast, video, audiobook), ranger par couleur ou par categorie si l\'IS est le design ou la classification, cuisiner en approchant les recettes comme de la chimie, faire les courses en optimisant le trajet comme un probleme de logistique. Le mecanisme : la tache ennuyeuse fournit le "vehicule" et l\'interet special fournit le "carburant" dopaminergique. La tache devient supportable parce qu\'elle est reframee a travers le prisme de l\'interet, pas parce qu\'on se "force".',
                            source: 'Learn Play Thrive ; communaute autiste',
                            tag: 'interet'
                        },
                        {
                            name: 'Flow mapping',
                            desc: 'Exercice de preparation a faire AVANT les crises d\'ennui (pas pendant, car l\'inertie empeche de reflechir clairement). Lister les 3 a 5 activites qui declenchent regulierement un etat de flow — ces activites ou le temps disparait, ou l\'on oublie de manger, ou l\'on se sent completement absorbe. Heasman et al. (2024) proposent la "theorie du flow autistique" qui identifie que les personnes autistes ont une capacite unique a decouvrir et gerer le flow, mais que les transitions (entrer et sortir du flow) sont particulierement difficiles et que des contraintes internes/environnementales limitent le potentiel. Le flow mapping consiste a identifier ses propres "declencheurs de flow" et a les garder physiquement accessibles pour les moments de paralysie : avoir le materiel pret, le fichier ouvert, le projet visible. Quand l\'ennui frappe, consulter la liste au lieu de chercher quoi faire (chercher = friction = inertie).',
                            source: 'Heasman et al. 2024 ; Wain et al. 2026',
                            tag: 'interet'
                        }
                    ]
                },
                {
                    title: 'Outils & structure',
                    icon: '\u{1F6E0}\u{FE0F}',
                    strategies: [
                        {
                            name: 'Body doubling (virtuel)',
                            desc: 'Le body doubling est la strategie la plus citee par la communaute autiste/ADHD pour briser l\'inertie. Principe : travailler a cote de quelqu\'un — meme silencieusement, meme sur des taches completement differentes. L\'etude Buckle (2021) montre que l\'intervention externe est le facteur le plus efficace contre l\'inertie autistique ("No way out except from external intervention"). La presence d\'une autre personne regule le systeme nerveux (co-regulation), fournit un cadre social leger sans demande d\'interaction, et cree une forme d\'accountability implicite. Formes possibles : en personne (travailler dans le meme espace qu\'un coloc, partenaire, ami), ou virtuel via des plateformes comme Focusmate (sessions de 25/50/75 minutes avec un inconnu, gratuit en version de base), Flown, ou des sessions Discord "etude ensemble". Certains utilisent aussi les livestreams "study with me" sur YouTube comme forme de body doubling unidirectionnel.',
                            url: 'https://focusmate.com',
                            source: 'Buckle et al. 2021 ; NeuronNav',
                            tag: 'outil'
                        },
                        {
                            name: 'Tiimo (app)',
                            desc: 'Planificateur visuel concu specifiquement pour les personnes neurodivergentes (autisme, TDAH). Contrairement aux calendriers textuels classiques qui sont souvent inefficaces pour les personnes autistes, Tiimo utilise des timelines visuelles avec codes couleur, des rappels doux (pas d\'alarmes agressives), et une interface epuree. Fonctionnalites cles : creation de routines visuelles pour la journee avec duree par etape, rappels de transition entre activites (aide a l\'inertie de mouvement), et templates de routines partageables. iPhone App of the Year 2025. L\'approche visuelle est importante parce que beaucoup de personnes autistes traitent l\'information visuelle plus efficacement que le texte pur, et la timeline rend le temps "concret" au lieu d\'abstrait (aide a l\'interoception temporelle). Alternative : Routinery, qui offre des fonctionnalites similaires avec un timer par etape.',
                            url: 'https://tiimo.dk',
                            source: 'Tiimo ; clinique OT ; TEACCH',
                            tag: 'outil'
                        },
                        {
                            name: 'Goblin Tools',
                            desc: 'Suite d\'outils IA cree par un developpeur autiste, centree sur la decomposition de taches et la dysfonction executive. L\'outil principal, "Magic ToDo", prend une tache formulee normalement ("ranger la cuisine") et la decompose automatiquement en micro-etapes ultra-fines, avec une estimation de difficulte pour chaque etape. C\'est exactement ce dont le cerveau autiste a besoin contre l\'inertie : la tache "ranger la cuisine" devient "se lever", "marcher vers l\'evier", "prendre UNE assiette", "la rincer" — chaque etape faisable en 30-120 secondes. Autres outils inclus : "Formalizer" (reformule un texte au ton voulu), "Judge" (estime la difficulte d\'une tache), "Compiler" (fusionne des notes). Le fait que ce soit cree par un autiste pour des autistes se sent dans le design : pas de culpabilisation, pas de "tu devrais pouvoir faire ca", juste des outils pragmatiques qui contournent la friction d\'initiation.',
                            url: 'https://goblin.tools',
                            source: 'Goblin Tools ; communaute ND',
                            tag: 'outil'
                        },
                        {
                            name: 'Alarmes exterieures',
                            desc: 'Si l\'interoception est faible (ce qui est frequent chez les personnes autistes), le corps ne previent pas de ses besoins : on oublie de manger pendant 8h, de boire de l\'eau, de bouger, de faire des pauses. Ces besoins non satisfaits s\'accumulent et se manifestent comme un "ennui" generalise alors que le corps a simplement faim, soif ou besoin de mouvement. La solution est d\'externaliser les rappels que le corps ne fournit pas : alarmes programmees pour manger (toutes les 3-4h), boire (toutes les heures), bouger (toutes les 45 min), faire une pause (en meme temps que bouger). L\'etude Buckle (2021) note toutefois que les alarmes seules sont souvent insuffisantes pour les personnes autistes qui luttent avec l\'inertie — l\'alarme sonne mais le corps ne bouge pas. Solution : combiner l\'alarme avec un "starter step" pre-prepare (le verre d\'eau est deja sur le bureau, la barre de cereales est dans la poche).',
                            source: 'The Autistic Burnout ; Buckle 2021',
                            tag: 'outil'
                        },
                        {
                            name: 'Decomposer la premiere etape',
                            desc: 'L\'inertie au repos bloque specifiquement sur le fait de DEMARRER. On sait ce qu\'on doit faire, on veut le faire, on sait comment — mais le corps ne repond pas. La cle est de reduire la premiere etape a quelque chose de si petit qu\'il n\'y a presque aucune friction d\'initiation. La regle de Life Skills Advocate : la premiere action doit etre faisable en 30 a 120 secondes maximum. Si c\'est trop gros, c\'est encore trop gros. Pas "travailler sur le projet" mais "ouvrir le fichier". Pas "ranger la chambre" mais "poser le stylo sur le bureau". Pas "faire du sport" mais "mettre les chaussures". La decomposition standard ("nettoyer la cuisine") ne suffit pas pour l\'inertie autistique — il faut aller a un niveau de granularite qui peut sembler absurde mais qui correspond a la realite neurologique : le cerveau a besoin d\'un point d\'entree minuscule pour amorcer le mouvement.',
                            source: 'Life Skills Advocate ; Buckle 2021',
                            tag: 'outil'
                        },
                        {
                            name: 'Task stacking',
                            desc: 'Strategie #1 en communaute autiste/TDAH. Principe : combiner une tache ennuyeuse avec une activite regulatrice qui fournit la dopamine que la tache ennuyeuse ne genere pas. Exemples : lessive + podcast, menage + musique a fort BPM, emails + chewing-gum + boisson chaude, administration + serie connue en fond sonore, cuisine + audiobook sur l\'interet special. Le "stacking" fonctionne parce que le cerveau autistique/ADHD a besoin d\'un niveau minimum de stimulation pour fonctionner — en dessous de ce seuil, l\'inertie s\'installe. L\'activite regulatrice (musique, stimming, mouvement, input oral) remonte le niveau de stimulation au-dessus du seuil sans necessiter d\'attention consciente, liberant la bande passante cognitive pour la tache ennuyeuse. C\'est pour ca que "eteins la musique et concentre-toi" est un conseil contre-productif — la musique EST l\'outil de concentration.',
                            source: 'Buckle et al. 2021 ; communaute ADHD/autiste',
                            tag: 'outil'
                        },
                        {
                            name: 'Menu dopamine',
                            desc: 'Liste preparee a l\'avance de 5 a 10 activites classees par intensite, comme un menu de restaurant, a consulter quand l\'ennui frappe. La cle : cette liste doit etre construite AVANT la crise d\'ennui, pas pendant (pendant l\'inertie, on est trop paralyse pour trouver quoi faire). Structure type : "Entrees" (micro-boosts < 5 min : caresser un animal, boire un cafe, regarder une video courte, toucher un fidget), "Accompagnements" (a combiner avec une tache : musique, podcast, boisson chaude, bougie), "Plats" (engagement 15-60 min : interet special, jeu, craft, sport), "Desserts" (plaisir pur sans restriction), "Specials" (necessite planification : sortie, expo, concert). Regle importante de ADDitude Magazine : si TOUT semble ennuyeux meme sur le menu, commencer par les options corporelles (mouvement, eau, nourriture, air frais, changement de lumiere) — elles fonctionnent meme quand la motivation est a zero.',
                            source: 'ADDitude Magazine ; communaute ADHD/autiste',
                            tag: 'outil'
                        }
                    ]
                },
                {
                    title: 'Environnement',
                    icon: '\u{1F3E0}',
                    strategies: [
                        {
                            name: 'Zone low-demand',
                            desc: 'Amenager un espace physique dedie a la recuperation : textures douces (couverture, coussins), lumiere tamisee (pas de neons, lampe de bureau chaude ou variateur), et surtout ZERO attentes. C\'est un refuge pour les moments de vide ou de surcharge, pas un endroit ou "on devrait faire quelque chose". L\'ennui et la surcharge sensorielle sont lies de facon contre-intuitive : un environnement qui surcharge le systeme nerveux EMPECHE l\'engagement dans une activite, ce qui produit un ennui paradoxal ("je ne peux rien faire mais je m\'ennuie"). La zone low-demand rompt ce cercle en offrant un espace ou le systeme nerveux peut se reguler sans stimulation excessive. Y inclure des outils de stimming (fidgets, couverture lestee, casque anti-bruit) et des "entrees" du menu dopamine (livre, tablette, boisson). L\'objectif n\'est pas la productivite mais le reset neurologique.',
                            source: 'The Autistic Burnout ; clinique OT',
                            tag: 'env'
                        },
                        {
                            name: 'Reduire la friction sensorielle',
                            desc: 'La surcharge sensorielle nourrit directement l\'inertie : quand le systeme nerveux depense toute son energie a filtrer des stimuli agressifs (neons, bruits de fond, vetements qui grattent, temperature inadequate), il ne reste plus de bande passante pour l\'engagement cognitif. Modifications concretes par domaine : LUMIERE — remplacer les neons par des lampes de bureau a lumiere chaude, installer des variateurs, privilegier la lumiere naturelle. SON — bouchons d\'oreilles Loop (filtrent sans isoler), casque anti-bruit actif, machine a bruit blanc ou app (Noisli). VETEMENTS — eliminer systematiquement tout vetement qui irrite (etiquettes, coutures proeminentes, matieres synthetiques qui grattent), priviligier les textiles doux. ESPACE — desencombrer le champ visuel, reduire les couleurs vives, organiser pour que les objets utiles soient visibles et accessibles. Chaque source de friction sensorielle eliminee libere de la capacite cognitive pour l\'engagement et reduit la propension a l\'inertie.',
                            source: 'Sensory diet OT ; communaute autiste',
                            tag: 'env'
                        },
                        {
                            name: 'Routines-ancres',
                            desc: 'Creer 2 a 3 routines fixes dans la journee (matin, apres-midi, soir) qui servent de points de repere temporels et structurels. La previsibilite reduit l\'ennui anxieux — cette forme d\'ennui ou l\'on ne sait pas quoi faire ET ou l\'on est anxieux de ne pas savoir. Les routines-ancres ne doivent pas etre rigides (une routine inflexible devient une prison et sa rupture provoque une crise) mais souples avec des "zones de choix" integrees. Exemple : routine matin = lever + eau + etirement (fixe) + petit-dejeuner (choix libre) + 10 min interet special (fixe) + preparation journee (choix). La structure fixe elimine la friction de decision ("qu\'est-ce que je fais maintenant ?") qui est un des principaux declencheurs d\'inertie, tandis que les zones de choix preservent l\'autonomie et la flexibilite necessaires au bien-etre autistique.',
                            source: 'Autisme Info Service ; clinique adaptee',
                            tag: 'env'
                        },
                        {
                            name: 'Stimming autorise',
                            desc: 'Le stimming (auto-stimulation par mouvements repetitifs : balancement, manipulation d\'objets, tapping, humming) n\'est pas un comportement a eliminer — c\'est un mecanisme d\'autoregulation neurologique valide et efficace. Une etude sur 31 adultes autistes (21-56 ans) confirme que les participants voient le stimming comme un moyen efficace de gerer leurs experiences sensorielles et emotionnelles. L\'utiliser intentionnellement contre l\'ennui est une strategie reconnue. Formes de stimming utiles contre l\'inertie : fidgets tactiles (tangle, putty, billes magnetiques), stimming auditif (humming, tapping rythmique, musique repetitive), stimming vestibulaire (rocking en chaise a bascule, hamac, ballon d\'exercice), stimming oral (chewing-gum, macher quelque chose). Le point critique : supprimer le stimming (par masking social) AUGMENTE l\'inertie et la surcharge. S\'autoriser a stimmer librement, surtout dans les moments de vide, est therapeutique et non pas un signe de regression.',
                            source: 'Autistic Scholar ; etude sur 31 adultes',
                            tag: 'env'
                        },
                        {
                            name: 'Reset corporel (eau froide)',
                            desc: 'Technique de reset du systeme nerveux qui ne necessite AUCUNE decision cognitive — parfaite pour les moments de paralysie totale ou meme "choisir quoi faire" est impossible. Eau froide sur les poignets pendant 30 secondes, splash d\'eau froide sur le visage, glaçon dans la main, ou passer la tete sous le robinet froid. Le mecanisme est le "dive reflex" (reflexe de plongee) : le contact de l\'eau froide sur le visage et les poignets active le nerf vague et declenche une reponse parasympathique immediate — ralentissement du rythme cardiaque, redistribution du sang, "reset" du systeme nerveux autonome. L\'etat de figement (freeze response) est interrompu physiquement, sans que le cerveau ait besoin de "decider" quoi que ce soit. Alternatives : menthe forte (chewing-gum, huile essentielle sous le nez), contact avec quelque chose de tres chaud (tasse de the), changement brusque de temperature (ouvrir la fenetre en hiver). L\'important est le contraste sensoriel brutal qui "reconnecte" le corps et l\'esprit.',
                            source: 'Danckert et al. 2024 ; clinique OT',
                            tag: 'corps'
                        }
                    ]
                },
                {
                    title: 'Ce qui NE marche PAS',
                    icon: '\u{1F6AB}',
                    strategies: [
                        {
                            name: '"Motive-toi"',
                            desc: 'Le systeme de motivation autistique est fondamentalement different du systeme NT. Il est "interest-based" (base sur l\'interet intrinseque) et non "importance-based" (base sur l\'importance percue ou les consequences). On ne peut pas "creer" de la motivation pour une tache qui n\'active pas les circuits d\'interet du cerveau, tout comme on ne peut pas decider d\'avoir faim. Les recompenses externes, les consequences, la culpabilite — rien de tout ca ne genere la dopamine necessaire a l\'initiation si l\'activite n\'est pas intrinsequement engageante. Dire "motive-toi" a une personne autiste en inertie, c\'est comme dire "vois mieux" a une personne myope. Le probleme n\'est pas le manque de volonte mais le manque de carburant neurochimique. Les strategies qui marchent contournent ce mecanisme au lieu de le combattre : task stacking, micro-immersion dans l\'IS, body doubling, decomposition ultra-fine.',
                            source: 'Asperger Experts ; recherche sur la motivation',
                            tag: 'piege'
                        },
                        {
                            name: 'Recompenses externes',
                            desc: 'Intuitivement, "fais ca et tu auras une recompense" semble logique. Mais la recherche montre que les recompenses externes peuvent REDUIRE la motivation intrinseque a faire une activite (effet de sur-justification). Chez les personnes autistes, ce probleme est amplifie : si la tache est neurologiquement impossible a demarrer a cause de l\'inertie, la promesse d\'une recompense future ne fournit pas la dopamine MAINTENANT, au moment ou le cerveau en a besoin pour initier l\'action. La recompense est trop eloignee temporellement pour influencer le systeme dopaminergique present. De plus, les systemes de recompenses creent une dependance externe et sapent le sentiment d\'autonomie. Alternative : rendre la tache elle-meme plus stimulante (task stacking, gamification, lien avec l\'interet special) plutot que de promettre un plaisir ulterieur. Le carburant doit etre dans la tache, pas apres.',
                            source: 'Learn Play Thrive ; Asperger Experts',
                            tag: 'piege'
                        },
                        {
                            name: 'Forcer le demarrage',
                            desc: 'L\'inertie autistique n\'est PAS de la paresse, de la procrastination ou un manque de discipline. C\'est un phenomene neurologique ou le corps ne repond pas a la commande consciente — la personne VEUT agir mais ne PEUT pas demarrer. Forcer (par soi-meme ou par un tiers) a plusieurs effets deleteres : augmentation du stress et de la honte, aggravation du shutdown (arret total des fonctions cognitives/emotionnelles), epuisement des reserves d\'energie deja faibles, renforcement du cycle "echec → culpabilite → inertie aggravee". L\'etude Buckle (2021) montre que la strategie efficace n\'est pas de forcer mais de fournir une intervention externe compatible : changer l\'environnement, offrir un accompagnement (body doubling), proposer un starter step ultra-petit, ou simplement attendre un moment plus propice. Accepter que "ce n\'est pas le moment" et planifier un retry dans de meilleures conditions est souvent plus productif que de se battre contre l\'inertie.',
                            source: 'Buckle et al. 2021, Frontiers in Psychology',
                            tag: 'piege'
                        },
                        {
                            name: 'Techniques NT standards',
                            desc: 'Pomodoro (25 min travail / 5 min pause), GTD (Getting Things Done), to-do lists classiques — ces techniques presupposent toutes que l\'INITIATION de l\'action est facile et que le probleme est la gestion du temps ou l\'organisation. Pour une personne autiste, le probleme est en amont : c\'est l\'inertie au demarrage, pas la gestion du temps une fois en mouvement. Le Pomodoro impose en plus des interruptions regulieres qui brisent le flow autistique (inertie de mouvement → difficulte a reprendre apres la pause). Les to-do lists textuelles ne resolvent pas le probleme d\'initiation : on SAIT ce qu\'on doit faire, on n\'arrive pas a le DEMARRER. Ces techniques peuvent fonctionner SI elles sont adaptees : Pomodoro avec des durees flexibles (pas fixees a 25 min), to-do lists visuelles avec decomposition ultra-fine (Goblin Tools), GTD avec body doubling. Sans adaptation, elles risquent d\'ajouter de la culpabilite ("meme Pomodoro ne marche pas pour moi") a l\'inertie existante.',
                            source: 'communaute autiste ; Carmen ADHD',
                            tag: 'piege'
                        },
                        {
                            name: 'Ignorer le burnout',
                            desc: 'L\'ennui chronique — quand RIEN ne motive plus, meme les interets speciaux, pendant des semaines ou des mois — peut etre un signe de burnout autistique, un etat d\'epuisement specifique cause par le masking prolonge, la surcharge sensorielle cumulative, et l\'effort constant d\'adaptation a un monde neurotypique. Le burnout autistique est qualitativement different de la depression (meme s\'ils coexistent souvent) et de l\'epuisement professionnel NT. Signes distinctifs : perte d\'interet meme pour les interets speciaux, regression des competences (difficultes avec des taches qui etaient faciles), augmentation des besoins sensoriels, retrait social accru, fatigue qui ne s\'ameliore pas avec le repos. Si l\'ennui persiste malgre toutes les strategies ci-dessus, il est crucial d\'evaluer la possibilite d\'un burnout et d\'agir en consequence : reduire drastiquement les demandes, augmenter le repos, consulter un professionnel informe sur l\'autisme. Traiter le burnout comme un simple ennui et continuer a pousser aggrave considerablement la situation.',
                            source: 'The Autistic Burnout ; communaute autiste',
                            tag: 'piege'
                        }
                    ]
                }
            ],
            resources: [
                { name: 'Monotropism.org', url: 'https://monotropism.org', desc: 'Site de reference sur la theorie du monotropisme de Murray, Lawson et Lesser — explique le fonctionnement attentionnel autistique "en tunnel" et ses implications pour l\'ennui, le flow, les interets speciaux et la regulation. Articles scientifiques et accessibles.' },
                { name: 'The Autistic Burnout (Substack)', url: 'https://theautisticburnout.substack.com/p/the-diy-sensory-diet-for-autistic', desc: 'Guide complet DIY pour creer son propre regime sensoriel en tant qu\'adulte autiste. Couvre les exercices proprioceptifs (wall push, compressions), le stimming intentionnel, la pression profonde, et l\'organisation sensorielle de la journee. Ecrit par un adulte autiste diagnostique.' },
                { name: 'Focusmate', url: 'https://focusmate.com', desc: 'Plateforme de body doubling virtuel : sessions de travail en video (25, 50 ou 75 min) avec un partenaire aleatoire. Version gratuite disponible. Strategie validee par la recherche (Buckle 2021) comme l\'un des moyens les plus efficaces contre l\'inertie autistique. La presence silencieuse suffit — pas besoin de parler.' },
                { name: 'Boredom Lab (Waterloo)', url: 'https://uwaterloo.ca/boredom-lab/', desc: 'Laboratoire de recherche neurocognitive dirige par James Danckert a l\'Universite de Waterloo, specialise dans l\'ennui. Publie dans le Journal of Boredom Studies. Recherche recente (2024) sur les liens entre interoception et propension a l\'ennui — directement pertinent pour l\'autisme.' },
                { name: 'Autism Level UP', url: 'https://autismlevelup.com/interoception/', desc: 'Ressources pratiques sur l\'interoception adaptees aux personnes autistes : exercices concrets, explications accessibles du lien entre interoception alteree et difficultes quotidiennes (ennui, faim non percue, fatigue non identifiee). Approche validee par la recherche de Goodall et Danckert.' },
                { name: 'Asperger Experts — Motivation', url: 'https://www.aspergerexperts.com/topics/motivation/', desc: 'Explication detaillee de la difference entre motivation "interest-based" (autistique) et "importance-based" (neurotypique). Pourquoi les recompenses externes, la culpabilite et les consequences ne fonctionnent pas, et quelles strategies alternatives utiliser. Cree par des adultes autistes.' },
                { name: 'Thrive Autism Coaching', url: 'https://www.thriveautismcoaching.com/post/autism-and-motivation', desc: 'Guide pratique sur l\'autisme et la motivation par un coach specialise. Couvre le concept de "starter step" (premiere etape ultra-petite), le reframe de l\'inertie (ce n\'est pas de la paresse), et des strategies concretes pour contourner l\'inertie au repos au quotidien.' },
                { name: 'Goblin Tools', url: 'https://goblin.tools', desc: 'Suite d\'outils IA gratuits crees par un developpeur autiste. Magic ToDo decompose automatiquement les taches en micro-etapes avec estimation de difficulte. Formalizer reformule au ton voulu. Judge estime la complexite. Directement concu pour contourner la dysfonction executive et l\'inertie d\'initiation.' },
                { name: 'Bien-etre Autiste (blog FR)', url: 'https://bienetreautiste.com', desc: 'Blog francophone tenu par et pour des adultes autistes. Articles pratiques sur l\'interoception (exercices concrets de body scan, respiration, heartbeat tracking), la sensorialite, les strategies quotidiennes. Approche validee, accessible et sans culpabilisation. Ressource de premiere qualite en francais.' },
                { name: 'Autisme Monteregie (FR)', url: 'https://autismemonteregie.com', desc: 'Organisme quebecois offrant des strategies pratiques proposees PAR des adultes autistes dans le cadre de groupes de soutien. Couvre l\'inertie, la gestion sensorielle, les routines adaptees. Perspective francophone nord-americaine complementaire aux ressources europeennes.' },
                { name: 'Time Timer', url: 'https://www.timetimer.com', desc: 'Timer visuel avec disque rouge qui diminue progressivement, rendant le temps litteralement visible. Utile pour les personnes autistes qui ont des difficultes d\'interoception temporelle (ne pas sentir le temps passer). Aide au "cadrage fini" : visualiser combien de temps reste sur une tache reduit l\'anxiete de l\'infini et aide aux transitions. Utilise en clinique OT et en education structuree TEACCH.' }
            ]
        };
    }

    // --- Techniques data (se lever le matin / inertie) ---

    getTechniquesData() {
        return {
            intro: {
                title: 'Se lever le matin — Inertie autistique',
                desc: 'Le lit est un refuge sensoriel parfait (temperature, poids, texture). Se lever = affronter froid, lumiere, stimuli imprevisibles. L\'inertie autistique rend les transitions d\'etat extremement couteuses en energie — le cerveau n\'arrive pas a initier le mouvement meme quand la volonte est la. Ce n\'est PAS de la paresse. C\'est un phenomene neurologique decrit par Buckle et al. (2021) comme "no way out except from external intervention". Les techniques ci-dessous privilegient les declencheurs externes et la reduction de friction, car la volonte seule ne suffit pas contre l\'inertie.'
            },
            categories: [
                {
                    title: 'Techniques immediates (coince dans le lit)',
                    icon: '\u26A1',
                    strategies: [
                        {
                            name: 'Micro-etapes verbales',
                            desc: 'Se parler a voix haute en decomposant : "juste m\'asseoir, c\'est tout" → "poser les pieds au sol" → "debout". Chaque etape est non-menacante et faisable. Le cerveau autistique bloque sur la tache monolithique "se lever" — la decomposer en micro-actions contourne le blocage executif. Ne pas penser a la suite, juste le geste immediat.',
                            source: 'Life Skills Advocate ; communaute autiste',
                            tag: 'cognitif',
                            url: 'https://lifeskillsadvocate.com/blog/autistic-inertia-start-stop-switch/'
                        },
                        {
                            name: 'Compte a rebours 5-4-3-2-1',
                            desc: 'Compter a rebours 5-4-3-2-1 puis bouger immediatement (meme juste une main ou un pied). Le compte a rebours agit comme un declencheur externe qui court-circuite l\'analyse-paralysie du cortex prefrontal. Pour les cerveaux AuDHD, ca interrompt la boucle de rumination et declenche l\'action avant que l\'inertie ne se renforce.',
                            source: 'Mel Robbins ; ADDRC',
                            tag: 'cognitif',
                            url: 'https://www.addrc.org/beat-the-blanket-paralysis-morning-hacks-for-adhd-brains/'
                        },
                        {
                            name: 'Un seul micro-geste d\'amorce',
                            desc: 'S\'engager sur UNE seule action physique : boire le verre d\'eau pose a cote du lit, retirer la couette d\'un cote, bouger les orteils. L\'achevement d\'un micro-geste cree du momentum — le cerveau enchaine plus facilement apres un premier succes. L\'important est que le geste soit concret, physique et realisable sans effort cognitif.',
                            source: 'Talkiatry ; communaute ADHD',
                            tag: 'corps'
                        },
                        {
                            name: 'Intervention externe (personne/animal)',
                            desc: 'C\'est le facteur le plus efficace selon la recherche (Buckle 2021) : un toucher doux sur l\'epaule, une voix qui dit "c\'est l\'heure", un chat qui reclame ses croquettes, un chien qui doit sortir. L\'impulsion externe brise l\'inertie quand la volonte interne echoue. Si possible, demander a un proche de venir physiquement, pas juste appeler.',
                            source: 'Buckle et al. 2021, Frontiers in Psychology',
                            tag: 'externe'
                        },
                        {
                            name: 'Body doubling (presence silencieuse)',
                            desc: 'Avoir une autre personne presente (meme en visio/appel) pendant qu\'on tente de se lever. Pas besoin de parler — la simple presence cree une co-regulation douce et une redevabilite sans pression. Une meta-analyse (2022) montre que la co-regulation ameliore significativement l\'initiation de tache chez les autistes.',
                            source: 'Autism Awareness Centre ; NeuroNav',
                            tag: 'externe',
                            url: 'https://autismawarenesscentre.com/what-is-body-doubling/'
                        }
                    ]
                },
                {
                    title: 'Strategies sensorielles',
                    icon: '\u{1F31F}',
                    strategies: [
                        {
                            name: 'Lumiere progressive (sunrise)',
                            desc: 'Eviter le choc sensoriel de la lumiere soudaine. Utiliser une lampe sunrise ou smart bulb qui s\'allume graduellement 20-30 min avant le reveil. Respecte les sensibilites sensorielles et reduit le signal de "menace" que le cerveau associe au reveil brutal. Laisser les rideaux legerement ouverts pour la lumiere naturelle est aussi efficace.',
                            source: 'Autism Parenting Magazine',
                            tag: 'sensoriel',
                            url: 'https://www.autismparentingmagazine.com/slay-morning-routine-stress/'
                        },
                        {
                            name: 'Reveil sensoriel agreable (pas d\'alarme stridente)',
                            desc: 'Remplacer l\'alarme agressive par : musique douce, sons de nature, playlist specifique. Ajouter une odeur positive : cafe qui coule en automatique, diffuseur d\'huiles essentielles programme. L\'objectif est d\'associer le reveil a des sensations positives plutot qu\'a une agression. Le cerveau autistique reagit plus violemment aux stimuli aversifs.',
                            source: 'Autism-MMC ; ergotherapeutes',
                            tag: 'sensoriel',
                            url: 'https://www.autism-mmc.com/publications/wake-up/'
                        },
                        {
                            name: 'Temperature strategique',
                            desc: 'Dormir plus frais pour que se lever = aller vers la chaleur (pas l\'inverse). Programmer le chauffage pour qu\'il monte 30 min avant le reveil. Garder un peignoir/plaid chaud a portee de main. Le gradient thermique est un signal biologique puissant qui motive le mouvement naturellement sans effort cognitif.',
                            source: 'Golden Care Therapy',
                            tag: 'sensoriel'
                        },
                        {
                            name: 'Chaussons/peignoir au bord du lit',
                            desc: 'Le contact pieds nus sur sol froid est une barriere sensorielle majeure pour les autistes. Poser les chaussons de facon a les sentir en sortant les pieds du lit. Peignoir sur le montant du lit. Chaque micro-barriere sensorielle eliminee = un point de decision en moins ou l\'inertie pourrait se renforcer.',
                            source: 'Communaute autiste ; ergotherapie',
                            tag: 'sensoriel'
                        }
                    ]
                },
                {
                    title: 'Preparation la veille (reduire la friction)',
                    icon: '\u{1F319}',
                    strategies: [
                        {
                            name: 'Reveil loin du lit',
                            desc: 'Placer le telephone/reveil a 2+ metres du lit, idealement pres de la porte. Force a se lever pour l\'eteindre. Une fois debout, l\'inertie est partiellement brisee — le plus dur est le passage horizontal → vertical. Combine avec une alarme douce (pas stridente) pour ne pas commencer la journee en mode "combat".',
                            source: 'ADDRC',
                            tag: 'env',
                            url: 'https://www.addrc.org/beat-the-blanket-paralysis-morning-hacks-for-adhd-brains/'
                        },
                        {
                            name: 'Affichage visuel de la routine',
                            desc: 'Poster/tableau visible depuis le lit avec la sequence du matin en images ou mots simples. Les supports visuels reduisent la charge de memoire de travail et soulagent la fonction executive. Le cerveau n\'a pas a PLANIFIER la sequence, juste a SUIVRE ce qui est ecrit. Chaque etape sur la liste est un mini-declencheur externe.',
                            source: 'Orbrom ; TEACCH',
                            tag: 'env',
                            url: 'https://orbrom.com/using-visual-supports-and-schedules-to-improve-task-initiation-and-planning/'
                        },
                        {
                            name: 'Tache ancre (non-negociable)',
                            desc: 'Definir UNE seule action qui demarre la journee, toujours la meme : prendre ses medicaments (force a s\'asseoir), nourrir le chat (obligation + recompense emotionnelle), ouvrir les rideaux (force a se lever). Avec le temps, le cerveau autistique cree une association automatique reveil → tache ancre. La routine devient reflexe.',
                            source: 'HeyASD ; communaute autiste',
                            tag: 'env',
                            url: 'https://www.heyasd.com/blogs/autism/my-morning-routine-as-an-autistic-adult'
                        },
                        {
                            name: 'Vetements prepares + zero decision',
                            desc: 'Poser les vetements la veille, dans l\'ordre, visibles. Charger le telephone LOIN du lit (force a se deplacer pour le recuperer). Mettre la lumiere de la salle de bain sur un minuteur (deja allumee au reveil). Chaque decision eliminee = de l\'energie executive preservee pour le mouvement.',
                            source: 'Meristem ; communaute autiste',
                            tag: 'env'
                        },
                        {
                            name: 'Brain dump avant de dormir',
                            desc: 'Ecrire pendant 5 min tout ce qui est dans la tete avant de se coucher, sans organiser. Ca decharge la memoire de travail. Au matin, le cerveau n\'est pas encombre par les pensees de la veille et dispose de plus de ressources executives pour la transition du lever.',
                            source: 'AuDHD Psychiatry',
                            tag: 'cognitif',
                            url: 'https://www.audhdpsychiatry.co.uk/how-to-deal-with-task-paralysis/'
                        }
                    ]
                },
                {
                    title: 'Strategies cognitives & psychologiques',
                    icon: '\u{1F9E9}',
                    strategies: [
                        {
                            name: 'Focus temporel immediat (pas le jour entier)',
                            desc: 'NE PAS penser "je dois me lever, me doucher, m\'habiller, dejeuner, aller au travail..." — la cascade de taches declenche l\'anxiete qui renforce la paralysie. A la place : "je vais bouger mes jambes sur le cote du lit. C\'est tout." Ne s\'engager que sur les 3 prochaines secondes, jamais sur la journee entiere.',
                            source: 'Hello Klarity ; Talkiatry',
                            tag: 'cognitif',
                            url: 'https://www.helloklarity.com/post/task-paralysis-in-adhd-practical-solutions-for-when-you-just-cant-start/'
                        },
                        {
                            name: 'Recompense immediate apres le lever',
                            desc: 'Lier le fait de se lever a quelque chose de genuinement agreable : petit-dej prefere qui attend, 10 min d\'interet special, stim toy, texte a un ami. Le cerveau autistique fonctionne en motivation "interest-based" — il a besoin d\'un POURQUOI intrinsèquement motivant, pas d\'un devoir abstrait. Creer une boucle de renforcement positif.',
                            source: 'ADDRC ; Asperger Experts',
                            tag: 'cognitif',
                            url: 'https://www.addrc.org/beat-the-blanket-paralysis-morning-hacks-for-adhd-brains/'
                        },
                        {
                            name: 'Zero culpabilite (la honte renforce l\'inertie)',
                            desc: 'Tracker "je me suis leve" comme un succes, peu importe l\'heure. Celebrer les victoires partielles ("je me suis assis" = une victoire). Jamais de punition pour les echecs. La recherche montre que la honte et la culpabilite RENFORCENT l\'inertie autistique au lieu de la combattre. L\'auto-compassion ameliore l\'adherence a long terme.',
                            source: 'Talkiatry ; recherche comportementale',
                            tag: 'cognitif'
                        }
                    ]
                },
                {
                    title: 'Outils technologiques',
                    icon: '\u{1F4F1}',
                    strategies: [
                        {
                            name: 'Domotique matinale automatisee',
                            desc: 'Smart lights qui montent progressivement. Thermostat qui augmente la temperature 30 min avant. Cafetiere programmable. Assistant vocal qui annonce les etapes. Robot aspirateur qui demarre (force a degager le sol la veille). La technologie cree une pression environnementale sans necessiter de volonte.',
                            source: 'Communaute autiste ; smart home',
                            tag: 'outil'
                        },
                        {
                            name: 'Tiimo (app routines visuelles)',
                            desc: 'App concue pour les neurodivergents : timers visuels, constructeur de routine, notifications douces. Combine support visuel + conscience du temps + redevabilite externe. Alternative : Brili (routines etape par etape avec compte a rebours) ou Visual Schedule Planner.',
                            source: 'Tiimo App',
                            tag: 'outil',
                            url: 'https://www.tiimoapp.com/resource-hub/routines-strategies-autism'
                        },
                        {
                            name: 'Alarmy (reveil impossible a ignorer)',
                            desc: 'App d\'alarme qui exige une action physique pour s\'eteindre : prendre une photo d\'un objet dans la salle de bain, scanner un code-barres, resoudre un calcul, secouer le telephone X fois. Force le mouvement et l\'engagement cognitif. Alternative : "I Can\'t Wake Up" (meme principe).',
                            source: 'Communaute ADHD/AuDHD',
                            tag: 'outil'
                        },
                        {
                            name: 'Focusmate (body doubling programme)',
                            desc: 'Sessions de body doubling en video (25, 50 ou 75 min) avec un partenaire aleatoire. Version gratuite disponible. Programmer une session a l\'heure du reveil = engagement externe. La presence silencieuse suffit. Alternatives : Flow Club, Discord serveurs neurodivergents.',
                            source: 'Focusmate ; Buckle 2021',
                            tag: 'outil',
                            url: 'https://focusmate.com'
                        }
                    ]
                },
                {
                    title: 'Construction long terme (routine)',
                    icon: '\u{1F331}',
                    strategies: [
                        {
                            name: 'Meme heure, meme weekend',
                            desc: 'Le cerveau autistique a besoin de predictibilite. Une heure de reveil fixe — y compris le weekend — stabilise le rythme circadien. Choisir une heure realiste (pas idealiste), la tenir pendant 2+ semaines avant de juger. Les ecarts le weekend dereglent le rythme pour toute la semaine suivante.',
                            source: 'Autisme et Sommeil (FR) ; chronobiologie',
                            tag: 'routine',
                            url: 'https://www.autismeetsommeil.fr/ameliorer-sommeil-enfants-autisme/'
                        },
                        {
                            name: 'Micro-habit stacking (une habitude a la fois)',
                            desc: 'Semaine 1-2 : juste s\'asseoir quand l\'alarme sonne. Semaine 3-4 : s\'asseoir + boire de l\'eau. Semaine 5-6 : s\'asseoir + eau + debout. Ne pas tout changer d\'un coup — ca surcharge et decourage. Chaque micro-habitude ancree cree un rail neural automatique sur lequel la suivante se greffe.',
                            source: 'Empowered Neuro Families',
                            tag: 'routine',
                            url: 'https://www.empoweredneurofamilies.com/blog/doable-executive-functioning-tips-for-autistic-adults'
                        },
                        {
                            name: 'Ancres physiques de routine',
                            desc: 'Creer des signaux physiques invariables : meme playlist du matin (tous les jours), meme mug pour le cafe, meme premier geste (rideaux, puis salle de bain, puis cafe). Le cerveau autistique excelle en reconnaissance de pattern — exploiter cette force. Avec le temps, la sequence devient automatique et ne requiert plus d\'effort executif.',
                            source: 'Autisme123 ; communaute autiste',
                            tag: 'routine',
                            url: 'https://autisme123.com/quest-ce-que-lautisme/linertie/'
                        }
                    ]
                }
            ],
            resources: [
                { name: 'Neurodivergent Survival Guide — Inertie', url: 'https://neurodivergentsurvival.guide/struggles/autistic-inertia.html', desc: 'Guide complet sur l\'inertie autistique avec strategies pratiques testees par la communaute.' },
                { name: 'Life Skills Advocate — Inertie pratique', url: 'https://lifeskillsadvocate.com/blog/autistic-inertia-start-stop-switch/', desc: 'Techniques pratiques pour travailler avec l\'inertie autistique (start/stop/switch).' },
                { name: 'ADDRC — Beat the Blanket Paralysis', url: 'https://www.addrc.org/beat-the-blanket-paralysis-morning-hacks-for-adhd-brains/', desc: 'Hacks matinaux pour cerveaux ADHD/AuDHD : reveil, routine, strategies sensorielles.' },
                { name: 'HeyASD — Morning Routine autiste', url: 'https://www.heyasd.com/blogs/autism/my-morning-routine-as-an-autistic-adult', desc: 'Routine matinale d\'un adulte autiste : ce qui marche concretement au quotidien.' },
                { name: 'Tiimo App — Routines autisme', url: 'https://www.tiimoapp.com/resource-hub/routines-strategies-autism', desc: 'App de routines visuelles concue pour les neurodivergents, avec timers et notifications douces.' },
                { name: 'Goblin Tools — Decomposition taches', url: 'https://goblin.tools', desc: 'Suite d\'outils IA gratuits par un dev autiste. Magic ToDo decompose les taches en micro-etapes.' },
                { name: 'Focusmate — Body doubling', url: 'https://focusmate.com', desc: 'Body doubling virtuel : sessions video avec partenaire. Efficace contre l\'inertie au lever.' },
                { name: 'Autisme123 — L\'inertie (FR)', url: 'https://autisme123.com/quest-ce-que-lautisme/linertie/', desc: 'Explication francophone de l\'inertie autistique avec strategies concretes.' },
                { name: 'Buckle et al. 2021 — No Way Out', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8314008/', desc: 'Article fondateur : temoignages de premiere main sur l\'inertie autistique (Frontiers in Psychology).' }
            ]
        };
    }

    // --- Rendering ---

    async load() {
        console.log('Loading autism module...');
        this._loadReviews();
        this.render();
        if (!this.loaded) {
            this._setupEventDelegation();
        }
        this.loaded = true;
    }

    render() {
        this._wrapCounter = 0;
        const ressources = this.getRessourcesData();
        this.renderFormations(ressources.formations);
        this.renderLinksList('autism-articles', ressources.articles, 'articles');
        this.renderLinksList('autism-references', ressources.references, 'references');
        this.renderLinksList('autism-documents', ressources.documents, 'documents');
        this.renderContacts(ressources.contacts);

        this.renderSpecialists(this.getSpecialistsData());
        this.renderBookCategories(this.getBooksData());
        this.renderPublications(this.getPublicationsData());
        this.renderWebResources(this.getWebResourcesData());
        this.renderEnnui(this.getEnnuiData());
        this.renderTechniques(this.getTechniquesData());
    }

    // --- Ressources tab renderers ---

    renderFormations(formations) {
        const container = document.getElementById('autism-formations');
        if (!container) return;
        container.innerHTML = formations.map(f => {
            const id = `formations/${this._slugify(f.title)}`;
            const inner = `<a href="${f.url}" target="_blank" class="autism-link-card">
                <div class="autism-link-card-icon">${f.icon}</div>
                <div class="autism-link-card-title">${f.title}</div>
                <div class="autism-link-card-desc">${f.desc}</div>
                <span class="autism-link-card-tag ${f.tag}">${f.tag}</span>
            </a>`;
            return this._wrapWithReview(id, inner);
        }).join('');
    }

    renderLinksList(containerId, links, prefix) {
        const container = document.getElementById(containerId);
        if (!container) return;
        if (!links.length) {
            container.innerHTML = '<div class="autism-empty">Aucune ressource pour le moment</div>';
            return;
        }
        container.innerHTML = links.map(l => {
            const id = `${prefix}/${this._slugify(l.title)}`;
            const inner = `<a href="${l.url}" target="_blank" class="autism-link-row">
                <span class="autism-link-row-icon">${l.icon}</span>
                <div class="autism-link-row-info">
                    <div class="autism-link-row-title">${l.title}</div>
                    <div class="autism-link-row-meta">${l.meta}</div>
                </div>
                ${l.date ? `<span class="autism-link-row-date">${l.date}</span>` : ''}
                <span class="autism-link-row-arrow">&#8599;</span>
            </a>`;
            return this._wrapWithReview(id, inner);
        }).join('');
    }

    renderContacts(contacts) {
        const container = document.getElementById('autism-contacts');
        if (!container) return;
        container.innerHTML = contacts.map(c => {
            const id = `contacts/${this._slugify(c.name)}`;
            const inner = `<div class="autism-contact-row">
                <span class="autism-contact-icon">${c.icon}</span>
                <div class="autism-contact-info">
                    <div class="autism-contact-name">${c.name}</div>
                    <div class="autism-contact-role">${c.role}</div>
                </div>
                <div class="autism-contact-detail">${c.detail}</div>
            </div>`;
            return this._wrapWithReview(id, inner);
        }).join('');
    }

    // --- Specialists tab renderer ---

    renderSpecialists(domains) {
        const container = document.getElementById('autism-specialists');
        if (!container) return;
        container.innerHTML = domains.map(d => `
            <div class="autism-section">
                <h3 class="autism-section-title">${d.domain}</h3>
                <div class="autism-specialist-list">
                    ${d.specialists.map(s => {
                        const id = `specialists/${this._slugify(s.name)}`;
                        const inner = `<div class="autism-specialist-row">
                            <div class="autism-specialist-name">${s.name}</div>
                            <div class="autism-specialist-inst">${s.inst}</div>
                            <div class="autism-specialist-contrib">${s.contribution}</div>
                            <div class="autism-specialist-pubs">${s.pubs}</div>
                        </div>`;
                        return this._wrapWithReview(id, inner);
                    }).join('')}
                </div>
            </div>
        `).join('');
    }

    // --- Books tab renderer ---

    renderBookCategories(categories) {
        const container = document.getElementById('autism-books');
        if (!container) return;
        container.innerHTML = categories.map(cat => `
            <div class="autism-section">
                <h3 class="autism-section-title">${cat.category}</h3>
                <div class="autism-books-list">
                    ${cat.books.map(b => {
                        const id = `books/${this._slugify(b.title)}`;
                        const inner = `<div class="autism-book-card">
                            <div class="autism-book-cover">\u{1F4D6}</div>
                            <div class="autism-book-info">
                                <div class="autism-book-title">${b.title}</div>
                                <div class="autism-book-author">${b.author}</div>
                                <div class="autism-book-desc">${b.desc}</div>
                            </div>
                        </div>`;
                        return this._wrapWithReview(id, inner);
                    }).join('')}
                </div>
            </div>
        `).join('');
    }

    // --- Publications tab renderer ---

    renderPublications(data) {
        const pubContainer = document.getElementById('autism-publications');
        if (pubContainer) {
            pubContainer.innerHTML = data.themes.map(t => `
                <div class="autism-section">
                    <h3 class="autism-section-title">${t.theme}</h3>
                    <div class="autism-pub-list">
                        ${t.studies.map(s => {
                            const id = `pubs/${this._slugify(s.title.substring(0, 50))}`;
                            const inner = `<div class="autism-pub-row">
                                <div class="autism-pub-info">
                                    <div class="autism-pub-title">${s.title}</div>
                                    <div class="autism-pub-authors">${s.authors}</div>
                                </div>
                                <div class="autism-pub-journal">${s.journal}</div>
                                <div class="autism-pub-metric">${s.metric}</div>
                            </div>`;
                            return this._wrapWithReview(id, inner);
                        }).join('')}
                    </div>
                </div>
            `).join('');
        }

        const journalContainer = document.getElementById('autism-journals');
        if (journalContainer) {
            journalContainer.innerHTML = data.journals.map(j => {
                const id = `journals/${this._slugify(j.name)}`;
                const inner = `<div class="autism-journal-card">
                    <div class="autism-journal-name">${j.name}</div>
                    <div class="autism-journal-stat">${j.stat}</div>
                    <span class="autism-journal-tag ${j.tag}">${j.tag === 'top' ? 'Top Journal' : j.tag === 'new' ? 'Nouveau' : 'High IF'}</span>
                </div>`;
                return this._wrapWithReview(id, inner);
            }).join('');
        }
    }

    // --- Web tab renderer ---

    renderWebResources(categories) {
        const container = document.getElementById('autism-web-resources');
        if (!container) return;
        container.innerHTML = categories.map(cat => `
            <div class="autism-section">
                <h3 class="autism-section-title">${cat.category}</h3>
                <div class="autism-web-list">
                    ${cat.resources.map(r => {
                        const id = `web/${this._slugify(r.name)}`;
                        const inner = `<a href="${r.url}" target="_blank" class="autism-web-row">
                            <div class="autism-web-name">${r.name}</div>
                            <div class="autism-web-desc">${r.desc}</div>
                            <span class="autism-link-row-arrow">&#8599;</span>
                        </a>`;
                        return this._wrapWithReview(id, inner);
                    }).join('')}
                </div>
            </div>
        `).join('');
    }

    // --- Ennui tab renderer ---

    renderEnnui(data) {
        const container = document.getElementById('autism-ennui');
        if (!container) return;

        const introHtml = `
            <div class="autism-ennui-intro">
                <h3 class="autism-ennui-intro-title">${data.intro.title}</h3>
                <p class="autism-ennui-intro-desc">${data.intro.desc}</p>
            </div>`;

        const tagLabels = {
            theorie: 'Theorie', vecu: 'Vecu', corps: 'Corps',
            interet: 'Interet special', outil: 'Outil', env: 'Environnement', piege: 'Piege'
        };

        const categoriesHtml = data.categories.map(cat => `
            <div class="autism-section">
                <h3 class="autism-section-title">${cat.icon} ${cat.title}</h3>
                <div class="autism-ennui-strategies">
                    ${cat.strategies.map(s => {
                        const id = `ennui/${this._slugify(s.name)}`;
                        const linkPart = s.url ? `<a href="${s.url}" target="_blank" class="autism-ennui-link">&#8599; Voir</a>` : '';
                        const inner = `<div class="autism-ennui-card">
                            <div class="autism-ennui-card-header">
                                <span class="autism-ennui-card-name">${s.name}</span>
                                <span class="autism-ennui-tag ${s.tag}">${tagLabels[s.tag] || s.tag}</span>
                            </div>
                            <div class="autism-ennui-card-desc">${s.desc}</div>
                            <div class="autism-ennui-card-footer">
                                <span class="autism-ennui-card-source">${s.source}</span>
                                ${linkPart}
                            </div>
                        </div>`;
                        return this._wrapWithReview(id, inner);
                    }).join('')}
                </div>
            </div>
        `).join('');

        const resourcesHtml = `
            <div class="autism-section">
                <h3 class="autism-section-title">Ressources & outils</h3>
                <div class="autism-ennui-resources">
                    ${data.resources.map(r => {
                        const id = `ennui-res/${this._slugify(r.name)}`;
                        const inner = `<a href="${r.url}" target="_blank" class="autism-ennui-resource-card">
                            <div class="autism-ennui-resource-name">${r.name}</div>
                            <div class="autism-ennui-resource-desc">${r.desc}</div>
                            <span class="autism-link-row-arrow">&#8599;</span>
                        </a>`;
                        return this._wrapWithReview(id, inner);
                    }).join('')}
                </div>
            </div>`;

        container.innerHTML = introHtml + categoriesHtml + resourcesHtml;
    }

    // --- Techniques tab renderer ---

    renderTechniques(data) {
        const container = document.getElementById('autism-techniques');
        if (!container) return;

        const introHtml = `
            <div class="autism-tech-intro">
                <h3 class="autism-tech-intro-title">${data.intro.title}</h3>
                <p class="autism-tech-intro-desc">${data.intro.desc}</p>
            </div>`;

        const tagLabels = {
            cognitif: 'Cognitif', corps: 'Corps', externe: 'Externe',
            sensoriel: 'Sensoriel', env: 'Environnement', outil: 'Outil', routine: 'Routine'
        };

        const categoriesHtml = data.categories.map(cat => `
            <div class="autism-section">
                <h3 class="autism-section-title">${cat.icon} ${cat.title}</h3>
                <div class="autism-tech-strategies">
                    ${cat.strategies.map(s => {
                        const id = `tech/${this._slugify(s.name)}`;
                        const linkPart = s.url ? `<a href="${s.url}" target="_blank" class="autism-tech-link">&#8599; Source</a>` : '';
                        const inner = `<div class="autism-tech-card">
                            <div class="autism-tech-card-header">
                                <span class="autism-tech-card-name">${s.name}</span>
                                <span class="autism-tech-tag ${s.tag}">${tagLabels[s.tag] || s.tag}</span>
                            </div>
                            <div class="autism-tech-card-desc">${s.desc}</div>
                            <div class="autism-tech-card-footer">
                                <span class="autism-tech-card-source">${s.source}</span>
                                ${linkPart}
                            </div>
                        </div>`;
                        return this._wrapWithReview(id, inner);
                    }).join('')}
                </div>
            </div>
        `).join('');

        const resourcesHtml = `
            <div class="autism-section">
                <h3 class="autism-section-title">Ressources & references</h3>
                <div class="autism-tech-resources">
                    ${data.resources.map(r => {
                        const id = `tech-res/${this._slugify(r.name)}`;
                        const inner = `<a href="${r.url}" target="_blank" class="autism-tech-resource-card">
                            <div class="autism-tech-resource-name">${r.name}</div>
                            <div class="autism-tech-resource-desc">${r.desc}</div>
                            <span class="autism-link-row-arrow">&#8599;</span>
                        </a>`;
                        return this._wrapWithReview(id, inner);
                    }).join('')}
                </div>
            </div>`;

        container.innerHTML = introHtml + categoriesHtml + resourcesHtml;
    }

    // --- Tabs ---

    switchSubTab(tabName) {
        this.activeTab = tabName;

        document.querySelectorAll('.autism-subtab').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.subtab === tabName);
        });

        document.querySelectorAll('.autism-subtab-content').forEach(content => {
            content.classList.toggle('active', content.id === 'autism-tab-' + tabName);
        });
    }
}

const autismModule = new AutismModule();
window.autismModule = autismModule;
export default autismModule;
