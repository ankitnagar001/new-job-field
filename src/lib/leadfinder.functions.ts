import { createServerFn } from "@tanstack/react-start";

export type Business = {
  id: string;
  name: string;
  address: string;
  phone: string | null;
  rating: number | null;
  ratingCount: number | null;
  types: string[];
  websiteUri: string | null;
  mapsUri: string | null;
  location: { lat: number; lng: number } | null;
  /** true if the "website" is really just a social/link-in-bio page */
  socialOnly: boolean;
};

type SearchInput = {
  businessType: string;
  location: string;
  onlyMissingWebsite?: boolean;
};

const GATEWAY_BASE = "https://places.googleapis.com";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

// Domains that are NOT a real business website — treat as "needs a website"
const SOCIAL_HOSTS = [
  "facebook.com",
  "fb.com",
  "instagram.com",
  "instagr.am",
  "wa.me",
  "whatsapp.com",
  "linktr.ee",
  "linktree",
  "sites.google.com",
  "google.com",
  "goo.gl",
  "youtube.com",
  "youtu.be",
  "justdial.com",
  "sulekha.com",
  "urbanpro.com",
  "urbanclap.com",
  "wixsite.com",
  "blogspot.com",
  "twitter.com",
  "x.com",
  "t.me",
];

function isSocialOnly(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    return SOCIAL_HOSTS.some((s) => host === s || host.endsWith("." + s) || host.includes(s));
  } catch {
    return false;
  }
}

// Expand a business type into multiple search phrasings so we catch more results
function queryVariants(businessType: string): string[] {
  const t = businessType.trim().toLowerCase();
  const base = [businessType.trim()];
  const map: Record<string, string[]> = {
    "coaching center": [
      "coaching classes", "coaching institute", "tuition classes",
      "tutorial center", "IIT JEE coaching", "NEET coaching", "academy",
    ],
    coaching: ["coaching classes", "coaching institute", "tuition classes", "academy"],
    restaurant: ["restaurant", "cafe", "dhaba", "family restaurant", "fast food"],
    cafe: ["cafe", "coffee shop", "bakery cafe"],
    gym: ["gym", "fitness center", "fitness studio", "crossfit"],
    "beauty salon": ["beauty salon", "beauty parlour", "hair salon", "unisex salon", "makeup studio"],
    dentist: ["dentist", "dental clinic"],
    boutique: ["boutique", "designer boutique", "ladies boutique"],
    "kirana store": ["kirana store", "grocery store", "general store", "provision store", "supermarket"],
    "clothing store": ["clothing store", "garment shop", "kapda dukan", "readymade garments", "fashion store", "menswear shop", "ladies wear shop"],
    "medical store": ["medical store", "pharmacy", "chemist shop", "drug store"],
    "mobile shop": ["mobile shop", "mobile store", "cell phone store", "mobile repair"],
    "electronics store": ["electronics store", "electronics shop", "home appliances store"],
    "hardware store": ["hardware store", "sanitary shop", "paint shop", "building materials"],
    "sweet shop": ["sweet shop", "mithai shop", "halwai", "namkeen shop"],
    bakery: ["bakery", "cake shop", "pastry shop"],
    "jewellery shop": ["jewellery shop", "jewellers", "gold shop", "imitation jewellery"],
    "furniture store": ["furniture store", "furniture shop", "sofa shop"],
    "shoe store": ["shoe store", "footwear shop"],
    "book store": ["book store", "stationery shop", "book shop"],
    "toy store": ["toy store", "gift shop", "kids store"],
    "auto repair": ["car repair", "bike repair", "auto garage", "car service center", "two wheeler service"],
    "car dealer": ["car dealer", "used car dealer", "car showroom"],
    "real estate": ["real estate agent", "property dealer", "real estate office"],
    hotel: ["hotel", "lodge", "guest house", "boutique hotel"],
    clinic: ["clinic", "doctor clinic", "medical clinic", "polyclinic"],
    hospital: ["hospital", "nursing home", "multispeciality hospital"],
    lawyer: ["lawyer", "advocate", "law firm"],
    "chartered accountant": ["chartered accountant", "CA office", "tax consultant"],
    "interior designer": ["interior designer", "interior decorator"],
    photographer: ["photographer", "photo studio", "wedding photographer"],
    "event planner": ["event planner", "wedding planner", "event management"],
    "travel agent": ["travel agent", "tour operator", "travel agency"],
    "driving school": ["driving school", "motor training school"],
    "play school": ["play school", "preschool", "kindergarten", "montessori"],
    school: ["school", "public school", "convent school"],
    "yoga studio": ["yoga studio", "yoga classes", "yoga center"],
    "dance class": ["dance class", "dance academy", "dance studio"],
    "music class": ["music class", "music academy", "guitar classes"],
    spa: ["spa", "massage center", "wellness spa"],
    laundry: ["laundry", "dry cleaner", "laundromat"],
    printing: ["printing press", "print shop", "digital printing"],
    tailor: ["tailor", "tailoring shop", "boutique tailor"],
    optical: ["optical shop", "eye wear store", "spectacles shop"],
    "pet shop": ["pet shop", "pet store", "veterinary clinic"],
    "florist": ["florist", "flower shop"],
    "cyber cafe": ["cyber cafe", "internet cafe", "photocopy shop"],
    "juice shop": ["juice shop", "juice corner", "smoothie bar"],
    "ice cream": ["ice cream parlour", "ice cream shop"],
  };
  const extra = map[t] ?? [];
  return Array.from(new Set([...base, ...extra]));
}

