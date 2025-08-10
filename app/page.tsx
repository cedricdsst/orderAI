"use client";

import { useState } from "react";
import Menu from "@/components/Menu";
import OrderSummary from "@/components/OrderSummary";
import Chat from "@/components/Chat";
import LanguageSelector from "@/components/LanguageSelector";
import type { Order } from "@/lib/types";
import { translations, type Locale } from "@/lib/translations";

export default function Page() {
  const [order, setOrder] = useState<Order | null>(null);
  const [locale, setLocale] = useState<Locale | null>(null);

  if (!locale) {
    return <LanguageSelector onLanguageSelect={setLocale} />;
  }

  return (
    <div className="h-screen bg-gray-100">
      <div className="h-full flex flex-col max-w-7xl mx-auto bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              🍔 {translations[locale].appTitle}
            </h1>
            <p className="text-sm text-gray-600">
              {translations[locale].appSubtitle}
            </p>
          </div>
          <button
            onClick={() => setLocale(null)}
            className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1 rounded border border-gray-300"
          >
            {locale === "fr" ? "🇫🇷 FR" : "🇺🇸 EN"}
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Menu sidebar */}
        <div className="flex-1 min-w-80 bg-white border-r border-gray-200 flex flex-col">
          <Menu locale={locale} />
        </div>

        {/* Chat area */}
        <div className="w-full max-w-2xl flex flex-col bg-gray-50">
          <Chat onOrderChange={setOrder} locale={locale} />
        </div>

        {/* Order sidebar */}
        <div className="flex-1 min-w-80 bg-white border-l border-gray-200 flex flex-col">
          <OrderSummary order={order} locale={locale} />
        </div>
      </div>
    </div>
    </div>
  );
}


