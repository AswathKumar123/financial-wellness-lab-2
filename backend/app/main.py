"""Fictional, in-memory API for portfolio and parallel test practice."""
from copy import deepcopy
from datetime import date
import os
from threading import Lock
from typing import Annotated, Literal
from uuid import uuid4

from fastapi import Depends, FastAPI, Header, HTTPException, Query, Response, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(title="Harbor Financial Wellness API", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173",
        ).split(",")
        if origin.strip()
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

MONTHLY = [
    {"month": month, "income": income, "expenses": expenses}
    for month, income, expenses in zip(
        ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
        [7600, 7600, 7850, 7850, 8050, 8050, 8200, 8200, 8350, 8350, 8500, 8500],
        [4820, 5100, 4740, 4920, 5250, 4910, 5160, 5050, 5240, 5140, 5370, 5210],
    )
]
BASE_GOALS = [
    {"id": "retirement", "title": "Retirement", "category": "retirement", "current": 182400, "target": 500000, "monthlyContribution": 950, "targetDate": "2040-06-01", "icon": "sun"},
    {"id": "emergency", "title": "Emergency fund", "category": "savings", "current": 14800, "target": 20000, "monthlyContribution": 450, "targetDate": "2027-09-01", "icon": "shield"},
    {"id": "college", "title": "College savings", "category": "education", "current": 7200, "target": 60000, "monthlyContribution": 300, "targetDate": "2042-08-01", "icon": "book"},
]
ACTIVITY = [
    {"id": "a1", "date": "2026-09-24", "title": "Retirement contribution", "category": "Contribution", "amount": 950},
    {"id": "a2", "date": "2026-09-18", "title": "Emergency fund deposit", "category": "Transfer", "amount": 450},
    {"id": "a3", "date": "2026-09-10", "title": "College savings deposit", "category": "Contribution", "amount": 300},
    {"id": "a4", "date": "2026-08-24", "title": "Retirement contribution", "category": "Contribution", "amount": 950},
    {"id": "a5", "date": "2026-08-18", "title": "Emergency fund deposit", "category": "Transfer", "amount": 450},
]
LOCK = Lock()
# Each worker gets a distinct fixture. Data and sessions reset when this process restarts.
USERS = {}
for number in range(1, 121):
    user_id = f"user{number:03d}"
    goals = deepcopy(BASE_GOALS)
    for goal in goals:
        goal["current"] += number * (20 if goal["id"] == "college" else 100)
        goal["monthlyContribution"] += number
    USERS[user_id] = {
        "id": user_id,
        "firstName": f"Demo {number:03d}",
        "displayName": f"Demo Member {number:03d}",
        "planName": "Your financial plan",
        "memberSince": "2022-04-01",
        "goals": goals,
    }
SESSIONS: dict[str, str] = {}


class LoginRequest(BaseModel):
    username: str
    password: str


class GoalUpdate(BaseModel):
    monthlyContribution: int = Field(ge=0, le=100000)
    targetDate: date


class GoalData(BaseModel):
    title: str = Field(min_length=1, max_length=80)
    category: Literal["retirement", "savings", "education"]
    current: int = Field(ge=0)
    target: int = Field(gt=0)
    monthlyContribution: int = Field(ge=0, le=100000)
    targetDate: date
    icon: Literal["sun", "shield", "book"]


def current_user(authorization: Annotated[str | None, Header()] = None):
    token = authorization[7:] if authorization and authorization.startswith("Bearer ") else None
    with LOCK:
        user_id = SESSIONS.get(token) if token else None
    if not user_id:
        raise HTTPException(status_code=401, detail="Please sign in")
    return USERS[user_id]


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/demo-users")
def demo_users():
    return [{"id": user["id"], "displayName": user["displayName"]} for user in USERS.values()]


@app.post("/api/auth/login")
def login(credentials: LoginRequest):
    user_id = credentials.username.lower().strip()
    if user_id not in USERS or credentials.password != f"DemoPass!{user_id[4:]}":
        raise HTTPException(status_code=401, detail="Invalid demo username or password")
    token = uuid4().hex
    with LOCK:
        SESSIONS[token] = user_id
    return {"accessToken": token, "user": {key: value for key, value in USERS[user_id].items() if key != "goals"}}


@app.post("/api/auth/logout")
def logout(authorization: Annotated[str | None, Header()] = None):
    token = authorization[7:] if authorization and authorization.startswith("Bearer ") else None
    with LOCK:
        SESSIONS.pop(token, None)
    return {"status": "signed out"}


