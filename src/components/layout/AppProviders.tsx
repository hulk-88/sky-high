
"use client";

import type { ReactNode } from 'react';

// This component can be used to wrap global context providers
// For now, it's a simple pass-through, but sets up for future expansion (e.g., AuthContext)

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  // Example:
  // return (
  //   <SomeContextProvider>
  //     <AnotherContextProvider>
  //       {children}
  //     </AnotherContextProvider>
  //   </SomeContextProvider>
  // );
  return <>{children}</>;
}
