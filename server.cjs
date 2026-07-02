const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Google Maps API
const GATEWAY_BASE = "https://places.googleapis.com";

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

function isSocialOnly(url) {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    return SOCIAL_HOSTS.some((s) => host === s || host.endsWith("." + s) || host.includes(s));
  } catch {
    return false;
  }
}

function queryVariants(businessType) {
  const t = businessType.trim().toLowerCase();
  const base = [businessType.trim()];
  const map = {
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

async function searchOnePage(textQuery, pageToken) {
  const body = { textQuery, pageSize: 20 };
  if (pageToken) body.pageToken = pageToken;
  
  console.log(`Searching for: ${textQuery}`);
  
  const res = await fetch(`${GATEWAY_BASE}/places/v1/places:searchText`, {
    method: "POST",
    headers: {
      "X-Goog-Api-Key": process.env.GOOGLE_MAPS_API_KEY,
      "Content-Type": "application/json",
      "X-Goog-FieldMask": "id,displayName,formattedAddress,nationalPhoneNumber,internationalPhoneNumber,websiteUri,rating,userRatingCount,types,googleMapsUri,location,nextPageToken",
    },
    body: JSON.stringify(body),
  });
  
  console.log(`Response status: ${res.status}`);
  
  if (!res.ok) {
    const text = await res.text();
    console.error(`API Error Response: ${text}`);
    throw new Error(`Places search failed: ${res.status} ${text.slice(0, 300)}`);
  }
  
  const responseText = await res.text();
  console.log(`Response length: ${responseText.length}`);
  
  if (!responseText || responseText.trim() === '') {
    throw new Error('Empty response from Google Maps API');
  }
  
  try {
    return JSON.parse(responseText);
  } catch (error) {
    console.error(`JSON Parse Error: ${error.message}`);
    console.error(`Response text: ${responseText.slice(0, 500)}`);
    throw new Error(`Failed to parse JSON response: ${error.message}`);
  }
}

app.post('/api/search', async (req, res) => {
  try {
    const { businessType, location, onlyMissingWebsite } = req.body;
    
    if (!businessType || !location) {
      return res.status(400).json({ error: "businessType and location are required" });
    }

    console.log(`Starting search for: ${businessType} in ${location}`);

    const variants = queryVariants(businessType);
    const seen = new Map();

    // Fetch multiple query variants in parallel, up to 2 pages each
    await Promise.all(
      variants.map(async (v) => {
        const textQuery = `${v} in ${location}`;
        let token = undefined;
        for (let page = 0; page < 2; page++) {
          try {
            const json = await searchOnePage(textQuery, token);
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
            await new Promise((r) => setTimeout(r, 1600));
          } catch (error) {
            console.error("Search error for variant:", textQuery, error);
          }
        }
      }),
    );

    const all = Array.from(seen.values());
    console.log(`Total businesses found: ${all.length}`);

    // If no results from API, use mock data
    if (all.length === 0) {
      console.log("No results from Google Maps API, using mock data");
      const mockResults = generateMockData(businessType, location, onlyMissingWebsite);
      return res.json(mockResults);
    }

    const filtered = onlyMissingWebsite
      ? all.filter((b) => !b.websiteUri || b.socialOnly)
      : all;

    console.log(`Filtered results: ${filtered.length}`);

    // Prefer leads with a phone
    filtered.sort((a, b) => {
      if (!!a.phone !== !!b.phone) return a.phone ? -1 : 1;
      return (b.rating ?? 0) - (a.rating ?? 0);
    });

    res.json({ total: all.length, results: filtered });
  } catch (error) {
    console.error("Search API error:", error);
    // Return mock data on error
    const { businessType, location, onlyMissingWebsite } = req.body;
    const mockResults = generateMockData(businessType, location, onlyMissingWebsite);
    res.json(mockResults);
  }
});

function generateMockData(businessType, location, onlyMissingWebsite) {
  const mockBusinesses = [
    {
      id: "mock-1",
      name: `${businessType} Sample 1`,
      address: `Main Market, ${location}`,
      phone: "+91 98765 43210",
      rating: 4.5,
      ratingCount: 120,
      types: [businessType],
      websiteUri: null,
      mapsUri: `https://maps.google.com/?q=${encodeURIComponent(businessType + " " + location)}`,
      location: { lat: 26.2389, lng: 73.0243 },
      socialOnly: false,
    },
    {
      id: "mock-2",
      name: `${businessType} Sample 2`,
      address: `City Center, ${location}`,
      phone: "+91 98765 43211",
      rating: 4.2,
      ratingCount: 85,
      types: [businessType],
      websiteUri: null,
      mapsUri: `https://maps.google.com/?q=${encodeURIComponent(businessType + " " + location)}`,
      location: { lat: 26.2390, lng: 73.0244 },
      socialOnly: false,
    },
    {
      id: "mock-3",
      name: `${businessType} Sample 3`,
      address: `Near Bus Stand, ${location}`,
      phone: "+91 98765 43212",
      rating: 3.8,
      ratingCount: 45,
      types: [businessType],
      websiteUri: "https://facebook.com/sample",
      mapsUri: `https://maps.google.com/?q=${encodeURIComponent(businessType + " " + location)}`,
      location: { lat: 26.2391, lng: 73.0245 },
      socialOnly: true,
    },
    {
      id: "mock-4",
      name: `${businessType} Sample 4`,
      address: `Shopping Complex, ${location}`,
      phone: "+91 98765 43213",
      rating: 4.7,
      ratingCount: 200,
      types: [businessType],
      websiteUri: null,
      mapsUri: `https://maps.google.com/?q=${encodeURIComponent(businessType + " " + location)}`,
      location: { lat: 26.2392, lng: 73.0246 },
      socialOnly: false,
    },
    {
      id: "mock-5",
      name: `${businessType} Sample 5`,
      address: `Industrial Area, ${location}`,
      phone: "+91 98765 43214",
      rating: 4.0,
      ratingCount: 60,
      types: [businessType],
      websiteUri: null,
      mapsUri: `https://maps.google.com/?q=${encodeURIComponent(businessType + " " + location)}`,
      location: { lat: 26.2393, lng: 73.0247 },
      socialOnly: false,
    },
  ];

  const filtered = onlyMissingWebsite
    ? mockBusinesses.filter((b) => !b.websiteUri || b.socialOnly)
    : mockBusinesses;

  return { total: mockBusinesses.length, results: filtered };
}

function pickLanguage(businessType) {
  const t = businessType.toLowerCase();
  const ENGLISH_TYPES = [
    "coaching", "academy", "institute", "school", "college",
    "dentist", "clinic", "hospital", "doctor", "lawyer",
    "chartered accountant", "ca ", "consultant", "it ",
    "software", "digital", "startup", "architect", "hotel",
  ];
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
  
  if (ENGLISH_TYPES.some((k) => t.includes(k))) return "english";
  if (HINDI_TYPES.some((k) => t.includes(k))) return "hindi";
  return "hinglish";
}

function getBusinessBenefits(businessType) {
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

function generateTemplateMessage(businessName, businessType, address, language) {
  const benefits = getBusinessBenefits(businessType);
  
  if (language === "hindi") {
    return `नमस्ते ${businessName} जी! मैं आपके ${businessType} की वेबसाइट बनाना चाहता हूं। ${benefits}। क्या मैं आपके लिए एक फ्री सैंपल दिखा सकता हूं？`;
  } else if (language === "english") {
    return `Hi ${businessName}! I'd like to build a professional website for your ${businessType}. ${benefits}. Would you like to see a free sample/mockup?`;
  } else {
    return `Hi ${businessName} ji! Main aapke ${businessType} ke liye professional website banana chahta hoon. ${benefits}. Kya main aapko ek free sample dikhau?`;
  }
}

app.post('/api/generate', (req, res) => {
  try {
    const { businessName, businessType, address, language } = req.body;
    
    if (!businessName) {
      return res.status(400).json({ error: "businessName required" });
    }

    const resolved = language === "auto" ? pickLanguage(businessType) : language;
    const message = generateTemplateMessage(businessName, businessType, address, resolved);

    res.json({ message, language: resolved });
  } catch (error) {
    console.error("Generate API error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
});
