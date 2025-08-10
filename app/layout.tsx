import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'OrderAI Drive-Through',
  description: 'Drive-through simulé avec IA et JSON structuré',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className="min-h-screen bg-gray-50 text-gray-900">
        {children}
      </body>
    </html>
  );
}


