'use client';

import React, { createContext, useContext, useState } from 'react';

/**
 * Tipo do usuário da aplicação.
 * Mantém os campos comuns do Firebase e permite campos extras via index signature.
 */
export type AppUser = {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  phoneNumber?: string | null;
  photoURL?: string | null;
  [key: string]: unknown; // permite dados adicionais sem recorrer a `any`
};

type UserContextValue = {
  user: AppUser | null;
  setUser: React.Dispatch<React.SetStateAction<AppUser | null>>;
};

const UserContext = createContext<UserContextValue | undefined>(undefined);

type UserProviderProps = {
  children: React.ReactNode;
};

export const UserProvider: React.FC<UserProviderProps> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);

  return (
    <UserContext.Provider value={{ user, setUser }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = (): UserContextValue => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};
