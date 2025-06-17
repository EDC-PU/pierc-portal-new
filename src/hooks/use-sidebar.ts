// src/hooks/use-sidebar.ts
// Re-export the hook directly from its source to ensure consistency.
// This ensures that components like Navbar use the exact same hook instance
// as the one defined and used internally by the sidebar components themselves.
export { useSidebar } from '@/components/ui/sidebar';
