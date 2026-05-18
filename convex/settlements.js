import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

/* ============================================================================
 *  MUTATION: createSettlement
 * -------------------------------------------------------------------------- */

export const createSettlement = mutation({
  args: {
    amount: v.number(), // must be > 0
    note: v.optional(v.string()),
    paidByUserId: v.id("users"),
    receivedByUserId: v.id("users"),
    groupId: v.optional(v.id("groups")), // null when settling one‑to‑one
    relatedExpenseIds: v.optional(v.array(v.id("expenses"))),
  },
  handler: async (ctx, args) => {
    // Use centralized getCurrentUser function
    const caller = await ctx.runQuery(internal.users.getCurrentUser);

    /* ── basic validation ────────────────────────────────────────────────── */
    if (args.amount <= 0) throw new Error("Amount must be positive");
    if (args.paidByUserId === args.receivedByUserId) {
      throw new Error("Payer and receiver cannot be the same user");
    }
    const isParticipant = caller._id === args.paidByUserId || caller._id === args.receivedByUserId;
    
    if (!isParticipant) {
      // If not a participant, must be a group settlement and caller must be a member
      if (!args.groupId) {
        throw new Error("You must be either the payer or the receiver for individual settlements");
      }
      const group = await ctx.db.get(args.groupId);
      if (!group) throw new Error("Group not found");
      const isMember = group.members.some((m) => m.userId === caller._id);
      if (!isMember) {
        throw new Error("You must be a member of the group to record a settlement");
      }
    }

    /* ── group check (if provided) ───────────────────────────────────────── */
    if (args.groupId) {
      const group = await ctx.db.get(args.groupId);
      if (!group) throw new Error("Group not found");

      const isMember = (uid) => group.members.some((m) => m.userId === uid);
      if (!isMember(args.paidByUserId) || !isMember(args.receivedByUserId)) {
        throw new Error("Both parties must be members of the group");
      }
    }

    /* ── insert ──────────────────────────────────────────────────────────── */
    return await ctx.db.insert("settlements", {
      amount: args.amount,
      note: args.note,
      date: Date.now(), // server‑side timestamp
      paidByUserId: args.paidByUserId,
      receivedByUserId: args.receivedByUserId,
      groupId: args.groupId,
      relatedExpenseIds: args.relatedExpenseIds,
      createdBy: caller._id,
    });
  },
});

/* ============================================================================
 *  QUERY: getSettlementData
 *  Returns the balances relevant for a page routed as:
 *      /settlements/[entityType]/[entityId]
 *  where entityType ∈ {"user","group"}
 * -------------------------------------------------------------------------- */

