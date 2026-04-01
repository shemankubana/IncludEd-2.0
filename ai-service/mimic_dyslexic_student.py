import time
import random
import sys
import requests
import json

# Colors for console output
class Colors:
    BLUE = '\033[94m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    BOLD = '\033[1m'
    CYAN = '\033[96m'
    END = '\033[0m'

API_URL = "http://localhost:8082/rl/predict"

def clear_screen():
    sys.stdout.write("\033[H\033[J")

def print_header():
    print("\n" + "="*60)
    print(f"{Colors.BOLD}{Colors.CYAN}IncludEd RL Mimic Bot: Dyslexic Student Profile{Colors.END}")
    print(f"Simulating real-time PPO suggested actions based on student behavior.")
    print("="*60 + "\n")

def get_state_bar(label, value, color=Colors.BLUE):
    width = 20
    filled = int(value * width)
    bar = "█" * filled + "░" * (width - filled)
    return f"{label:<18} [{color}{bar}{Colors.END}] {value:.2f}"

def main():
    print(f"{Colors.YELLOW}Connecting to IncludEd AI Service at {API_URL}...{Colors.END}")
    
    # Check if server is up
    try:
        res = requests.get("http://localhost:8082/")
        if res.status_code == 200:
            print(f"{Colors.GREEN}✅ AI Service is online.{Colors.END}")
        else:
            print(f"{Colors.RED}❌ AI Service returned status {res.status_code}.{Colors.END}")
            sys.exit(1)
    except Exception as e:
        print(f"{Colors.RED}❌ Could not connect to AI Service: {e}{Colors.END}")
        print("Please ensure 'python main.py' is running on port 8082.")
        sys.exit(1)

    print_header()

    # Simulation Parameters for a Dyslexic Student
    student_state = {
        "reading_speed": 0.4,       # Start slow
        "mouse_dwell": 0.7,         # High dwell on words
        "scroll_hesitation": 0.5,   # Some hesitation
        "backtrack_freq": 0.8,      # High re-reading freq
        "attention_score": 0.9,     # Good focus but struggling
        "disability_type": 0.5,     # Dyslexia
        "text_difficulty": 0.6,     # Medium-High difficulty
        "session_fatigue": 0.0      # Increases over time
    }

    steps = 20
    try:
        for i in range(steps):
            # Fluctuating state to mimic real behavior
            student_state["reading_speed"] = max(0.1, min(0.6, student_state["reading_speed"] + random.uniform(-0.05, 0.05)))
            student_state["mouse_dwell"] = max(0.4, min(1.0, student_state["mouse_dwell"] + random.uniform(-0.05, 0.05)))
            student_state["backtrack_freq"] = max(0.6, min(1.0, student_state["backtrack_freq"] + random.uniform(-0.03, 0.03)))
            student_state["session_fatigue"] = min(1.0, i / steps)
            
            # Simulate changing text difficulty
            if i % 8 == 0:
                student_state["text_difficulty"] = 0.9  # Difficult passage
            elif i % 4 == 0:
                student_state["text_difficulty"] = 0.7  # Medium-hard
            else:
                student_state["text_difficulty"] = 0.4 + random.uniform(-0.1, 0.1)

            # Construct state vector
            state_vector = [
                student_state["reading_speed"],
                student_state["mouse_dwell"],
                student_state["scroll_hesitation"],
                student_state["backtrack_freq"],
                student_state["attention_score"],
                student_state["disability_type"],
                student_state["text_difficulty"],
                student_state["session_fatigue"]
            ]

            # Call RL /predict endpoint
            payload = {
                "state_vector": state_vector,
                "content_type": 0.5  # Novel
            }
            
            response = requests.post(API_URL, json=payload)
            if response.status_code == 200:
                data = response.json()
                action_id = data["action_id"]
                action_label = data["action_label"]
                is_fallback = data.get("fallback", False)
            else:
                action_label = f"Error {response.status_code}"
                action_id = -1
                is_fallback = True

            # Map action to a color for visibility
            action_color = Colors.GREEN
            if action_id == 2: action_color = Colors.RED    # Heavy Simplification
            if action_id == 3: action_color = Colors.YELLOW # TTS
            if action_id == 4: action_color = Colors.CYAN   # Syllable Break
            if action_id == 5: action_color = Colors.RED    # Break

            # Display real-time status
            clear_screen()
            print_header()
            print(f"{Colors.BOLD}Step {i+1}/{steps} | Mode: {'Rule-based Fallback' if is_fallback else 'PPO Model ACTIVE'}{Colors.END}")
            print("-" * 30)
            print(get_state_bar("Reading Speed", student_state["reading_speed"], Colors.BLUE))
            print(get_state_bar("Mouse Dwell", student_state["mouse_dwell"], Colors.YELLOW))
            print(get_state_bar("Backtracks", student_state["backtrack_freq"], Colors.RED))
            print(get_state_bar("Text Difficulty", student_state["text_difficulty"], Colors.CYAN))
            print(get_state_bar("Session Fatigue", student_state["session_fatigue"], Colors.RED))
            print("-" * 30)
            
            print(f"\n{Colors.BOLD}PPO SUGGESTED ACTION:{Colors.END}")
            print(f"{Colors.BOLD}{action_color}>>> {action_label} <<<{Colors.END}")
            print("\n" + "="*30)
            
            time.sleep(1.2)

        print(f"\n{Colors.GREEN}Simulation completed successfully.{Colors.END}")

    except KeyboardInterrupt:
        print(f"\n{Colors.YELLOW}Simulation stopped by user.{Colors.END}")
    except Exception as e:
        print(f"\n{Colors.RED}Simulation error: {e}{Colors.END}")

if __name__ == "__main__":
    main()
