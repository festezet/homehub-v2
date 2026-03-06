"""
Docker Service - Manage Docker containers
"""

import docker
import logging

logger = logging.getLogger(__name__)

class DockerService:
    """Service to interact with Docker"""

    def __init__(self):
        try:
            self.client = docker.from_env()
            self.available = True
            logger.info("✅ Docker client initialized")
        except Exception as e:
            logger.error(f"❌ Docker client initialization failed: {e}")
            self.client = None
            self.available = False

    def get_containers(self):
        """Get list of all containers with their status"""
        if not self.available:
            return []

        try:
            containers = self.client.containers.list(all=True)
            result = []

            for container in containers:
                result.append({
                    'name': container.name,
                    'status': container.status,
                    'image': container.image.tags[0] if container.image.tags else 'unknown',
                    'ports': self._format_ports(container.ports),
                    'created': container.attrs['Created']
                })

            return result
        except Exception as e:
            logger.error(f"Error getting containers: {e}")
            return []

    def _format_ports(self, ports_dict):
        """Format ports dictionary to readable string"""
        if not ports_dict:
            return ""

        port_strings = []
        for container_port, host_bindings in ports_dict.items():
            if host_bindings:
                for binding in host_bindings:
                    port_strings.append(f"{binding['HostPort']}:{container_port}")

        return ", ".join(port_strings) if port_strings else ""

    def start_container(self, name):
        """Start a container by name"""
        if not self.available:
            raise Exception("Docker not available")

        try:
            container = self.client.containers.get(name)

            # Check if already running
            if container.status == 'running':
                logger.info(f"ℹ️ Container '{name}' already running")
                return True

            container.start()
            logger.info(f"✅ Container '{name}' started")
            return True
        except docker.errors.NotFound:
            logger.error(f"❌ Container '{name}' not found")
            raise Exception(f"Container '{name}' not found")
        except docker.errors.APIError as e:
            # Handle port already allocated (container probably already running)
            if 'port is already allocated' in str(e).lower() or 'already in use' in str(e).lower():
                logger.warning(f"⚠️ Container '{name}' port already in use (probably already running)")
                return True
            logger.error(f"❌ Error starting container '{name}': {e}")
            raise
        except Exception as e:
            logger.error(f"❌ Error starting container '{name}': {e}")
            raise

    def stop_container(self, name):
        """Stop a container by name"""
        if not self.available:
            raise Exception("Docker not available")

        try:
            container = self.client.containers.get(name)
            container.stop()
            logger.info(f"✅ Container '{name}' stopped")
            return True
        except docker.errors.NotFound:
            logger.error(f"❌ Container '{name}' not found")
            raise Exception(f"Container '{name}' not found")
        except Exception as e:
            logger.error(f"❌ Error stopping container '{name}': {e}")
            raise

    def restart_container(self, name):
        """Restart a container by name"""
        if not self.available:
            raise Exception("Docker not available")

        try:
            container = self.client.containers.get(name)
            container.restart()
            logger.info(f"✅ Container '{name}' restarted")
            return True
        except docker.errors.NotFound:
            logger.error(f"❌ Container '{name}' not found")
            raise Exception(f"Container '{name}' not found")
        except Exception as e:
            logger.error(f"❌ Error restarting container '{name}': {e}")
            raise

    def start_llm_stack(self):
        """Start LLM stack (Ollama + Open WebUI)"""
        if not self.available:
            raise Exception("Docker not available")

        try:
            # Stop Stable Diffusion first to free VRAM (exclusive GPU usage)
            sd_status = self.get_container_status('stable-diffusion')
            if sd_status == 'running':
                logger.info("🛑 Stopping Stable Diffusion to free VRAM...")
                self.stop_container('stable-diffusion')
                logger.info("✅ Stable Diffusion stopped")

            # Start Ollama first
            logger.info("Starting Ollama...")
            self.start_container('ollama')

            # Then start Open WebUI
            logger.info("Starting Open WebUI...")
            self.start_container('open-webui')

            logger.info("✅ LLM Stack started successfully")
            return {
                'status': 'success',
                'message': 'LLM Stack démarré (Ollama + Open WebUI)',
                'url': 'http://localhost:8081',
                'containers': ['ollama', 'open-webui'],
                'stopped': ['stable-diffusion'] if sd_status == 'running' else []
            }
        except Exception as e:
            logger.error(f"❌ Error starting LLM stack: {e}")
            raise

    def stop_llm_stack(self):
        """Stop LLM stack (Ollama + Open WebUI)"""
        if not self.available:
            raise Exception("Docker not available")

        try:
            stopped_containers = []

            # Stop Open WebUI
            webui_status = self.get_container_status('open-webui')
            if webui_status == 'running':
                logger.info("🛑 Stopping Open WebUI...")
                self.stop_container('open-webui')
                stopped_containers.append('open-webui')
                logger.info("✅ Open WebUI stopped")

            # Stop Ollama
            ollama_status = self.get_container_status('ollama')
            if ollama_status == 'running':
                logger.info("🛑 Stopping Ollama...")
                self.stop_container('ollama')
                stopped_containers.append('ollama')
                logger.info("✅ Ollama stopped")

            logger.info("✅ LLM Stack stopped successfully")
            return {
                'status': 'success',
                'message': 'LLM Stack arrêté',
                'stopped': stopped_containers
            }
        except Exception as e:
            logger.error(f"❌ Error stopping LLM stack: {e}")
            raise

    def get_container_status(self, name):
        """Get status of a specific container"""
        if not self.available:
            return None

        try:
            container = self.client.containers.get(name)
            return container.status
        except docker.errors.NotFound:
            return None
        except Exception as e:
            logger.error(f"Error getting status for '{name}': {e}")
            return None

    def start_stable_diffusion(self):
        """Start Stable Diffusion Web UI"""
        if not self.available:
            raise Exception("Docker not available")

        try:
            # Stop LLM stack first to free VRAM (exclusive GPU usage)
            stopped_containers = []
            ollama_status = self.get_container_status('ollama')
            webui_status = self.get_container_status('open-webui')

            if ollama_status == 'running' or webui_status == 'running':
                logger.info("🛑 Stopping LLM stack to free VRAM...")
                if ollama_status == 'running':
                    self.stop_container('ollama')
                    stopped_containers.append('ollama')
                if webui_status == 'running':
                    self.stop_container('open-webui')
                    stopped_containers.append('open-webui')
                logger.info("✅ LLM stack stopped")

            logger.info("Starting Stable Diffusion Web UI...")
            self.start_container('stable-diffusion')

            logger.info("✅ Stable Diffusion started successfully")
            return {
                'status': 'success',
                'message': 'Stable Diffusion Web UI démarré',
                'url': 'http://localhost:7860',
                'containers': ['stable-diffusion'],
                'stopped': stopped_containers
            }
        except Exception as e:
            logger.error(f"❌ Error starting Stable Diffusion: {e}")
            raise

    def stop_stable_diffusion(self):
        """Stop Stable Diffusion Web UI"""
        if not self.available:
            raise Exception("Docker not available")

        try:
            sd_status = self.get_container_status('stable-diffusion')

            if sd_status == 'running':
                logger.info("🛑 Stopping Stable Diffusion...")
                self.stop_container('stable-diffusion')
                logger.info("✅ Stable Diffusion stopped")

                return {
                    'status': 'success',
                    'message': 'Stable Diffusion arrêté',
                    'stopped': ['stable-diffusion']
                }
            else:
                return {
                    'status': 'success',
                    'message': 'Stable Diffusion déjà arrêté',
                    'stopped': []
                }
        except Exception as e:
            logger.error(f"❌ Error stopping Stable Diffusion: {e}")
            raise

# Create singleton instance
docker_service = DockerService()