async function searchOnePage(
  textQuery: string,
  pageToken: string | undefined,
  mapsKey: string,
) {
  const body: Record<string, unknown> = { textQuery, pageSize: 20 };
  if (pageToken) body.pageToken = pageToken;
  const res = await fetch(`${GATEWAY_BASE}/places/v1/places:searchText`, {
    method: "POST",
   headers: {
  "X-Goog-Api-Key": process.env.GOOGLE_MAPS_API_KEY!,
  "Content-Type": "application/json",
  "X-Goog-FieldMask": "...",
},
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Places search failed: ${res.status} ${text.slice(0, 300)}`);
  }
  return (await res.json()) as {
    nextPageToken?: string;
    places?: Array<{
      id?: string;
      displayName?: { text?: string };
      formattedAddress?: string;
      nationalPhoneNumber?: string;
      internationalPhoneNumber?: string;
      websiteUri?: string;
      rating?: number;
      userRatingCount?: number;
      types?: string[];
      googleMapsUri?: string;
      location?: { latitude?: number; longitude?: number };
    }>;
  };
}

export const searchBusinesses = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown): SearchInput => {
    const d = raw as Partial<SearchInput>;
    if (!d?.businessType || !d?.location) {
      throw new Error("businessType and location are required");
    }
    return {
      businessType: String(d.businessType).slice(0, 120),
      location: String(d.location).slice(0, 200),
      onlyMissingWebsite: d.onlyMissingWebsite !== false,
    };
  })
  .handler(async ({ data }) => {
    const GOOGLE_MAPS_API_KEY = requireEnv("GOOGLE_MAPS_API_KEY");

    const variants = queryVariants(data.businessType);
    const seen = new Map<string, Business>();

    // Fetch multiple query variants in parallel, up to 2 pages each (~40 per variant)
    await Promise.all(
      variants.map(async (v) => {
        const textQuery = `${v} in ${data.location}`;
        let token: string | undefined = undefined;
        for (let page = 0; page < 2; page++) {
          const json = await searchOnePage(textQuery, token, GOOGLE_MAPS_API_KEY);
          for (const p of json.places ?? []) {
            const id = p.id ?? `${p.displayName?.text}-${p.formattedAddress}`;
            if (seen.has(id)) continue;
            seen.set(id, {
              id,
              name: p.displayName?.text ?? "Unknown",
              address: p.formattedAddress ?? "",
              phone: p.internationalPhoneNumber ?? p.nationalPhoneNumber ?? null,
              rating: p.rating ?? null,
              ratingCount: p.userRatingCount ?? null,
              types: p.types ?? [],
              websiteUri: p.websiteUri ?? null,
              mapsUri: p.googleMapsUri ?? null,
              location:
                p.location?.latitude != null && p.location?.longitude != null
                  ? { lat: p.location.latitude, lng: p.location.longitude }
                  : null,
              socialOnly: isSocialOnly(p.websiteUri),
            });
          }
          if (!json.nextPageToken) break;
          token = json.nextPageToken;
          // Google requires a short delay before nextPageToken becomes valid
          await new Promise((r) => setTimeout(r, 1600));
        }
      }),
    );

    const all = Array.from(seen.values());
    // "No real website" = no URL at all OR only a social/link-in-bio page
    const filtered = data.onlyMissingWebsite
      ? all.filter((b) => !b.websiteUri || b.socialOnly)
      : all;

    // Prefer leads with a phone (they're actionable via WhatsApp)
    filtered.sort((a, b) => {
      if (!!a.phone !== !!b.phone) return a.phone ? -1 : 1;
      return (b.rating ?? 0) - (a.rating ?? 0);
    });

    return { total: all.length, results: filtered };
  });

type Language = "auto" | "hinglish" | "hindi" | "english";

type MessageInput = {
  businessName: string;
  businessType: string;
  address: string;
  language: Language;
};

// Business types where owners are typically comfortable with English
const ENGLISH_TYPES = [
  "coaching",
  "academy",
  "institute",
  "school",
  "college",
  "dentist",
  "clinic",
  "hospital",
  "doctor",
  "lawyer",
  "chartered accountant",
  "ca ",
  "consultant",
  "it ",
  "software",
  "digital",
  "startup",
  "architect",
  "hotel",
];

// Business types where Hindi / Hinglish works better
const HINDI_TYPES = [
  "dhaba", "kirana", "general store", "provision", "grocery",
  "sweet shop", "mithai", "halwai", "namkeen",
  "tailor", "boutique", "parlour", "salon",
  "mechanic", "electrician", "plumber", "medical", "pandit",
  "kapda", "garment", "readymade", "cloth", "saree",
  "hardware", "sanitary", "paint shop",
  "mobile repair", "cyber cafe", "laundry", "dry clean",
  "juice", "ice cream", "bakery", "florist",
  "shoe", "footwear", "furniture", "jewellery", "optical",
];


function pickLanguage(businessType: string): "hinglish" | "hindi" | "english" {
  const t = businessType.toLowerCase();
  if (ENGLISH_TYPES.some((k) => t.includes(k))) return "english";
  if (HINDI_TYPES.some((k) => t.includes(k))) return "hindi";
  return "hinglish";
}

export const generateWhatsAppMessage = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown): MessageInput => {
    const d = raw as Partial<MessageInput>;
    if (!d?.businessName) throw new Error("businessName required");
    return {
      businessName: String(d.businessName).slice(0, 200),
      businessType: String(d.businessType ?? "business").slice(0, 100),
      address: String(d.address ?? "").slice(0, 300),
      language: (d.language ?? "auto") as Language,
    };
  })
  .handler(async ({ data }) => {
    const resolved =
      data.language === "auto" ? pickLanguage(data.businessType) : data.language;

    // Generate a template-based message without AI API
    const message = generateTemplateMessage(data.businessName, data.businessType, data.address, resolved);

    return { message, language: resolved };
  });

function generateTemplateMessage(businessName: string, businessType: string, address: string, language: "hinglish" | "hindi" | "english"): string {
  const benefits = getBusinessBenefits(businessType);
  
  if (language === "hindi") {
    return `नमस्ते ${businessName} जी! मैं आपके ${businessType} की वेबसाइट बनाना चाहता हूं। ${benefits}। क्या मैं आपके लिए एक फ्री सैंपल दिखा सकता हूं？`;
  } else if (language === "english") {
    return `Hi ${businessName}! I'd like to build a professional website for your ${businessType}. ${benefits}. Would you like to see a free sample/mockup?`;
  } else {
    return `Hi ${businessName} ji! Main aapke ${businessType} ke liye professional website banana chahta hoon. ${benefits}. Kya main aapko ek free sample dikhau?`;
  }
}

function getBusinessBenefits(businessType: string): string {
  const t = businessType.toLowerCase();
  
  if (t.includes("coaching") || t.includes("institute") || t.includes("academy") || t.includes("school")) {
    return "Students ko online admission mil jayegi, batch schedule aur results showcase honge";
  } else if (t.includes("restaurant") || t.includes("cafe") || t.includes("dhaba") || t.includes("bakery")) {
    return "Menu photos se Google ranking badhegi, online orders aur table booking hoga";
  } else if (t.includes("salon") || t.includes("parlour") || t.includes("spa")) {
    return "Portfolio gallery aur price list se clients aasani se booking karenge";
  } else if (t.includes("clinic") || t.includes("doctor") || t.includes("dentist") || t.includes("hospital")) {
    return "Services aur timings ke saath appointment booking aasan ho jayegi";
  } else if (t.includes("gym") || t.includes("yoga") || t.includes("dance") || t.includes("music")) {
    return "Batches aur plans ke saath trial booking aasani se hogi";
  } else if (t.includes("kirana") || t.includes("grocery") || t.includes("general store")) {
    return "WhatsApp catalog se home delivery orders badhengi";
  } else if (t.includes("clothing") || t.includes("boutique") || t.includes("saree") || t.includes("jewellery")) {
    return "Latest collection gallery se WhatsApp orders aur festive offers badhengi";
  } else if (t.includes("medical") || t.includes("pharmacy")) {
    return "Product availability aur quick order on WhatsApp se home delivery aasan hogi";
  } else if (t.includes("mobile") || t.includes("electronics") || t.includes("hardware")) {
    return "Product catalog with prices aur EMI info se enquiries badhengi";
  } else {
    return "Online presence se customers aasani se milein aur business grow karega";
  }
}
