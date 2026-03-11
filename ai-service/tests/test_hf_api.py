import os
import sys
from dotenv import load_dotenv

# Add parent dir to path so we can import services
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from services.hf_inference_service import HFInferenceService

def test_hf_connectivity():
    # Load env from root
    root_env = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../.env'))
    local_env = os.path.abspath(os.path.join(os.path.dirname(__file__), '../.env'))
    
    load_dotenv(root_env)
    load_dotenv(local_env)
    
    token = os.getenv("HF_API_TOKEN")
    use_hf = os.getenv("USE_HF_INFERENCE")
    
    print(f"🔍 Checking Configuration...")
    print(f"   HF_API_TOKEN: {'✅ Present' if token else '❌ Missing'}")
    print(f"   USE_HF_INFERENCE: {use_hf}")
    
    if not token:
        print("\n❌ Error: HF_API_TOKEN not found in environment. Please check your .env file.")
        return

    svc = HFInferenceService(token)
    
    print("\n🚀 Testing Model Connection (Heading Detection)...")
    is_head = svc.is_heading("Chapter 1: The Beginning")
    if is_head:
        print("   ✅ Success! Model correctly identified the heading.")
    else:
        print("   ⚠️  API call succeeded but model returned NO (or failed). Check console logs.")

    print("\n🚀 Testing Character Extraction (NER)...")
    text = "Okonkwo was a well-known man across the nine villages. Unoka was his father."
    characters = svc.extract_characters(text)
    if characters:
        print(f"   ✅ Success! Found characters: {', '.join(characters)}")
    else:
        print("   ❌ Failed to extract characters. Check connectivity.")

    print("\n🚀 Testing Quiz Generation...")
    quiz = svc.generate_quiz("The cat sat on the mat. It was a sunlit afternoon.", num_questions=1)
    if quiz and len(quiz) > 0:
        print(f"   ✅ Success! Generated question: {quiz[0].get('question')}")
    else:
        print("   ❌ Failed to generate quiz. Check Mistral-7B response.")

    # --- Character QA ---
    print("\n🚀 Testing Character Q&A...")
    try:
        context = "Okonkwo was a famous wrestler who defeated the Cat in a great match."
        question = "Who is Okonkwo?"
        result = svc.answer_question(
            question=question,
            context=context
        )
        if result and result.get("answer"):
            print(f"   ✅ Success! Answer: {result['answer']}")
        else:
            print("   ⚠️  Failed: No answer returned.")
    except Exception as e:
        print(f"   ❌ Failed: {e}")

    print("\n🏁 Test Completed.")

if __name__ == "__main__":
    test_hf_connectivity()
