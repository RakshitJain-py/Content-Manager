"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { type Account, type AccountDraft } from "@/types/content";
import { getAccountsAction, addAccountAction, removeAccountAction, confirmAccountAction } from "@/app/actions/studio";
import { getCurrentSession } from "@/app/actions/auth";
import { ROUTES } from "@/lib/routes";

export interface UseAccountsResult {
  accounts: Account[];
  selectedIds: string[];
  selectedAccounts: Account[];
  toggleAccount: (id: string) => void;
  addAccount: (draft: AccountDraft) => Promise<Account>;
  confirmAccount: (id: string, name: string) => Promise<Account>;
  removeAccount: (id: string) => Promise<void>;
  loading: boolean;
}

export function useAccounts(): UseAccountsResult {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch accounts on mount
  useEffect(() => {
    let active = true;
    getAccountsAction()
      .then((res) => {
        if (!active) return;
        if (res.success && res.data) {
          const mapped = res.data.map((a) => ({
            id: a.id,
            name: a.name || `@account_${a.id}`,
            igId: a.id,
            token: a.accessToken,
          }));
          setAccounts(mapped);
        }
      })
      .catch((err) => {
        console.error("Error loading accounts:", err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const toggleAccount = useCallback((id: string) => {
    setSelectedIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }, []);

  const addAccount = useCallback(async (draft: AccountDraft): Promise<Account> => {
    // Restrict immediately client-side
    const session = await getCurrentSession();
    if (!session || !session.success) {
      router.push(ROUTES.login);
      throw new Error("You must be logged in to add an account.");
    }

    const res = await addAccountAction({
      id: draft.igId,
      name: draft.name,
      accessToken: draft.token,
    });

    if (!res.success) {
      throw new Error(res.error || "Failed to add account");
    }

    const newAccount: Account = {
      id: res.data.id,
      name: res.data.name || `@account_${res.data.id}`,
      igId: res.data.id,
      token: res.data.accessToken,
    };

    setAccounts((list) => [...list, newAccount]);
    return newAccount;
  }, [router]);

  const confirmAccount = useCallback(async (id: string, name: string): Promise<Account> => {
    const session = await getCurrentSession();
    if (!session || !session.success) {
      router.push(ROUTES.login);
      throw new Error("You must be logged in to confirm an account.");
    }

    const res = await confirmAccountAction(id, name);
    if (!res.success) {
      throw new Error(res.error || "Failed to confirm account");
    }

    const confirmedAccount: Account = {
      id: res.data.id,
      name: res.data.name || `@account_${res.data.id}`,
      igId: res.data.id,
      token: res.data.accessToken,
    };

    setAccounts((list) => {
      // Remove any existing copy and append the confirmed one
      const filtered = list.filter((a) => a.id !== confirmedAccount.id);
      return [...filtered, confirmedAccount];
    });

    return confirmedAccount;
  }, [router]);

  const removeAccount = useCallback(async (id: string) => {
    // Restrict immediately client-side
    const session = await getCurrentSession();
    if (!session || !session.success) {
      router.push(ROUTES.login);
      throw new Error("You must be logged in to remove an account.");
    }

    const res = await removeAccountAction(id);
    if (!res.success) {
      throw new Error(res.error || "Failed to remove account");
    }
    setAccounts((list) => list.filter((a) => a.id !== id));
    setSelectedIds((ids) => ids.filter((x) => x !== id));
  }, [router]);

  const selectedAccounts = useMemo(
    () => accounts.filter((a) => selectedIds.includes(a.id)),
    [accounts, selectedIds],
  );

  return { accounts, selectedIds, selectedAccounts, toggleAccount, addAccount, confirmAccount, removeAccount, loading };
}
