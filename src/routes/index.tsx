import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast, Toaster } from "sonner";
import {
  MapPin,
  Search,
  Sparkles,
  Star,
  Phone,
  Globe,
  MessageCircle,
  Loader2,
  Copy,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  searchBusinesses,
  generateWhatsAppMessage,
  type Business,
} from "@/lib/leadfinder.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LeadPilot — Find Local Businesses Without Websites" },
      {
        name: "description",
        content:
          "Google Maps se aise businesses dhundo jinki website nahi hai, aur AI-generated WhatsApp messages ek click me bhejo.",
      },
      { property: "og:title", content: "LeadPilot — Website-Less Business Finder" },
      {
        property: "og:description",
        content:
          "Discover coaching centers, restaurants, and shops missing a website. Send personalized WhatsApp outreach in seconds.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LeadFinder,
});

const QUICK_TYPES = [
  "Coaching Center",
  "Restaurant",
  "Cafe",
  "Kirana Store",
  "Clothing Store",
  "Medical Store",
  "Mobile Shop",
  "Electronics Store",
  "Hardware Store",
  "Sweet Shop",
  "Bakery",
  "Jewellery Shop",
  "Furniture Store",
  "Shoe Store",
  "Gym",
  "Yoga Studio",
  "Beauty Salon",
  "Spa",
  "Boutique",
  "Tailor",
  "Dentist",
  "Clinic",
  "Hospital",
  "Hotel",
  "Real Estate",
  "Auto Repair",
  "Car Dealer",
  "Photographer",
  "Event Planner",
  "Travel Agent",
  "Play School",
  "Dance Class",
  "Music Class",
  "Optical",
  "Laundry",
  "Printing",
  "Pet Shop",
  "Florist",
  "Ice Cream",
];


