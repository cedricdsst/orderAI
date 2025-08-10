import { ALLOWED_ITEM_IDS, getAllowedItemNames } from "./menu";

export function buildStructuredResponseSchema(locale: string = "fr") {
  const allowedItemNames = getAllowedItemNames(locale);
  const description = locale === "en" ? "Text response to the user (English)" : "Réponse texte adressée à l'utilisateur (français)";
  const completedDescription = locale === "en" ? "True only if the customer has finished their order" : "True uniquement si le client a fini la commande";

  // JSON Schema Draft-07 compatible object
  return {
    name: "DriveResponse",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        assistant_text: { type: "string", description },
        order: {
          type: "object",
          additionalProperties: false,
          properties: {
            orderId: { type: "string" },
            status: { type: "string", enum: ["building", "confirmed", "paid", "cancelled"] },
            currency: { type: "string", enum: ["EUR"] },
            completed: { type: "boolean", description: completedDescription },
            items: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  id: { type: "string", enum: ALLOWED_ITEM_IDS },
                  name: { type: "string", enum: allowedItemNames },
                  quantity: { type: "integer", minimum: 1, maximum: 50 },
                  notes: { type: "string", maxLength: 120 },
                },
                // OpenAI strict schemas require `required` to list every property key present
                required: ["id", "name", "quantity", "notes"],
              },
              maxItems: 100,
            },
            subtotalCents: { type: "integer", minimum: 0 },
            taxCents: { type: "integer", minimum: 0 },
            totalCents: { type: "integer", minimum: 0 },
            updatedAt: { type: "string" },
          },
          required: ["orderId", "items", "currency", "subtotalCents", "taxCents", "totalCents", "status", "updatedAt", "completed"],
        },
        timestamp: { type: "string", description: "Horodatage ISO du tour" },
      },
      required: ["assistant_text", "order", "timestamp"],
    },
    strict: true,
  } as const;
}


