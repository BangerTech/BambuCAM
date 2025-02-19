import asyncio
from typing import Dict, List
from src.services.networkScanner import scanNetwork
from src.services.bambuCloudService import BambuCloudService
from .types import Printer
import logging

logger = logging.getLogger(__name__)

bambu_cloud = BambuCloudService()

async def god_mode_scan(token: str) -> Dict[str, List[Printer]]:
    """
    Scannt parallel nach LAN und Cloud Druckern
    
    Args:
        token: Cloud-Auth-Token
        
    Returns:
        Dict mit 'lan' und 'cloud' Listen von Druckern
    """
    try:
        # Starte beide Scans parallel
        lan_scan = asyncio.create_task(scanNetwork())
        cloud_scan = asyncio.create_task(bambu_cloud.get_cloud_printers())
        
        # Warte auf beide Ergebnisse
        results = await asyncio.gather(
            lan_scan,
            cloud_scan,
            return_exceptions=True
        )
        
        # Verarbeite die Ergebnisse
        lan_printers = results[0] if not isinstance(results[0], Exception) else []
        cloud_printers = results[1] if not isinstance(results[1], Exception) else []
        
        # Markiere die Drucker-Typen
        for printer in lan_printers:
            printer.type = 'LAN'
        for printer in cloud_printers:
            printer.type = 'CLOUD'
            
        logger.info(f"God Mode Scan completed: {len(lan_printers)} LAN, {len(cloud_printers)} Cloud printers found")
        
        return {
            "lan": lan_printers,
            "cloud": cloud_printers
        }
        
    except Exception as e:
        logger.error(f"Error in God Mode scan: {str(e)}")
        raise 