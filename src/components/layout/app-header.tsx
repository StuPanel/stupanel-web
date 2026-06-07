"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { Bell, Search, ChevronDown, Menu, Settings, User, LogOut } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface UserProfile {
  firstName: string;
  lastName: string;
  role: string;
  avatarUrl?: string | null;
  company: { name: string };
}

interface AppHeaderProps {
  onMenuClick?: () => void;
}

export function AppHeader({ onMenuClick }: AppHeaderProps) {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) return;

    apiFetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/v1"}/auth/me`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.firstName) setUser(data); })
      .catch(() => {});
  }, []);

  function handleLogout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_role");
    router.push("/login");
  }

  const initials = user
    ? `${user.firstName[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase()
    : "?";
  const displayName = user ? `${user.firstName} ${user.lastName ?? ""}`.trim() : "Loading...";
  const roleLabel = user?.role === "owner" ? "Studio Admin" : user?.role === "staff" ? "Staff" : (user?.role ?? "");

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-20">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <Menu className="w-5 h-5 text-slate-600" />
        </button>

        <div className="relative hidden sm:block w-64 lg:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search anything..."
            className="pl-9 bg-slate-50 border-slate-200 focus:bg-white text-sm h-9"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button className="sm:hidden p-2 rounded-lg hover:bg-slate-100">
          <Search className="w-5 h-5 text-slate-500" />
        </button>

        <Button variant="ghost" size="sm" className="relative w-9 h-9 p-0">
          <Bell className="w-4 h-4 text-slate-500" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 hover:bg-slate-100 rounded-lg px-2 py-1.5 transition-colors">
              <Avatar className="w-8 h-8">
                {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt={displayName} />}
                <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xs font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="text-left hidden md:block">
                <p className="text-sm font-medium text-slate-900 leading-none">{displayName}</p>
                <p className="text-xs text-slate-500 mt-0.5">{roleLabel}</p>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400 hidden md:block" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52" sideOffset={8}>
            <DropdownMenuLabel className="font-normal">
              <p className="text-sm font-semibold text-slate-900">{displayName}</p>
              <p className="text-xs text-slate-500 mt-0.5">{user?.company?.name ?? ""}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/account")} className="cursor-pointer gap-2">
              <User className="w-4 h-4" /> Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push("/settings")} className="cursor-pointer gap-2">
              <Settings className="w-4 h-4" /> Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="cursor-pointer gap-2 text-red-600 focus:text-red-600 focus:bg-red-50">
              <LogOut className="w-4 h-4" /> Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
