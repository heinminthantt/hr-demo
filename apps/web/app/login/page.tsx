"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { supabase, supabaseConfigured } from "@/lib/supabase"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!supabaseConfigured) {
      router.replace("/")
      return
    }
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/")
    })
  }, [router])

  if (!supabaseConfigured) return null

  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>HR Admin</CardTitle>
          <CardDescription>Sign in with your staff account</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault()
              setBusy(true)
              setError("")
              const { error: err } = await supabase.auth.signInWithPassword({ email, password })
              setBusy(false)
              if (err) setError(err.message)
              else router.replace("/")
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <p className="text-destructive text-sm">{error}</p>}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
