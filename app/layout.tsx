import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
	title: "Sistema Interno de Apoyo Jurídico",
	description: "Apoyo técnico para calificación de demandas en juzgados civiles municipales de Colombia",
};

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html lang="es">
			<body className="min-h-screen bg-slate-50 text-slate-900">
				{children}
			</body>
		</html>
	);
}
