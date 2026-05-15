"use client";

import { useState, useEffect } from "react";
import { useConvexQuery, useConvexMutation } from "@/hooks/useConvexQuery";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, Check, X, UserPlus, Loader2, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

export default function ConnectionsPage() {
  const [searchUsername, setSearchUsername] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  
  const { data: connections, isLoading: connectionsLoading } = useConvexQuery(api.connections.getConnections);
  const { data: groupContacts, isLoading: groupContactsLoading } = useConvexQuery(api.connections.getGroupContacts);
  const { data: requests, isLoading: requestsLoading } = useConvexQuery(api.connections.getPendingRequests);
  const { data: suggestions } = useConvexQuery(api.users.searchUsers, { query: debouncedSearch });
  
  const { mutate: acceptRequest, isLoading: isAccepting } = useConvexMutation(api.connections.acceptRequest);
  const { mutate: removeConnection, isLoading: isRemoving } = useConvexMutation(api.connections.removeConnection);
  const { mutate: sendRequestByUsername, isLoading: isSendingUsername } = useConvexMutation(api.connections.sendRequestByUsername);
  const { mutate: sendRequest, isLoading: isSending } = useConvexMutation(api.connections.sendRequest);
  
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchUsername), 300);
    return () => clearTimeout(timer);
  }, [searchUsername]);
  
  const handleAddFriend = async (e) => {
    e.preventDefault();
    if (!searchUsername.trim()) return;
    try {
      await sendRequestByUsername({ username: searchUsername });
      toast.success("Connection request sent!");
      setSearchUsername("");
    } catch (e) {}
  };

  const handleSendRequest = async (userId) => {
    try {
      await sendRequest({ receiverId: userId });
      toast.success("Connection request sent!");
    } catch (e) {}
  };
  
  const handleAccept = async (connectionId) => {
    try {
      await acceptRequest({ connectionId });
      toast.success("Connection accepted!");
    } catch (e) {}
  };

  const handleDecline = async (connectionId) => {
    try {
      await removeConnection({ connectionId });
      toast.success("Request declined");
    } catch (e) {}
  };

  const handleRemove = async (connectionId) => {
    try {
      await removeConnection({ connectionId });
      toast.success("Connection removed");
    } catch (e) {}
  };

  const isLoading = connectionsLoading || requestsLoading || groupContactsLoading;

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const incomingRequests = requests?.incoming || [];
  const outgoingRequests = requests?.outgoing || [];
  const friends = connections || [];
  const groupMembers = groupContacts || [];

  return (
    <div className="container mx-auto max-w-3xl py-6 space-y-6">
      <div className="flex justify-between flex-col sm:flex-row sm:items-center gap-4 mb-6">
        <h1 className="text-5xl gradient-title text-center sm:text-left w-full">Connections</h1>
      </div>

      <Tabs defaultValue="friends" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="friends">
            My Friends {friends.length > 0 && `(${friends.length})`}
          </TabsTrigger>
          <TabsTrigger value="group-contacts">
            Group Contacts {groupMembers.length > 0 && `(${groupMembers.length})`}
          </TabsTrigger>
          <TabsTrigger value="requests">
            Pending 
            {incomingRequests.length > 0 && (
              <Badge variant="destructive" className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px]">
                {incomingRequests.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="friends" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>My Friends</CardTitle>
              <CardDescription>
                People you can easily split expenses with.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <form onSubmit={handleAddFriend} className="flex gap-2">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted-foreground">
                    @
                  </div>
                  <Input 
                    placeholder="Search by @username" 
                    className="pl-8" 
                    value={searchUsername}
                    onChange={(e) => setSearchUsername(e.target.value)}
                  />
                  
                  {/* Suggestions List */}
                  {searchUsername.length >= 3 && suggestions && suggestions.filter(u => u.connectionStatus === "none").length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
                      {suggestions
                        .filter((u) => u.connectionStatus === "none")
                        .map((user) => (
                        <div 
                          key={user.id}
                          className="flex items-center justify-between p-2 hover:bg-slate-50 cursor-pointer border-b last:border-0"
                          onClick={() => {
                            handleSendRequest(user.id);
                            setSearchUsername("");
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={user.imageUrl} />
                              <AvatarFallback>{user.name?.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                              <span className="text-sm font-medium">{user.name}</span>
                              <span className="text-xs text-muted-foreground">@{user.username}</span>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-[10px]">
                            {user.connectionStatus === "accepted" ? "Friend" : "Send Request"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <Button type="submit" disabled={isSendingUsername || !searchUsername.trim()}>
                  {isSendingUsername && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Add Friend
                </Button>
              </form>

              {friends.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>You don't have any mutually accepted friends yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {friends.map((conn) => (
                    <div key={conn._id} className="flex items-center justify-between p-3 rounded-lg border bg-card text-card-foreground shadow-sm">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={conn.user.imageUrl} />
                          <AvatarFallback>{conn.user.name?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{conn.user.name}</p>
                          <p className="text-sm text-muted-foreground">@{conn.user.username}</p>
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemove(conn._id)}
                        disabled={isRemoving}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="group-contacts" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Group Contacts</CardTitle>
              <CardDescription>
                Users you share groups with. Add them to your friends to split individual expenses.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {groupMembers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>No group contacts found.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {groupMembers.map((member) => (
                    <div key={member.id} className="flex items-center justify-between p-3 rounded-lg border bg-card text-card-foreground shadow-sm">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={member.imageUrl} />
                          <AvatarFallback>{member.name?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{member.name}</p>
                          <p className="text-sm text-muted-foreground">@{member.username}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-muted-foreground text-xs font-normal bg-secondary/20 hidden sm:inline-flex">In Group</Badge>
                        {member.connectionStatus === "pending_sent" ? (
                          <Badge variant="secondary">Pending</Badge>
                        ) : member.connectionStatus === "pending_received" ? (
                          <Badge variant="secondary">Sent you a request</Badge>
                        ) : (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleSendRequest(member.id)}
                            disabled={isSending}
                          >
                            Add Friend
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requests" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Incoming Requests</CardTitle>
              <CardDescription>People who want to connect with you.</CardDescription>
            </CardHeader>
            <CardContent>
              {incomingRequests.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-4">No pending incoming requests.</p>
              ) : (
                <div className="space-y-4">
                  {incomingRequests.map((req) => (
                    <div key={req._id} className="flex items-center justify-between p-3 rounded-lg border bg-card text-card-foreground shadow-sm">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={req.user.imageUrl} />
                          <AvatarFallback>{req.user.name?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{req.user.name}</p>
                          <p className="text-sm text-muted-foreground">@{req.user.username}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          onClick={() => handleAccept(req._id)}
                          disabled={isAccepting || isRemoving}
                        >
                          <Check className="h-4 w-4 mr-1" /> Accept
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleDecline(req._id)}
                          disabled={isAccepting || isRemoving}
                        >
                          <X className="h-4 w-4 mr-1" /> Decline
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sent Requests</CardTitle>
              <CardDescription>Requests you've sent that are waiting for approval.</CardDescription>
            </CardHeader>
            <CardContent>
              {outgoingRequests.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-4">No pending outgoing requests.</p>
              ) : (
                <div className="space-y-4">
                  {outgoingRequests.map((req) => (
                    <div key={req._id} className="flex items-center justify-between p-3 rounded-lg border bg-card text-card-foreground shadow-sm">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={req.user.imageUrl} />
                          <AvatarFallback>{req.user.name?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{req.user.name}</p>
                          <p className="text-sm text-muted-foreground">@{req.user.username}</p>
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleRemove(req._id)}
                        disabled={isRemoving}
                      >
                        Cancel Request
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