export const getSettlementData = query({
  args: {
    entityType: v.string(), // "user"  | "group"
    entityId: v.string(), // Convex _id (string form) of the user or group
  },
  handler: async (ctx, args) => {
    // Use centralized getCurrentUser function
    const me = await ctx.runQuery(internal.users.getCurrentUser);

    if (args.entityType === "user") {
      /* ─────────────────────────────────────────────── user page */
      const other = await ctx.db.get(args.entityId);
      if (!other) throw new Error("User not found");

      // ---------- gather expenses where either of us paid or appears in splits
      const myExpenses = await ctx.db
        .query("expenses")
        .withIndex("by_user_and_group", (q) =>
          q.eq("paidByUserId", me._id).eq("groupId", undefined)
        )
        .collect();

      const otherUserExpenses = await ctx.db
        .query("expenses")
        .withIndex("by_user_and_group", (q) =>
          q.eq("paidByUserId", other._id).eq("groupId", undefined)
        )
        .collect();

      const expenses = [...myExpenses, ...otherUserExpenses];

      let owed = 0; // they owe me
      let owing = 0; // I owe them

      for (const exp of expenses) {
        const involvesMe =
          exp.paidByUserId === me._id ||
          exp.splits.some((s) => s.userId === me._id);
        const involvesThem =
          exp.paidByUserId === other._id ||
          exp.splits.some((s) => s.userId === other._id);
        if (!involvesMe || !involvesThem) continue;

        // case 1: I paid
        if (exp.paidByUserId === me._id) {
          const split = exp.splits.find(
            (s) => s.userId === other._id && !s.paid
          );
          if (split) owed += split.amount;
        }

        // case 2: They paid
        if (exp.paidByUserId === other._id) {
          const split = exp.splits.find((s) => s.userId === me._id && !s.paid);
          if (split) owing += split.amount;
        }
      }

      const mySettlements = await ctx.db
        .query("settlements")
        .withIndex("by_user_and_group", (q) =>
          q.eq("paidByUserId", me._id).eq("groupId", undefined)
        )
        .collect();

      const otherUserSettlements = await ctx.db
        .query("settlements")
        .withIndex("by_user_and_group", (q) =>
          q.eq("paidByUserId", other._id).eq("groupId", undefined)
        )
        .collect();

      const settlements = [...mySettlements, ...otherUserSettlements];

      for (const st of settlements) {
        if (st.paidByUserId === me._id) {
          // I paid them ⇒ my owing goes down
          owing = Math.max(0, owing - st.amount);
        } else {
          // They paid me ⇒ their owing goes down
          owed = Math.max(0, owed - st.amount);
        }
      }

      return {
        type: "user",
        counterpart: {
          userId: other._id,
          name: other.name,
          email: other.email,
          imageUrl: other.imageUrl,
        },
        youAreOwed: owed,
        youOwe: owing,
        netBalance: owed - owing, // + => you should receive, − => you should pay
      };
    } else if (args.entityType === "group") {
      /* ──────────────────────────────────────────────────────── group page */
      const group = await ctx.db.get(args.entityId);
      if (!group) throw new Error("Group not found");

      const isMember = group.members.some((m) => m.userId === me._id);
      if (!isMember) throw new Error("You are not a member of this group");

      // ---------- expenses for this group
      const expenses = await ctx.db
        .query("expenses")
        .withIndex("by_group", (q) => q.eq("groupId", group._id))
        .collect();

      // ----------  member map ----------
      const memberDetails = await Promise.all(
        group.members.map(async (m) => {
          const u = await ctx.db.get(m.userId);
          return { id: u._id, name: u.name, imageUrl: u.imageUrl };
        })
      );
      const ids = memberDetails.map((m) => m.id);

      // ----------  ledgers ----------
      const totals = Object.fromEntries(ids.map((id) => [id, 0]));
      const ledger = {};
      ids.forEach((a) => {
        ledger[a] = {};
        ids.forEach((b) => {
          if (a !== b) ledger[a][b] = 0;
        });
      });

      // ----------  apply expenses ----------
      for (const exp of expenses) {
        const payer = exp.paidByUserId;
        for (const split of exp.splits) {
          if (split.userId === payer || split.paid) continue;
          const debtor = split.userId;
          const amt = split.amount;

          totals[payer] += amt;
          totals[debtor] -= amt;

          ledger[debtor][payer] += amt;
        }
      }

      // ----------  apply settlements ----------
      const settlements = await ctx.db
        .query("settlements")
        .filter((q) => q.eq(q.field("groupId"), group._id))
        .collect();

      for (const s of settlements) {
        totals[s.paidByUserId] += s.amount;
        totals[s.receivedByUserId] -= s.amount;

        ledger[s.paidByUserId][s.receivedByUserId] -= s.amount;
      }

      // ----------  net the pair‑wise ledger ----------
      ids.forEach((a) => {
        ids.forEach((b) => {
          if (a >= b) return;
          const diff = ledger[a][b] - ledger[b][a];
          if (diff > 0) {
            ledger[a][b] = diff;
            ledger[b][a] = 0;
          } else if (diff < 0) {
            ledger[b][a] = -diff;
            ledger[a][b] = 0;
          } else {
            ledger[a][b] = ledger[b][a] = 0;
          }
        });
      });

      // ----------  Greedy Debt Simplification ----------
      const netBalances = { ...totals };
      const simplifiedDebts = [];
      const creditors = [];
      const debtors = [];

      for (const [id, bal] of Object.entries(netBalances)) {
        if (bal > 0.005) creditors.push({ id, amount: bal });
        else if (bal < -0.005) debtors.push({ id, amount: -bal });
      }

      creditors.sort((a, b) => b.amount - a.amount);
      debtors.sort((a, b) => b.amount - a.amount);

      let ci = 0;
      let di = 0;

      while (ci < creditors.length && di < debtors.length) {
        const creditor = creditors[ci];
        const debtor = debtors[di];
        const settleAmount = Math.min(creditor.amount, debtor.amount);

        if (settleAmount > 0.005) {
          simplifiedDebts.push({
            from: debtor.id,
            to: creditor.id,
            amount: Math.round(settleAmount * 100) / 100,
          });
        }

        creditor.amount -= settleAmount;
        debtor.amount -= settleAmount;

        if (creditor.amount < 0.005) ci++;
        if (debtor.amount < 0.005) di++;
      }

      // ---------- shape result list (relative to 'me') ----------
      const list = ids
        .filter((uid) => uid !== me._id)
        .map((uid) => {
          const m = memberDetails.find((u) => u.id === uid);
          const youOwe = ledger[me._id][uid] || 0;
          const youAreOwed = ledger[uid][me._id] || 0;
          return {
            userId: uid,
            name: m?.name || "Unknown",
            imageUrl: m?.imageUrl,
            youAreOwed,
            youOwe,
            netBalance: youAreOwed - youOwe,
          };
        });

      return {
        type: "group",
        group: {
          id: group._id,
          name: group.name,
          description: group.description,
        },
        balances: list,
        simplifiedDebts: simplifiedDebts.filter((d) => d.from === me._id),
      };
    }

    /* ── unsupported entityType ──────────────────────────────────────────── */
    throw new Error("Invalid entityType; expected 'user' or 'group'");
  },
});