function LeadFinder() {
  const [businessType, setBusinessType] = useState("Coaching Center");
  const [location, setLocation] = useState("");
  const [language, setLanguage] = useState<"auto" | "hinglish" | "hindi" | "english">("auto");
  const [results, setResults] = useState<Business[]>([]);
  const [totalFound, setTotalFound] = useState<number | null>(null);
  const [activeBusiness, setActiveBusiness] = useState<Business | null>(null);
  const [message, setMessage] = useState("");

  const search = useServerFn(searchBusinesses);
  const generate = useServerFn(generateWhatsAppMessage);

  const searchMut = useMutation({
    mutationFn: async () =>
      search({ data: { businessType, location, onlyMissingWebsite: true } }),
    onSuccess: (data) => {
      setResults(data.results);
      setTotalFound(data.total);
      if (data.results.length === 0) {
        toast.info(
          `${data.total} businesses mile, but sabki website already hai. Doosra area try karo.`,
        );
      } else {
        toast.success(`${data.results.length} leads mili (out of ${data.total})`);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const genMut = useMutation({
    mutationFn: async (b: Business) =>
      generate({
        data: {
          businessName: b.name,
          businessType,
          address: b.address,
          language,
        },
      }),
    onSuccess: (data, b) => {
      setActiveBusiness(b);
      setMessage(data.message);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openWhatsApp = (phone: string | null, msg: string) => {
    if (!phone) {
      toast.error("Is business ka phone number nahi mila");
      return;
    }
    const clean = phone.replace(/[^\d]/g, "");
    const url = `https://wa.me/${clean}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank", "noopener");
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!location.trim()) {
      toast.error("Location daalna zaroori hai");
      return;
    }
    searchMut.mutate();
  };

  return (
    <div className="min-h-screen bg-gradient-hero">
      <Toaster position="top-center" richColors />

      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-9 rounded-lg bg-gradient-brand flex items-center justify-center shadow-brand">
              <MapPin className="size-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-none">LeadPilot</h1>
              <p className="text-xs text-muted-foreground">Website-less business finder</p>
            </div>
          </div>
          <Badge variant="secondary" className="hidden sm:inline-flex gap-1">
            <Sparkles className="size-3" /> AI powered
          </Badge>
        </div>
      </header>

      {/* Hero + Search */}
      <section className="max-w-6xl mx-auto px-4 pt-10 pb-6">
        <div className="text-center mb-8">
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight mb-3">
            Aise businesses dhundo jinko{" "}
            <span className="bg-gradient-brand bg-clip-text text-transparent">
              website chahiye
            </span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-base sm:text-lg">
            Google Maps se coaching, restaurants, salons — kuch bhi search karo.
            Sirf woh businesses dikhayenge jinki website nahi hai. Phir AI se
            personalized WhatsApp message bhejo.
          </p>
        </div>

        <Card className="p-4 sm:p-6 shadow-card border-border/60">
          <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-[1fr_1.2fr_auto]">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Business type
              </label>
              <Input
                placeholder="e.g. Coaching Center"
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Location
              </label>
              <Input
                placeholder="e.g. Kota, Rajasthan"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button
                type="submit"
                disabled={searchMut.isPending}
                className="w-full sm:w-auto h-10 gap-2 bg-gradient-brand hover:opacity-90 shadow-brand"
              >
                {searchMut.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Search className="size-4" />
                )}
                Search leads
              </Button>
            </div>
          </form>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground mr-1">Quick:</span>
            {QUICK_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setBusinessType(t)}
                className={`text-xs px-3 py-1 rounded-full border transition ${businessType === t
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background hover:bg-accent border-border"
                  }`}
              >
                {t}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Message language:</span>
              <Select value={language} onValueChange={(v) => setLanguage(v as typeof language)}>
                <SelectTrigger className="h-8 w-32 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto (smart)</SelectItem>
                  <SelectItem value="hinglish">Hinglish</SelectItem>
                  <SelectItem value="hindi">Hindi</SelectItem>
                  <SelectItem value="english">English</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>
      </section>

      {/* Results */}
      <section className="max-w-6xl mx-auto px-4 pb-16">
        {totalFound !== null && (
          <div className="flex items-center justify-between mb-4 px-1">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{results.length}</span>{" "}
              website-less leads mile{" "}
              <span className="text-muted-foreground/70">
                (of {totalFound} total found)
              </span>
            </p>
          </div>
        )}

        {searchMut.isPending && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Card key={i} className="p-5 animate-pulse space-y-3">
                <div className="h-4 bg-muted rounded w-2/3" />
                <div className="h-3 bg-muted rounded w-full" />
                <div className="h-3 bg-muted rounded w-4/5" />
                <div className="h-9 bg-muted rounded mt-4" />
              </Card>
            ))}
          </div>
        )}

        {!searchMut.isPending && results.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((b) => (
              <BusinessCard
                key={b.id}
                business={b}
                onGenerate={() => genMut.mutate(b)}
                isGenerating={genMut.isPending && genMut.variables?.id === b.id}
              />
            ))}
          </div>
        )}

        {!searchMut.isPending && totalFound === null && (
          <EmptyState />
        )}
      </section>

      {/* Message dialog */}
      <Dialog
        open={!!activeBusiness}
        onOpenChange={(o) => !o && setActiveBusiness(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              Message for {activeBusiness?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={9}
              className="text-sm resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Edit karke perfect kar sakte ho. Phir "Send on WhatsApp" click karo —
              WhatsApp khul jayega pre-filled message ke saath.
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(message);
                toast.success("Copied!");
              }}
              className="gap-2"
            >
              <Copy className="size-4" /> Copy
            </Button>
            <Button
              onClick={() => openWhatsApp(activeBusiness?.phone ?? null, message)}
              className="gap-2 bg-[#25D366] hover:bg-[#20b858] text-white"
            >
              <MessageCircle className="size-4" /> Send on WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BusinessCard({
  business,
  onGenerate,
  isGenerating,
}: {
  business: Business;
  onGenerate: () => void;
  isGenerating: boolean;
}) {
  return (
    <Card className="p-5 hover:shadow-card-hover transition-all border-border/60 flex flex-col">
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-semibold leading-tight">{business.name}</h3>
        {business.rating != null && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
            <Star className="size-3 fill-amber-400 text-amber-400" />
            {business.rating.toFixed(1)}
            {business.ratingCount ? (
              <span className="opacity-70">({business.ratingCount})</span>
            ) : null}
          </div>
        )}
      </div>

      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
        {business.address}
      </p>

      <div className="flex flex-wrap gap-1.5 mb-3">
        <Badge variant="outline" className="text-[10px] gap-1 border-destructive/40 text-destructive">
          <Globe className="size-2.5" />
          {business.socialOnly ? "Only social page" : "No website"}
        </Badge>
        {business.phone && (
          <Badge variant="secondary" className="text-[10px] gap-1">
            <Phone className="size-2.5" /> Phone available
          </Badge>
        )}
      </div>

      <div className="mt-auto flex gap-2">
        <Button
          size="sm"
          onClick={onGenerate}
          disabled={isGenerating || !business.phone}
          className="flex-1 gap-1.5 bg-gradient-brand hover:opacity-90 text-primary-foreground"
        >
          {isGenerating ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Sparkles className="size-3.5" />
          )}
          {business.phone ? "AI message" : "No phone"}
        </Button>
        {business.mapsUri && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => window.open(business.mapsUri!, "_blank", "noopener")}
            className="gap-1.5"
          >
            <ExternalLink className="size-3.5" />
          </Button>
        )}
      </div>
    </Card>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-16 px-4">
      <div className="inline-flex size-16 rounded-2xl bg-gradient-brand items-center justify-center mb-4 shadow-brand">
        <Search className="size-7 text-primary-foreground" />
      </div>
      <h3 className="font-semibold text-lg mb-1">Search karke leads dhundo</h3>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">
        Business type aur city daalke "Search leads" click karo. Hum Google Maps
        pe filter karke sirf website-less businesses dikhayenge.
      </p>
    </div>
  );
}
