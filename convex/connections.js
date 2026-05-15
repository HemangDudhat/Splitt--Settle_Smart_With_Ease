import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

export const sendRequest = mutation({
  args: { receiverId: v.id("users") },
  handler: async (ctx, args) => {
    const currentUser = await ctx.runQuery(internal.users.getCurrentUser);
    
    if (currentUser._id === args.receiverId) {
      throw new Error("Cannot send connection request to yourself");
    }

    // Check if user exists
    const receiver = await ctx.db.get(args.receiverId);
    if (!receiver) {
      throw new Error("User not found");
    }

    // Check if connection already exists in either direction
    const existingOutgoing = await ctx.db
      .query("connections")
      .withIndex("by_users", (q) => 
        q.eq("requesterId", currentUser._id).eq("receiverId", args.receiverId)
      )
      .first();

    if (existingOutgoing) {
      throw new Error("Request already sent");
    }

    const existingIncoming = await ctx.db
      .query("connections")
      .withIndex("by_users", (q) => 
        q.eq("requesterId", args.receiverId).eq("receiverId", currentUser._id)
      )
      .first();

    if (existingIncoming) {
      if (existingIncoming.status === "pending") {
        // Automatically accept if they already sent you a request
        await ctx.db.patch(existingIncoming._id, { status: "accepted" });
        return { success: true, status: "accepted" };
      } else {
        throw new Error("Already connected");
      }
    }

    await ctx.db.insert("connections", {
      requesterId: currentUser._id,
      receiverId: args.receiverId,
      status: "pending",
      createdAt: Date.now(),
    });

    return { success: true, status: "pending" };
  },
});

export const sendRequestByUsername = mutation({
  args: { username: v.string() },
  handler: async (ctx, args) => {
    const currentUser = await ctx.runQuery(internal.users.getCurrentUser);
    
    // Check if user exists
    const cleanUsername = args.username.trim().toLowerCase().replace(/^@/, '');
    const receiver = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", cleanUsername))
      .first();

    if (!receiver) {
      throw new Error("User not found");
    }

    if (currentUser._id === receiver._id) {
      throw new Error("Cannot send connection request to yourself");
    }

    // Check if connection already exists in either direction
    const existingOutgoing = await ctx.db
      .query("connections")
      .withIndex("by_users", (q) => 
        q.eq("requesterId", currentUser._id).eq("receiverId", receiver._id)
      )
      .first();

    if (existingOutgoing) {
      throw new Error("Request already sent");
    }

    const existingIncoming = await ctx.db
      .query("connections")
      .withIndex("by_users", (q) => 
        q.eq("requesterId", receiver._id).eq("receiverId", currentUser._id)
      )
      .first();

    if (existingIncoming) {
      if (existingIncoming.status === "pending") {
        await ctx.db.patch(existingIncoming._id, { status: "accepted" });
        return { success: true, status: "accepted" };
      } else {
        throw new Error("Already connected");
      }
    }

    await ctx.db.insert("connections", {
      requesterId: currentUser._id,
      receiverId: receiver._id,
      status: "pending",
      createdAt: Date.now(),
    });

    return { success: true, status: "pending" };
  },
});

export const acceptRequest = mutation({
  args: { connectionId: v.id("connections") },
  handler: async (ctx, args) => {
    const currentUser = await ctx.runQuery(internal.users.getCurrentUser);
    
    const connection = await ctx.db.get(args.connectionId);
    if (!connection) {
      throw new Error("Connection request not found");
    }

    if (connection.receiverId !== currentUser._id) {
      throw new Error("Unauthorized to accept this request");
    }

    if (connection.status === "accepted") {
      throw new Error("Already accepted");
    }

    await ctx.db.patch(args.connectionId, { status: "accepted" });
    return { success: true };
  },
});

export const removeConnection = mutation({
  args: { connectionId: v.id("connections") },
  handler: async (ctx, args) => {
    const currentUser = await ctx.runQuery(internal.users.getCurrentUser);
    
    const connection = await ctx.db.get(args.connectionId);
    if (!connection) {
      throw new Error("Connection not found");
    }

    if (connection.requesterId !== currentUser._id && connection.receiverId !== currentUser._id) {
      throw new Error("Unauthorized to remove this connection");
    }

    await ctx.db.delete(args.connectionId);
    return { success: true };
  },
});

