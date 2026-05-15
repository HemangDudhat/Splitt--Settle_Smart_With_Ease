"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { useConvexQuery, useConvexMutation } from "@/hooks/useConvexQuery";
import { PropagateLoader } from "react-spinners";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlusCircle, ArrowLeftRight, ArrowLeft, Users, Trash2, Loader2, ArrowRight, Zap } from "lucide-react";
import { toast } from "sonner";
import { ExpenseList } from "@/components/expense-list";
import { SettlementList } from "@/components/settlement-list";
import { GroupBalances } from "@/components/group-balances";
import { GroupMembers } from "@/components/group-members";

export default function GroupExpensesPage() {
  const params = useParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("expenses");

  const { data, isLoading } = useConvexQuery(api.groups.getGroupExpenses, {
    groupId: params.id,
  });

  const { data: currentUser } = useConvexQuery(api.users.getCurrentUser);
  const { mutate: deleteGroup, isLoading: isDeleting } = useConvexMutation(api.groups.deleteGroup);

  if (isLoading) {
    return (
        <div className="w-full py-12 flex justify-center">
          <PropagateLoader width={"100%"} color="#6868cb" />
        </div>
    );
  }

  if (!data) {
    return null;
  }

  const group = data?.group;
  const members = data?.members || [];
  const expenses = data?.expenses || [];
  const settlements = data?.settlements || [];
  const balances = data?.balances || [];
  const simplifiedDebts = data?.simplifiedDebts || [];
  const userLookupMap = data?.userLookupMap || {};

  const isAdmin = members.find(m => m.id === currentUser?._id)?.role === "admin";

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this group? All expenses and settlements will be permanently removed.")) {
      return;
    }

    try {
      await deleteGroup({ groupId: params.id });
      toast.success("Group deleted successfully");
      router.replace("/dashboard");
    } catch (e) {
      toast.error(e.message || "Failed to delete group");
    }
  };

  return (
    <div className="container mx-auto py-6 max-w-4xl">
      <div className="mb-6">
        <Button
          variant="outline"
          size="sm"
          className="mb-4"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-4 rounded-md">
              <Users className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-4xl gradient-title">{group?.name}</h1>
              <p className="text-muted-foreground">{group?.description}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {members.length} members
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            {isAdmin && (
              <Button 
                variant="outline" 
                size="icon"
                onClick={handleDelete}
                disabled={isDeleting}
                title="Delete Group"
                className="hover:text-red-500 hover:border-red-500"
              >
                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </Button>
            )}
            <Button asChild variant="outline">
              <Link href={`/settlements/group/${params.id}`}>
                <ArrowLeftRight className="mr-2 h-4 w-4" />
                Settle up
              </Link>
            </Button>
            <Button asChild>
              <Link href={`/expenses/new`}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Add expense
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Simplified Debts Card - full width at top */}
      {simplifiedDebts.length > 0 && (
        <Card className="mb-6 border-primary/20 bg-primary/5">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              <CardTitle className="text-xl">Simplified Debts</CardTitle>
            </div>
            <CardDescription>
              The minimum transactions to settle everyone — {simplifiedDebts.length} payment{simplifiedDebts.length > 1 ? "s" : ""} needed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {simplifiedDebts.map((debt, idx) => {
                const payer = userLookupMap[debt.from];
                const receiver = userLookupMap[debt.to];
                const isCurrentUserPayer = debt.from === currentUser?._id;
                return (
                  <div
                    key={idx}
                    className={`flex items-center justify-between p-3 rounded-lg border bg-background transition-colors ${
                      isCurrentUserPayer ? "border-amber-300 bg-amber-50/50" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2 text-sm">
                      <span className={`font-semibold ${isCurrentUserPayer ? "text-amber-700" : ""}`}>
                        {isCurrentUserPayer ? "You" : (payer?.name || "Unknown")}
                      </span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold">
                        {debt.to === currentUser?._id ? "You" : (receiver?.name || "Unknown")}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-base">
                        ₹{debt.amount.toFixed(2)}
                      </span>
                      {isCurrentUserPayer && (
                        <Button
                          asChild
                          size="sm"
                          variant="default"
                        >
                          <Link
                            href={`/settlements/group/${params.id}?to=${debt.to}&amount=${debt.amount}`}
                          >
                            Settle
                          </Link>
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Grid layout for group details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xl">Group Balances</CardTitle>
            </CardHeader>
            <CardContent>
              <GroupBalances balances={balances} />
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xl">Members</CardTitle>
            </CardHeader>
            <CardContent>
              <GroupMembers members={members} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Tabs for expenses and settlements */}
      <Tabs
        defaultValue="expenses"
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-4"
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="expenses">
            Expenses ({expenses.length})
          </TabsTrigger>
          <TabsTrigger value="settlements">
            Settlements ({settlements.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="expenses" className="space-y-4">
          <ExpenseList
            expenses={expenses}
            showOtherPerson={true}
            isGroupExpense={true}
            userLookupMap={userLookupMap}
          />
        </TabsContent>

        <TabsContent value="settlements" className="space-y-4">
          <SettlementList
            settlements={settlements}
            isGroupSettlement={true}
            userLookupMap={userLookupMap}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

