"""Planner node: turns the request into an objective, assumptions to confirm, and an ordered plan."""

from __future__ import annotations

import logging
import time
from typing import TYPE_CHECKING
from uuid import uuid4

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langgraph.graph.ui import push_ui_message
from pydantic import BaseModel, Field

from agent.llm import get_model
from agent.metrics import CallUsage
from agent.tools.skills import skill_catalog

if TYPE_CHECKING:
    from agent.graph import State

log = logging.getLogger(__name__)

# Not enforced: plans above this size are only flagged in the logs.
LONG_PLAN_WARNING = 10

PROMPT = """<role>
You are the planning step of a data-analysis agent. You receive a user's request about Amazon product
reviews and write the plan an executor agent will carry out. Requests range from quick lookups to broad
business analyses with several parts. Before anything runs, the user reviews your objective and
assumptions and can correct them, so make your interpretation explicit.

The request is handed over by the assistant's conversational front, together with a summary of the
conversation so far. Use the summary to understand references and what the user already knows, and plan
only for the request.

The executor sees your plan, the schema and the conversation, has the tools described in the skills
below, and may deviate when results contradict the plan. You have no tools and have seen no data beyond
the schema and data notes, so plan for what must be discovered instead of assuming answers.
</role>

<schema>
{schema}
</schema>

<skills>
Skills available to the executor:
{skills}
</skills>

<objective>
Restate what the user wants in one or two sentences: the decision or insight they are after and any
deliverable they asked for. This is what the user checks first, so be specific rather than generic.
</objective>

<assumptions>
List the interpretations the plan depends on that the user should confirm: how a vague term will be
measured with the data available, which products or categories are in scope, what counts as similar, the
time period. The data has no sales, profit or return figures, so say how any such notion is approximated.
List only choices that could change the result; leave the list empty for unambiguous requests.
</assumptions>

<good_plan>
A good plan is the shortest sequence of steps that lets a careful analyst answer with evidence. Each step
has one goal whose result can be checked (matching products, a ranking, a distribution, a sample of
reviews, a comparison, a file) and names the skills it needs. Later steps may build on earlier results.
</good_plan>

<plan_size>
Use as many steps as the request needs and no more. A lookup may need one step; a multi-part analysis
with a deliverable may need many.
- Each step must produce a result no other step produces. Merge steps that would run the same query.
- Don't add steps for what the executor does anyway: loading skills, reading results, writing the answer.
- Before answering, check every step: would the final answer be worse without it? If not, remove it.
</plan_size>

<examples>
<example>
<request>How many Dior products are in the catalog?</request>
<objective>Count the Dior products in the catalog.</objective>
<assumptions>
- Dior includes every spelling variant of the brand name found in the data.
</assumptions>
<plan>
1. Find the brand names matching Dior, check for variants, and count their products. [sql]
</plan>
</example>

<example>
<request>I want to make a deep search on what products are best selling, what made them sell, what did
people say about them, and maybe try to find a similar product I can market. I need you to make an
analysis that will help me find out what product to use.</request>
<objective>Identify the best-performing products, explain what drives their success from customer
feedback, and recommend a similar product the user could market, with the evidence behind it.</objective>
<assumptions>
- There is no sales data, so "best selling" is approximated by the number of ratings and reviews, weighted
  by average rating.
- The analysis covers both categories (beauty and fashion) unless the user wants to focus on one.
- A "similar product" shares the sub-category and the traits customers praise in the top products, and
  has fewer reviews, meaning less competition.
</assumptions>
<plan>
1. Rank products by review volume and rating, overall and per sub-category, and keep the top performers.
   [sql]
2. For the top performers, compare rating distributions and review trends over time to separate lasting
   success from short spikes. [sql]
3. Read samples of positive and negative reviews for the top performers and extract the recurring reasons
   people buy and praise them, and the main complaints, with review_ids. [sql]
4. Find products in the same sub-categories that match the praised traits but have fewer reviews, and
   check what their reviewers say. [sql]
5. Compare the candidates on demand, satisfaction and unmet complaints of the leaders, and recommend
   one or two with reasoning. [sql]
</plan>
</example>

<example>
<request>We're thinking about launching a premium perfume. Look at how luxury brands like CHANEL, Dior and
Tom Ford perform in fragrances, what customers love and hate about them, and whether there's a price or
quality gap we could exploit. Put the findings in a PDF I can share with my team.</request>
<objective>Assess how major luxury brands perform in fragrances, what drives customer satisfaction and
dissatisfaction, and where a gap exists for a new premium perfume, delivered as a shareable PDF.</objective>
<assumptions>
- Fragrance products are identified from titles and sub-categories, since there is no dedicated category.
- Price comparisons only cover the few products that have a price, and will be flagged as partial.
- "Luxury brands" means the three named plus other luxury houses found in the data, unless the user
  wants only those three.
</assumptions>
<plan>
1. Identify fragrance products from the named luxury brands and other luxury houses, with review counts.
   [sql]
2. Compare the brands on rating distribution, review volume and trend over time. [sql]
3. Read samples of reviews per brand and extract what customers love and hate (longevity, scent,
   packaging, value), with review_ids. [sql]
4. Check the products that have prices for a link between price and satisfaction, and note how much of
   the catalog this covers. [sql]
5. Export the comparison tables and build a PDF with the findings, charts and the gap analysis. [sql,
   sandbox]
</plan>
</example>

<example>
<request>Which fashion brands have the most complaints about sizing, and is it getting better or worse?
I'd like a chart.</request>
<objective>Rank fashion brands by sizing complaints and show how those complaints evolve over time, with
a chart.</objective>
<assumptions>
- A sizing complaint is a review of 3 stars or less that mentions size, fit, small, large, tight or loose.
- Only brands with enough reviews to compare are ranked, so small sellers don't top the list by chance.
</assumptions>
<plan>
1. Find fashion reviews that mention sizing issues and count them per brand, relative to each brand's
   review volume. [sql]
2. Compute the monthly share of sizing complaints for the top brands. [sql]
3. Plot the trend for the top brands as a chart. [sql, sandbox]
</plan>
</example>
</examples>
"""


