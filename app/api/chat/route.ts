import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { buildStructuredResponseSchema } from "@/lib/schema";
import { getMenu, findMenuItemById } from "@/lib/menu";
import type { Order, OrderItem } from "@/lib/types";

const apiKey = process.env.OPENAI_API_KEY;
const isProjectKey = typeof apiKey === "string" && apiKey.startsWith("sk-proj-");
const client = new OpenAI({
    apiKey,
    // Pour les clés projet (sk-proj-*), ne pas sur-spécifier org/project
    organization: isProjectKey ? undefined : (process.env.OPENAI_ORG || process.env.OPENAI_ORG_ID),
    project: isProjectKey ? undefined : (process.env.OPENAI_PROJECT || process.env.OPENAI_PROJECT_ID),
});

const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

function ensureOrderConsistency(proposed: Order, locale: string = "fr"): Order {
    // Normalize items: ensure only known IDs; force names/prices from MENU
    const normalizedItems: OrderItem[] = [];
    for (const item of proposed.items) {
        const menu = findMenuItemById(item.id, locale);
        if (!menu) {
            continue; // drop unknown items
        }
        const quantity = Number.isInteger(item.quantity) && item.quantity > 0 ? item.quantity : 1;
        const notes = (item.notes ?? "").slice(0, 120);
        normalizedItems.push({
            id: menu.id,
            name: menu.name, // Now uses the correct language
            quantity,
            unitPriceCents: menu.priceCents,
            notes,
        });
    }

    const subtotalCents = normalizedItems.reduce((sum, it) => sum + (it.unitPriceCents ?? 0) * it.quantity, 0);
    const taxCents = 0; // Pas de taxes séparées
    const totalCents = subtotalCents;

    const completed = Boolean((proposed as any).completed);
    return {
        orderId: proposed.orderId || crypto.randomUUID(),
        items: normalizedItems,
        currency: "EUR",
        subtotalCents,
        taxCents,
        totalCents,
        status: completed && normalizedItems.length > 0 ? "confirmed" : (proposed.status ?? "building"),
        completed,
        updatedAt: new Date().toISOString(),
    };
}

function detectCompletion(text: string | undefined): boolean {
    if (!text) return false;
    const t = text.toLowerCase();
    const phrases = [
        "c'est bon", "c bon", "c est bon", "ok c bon", "ok c'est bon", "ok c est bon",
        "c'est tout", "c est tout", "rien d'autre", "rien d autre", "rien de plus",
        "terminé", "termine", "je valide", "je confirme", "on valide", "on confirme",
        "passe au paiement", "payer", "paiement", "checkout", "that's all", "thats all", "no more", "all good",
        "that's it", "i'm done", "im done", "nothing else", "nothing more"
    ];
    return phrases.some((p) => t.includes(p));
}

function normalizeAssistantText(assistantText: string, orderCompleted: boolean, locale: string): string {
    if (!orderCompleted) return assistantText;
    const t = assistantText.toLowerCase();
    const asksMore = [
        "souhaitez-vous", "ajouter autre", "quelque chose d'autre", "autre chose", "encore", "voulez-vous ajouter",
        "would you like", "anything else", "add anything", "want to add"
    ].some(k => t.includes(k));
    if (asksMore || !assistantText.trim()) {
        return locale === "en"
            ? "Order confirmed. Go to the next terminal for payment."
            : "Commande confirmée. RDV à la prochaine borne pour le paiement.";
    }
    return assistantText;
}

