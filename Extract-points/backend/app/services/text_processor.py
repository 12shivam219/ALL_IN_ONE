import re


class TextProcessor:
    def __init__(self):
        # Matches common bullet markers, including previously mojibaked bullets.
        self.bullet_pattern = re.compile(
            r"^(?:\u2022|\u00e2\u20ac\u00a2|(?<!-)[-](?!-)|\*|\+|\d+\.|\([a-z0-9]\))\s*(.*)",
            re.IGNORECASE,
        )

    def is_heading(self, line):
        """Check if a line is a heading."""
        line = line.strip()
        if not line:
            return False

        if self.has_bullet_symbol(line):
            return False

        if len(line) > 50:
            return False

        if len(line.split()) > 6:
            return False

        action_verbs = [
            "developed", "implementing", "implemented", "built", "building",
            "created", "designing", "designed", "integrated", "integrating",
            "leveraged", "collaborating", "collaborated", "enhanced", "enhancing",
            "optimized", "optimizing", "defined", "defining", "deployed", "deploying",
            "managing", "utilized", "utilizing", "established", "establishing",
            "managed", "developing", "creating", "leading", "led", "driving",
        ]
        first_word = line.lower().split()[0].rstrip(".,;:!?")
        if first_word in action_verbs:
            return False

        return bool(re.match(r"^[A-Za-z0-9]", line))

    def is_bullet_point(self, line):
        """Check if a line is a bullet point."""
        return bool(self.bullet_pattern.match(line.strip()))

    def extract_bullet_point(self, line):
        """Extract the content of a bullet point."""
        match = self.bullet_pattern.match(line.strip())
        if match:
            return match.group(1).strip()
        return None

    def has_bullet_symbol(self, line):
        """Check if a line already has a bullet symbol."""
        return bool(self.bullet_pattern.match(line.strip()))

    def add_bullet_if_missing(self, line):
        """Add a bullet symbol if the line doesn't have one."""
        stripped = line.strip()
        if self.has_bullet_symbol(line):
            return line
        if stripped and not self.is_heading(stripped):
            indent = len(line) - len(line.lstrip())
            return " " * indent + "\u2022 " + stripped
        return line

    def process_text(self, text, points_per_cycle):
        """Process the input text and extract points in cycles."""
        if not text or not text.strip():
            raise ValueError("Input text cannot be empty")

        if not isinstance(points_per_cycle, int) or points_per_cycle < 1:
            raise ValueError("Points per cycle must be a positive integer")

        lines = text.split("\n")
        if not any(line.strip() for line in lines):
            raise ValueError("No valid text content found after splitting")

        has_heading = any(self.is_heading(line.strip()) for line in lines)
        current_heading = None
        structured_content = {}

        for i, line in enumerate(lines):
            line_stripped = line.strip()
            if not line_stripped or line_stripped.replace("_", "").strip() == "":
                continue

            if current_heading is None and i == 0 and not has_heading:
                current_heading = line_stripped
                structured_content.setdefault(current_heading, [])
            elif self.is_heading(line_stripped):
                current_heading = line_stripped
                structured_content.setdefault(current_heading, [])
            elif current_heading is not None:
                structured_content[current_heading].append(line)

        if not structured_content:
            raise ValueError("No valid headings or bullet points found in the input text.")

        max_points = max(len(points) for points in structured_content.values()) if structured_content else 0
        if max_points == 0:
            raise ValueError("No points found under any headings. Please check your input format.")

        result = []
        current_cycle = 0

        while current_cycle * points_per_cycle < max_points:
            start_idx = current_cycle * points_per_cycle
            end_idx = start_idx + points_per_cycle

            cycle_content = [f"Cycle {current_cycle + 1}:"]
            for points in structured_content.values():
                heading_points = points[start_idx:min(end_idx, len(points))]
                for point in heading_points:
                    extracted = self.extract_bullet_point(point)
                    point_text = extracted if extracted is not None else point.strip()
                    if point_text:
                        cycle_content.append(f"\u2022 {point_text}")

            result.extend(cycle_content)
            current_cycle += 1

        if not result:
            raise ValueError("Failed to generate output. Please check your input format.")

        return "\n".join(result)
