import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Landmark, ReceiptText, Coins, Calculator, Briefcase, Wallet } from "lucide-react";
import { useGetDashboardSummary } from "@workspace/api-client-react";

export function Dashboard() {
  const { data: summary, isLoading, isError } = useGetDashboardSummary();

  const formatCurrency = (value: number) => {
    return `Rs ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const summaryCards = [
    { title: "Total Investments", amount: summary?.totalInvestments ?? 0, icon: Landmark },
    { title: "Total Direct Expenses", amount: summary?.totalDirectExpenses ?? 0, icon: ReceiptText },
    { title: "Total Petty Cash Given", amount: summary?.totalPettyCashGiven ?? 0, icon: Coins },
    { title: "Total Accountant Expenses", amount: summary?.totalAccountantExpenses ?? 0, icon: Calculator },
    { title: "Total Joint Company Income", amount: summary?.totalJointIncome ?? 0, icon: Briefcase },
    { title: "Accountant Cash Balance", amount: summary?.accountantCashBalance ?? 0, icon: Wallet },
  ];

  if (isError) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Financial summary and partner overview for Crown King.
          </p>
        </div>
        <div className="p-4 bg-destructive/10 text-destructive text-sm rounded-md border border-destructive/20">
          Failed to load dashboard summary. Please try again later.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Financial summary and partner overview for Crown King.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.title}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-8 w-[120px]" data-testid={`skeleton-${card.title.toLowerCase().replace(/\s+/g, '-')}`} />
                ) : (
                  <div className="text-2xl font-bold font-mono text-foreground" data-testid={`value-${card.title.toLowerCase().replace(/\s+/g, '-')}`}>
                    {formatCurrency(card.amount)}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="pt-4">
        <h2 className="text-lg font-semibold tracking-tight text-foreground mb-4">Partner Overview</h2>
        
        <div className="space-y-6">
          {isLoading ? (
            <>
              <Card>
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <Skeleton className="h-5 w-[100px]" />
                      <Skeleton className="h-4 w-[60px]" />
                    </div>
                    <div className="space-y-2 text-right flex flex-col items-end">
                      <Skeleton className="h-6 w-[80px]" />
                      <Skeleton className="h-4 w-[100px]" />
                    </div>
                  </div>
                  <Skeleton className="h-2 w-full" />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <Skeleton className="h-5 w-[100px]" />
                      <Skeleton className="h-4 w-[60px]" />
                    </div>
                    <div className="space-y-2 text-right flex flex-col items-end">
                      <Skeleton className="h-6 w-[80px]" />
                      <Skeleton className="h-4 w-[100px]" />
                    </div>
                  </div>
                  <Skeleton className="h-2 w-full" />
                </CardContent>
              </Card>
            </>
          ) : summary?.partners?.length ? (
            summary.partners.map((partner, index) => {
              // Alternate colors for partners based on index to keep the visual design similar
              const colors = ['bg-blue-500', 'bg-indigo-500', 'bg-violet-500', 'bg-fuchsia-500'];
              const colorClass = colors[index % colors.length];
              
              return (
                <Card key={partner.id} data-testid={`card-partner-${partner.id}`}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div className={`h-2 w-2 rounded-full ${colorClass}`}></div>
                          <span className="font-semibold text-foreground">{partner.name}</span>
                        </div>
                        <div className="text-sm text-muted-foreground">{partner.sharePercentage}% Share</div>
                      </div>
                      <div className="text-right space-y-1">
                        <div className="font-mono font-bold text-lg text-foreground">Rs 0.00</div>
                        <div className="text-sm text-muted-foreground">Calculated Value</div>
                      </div>
                    </div>
                    <Progress value={partner.sharePercentage} indicatorColor={colorClass} />
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <div className="text-sm text-muted-foreground bg-muted p-6 rounded-md text-center border border-dashed border-border">
              No partners found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
