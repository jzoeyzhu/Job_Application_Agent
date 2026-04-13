"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "New Analysis", match: (p: string) => p === "/" },
  { href: "/sessions", label: "History", match: (p: string) => p.startsWith("/sessions") },
  { href: "/resumes", label: "Resumes", match: (p: string) => p === "/resumes" },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <div className="flex gap-1">
      {links.map((l) => {
        const active = l.match(pathname);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </div>
  );
}
