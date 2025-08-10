"use client";

import { getMenu } from "@/lib/menu";
import { translations, type Locale } from "@/lib/translations";

interface MenuProps {
  locale: Locale;
}

export default function Menu({ locale }: MenuProps) {
  const menu = getMenu(locale);

  return (
    <>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">
          {translations[locale].menu}
        </h2>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-6">
          {menu.map((section) => (
            <div key={section.id}>
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
                {section.name}
              </h3>
              <div className="space-y-2">
                {section.items.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{item.name}</h4>
                        <p className="text-sm text-gray-500 mt-1">{item.id}</p>
                      </div>
                      <span className="font-semibold text-gray-900">
                        {(item.priceCents / 100).toFixed(2)} €
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}