@app.get("/api/profile")
def profile(user=Depends(current_user)):
    return {key: value for key, value in user.items() if key != "goals"}


@app.get("/api/overview")
def overview(period: Literal["6m", "12m"] = "12m", user=Depends(current_user)):
    number = int(user["id"][4:])
    months = MONTHLY[-6:] if period == "6m" else MONTHLY
    months = [{**month, "income": month["income"] + number * 10, "expenses": month["expenses"] + number * 4} for month in months]
    with LOCK:
        goals = deepcopy(user["goals"])
    return {
        "netWorth": 238450 + number * 250,
        "netWorthChangePercent": 8.2,
        "monthlyIncome": months[-1]["income"],
        "monthlyExpenses": months[-1]["expenses"],
        "monthly": months,
        "goalsFunded": sum(goal["current"] for goal in goals),
    }


@app.get("/api/goals")
def list_goals(category: Literal["all", "retirement", "savings", "education"] = "all", user=Depends(current_user)):
    with LOCK:
        goals = deepcopy(user["goals"])
    return [goal for goal in goals if category == "all" or goal["category"] == category]


@app.post("/api/goals", status_code=status.HTTP_201_CREATED)
def create_goal(goal: GoalData, user=Depends(current_user)):
    created = {"id": uuid4().hex, **goal.model_dump(mode="json")}
    with LOCK:
        user["goals"].append(created)
    return deepcopy(created)


@app.put("/api/goals/{goal_id}")
def replace_goal(goal_id: str, update: GoalData, user=Depends(current_user)):
    with LOCK:
        for index, goal in enumerate(user["goals"]):
            if goal["id"] == goal_id:
                replaced = {"id": goal_id, **update.model_dump(mode="json")}
                user["goals"][index] = replaced
                return deepcopy(replaced)
    raise HTTPException(status_code=404, detail="Goal not found")


@app.patch("/api/goals/{goal_id}")
def update_goal(goal_id: str, update: GoalUpdate, user=Depends(current_user)):
    with LOCK:
        for goal in user["goals"]:
            if goal["id"] == goal_id:
                goal.update({"monthlyContribution": update.monthlyContribution, "targetDate": update.targetDate.isoformat()})
                return deepcopy(goal)
    raise HTTPException(status_code=404, detail="Goal not found")


@app.delete("/api/goals/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_goal(goal_id: str, user=Depends(current_user)):
    with LOCK:
        for index, goal in enumerate(user["goals"]):
            if goal["id"] == goal_id:
                del user["goals"][index]
                return Response(status_code=status.HTTP_204_NO_CONTENT)
    raise HTTPException(status_code=404, detail="Goal not found")


@app.get("/api/recommendations")
def recommendations(priority: Literal["all", "high", "medium"] = "all", user=Depends(current_user)):
    with LOCK:
        goals = deepcopy(user["goals"])
    goals_by_id = {goal["id"]: goal for goal in goals}
    items = ([
        {"id": "emergency", "priority": "high", "eyebrow": "Build your safety net", "title": "Close the gap in your emergency fund", "description": f"You are {round(goals_by_id['emergency']['current'] / goals_by_id['emergency']['target'] * 100)}% of the way to your goal. Review your monthly contribution to get there sooner.", "actionGoalId": "emergency"},
    ] if "emergency" in goals_by_id else []) + [
        {"id": "retirement", "priority": "medium", "eyebrow": "Plan ahead", "title": "Review your retirement contributions", "description": "A small increase now can make a meaningful difference over time.", "actionGoalId": "retirement"},
        {"id": "college", "priority": "medium", "eyebrow": "Keep momentum", "title": "Check your college savings timeline", "description": "See how your current contribution lines up with your target date.", "actionGoalId": "college"},
    ]
    return [item for item in items if item["actionGoalId"] in goals_by_id and (priority == "all" or item["priority"] == priority)]


@app.get("/api/activity")
def activity(start: date | None = Query(default=None), end: date | None = Query(default=None), user=Depends(current_user)):
    if start and end and start > end:
        raise HTTPException(status_code=422, detail="Start date must be on or before end date")
    number = int(user["id"][4:])
    items = [{**item, "amount": item["amount"] + number} for item in ACTIVITY]
    return [item for item in items if (not start or item["date"] >= start.isoformat()) and (not end or item["date"] <= end.isoformat())]
