import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { api } from "@/convex/_generated/api";
import { useConvexMutation, useConvexQuery } from "@/hooks/useConvexQuery";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Zap, ArrowRight } from "lucide-react";

// Form schema validation
const settlementSchema = z.object({
  amount: z
    .string()
    .min(1, "Amount is required")
    .refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
      message: "Amount must be a positive number",
    }),
  note: z.string().optional(),
  paymentType: z.enum(["youPaid", "theyPaid"]),
});

export default function SettlementForm({ entityType, entityData, onSuccess }) {
  const { data: currentUser } = useConvexQuery(api.users.getCurrentUser);
  const createSettlement = useConvexMutation(api.settlements.createSettlement);

  const searchParams = useSearchParams();
  const queryTo = searchParams.get("to");
  const queryAmount = searchParams.get("amount");
  const queryTab = searchParams.get("tab");

  // Set up form with validation
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(settlementSchema),
    defaultValues: {
      amount: "",
      note: "",
      paymentType: "youPaid",
    },
  });

  // Get selected payment direction
  const paymentType = watch("paymentType");

  // Single user settlement
  const handleUserSettlement = async (data) => {
    const amount = parseFloat(data.amount);

    try {
      // Determine payer and receiver based on the selected payment type
      const paidByUserId =
        data.paymentType === "youPaid"
          ? currentUser._id
          : entityData.counterpart.userId;

      const receivedByUserId =
        data.paymentType === "youPaid"
          ? entityData.counterpart.userId
          : currentUser._id;

      await createSettlement.mutate({
        amount,
        note: data.note,
        paidByUserId,
        receivedByUserId,
        // No groupId for user settlements
      });

      toast.success("Settlement recorded successfully!");
      if (onSuccess) onSuccess();
    } catch (error) {
      toast.error("Failed to record settlement: " + error.message);
    }
  };

  // Group settlement
  const handleGroupSettlement = async (data, selectedUserId) => {
    if (!selectedUserId) {
      toast.error("Please select a group member to settle with");
      return;
    }

    const amount = parseFloat(data.amount);

    try {
      // Get the selected user from the group balances
      const selectedUser = entityData.balances.find(
        (balance) => balance.userId === selectedUserId
      );

      if (!selectedUser) {
        toast.error("Selected user not found in group");
        return;
      }

      // Determine payer and receiver based on the selected payment type and balances
      const paidByUserId =
        data.paymentType === "youPaid" ? currentUser._id : selectedUser.userId;

      const receivedByUserId =
        data.paymentType === "youPaid" ? selectedUser.userId : currentUser._id;

      await createSettlement.mutate({
        amount,
        note: data.note,
        paidByUserId,
        receivedByUserId,
        groupId: entityData.group.id,
      });

      toast.success("Settlement recorded successfully!");
      if (onSuccess) onSuccess();
    } catch (error) {
      toast.error("Failed to record settlement: " + error.message);
    }
  };

  // Handle form submission
  const onSubmit = async (data) => {
    if (entityType === "user") {
      await handleUserSettlement(data);
    } else if (entityType === "group" && selectedGroupMemberId) {
      await handleGroupSettlement(data, selectedGroupMemberId);
    }
  };

  // For group settlements, we need to select a member
  const [selectedGroupMemberId, setSelectedGroupMemberId] = useState(null);
  const [activeTab, setActiveTab] = useState("individual");
  const [selectedSimplifiedDebt, setSelectedSimplifiedDebt] = useState(null);

  // Handle query parameters
  useEffect(() => {
    if (queryAmount) {
      setValue("amount", queryAmount);
    }
    if (queryTab === "simplified") {
      setActiveTab("simplified");
    }
    if (queryTo && entityType === "group" && entityData?.balances) {
      const member = entityData.balances.find((b) => b.userId === queryTo);
      if (member) {
        setSelectedGroupMemberId(queryTo);
      }
      
      // Also check if it matches a simplified debt
      if (entityData.simplifiedDebts) {
        const debt = entityData.simplifiedDebts.find(
          (d) => d.to === queryTo && d.amount === parseFloat(queryAmount)
        );
        if (debt) {
          setSelectedSimplifiedDebt(debt);
          setActiveTab("simplified");
        }
      }
    }
  }, [queryTo, queryAmount, queryTab, entityData, entityType, setValue]);

  if (!currentUser) return null;

  // Render the form for individual settlement
  if (entityType === "user") {
    const otherUser = entityData.counterpart;
    const netBalance = entityData.netBalance;

    return (
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Balance information */}
        <div className="bg-muted p-4 rounded-lg">
          <h3 className="font-medium mb-2">Current balance</h3>
          {netBalance === 0 ? (
            <p>You are all settled up with {otherUser.name}</p>
          ) : netBalance > 0 ? (
            <div className="flex justify-between items-center">
              <p>
                <span className="font-medium">{otherUser.name}</span> owes you
              </p>
              <span className="text-xl font-bold text-green-600">
                ${netBalance.toFixed(2)}
              </span>
            </div>
          ) : (
            <div className="flex justify-between items-center">
              <p>
                You owe <span className="font-medium">{otherUser.name}</span>
              </p>
              <span className="text-xl font-bold text-red-600">
                ${Math.abs(netBalance).toFixed(2)}
              </span>
            </div>
          )}
        </div>

        {/* Payment direction */}
        <div className="space-y-2">
          <Label>Who paid?</Label>
          <RadioGroup
            defaultValue="youPaid"
            {...register("paymentType")}
            className="flex flex-col space-y-2"
            onValueChange={(value) => {
              // This manual approach is needed because RadioGroup doesn't work directly with react-hook-form
              register("paymentType").onChange({
                target: { name: "paymentType", value },
              });
            }}
          >
            <div className="flex items-center space-x-2 border rounded-md p-3">
              <RadioGroupItem value="youPaid" id="youPaid" />
              <Label htmlFor="youPaid" className="flex-grow cursor-pointer">
                <div className="flex items-center">
                  <Avatar className="h-6 w-6 mr-2">
                    <AvatarImage src={currentUser.imageUrl} />
                    <AvatarFallback>
                      {currentUser.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <span>You paid {otherUser.name}</span>
                </div>
              </Label>
            </div>

            <div className="flex items-center space-x-2 border rounded-md p-3">
              <RadioGroupItem value="theyPaid" id="theyPaid" />
              <Label htmlFor="theyPaid" className="flex-grow cursor-pointer">
                <div className="flex items-center">
                  <Avatar className="h-6 w-6 mr-2">
                    <AvatarImage src={otherUser.imageUrl} />
                    <AvatarFallback>{otherUser.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <span>{otherUser.name} paid you</span>
                </div>
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* Amount */}
        <div className="space-y-2">
          <Label htmlFor="amount">Amount</Label>
          <div className="relative">
            <span className="absolute left-3 top-2.5">$</span>
            <Input
              id="amount"
              placeholder="0.00"
              type="number"
              step="0.01"
              min="0.01"
              className="pl-7"
              {...register("amount")}
            />
          </div>
          {errors.amount && (
            <p className="text-sm text-red-500">{errors.amount.message}</p>
          )}
        </div>

        {/* Note */}
        <div className="space-y-2">
          <Label htmlFor="note">Note (optional)</Label>
          <Textarea
            id="note"
            placeholder="Dinner, rent, etc."
            {...register("note")}
          />
        </div>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Recording..." : "Record settlement"}
        </Button>
      </form>
    );
  }

  // Render form for group settlement
  if (entityType === "group") {
    const groupMembers = entityData.balances;
    const simplifiedDebts = entityData.simplifiedDebts || [];

    const handleFormSubmit = async (data) => {
      if (activeTab === "individual") {
        await handleGroupSettlement(data, selectedGroupMemberId);
      } else if (activeTab === "simplified" && selectedSimplifiedDebt) {
        const amount = parseFloat(data.amount);
        try {
          await createSettlement.mutate({
            amount,
            note: data.note,
            paidByUserId: selectedSimplifiedDebt.from,
            receivedByUserId: selectedSimplifiedDebt.to,
            groupId: entityData.group.id,
          });
          toast.success("Settlement recorded successfully!");
          if (onSuccess) onSuccess();
        } catch (error) {
          toast.error("Failed to record settlement: " + error.message);
        }
      }
    };

    return (
      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="individual">Individual</TabsTrigger>
            <TabsTrigger value="simplified">Simplified</TabsTrigger>
          </TabsList>

          <TabsContent value="individual" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Who are you settling with?</Label>
              <div className="space-y-2">
                {groupMembers.map((member) => {
                  const isSelected = selectedGroupMemberId === member.userId;
                  const isOwing = member.netBalance < 0;
                  const isOwed = member.netBalance > 0;

                  return (
                    <div
                      key={member.userId}
                      className={`border rounded-md p-3 cursor-pointer transition-colors ${
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "hover:bg-muted/50"
                      }`}
                      onClick={() => setSelectedGroupMemberId(member.userId)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={member.imageUrl} />
                            <AvatarFallback>{member.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{member.name}</span>
                        </div>
                        <div className={`font-medium ${isOwed ? "text-green-600" : isOwing ? "text-red-600" : ""}`}>
                          {isOwing
                            ? `You owe ₹${Math.abs(member.netBalance).toFixed(2)}`
                            : isOwed
                              ? `They owe you ₹${Math.abs(member.netBalance).toFixed(2)}`
                              : "Settled up"}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="simplified" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Select a simplified debt to settle</Label>
              {simplifiedDebts.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">No simplified debts to settle.</p>
              ) : (
                <div className="space-y-2">
                  {simplifiedDebts.map((debt, idx) => {
                    const payer = entityData.balances.find(b => b.userId === debt.from) || { name: "You" };
                    const receiver = entityData.balances.find(b => b.userId === debt.to) || { name: "You" };
                    const isSelected = selectedSimplifiedDebt === debt;

                    return (
                      <div
                        key={idx}
                        className={`border rounded-md p-3 cursor-pointer transition-colors ${
                          isSelected
                            ? "border-primary bg-primary/5"
                            : "hover:bg-muted/50"
                        }`}
                        onClick={() => {
                          setSelectedSimplifiedDebt(debt);
                          setValue("amount", debt.amount.toString());
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="font-semibold">{payer.name}</span>
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                            <span className="font-semibold">{receiver.name}</span>
                          </div>
                          <span className="font-bold">₹{debt.amount.toFixed(2)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Common Form Fields (shown if selection is made) */}
        {((activeTab === "individual" && selectedGroupMemberId) || 
          (activeTab === "simplified" && selectedSimplifiedDebt)) && (
          <>
            {/* Payment direction (Only for Individual Tab) */}
            {activeTab === "individual" && (
              <div className="space-y-2">
                <Label>Who paid?</Label>
                <RadioGroup
                  defaultValue="youPaid"
                  {...register("paymentType")}
                  className="flex flex-col space-y-2"
                  onValueChange={(value) => {
                    register("paymentType").onChange({
                      target: { name: "paymentType", value },
                    });
                  }}
                >
                  <div className="flex items-center space-x-2 border rounded-md p-3">
                    <RadioGroupItem value="youPaid" id="youPaid" />
                    <Label htmlFor="youPaid" className="flex-grow cursor-pointer">
                      <div className="flex items-center">
                        <Avatar className="h-6 w-6 mr-2">
                          <AvatarImage src={currentUser.imageUrl} />
                          <AvatarFallback>{currentUser.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span>
                          You paid{" "}
                          {groupMembers.find((m) => m.userId === selectedGroupMemberId)?.name}
                        </span>
                      </div>
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2 border rounded-md p-3">
                    <RadioGroupItem value="theyPaid" id="theyPaid" />
                    <Label htmlFor="theyPaid" className="flex-grow cursor-pointer">
                      <div className="flex items-center">
                        <Avatar className="h-6 w-6 mr-2">
                          <AvatarImage
                            src={groupMembers.find((m) => m.userId === selectedGroupMemberId)?.imageUrl}
                          />
                          <AvatarFallback>
                            {groupMembers.find((m) => m.userId === selectedGroupMemberId)?.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <span>
                          {groupMembers.find((m) => m.userId === selectedGroupMemberId)?.name} paid you
                        </span>
                      </div>
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            )}

            {/* Amount */}
            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-2.5">₹</span>
                <Input
                  id="amount"
                  placeholder="0.00"
                  type="number"
                  step="0.01"
                  min="0.01"
                  className="pl-7"
                  {...register("amount")}
                />
              </div>
              {errors.amount && (
                <p className="text-sm text-red-500">{errors.amount.message}</p>
              )}
            </div>

            {/* Note */}
            <div className="space-y-2">
              <Label htmlFor="note">Note (optional)</Label>
              <Textarea
                id="note"
                placeholder="Dinner, rent, etc."
                {...register("note")}
              />
            </div>
          </>
        )}

        <Button
          type="submit"
          className="w-full"
          disabled={
            isSubmitting || 
            (activeTab === "individual" && !selectedGroupMemberId) ||
            (activeTab === "simplified" && !selectedSimplifiedDebt)
          }
        >
          {isSubmitting ? "Recording..." : "Record settlement"}
        </Button>
      </form>
    );
  }

  return null;
}
