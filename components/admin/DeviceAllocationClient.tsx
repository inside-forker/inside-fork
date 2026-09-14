"use client";

import React from "react";
import { AccountCreationHub } from "@/components/admin/AccountCreationHub";

export function DeviceAllocationClient({ eventId }: { eventId: number }) {
  return (
    <AccountCreationHub
      initialEventId={eventId}
      initialTab="allocation"
    />
  );
}
