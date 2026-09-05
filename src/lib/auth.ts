import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import prisma from "./prisma";

const isProduction = process.env.NODE_ENV === "production";
const baseURL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

export const auth = betterAuth({
    appName: "Forge",
    baseURL,
    // Le secret n'a pas de valeur de repli : mieux vaut un demarrage qui echoue
    // qu'une signature de session avec une cle par defaut.
    secret: process.env.BETTER_AUTH_SECRET,

    database: prismaAdapter(prisma, {
        provider: "postgresql",
    }),

    // Origines autorisees a porter un cookie de session : sans liste explicite,
    // une origine tierce peut declencher des requetes authentifiees.
    trustedOrigins: [baseURL],

    emailAndPassword: {
        enabled: true,
        minPasswordLength: 12,
        maxPasswordLength: 128,
        // requireEmailVerification reste desactive tant qu'aucun envoi d'email
        // n'est branche : l'activer maintenant bloquerait toutes les connexions.
        requireEmailVerification: false,
    },

    session: {
        expiresIn: 60 * 60 * 24 * 7,   // 7 jours
        updateAge: 60 * 60 * 24,       // prolongee au plus une fois par jour
    },

    // Limitation des endpoints d'authentification (anti-bruteforce).
    // Stockage memoire par defaut : par instance, donc a basculer sur "database"
    // ou un store partage des qu'il y a plus d'une instance.
    rateLimit: {
        enabled: true,
        window: 60,
        max: 60,
        customRules: {
            "/sign-in/email": { window: 300, max: 5 },
            "/sign-up/email": { window: 3600, max: 10 },
            "/forget-password": { window: 3600, max: 5 },
        },
    },

    advanced: {
        useSecureCookies: isProduction,
    },
});
