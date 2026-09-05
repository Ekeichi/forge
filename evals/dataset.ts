/**
 * Jeu d'éval de la boucle agent.
 *
 * Les documents ci-dessous sont injectés dans un workspace jetable avant chaque
 * campagne. `chunkDocument` découpe par ligne : une ligne = un fait = un chunk,
 * ce qui rend le recall mesurable ligne par ligne.
 */

export const FIXTURE_DOCUMENTS = [
    {
        title: "Politique RH",
        lines: [
            "Les salariés de Forge disposent de 25 jours de congés payés par an.",
            "Toute demande de congés doit être déposée au moins 15 jours à l'avance.",
            "Le télétravail est autorisé jusqu'à 3 jours par semaine.",
        ],
    },
    {
        title: "Client Northwind",
        lines: [
            "Le client Northwind a signé un contrat de 120 000 euros.",
            "Le contrat Northwind est renouvelable chaque année au mois de janvier.",
            "L'interlocuteur principal chez Northwind est le service achats.",
        ],
    },
    {
        title: "Stack technique",
        lines: [
            "Forge est construit avec Next.js, Prisma et PostgreSQL.",
            "Les embeddings sont générés par le modèle all-MiniLM-L6-v2 en 384 dimensions.",
            "La recherche sémantique repose sur l'extension pgvector.",
        ],
    },
];

export type ExpectedTool = "search_documents" | "create_document" | "none";

export type EvalCase = {
    id: string;
    question: string;
    /** Outil que l'agent devrait choisir. C'est la métrique de routage. */
    expectedTool: ExpectedTool;
    /** Chunk attendu dans le top-5 du retriever (recall@5). */
    expectedChunk?: string;
    /** Fragments attendus dans la réponse finale (comparaison insensible à la casse). */
    expectedAnswerContains?: string[];
};

export const EVAL_CASES: EvalCase[] = [
    // --- doit interroger la base de connaissances ---------------------------
    {
        id: "rh-conges",
        question: "Combien de jours de congés payés ai-je par an ?",
        expectedTool: "search_documents",
        expectedChunk: "Les salariés de Forge disposent de 25 jours de congés payés par an.",
        expectedAnswerContains: ["25"],
    },
    {
        id: "rh-delai",
        question: "Quel délai dois-je respecter pour poser mes congés ?",
        expectedTool: "search_documents",
        expectedChunk: "Toute demande de congés doit être déposée au moins 15 jours à l'avance.",
        expectedAnswerContains: ["15"],
    },
    {
        id: "rh-teletravail",
        question: "On peut télétravailler combien de jours par semaine ?",
        expectedTool: "search_documents",
        expectedChunk: "Le télétravail est autorisé jusqu'à 3 jours par semaine.",
        expectedAnswerContains: ["3"],
    },
    {
        id: "client-montant",
        question: "Quel est le montant du contrat Northwind ?",
        expectedTool: "search_documents",
        expectedChunk: "Le client Northwind a signé un contrat de 120 000 euros.",
        expectedAnswerContains: ["120"],
    },
    {
        id: "client-renouvellement",
        question: "Quand le contrat Northwind est-il renouvelé ?",
        expectedTool: "search_documents",
        expectedChunk: "Le contrat Northwind est renouvelable chaque année au mois de janvier.",
        expectedAnswerContains: ["janvier"],
    },
    {
        id: "tech-embeddings",
        question: "Quel modèle d'embeddings est utilisé dans le projet ?",
        expectedTool: "search_documents",
        expectedChunk: "Les embeddings sont générés par le modèle all-MiniLM-L6-v2 en 384 dimensions.",
        expectedAnswerContains: ["MiniLM"],
    },
    {
        id: "tech-vecteurs",
        question: "Quelle extension Postgres utilise-t-on pour la recherche sémantique ?",
        expectedTool: "search_documents",
        expectedChunk: "La recherche sémantique repose sur l'extension pgvector.",
        expectedAnswerContains: ["pgvector"],
    },
    {
        // Information absente : on mesure le refus, pas la réponse.
        id: "hors-perimetre",
        question: "Quel est le budget marketing prévu pour 2027 ?",
        expectedTool: "search_documents",
        expectedAnswerContains: ["pas"],
    },

    // --- ne doit PAS interroger la base -------------------------------------
    {
        id: "calcul",
        question: "Combien font 17 multiplié par 3 ?",
        expectedTool: "none",
        expectedAnswerContains: ["51"],
    },
    {
        id: "geo",
        question: "Quelle est la capitale de l'Australie ?",
        expectedTool: "none",
        expectedAnswerContains: ["canberra"],
    },
    {
        id: "traduction",
        question: "Traduis le mot « bonjour » en anglais.",
        expectedTool: "none",
        expectedAnswerContains: ["hello"],
    },
    {
        id: "definition",
        question: "Qu'est-ce qu'une base de données relationnelle ?",
        expectedTool: "none",
    },
    {
        id: "code",
        question: "Écris une fonction JavaScript qui inverse une chaîne de caractères.",
        expectedTool: "none",
        expectedAnswerContains: ["reverse"],
    },

    // --- doit créer un document ---------------------------------------------
    {
        id: "creation-explicite",
        question: "Crée un document intitulé « Compte rendu » contenant les points abordés : budget et planning.",
        expectedTool: "create_document",
    },
    {
        id: "creation-implicite",
        question: "Enregistre une note dans le workspace : penser à relancer Northwind vendredi.",
        expectedTool: "create_document",
    },
];