export async function POST(req: NextRequest) {
    try {
        const { message, currentOrder, locale } = await req.json();
        const lang = locale === "en" ? "en" : "fr";
        const schema = buildStructuredResponseSchema(lang);
        const menu = getMenu(lang);

        const systemPrompts = {
            fr: `Tu es un agent de prise de commande pour un drive-through. \n
Règles importantes:\n
- Tu dois toujours répondre en français.\n
- N'utilise que les articles du menu fourni. Aucune hallucination.\n
- Retourne STRICTEMENT un JSON conforme au schéma.\n
- La réponse JSON doit contenir (1) assistant_text (ton message à l'utilisateur), (2) order (commande actuelle complète).\n
- L'objet order.items contient uniquement des articles avec des id et des name exactement égaux à ceux du menu.\n
- Limite les notes à des résumés concis.\n
- Fixe updatedAt/timestamp au format ISO.\n
- Utilise order.completed (booléen) et mets-le à true UNIQUEMENT si le client indique qu'il a terminé et ne veut rien d'autre. Si completed=true, ne propose plus d'ajouter d'autres articles; confirme la commande et indique d'aller au paiement.\n
Menu (id :: name :: prix €):\n${menu.map(s => `- ${s.name}:\n${s.items.map(i => `  • ${i.id} :: ${i.name} :: ${(i.priceCents / 100).toFixed(2)}€`).join('\n')}`).join('\n')}`,

            en: `You are a drive-through order-taking agent. \n
Important rules:\n
- You must always respond in English.\n
- Only use items from the provided menu. No hallucination.\n
- Return STRICTLY a JSON conforming to the schema.\n
- The JSON response must contain (1) assistant_text (your message to the user), (2) order (complete current order).\n
- The order.items object contains only items with id and name exactly matching those in the menu.\n
- Keep notes to concise summaries.\n
- Set updatedAt/timestamp in ISO format.\n
- Use order.completed (boolean) and set it to true ONLY if the customer indicates they are finished and want nothing else. If completed=true, don't suggest adding more items; confirm the order and indicate to go to payment.\n
Menu (id :: name :: price €):\n${menu.map(s => `- ${s.name}:\n${s.items.map(i => `  • ${i.id} :: ${i.name} :: €${(i.priceCents / 100).toFixed(2)}`).join('\n')}`).join('\n')}`
        };

        const sys = systemPrompts[lang];
        const historyNote = lang === "en"
            ? (currentOrder ? `Current order (client-side): ${JSON.stringify(currentOrder)}` : "No order yet.")
            : (currentOrder ? `Commande actuelle (côté client): ${JSON.stringify(currentOrder)}` : "Aucune commande encore.");

        const completion = await client.chat.completions.create({
            model: MODEL,
            response_format: { type: "json_schema", json_schema: schema },
            messages: [
                { role: "system", content: sys },
                { role: "user", content: message ?? "" },
                { role: "user", content: historyNote },
            ],
            temperature: 0.2,
        });

        const content = completion.choices[0]?.message?.content ?? "";
        let parsed: any;
        try {
            parsed = JSON.parse(content);
        } catch {
            // As a fallback, return minimal assistant text
            return NextResponse.json({ assistant_text: content || "", order: currentOrder ?? null, timestamp: new Date().toISOString() });
        }

        // Server-side guardrails + completion normalization
        const userIndicatedDone = detectCompletion(String(message ?? ""));
        const proposedOrder = { ...(parsed.order as Order), completed: Boolean(parsed?.order?.completed) || userIndicatedDone } as Order;
        const safeOrder = ensureOrderConsistency(proposedOrder, lang);
        const finalAssistant = normalizeAssistantText(String(parsed.assistant_text ?? ""), safeOrder.completed ?? false, lang);

        return NextResponse.json({
            assistant_text: finalAssistant,
            order: safeOrder,
            timestamp: parsed.timestamp ?? new Date().toISOString(),
        });
    } catch (err: any) {
        console.error(err);
        const status = err?.status ?? 500;
        const code = err?.code ?? err?.error?.code;
        const message = err?.message || "Unknown error";
        return NextResponse.json(
            {
                error: message,
                code,
                hint:
                    code === "insufficient_quota"
                        ? "Vérifiez le quota du projet/organisation associé à la clé. Si vous utilisez une clé sk-proj-*, assurez-vous que le projet a du crédit ou utilisez une clé liée à l'organisation avec quota. Vous pouvez aussi définir OPENAI_ORG et OPENAI_PROJECT."
                        : undefined,
                model: MODEL,
                context: {
                    keyType: isProjectKey ? "project-key" : "org-key",
                    orgHeaderProvided: Boolean(!isProjectKey && (process.env.OPENAI_ORG || process.env.OPENAI_ORG_ID)),
                    projectHeaderProvided: Boolean(!isProjectKey && (process.env.OPENAI_PROJECT || process.env.OPENAI_PROJECT_ID)),
                },
            },
            { status }
        );
    }
}