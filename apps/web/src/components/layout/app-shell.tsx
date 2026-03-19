"use client";

import { useState, type ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { cn } from "@/lib/cn";

export function AppShell({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex h-dvh overflow-hidden bg-bg-primary">
      {/* Desktop sidebar */}
      <aside className="hidden w-[280px] flex-shrink-0 border-r border-border bg-bg-secondary md:block">
        <Sidebar />
      </aside>

      {/* Mobile drawer backdrop */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[280px] bg-bg-secondary transition-transform duration-200 md:hidden",
          drawerOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <Sidebar onNavigate={() => setDrawerOpen(false)} />
      </aside>

      {/* Main content — passes toggle to children via context-free prop drilling */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Inject toggle handler via cloneElement if child accepts it */}
        <div className="flex h-full flex-col">
          {typeof children === "object" && children !== null
            ? children
            : children}
        </div>
      </main>
    </div>
  );
}

// Export a hook-like pattern for the toggle
import { createContext, useContext } from "react";

const DrawerContext = createContext<{ toggle: () => void }>({ toggle: () => {} });

export function AppShellWithContext({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const toggle = () => setDrawerOpen((o) => !o);

  return (
    <DrawerContext.Provider value={{ toggle }}>
      <div className="flex h-dvh overflow-hidden bg-bg-primary">
        <aside className="hidden w-[280px] flex-shrink-0 border-r border-border bg-bg-secondary md:block">
          <Sidebar />
        </aside>

        {drawerOpen && (
          <div className="fixed inset-0 z-40 bg-black/60 md:hidden" onClick={() => setDrawerOpen(false)} />
        )}

        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 w-[280px] bg-bg-secondary transition-transform duration-200 md:hidden",
            drawerOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <Sidebar onNavigate={() => setDrawerOpen(false)} />
        </aside>

        <main className="flex flex-1 flex-col overflow-hidden">{children}</main>
      </div>
    </DrawerContext.Provider>
  );
}

export function useDrawer() {
  return useContext(DrawerContext);
}
