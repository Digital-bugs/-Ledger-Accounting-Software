import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppLayout } from "@/components/layout/AppLayout";
import { Route, Switch, Router as WouterRouter } from "wouter";
import { Dashboard } from "@/pages/Dashboard";
import { EmptyState } from "@/components/ui/empty-state";
import { Backup } from "@/pages/Backup";
import { PartnerInvestments } from "@/pages/PartnerInvestments";
import { PartnerDirectExpenses } from "@/pages/PartnerDirectExpenses";
import { 
  Landmark, 
  ReceiptText, 
  Coins, 
  Calculator, 
  Briefcase, 
  Scale, 
  FileSpreadsheet, 
  PieChart, 
  Database, 
  Settings 
} from "lucide-react";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

const PageWrapper = ({ title, icon, description, buttonText }: { title: string, icon: any, description: string, buttonText?: string }) => (
  <div className="space-y-8 h-full flex flex-col">
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
      <p className="text-sm text-muted-foreground mt-1">
        Manage and track {title.toLowerCase()}.
      </p>
    </div>
    <div className="flex-1">
      <EmptyState icon={icon} title={`No ${title}`} description={description} buttonText={buttonText} />
    </div>
  </div>
);

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/partner-investments" component={PartnerInvestments} />
        <Route path="/partner-expenses" component={PartnerDirectExpenses} />
        <Route path="/petty-cash">
          <PageWrapper title="Petty Cash Given" icon={Coins} description="No petty cash records found. Use this module to manage cash disbursements to accountants." />
        </Route>
        <Route path="/accountant-expenses">
          <PageWrapper title="Accountant Expenses" icon={Calculator} description="No accountant expenses recorded yet. Use this module to log daily business expenses." />
        </Route>
        <Route path="/joint-income">
          <PageWrapper title="Joint Company Income" icon={Briefcase} description="No income recorded yet. Use this module to track revenue for the joint venture." />
        </Route>
        <Route path="/settlement">
          <PageWrapper title="Final Summary & Settlement" icon={Scale} description="Generate and view final settlements to calculate amounts owed to or from partners." buttonText="Generate Settlement" />
        </Route>
        <Route path="/excel-import">
          <PageWrapper title="Excel Data Import" icon={FileSpreadsheet} description="No imports found. Use this tool to bulk import data from Excel spreadsheets." buttonText="Upload File" />
        </Route>
        <Route path="/reports">
          <PageWrapper title="Reports" icon={PieChart} description="No generated reports. Use this module to export P&L and balance sheets." buttonText="Generate Report" />
        </Route>
        <Route path="/backup" component={Backup} />
        <Route path="/settings">
          <PageWrapper title="Settings" icon={Settings} description="Configure application preferences, partner details, and system defaults." buttonText="Edit Settings" />
        </Route>
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
