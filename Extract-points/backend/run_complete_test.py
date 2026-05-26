import sys
from pathlib import Path
from dotenv import load_dotenv

# Load env variables
load_dotenv()

# Add backend to path
sys.path.append(str(Path(__file__).parent))

from app.services.automation_workflow import AutomationWorkflow

job_title = "Azure Integration Lead"
job_description = """Mandatory Skills -

Experience in APIM- Azure API Management is required.
Experience in APACHE KAFKA OR CAMEL is required.
Java : Threads, Streams, Lists, Test question.
MVC :
Spring Cloud : Spring Boot
Servlets, Soap, REST

ROLE SUMMARY AND RESPONSIBILITIES
... (shortened for test) ...
"""

# The 6 tech stacks from the mandatory skills section
tech_stacks = [
    "APIM- Azure API Management",
    "APACHE KAFKA OR CAMEL",
    "Java",
    "MVC",
    "Spring Cloud",
    "Servlets, Soap, REST"
]

def run_test():
    workflow = AutomationWorkflow()
    # Generate points with 2 points per tech and 2 points per cycle
    success, result = workflow.generate_points_for_review(
        job_description=job_description,
        job_title=job_title,
        points_per_tech=2,
        recruiter_email="test@example.com",
        reviewed_tech_stacks=tech_stacks,
        points_per_cycle=2
    )
    
    print("Success:", success)
    if not success:
        print("Errors:", result.get("errors"))
        return
        
    print("\n--- RAW GENERATED TEXT FROM LLM ---")
    print(result.get("generated_text"))
    print("-----------------------------------\n")
    
    print("--- PROCESSED CYCLES ---")
    print(result.get("processed_points"))
    print("------------------------")

if __name__ == "__main__":
    run_test()
