import io
import logging
from typing import List, Dict, Tuple
from pathlib import Path
from app.services.text_processor import TextProcessor
from app.services.export_handler import ExportHandler
from app.services.deduplicator import PointDeduplicator

logger = logging.getLogger(__name__)

class BatchProcessor:
    def __init__(self):
        self.text_processor = TextProcessor()
        self.export_handler = ExportHandler()
        self.deduplicator = PointDeduplicator()

    def _apply_deduplication(self, processed_text: str) -> str:
        lines = processed_text.split('\n')
        dedup_lines = []
        current_section_points = []
        
        for line in lines:
            if line.strip().startswith('Cycle'):
                if current_section_points:
                    dedup_points = PointDeduplicator.deduplicate_points_exact(current_section_points)
                    dedup_lines.extend(dedup_points)
                    current_section_points = []
                dedup_lines.append(line)
            elif line.strip() and not line.strip().startswith(('Cycle', '=')):
                current_section_points.append(line)
            else:
                if current_section_points:
                    dedup_points = PointDeduplicator.deduplicate_points_exact(current_section_points)
                    dedup_lines.extend(dedup_points)
                    current_section_points = []
                if line.strip():
                    dedup_lines.append(line)
        
        if current_section_points:
            dedup_points = PointDeduplicator.deduplicate_points_exact(current_section_points)
            dedup_lines.extend(dedup_points)
        
        return '\n'.join(dedup_lines)

    def process_files(self, files_list: List[Tuple[str, bytes]], points_per_cycle, dedup_enabled=False) -> List[Dict[str, Tuple[str, bytes, bytes]]]:
        """
        Process multiple files with proper cycle distribution.
        files_list: List of (filename, file_bytes)
        points_per_cycle: Number of points per cycle (distributes across all headings)
        """
        results = []
        for filename, file_content in files_list:
            try:
                try:
                    content = file_content.decode('utf-8')
                except UnicodeDecodeError:
                    try:
                        content = file_content.decode('latin-1')
                    except UnicodeDecodeError:
                        content = file_content.decode('utf-8', errors='replace')
                
                name_stem = Path(filename).stem
                logger.info(f"Processing {filename} with points_per_cycle={points_per_cycle}")
                processed_text = self.text_processor.process_text(content, points_per_cycle)
                
                if dedup_enabled and processed_text:
                    processed_text = self._apply_deduplication(processed_text)
                
                docx_file = self.export_handler.generate_docx(processed_text)
                pdf_file = self.export_handler.generate_pdf(processed_text)
                
                results.append({
                    name_stem: (
                        processed_text,
                        docx_file.getvalue() if docx_file else b'',
                        pdf_file.getvalue() if pdf_file else b''
                    )
                })
            except Exception as e:
                error_msg = f"Error processing {filename}: {str(e)}"
                results.append({
                    Path(filename).stem: (error_msg, b'', b'')
                })
        return results
