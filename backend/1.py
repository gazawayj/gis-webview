import os
import requests
from google import genai

def verify_gemini_api_key(api_key):
    """
    Verifies if a Gemini API key is valid by attempting to list models.
    """
    if not api_key:
        return "API key not found in environment variables.", False

    try:
        # Configure genai with the API key
        genai.configure(api_key=api_key)
        # Attempt to list models, a basic operation that requires authentication
        models = genai.list_models()
        print("API key is valid and has access to the following models:")
        for model in models:
            print(f"- {model.name}")
        return "Key validation successful.", True
    except Exception as e:
        # Catch potential authentication errors or other API issues
        error_message = str(e)
        if "API key not valid" in error_message or "UNAUTHENTICATED" in error_message:
            return f"API key validation failed: Invalid or unauthorized key.", False
        else:
            return f"An error occurred: {error_message}", False

if __name__ == "__main__":
    # Load API key from environment variable
    my_api_key = os.getenv("GEMINI_API_KEY")
    
    status_message, is_valid = verify_gemini_api_key(my_api_key)
    print(status_message)
