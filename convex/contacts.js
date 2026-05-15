// convex/contacts.js
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

/* ──────────────────────────────────────────────────────────────────────────
   1. getAllContacts – 1‑to‑1 expense contacts + groups
   ──────────────────────────────────────────────────────────────────────── */
export const getAllContacts = query({
  handler: async (ctx) => {
    // Use the centralized getCurrentUser instead of duplicating auth logic
    const currentUser = await ctx.runQuery(internal.users.getCurrentUser);

    /* ── fetch accepted friends ────────────────────────────────────────── */
    const initiated = await ctx.db
      .query("connections")
      .withIndex("by_requester", (q) => q.eq("requesterId", currentUser._id))
      .filter((q) => q.eq(q.field("status"), "accepted"))
      .collect();

    const received = await ctx.db
      .query("connections")
      .withIndex("by_receiver", (q) => q.eq("receiverId", currentUser._id))
      .filter((q) => q.eq(q.field("status"), "accepted"))
      .collect();

    const friendIds = new Set([
      ...initiated.map((c) => c.receiverId),
      ...received.map((c) => c.requesterId),
    ]);

    /* ── fetch user docs ───────────────────────────────────────────────── */
    const contactUsers = await Promise.all(
      [...friendIds].map(async (id) => {
        const u = await ctx.db.get(id);
        return u
          ? {
              id: u._id,
              name: u.name,
              email: u.email,
              imageUrl: u.imageUrl,
              type: "user",
            }
          : null;
      })
    );

    /* ── groups where current user is a member ─────────────────────────── */
    const userGroups = (await ctx.db.query("groups").collect())
      .filter((g) => g.members.some((m) => m.userId === currentUser._id))
      .map((g) => ({
        id: g._id,
        name: g.name,
        description: g.description,
        memberCount: g.members.length,
        type: "group",
      }));

    /* sort alphabetically */
    contactUsers.sort((a, b) => a?.name.localeCompare(b?.name));
    userGroups.sort((a, b) => a.name.localeCompare(b.name));

    return { users: contactUsers.filter(Boolean), groups: userGroups };
  },
});

/* ──────────────────────────────────────────────────────────────────────────
   2. createGroup – create a new group
   ──────────────────────────────────────────────────────────────────────── */
export const createGroup = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    members: v.array(v.id("users")),
  },
  handler: async (ctx, args) => {
    // Use the centralized getCurrentUser instead of duplicating auth logic
    const currentUser = await ctx.runQuery(internal.users.getCurrentUser);

    if (!args.name.trim()) throw new Error("Group name cannot be empty");

    const uniqueMembers = new Set(args.members);
    uniqueMembers.add(currentUser._id); // ensure creator

    // Validate that all member users exist and are friends with the creator
    for (const id of uniqueMembers) {
      if (id === currentUser._id) continue;
      
      const userDoc = await ctx.db.get(id);
      if (!userDoc) throw new Error(`User with ID ${id} not found`);

      // Check friendship
      const connection = await ctx.db
        .query("connections")
        .filter((q) =>
          q.and(
            q.eq(q.field("status"), "accepted"),
            q.or(
              q.and(
                q.eq(q.field("requesterId"), currentUser._id),
                q.eq(q.field("receiverId"), id)
              ),
              q.and(
                q.eq(q.field("requesterId"), id),
                q.eq(q.field("receiverId"), currentUser._id)
              )
            )
          )
        )
        .first();

      if (!connection) {
        throw new Error(`You must be friends with ${userDoc.name || "all members"} to add them to a group.`);
      }
    }

    return await ctx.db.insert("groups", {
      name: args.name.trim(),
      description: args.description?.trim() ?? "",
      createdBy: currentUser._id,
      members: [...uniqueMembers].map((id) => ({
        userId: id,
        role: id === currentUser._id ? "admin" : "member",
        joinedAt: Date.now(),
      })),
    });
  },
});