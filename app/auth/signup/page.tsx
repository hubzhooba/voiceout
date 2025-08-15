'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    // First check if email already exists in profiles
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('email')
      .eq('email', email)
      .single()
    
    if (existingProfile) {
      toast({
        title: "Account Already Exists",
        description: "An account with this email already exists. Please login instead.",
        variant: "destructive",
      })
      setLoading(false)
      router.push('/auth/login')
      return
    }

    const { data: authData, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    })

    if (error) {
      // Check for specific error messages
      if (error.message.includes('already registered')) {
        toast({
          title: "Account Already Exists",
          description: "This email is already registered. Please login instead.",
          variant: "destructive",
        })
        router.push('/auth/login')
      } else {
        toast({
          title: "Signup Error",
          description: error.message,
          variant: "destructive",
        })
      }
    } else if (authData.user) {
      console.log('User created:', authData.user.id, authData.user.email)
      
      // Try to create profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          email: authData.user.email!,
          full_name: fullName,
        })
      
      if (profileError) {
        if (profileError.code === '23503') {
          // Foreign key violation - this shouldn't happen but handle it
          console.error('Critical error: User created but profile cannot be linked:', profileError)
          toast({
            title: "Account Setup Error",
            description: "There was an issue setting up your account. Please try logging in or contact support.",
            variant: "destructive",
          })
        } else if (profileError.code === '23505') {
          // Duplicate key - profile already exists, that's fine
          console.log('Profile already exists for user')
        } else {
          console.error('Profile creation error:', profileError)
        }
      }
      
      toast({
        title: "Success",
        description: "Please check your email to verify your account.",
      })
      router.push('/auth/login')
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create an Account</CardTitle>
          <CardDescription>Sign up to start managing your invoices</CardDescription>
        </CardHeader>
        <form onSubmit={handleSignup}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                type="text"
                placeholder="John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                minLength={6}
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Creating account...' : 'Sign Up'}
            </Button>
            <p className="text-sm text-muted-foreground text-center">
              Already have an account?{' '}
              <Link href="/auth/login" className="text-primary hover:underline">
                Login
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}