from typing import TypedDict, Optional

class Printer(TypedDict):
    id: str
    name: str
    ip: Optional[str]
    type: str  # 'LAN' oder 'CLOUD'
    status: str
    model: str
    access_code: Optional[str] 