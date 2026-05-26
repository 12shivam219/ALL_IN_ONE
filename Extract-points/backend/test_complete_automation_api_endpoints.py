import requests
import json

job_title = "Azure Integration Lead"
job_description = """Mandatory Skills -

Experience in APIM- Azure API Management is required.
Experience in APACHE KAFKA OR CAMEL is required.
Java : Threads, Streams, Lists, Test question.
MVC :
Spring Cloud : Spring Boot
Servlets, Soap, REST

ROLE SUMMARY AND RESPONSIBILITIES

Leadership & Team Management:

•            Lead and mentor a team of integration developers and engineers.
•            Provide technical guidance and support to team members.
•            Foster a collaborative environment to drive team success.

Integration Strategy & Design:
•            Design scalable and efficient integration solutions for various applications and systems.
•            Evaluate and select appropriate integration tools and methodology for a overall solution proposed.
•            Able to deepdive into various Everest core applications and self learner about integration patterns around them.
•            Create detailed documents around existing integration systems and use them for future solutions.

Implementation & Development:

•            Able to create comprehensive release plan for integration applications. Manage technical dependencies across the board for weekly releases with dev team.
•            Oversee the development and deployment of integration solutions.
•            Ensure integration solutions are robust, secure, and performant.
•            Troubleshoot and resolve complex integration issues.
•            Participate in project design meetings with solution architects and review design for all new and enhancement work.
•            Proactive routine analysis of Dynatrace for Prod and stage servers and identify and create plan to address any functional or performance issues.
•            Proactively bring issues and concerns to the lead and work on planning to resolve them .

Collaboration & Communication:

•            Collaborate with business stakeholders to understand integration requirements. and participate in design and triage meetings.
•            Work closely with other technical teams to ensure cohesive system architecture.
•            Communicate technical concepts and solutions effectively to non-technical stakeholders.
•            Self starter and take lead on issues without handholding or continued guidance.

Best Practices & Standards:

•            Define and enforce integration best practices, standards, and guidelines.
•            Ensure compliance with industry standards and company policies.
•            Stay up-to-date with emerging technologies and industry trends.

Technical skills

•            12+ extensive experience in any Integration technology.
•            Experience in building Rest APIS, Message Queues, Pub sub etc.
•            Advance /Proficient in APIM application.
•            Experience in Camel Apache. Additionally, Kafka for real-time streaming.
•            Proficient in Azure integration tools and capabilities.(logic apps , function apps, event grid, event hub etc.)
•            Azure Devops and expertize in GIT.
•            Knowledge of scripting is preferable (Terraform).
•            Working Knowledge of ACE is desired or should be a quick learner to grasp the concept."""

base_url = "http://127.0.0.1:8000/api/v1"

def test_api():
    print("--- 1. Testing /prepare endpoint ---")
    prepare_data = {
        "job_title": job_title,
        "job_description": job_description,
        "points_per_tech": 2,
        "recruiter_email": "test@example.com",
        "personal_message": "Hello recruiter",
        "override_resume": "Viswa_Java.docx"
    }
    
    response = requests.post(f"{base_url}/automation/prepare", data=prepare_data)
    print("Status Code:", response.status_code)
    try:
        res_json = response.json()
        print("Success:", res_json.get("success"))
        print("Match Score:", res_json.get("match_score"))
        extracted_techs = res_json.get("tech_stacks", [])
        print("Extracted Stacks:", extracted_techs)
    except Exception as e:
        print("Error parsing response:", e)
        print("Raw Response:", response.text)
        return
        
    print("\n--- 2. Testing /generate-points endpoint ---")
    # Simulate user keeping only 6 tech stacks in the review step
    reviewed_tech_stacks = [
        "APIM- Azure API Management",
        "APACHE KAFKA OR CAMEL",
        "Java",
        "MVC",
        "Spring Cloud",
        "Servlets, Soap, REST"
    ]
    
    generate_data = {
        "job_title": job_title,
        "job_description": job_description,
        "points_per_tech": 2,
        "points_per_cycle": 2,
        "recruiter_email": "test@example.com",
        "personal_message": "Hello recruiter",
        "override_resume": "Viswa_Java.docx",
        "tech_stacks": json.dumps(reviewed_tech_stacks)
    }
    
    response = requests.post(f"{base_url}/automation/generate-points", data=generate_data)
    print("Status Code:", response.status_code)
    try:
        res_json = response.json()
        print("Success:", res_json.get("success"))
        print("Selected Resume:", res_json.get("selected_resume"))
        print("Processed Points Output:")
        print(res_json.get("processed_points"))
    except Exception as e:
        print("Error parsing response:", e)
        print("Raw Response:", response.text)

    print("\n--- 3. Testing /run endpoint ---")
    run_data = {
        "job_title": job_title,
        "job_description": job_description,
        "points_per_tech": 2,
        "points_per_cycle": 2,
        "recruiter_email": "test@example.com",
        "personal_message": "Hello recruiter",
        "override_resume": "Viswa_Java.docx",
        "email_provider": "none",
        "tech_stacks": json.dumps(reviewed_tech_stacks)
    }
    
    response = requests.post(f"{base_url}/automation/run", data=run_data)
    print("Status Code:", response.status_code)
    try:
        res_json = response.json()
        print("Success:", res_json.get("success"))
        print("Resume File Path:", res_json.get("resume_file_path"))
        print("Logs:")
        for log in res_json.get("logs", []):
            print("  ", log)
    except Exception as e:
        print("Error parsing response:", e)
        print("Raw Response:", response.text)

if __name__ == "__main__":
    test_api()
