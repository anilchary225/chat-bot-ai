"""Public, versioned product knowledge for the Zenoxi landing assistant."""

import hashlib
from pathlib import Path

from bson import ObjectId

SITE_ASSISTANT_KEY = "agt_zenoxi_site_v1"
SITE_ASSISTANT_ID = ObjectId("7a656e6f7869000000000001")

_handbook = Path(__file__).with_name("site_assistant_knowledge.md").read_text(encoding="utf-8")
SITE_ASSISTANT_KNOWLEDGE_VERSION = hashlib.sha256(_handbook.encode("utf-8")).hexdigest()[:16]
SITE_ASSISTANT_SOURCES = []
for section in _handbook.strip().removeprefix("## ").split("\n## "):
    title, _, content = section.partition("\n")
    SITE_ASSISTANT_SOURCES.append({"title": title, "text": content.strip()})
