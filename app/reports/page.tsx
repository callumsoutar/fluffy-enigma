import { IconReport, IconChartBar, IconFileAnalytics, IconCalendarStats } from "@tabler/icons-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function ReportsPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reports & Analytics</h1>
        <p className="text-muted-foreground mt-2">
          Comprehensive reporting and analytics for your flight school operations
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Fleet Utilization
            </CardTitle>
            <IconChartBar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <CardDescription>
              Coming soon: Track aircraft usage, availability, and efficiency metrics
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Revenue Reports
            </CardTitle>
            <IconFileAnalytics className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <CardDescription>
              Coming soon: Financial reports, revenue analysis, and billing summaries
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Training Progress
            </CardTitle>
            <IconCalendarStats className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <CardDescription>
              Coming soon: Student progress tracking, lesson completion, and certification reports
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Instructor Performance
            </CardTitle>
            <IconReport className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <CardDescription>
              Coming soon: Instructor activity, student feedback, and performance metrics
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Safety Reports
            </CardTitle>
            <IconReport className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <CardDescription>
              Coming soon: Incident reports, maintenance tracking, and safety compliance
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Custom Reports
            </CardTitle>
            <IconFileAnalytics className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <CardDescription>
              Coming soon: Build and schedule custom reports based on your specific needs
            </CardDescription>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Report Features Coming Soon</CardTitle>
        <CardDescription>
          We&apos;re working on comprehensive reporting capabilities for your flight school
        </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
            <li>Interactive dashboards with real-time data visualization</li>
            <li>Exportable reports in PDF, Excel, and CSV formats</li>
            <li>Scheduled report delivery via email</li>
            <li>Customizable date ranges and filters</li>
            <li>Role-based report access and visibility</li>
            <li>Historical trend analysis and forecasting</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}

