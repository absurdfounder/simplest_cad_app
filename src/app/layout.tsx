import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CAD Chat - 3D Model Viewer & Editor',
  description: 'Browser-based 3D CAD viewer with AI-assisted parametric editing',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-cad-bg text-cad-text">
        {children}
      </body>
    </html>
  );
}
