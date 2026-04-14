// weatherCategories.ts
// Weather-driven category recommendations based on temperature + precipitation

export interface CategorySignal {
  category: string;
  department: string;
  triggerReason: string;
  demandUplift: number; // % vs baseline
  companions: Array<{ product: string; coRate: number }>; // co-purchase rate %
  tactics: string[]; // recommended promo tactics
  elasticity: "High" | "Medium" | "Low";
  color: string; // hex for UI
}

export interface WeatherProfile {
  label: string;
  tempRange: string;
  icon: string;
  description: string;
  categories: CategorySignal[];
}

export const WEATHER_PROFILES: WeatherProfile[] = [
  {
    label: "Freezing",
    tempRange: "< 0°C",
    icon: "❄️",
    description: "Extreme cold drives maximum comfort food demand. Consumers stock up for multiple days indoors.",
    categories: [
      {
        category: "Canned Soup",
        department: "GROCERY",
        triggerReason: "Cold weather comfort staple — 67% demand uplift at freezing temps",
        demandUplift: 67,
        companions: [{ product: "Fluid Milk", coRate: 48 }, { product: "White Bread", coRate: 26 }, { product: "Shredded Cheese", coRate: 23 }],
        tactics: ["End-cap display", "Loyalty coupon stack", "Digital app offer"],
        elasticity: "Low",
        color: "#3b82f6"
      },
      {
        category: "Hot Beverages (Coffee/Tea)",
        department: "GROCERY",
        triggerReason: "Freezing temps drive hot drink consumption — highest seasonal lift",
        demandUplift: 54,
        companions: [{ product: "Cream & Whiteners", coRate: 61 }, { product: "Sugar", coRate: 34 }, { product: "Baked Goods", coRate: 28 }],
        tactics: ["Mailer feature", "Bundle with creamer", "Front page feature"],
        elasticity: "Low",
        color: "#f59e0b"
      },
      {
        category: "Pasta & Sauce",
        department: "GROCERY",
        triggerReason: "Carbo-Loading data: pasta sauce interior page features drive 60K+ baskets",
        demandUplift: 41,
        companions: [{ product: "Pasta Sauce", coRate: 73 }, { product: "Ground Beef", coRate: 44 }, { product: "Parmesan", coRate: 31 }],
        tactics: ["Interior page feature", "Bundle pasta + sauce", "Display+mailer"],
        elasticity: "Medium",
        color: "#f97316"
      },
      {
        category: "Frozen Pizza",
        department: "FROZEN GROCERY",
        triggerReason: "Freezing temps = stay-in meals. Elasticity coef -1.1, highly price-sensitive",
        demandUplift: 38,
        companions: [{ product: "Soft Drinks", coRate: 52 }, { product: "Shredded Cheese", coRate: 34 }, { product: "Dipping Sauces", coRate: 27 }],
        tactics: ["TPR (Temporary Price Reduction)", "End-cap", "App offer"],
        elasticity: "High",
        color: "#8b5cf6"
      },
      {
        category: "Oatmeal & Hot Cereals",
        department: "GROCERY",
        triggerReason: "Breakfast at the Frat data: cold mornings spike hot breakfast category 3.2x",
        demandUplift: 49,
        companions: [{ product: "Fluid Milk", coRate: 67 }, { product: "Honey/Maple Syrup", coRate: 38 }, { product: "Fruit", coRate: 29 }],
        tactics: ["Cross-merchandising with milk", "Breakfast aisle end-cap", "Loyalty points multiplier"],
        elasticity: "Low",
        color: "#10b981"
      }
    ]
  },
  {
    label: "Very Cold",
    tempRange: "0–5°C",
    icon: "🥶",
    description: "Very cold conditions sustain high comfort food demand. Multi-day stocking behaviour observed.",
    categories: [
      {
        category: "Canned Soup",
        department: "GROCERY",
        triggerReason: "51% demand uplift in 0-5°C band vs summer baseline",
        demandUplift: 51,
        companions: [{ product: "Fluid Milk", coRate: 48 }, { product: "Wheat Bread", coRate: 22 }, { product: "Crackers", coRate: 19 }],
        tactics: ["Loyalty coupon stack", "Aisle interrupt", "Digital offer"],
        elasticity: "Low",
        color: "#3b82f6"
      },
      {
        category: "Pasta & Sauce",
        department: "GROCERY",
        triggerReason: "Carbo-Loading: Front Page Feature + Rear End Cap = 10K baskets, $18.8K revenue",
        demandUplift: 36,
        companions: [{ product: "Pasta Sauce", coRate: 73 }, { product: "Ground Beef", coRate: 44 }, { product: "Parmesan", coRate: 31 }],
        tactics: ["Front page feature", "Rear end cap", "Bundle"],
        elasticity: "Medium",
        color: "#f97316"
      },
      {
        category: "Cold Cereal",
        department: "GROCERY",
        triggerReason: "MAINSTREAM stores: 30%+ discount drives 103 units/wk vs 26 at baseline — 4x lift",
        demandUplift: 29,
        companions: [{ product: "Fluid Milk", coRate: 71 }, { product: "Orange Juice", coRate: 33 }, { product: "Bananas", coRate: 28 }],
        tactics: ["Display + mailer (4.57x lift)", "Deep discount (30%+)", "Loyalty"],
        elasticity: "High",
        color: "#22d3ee"
      },
      {
        category: "Hot Beverages",
        department: "GROCERY",
        triggerReason: "Cold mornings drive consistent hot drink purchasing — low elasticity means stable margin",
        demandUplift: 44,
        companions: [{ product: "Cream & Whiteners", coRate: 61 }, { product: "Baked Goods", coRate: 28 }],
        tactics: ["Bundle with baked goods", "Mailer feature"],
        elasticity: "Low",
        color: "#f59e0b"
      }
    ]
  },
  {
    label: "Cold",
    tempRange: "5–10°C",
    icon: "🧣",
    description: "Cold shoulder-season conditions. Wet days amplify demand — optimal promotional window.",
    categories: [
      {
        category: "Canned Soup",
        department: "GROCERY",
        triggerReason: "34% demand uplift in 5-10°C band — primary trigger zone for this engine",
        demandUplift: 34,
        companions: [{ product: "Fluid Milk", coRate: 48 }, { product: "White Bread", coRate: 26 }, { product: "Potato Chips", coRate: 14 }],
        tactics: ["End-cap display", "App offer", "Loyalty coupon"],
        elasticity: "Low",
        color: "#3b82f6"
      },
      {
        category: "Bag Snacks",
        department: "GROCERY",
        triggerReason: "Highest elasticity: -1.34 in VALUE stores. 5-15% discount drives disproportionate volume",
        demandUplift: 22,
        companions: [{ product: "Soft Drinks", coRate: 44 }, { product: "Dips/Salsa", coRate: 31 }, { product: "Cheese", coRate: 22 }],
        tactics: ["TPR 5-15% off", "Multi-pack bundle", "Display"],
        elasticity: "High",
        color: "#ef4444"
      },
      {
        category: "Frozen Pizza",
        department: "FROZEN GROCERY",
        triggerReason: "Value stores: -1.1 elasticity. Weekend stay-in behaviour peaks in cold shoulder season",
        demandUplift: 26,
        companions: [{ product: "Soft Drinks", coRate: 52 }, { product: "Shredded Cheese", coRate: 34 }],
        tactics: ["TPR", "Weekend promotion", "End-cap"],
        elasticity: "High",
        color: "#8b5cf6"
      }
    ]
  },
  {
    label: "Cool",
    tempRange: "10–15°C",
    icon: "🌦️",
    description: "Cool weather with possible rain. Transition season — mix of comfort and fresh categories.",
    categories: [
      {
        category: "Canned Soup",
        department: "GROCERY",
        triggerReason: "18% uplift — still meaningful but declining. Focus on wet days as amplifier",
        demandUplift: 18,
        companions: [{ product: "Fluid Milk", coRate: 48 }, { product: "Crackers", coRate: 19 }],
        tactics: ["Digital offer", "Loyalty points"],
        elasticity: "Low",
        color: "#3b82f6"
      },
      {
        category: "Pasta & Sauce",
        department: "GROCERY",
        triggerReason: "Carbo-Loading data: interior page features consistently outperform at this temp band",
        demandUplift: 21,
        companions: [{ product: "Pasta Sauce", coRate: 73 }, { product: "Ground Beef", coRate: 44 }],
        tactics: ["Interior page feature", "Bundle"],
        elasticity: "Medium",
        color: "#f97316"
      },
      {
        category: "Cold Cereal",
        department: "GROCERY",
        triggerReason: "Breakfast at the Frat: 156-week data shows cool weather sustains cereal lift in mainstream stores",
        demandUplift: 15,
        companions: [{ product: "Fluid Milk", coRate: 71 }, { product: "Orange Juice", coRate: 33 }],
        tactics: ["Display + mailer", "Mainstream store priority"],
        elasticity: "High",
        color: "#22d3ee"
      }
    ]
  },
  {
    label: "Mild",
    tempRange: "15–20°C",
    icon: "⛅",
    description: "Baseline conditions. No weather-driven lift expected. Focus on loyalty and everyday value.",
    categories: [
      {
        category: "Fresh Produce",
        department: "PRODUCE",
        triggerReason: "Mild weather increases fresh buying intent — baseline demand, quality positioning",
        demandUplift: 8,
        companions: [{ product: "Salad Dressing", coRate: 42 }, { product: "Proteins", coRate: 35 }],
        tactics: ["Fresh produce end-cap", "Seasonal display"],
        elasticity: "Medium",
        color: "#22c55e"
      },
      {
        category: "Bag Snacks",
        department: "GROCERY",
        triggerReason: "Everyday snacking baseline — use elasticity (VALUE stores -1.34) for value promotions",
        demandUplift: 0,
        companions: [{ product: "Soft Drinks", coRate: 44 }, { product: "Dips", coRate: 31 }],
        tactics: ["Everyday low price", "Multi-pack"],
        elasticity: "High",
        color: "#ef4444"
      }
    ]
  },
  {
    label: "Warm",
    tempRange: "20–25°C",
    icon: "☀️",
    description: "Warm conditions drive fresh, cold, and outdoor categories. Flip to summer promotions.",
    categories: [
      {
        category: "Soft Drinks & Beverages",
        department: "GROCERY",
        triggerReason: "Warm weather drives beverage purchasing — basket companion in 20% of all transactions",
        demandUplift: 28,
        companions: [{ product: "Chips/Snacks", coRate: 44 }, { product: "Ice Cream", coRate: 31 }, { product: "Condiments", coRate: 22 }],
        tactics: ["Cold vault end-cap", "Bundle with snacks", "Multi-pack TPR"],
        elasticity: "High",
        color: "#06b6d4"
      },
      {
        category: "Ice Cream & Frozen Treats",
        department: "FROZEN GROCERY",
        triggerReason: "Warm temps drive impulse frozen treat purchases — high adjacency with beverages",
        demandUplift: 35,
        companions: [{ product: "Soft Drinks", coRate: 38 }, { product: "Cones/Toppings", coRate: 51 }],
        tactics: ["Freezer end-cap", "Digital coupon", "Loyalty multiplier"],
        elasticity: "High",
        color: "#f472b6"
      },
      {
        category: "BBQ & Grilling Meats",
        department: "MEAT",
        triggerReason: "Weekend warm weather = BBQ season trigger. Premium Beef + Hot Dog Buns lift 14.6x",
        demandUplift: 42,
        companions: [{ product: "Hot Dog Buns", coRate: 58 }, { product: "Condiments", coRate: 47 }, { product: "Corn", coRate: 34 }],
        tactics: ["Feature + display", "Weekend promo", "Bundle with buns"],
        elasticity: "Medium",
        color: "#ef4444"
      },
      {
        category: "Bag Snacks",
        department: "GROCERY",
        triggerReason: "Outdoor/patio snacking peaks — VALUE tier elasticity -1.34, aggressive TPR pays off",
        demandUplift: 24,
        companions: [{ product: "Soft Drinks", coRate: 44 }, { product: "Dips/Salsa", coRate: 31 }],
        tactics: ["TPR 10-15% off", "Outdoor display", "App offer"],
        elasticity: "High",
        color: "#f97316"
      }
    ]
  },
  {
    label: "Hot",
    tempRange: "> 25°C",
    icon: "🌡️",
    description: "Heat wave conditions. Maximum summer demand. Cold categories dominate. Soup demand at -15%.",
    categories: [
      {
        category: "Soft Drinks & Beverages",
        department: "GROCERY",
        triggerReason: "Heatwave = maximum beverage demand. Bundle with snacks for basket size increase",
        demandUplift: 47,
        companions: [{ product: "Chips/Snacks", coRate: 44 }, { product: "Water", coRate: 61 }],
        tactics: ["Cold vault display", "Multi-pack TPR", "App offer"],
        elasticity: "High",
        color: "#06b6d4"
      },
      {
        category: "Ice Cream & Frozen Treats",
        department: "FROZEN GROCERY",
        triggerReason: "Peak impulse purchase season — freezer end-caps drive 50%+ basket attachment",
        demandUplift: 58,
        companions: [{ product: "Cones/Toppings", coRate: 51 }, { product: "Soft Drinks", coRate: 38 }],
        tactics: ["Freezer end-cap", "Loyalty multiplier", "Kids-targeted digital offer"],
        elasticity: "High",
        color: "#f472b6"
      },
      {
        category: "BBQ & Grilling Meats",
        department: "MEAT",
        triggerReason: "Complete Journey data: Hot Dog Buns + Premium Beef = 14.6x lift — highest in dataset",
        demandUplift: 61,
        companions: [{ product: "Hot Dog Buns", coRate: 58 }, { product: "Condiments", coRate: 47 }, { product: "Corn/Salad", coRate: 34 }],
        tactics: ["Weekend feature display", "Bundle promo", "Mailer + end-cap"],
        elasticity: "Medium",
        color: "#ef4444"
      },
      {
        category: "Fresh Produce & Salads",
        department: "PRODUCE",
        triggerReason: "Hot weather drives fresh/light meal intent — salad category peaks in heatwaves",
        demandUplift: 33,
        companions: [{ product: "Salad Dressing", coRate: 55 }, { product: "Feta/Toppings", coRate: 29 }],
        tactics: ["Fresh produce display", "Bundle with dressing", "Feature"],
        elasticity: "Medium",
        color: "#22c55e"
      }
    ]
  }
];

export function getProfileForTemp(tempC: number): WeatherProfile {
  if (tempC < 0) return WEATHER_PROFILES[0];
  if (tempC < 5) return WEATHER_PROFILES[1];
  if (tempC < 10) return WEATHER_PROFILES[2];
  if (tempC < 15) return WEATHER_PROFILES[3];
  if (tempC < 20) return WEATHER_PROFILES[4];
  if (tempC < 25) return WEATHER_PROFILES[5];
  return WEATHER_PROFILES[6];
}