export const getPendingRequests = query({
  handler: async (ctx) => {
    const currentUser = await ctx.runQuery(internal.users.getCurrentUser);

    // Incoming requests
    const incoming = await ctx.db
      .query("connections")
      .withIndex("by_receiver", (q) => q.eq("receiverId", currentUser._id))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .collect();

    // Outgoing requests
    const outgoing = await ctx.db
      .query("connections")
      .withIndex("by_requester", (q) => q.eq("requesterId", currentUser._id))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .collect();

    const fetchUser = async (conn, isIncoming) => {
      const userId = isIncoming ? conn.requesterId : conn.receiverId;
      const user = await ctx.db.get(userId);
      return {
        _id: conn._id,
        user: {
          id: user._id,
          name: user.name,
          username: user.username,
          imageUrl: user.imageUrl,
          email: user.email,
        },
        createdAt: conn.createdAt,
      };
    };

    return {
      incoming: await Promise.all(incoming.map(c => fetchUser(c, true))),
      outgoing: await Promise.all(outgoing.map(c => fetchUser(c, false))),
    };
  },
});

export const getConnections = query({
  handler: async (ctx) => {
    const currentUser = await ctx.runQuery(internal.users.getCurrentUser);

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

    const fetchUser = async (conn, isInitiated) => {
      const userId = isInitiated ? conn.receiverId : conn.requesterId;
      const user = await ctx.db.get(userId);
      return {
        _id: conn._id,
        user: {
          id: user._id,
          name: user.name,
          username: user.username,
          imageUrl: user.imageUrl,
          email: user.email,
        },
        connectedAt: conn.createdAt,
      };
    };

    const combined = [
      ...(await Promise.all(initiated.map((c) => fetchUser(c, true)))),
      ...(await Promise.all(received.map((c) => fetchUser(c, false)))),
    ];

    return combined.sort((a, b) => b.connectedAt - a.connectedAt);
  },
});

export const getGroupContacts = query({
  handler: async (ctx) => {
    const currentUser = await ctx.runQuery(internal.users.getCurrentUser);

    const groups = await ctx.db.query("groups").collect();
    const myGroups = groups.filter((g) =>
      g.members.some((m) => m.userId === currentUser._id)
    );
    
    const groupMemberIds = new Set();
    myGroups.forEach((g) => {
      g.members.forEach((m) => {
        if (m.userId !== currentUser._id) {
          groupMemberIds.add(m.userId);
        }
      });
    });

    // Get all accepted friends to filter them out
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

    const results = [];
    for (const userId of groupMemberIds) {
      if (friendIds.has(userId)) continue;

      const user = await ctx.db.get(userId);
      if (!user) continue;

      // Check connection status
      let connectionStatus = "none";
      const outgoing = await ctx.db
        .query("connections")
        .withIndex("by_users", (q) =>
          q.eq("requesterId", currentUser._id).eq("receiverId", user._id)
        )
        .first();

      if (outgoing) {
        connectionStatus =
          outgoing.status === "pending" ? "pending_sent" : outgoing.status;
      } else {
        const incoming = await ctx.db
          .query("connections")
          .withIndex("by_users", (q) =>
            q.eq("requesterId", user._id).eq("receiverId", currentUser._id)
          )
          .first();
        if (incoming) {
          connectionStatus =
            incoming.status === "pending" ? "pending_received" : incoming.status;
        }
      }

      results.push({
        id: user._id,
        name: user.name,
        username: user.username,
        imageUrl: user.imageUrl,
        email: user.email,
        connectionStatus,
      });
    }

    // Deduplicate by ID
    const uniqueResults = [];
    const seenIds = new Set();
    for (const res of results) {
      if (!seenIds.has(res.id)) {
        uniqueResults.push(res);
        seenIds.add(res.id);
      }
    }

    return uniqueResults;
  },
});
