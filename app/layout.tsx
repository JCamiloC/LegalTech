import type { Metadata } from "next";
import type { ReactNode } from "react";
import LlmStatusIndicator from "@/components/LlmStatusIndicator";
import "./globals.css";

export const metadata: Metadata = {
	title: "Asistente de Tutelas",
	description: "Apoyo para tutelas en despachos judiciales de Colombia",
};

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html lang="es">
			<body className="min-h-screen bg-slate-50 text-slate-900">
				{children}
				<LlmStatusIndicator />
			</body>
		</html>
	);
}
