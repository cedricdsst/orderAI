"use client";

import { type Order } from "@/lib/types";
import { translations, type Locale } from "@/lib/translations";

interface OrderSummaryProps {
  order: Order | null;
  locale: Locale;
}

export default function OrderSummary({ order, locale }: OrderSummaryProps) {
  if (!order) {
    return (
      <>
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {translations[locale].order}
          </h2>
        </div>

        {/* Empty state */}
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center text-gray-500">
            <div className="text-4xl mb-2">🛒</div>
            <p className="text-sm">{translations[locale].noOrder}</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">
          {translations[locale].order}
        </h2>
        <p className="text-xs text-gray-500 mt-1">ID: {order.orderId.slice(0, 8)}...</p>
      </div>

      {/* Scrollable items only */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-2">
          {order.items.map((item, idx) => (
            <div key={`${item.id}-${idx}`} className="p-3 rounded-lg border border-gray-200">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">{item.name}</h4>
                  <p className="text-sm text-gray-500">{translations[locale].quantity}: {item.quantity}</p>
                  {item.notes && item.notes !== "" ? (
                    <p className="text-xs text-gray-600 mt-1 italic">{item.notes}</p>
                  ) : null}
                </div>
                <span className="font-semibold text-gray-900">
                  {((item.unitPriceCents ?? 0) * item.quantity / 100).toFixed(2)} €
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Fixed footer with total and status - always visible */}
      <div className="flex-shrink-0 border-t border-gray-200 bg-white p-4 space-y-4">
        {/* Total */}
        <div className={`p-4 rounded-lg border-2 ${order.completed
          ? "border-green-500 bg-green-50"
          : "border-gray-200 bg-gray-50"
          }`}>
          <div className="flex justify-between items-center">
            <span className="font-semibold text-gray-900">{translations[locale].total}</span>
            <span className={`text-xl font-bold ${order.completed ? "text-green-600" : "text-gray-900"
              }`}>
              {(order.totalCents / 100).toFixed(2)} €
            </span>
          </div>
        </div>

        {/* Status */}
        <div className="flex items-center justify-between text-sm">
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${order.status === 'confirmed' ? 'bg-green-100 text-green-800' :
            order.status === 'building' ? 'bg-blue-100 text-blue-800' :
              'bg-gray-100 text-gray-800'
            }`}>
            {order.status === 'confirmed' ? translations[locale].confirmed :
              order.status === 'building' ? translations[locale].building :
                order.status}
          </span>
          <span className="text-xs text-gray-500">
            {new Date(order.updatedAt).toLocaleTimeString()}
          </span>
        </div>

        {/* Completion message */}
        {order.completed ? (
          <div className="p-4 bg-green-600 text-white rounded-lg text-center">
            <div className="text-lg mb-1">🎉</div>
            <p className="font-medium">{translations[locale].orderConfirmed}</p>
            <p className="text-sm text-green-100 mt-1">
              {translations[locale].paymentMessage}
            </p>
          </div>
        ) : null}
      </div>
    </>
  );
}