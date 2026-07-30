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
import { PettyCashGiven } from "@/pages/PettyCashGiven";
import { AccountantExpenses } from "@/pages/AccountantExpenses";
import { JointCompanyIncome } from "@/pages/JointCompanyIncome";
import { ExcelImport } from "@/pages/ExcelImport";
import { FinalSummary } from "@/pages/FinalSummary";
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
        <Route path="/petty-cash" component={PettyCashGiven} />
        <Route path="/accountant-expenses" component={AccountantExpenses} />
        <Route path="/joint-income" component={JointCompanyIncome} />
        <Route path="/settlement" component={FinalSummary} />
        <Route path="/excel-import" component={ExcelImport} />
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
