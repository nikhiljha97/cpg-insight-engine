"""
05_pitch_generator.py
=====================
Reads the trigger_payload.json produced by 04_weather_trigger.py and
calls a free LLM API (Groq or Google Gemini) to generate a polished
"Proactive Insight Proposal" — a CPG pitch ready to send to a brand manager.

FREE API SETUP (pick one)
--------------------------
Option A — Groq (fastest, easiest):
  1. Sign up at https://console.groq.com  (free, no credit card)
  2. Create an API key
  3. pip install groq
  4. Set env var:  export GROQ_API_KEY="your_key_here"

Option B — Google Gemini (generous free tier):
  1. Get key at https://aistudio.google.com/app/apikey
  2. pip install google-generativeai
  3. Set env var:  export GEMINI_API_KEY="your_key_here"

USAGE
-----
    python 05_pitch_generator.py

OUTPUT
------
  output/cpg_pitch_YYYYMMDD.txt  — formatted pitch document
"""

import json
import os
from datetime import datetime

PAYLOAD_PATH = "output/trigger_payload.json"
OUTPUT_DIR   = "output"


# ── Prompt builder ─────────────────────────────────────────────────────────────
def build_prompt(payload: dict) -> str:
    ctx   = payload["pitch_context"]
    trig  = payload["weather_trigger"]
    pairs = payload["top_product_pairs"]

    pairs_text = "\n".join([
        f"  • {p['anchor_product']} → {p['paired_product']} ({p['department']})  "
        f"— appears in {p['co_baskets']:,} soup baskets; "
        f"{p['pct_of_soup_baskets']}% of soup baskets also contain this item"
        for p in pairs
    ])

    prompt = f"""
You are a senior retail analytics consultant writing a proactive insight proposal
for a CPG brand manager at a major grocery retailer in Canada.

CONTEXT
-------
Location      : {payload['location']}
Generated on  : {payload['generated_at'][:10]}
Weather window: {', '.join(trig.get('window_days', []))}
Forecast      : {ctx['weather_summary']}
Avg temperature: {ctx['avg_temp_c']}°C (cold weather trigger active)

DATA INSIGHT
------------
Basket analysis for anchor category "{ctx['anchor_product']}" shows which
sub-commodities most often appear in the same shopping trip (cold/wet trigger context):

{pairs_text}

Headline: among customers who buy {ctx['anchor_product']}, about {ctx['pct_of_soup_baskets']}% of those baskets also include "{ctx['paired_product']}" (top companion by frequency).

YOUR TASK
---------
Write a concise, professional "Proactive Insight Proposal" (max 300 words) that:

1. Opens with a weather-driven hook (one punchy sentence)
2. States the data finding clearly (co-basket rates, anchor + companion products)
3. Recommends a specific promotional or placement action the brand can take
   THIS WEEK (e.g., end-cap display, digital coupon bundle, in-app push offer)
4. Quantifies the opportunity using the basket penetration percentages above
   (reasonable assumptions are fine)
5. Closes with a clear call to action (what you need from the brand manager
   to proceed — budget approval, promotional slot confirmation, etc.)

Tone: confident, data-driven, concise. Write as if sending this to a busy
brand manager who has 90 seconds to read it. No bullet points in the body —
write in short paragraphs.
"""
    return prompt.strip()


# ── LLM call — Groq ───────────────────────────────────────────────────────────
def call_groq(prompt: str) -> str:
    from groq import Groq
    client = Groq(api_key=os.environ["GROQ_API_KEY"])
    response = client.chat.completions.create(
        model    = "llama-3.3-70b-versatile",   # Free, fast, high quality
        messages = [{"role": "user", "content": prompt}],
        max_tokens = 600,
        temperature = 0.7,
    )
    return response.choices[0].message.content


# ── LLM call — Gemini ─────────────────────────────────────────────────────────
def call_gemini(prompt: str) -> str:
    import google.generativeai as genai
    genai.configure(api_key=os.environ["GEMINI_API_KEY"])
    model    = genai.GenerativeModel("gemini-1.5-flash")   # Free tier
    response = model.generate_content(prompt)
    return response.text


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    print("\n" + "="*60)
    print("  CPG Pitch Generator")
    print("="*60)

    # 1. Load trigger payload
    if not os.path.exists(PAYLOAD_PATH):
        print(f"\n  No trigger payload found at {PAYLOAD_PATH}.")
        print("  Either the weather trigger didn't fire today,")
        print("  or 04_weather_trigger.py hasn't been run yet.")
        return

    with open(PAYLOAD_PATH) as f:
        payload = json.load(f)

    print(f"\n  Trigger: {payload['weather_trigger']['trigger_type'].upper()}")
    print(f"  Location: {payload['location']}")

    # 2. Build prompt
    prompt = build_prompt(payload)

    # 3. Choose LLM provider based on available API keys
    if os.getenv("GROQ_API_KEY"):
        print("\n  Calling Groq API (llama3-70b)...")
        pitch = call_groq(prompt)
        provider = "Groq / LLaMA3-70B"
    elif os.getenv("GEMINI_API_KEY"):
        print("\n  Calling Gemini API (gemini-1.5-flash)...")
        pitch = call_gemini(prompt)
        provider = "Google Gemini 1.5 Flash"
    else:
        print("\n  ⚠  No API key found.")
        print("  Set GROQ_API_KEY or GEMINI_API_KEY as environment variables.")
        print("\n  Prompt that would be sent:")
        print("  " + "-"*50)
        print(prompt)
        return

    # 4. Save pitch
    today = datetime.now().strftime("%Y%m%d")
    pitch_path = os.path.join(OUTPUT_DIR, f"cpg_pitch_{today}.txt")
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    with open(pitch_path, "w") as f:
        f.write(f"PROACTIVE INSIGHT PROPOSAL\n")
        f.write(f"Generated: {datetime.now().strftime('%B %d, %Y')}\n")
        f.write(f"Location: {payload['location']}\n")
        f.write(f"Model: {provider}\n")
        f.write("="*60 + "\n\n")
        f.write(pitch)

    # 5. Print to console
    print(f"\n  Provider: {provider}")
    print("\n" + "─"*60)
    print(pitch)
    print("─"*60)
    print(f"\n  Saved → {pitch_path}")
    print("\n" + "="*60)
    print("  Pipeline complete. Review pitch and send to brand manager.")
    print("="*60 + "\n")


if __name__ == "__main__":
    main()
