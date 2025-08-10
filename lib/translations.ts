export const translations = {
    fr: {
        // Header
        appTitle: "Drive-Through IA",
        appSubtitle: "Commandez avec notre assistant intelligent",

        // Language selection
        chooseLanguage: "Choisissez votre langue",
        french: "Français",
        english: "Anglais",

        // Menu
        menu: "Menu",

        // Chat
        typePlaceholder: "Tapez votre message...",
        send: "Envoyer",
        assistantWriting: "Assistant écrit...",

        // Order
        order: "Commande",
        noOrder: "Aucune commande",
        quantity: "Quantité",
        total: "Total",

        // Status
        confirmed: "Confirmée",
        building: "En cours",

        // Completion
        orderConfirmed: "Commande confirmée !",
        paymentMessage: "RDV à la prochaine borne pour le paiement",

        // Errors
        errorOccurred: "Désolé, une erreur est survenue.",
    },

    en: {
        // Header
        appTitle: "AI Drive-Through",
        appSubtitle: "Order with our intelligent assistant",

        // Language selection
        chooseLanguage: "Choose your language",
        french: "French",
        english: "English",

        // Menu
        menu: "Menu",

        // Chat
        typePlaceholder: "Type your message...",
        send: "Send",
        assistantWriting: "Assistant writing...",

        // Order
        order: "Order",
        noOrder: "No order",
        quantity: "Quantity",
        total: "Total",

        // Status
        confirmed: "Confirmed",
        building: "Building",

        // Completion
        orderConfirmed: "Order confirmed!",
        paymentMessage: "Go to the next terminal for payment",

        // Errors
        errorOccurred: "Sorry, an error occurred.",
    }
} as const;

export type Locale = keyof typeof translations;

export function t(key: keyof typeof translations.fr, locale: Locale = 'fr'): string {
    return translations[locale][key] || translations.fr[key];
}
