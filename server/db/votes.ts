import { db, canUseFirestore, disableFirestore } from "./firebase.js";

export type VoteAttribute =
  | "date_night" | "office" | "romantic" | "summer" | "winter"
  | "long_lasting" | "projection" | "versatile" | "party" | "formal";

export const VOTE_ATTRIBUTES: VoteAttribute[] = [
  "date_night", "office", "romantic", "summer", "winter",
  "long_lasting", "projection", "versatile", "party", "formal",
];

export interface Vote {
  productId: string;
  voterId: string;     // firebase uid OR sessionId
  attribute: VoteAttribute;
  vote: "yes" | "no";
  updatedAt: string;
}

// In-memory store: key = `${productId}:${voterId}:${attribute}`
const memoryVotes = new Map<string, Vote>();

const votesCollection = db?.collection("votes");

async function withVotesFallback<T>(action: () => Promise<T>, fallback: () => T | Promise<T>): Promise<T> {
  if (!votesCollection || !canUseFirestore()) {
    return await fallback();
  }
  try {
    return await action();
  } catch (err) {
    if (disableFirestore(err)) {
      return await fallback();
    }
    throw err;
  }
}

export async function castVote(vote: Vote): Promise<void> {
  const key = `${vote.productId}:${vote.voterId}:${vote.attribute}`;

  await withVotesFallback(
    async () => {
      await votesCollection!.doc(key).set(vote, { merge: false });
    },
    () => {
      memoryVotes.set(key, vote);
    }
  );
}

export async function getProductVotes(productId: string): Promise<Vote[]> {
  return withVotesFallback(
    async () => {
      const snapshot = await votesCollection!
        .where("productId", "==", productId)
        .get();
      return snapshot.docs.map((d) => d.data() as Vote);
    },
    () => {
      return Array.from(memoryVotes.values()).filter((v) => v.productId === productId);
    }
  );
}

export function aggregateVotes(
  votes: Vote[]
): Record<VoteAttribute, { yes: number; no: number; percent: number }> {
  const result = {} as Record<VoteAttribute, { yes: number; no: number; percent: number }>;

  for (const attr of VOTE_ATTRIBUTES) {
    const attrVotes = votes.filter((v) => v.attribute === attr);
    const yes = attrVotes.filter((v) => v.vote === "yes").length;
    const no = attrVotes.filter((v) => v.vote === "no").length;
    const total = yes + no;
    result[attr] = {
      yes,
      no,
      percent: total > 0 ? Math.round((yes / total) * 100) : 0,
    };
  }

  return result;
}
