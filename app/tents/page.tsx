import { TentsList } from '@/components/tents/tents-list'

// Force dynamic rendering to avoid build-time Supabase errors
export const dynamic = 'force-dynamic'

export default function TentsPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Your Tents</h1>
        <p className="text-muted-foreground mt-2">
          Collaborate with clients and managers in your invoice management tents
        </p>
      </div>
      <TentsList />
    </div>
  )
}