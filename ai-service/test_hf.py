import os
from dotenv import load_dotenv
load_dotenv('.env')
from services.hf_inference_service import HFInferenceService

def test_hf():
    print(f"Testing HF with token: {os.getenv('HF_API_TOKEN')[:10]}...")
    hf = HFInferenceService()
    print(f"Models: {hf.models}")
    
    prompt = "Say hello to a child in one sentence."
    messages = [{"role": "user", "content": prompt}]
    
    try:
        response = hf.client.chat_completion(
            messages=messages,
            model=hf.models["structural_analysis"],
            max_tokens=100
        )
        print(f"✅ Success: {response.choices[0].message.content}")
    except Exception as e:
        print(f"❌ Failed: {e}")

if __name__ == "__main__":
    test_hf()
