'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import {
  Rocket,
  User,
  Briefcase,
  Target,
  ChevronRight,
  ChevronLeft,
  Check,
  Sparkles,
  Tent,
  FileText,
  Users,
  TrendingUp,
  Heart,
  PartyPopper,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/hooks/use-toast'

interface WelcomeFlowProps {
  userId: string
  onComplete?: () => void
}

const steps = [
  {
    title: "Welcome to VoiceOut! 🎉",
    description: "Let's get you set up in just a few steps",
    icon: Rocket,
    color: "from-blue-500 to-purple-600",
  },
  {
    title: "Tell us about yourself",
    description: "This helps us personalize your experience",
    icon: User,
    color: "from-purple-500 to-pink-600",
  },
  {
    title: "What's your primary role?",
    description: "We'll customize your dashboard accordingly",
    icon: Briefcase,
    color: "from-green-500 to-teal-600",
  },
  {
    title: "Set your goals",
    description: "What would you like to achieve?",
    icon: Target,
    color: "from-orange-500 to-red-600",
  },
  {
    title: "You're all set! 🚀",
    description: "Let's dive into your new workspace",
    icon: PartyPopper,
    color: "from-pink-500 to-purple-600",
  },
]

export function WelcomeFlow({ userId, onComplete }: WelcomeFlowProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [userData, setUserData] = useState({
    fullName: '',
    companyName: '',
    role: 'creator',
    goals: [] as string[],
  })
  const [isCompleting, setIsCompleting] = useState(false)
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()

  const progress = ((currentStep + 1) / steps.length) * 100
  const CurrentIcon = steps[currentStep].icon

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleComplete = async () => {
    setIsCompleting(true)
    try {
      // Save user preferences
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: userData.fullName,
          onboarding_completed: true,
          preferences: {
            role: userData.role,
            company: userData.companyName,
            goals: userData.goals,
          }
        })
        .eq('id', userId)

      if (error) throw error

      // Celebration!
      toast({
        title: "🎉 Welcome aboard!",
        description: "Your workspace is ready. Let's create something amazing!",
      })

      if (onComplete) {
        onComplete()
      } else {
        router.push('/dashboard')
      }
    } catch (error) {
      console.error('Error completing onboarding:', error)
      toast({
        title: 'Error',
        description: 'Failed to save your preferences. You can update them later in settings.',
        variant: 'destructive',
      })
      router.push('/dashboard')
    } finally {
      setIsCompleting(false)
    }
  }

  const toggleGoal = (goal: string) => {
    setUserData(prev => ({
      ...prev,
      goals: prev.goals.includes(goal)
        ? prev.goals.filter(g => g !== goal)
        : [...prev.goals, goal]
    }))
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      {/* Background decorations */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-200/30 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-200/30 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-2xl relative z-10"
      >
        {/* Progress bar */}
        <div className="mb-8">
          <Progress value={progress} className="h-2" />
          <p className="text-center text-sm text-gray-600 mt-2">
            Step {currentStep + 1} of {steps.length}
          </p>
        </div>

        <Card className="p-8 shadow-2xl border-0 bg-white/90 backdrop-blur">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {/* Step header */}
              <div className="text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200 }}
                  className={`inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br ${steps[currentStep].color} mb-4`}
                >
                  <CurrentIcon className="h-10 w-10 text-white" />
                </motion.div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  {steps[currentStep].title}
                </h2>
                <p className="text-gray-600">
                  {steps[currentStep].description}
                </p>
              </div>

              {/* Step content */}
              <div className="space-y-4">
                {currentStep === 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center space-y-4"
                  >
                    <div className="grid grid-cols-4 gap-4 my-8">
                      <div className="text-center">
                        <div className="p-3 bg-blue-100 rounded-lg inline-block">
                          <Tent className="h-6 w-6 text-blue-600" />
                        </div>
                        <p className="text-xs mt-2 text-gray-600">Collaborate</p>
                      </div>
                      <div className="text-center">
                        <div className="p-3 bg-green-100 rounded-lg inline-block">
                          <FileText className="h-6 w-6 text-green-600" />
                        </div>
                        <p className="text-xs mt-2 text-gray-600">Invoice</p>
                      </div>
                      <div className="text-center">
                        <div className="p-3 bg-purple-100 rounded-lg inline-block">
                          <Users className="h-6 w-6 text-purple-600" />
                        </div>
                        <p className="text-xs mt-2 text-gray-600">Manage</p>
                      </div>
                      <div className="text-center">
                        <div className="p-3 bg-orange-100 rounded-lg inline-block">
                          <TrendingUp className="h-6 w-6 text-orange-600" />
                        </div>
                        <p className="text-xs mt-2 text-gray-600">Grow</p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600">
                      Your all-in-one platform for seamless invoice management and team collaboration
                    </p>
                  </motion.div>
                )}

                {currentStep === 1 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-4"
                  >
                    <div>
                      <Label htmlFor="fullName">Your Name</Label>
                      <Input
                        id="fullName"
                        placeholder="John Doe"
                        value={userData.fullName}
                        onChange={(e) => setUserData({ ...userData, fullName: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="company">Company/Organization (Optional)</Label>
                      <Input
                        id="company"
                        placeholder="Acme Inc."
                        value={userData.companyName}
                        onChange={(e) => setUserData({ ...userData, companyName: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                  </motion.div>
                )}

                {currentStep === 2 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-3"
                  >
                    <button
                      onClick={() => setUserData({ ...userData, role: 'creator' })}
                      className={`w-full p-4 rounded-lg border-2 transition-all ${
                        userData.role === 'creator'
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <User className="h-5 w-5 text-blue-600" />
                        </div>
                        <div className="text-left">
                          <p className="font-semibold">Creator/Freelancer</p>
                          <p className="text-sm text-gray-600">I create and submit invoices</p>
                        </div>
                        {userData.role === 'creator' && (
                          <Check className="h-5 w-5 text-blue-600 ml-auto" />
                        )}
                      </div>
                    </button>
                    
                    <button
                      onClick={() => setUserData({ ...userData, role: 'manager' })}
                      className={`w-full p-4 rounded-lg border-2 transition-all ${
                        userData.role === 'manager'
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 rounded-lg">
                          <Briefcase className="h-5 w-5 text-purple-600" />
                        </div>
                        <div className="text-left">
                          <p className="font-semibold">Manager/Client</p>
                          <p className="text-sm text-gray-600">I review and approve invoices</p>
                        </div>
                        {userData.role === 'manager' && (
                          <Check className="h-5 w-5 text-purple-600 ml-auto" />
                        )}
                      </div>
                    </button>

                    <button
                      onClick={() => setUserData({ ...userData, role: 'both' })}
                      className={`w-full p-4 rounded-lg border-2 transition-all ${
                        userData.role === 'both'
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 rounded-lg">
                          <Users className="h-5 w-5 text-green-600" />
                        </div>
                        <div className="text-left">
                          <p className="font-semibold">Both</p>
                          <p className="text-sm text-gray-600">I do both depending on the project</p>
                        </div>
                        {userData.role === 'both' && (
                          <Check className="h-5 w-5 text-green-600 ml-auto" />
                        )}
                      </div>
                    </button>
                  </motion.div>
                )}

                {currentStep === 3 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-3"
                  >
                    <p className="text-sm text-gray-600 mb-4">Select all that apply:</p>
                    {[
                      { id: 'streamline', label: 'Streamline invoice management', icon: FileText },
                      { id: 'collaborate', label: 'Better collaboration with clients', icon: Users },
                      { id: 'track', label: 'Track payments and revenue', icon: TrendingUp },
                      { id: 'automate', label: 'Automate repetitive tasks', icon: Sparkles },
                      { id: 'grow', label: 'Grow my business', icon: Rocket },
                    ].map((goal) => (
                      <button
                        key={goal.id}
                        onClick={() => toggleGoal(goal.id)}
                        className={`w-full p-3 rounded-lg border-2 transition-all ${
                          userData.goals.includes(goal.id)
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <goal.icon className="h-5 w-5 text-gray-600" />
                          <span className="text-left flex-1">{goal.label}</span>
                          {userData.goals.includes(goal.id) && (
                            <Check className="h-5 w-5 text-blue-600" />
                          )}
                        </div>
                      </button>
                    ))}
                  </motion.div>
                )}

                {currentStep === 4 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center space-y-4"
                  >
                    <div className="flex justify-center gap-2 my-8">
                      <motion.div
                        animate={{ rotate: [0, 10, -10, 0] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                      >
                        <Heart className="h-8 w-8 text-red-500" />
                      </motion.div>
                      <motion.div
                        animate={{ y: [0, -10, 0] }}
                        transition={{ repeat: Infinity, duration: 1.5 }}
                      >
                        <Sparkles className="h-8 w-8 text-yellow-500" />
                      </motion.div>
                      <motion.div
                        animate={{ rotate: [0, -10, 10, 0] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                      >
                        <PartyPopper className="h-8 w-8 text-purple-500" />
                      </motion.div>
                    </div>
                    <p className="text-lg font-medium text-gray-900">
                      Welcome to your new creative home, {userData.fullName || 'Creator'}!
                    </p>
                    <p className="text-sm text-gray-600">
                      Your workspace is ready. Let&apos;s start building something amazing together.
                    </p>
                  </motion.div>
                )}
              </div>

              {/* Navigation buttons */}
              <div className="flex justify-between pt-6">
                <Button
                  variant="outline"
                  onClick={handleBack}
                  disabled={currentStep === 0}
                  className={currentStep === 0 ? 'invisible' : ''}
                >
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>

                {currentStep < steps.length - 1 ? (
                  <Button onClick={handleNext}>
                    Next
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    onClick={handleComplete}
                    disabled={isCompleting}
                    className="bg-gradient-to-r from-blue-500 to-purple-600 text-white"
                  >
                    {isCompleting ? 'Setting up...' : 'Start Creating'}
                    <Rocket className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </Card>

        {/* Skip option */}
        <div className="text-center mt-6">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Skip for now
          </button>
        </div>
      </motion.div>
    </div>
  )
}