"""Skills: skills/<name>/SKILL.md with YAML frontmatter (`name`, `description`) and markdown instructions.

Only the catalog (name + description) goes in the prompt; load_skill returns the full instructions.
"""

from functools import cache
from pathlib import Path
from typing import Self

import yaml
from pydantic import BaseModel, ConfigDict, Field, model_validator

from agent.config import get_settings


class Skill(BaseModel):
    model_config = ConfigDict(extra="ignore", frozen=True)

    name: str = Field(pattern=r"^[a-z0-9-]{1,64}$")
    description: str = Field(min_length=1, max_length=1024)
    instructions: str
    path: Path

    @model_validator(mode="after")
    def _name_matches_directory(self) -> Self:
        if self.name != self.path.parent.name:
            raise ValueError(f"skill name '{self.name}' must match its directory '{self.path.parent.name}'")
        return self

    @classmethod
    def from_file(cls, path: Path) -> Self:
        _, frontmatter, body = path.read_text().split("---", 2)
        return cls.model_validate({**yaml.safe_load(frontmatter), "instructions": body.strip(), "path": path})


@cache
def _skills() -> dict[str, Skill]:
    skills = (Skill.from_file(p) for p in sorted(get_settings().skills_dir.glob("*/SKILL.md")))
    return {skill.name: skill for skill in skills}


def skill_catalog() -> str:
    return "\n".join(f"- {skill.name}: {skill.description}" for skill in _skills().values())


def load_skill(name: str) -> str:
    """Load the full instructions of a skill. Call this before first using a skill's tools.

    Args:
        name: Skill name from the catalog.
    """
    skill = _skills().get(name)
    if skill is None:
        return f"ERROR: unknown skill '{name}'. Available: {', '.join(_skills())}"
    return skill.instructions
