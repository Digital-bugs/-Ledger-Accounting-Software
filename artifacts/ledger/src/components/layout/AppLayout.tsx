import React from 'react';
import { Link, useLocation } from 'wouter';
import { 
  LayoutDashboard, 
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
} from 'lucide-react';
import { format } from 'date-fns';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/partner-investments', label: 'Partner Investments', icon: Landmark },
  { href: '/partner-expenses', label: 'Partner Direct Expenses', icon: ReceiptText },
  { href: '/petty-cash', label: 'Petty Cash Given', icon: Coins },
  { href: '/accountant-expenses', label: 'Accountant Expenses', icon: Calculator },
  { href: '/joint-income', label: 'Joint Company Income', icon: Briefcase },
  { href: '/settlement', label: 'Final Summary & Settlement', icon: Scale },
  { href: '/excel-import', label: 'Excel Data Import', icon: FileSpreadsheet },
  { href: '/reports', label: 'Reports', icon: PieChart },
  { href: '/backup', label: 'Backup & Restore', icon: Database },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background">
      {/* Top Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-6">
        <div className="flex items-center gap-4">
          <div className="h-6 w-6 rounded bg-primary"></div>
          <span className="font-semibold text-foreground">Ledger Accounting Software</span>
        </div>
        
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center">
          <span className="text-lg font-bold tracking-tight text-foreground">CROWN KING</span>
          <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium tracking-wider text-muted-foreground">INC.</span>
        </div>
        
        <div className="text-sm font-medium text-muted-foreground">
          {format(new Date(), 'EEEE, MMMM d, yyyy')}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <aside className="w-64 shrink-0 border-r border-border bg-sidebar overflow-y-auto">
          <nav className="flex flex-col gap-1 p-3">
            <div className="px-3 pb-2 pt-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Modules
            </div>
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.href;
              return (
                <Link key={item.href} href={item.href} className="block">
                  <div className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    isActive 
                      ? 'bg-primary text-primary-foreground' 
                      : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  }`}>
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </div>
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto bg-background p-8">
          <div className="mx-auto max-w-6xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
