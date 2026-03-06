"""
Infrastructure Service - Get system infrastructure information
"""

import logging
import shutil
import psutil
import subprocess

logger = logging.getLogger(__name__)

class InfrastructureService:
    """Service to get infrastructure monitoring data"""

    def __init__(self):
        logger.info("🛠️ Infrastructure Service initialized")

    def get_dashboard_data(self):
        """Get infrastructure dashboard data"""
        try:
            return {
                'system': self._get_system_info(),
                'storage': self._get_storage_info(),
                'gpu': self._get_gpu_info()
            }
        except Exception as e:
            logger.error(f"Error getting infrastructure data: {e}")
            return {}

    def _get_system_info(self):
        """Get system information"""
        try:
            cpu_percent = psutil.cpu_percent(interval=1)
            memory = psutil.virtual_memory()

            return {
                'cpu_percent': cpu_percent,
                'cpu_count': psutil.cpu_count(),
                'memory_total': memory.total,
                'memory_used': memory.used,
                'memory_percent': memory.percent
            }
        except Exception as e:
            logger.error(f"Error getting system info: {e}")
            return {}

    def _get_storage_info(self):
        """Get storage information"""
        try:
            data_usage = shutil.disk_usage('/data')
            home_usage = shutil.disk_usage('/home')

            return {
                'data': {
                    'total': data_usage.total,
                    'used': data_usage.used,
                    'free': data_usage.free,
                    'percent': (data_usage.used / data_usage.total) * 100
                },
                'home': {
                    'total': home_usage.total,
                    'used': home_usage.used,
                    'free': home_usage.free,
                    'percent': (home_usage.used / home_usage.total) * 100
                }
            }
        except Exception as e:
            logger.error(f"Error getting storage info: {e}")
            return {}

    def _get_gpu_info(self):
        """Get GPU information using nvidia-smi"""
        try:
            result = subprocess.run(
                ['nvidia-smi', '--query-gpu=name,memory.total,memory.used,utilization.gpu', '--format=csv,noheader,nounits'],
                capture_output=True,
                text=True,
                timeout=5
            )

            if result.returncode == 0:
                line = result.stdout.strip()
                parts = [p.strip() for p in line.split(',')]

                if len(parts) >= 4:
                    return {
                        'available': True,
                        'name': parts[0],
                        'memory_total': int(parts[1]),
                        'memory_used': int(parts[2]),
                        'utilization': int(parts[3])
                    }

            return {'available': False}

        except Exception as e:
            logger.error(f"Error getting GPU info: {e}")
            return {'available': False}

# Create singleton instance
infrastructure_service = InfrastructureService()
