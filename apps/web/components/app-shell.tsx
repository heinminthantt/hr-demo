"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import {
  RiBankCardLine,
  RiBarChartBoxLine,
  RiCalendarCheckLine,
  RiCarLine,
  RiFileList2Line,
  RiHome5Line,
  RiMailLine,
  RiReceiptLine,
  RiSettings3Line,
  RiTeamLine,
  RiUser3Line,
  RiUserSearchLine,
  RiWalletLine,
} from "@remixicon/react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@workspace/ui/components/sidebar"
import { Separator } from "@workspace/ui/components/separator"
import { TooltipProvider } from "@workspace/ui/components/tooltip"
import { Button } from "@workspace/ui/components/button"
import { GlobalSearch } from "@/components/global-search"
import { NotificationBell } from "@/components/notification-bell"
import { ThemeToggle } from "@/components/theme-toggle"
import { supabase, supabaseConfigured } from "@/lib/supabase"

const NAV = [
  { href: "/", label: "Overview", icon: RiHome5Line },
  { href: "/employees", label: "Employees", icon: RiUser3Line },
  { href: "/attendance", label: "Attendance", icon: RiCalendarCheckLine },
  { href: "/forms", label: "Forms", icon: RiFileList2Line },
  { href: "/team-tasks", label: "Team Tasks", icon: RiTeamLine },
  { href: "/payroll", label: "Payroll", icon: RiBankCardLine },
  { href: "/payslips", label: "Payslips", icon: RiReceiptLine },
  { href: "/reports", label: "Reports", icon: RiBarChartBoxLine },
  { href: "/recruitment", label: "Recruitment", icon: RiUserSearchLine },
  { href: "/fuel-vehicles", label: "Fuel & Vehicles", icon: RiCarLine },
  { href: "/expense-claims", label: "Expense Claims", icon: RiWalletLine },
  { href: "/gmail-automation", label: "Gmail Automation", icon: RiMailLine },
  { href: "/settings", label: "Settings", icon: RiSettings3Line },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [ready, setReady] = useState(false)
  const [email, setEmail] = useState("")

  useEffect(() => {
    if (!supabaseConfigured) {
      setEmail("Local demo")
      setReady(true)
      return
    }
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setEmail(data.session.user.email ?? "")
        setReady(true)
      } else {
        router.replace("/login")
      }
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setEmail(session.user.email ?? "")
        setReady(true)
      } else {
        router.replace("/login")
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [router])

  if (!ready) return null

  const signOut = async () => {
    await supabase.auth.signOut()
    router.replace("/login")
  }

  const section = NAV.find(({ href }) => (href === "/" ? pathname === "/" : pathname.startsWith(href)))?.label ?? "Overview"

  return (
    <SidebarProvider>
      <TooltipProvider>
        <Sidebar collapsible="icon" className="print:hidden">
          <SidebarHeader>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton size="lg" render={<Link href="/" />}>
                  <span className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                    <RiBankCardLine className="size-4" />
                  </span>
                  <span className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">HR Admin</span>
                    <span className="text-muted-foreground truncate text-xs">Myanmar payroll</span>
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {NAV.map(({ href, label, icon: Icon }) => {
                    const active = href === "/" ? pathname === "/" : pathname.startsWith(href)
                    return (
                      <SidebarMenuItem key={href}>
                        <SidebarMenuButton render={<Link href={href} />} isActive={active} tooltip={label}>
                          <Icon />
                          <span>{label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter>
            <SidebarMenu>
              <SidebarMenuItem>
                <div className="text-muted-foreground grid flex-1 px-1 text-left text-xs leading-tight">
                  <span className="truncate">{email}</span>
                  <span>{supabaseConfigured ? "Signed in" : "Browser demo data"}</span>
                </div>
              </SidebarMenuItem>
              {supabaseConfigured && (
                <SidebarMenuItem>
                  <Button variant="outline" size="sm" className="w-full" onClick={signOut}>
                    Sign out
                  </Button>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset>
          <header className="bg-background/95 sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b px-3 backdrop-blur md:px-4 print:hidden">
            <SidebarTrigger />
            <Separator orientation="vertical" className="!h-5" />
            <span className="hidden truncate text-sm font-medium sm:block">{section}</span>
            <div className="ml-auto flex items-center gap-1">
              {!supabaseConfigured && (
                <span className="text-muted-foreground mr-1 hidden items-center gap-1.5 rounded-full border border-dashed px-2.5 py-1 text-xs lg:flex">
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  Local demo
                </span>
              )}
              <GlobalSearch />
              <NotificationBell />
              <ThemeToggle />
              {supabaseConfigured && (
                <Button variant="outline" size="sm" onClick={signOut}>
                  Sign out
                </Button>
              )}
            </div>
          </header>
          <main className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6 lg:p-8">{children}</main>
        </SidebarInset>
      </TooltipProvider>
    </SidebarProvider>
  )
}
