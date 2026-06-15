import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";

export type VoteAttribute =
  | "date_night" | "office" | "romantic" | "summer" | "winter"
  | "long_lasting" | "projection" | "versatile" | "party" | "formal";

export interface AttributeStats {
  yes: number;
  no: number;
  percent: number;
}

export type AttributeMap = Record<VoteAttribute, AttributeStats>;

interface VotesResponse {
  attributes: AttributeMap;
  totalVoters: number;
  myVotes: Partial<Record<VoteAttribute, "yes" | "no">>;
}

const EMPTY_ATTRS: AttributeMap = {
  date_night:   { yes: 0, no: 0, percent: 0 },
  office:       { yes: 0, no: 0, percent: 0 },
  romantic:     { yes: 0, no: 0, percent: 0 },
  summer:       { yes: 0, no: 0, percent: 0 },
  winter:       { yes: 0, no: 0, percent: 0 },
  long_lasting: { yes: 0, no: 0, percent: 0 },
  projection:   { yes: 0, no: 0, percent: 0 },
  versatile:    { yes: 0, no: 0, percent: 0 },
  party:        { yes: 0, no: 0, percent: 0 },
  formal:       { yes: 0, no: 0, percent: 0 },
};

export function useFragranceVotes(productId: string) {
  const { user, getIdToken } = useAuth();
  const { sessionId } = useCart();

  const [attributes, setAttributes] = useState<AttributeMap>(EMPTY_ATTRS);
  const [totalVoters, setTotalVoters] = useState(0);
  const [myVotes, setMyVotes] = useState<Partial<Record<VoteAttribute, "yes" | "no">>>({});
  const [loading, setLoading] = useState(true);

  const buildUrl = useCallback(
    (base: string) => (user ? base : `${base}?sessionId=${sessionId}`),
    [user, sessionId]
  );

  const buildHeaders = useCallback(async (): Promise<Record<string, string>> => {
    if (user) {
      try {
        const token = await getIdToken();
        return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
      } catch {
        // fall through to unauthenticated
      }
    }
    return { "Content-Type": "application/json" };
  }, [user, getIdToken]);

  const applyResponse = useCallback((data: VotesResponse) => {
    setAttributes(data.attributes ?? EMPTY_ATTRS);
    setTotalVoters(data.totalVoters ?? 0);
    setMyVotes(data.myVotes ?? {});
  }, []);

  // Fetch on mount / when productId or auth changes
  useEffect(() => {
    if (!productId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const headers = await buildHeaders();
        const res = await fetch(buildUrl(`/api/products/${productId}/votes`), { headers });
        if (!res.ok) return;
        const data: VotesResponse = await res.json();
        if (!cancelled) applyResponse(data);
      } catch {
        // ignore network errors — component stays at empty state
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [productId, buildUrl, buildHeaders, applyResponse]);

  const castVote = useCallback(
    async (attribute: VoteAttribute, vote: "yes" | "no") => {
      // Optimistic update
      setMyVotes((prev) => ({ ...prev, [attribute]: vote }));
      setAttributes((prev) => {
        const current = prev[attribute];
        const prevVote = myVotes[attribute];

        let yes = current.yes;
        let no = current.no;

        // Remove previous vote from count
        if (prevVote === "yes") yes = Math.max(0, yes - 1);
        if (prevVote === "no") no = Math.max(0, no - 1);

        // Add new vote
        if (vote === "yes") yes += 1;
        else no += 1;

        const total = yes + no;
        return {
          ...prev,
          [attribute]: { yes, no, percent: total > 0 ? Math.round((yes / total) * 100) : 0 },
        };
      });
      if (!myVotes[attribute]) {
        // New voter — increment totalVoters
        setTotalVoters((t) => t + 1);
      }

      try {
        const headers = await buildHeaders();
        const res = await fetch(buildUrl(`/api/products/${productId}/votes`), {
          method: "POST",
          headers,
          body: JSON.stringify({ attribute, vote }),
        });
        if (res.ok) {
          const data: VotesResponse = await res.json();
          applyResponse(data);
        }
      } catch {
        // optimistic state remains
      }
    },
    [productId, myVotes, buildUrl, buildHeaders, applyResponse]
  );

  return { attributes, totalVoters, myVotes, loading, castVote };
}
