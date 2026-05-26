from typing import List, Set
import re

class PointDeduplicator:
    """Handles deduplication and cleanup of extracted points."""
    
    @staticmethod
    def deduplicate_points(points: List[str], similarity_threshold: float = 0.95) -> List[str]:
        """Remove duplicate or near-duplicate points (95% similarity required)."""
        if not points:
            return points
        
        unique_points = []
        seen_normalized = set()
        
        for point in points:
            normalized = PointDeduplicator._normalize_point(point)
            is_duplicate = False
            for seen in seen_normalized:
                similarity = PointDeduplicator._calculate_similarity(normalized, seen)
                if similarity >= similarity_threshold:
                    is_duplicate = True
                    break
            
            if not is_duplicate:
                unique_points.append(point)
                seen_normalized.add(normalized)
        
        return unique_points
    
    @staticmethod
    def deduplicate_points_exact(points: List[str]) -> List[str]:
        """Remove exact duplicate points (case-insensitive)."""
        seen = set()
        unique_points = []
        
        for point in points:
            normalized = point.strip().lower()
            if normalized not in seen:
                seen.add(normalized)
                unique_points.append(point)
        
        return unique_points
    
    @staticmethod
    def _normalize_point(text: str) -> str:
        """Normalize point for comparison."""
        text = text.lower().strip()
        text = re.sub(r'^[•\-*+\d]+[\.\)]\s*', '', text)
        text = re.sub(r'\s+', ' ', text)
        return text
    
    @staticmethod
    def _calculate_similarity(str1: str, str2: str) -> float:
        """Calculate string similarity using sequence matching."""
        if not str1 or not str2:
            return 0.0
        
        if str1 == str2:
            return 1.0
        
        words1 = str1.split()
        words2 = str2.split()
        
        if not words1 or not words2:
            return 0.0
        
        common_words = sum(1 for word in words1 if word in words2)
        max_len = max(len(words1), len(words2))
        
        word_set1 = set(words1)
        word_set2 = set(words2)
        intersection = len(word_set1 & word_set2)
        union = len(word_set1 | word_set2)
        jaccard = intersection / union if union > 0 else 0.0
        
        positional_sim = common_words / max_len
        similarity = (0.7 * jaccard) + (0.3 * positional_sim)
        
        return min(similarity, 1.0)
    
    @staticmethod
    def remove_common_prefixes(points: List[str]) -> List[str]:
        """Remove common prefixes from all points."""
        if not points:
            return points
        
        cleaned = []
        for point in points:
            cleaned_point = re.sub(r'^[•\-*+\d]+[\.\)]\s*', '', point.strip())
            cleaned.append(cleaned_point)
        
        return cleaned
    
    @staticmethod
    def stats_before_after(original: List[str], deduplicated: List[str]) -> dict:
        """Get statistics about deduplication."""
        return {
            'original_count': len(original),
            'deduplicated_count': len(deduplicated),
            'removed_count': len(original) - len(deduplicated),
            'removal_percentage': round((len(original) - len(deduplicated)) / len(original) * 100, 1) if original else 0
        }
