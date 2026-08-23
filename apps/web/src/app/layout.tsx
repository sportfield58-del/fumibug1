import type { ReactNode } from 'react';

export const metadata = {
  title: 'Fumibug',
  description: 'Esqueleto Fase 0 — pantallas reales las construye OpenCode.',
};

export default function RootLayout({ children }: { children: ReactNode }): JSX.Element {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
