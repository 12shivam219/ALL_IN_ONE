import unittest

from app.services.automation_workflow import AutomationWorkflow
from app.services.text_processor import TextProcessor


class CycleLogicTests(unittest.TestCase):
    def test_text_processor_keeps_repeated_heading_points(self):
        processor = TextProcessor()
        processed = processor.process_text(
            "\n".join(
                [
                    "Java",
                    "- Built service A",
                    "Python",
                    "\u2022 Built service B",
                    "Java",
                    "- Built service C",
                ]
            ),
            points_per_cycle=1,
        )

        self.assertIn("Cycle 1:", processed)
        self.assertIn("\u2022 Built service A", processed)
        self.assertIn("\u2022 Built service B", processed)
        self.assertIn("Cycle 2:", processed)
        self.assertIn("\u2022 Built service C", processed)

    def test_automation_cycles_one_point_from_each_tech(self):
        workflow = AutomationWorkflow.__new__(AutomationWorkflow)
        generated = "\n".join(
            [
                "Java",
                "- Java point 1",
                "- Java point 2",
                "Python",
                "- Python point 1",
                "- Python point 2",
            ]
        )

        processed, cycle_count = workflow._format_generated_points_as_tech_cycles(
            generated,
            ["Java", "Python"],
            points_per_cycle=1,
        )

        self.assertEqual(cycle_count, 2)
        self.assertIn("Cycle 1:\n\u2022 Java point 1\n\u2022 Python point 1", processed)
        self.assertIn("Cycle 2:\n\u2022 Java point 2\n\u2022 Python point 2", processed)

    def test_automation_keeps_unmatched_sections(self):
        workflow = AutomationWorkflow.__new__(AutomationWorkflow)
        generated = "\n".join(
            [
                "Java",
                "- Java point 1",
                "Backend API Delivery",
                "- API point 1",
                "- API point 2",
            ]
        )

        processed, cycle_count = workflow._format_generated_points_as_tech_cycles(
            generated,
            ["Java"],
            points_per_cycle=1,
        )

        self.assertEqual(cycle_count, 2)
        self.assertIn("\u2022 Java point 1", processed)
        self.assertIn("\u2022 API point 1", processed)
        self.assertIn("\u2022 API point 2", processed)

    def test_automation_deduplicates_reviewed_tech_labels(self):
        workflow = AutomationWorkflow.__new__(AutomationWorkflow)
        generated = "\n".join(["Java", "- Java point 1"])

        processed, cycle_count = workflow._format_generated_points_as_tech_cycles(
            generated,
            ["Java", " java "],
            points_per_cycle=1,
        )

        self.assertEqual(cycle_count, 1)
        self.assertEqual(processed.count("Java point 1"), 1)

    def test_automation_cycles_multi_points_from_each_tech(self):
        workflow = AutomationWorkflow.__new__(AutomationWorkflow)
        generated = "\n".join(
            [
                "Java",
                "- Java point 1",
                "- Java point 2",
                "- Java point 3",
                "Python",
                "- Python point 1",
                "- Python point 2",
                "- Python point 3",
            ]
        )

        processed, cycle_count = workflow._format_generated_points_as_tech_cycles(
            generated,
            ["Java", "Python"],
            points_per_cycle=2,
        )

        self.assertEqual(cycle_count, 2)
        self.assertIn("Cycle 1:\n\u2022 Java point 1\n\u2022 Java point 2\n\u2022 Python point 1\n\u2022 Python point 2", processed)
        self.assertIn("Cycle 2:\n\u2022 Java point 3\n\u2022 Python point 3", processed)


if __name__ == "__main__":
    unittest.main()
