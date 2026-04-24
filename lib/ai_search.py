#!/usr/bin/env python3
"""
AI search helper — converts natural-language Arabic/English queries into
structured filters constrained to the actual catalog (categories + tags
provided by Next.js via stdin).

Input JSON (stdin):
    {
      "query": "هدية لأبي بميزانية 20 ريال",
      "categories": ["FOOD","FASHION","ELECTRONICS",...],
      "tags": ["honey","gift","silver",...]   # popular tags from DB
    }

Output JSON (stdout):
    {"filters": {...}, "raw_query": "..."}

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


async def run_async(query: str, allowed_categories, allowed_tags):
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
    except Exception as e:
        fail(f"missing emergentintegrations: {e}")

    api_key = os.environ.get("EMERGENT_LLM_KEY", "")
    if not api_key:
        fail("EMERGENT_LLM_KEY not set")

    # Build a tight system prompt using ONLY values that exist in the catalog
    cats_str = ", ".join(allowed_categories) if allowed_categories else "OTHER"
    tags_str = ", ".join(allowed_tags[:40]) if allowed_tags else "(لا يوجد)"

    system_msg = (
        "أنت محلل بحث لمتجر عماني. حوّل استعلام المستخدم إلى JSON فقط (بدون شرح).\n"
        f"الفئات المتاحة فقط: {cats_str}\n"
        f"الوسوم المتاحة فقط: {tags_str}\n"
        "اختر الفئة والوسوم من القوائم أعلاه فقط — لا تخترع قيماً جديدة. "
        "إذا لم تطابق أي قيمة، اتركها فارغة.\n"
        "أرجع JSON بهذا الشكل بالضبط:\n"
        '{"category":"<من القائمة أو فارغ>","tags":["..."],'
        '"minPrice":null|number,"maxPrice":null|number,'
        '"minRating":0|3|4,"search":"كلمات مفتاحية مختصرة",'
        '"interpretation_ar":"جملة قصيرة"}\n'
        "ميزانية: 'بـ 20' أو 'تحت 50' → maxPrice. 'فوق 100' → minPrice."
    )

    chat = LlmChat(
        api_key=api_key,
        session_id=f"ai-search-{uuid.uuid4().hex[:8]}",
        system_message=system_msg,
    ).with_model("openai", "gpt-4o-mini").with_params(max_tokens=220)

    user_msg = UserMessage(text=query)
    try:
        resp = await chat.send_message(user_msg)
    except Exception as e:
        fail(f"llm call failed: {e}")

    text = (resp or "").strip()
    # Strip code fences if present
    if text.startswith("```"):
        lines = text.split("\n")
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        text = "\n".join(lines).strip()

    try:
        parsed = json.loads(text)
    except Exception:
        import re
        m = re.search(r"\{.*\}", text, re.S)
        if m:
            try:
                parsed = json.loads(m.group(0))
            except Exception:
                fail(f"llm returned non-json: {text[:200]}")
        else:
            fail(f"llm returned non-json: {text[:200]}")

    # Sanitize / coerce + ENFORCE that returned values exist in our site data
    allowed_cat_set = set(c.upper() for c in allowed_categories) if allowed_categories else set(VALID_CATEGORIES)
    allowed_tag_set = set(t.lower() for t in allowed_tags) if allowed_tags else set()

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
    if cat in allowed_cat_set:
        out["category"] = cat

    raw_tags = parsed.get("tags") or []
    if isinstance(raw_tags, list):
        cleaned = []
        for t in raw_tags[:5]:
            tt = str(t).strip().replace("#", "").lower().replace(" ", "-")[:30]
            if not tt:
                continue
            # Only keep tags that exist in the catalog (when we have a list)
            if allowed_tag_set and tt not in allowed_tag_set:
                continue
            cleaned.append(tt)
        out["tags"] = cleaned

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

    cats = data.get("categories") or VALID_CATEGORIES
    if not isinstance(cats, list):
        cats = VALID_CATEGORIES
    tags = data.get("tags") or []
    if not isinstance(tags, list):
        tags = []

    asyncio.run(run_async(query, cats, tags))


if __name__ == "__main__":
    main()
