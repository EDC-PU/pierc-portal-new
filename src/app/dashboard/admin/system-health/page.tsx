"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, CheckCircle, XCircle, AlertTriangle, RefreshCw, ShieldCheck } from "lucide-react"
import { PageHeader } from "@/components/page-header"

interface TestResult {
  status: "success" | "error" | "warning"
  message: string
  [key: string]: any
}

interface HealthCheckResult {
  timestamp: string
  overallStatus: "success" | "error"
  message: string
  tests: {
    firestore: TestResult
    auth: TestResult
    storage: TestResult
    serviceAccount: TestResult
  }
  debug: {
    environment: {
      hasClientEmail: boolean;
      hasPrivateKey: boolean;
      hasPublicProjectId: boolean;
      hasPublicStorageBucket: boolean;
      publicProjectId?: string;
      publicStorageBucket?: string;
    }
    initializationStatus: string
  }
}

export default function SystemHealthPage() {
  const [healthData, setHealthData] = useState<HealthCheckResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const runHealthCheck = async () => {
    setLoading(true)
    setError(null)
    setHealthData(null);

    try {
      const response = await fetch("/api/test-firebase")
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || data.details || "Health check failed with status " + response.status)
      }

      setHealthData(data)
    } catch (err: any) {
      setError(err.message)
      console.error("Health check error:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    runHealthCheck()
  }, [])

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case "success":
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case "error":
        return <XCircle className="h-5 w-5 text-red-500" />
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />
      default:
        return <Loader2 className="h-5 w-5 animate-spin" />
    }
  }

  const getStatusBadge = (status?: string) => {
    if (!status) return null;
    const variants = {
      success: "default",
      error: "destructive",
      warning: "secondary",
    } as const

    return <Badge variant={variants[status as keyof typeof variants] || "outline"}>{status.toUpperCase()}</Badge>
  }

  return (
    <div className="space-y-6">
      <PageHeader title="System Health" description="Monitor the health and connectivity of Firebase services" />

      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          {healthData && (
            <>
              {getStatusIcon(healthData.overallStatus)}
              <span className="font-medium">{healthData.message}</span>
              {getStatusBadge(healthData.overallStatus)}
            </>
          )}
        </div>

        <Button onClick={runHealthCheck} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Run Health Check
        </Button>
      </div>

      {loading && !healthData && (
        <Card>
            <CardContent className="p-6 flex justify-center items-center">
                <Loader2 className="h-6 w-6 animate-spin mr-4" />
                <p>Running health checks...</p>
            </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
          <CardHeader>
            <CardTitle className="text-red-800 dark:text-red-300 flex items-center gap-2">
              <XCircle className="h-5 w-5" />
              Health Check Failed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-700 dark:text-red-200">{error}</p>
          </CardContent>
        </Card>
      )}

      {healthData && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Environment & Initialization</CardTitle>
              <CardDescription>Server-side environment variables and Admin SDK status.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                <div>
                  <h4 className="font-medium mb-2">Server Environment Variables</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between"><span>FIREBASE_CLIENT_EMAIL:</span><span className={healthData.debug.environment.hasClientEmail ? "text-green-500 font-semibold" : "text-red-500 font-semibold"}>{healthData.debug.environment.hasClientEmail ? "Set" : "Missing"}</span></div>
                    <div className="flex justify-between"><span>FIREBASE_PRIVATE_KEY:</span><span className={healthData.debug.environment.hasPrivateKey ? "text-green-500 font-semibold" : "text-red-500 font-semibold"}>{healthData.debug.environment.hasPrivateKey ? "Set" : "Missing"}</span></div>
                    <div className="flex justify-between"><span>NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET:</span><span className={healthData.debug.environment.hasPublicStorageBucket ? "text-green-500 font-semibold" : "text-red-500 font-semibold"}>{healthData.debug.environment.hasPublicStorageBucket ? "Set" : "Missing"}</span></div>
                  </div>
                </div>
                 <div>
                  <h4 className="font-medium mb-2">Firebase Admin SDK Initialization</h4>
                  <p className="text-muted-foreground">{healthData.debug.initializationStatus}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between"><span>Service Account</span>{getStatusIcon(healthData.tests.serviceAccount.status)}</CardTitle>
                <CardDescription>Service account configuration and parsing.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between"><span>Status:</span>{getStatusBadge(healthData.tests.serviceAccount.status)}</div>
                  {healthData.tests.serviceAccount.projectId && (<div className="flex justify-between"><span>Project ID:</span><span className="font-mono">{healthData.tests.serviceAccount.projectId}</span></div>)}
                  {healthData.tests.serviceAccount.clientEmail && (<div className="flex justify-between"><span>Client Email:</span><span className="font-mono break-all">{healthData.tests.serviceAccount.clientEmail}</span></div>)}
                  <p className="text-muted-foreground pt-2">{healthData.tests.serviceAccount.message}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between"><span>Firestore Database</span>{getStatusIcon(healthData.tests.firestore.status)}</CardTitle>
                <CardDescription>Database connectivity and permissions.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span>Status:</span>{getStatusBadge(healthData.tests.firestore.status)}</div>
                <div className="flex justify-between"><span>Can Read:</span><span>{healthData.tests.firestore.canRead ? "Yes" : "No"}</span></div>
                <div className="flex justify-between"><span>Can Write:</span><span>{healthData.tests.firestore.canWrite ? "Yes" : "No"}</span></div>
                <p className="text-muted-foreground pt-2">{healthData.tests.firestore.message}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between"><span>Firebase Authentication</span>{getStatusIcon(healthData.tests.auth.status)}</CardTitle>
                <CardDescription>Authentication service connectivity.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span>Status:</span>{getStatusBadge(healthData.tests.auth.status)}</div>
                <div className="flex justify-between"><span>Can List Users:</span><span>{healthData.tests.auth.canListUsers ? "Yes" : "No"}</span></div>
                <p className="text-muted-foreground pt-2">{healthData.tests.auth.message}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between"><span>Firebase Storage</span>{getStatusIcon(healthData.tests.storage.status)}</CardTitle>
                <CardDescription>File storage connectivity and permissions.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span>Status:</span>{getStatusBadge(healthData.tests.storage.status)}</div>
                {healthData.tests.storage.bucketExists !== undefined && (<div className="flex justify-between"><span>Bucket Exists:</span><span>{healthData.tests.storage.bucketExists ? "Yes" : "No"}</span></div>)}
                {healthData.tests.storage.bucketName && (<div className="flex justify-between"><span>Bucket:</span><span className="font-mono">{healthData.tests.storage.bucketName}</span></div>)}
                <p className="text-muted-foreground pt-2">{healthData.tests.storage.message}</p>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
