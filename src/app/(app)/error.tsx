"use client";

import { Button, Card, CardBody } from "@/components/ui/primitives";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <Card>
      <CardBody className="py-10 text-center">
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="text-sm text-muted mt-2 max-w-sm mx-auto">
          We hit an unexpected error loading this section. Your data is safe — try again.
        </p>
        <Button className="mt-5" onClick={reset}>Try again</Button>
      </CardBody>
    </Card>
  );
}
