import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Landmark, ReceiptText, Coins, Calculator, Briefcase, Wallet } from "lucide-react";

export function Dashboard() {
  const summaryCards = [
    { title: "Total Investments", amount: "$0.00", icon: Landmark },
    { title: "Total Direct Expenses", amount: "$0.00", icon: ReceiptText },
    { title: "Total Petty Cash Given", amount: "$0.00", icon: Coins },
    { title: "Total Accountant Expenses", amount: "$0.00", icon: Calculator },
    { title: "Total Joint Company Income", amount: "$0.00", icon: Briefcase },
    { title: "Accountant Cash Balance", amount: "$0.00", icon: Wallet },
  ];

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
                <div className="text-2xl font-bold font-mono text-foreground">
                  {card.amount}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="pt-4">
        <h2 className="text-lg font-semibold tracking-tight text-foreground mb-4">Partner Overview</h2>
        
        <div className="space-y-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                    <span className="font-semibold text-foreground">Yasir</span>
                  </div>
                  <div className="text-sm text-muted-foreground">42.5% Share</div>
                </div>
                <div className="text-right space-y-1">
                  <div className="font-mono font-bold text-lg text-foreground">$0.00</div>
                  <div className="text-sm text-muted-foreground">Calculated Value</div>
                </div>
              </div>
              <Progress value={42.5} indicatorColor="bg-blue-500" />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-indigo-500"></div>
                    <span className="font-semibold text-foreground">Khurram</span>
                  </div>
                  <div className="text-sm text-muted-foreground">57.5% Share</div>
                </div>
                <div className="text-right space-y-1">
                  <div className="font-mono font-bold text-lg text-foreground">$0.00</div>
                  <div className="text-sm text-muted-foreground">Calculated Value</div>
                </div>
              </div>
              <Progress value={57.5} indicatorColor="bg-indigo-500" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
