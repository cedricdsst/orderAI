"use client";

import { translations } from "@/lib/translations";

interface LanguageSelectorProps {
    onLanguageSelect: (locale: "fr" | "en") => void;
}

export default function LanguageSelector({ onLanguageSelect }: LanguageSelectorProps) {
    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
                <div className="text-6xl mb-6">🍔</div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Drive-Through AI</h1>
                <p className="text-gray-600 mb-8">{translations.fr.chooseLanguage}</p>

                <div className="space-y-4">
                    <button
                        onClick={() => onLanguageSelect("fr")}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-6 rounded-xl transition-colors flex items-center justify-center gap-3 text-lg"
                    >
                        <span className="text-2xl">🇫🇷</span>
                        {translations.fr.french}
                    </button>

                    <button
                        onClick={() => onLanguageSelect("en")}
                        className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-4 px-6 rounded-xl transition-colors flex items-center justify-center gap-3 text-lg"
                    >
                        <span className="text-2xl">🇺🇸</span>
                        {translations.en.english}
                    </button>
                </div>
            </div>
        </div>
    );
}
