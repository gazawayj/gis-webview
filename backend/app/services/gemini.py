import os
import json

# Soft import OpenAI client
try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False

# API key from environment
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY")

def ai_search(query: str):
    if not OPENAI_AVAILABLE:
        return {"error": "OpenAI library not installed"}

    if not OPENROUTER_API_KEY:
        return {"error": "OPENROUTER_API_KEY not set in environment"}

    client = OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=OPENROUTER_API_KEY,
    )

    # Prompt for GIS query
    user_message = f"""
You are a GIS assistant. When a user asks for a location on Earth, Mars, or the Moon,
return ONLY a JSON object with this EXACT schema in degrees:
{{ "name": string, "lat": float, "lon": float, "planet": "earth" | "mars" | "moon" }}
If not found, return {{"error": "location not found"}}.
User query: "{query}"
"""

    messages = [{"role": "user", "content": user_message}]

    try:
        response = client.chat.completions.create(
            model="openai/gpt-oss-120b:free",
            messages=messages,
            extra_body={"reasoning": {"enabled": True}}
        )

        # Extract assistant message
        ai_output = response.choices[0].message.content.strip()

        # Attempt to parse JSON
        try:
            return json.loads(ai_output)
        except json.JSONDecodeError:
            return {"error": "failed to parse AI response", "raw": ai_output}

    except Exception as e:
        return {"error": f"API request failed ({e})"}
