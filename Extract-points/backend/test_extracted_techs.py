import sys
import os
from pathlib import Path

# Add backend to path
sys.path.append(str(Path(__file__).parent))

from app.services.resume_matcher import ResumeMatcher
from app.services.gemini_points_generator import GeminiPointsGenerator
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

def test():
    # Load dotenv to get Groq API key
    from dotenv import load_dotenv
    load_dotenv()
    
    matcher = ResumeMatcher()
    success, tech_stacks, extract_msg = matcher.extract_job_tech_stacks(job_description)
    print("Extraction Success:", success)
    print("Extracted Tech Stacks:", tech_stacks)
    print("Message:", extract_msg)
    
    if not success or not tech_stacks:
        return
        
    generator = GeminiPointsGenerator()
    points = generator.generate_points(
        job_description=job_description,
        job_title=job_title,
        tech_stacks=tech_stacks,
        num_points=2
    )
    print("\n--- GENERATED POINTS ---")
    print(points)
    print("------------------------\n")
    
    workflow = AutomationWorkflow()
    processed, cycles = workflow._format_generated_points_as_tech_cycles(
        points,
        tech_stacks,
        points_per_cycle=2
    )
    print(f"Cycles: {cycles}")
    print("--- PROCESSED CYCLES ---")
    print(processed)
    print("------------------------")

if __name__ == "__main__":
    test()
