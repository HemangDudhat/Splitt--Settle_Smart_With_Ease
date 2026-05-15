"use client";

import { useState, useEffect } from "react";
import { useConvexMutation, useConvexQuery } from "@/hooks/useConvexQuery";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, Loader2 } from "lucide-react";

export default function ProfilePage() {
  const { data: user, isLoading } = useConvexQuery(api.users.getCurrentUser);
  const { mutate: updateUsername, isLoading: isSaving } = useConvexMutation(api.users.updateUsername);

  const [username, setUsername] = useState("");

  useEffect(() => {
    if (user?.username) {
      setUsername(user.username);
    }
  }, [user]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!username || username === user?.username) return;

    try {
      await updateUsername({ username });
      toast.success("Username updated successfully");
    } catch (error) {
      // toast is already handled by useConvexMutation
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-2xl py-6 space-y-6">
      <div className="flex justify-between flex-col sm:flex-row sm:items-center gap-4 mb-6">
        <h1 className="text-5xl gradient-title text-center sm:text-left w-full">Profile</h1>
      </div>
      
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Your Identity</CardTitle>
            <CardDescription>
              Manage how others see and find you on Splitt.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={user?.imageUrl} />
                <AvatarFallback>
                  {user?.name?.charAt(0) || <User className="h-8 w-8" />}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-lg">{user?.name}</p>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>
            </div>

            <form onSubmit={handleSave} className="space-y-4 pt-4 border-t">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <div className="flex gap-2 relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted-foreground">
                    @
                  </div>
                  <Input
                    id="username"
                    placeholder="username"
                    className="pl-8"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ""))}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Your username must be unique. Others can find you by searching for this username.
                </p>
              </div>
              <Button type="submit" disabled={isSaving || username === user?.username || username.length < 3}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
