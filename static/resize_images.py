import os
import base64
import mimetypes
import google.generativeai as genai
from PIL import Image

# -------------------------------
# CONFIG
# -------------------------------
IMAGE_FOLDER = "/Users/azeemsikander/HPI-Job/NoHarm/static/resized_images"
OUTPUT_FOLDER = os.path.join(IMAGE_FOLDER, "renamed_images")
os.makedirs(OUTPUT_FOLDER, exist_ok=True)

genai.configure(api_key="AIzaSyD40ry7GlhLDEyM_LoC0KQS8shBk-MHfDQ")

DEFAULT_MODEL = "models/gemini-2.5-flash"
PREFERRED_MODEL = os.getenv("GENAI_MODEL", DEFAULT_MODEL)


def pick_model():
    try:
        return genai.GenerativeModel(PREFERRED_MODEL)
    except Exception as e:
        print(f"Preferred model '{PREFERRED_MODEL}' not available: {e}")
        print("Trying first available generateContent model from your account...")
        available = [
            m.name
            for m in genai.list_models()
            if "generateContent" in getattr(m, "supported_generation_methods", [])
        ]
        if not available:
            print("No models with generateContent available for this API key.")
            raise SystemExit(1)
        fallback = available[0]
        print(f"Falling back to: {fallback}")
        return genai.GenerativeModel(fallback)


model = pick_model()

# -------------------------------
# Helper: Load image as bytes
# -------------------------------
def load_image_bytes(path):
    with open(path, "rb") as f:
        return f.read()


def guess_mime(path):
    mime, _ = mimetypes.guess_type(path)
    return mime or "image/png"

# -------------------------------
# MAIN LOOP
# -------------------------------
prompt = """
You will receive a medical pictogram image.
Return a clean filename in snake_case describing:
- patient type (boy/girl/man/woman/pregnant/etc.)
- posture (standing, lying, sitting)
- condition/symptom (pain, injection, arm sling, pregnancy, collapsed)
- pill/syringe count if visible

Return ONLY the filename (no extension).
"""

for file in os.listdir(IMAGE_FOLDER):
    if not file.lower().endswith((".png", ".jpg", ".jpeg")):
        continue

    img_path = os.path.join(IMAGE_FOLDER, file)
    img_bytes = load_image_bytes(img_path)
    mime_type = guess_mime(img_path)

    print(f"Processing: {file}")

    try:
        response = model.generate_content(
            [
                prompt,
                {"mime_type": mime_type, "data": img_bytes},
            ]
        )
        new_name = response.text.strip().lower().replace(" ", "_")
        new_filename = new_name + ".png"

        # Final target location
        output_path = os.path.join(OUTPUT_FOLDER, new_filename)

        # Save the PNG (copy original as-is)
        with open(img_path, "rb") as src, open(output_path, "wb") as dst:
            dst.write(src.read())

        print(f"Saved as → {new_filename}")

    except Exception as e:
        print(f"Error with {file}: {e}")
