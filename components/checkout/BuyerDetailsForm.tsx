"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Phone, User, CreditCard } from "lucide-react";
import { formatPhone } from "./checkoutFormat";

interface BuyerDetailsFormProps {
  values: {
    name: string;
    email: string;
    phone: string;
    cnic: string;
  };
  onChange: (field: string, value: string) => void;
  errors?: { name?: string; email?: string; phone?: string; cnic?: string };
  readOnly?: boolean;
}

export function BuyerDetailsForm({
  values,
  onChange,
  errors,
  readOnly,
}: BuyerDetailsFormProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
        <div className="h-1.5 w-1.5 rounded-full bg-primary" />
        Contact Information
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="buyer-name" className="text-base font-semibold">Full Name *</Label>
          <div className="relative">
            <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="buyer-name"
              placeholder="Enter your full name"
              className="pl-9"
              value={values.name}
              onChange={(e) => onChange("name", e.target.value)}
              readOnly={readOnly}
            />
          </div>
          {errors?.name && (
            <p className="text-xs text-destructive">{errors.name}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="buyer-phone" className="text-base font-semibold">Phone Number *</Label>
          <div className="relative">
            <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="buyer-phone"
              placeholder="03XX-XXXXXXX"
              className="pl-9"
              value={values.phone}
              onChange={(e) => onChange("phone", formatPhone(e.target.value))}
              onFocus={() => {
                if (!values.phone.replace(/\D/g, "")) onChange("phone", "03");
              }}
              readOnly={readOnly}
            />
          </div>
          {errors?.phone && (
            <p className="text-xs text-destructive">{errors.phone}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="buyer-cnic" className="text-base font-semibold">CNIC *</Label>
          <div className="relative">
            <CreditCard className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="buyer-cnic"
              placeholder="42101-1234567-1"
              className="pl-9"
              value={values.cnic}
              onChange={(e) => {
                let val = e.target.value.replace(/\D/g, "");
                if (val.length > 13) val = val.slice(0, 13);
                // Format as 42101-1234567-1
                if (val.length > 12) {
                  val =
                    val.slice(0, 5) +
                    "-" +
                    val.slice(5, 12) +
                    "-" +
                    val.slice(12);
                } else if (val.length > 5) {
                  val = val.slice(0, 5) + "-" + val.slice(5);
                }
                onChange("cnic", val);
              }}
              readOnly={readOnly}
            />
          </div>
          {errors?.cnic && (
            <p className="text-xs text-destructive">{errors.cnic}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="buyer-email" className="text-base font-semibold">Email Address *</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="buyer-email"
              type="email"
              placeholder="you@example.com"
              className="pl-9"
              value={values.email}
              onChange={(e) => onChange("email", e.target.value)}
              readOnly={readOnly}
            />
          </div>
          {errors?.email && (
            <p className="text-xs text-destructive">{errors.email}</p>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Your tickets will be sent to this email address.
      </p>
    </div>
  );
}
