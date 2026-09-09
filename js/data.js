/* Catalogue DORCASHOP
   Chaque produit reprend exactement les informations et prix fournis par le client.
   "img" pointe vers une photo réelle fournie. "icon" est utilisé uniquement
   quand aucune photo n'a été fournie pour l'article (illustration sobre maison). */

const PRODUCTS = [
  {
    id: "cahiers-simples",
    name: "Cahiers simples",
    cats: ["fournitures", "etudiants"],
    img: "images/cahiers-simples.jpg",
    desc: "Disponibles en 100, 200 et 300 pages. Vendus à l'unité, au paquet ou au carton.",
    price: "À partir de 1 200 F",
    priceNote: "le paquet",
    badge: "GROS",
    details: {
      title: "Cahiers simples : tarifs",
      groups: [
        {
          h: "100 pages",
          rows: [
            ["Paquet", "1 200 F"],
            ["Carton", "17 000 F"],
            ["Cahier ultra résistant à l'eau (unité)", "350 F"],
            ["Paquet ultra résistant", "3 000 F"]
          ]
        },
        {
          h: "200 pages",
          rows: [
            ["Paquet", "1 200 F"],
            ["Carton", "17 000 F"]
          ]
        },
        {
          h: "300 pages",
          rows: [
            ["Paquet", "2 300 F"],
            ["Paquet cartonné", "4 000 F"]
          ]
        }
      ]
    }
  },
  {
    id: "cahiers-dessin",
    name: "Cahiers de dessin",
    cats: ["fournitures", "enfants"],
    img: "images/Cahiers de dessin.jpg",
    icon: "sketch",
    desc: "Pour les cours de dessin et les créations des enfants.",
    price: "100 F",
    priceNote: "l'unité"
  },
  {
    id: "bics-multicolores",
    name: "Bics multicolores",
    cats: ["fournitures", "etudiants"],
    img: "images/bics-multicolores.jpg",
    desc: "Sachet de bics de plusieurs couleurs, pratiques pour les cours et les corrections.",
    price: "1 200 F",
    priceNote: "le sachet"
  },
  {
    id: "bics-simples",
    name: "Bics simples",
    cats: ["fournitures", "etudiants", "gros"],
    img: "images/bics-simples.jpg",
    desc: "Stylos à bille pour l'école et le bureau, disponibles en gros volume.",
    price: "À partir de 2 500 F",
    priceNote: "le paquet",
    badge: "GROS",
    details: {
      title: "Bics simples : tarifs",
      groups: [
        {
          h: "Détail des prix",
          rows: [
            ["1 paquet", "2 500 F"],
            ["Carton", "5 000 F"]
          ]
        }
      ]
    }
  },
  {
    id: "regles-flexibles",
    name: "Règles flexibles",
    cats: ["fournitures", "enfants"],
    img: "images/regle-flexible.jpg",
    desc: "Règles souples et incassables, en petit et grand format.",
    price: "À partir de 200 F",
    priceNote: "l'unité",
    details: {
      title: "Règles flexibles : tarifs",
      groups: [
        {
          h: "Petit format",
          rows: [
            ["Unité", "200 F"],
            ["Douzaine", "2 000 F"]
          ]
        },
        {
          h: "Grand format",
          rows: [
            ["Unité", "250 F"],
            ["Douzaine", "2 500 F"]
          ]
        }
      ]
    }
  },
  {
    id: "instruments-maths",
    name: "Instruments de mathématiques",
    cats: ["fournitures", "etudiants"],
    img: "images/instruments-maths.jpg",
    desc: "Le kit complet : équerre, rapporteur, règle et compas.",
    price: "3 800 F",
    priceNote: "le complet"
  },
  {
    id: "dictionnaires",
    name: "Dictionnaires",
    cats: ["fournitures", "etudiants"],
    img: "images/dictionnaire-anglais.jpg",
    desc: "Larousse anglais et français, dictionnaires bilingues de poche.",
    price: "À partir de 2 000 F",
    priceNote: "l'unité",
    details: {
      title: "Dictionnaires : tarifs",
      groups: [
        {
          h: "Larousse",
          rows: [
            ["Larousse anglais", "2 500 F"],
            ["Larousse français", "2 000 F"]
          ]
        }
      ]
    }
  },
  {
    id: "vrais-dessinateurs",
    name: "Vrais dessinateurs",
    cats: ["fournitures", "etudiants"],
    img: "images/vrai-dessinateur.jpg",
    desc: "Kit de dessin technique pour les élèves et étudiants.",
    price: "450 F",
    priceNote: "l'unité",
    priceGros: "4 500 F la douzaine"
  },
  {
    id: "boites-couture",
    name: "Boîtes de couture",
    cats: ["maison"],
    img: "images/Boîte couture.jpg",
    icon: "sewing",
    desc: "Nécessaire de couture complet pour la maison.",
    price: "500 F",
    priceNote: "l'unité",
    priceGros: "5 000 F la douzaine"
  },
  {
    id: "art-conjuguer",
    name: "Art de conjuguer",
    cats: ["fournitures", "etudiants"],
    img: "images/art-de-conjuguer.jpg",
    desc: "Le Nouveau Bescherelle, dictionnaire de 12 000 verbes.",
    price: "1 200 F",
    priceNote: "l'unité",
    priceGros: "11 000 F la douzaine",
    badge: "PROMO"
  },
  {
    id: "mamadou-bineta",
    name: "Mamadou et Bineta",
    cats: ["enfants", "fournitures"],
    img: "images/mamadou et bineta.jpg",
    icon: "reader",
    desc: "Livre de lecture pour les tout premiers apprentissages.",
    price: "1 200 F",
    priceNote: "l'unité",
    priceGros: "12 000 F la douzaine"
  },
  {
    id: "syllabaire",
    name: "Syllabaire",
    cats: ["enfants"],
    img: "images/SYLLABAIRE.jpg",
    icon: "abc",
    desc: "Pour apprendre à lire les syllabes, étape par étape.",
    price: "1 200 F",
    priceNote: "l'unité"
  },
  {
    id: "lampe-rechargeable",
    name: "Lampe rechargeable à batterie",
    cats: ["maison"],
    img: "images/ampoule-rechargeable.jpg",
    desc: "Idéale en cas de coupure de courant, longue autonomie.",
    price: "2 000 F",
    priceNote: "l'unité",
    badge: "BON PLAN"
  },
  {
    id: "cahiers-tp",
    name: "Cahiers TP",
    cats: ["fournitures", "etudiants", "gros"],
    img: "images/Cahiers TP.jpg",
    icon: "notebook",
    desc: "Cahiers de travaux pratiques en 100 et 200 pages, avec ou sans papier RAM.",
    price: "À partir de 500 F",
    priceNote: "l'unité",
    badge: "GROS",
    details: {
      title: "Cahiers TP : tarifs",
      groups: [
        {
          h: "100 pages",
          rows: [
            ["TP", "500 F"],
            ["Paquet", "3 500 F"],
            ["Carton", "27 000 F"]
          ]
        },
        {
          h: "200 pages",
          rows: [
            ["TP", "700 F"],
            ["TP cartonné", "1 500 F"],
            ["Carton", "28 000 F"],
            ["TP sans papier RAM", "1 000 F"],
            ["Paquet TP sans papier RAM", "4 500 F"]
          ]
        }
      ]
    }
  },
  {
    id: "crayons-hb",
    name: "Crayons HB",
    cats: ["fournitures", "enfants"],
    img: "images/crayons-hb.jpg",
    desc: "Crayons à papier HB, vendus par lot de 12.",
    price: "250 F",
    priceNote: "le lot de 12"
  },
  {
    id: "crayons-guhwa",
    name: "Crayons GUHWA",
    cats: ["fournitures"],
    img: "images/crayons-guhwa.jpg",
    desc: "Crayons 2B, disponibles à l'unité ou par lot.",
    price: "50 F",
    priceNote: "l'unité",
    priceGros: "500 F le lot de 12"
  },
  {
    id: "anti-moustique",
    name: "Anti moustique",
    cats: ["maison"],
    img: "images/anti-moustique.jpg",
    desc: "Diffuseur électrique et liquide anti moustique, 480 heures d'autonomie.",
    price: "2 000 F",
    priceNote: "le kit"
  },
  {
    id: "ventilateur-bureau",
    name: "Ventilateur de bureau",
    cats: ["maison"],
    img: "images/ventilateur-bureau.jpg",
    desc: "Ventilateur sur pied, hauteur réglable, pour la maison ou le bureau.",
    price: "10 000 F",
    priceNote: "l'unité"
  },
  {
    id: "mini-ventilateur",
    name: "Mini ventilateur rechargeable",
    cats: ["maison"],
    img: "images/mini-ventilateur.jpg",
    desc: "Rechargeable, fonctionne avec deux batteries.",
    price: "10 000 F",
    priceNote: "l'unité",
    badge: "NOUVEAU"
  },
  {
    id: "ventilateur-solaire",
    name: "Ventilateur solaire",
    cats: ["maison"],
    img: "images/ventilateur-solaire.jpg",
    desc: "16 pouces, rechargeable et silencieux, avec panneau solaire.",
    price: "24 000 F",
    priceNote: "l'unité",
    badge: "NOUVEAU"
  },
  {
    id: "porte-brosse",
    name: "Porte brosse et pâte",
    cats: ["maison"],
    img: "images/porte-brosse-pate.jpg",
    desc: "Range proprement brosse à dents et dentifrice dans la salle de bain.",
    price: "1 300 F",
    priceNote: "l'unité"
  }
];

const CATEGORY_LABELS = {
  tous: "Tous",
  fournitures: "Fournitures scolaires",
  etudiants: "Étudiants",
  enfants: "Enfants",
  maison: "Maison",
  gros: "Gros"
};
