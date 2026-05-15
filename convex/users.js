import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";

function generateUsername(name) {
  const baseName = name ? name.toLowerCase().replace(/[^a-z0-9]/g, "") : "user";
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `${baseName}_${randomSuffix}`;
}

export const store = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Called storeUser without authentication present");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    const getUniqueUsername = async (name) => {
      let username;
      let isUnique = false;
      while (!isUnique) {
        username = generateUsername(name);
        const existing = await ctx.db
          .query("users")
          .withIndex("by_username", (q) => q.eq("username", username))
          .first();
        if (!existing) isUnique = true;
      }
      return username;
    };

    if (user !== null) {
      const updates = {};
      if (user.name !== identity.name) updates.name = identity.name;
      if (!user.username) updates.username = await getUniqueUsername(identity.name || user.name);

      if (Object.keys(updates).length > 0) {
        await ctx.db.patch(user._id, updates);
      }
      return user._id;
    }

    const username = await getUniqueUsername(identity.name);
    return await ctx.db.insert("users", {
      name: identity.name ?? "Anonymous",
      username,
      tokenIdentifier: identity.tokenIdentifier,
      email: identity.email,
      imageUrl: identity.pictureUrl,
    });
  },
});

export const updateUsername = mutation({
  args: { username: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(internal.users.getCurrentUser);
    
    // Check if valid
    const cleanUsername = args.username.trim().toLowerCase();
    if (cleanUsername.length < 3 || /[^a-z0-9_.]/.test(cleanUsername)) {
      throw new Error("Username must be at least 3 characters and contain only lowercase letters, numbers, underscores, and dots.");
    }

    // Check if unique
    const existing = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", cleanUsername))
      .first();

    if (existing && existing._id !== user._id) {
      throw new Error("Username is already taken.");
    }

    await ctx.db.patch(user._id, { username: cleanUsername });
    return { success: true, username: cleanUsername };
  },
});

// Get current user
export const getCurrentUser = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    return user;
  },
});

// Helper to get contact IDs (recent participants)
async function getRecentContactIds(ctx, currentUserId) {
  const expensesYouPaid = await ctx.db
    .query("expenses")
    .withIndex("by_user_and_group", (q) =>
      q.eq("paidByUserId", currentUserId).eq("groupId", undefined)
    )
    .collect();

  const expensesNotPaidByYou = (
    await ctx.db
      .query("expenses")
      .withIndex("by_group", (q) => q.eq("groupId", undefined))
      .collect()
  ).filter(
    (e) =>
      e.paidByUserId !== currentUserId &&
      e.splits.some((s) => s.userId === currentUserId)
  );

  const personalExpenses = [...expensesYouPaid, ...expensesNotPaidByYou];
  
  // Sort by most recent to get recent contacts first
  personalExpenses.sort((a, b) => b.date - a.date);

  const contactIds = new Set();
  personalExpenses.forEach((exp) => {
    if (exp.paidByUserId !== currentUserId) contactIds.add(exp.paidByUserId);
    exp.splits.forEach((s) => {
      if (s.userId !== currentUserId) contactIds.add(s.userId);
    });
  });

  // Also add all accepted explicit connections
  const initiated = await ctx.db
    .query("connections")
    .withIndex("by_requester", (q) => q.eq("requesterId", currentUserId))
    .filter((q) => q.eq(q.field("status"), "accepted"))
    .collect();

  const received = await ctx.db
    .query("connections")
    .withIndex("by_receiver", (q) => q.eq("receiverId", currentUserId))
    .filter((q) => q.eq(q.field("status"), "accepted"))
    .collect();

  initiated.forEach((c) => contactIds.add(c.receiverId));
  received.forEach((c) => contactIds.add(c.requesterId));

  return Array.from(contactIds);
}

// Search users by username (globally) or name (among contacts)
export const searchUsers = query({
  args: {
    query: v.string(),
  },
  handler: async (ctx, args) => {
    const currentUser = await ctx.runQuery(internal.users.getCurrentUser);
    const searchTerm = args.query.trim().toLowerCase();
    
    // Always fetch recent contacts first
    const contactIds = await getRecentContactIds(ctx, currentUser._id);
    const contacts = await Promise.all(
      contactIds.map(id => ctx.db.get(id))
    );
    const validContacts = contacts.filter(Boolean);

    // If query is empty, just return recent contacts (up to 10)
    if (!searchTerm) {
      return validContacts.slice(0, 10).map((user) => ({
        id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        imageUrl: user.imageUrl,
        isContact: true,
      }));
    }

    // Search contacts by name or username
    const matchedContacts = validContacts.filter(
      (u) => 
        u.name.toLowerCase().includes(searchTerm) || 
        (u.username && u.username.toLowerCase().includes(searchTerm)) ||
        u.email.toLowerCase().includes(searchTerm)
    ).map(user => ({
      id: user._id,
      name: user.name,
      username: user.username,
      email: user.email,
      imageUrl: user.imageUrl,
      isContact: true,
    }));

    let globalUsers = [];
    
    // If they typed at least 3 chars, we also do a global search by username
    // To prevent scraping, we ONLY return up to 5 global username matches
    if (searchTerm.length >= 3) {
      // Remove @ if they typed it
      const cleanSearch = searchTerm.startsWith('@') ? searchTerm.substring(1) : searchTerm;
      
      const usernameResults = await ctx.db
        .query("users")
        .withSearchIndex("search_username", (q) => q.search("username", cleanSearch))
        .take(5);
        
      globalUsers = await Promise.all(
        usernameResults
          .filter(u => u._id !== currentUser._id)
          // filter out users already in contacts
          .filter(u => !matchedContacts.some(c => c.id === u._id))
          .map(async (user) => {
            let connectionStatus = "none";
            const outgoing = await ctx.db
              .query("connections")
              .withIndex("by_users", (q) => q.eq("requesterId", currentUser._id).eq("receiverId", user._id))
              .first();
            
            if (outgoing) {
              connectionStatus = outgoing.status === "pending" ? "pending_sent" : outgoing.status;
            } else {
              const incoming = await ctx.db
                .query("connections")
                .withIndex("by_users", (q) => q.eq("requesterId", user._id).eq("receiverId", currentUser._id))
                .first();
              if (incoming) {
                connectionStatus = incoming.status === "pending" ? "pending_received" : incoming.status;
              }
            }

            return {
              id: user._id,
              name: user.name,
              username: user.username,
              email: user.email,
              imageUrl: user.imageUrl,
              isContact: false,
              connectionStatus,
            };
          })
      );
    }

    // Combine results, contacts first
    const allResults = [...matchedContacts, ...globalUsers];
    return allResults.slice(0, 10); // Return max 10 total results
  },
});