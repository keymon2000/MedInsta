/* ------------------------------------------------------------------
   MedInsta — Mock Data Layer (Medicine Continuity prototype)
   All data below is fictional/demo data standing in for what would,
   in a real deployment, come from Order / Inventory / Prescription /
   Fulfilment / Delivery / Catalog services behind an orchestration layer.
   ------------------------------------------------------------------ */

const MC_DATA = {

  app: {
    name: "MedInsta",
  },

  agent: {
    name: "MediBuddy",
  },

  customer: {
    name: "Tushar",
    lastOrderDate: "2026-09-05",
    nextRefillEstimate: "5 days",
  },

  // The customer's previous completed order — the seed for "Smart Reorder"
  previousOrder: {
    id: "ORD-1040",
    date: "2026-09-05",
    total: 1319,
    items: [
      {
        id: "med-a",
        name: "Medicine A (Demo) 500mg",
        constituent: "Aceclofenac 100mg",
        qty: 30,
        price: 430,
        availability: "available",
        status: "ok",
        prescriptionRequired: false,
      },
      {
        id: "med-b",
        name: "Medicine B (Demo) 250mg",
        constituent: "Cetirizine 10mg",
        qty: 20,
        price: 290,
        availability: "available",
        status: "ok",
        prescriptionRequired: false,
      },
      {
        id: "med-c",
        name: "Medicine C (Demo) 10mg",
        constituent: "Azithromycin 500mg",
        qty: 10,
        price: 520,
        availability: "unavailable",
        status: "attention",
        prescriptionRequired: false,
        reason: "We couldn't fulfil this medicine from your current location.",
      },
      {
        id: "med-d",
        name: "Glucofit 500mg Tablet (Demo)",
        constituent: "Metformin 500mg",
        qty: 30,
        price: 79,
        availability: "verification_needed",
        status: "attention",
        prescriptionRequired: true,
        reason: "Your prescription for this exact brand needs re-verification before this refill.",
        // Brands with the identical constituent — picking one of these resolves
        // the exception instantly via constituent match, no re-verification needed.
        substitutes: [
          { id: "med-d-s1", name: "Sugarmet 500 Tablet", manufacturer: "Nova Pharma", packSize: "Strip of 15 tablets", mrp: 88, price: 66, discountPct: 25 },
          { id: "med-d-s2", name: "Diabenorm 500 Tablet", manufacturer: "HealWell Pharmaceuticals", packSize: "Strip of 10 tablets", mrp: 70, price: 59, discountPct: 16 },
        ],
      },
    ],
  },

  // Delivery speed options available at checkout.
  delivery: {
    expressCost: 49,
    standardEtaText: "Arrives tomorrow by 8:00 PM",
    expressEtaText: "Arrives today, within 3 hours",
  },

  // Recovery options surfaced per exception type (system surfaces options;
  // it never makes the clinical call for prescription medicines)
  recoveryOptions: {
    unavailable: [
      { id: "notify", label: "Notify me when available", description: "We'll alert you the moment this medicine is back in stock near you." },
      { id: "remove", label: "Remove from this order", description: "Skip this medicine for now. You can add it to a future order." },
      { id: "support", label: "Contact pharmacist / support", description: "Talk to someone about alternatives or urgent needs." },
    ],
    verification: [
      { id: "upload", label: "Upload prescription", description: "Upload a valid, current prescription for this medicine." },
      { id: "help", label: "Request help", description: "Get help from our pharmacist team to resolve this." },
    ],
  },

  // Order Trust Timeline — demonstrates proactive, specific status over vague "delayed"
  trustTimeline: {
    orderId: "ORD-1051",
    steps: [
      { key: "placed", label: "Order placed", time: "6:05 PM", state: "done" },
      { key: "prescription_received", label: "Prescription received", time: "6:08 PM", state: "done" },
      { key: "prescription_verified", label: "Prescription verified", time: "6:15 PM", state: "done" },
      { key: "fulfilment_assigned", label: "Fulfilment assigned", time: "6:20 PM", state: "done" },
      { key: "packed", label: "Medicines packed", time: "6:40 PM", state: "done" },
      { key: "dispatched", label: "Dispatched", time: "6:55 PM", state: "current" },
      { key: "out_for_delivery", label: "Out for delivery", time: "ETA 7:30 PM", state: "pending" },
    ],
    delay: {
      hasDelay: true,
      reasonTitle: "Why is my order delayed?",
      reasonBody: "One medicine was unavailable at the original fulfilment location. We reassigned the order to another fulfilment location.",
      updatedEta: "7:30 PM",
      lastUpdated: "6:42 PM",
    },
  },

  // ---------------- Search / Catalog ----------------
  // Fictional medicines only. Each carries optional generic/branded
  // substitutes with their own price + discount, mirroring the
  // "substitute with savings" pattern real pharmacy apps use.
  categories: ["All", "Pain Relief", "Diabetes Care", "Vitamins & Supplements", "Skin Care", "Cold & Immunity"],

  // Mock recent-search history shown on the Search tab before the
  // customer types anything, instead of a live keyword-search backend.
  defaultSearchHistory: ["Vitamin C tablets", "Pain relief gel", "Cold tablets", "Diabetes care"],

  // Manufacturer trust directory — fictional manufacturer names only.
  // Surfaced on the product/substitute cards to reinforce trust when
  // a customer is comparing brands, not just comparing price.
  manufacturers: {
    "Nova Pharma": { rating: 4.6, badge: "Verified Manufacturer" },
    "Curewell Biotech": { rating: 4.4, badge: "Verified Manufacturer" },
    "Vitawell Labs": { rating: 4.3, badge: "Verified Manufacturer" },
    "HealWell Pharmaceuticals": { rating: 4.5, badge: "Verified Manufacturer" },
  },

  catalog: [
    {
      id: "cat-1",
      name: "Calmodol 650mg Tablet",
      manufacturer: "Nova Pharma",
      packSize: "Strip of 15 tablets",
      category: "Pain Relief",
      constituent: "Paracetamol 650mg",
      mrp: 45,
      price: 36,
      discountPct: 20,
      rating: 4.3,
      reviews: "2.1k",
      prescriptionRequired: false,
      substitutes: [
        { id: "cat-1-s1", name: "Painex 650 Tablet", manufacturer: "Curewell Biotech", packSize: "Strip of 15 tablets", mrp: 42, price: 30, discountPct: 29 },
        { id: "cat-1-s2", name: "Feverkind 650 Tablet", manufacturer: "Vitawell Labs", packSize: "Strip of 10 tablets", mrp: 30, price: 24, discountPct: 20 },
      ],
    },
    {
      id: "cat-2",
      name: "Flexonorm 400mg Tablet",
      manufacturer: "HealWell Pharmaceuticals",
      packSize: "Strip of 10 tablets",
      category: "Pain Relief",
      constituent: "Aceclofenac 100mg + Paracetamol 325mg",
      mrp: 85,
      price: 68,
      discountPct: 20,
      rating: 4.1,
      reviews: "980",
      prescriptionRequired: true,
      substitutes: [
        { id: "cat-2-s1", name: "Inflanorm 400 Tablet", manufacturer: "Nova Pharma", packSize: "Strip of 10 tablets", mrp: 78, price: 55, discountPct: 29 },
        { id: "cat-2-s2", name: "Jointease 400 Tablet", manufacturer: "Curewell Biotech", packSize: "Strip of 15 tablets", mrp: 110, price: 92, discountPct: 16 },
      ],
    },
    {
      id: "cat-3",
      name: "Glucofit 500mg Tablet",
      manufacturer: "Vitawell Labs",
      packSize: "Strip of 15 tablets",
      category: "Diabetes Care",
      constituent: "Metformin 500mg",
      mrp: 95,
      price: 79,
      discountPct: 17,
      rating: 4.5,
      reviews: "3.4k",
      prescriptionRequired: true,
      substitutes: [
        { id: "cat-3-s1", name: "Sugarmet 500 Tablet", manufacturer: "Nova Pharma", packSize: "Strip of 15 tablets", mrp: 88, price: 66, discountPct: 25 },
        { id: "cat-3-s2", name: "Diabenorm 500 Tablet", manufacturer: "HealWell Pharmaceuticals", packSize: "Strip of 10 tablets", mrp: 70, price: 59, discountPct: 16 },
      ],
    },
    {
      id: "cat-4",
      name: "Vitazen C 1000mg Effervescent",
      manufacturer: "Curewell Biotech",
      packSize: "Tube of 15 tablets",
      category: "Vitamins & Supplements",
      constituent: "Ascorbic Acid (Vitamin C) 1000mg",
      mrp: 199,
      price: 149,
      discountPct: 25,
      rating: 4.6,
      reviews: "5.2k",
      prescriptionRequired: false,
      substitutes: [
        { id: "cat-4-s1", name: "CeeBoost 1000 Effervescent", manufacturer: "Vitawell Labs", packSize: "Tube of 20 tablets", mrp: 220, price: 165, discountPct: 25 },
        { id: "cat-4-s2", name: "ImmunoC Tablets", manufacturer: "Nova Pharma", packSize: "Bottle of 30", mrp: 180, price: 144, discountPct: 20 },
      ],
    },
    {
      id: "cat-5",
      name: "Dermacare Gel 30g",
      manufacturer: "Nova Pharma",
      packSize: "Tube of 30g",
      category: "Skin Care",
      constituent: "Clotrimazole 1% w/w",
      mrp: 120,
      price: 102,
      discountPct: 15,
      rating: 4.0,
      reviews: "640",
      prescriptionRequired: false,
      substitutes: [
        { id: "cat-5-s1", name: "SkinEase Gel 30g", manufacturer: "HealWell Pharmaceuticals", packSize: "Tube of 30g", mrp: 110, price: 88, discountPct: 20 },
        { id: "cat-5-s2", name: "ClearDerm Cream 20g", manufacturer: "Curewell Biotech", packSize: "Tube of 20g", mrp: 95, price: 76, discountPct: 20 },
      ],
    },
    {
      id: "cat-6",
      name: "ColdEase Plus Tablet",
      manufacturer: "Vitawell Labs",
      packSize: "Strip of 10 tablets",
      category: "Cold & Immunity",
      constituent: "Cetirizine 5mg + Phenylephrine 10mg",
      mrp: 55,
      price: 44,
      discountPct: 20,
      rating: 4.2,
      reviews: "1.8k",
      prescriptionRequired: false,
      inStock: false,
      stockReason: "Out of stock at your nearby fulfilment center.",
      substitutes: [
        { id: "cat-6-s1", name: "FluGuard Tablet", manufacturer: "Nova Pharma", packSize: "Strip of 10 tablets", mrp: 50, price: 38, discountPct: 24 },
        { id: "cat-6-s2", name: "ColdRelief Capsules", manufacturer: "HealWell Pharmaceuticals", packSize: "Strip of 15 tablets", mrp: 65, price: 52, discountPct: 20 },
      ],
    },
    {
      id: "cat-7",
      name: "ImmunoBoost Tablets",
      manufacturer: "HealWell Pharmaceuticals",
      packSize: "Bottle of 60",
      category: "Vitamins & Supplements",
      constituent: "Multivitamin + Zinc",
      mrp: 450,
      price: 360,
      discountPct: 20,
      rating: 4.4,
      reviews: "2.9k",
      prescriptionRequired: false,
      substitutes: [
        { id: "cat-7-s1", name: "VitaShield Capsules", manufacturer: "Curewell Biotech", packSize: "Bottle of 60", mrp: 420, price: 315, discountPct: 25 },
        { id: "cat-7-s2", name: "WellnessMax Tablets", manufacturer: "Nova Pharma", packSize: "Bottle of 90", mrp: 520, price: 416, discountPct: 20 },
      ],
    },
    {
      id: "cat-8",
      name: "PainAway Gel 50g",
      manufacturer: "Curewell Biotech",
      packSize: "Tube of 50g",
      category: "Pain Relief",
      constituent: "Diclofenac Diethylamine 1.16% w/w",
      mrp: 130,
      price: 104,
      discountPct: 20,
      rating: 4.1,
      reviews: "1.1k",
      prescriptionRequired: false,
      substitutes: [
        { id: "cat-8-s1", name: "ReliefTouch Gel 50g", manufacturer: "Vitawell Labs", packSize: "Tube of 50g", mrp: 125, price: 94, discountPct: 25 },
        { id: "cat-8-s2", name: "MoveEase Spray 100ml", manufacturer: "Nova Pharma", packSize: "Bottle of 100ml", mrp: 160, price: 128, discountPct: 20 },
      ],
    },
  ],

  // Operations Console — exception workflow queue
  opsWorkflows: [
    {
      id: "wf-1",
      customer: "Tushar Mehta",
      order: "#1021",
      issue: "Medicine unavailable",
      status: "Recovery",
      activity: [
        { label: "Customer identified", state: "done" },
        { label: "Previous order retrieved", state: "done" },
        { label: "Inventory checked", state: "done" },
        { label: "Prescription status checked", state: "done" },
        { label: "Medicine unavailable", state: "warning" },
        { label: "Recovery workflow created", state: "done" },
        { label: "Awaiting customer decision", state: "pending" },
      ],
    },
    {
      id: "wf-2",
      customer: "Ananya Rao",
      order: "#1022",
      issue: "Prescription verification",
      status: "Pending",
      activity: [
        { label: "Customer identified", state: "done" },
        { label: "Previous order retrieved", state: "done" },
        { label: "Inventory checked", state: "done" },
        { label: "Prescription status checked", state: "warning" },
        { label: "Verification request sent", state: "done" },
        { label: "Awaiting customer upload", state: "pending" },
      ],
    },
    {
      id: "wf-3",
      customer: "Karan Shah",
      order: "#1023",
      issue: "Delivery delayed",
      status: "Escalated",
      activity: [
        { label: "Customer identified", state: "done" },
        { label: "Fulfilment location reassigned", state: "done" },
        { label: "Updated ETA communicated", state: "done" },
        { label: "Customer contacted support", state: "warning" },
        { label: "Escalated to human operator", state: "done" },
        { label: "Awaiting resolution", state: "pending" },
      ],
    },
  ],
};