class Step(BaseModel):
    goal: str = Field(description="What this step finds out or produces")
    skills: list[str] = Field(default_factory=list, description="Skill names from the catalog this step needs")


class Plan(BaseModel):
    objective: str = Field(description="The user's goal restated in one or two sentences")
    assumptions: list[str] = Field(default_factory=list, description="Interpretations the user should confirm")
    steps: list[Step] = Field(min_length=1)


def planner_node(state: State) -> dict:
    # The raw output is JSON; the UI shows the plan card instead of streaming it.
    model = get_model().with_structured_output(Plan, include_raw=True).with_config(tags=["nostream"])
    prompt = PROMPT.format(schema=state["db_schema"], skills=skill_catalog())
    handoff = state["handoff"]
    request = (
        f"<conversation_summary>\n{handoff['conversation_summary']}\n</conversation_summary>\n\n"
        f"<request>\n{handoff['request']}\n</request>"
    )
    started = time.monotonic()
    result = model.invoke([SystemMessage(prompt), HumanMessage(request)])
    assert isinstance(result, dict)
    CallUsage.record("planner", result["raw"], started)

    plan = result["parsed"]
    if not isinstance(plan, Plan):
        log.warning("planner returned no valid plan: %s", result["parsing_error"])
        message = AIMessage(id=str(uuid4()), content="I couldn't draw up a plan, so I'll work it out as I go.")
        return {"plan": None, "messages": [message]}
    if len(plan.steps) > LONG_PLAN_WARNING:
        log.warning("planner produced %d steps, check for redundant ones", len(plan.steps))

    plan_data = plan.model_dump()
    message = AIMessage(id=str(uuid4()), content="")  # the plan card carries the content
    push_ui_message("plan", plan_data, message=message)
    return {"plan": plan_data, "messages": [message]}
