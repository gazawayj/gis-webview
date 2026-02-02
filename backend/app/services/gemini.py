import google.genai as genai  # correct import for google-genai 1.61.0
import os

GENIE_KEY = os.environ.get("GEMINI_API_KEY")
genai.configure(api_key=GENIE_KEY)

def ai_search(query: str):
    """Call Gemini to perform an AI search."""
    response = genai.responses.create(
        model="models/text-bison-001",
        input=query
    )
    # Extract text output
    return response.output[0].content[0].text
