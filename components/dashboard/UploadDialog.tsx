'use client';

import { useState, type ReactNode } from "react";
import { UploadZone } from "@/components/onboarding/UploadZone";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type UploadDialogProps = {
  trigger: ReactNode;
};

export function UploadDialog({ trigger }: UploadDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Upload Data</DialogTitle>
          <DialogDescription>
            Replace your reservation history with a new CSV export.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4">
          <UploadZone
            title="Upload Reservations"
            idleMessage="Upload a CSV export to refresh the dashboard."
            showDemoButton={false}
            onComplete={() => setOpen(false)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
