import { Leaf } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center text-center px-4">
      <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mb-8 relative">
        <Leaf className="w-12 h-12 text-primary opacity-50" />
        <div className="absolute inset-0 border-2 border-dashed border-primary/20 rounded-full animate-[spin_10s_linear_infinite]" />
      </div>
      
      <h1 className="text-6xl font-serif font-bold text-foreground mb-4">404</h1>
      <h2 className="text-2xl font-bold text-secondary mb-4">Fallow Field</h2>
      <p className="text-muted-foreground max-w-md mb-8">
        It looks like this patch of land hasn't been cultivated yet. Let's get you back to familiar grounds.
      </p>
      
      <Link href="/">
        <Button size="lg" className="rounded-full px-8">
          Return to Campus
        </Button>
      </Link>
    </div>
  );
}
