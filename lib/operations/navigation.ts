import {
  Briefcase,
  CalendarCheck,
  FileCheck2,
  GraduationCap,
  LayoutDashboard,
  NotebookText,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/jobs", label: "Jobs", icon: Briefcase },
  { href: "/applications", label: "Applications", icon: FileCheck2 },
  { href: "/record", label: "Career Record", icon: NotebookText },
  { href: "/skills", label: "Skills", icon: GraduationCap },
  { href: "/plan", label: "Plan", icon: CalendarCheck },
  { href: "/settings", label: "Settings", icon: Settings },
];
