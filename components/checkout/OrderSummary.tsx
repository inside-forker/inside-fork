"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CartItem } from "@/lib/context/cartStore";
import { Ticket } from "lucide-react";

interface OrderSummaryProps {
  items: CartItem[];
  platformFeeFixed: number;
  platformFeePercentage: number;
  paymentFeeFixed: number;
  paymentFeePercentage: number;
  /** Parchi student discount, taken off the subtotal before fees. */
  discount?: number;
}

export function OrderSummary({
  items,
  platformFeeFixed,
  platformFeePercentage,
  paymentFeeFixed,
  paymentFeePercentage,
  discount = 0,
  children,
}: OrderSummaryProps & { children?: React.ReactNode }) {
  const subtotal = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  // Mirrors app/api/bookings/create/route.ts: fees on the discounted subtotal.
  const discountedSubtotal = subtotal - discount;
  const platformFee =
    platformFeeFixed + discountedSubtotal * (platformFeePercentage / 100);
  const paymentFee =
    paymentFeeFixed +
    (discountedSubtotal + platformFee) * (paymentFeePercentage / 100);

  const total = discountedSubtotal + platformFee + paymentFee;

  return (
    <Card className="h-fit border-2 border-primary/10 shadow-lg">
      <CardHeader className="bg-muted/30 pb-4">
        <CardTitle className="flex items-center gap-2 text-xl sm:text-2xl font-bold">
          <Ticket className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
          Order Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        {/* Items List */}
        <div className="space-y-4">
          {items.map((item) => (
            <div
              key={item.ticketTypeId}
              className="flex justify-between text-sm"
            >
              <div className="space-y-1">
                <p className="font-medium">{item.eventName}</p>
                <p className="text-muted-foreground">
                  {item.quantity}x {item.ticketName}
                </p>
              </div>
              <p className="font-medium">
                PKR {(item.price * item.quantity).toLocaleString()}
              </p>
            </div>
          ))}
        </div>

        <Separator />

        {/* Fees Breakdown */}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span>PKR {subtotal.toLocaleString()}</span>
          </div>

          {discount > 0 && (
            <div className="flex justify-between text-primary">
              <span>Parchi student discount</span>
              <span>- PKR {Math.round(discount).toLocaleString()}</span>
            </div>
          )}

          {platformFee > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Platform Fee</span>
              <span>PKR {Math.round(platformFee).toLocaleString()}</span>
            </div>
          )}

          {paymentFee > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Processing Fee</span>
              <span>PKR {Math.round(paymentFee).toLocaleString()}</span>
            </div>
          )}
        </div>

        <Separator />

        {/* Total */}
        <div className="flex justify-between items-end">
          <div>
            <p className="text-sm sm:text-base text-muted-foreground font-medium">Total Amount</p>
            <p className="text-xs text-muted-foreground">
              (Inclusive of all taxes)
            </p>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-primary">
            PKR {Math.round(total).toLocaleString()}
          </p>
        </div>

        {/* Action Buttons / Footer */}
        {children && <div className="pt-2">{children}</div>}
      </CardContent>
    </Card>
  );
}
