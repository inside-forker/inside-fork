"use client";

import { Button } from "@/components/ui/button";
import { AlertCircle, Loader2 } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";

interface GoPayFastFormProps {
  bookingReference: string;
  amount: number;
  customerEmail: string;
  customerMobile: string;
  transactionDescription?: string;
}

interface FormFieldsData {
  formFields: Record<string, string>;
  transactionUrl: string;
  generatedAt: string;
}

export function GoPayFastForm({
  bookingReference,
  amount,
  customerEmail,
  customerMobile,
  transactionDescription = "Checkout",
}: GoPayFastFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormFieldsData | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const hasFetchedRef = useRef(false);
  const hasSubmittedRef = useRef(false);

  // Fetch form fields from server
  const fetchFormFields = useCallback(async () => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    try {
      setError(null);

      const response = await fetch("/api/payment/payfast/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          basketId: bookingReference,
          amount: amount.toFixed(2),
          customerMobile,
          customerEmail,
          transactionDescription,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to generate payment form");
      }

      setFormData(result.data);
    } catch (err) {
      hasFetchedRef.current = false;
      console.error("[GoPayFastForm] Form generation error:", err);
      setError(
        err instanceof Error ? err.message : "Failed to initialize payment"
      );
    }
  }, [
    bookingReference,
    amount,
    customerMobile,
    customerEmail,
    transactionDescription,
  ]);

  // Fetch form fields when component mounts
  useEffect(() => {
    fetchFormFields();
  }, [fetchFormFields]);

  // Auto-submit form when form data is received
  useEffect(() => {
    if (formData && formRef.current && !hasSubmittedRef.current) {
      hasSubmittedRef.current = true;
      setIsLoading(true);
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        formRef.current?.submit();
      }, 100);
    }
  }, [formData]);

  const handleRetry = () => {
    hasFetchedRef.current = false;
    hasSubmittedRef.current = false;
    setIsLoading(false);
    setError(null);
    setFormData(null);
    fetchFormFields();
  };

  // Show error state
  if (error) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
            <div className="flex-1">
              <h4 className="text-base sm:text-lg font-bold text-destructive mb-1">
                Payment Initialization Failed
              </h4>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          </div>
        </div>

        <Button
          onClick={handleRetry}
          className="w-full py-6 text-lg"
          variant="outline"
        >
          Try Again
        </Button>
      </div>
    );
  }

  // Show loading state while fetching form fields
  if (!formData) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-border bg-muted/50 p-8">
          <div className="flex flex-col items-center justify-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <div className="text-center space-y-1">
              <p className="text-lg sm:text-xl font-semibold">Initializing Secure Payment</p>
              <p className="text-sm sm:text-base text-muted-foreground">
                Please wait while we prepare your transaction...
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render auto-submitting form with server-generated fields
  return (
    <div className="space-y-4">
      <form
        ref={formRef}
        action={formData.transactionUrl}
        method="POST"
        className="hidden"
      >
        {Object.entries(formData.formFields).map(([key, value]) => (
          <input key={key} type="hidden" name={key} value={value} />
        ))}
      </form>

      <div className="rounded-lg border border-border bg-muted/50 p-8">
        <div className="flex flex-col items-center justify-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <div className="text-center space-y-1">
            <p className="text-lg sm:text-xl font-semibold">Redirecting to Secure Payment Gateway</p>
            <p className="text-sm sm:text-base text-muted-foreground">
              You will be redirected to PayFast in a moment...
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        Secure 256-bit SSL Encrypted Payment
      </div>
    </div>
  );
}
