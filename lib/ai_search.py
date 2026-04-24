#!/usr/bin/env python3
"""
AI search helper — converts natural-language Arabic/English queries into
structured filters for product search.

Usage (called from Next.js via child_process):
    echo '{"query":"هدية لأبي بميزانية 20 ريال"}' | python3 ai_search.py

Outputs JSON to stdout:
    {"filters": {"category": "OTHER", "tags": ["gift"], "maxPrice": 20, ...},
     "interpretation_ar": "بحثت لك عن هدية ضمن ميزانية 20 ر.ع"}

Requires env: EMERGENT_LLM_KEY
"""
import sys
import os
import json
import asyncio
import uuid


VALID_CATEGORIES = [
    "FOOD", "FASHION", "ELECTRONICS", "OFFICE",
    "HANDICRAFT", "DIGITAL", "OTHER",
]


def fail(reason: str, code: int = 1):
    print(json.dumps({"error": reason}, ensure_ascii=False))
    sys.exit(code)


async def run_async(query: str):
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
    except Exception as e:
        fail(f"missing emergentintegrations: {e}")

    api_key = os.environ.get("EMERGENT_LLM_KEY", "")
    if not api_key:
        fail("EMERGENT_LLM_KEY not set")

    system_msg = (
        "أنت محرك بحث ذكي لمتجر إلكتروني عماني (مجلس رواد الأعمال العماني).\n"
        "مهمتك: قراءة استعلام المستخدم باللغة العربية أو الإنجليزية واستخراج فلاتر بحث منظّمة.\n"
        "أرجع JSON فقط بالشكل التالي بدون أي نص إضافي:\n"
        "{\n"
        '  "category": "FOOD" | "FASHION" | "ELECTRONICS" | "OFFICE" | "HANDICRAFT" | "DIGITAL" | "OTHER" | "",\n'
        '  "tags": ["..."] (حتى 5 وسوم بالعربي أو الإنجليزي بدون #),\n'
        '  "minPrice": رقم أو null,\n'
        '  "maxPrice": رقم أو null,\n'
        '  "minRating": 0|3|4 (افتراضي 0),\n'
        '  "search": "نص بحث حر مختصر (يفضل عربي)",\n'
        '  "interpretation_ar": "جملة قصيرة تشرح ما فهمته (للعرض للمستخدم)"\n'
        "}\n\n"
        "أمثلة على الفئات: عسل/تمر/قهوة → FOOD، دشداشة/عبايا → FASHION، ساعة ذكية/سماعات → ELECTRONICS، فضة/فخار/سدو/لبان → HANDICRAFT.\n"
        "إذا ذكر المستخدم 'هدية' أضف 'gift' في tags. إذا قال 'عضوي' أضف 'organic' أو 'عضوي'.\n"
        "الميزانية: 'بـ 20 ر.ع' أو 'تحت 50 ريال' = maxPrice. 'فوق 100' = minPrice.\n"
        "إذا الاستعلام عام جداً، اترك الحقول فارغة وأرجع interpretation_ar مناسب."
    )

    chat = LlmChat(
        api_key=api_key,
        session_id=f"ai-search-{uuid.uuid4().hex[:8]}",
        system_message=system_msg,
    ).with_model("anthropic", "claude-sonnet-4-20250514")

    user_msg = UserMessage(text=query)
    try:
        resp = await chat.send_message(user_msg)
    except Exception as e:
        fail(f"llm call failed: {e}")

    text = (resp or "").strip()
    # Strip code fences if present
    if text.startswith("```"):
        # extract content between first and last ```
        lines = text.split("\n")
        # remove first ``` line and last ``` line
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        text = "\n".join(lines).strip()

    try:
        parsed = json.loads(text)
    except Exception as e:
        # Attempt to find JSON within text
        import re
        m = re.search(r"\{.*\}", text, re.S)
        if m:
            try:
                parsed = json.loads(m.group(0))
            except Exception:
                fail(f"llm returned non-json: {text[:200]}")
        else:
            fail(f"llm returned non-json: {text[:200]}")

    # Sanitize / coerce fields
    out = {
        "category": "",
        "tags": [],
        "minPrice": None,
        "maxPrice": None,
        "minRating": 0,
        "search": "",
        "interpretation_ar": "",
    }
    cat = str(parsed.get("category") or "").strip().upper()
    if cat in VALID_CATEGORIES:
        out["category"] = cat
    raw_tags = parsed.get("tags") or []
    if isinstance(raw_tags, list):
        out["tags"] = [
            str(t).strip().replace("#", "").lower().replace(" ", "-")[:30]
            for t in raw_tags[:5]
            if str(t).strip()
        ]
    for k in ("minPrice", "maxPrice"):
        v = parsed.get(k)
        if isinstance(v, (int, float)) and v >= 0:
            out[k] = float(v)
    mr = parsed.get("minRating")
    if mr in (3, 4, 0):
        out["minRating"] = int(mr)
    s = parsed.get("search")
    if isinstance(s, str):
        out["search"] = s.strip()[:100]
    interp = parsed.get("interpretation_ar")
    if isinstance(interp, str):
        out["interpretation_ar"] = interp.strip()[:300]

    print(json.dumps({"filters": out, "raw_query": query}, ensure_ascii=False))


def main():
    raw = sys.stdin.read().strip()
    if not raw:
        fail("no input")
    try:
        data = json.loads(raw)
    except Exception:
        fail("invalid input json")
    query = str(data.get("query") or "").strip()
    if not query:
        fail("empty query")
    if len(query) > 200:
        query = query[:200]
    asyncio.run(run_async(query))


if __name__ == "__main__":
    main()
