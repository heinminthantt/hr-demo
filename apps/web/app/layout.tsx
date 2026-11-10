import { Geist, Geist_Mono, Inter } from "next/font/google"

import "@workspace/ui/globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { AppearanceProvider } from "@/components/appearance-provider"
import { cn } from "@workspace/ui/lib/utils";

const inter = Inter({subsets:['latin'],variable:'--font-sans'})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", fontMono.variable, "font-sans", inter.variable)}
    >
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var a=JSON.parse(localStorage.getItem("hr-appearance-v1")||"{}");var r=document.documentElement;r.dataset.fontSize=a.fontSize||"md";r.dataset.density=a.density||"comfortable";r.dataset.radius=a.radius||"default";r.style.fontSize=a.fontSize==="sm"?"14px":a.fontSize==="lg"?"18px":"16px";r.style.setProperty("zoom",String((a.zoom||100)/100))}catch(e){}`,
          }}
        />
        <ThemeProvider>
          <AppearanceProvider>{children}</AppearanceProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
