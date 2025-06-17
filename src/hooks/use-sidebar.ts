
// This custom hook might be provided by the actual sidebar component.
// If not, we'd create a simple context-based hook.
// For now, assuming the `components/ui/sidebar` provides this or similar.
// If `useSidebar` is not exported from `@/components/ui/sidebar`, we need to create it.

import { useContext } from 'react';
// Attempt to import from the sidebar component itself, or a dedicated context file.
// This is a common pattern for compound components with shared state.
// The actual path might differ based on how `components/ui/sidebar.tsx` is structured.
// Let's assume `SidebarContext` is exported from there.
import { SidebarContext } from '@/components/ui/sidebar'; 

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider from @/components/ui/sidebar');
  }
  return context;
}
