import type { ReactNode } from "react";
import "./styles.css";
import ShaderBackground from "./ShaderBackground";

export const metadata = {
  title: "Help Me Comms",
  description: "Conversational community support and communications for game developers and modders.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ShaderBackground />
        {children}
      </body>
    </html>
  );
}
